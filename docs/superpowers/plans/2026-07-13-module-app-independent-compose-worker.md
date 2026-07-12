# Module App Independent Compose Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, publish, and independently deploy a non-public `module-app-worker` that advances approved manifest v2 packages from `queued` to `ready` only after deterministic S3 publication and atomic local materialization.

**Architecture:** Add token-guarded PostgreSQL leases and retries to the existing build model, extract package and artifact primitives into a pure shared package, and run one standalone Node.js worker against PostgreSQL, S3, and a writable artifact root. The worker is delivered as an independent Compose project and shares only the host artifact directory with `module-runtime`, which continues to mount it read-only.

**Tech Stack:** TypeScript, Node.js 22, Drizzle ORM, PostgreSQL, AWS SDK v3, `fflate`, `yaml`, `tar-stream`, Vitest, Docker Compose, GHCR, GitHub Actions.

## Global Constraints

- Production directory is `/www/compose/comhub/module-worker`; Compose project name is `comhub-module-worker`.
- The worker image is `ghcr.io/<owner>/comhub-module-worker:sha-<commit>` and exposes no public port.
- Initial replica count is one; database leases must still be correct with duplicate workers.
- The worker may access only PostgreSQL, configured S3, `/tmp`, and one writable artifact-root bind mount.
- Do not mount the Docker Socket; do not use privileged mode; do not add package-selected mounts, images, URLs, commands, or network policy.
- Never run package scripts, dependency installers, shell commands, Python setup hooks, or uploaded code during build or materialization.
- Use UID/GID `10001:10001`, `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges:true`, and a bounded `noexec,nosuid` `/tmp` tmpfs.
- Interpret the confirmed retry budget as one initial processing attempt plus at most three retries, using delays of 30 seconds, 2 minutes, and 10 minutes; `attemptCount` therefore ranges from 0 to 4.
- A build becomes `ready` only after staging upload, verified content-addressed S3 promotion, promoted-object download verification, and atomic local materialization all succeed.
- Keep `MODULE_APP_EXECUTION_ENABLED`, `MODULE_APP_RUNTIME_INVOCATION_ENABLED`, `MODULE_APP_WORKFLOW_PRIVILEGED_EXECUTORS_ENABLED`, `MODULE_APP_SCHEDULE_DISPATCH_ENABLED`, `MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED`, `MODULE_APP_ALIPAY_AUTO_SETTLEMENT_ENABLED`, `MODULE_APP_PUBLISHER_PAYOUT_RECORDING_ENABLED`, and `MODULE_APP_PUBLIC_EXECUTION_ENABLED` false.
- Normal pushes build and verify the worker image but never deploy it. Worker deployment requires an explicit `workflow_dispatch` input.
- Preserve the existing Baota Nginx/certificate and main application blue-green deployment path; worker deployment and rollback must not switch application traffic.
- Use focused tests first. Do not run the full `bun run test` suite.

---

## File Structure

- `packages/database/migrations/0144_add_module_app_build_leases.sql`: additive lease and retry columns, checks, and queue index.
- `packages/database/src/models/moduleAppBuild.ts`: authoritative claim, renewal, retry, completion, and failure transitions.
- `packages/module-app-build/`: pure ZIP validation, deterministic artifact creation, S3 promotion, and atomic materialization primitives.
- `apps/server/src/services/moduleAppPackage/`: thin compatibility wrappers over shared archive inspection.
- `apps/server/src/services/moduleAppBuild/`: legacy/internal orchestration updated to carry claim tokens.
- `apps/module-worker/`: configuration, PostgreSQL/S3 adapters, pipeline, polling loop, health command, cleanup, tests, and Docker image.
- `docker-compose/deploy/module-worker/`: independent production Compose project, environment template, deploy script, and rollback script.
- `docker-compose/deploy/module-runtime.yml`: isolated PostgreSQL, Redis, S3-compatible storage, worker, and runtime verification services.
- `scripts/verifyModuleAppProduction.mjs`: real queued-to-ready-to-runtime verification gate.
- `.github/workflows/comhub-deploy.yml`: worker image publication and explicit independent deployment job.
- `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md`: maintenance boundary, disabled controls, migration, deployment, and verification evidence.

### Task 1: Token-Guarded Build Leases And Retries

**Files:**
- Create: `packages/database/migrations/0144_add_module_app_build_leases.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Modify: `packages/database/src/models/moduleAppBuild.ts`
- Modify: `packages/database/src/models/__tests__/moduleAppBuild.test.ts`
- Modify: `packages/database/package.json`
- Modify: `apps/server/src/services/moduleAppBuild/contracts.ts`
- Modify: `apps/server/src/services/moduleAppBuild/service.ts`
- Modify: `apps/server/src/services/moduleAppBuild/service.test.ts`

**Interfaces:**
- Produces: `ModuleAppBuildModel.claimNext(input: { leaseDurationMs: number; workerId: string }): Promise<ClaimedModuleAppBuild | null>`.
- Produces: `renewLease(input: { buildId: string; claimToken: string; leaseDurationMs: number })`.
- Produces: `retry(input: { buildId: string; claimToken: string; failureCode: string; nextAttemptAt: Date })`.
- Produces: `failExpiredExhausted()` to terminalize an expired fourth processing attempt after a worker crash.
- Produces: token-guarded `complete` and `fail` methods.
- `ClaimedModuleAppBuild` includes `attemptCount`, `claimExpiresAt`, `claimToken`, `manifestSnapshot`, and `sourceStorageKey`.

- [ ] **Step 1: Extend database tests with lease, reclaim, and stale-token cases**

```ts
const first = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-a' });
expect(first).toMatchObject({ attemptCount: 1, status: 'building', workerId: 'worker-a' });

await expect(
  model.renewLease({ buildId: first!.id, claimToken: 'stale-token', leaseDurationMs: 60_000 }),
).rejects.toThrow('MODULE_APP_BUILD_LEASE_LOST');

clock.set(new Date(first!.claimExpiresAt.getTime() + 1));
const reclaimed = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-b' });
expect(reclaimed).toMatchObject({ attemptCount: 2, id: first!.id, workerId: 'worker-b' });
expect(reclaimed!.claimToken).not.toBe(first!.claimToken);

await expect(
  model.complete({
    artifactKey: `module-app-builds/${first!.id}/${'c'.repeat(64)}.tgz`,
    artifactSha256: 'c'.repeat(64),
    buildId: first!.id,
    claimToken: first!.claimToken,
  }),
).rejects.toThrow('MODULE_APP_BUILD_LEASE_LOST');
```

Also test `nextAttemptAt` ordering, three retries followed by fourth-attempt exhaustion, correct-token renewal, retry returning the row to `queued`, expired fourth-attempt terminalization, and ready-build immutability.

- [ ] **Step 2: Run the focused database test and confirm RED**

Run from `packages/database`:

```bash
bunx vitest run --silent='passed-only' src/models/__tests__/moduleAppBuild.test.ts
```

Expected: FAIL because lease columns and token-guarded methods do not exist.

- [ ] **Step 3: Add migration `0144` and Drizzle fields**

```sql
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_token" text;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD CONSTRAINT "module_app_builds_attempt_count_check" CHECK ("attempt_count" >= 0 AND "attempt_count" <= 4);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_app_builds_claimable_idx"
  ON "module_app_builds" ("status", "next_attempt_at", "claim_expires_at", "created_at");
```

Register journal entry `idx: 146`, tag `0144_add_module_app_build_leases`, and a monotonically increasing `when` value. Add matching Drizzle fields and checks to `moduleAppBuilds`.

- [ ] **Step 4: Implement atomic claims and token-guarded transitions**

Use `FOR UPDATE SKIP LOCKED` and select rows satisfying either:

```sql
(status = 'queued' AND next_attempt_at <= now() AND attempt_count < 4)
OR
(status = 'building' AND claim_expires_at <= now() AND attempt_count < 4)
```

Generate `claimToken` with `crypto.randomUUID()`. Every claim increments `attemptCount`, sets `status='building'`, and records a new expiry. Every renewal, retry, completion, and failure update must match `id`, `status='building'`, and `claimToken`. Clear `workerId`, `claimToken`, `claimExpiresAt`, and `claimedAt` on retry; clear active lease fields on terminal states. `failExpiredExhausted` moves expired `building` rows with `attemptCount = 4` to `failed` using `MODULE_APP_BUILD_RETRY_EXHAUSTED`, so a crash during the last attempt cannot strand a row. `complete` continues updating `module_app_versions.runtime_artifact_key` and `runtime_artifact_sha256` in the same transaction.

- [ ] **Step 5: Export the model and update the legacy server contract**

Add `"./models/moduleAppBuild": "./src/models/moduleAppBuild.ts"` to `@lobechat/database` exports. Add `claimToken` to `ModuleAppBuildWorkerRequest` and both `ModuleAppBuildResult` branches. Update `ModuleAppBuildService` so storage-signing failure, artifact failure, `complete`, and explicit worker failure all pass the active token.

- [ ] **Step 6: Run database and server tests and confirm GREEN**

```bash
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppBuild.test.ts apps/server/src/services/moduleAppBuild/service.test.ts
```

Expected: PASS, including concurrent claim, expired reclaim, stale-token denial, all three retry delays, exhausted-lease terminalization, and immutable completion.

- [ ] **Step 7: Commit**

```bash
git add packages/database/migrations/0144_add_module_app_build_leases.sql packages/database/migrations/meta/_journal.json packages/database/src/schemas/moduleApp.ts packages/database/src/models/moduleAppBuild.ts packages/database/src/models/__tests__/moduleAppBuild.test.ts packages/database/package.json apps/server/src/services/moduleAppBuild/contracts.ts apps/server/src/services/moduleAppBuild/service.ts apps/server/src/services/moduleAppBuild/service.test.ts
git commit -m "feat: add token guarded module app build leases"
```

### Task 2: Shared Package Archive Validation

**Files:**
- Create: `packages/module-app-build/package.json`
- Create: `packages/module-app-build/tsconfig.json`
- Create: `packages/module-app-build/vitest.config.mts`
- Create: `packages/module-app-build/src/index.ts`
- Create: `packages/module-app-build/src/errors.ts`
- Create: `packages/module-app-build/src/zipMetadata.ts`
- Create: `packages/module-app-build/src/scanner.ts`
- Create: `packages/module-app-build/src/source.ts`
- Create: `packages/module-app-build/src/source.test.ts`
- Modify: `apps/server/src/services/moduleAppPackage/archive.ts`
- Modify: `apps/server/src/services/moduleAppPackage/scanner.ts`
- Modify: `apps/server/src/services/moduleAppPackage/zipMetadata.ts`
- Modify: `apps/server/src/services/moduleAppPackage/archive.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `validateModuleAppBuildSource(input: ValidateModuleAppBuildSourceInput): Promise<ValidatedModuleAppBuildSource>`.
- `ValidateModuleAppBuildSourceInput` contains exact source bytes, expected source SHA-256, and the reviewed manifest snapshot.
- `ValidatedModuleAppBuildSource` contains normalized `files: Record<string, Uint8Array>` and a parsed manifest v2.
- Produces stable permanent failure codes through `ModuleAppBuildPolicyError`.

- [ ] **Step 1: Add failing shared validation tests**

```ts
const validated = await validateModuleAppBuildSource({
  bytes: validZip,
  expectedSourceSha256: sha256(validZip),
  reviewedManifest: manifest,
});
expect(validated.manifest).toEqual(manifest);
expect(validated.files['dist/index.html']).toBeDefined();

await expect(validateModuleAppBuildSource({
  bytes: validZip,
  expectedSourceSha256: '0'.repeat(64),
  reviewedManifest: manifest,
})).rejects.toMatchObject({ code: 'MODULE_APP_BUILD_SOURCE_HASH_MISMATCH' });
```

Add cases for two manifests, v1 manifest, manifest mismatch, absolute paths, backslashes, empty segments, `..`, duplicate paths, symlink/non-regular metadata, encrypted entries, nested archives, forbidden extensions, executable magic, EICAR, compression ratio, file count, expanded size, missing frontend output, directory output without `index.html`, missing Node entry, and missing Python entry.

- [ ] **Step 2: Run shared and server archive tests and confirm RED**

```bash
bunx vitest run --silent='passed-only' packages/module-app-build/src/source.test.ts apps/server/src/services/moduleAppPackage/archive.test.ts
```

Expected: FAIL because `@lobechat/module-app-build` does not exist.

- [ ] **Step 3: Move ZIP metadata and static scanning into the shared package**

Enhance ZIP metadata to classify each entry as `directory`, `regular`, `symlink`, or `other` from Unix mode and directory attributes. Reject `symlink` and `other`. Preserve encrypted-entry detection. Keep the current limits exactly: 50 MiB source archive, 1,000 files, 25 MiB per file, 100 MiB expanded bytes, 200:1 compression ratio, and 256 KiB manifest.

- [ ] **Step 4: Implement v2 source verification without executing package content**

```ts
export type ValidatedModuleAppBuildSource = {
  files: Record<string, Uint8Array>;
  manifest: Extract<ModuleAppPackageManifest, { manifestVersion: 2 }>;
};

export const validateModuleAppBuildSource = async (
  input: ValidateModuleAppBuildSourceInput,
): Promise<ValidatedModuleAppBuildSource> => {
  assertSha256(input.bytes, input.expectedSourceSha256);
  const entries = inspectModuleAppZipEntries(input.bytes);
  const files = await unzipModuleAppPackage(input.bytes, DEFAULT_LIMITS);
  assertNoScanIssues(scanModuleAppPackage({ entries, files }));
  const manifest = parseSingleRootV2Manifest(files);
  assert.deepStrictEqual(manifest, input.reviewedManifest);
  assertDeclaredOutputs(files, manifest);
  return { files, manifest };
};
```

`assertDeclaredOutputs` accepts a frontend HTML file directly or a directory containing `index.html`; every `runtime.functions[].entry` must be a regular file. The package exposes no process, shell, installer, or network API.

- [ ] **Step 5: Keep server ingestion on the shared safety primitives**

Replace server-local scanner and metadata implementations with re-exports from `@lobechat/module-app-build`; keep `parseModuleAppPackageArchive` as the v1/v2 submission wrapper because it still owns business-server submission validation.

- [ ] **Step 6: Run focused tests and confirm GREEN**

```bash
bunx vitest run --silent='passed-only' packages/module-app-build/src/source.test.ts apps/server/src/services/moduleAppPackage/archive.test.ts apps/server/src/services/moduleAppPackage/scanner.test.ts apps/server/src/services/moduleAppPackage/zipMetadata.test.ts
```

Expected: PASS with identical server ingestion behavior plus stricter worker-only v2 output checks.

- [ ] **Step 7: Commit**

```bash
git add packages/module-app-build apps/server/src/services/moduleAppPackage pnpm-lock.yaml
git commit -m "feat: share module app package safety validation"
```

### Task 3: Deterministic TGZ Assembly

**Files:**
- Create: `packages/module-app-build/src/artifact.ts`
- Create: `packages/module-app-build/src/artifact.test.ts`
- Modify: `packages/module-app-build/src/index.ts`
- Modify: `packages/module-app-build/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `buildDeterministicModuleAppArtifact(input: { files: Record<string, Uint8Array> }): Promise<{ bytes: Uint8Array; sha256: string }>`.
- Produces: `inspectModuleAppArtifact(bytes): Promise<ModuleAppArtifactEntry[]>` for materialization verification.

- [ ] **Step 1: Add deterministic-byte and header tests**

```ts
const first = await buildDeterministicModuleAppArtifact({ files });
const second = await buildDeterministicModuleAppArtifact({ files: reverseObject(files) });
expect(second.bytes).toEqual(first.bytes);
expect(second.sha256).toBe(first.sha256);

const entries = await inspectModuleAppArtifact(first.bytes);
expect(entries).toEqual(expect.arrayContaining([
  expect.objectContaining({ gid: 0, mode: 0o444, path: 'dist/index.html', type: 'file', uid: 0 }),
]));
```

Also assert lexical path order, synthesized directory mode `0555`, file mode `0444`, epoch timestamps, empty user/group names, stable gzip bytes, and rejection of unsafe input paths.

- [ ] **Step 2: Run the artifact test and confirm RED**

```bash
bunx vitest run --silent='passed-only' packages/module-app-build/src/artifact.test.ts
```

Expected: FAIL because the deterministic artifact API is absent.

- [ ] **Step 3: Add `tar-stream` and implement canonical headers**

Add `tar-stream` and its TypeScript declarations to `@lobechat/module-app-build`. Use it for tar encoding/decoding and Node `zlib.gzip` with `{ level: 9, mtime: 0 }`. Normalize paths to POSIX separators, synthesize parent directory entries, sort all entries lexically, and write these exact headers:

```ts
const fileHeader = { gid: 0, gname: '', mode: 0o444, mtime: new Date(0), type: 'file', uid: 0, uname: '' };
const directoryHeader = { gid: 0, gname: '', mode: 0o555, mtime: new Date(0), type: 'directory', uid: 0, uname: '' };
```

Hash the exact gzip bytes with SHA-256. `inspectModuleAppArtifact` accepts only regular files and directories and enforces the same count, per-file, and total-expanded limits as source validation.

- [ ] **Step 4: Run deterministic tests twice and confirm GREEN**

```bash
bunx vitest run --silent='passed-only' packages/module-app-build/src/artifact.test.ts
bunx vitest run --silent='passed-only' packages/module-app-build/src/artifact.test.ts
```

Expected: both runs PASS and report the same fixture SHA-256.

- [ ] **Step 5: Commit**

```bash
git add packages/module-app-build/src/artifact.ts packages/module-app-build/src/artifact.test.ts packages/module-app-build/src/index.ts packages/module-app-build/package.json pnpm-lock.yaml
git commit -m "feat: build deterministic module app artifacts"
```

### Task 4: Verified S3 Promotion And Atomic Materialization

**Files:**
- Create: `packages/module-app-build/src/storage.ts`
- Create: `packages/module-app-build/src/storage.test.ts`
- Create: `packages/module-app-build/src/materializer.ts`
- Create: `packages/module-app-build/src/materializer.test.ts`
- Modify: `packages/module-app-build/src/index.ts`
- Modify: `apps/server/src/services/moduleAppBuild/storage.ts`
- Modify: `apps/server/src/services/moduleAppBuild/storage.test.ts`

**Interfaces:**
- Produces: `ModuleAppObjectStorage` with `getObject`, `headObject`, `putObject`, and `deleteObject`.
- Produces: `publishVerifiedModuleAppArtifact(input): Promise<{ artifactKey: string; artifactSha256: string }>`.
- Produces: `materializeModuleAppArtifact(input): Promise<{ directory: string; reused: boolean }>`.

- [ ] **Step 1: Add failing storage and filesystem tests**

```ts
const published = await publishVerifiedModuleAppArtifact({
  artifactBytes,
  artifactSha256,
  buildId,
  storage,
});
expect(published.artifactKey).toBe(`module-app-builds/${buildId}/${artifactSha256}.tgz`);
expect(storage.putObject).toHaveBeenNthCalledWith(1, expect.objectContaining({
  key: `module-app-build-staging/${buildId}.tgz`,
}));

const materialized = await materializeModuleAppArtifact({
  artifactBytes,
  artifactRoot,
  artifactSha256,
  buildId,
  claimToken,
  manifest,
});
expect(materialized.directory).toBe(path.join(artifactRoot, artifactSha256));
```

Add tampered staging bytes, tampered promoted bytes, traversal, links/devices/FIFO/socket, interrupted staging, existing-valid reuse, existing-marker mismatch, read-only modes, and no final directory after failure.

- [ ] **Step 2: Run storage and materializer tests and confirm RED**

```bash
bunx vitest run --silent='passed-only' packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.test.ts apps/server/src/services/moduleAppBuild/storage.test.ts
```

Expected: FAIL because shared publication and materialization do not exist.

- [ ] **Step 3: Implement verified promotion**

Write the build-scoped staging key, re-read it, compare bounded byte length and SHA-256, write the content-addressed final key with content type `application/gzip` and cache control `private, max-age=31536000, immutable`, re-read the final object, verify it again, then delete staging best-effort. Never accept a source or destination key from package data.

- [ ] **Step 4: Implement staging extraction and atomic rename**

Extract only beneath `<artifactRoot>/.staging/<buildId>-<claimToken>`. Validate every tar path before joining it to disk. After extraction, verify manifest outputs again, write `.module-app-artifact.json` containing `artifactSha256`, `buildId`, `manifestSha256`, and `schemaVersion: 1`, chmod directories `0555` and files `0444`, fsync files and directories where supported, then rename the complete staging directory to `<artifactRoot>/<artifactSha256>`.

When the destination exists, parse the marker, verify all three identity fields and declared files, and return `{ reused: true }`. A missing or mismatched marker throws `MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH`; never replace or delete that destination automatically.

- [ ] **Step 5: Refactor server storage through the shared publisher**

Keep current presigned request preparation unchanged. Adapt `FileS3` to `ModuleAppObjectStorage` and delegate staging verification/promotion to `publishVerifiedModuleAppArtifact`, preserving existing key formats and stable server error codes.

- [ ] **Step 6: Run focused tests and confirm GREEN**

```bash
bunx vitest run --silent='passed-only' packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.test.ts apps/server/src/services/moduleAppBuild/storage.test.ts
```

Expected: PASS, including promoted-object re-read and atomic reuse behavior.

- [ ] **Step 7: Commit**

```bash
git add packages/module-app-build/src/storage.ts packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.ts packages/module-app-build/src/materializer.test.ts packages/module-app-build/src/index.ts apps/server/src/services/moduleAppBuild/storage.ts apps/server/src/services/moduleAppBuild/storage.test.ts
git commit -m "feat: publish and materialize verified module artifacts"
```

### Task 5: Standalone Worker Adapters And Processing Pipeline

**Files:**
- Create: `apps/module-worker/package.json`
- Create: `apps/module-worker/tsconfig.json`
- Create: `apps/module-worker/vitest.config.mts`
- Create: `apps/module-worker/src/config.ts`
- Create: `apps/module-worker/src/database.ts`
- Create: `apps/module-worker/src/s3.ts`
- Create: `apps/module-worker/src/errors.ts`
- Create: `apps/module-worker/src/processor.ts`
- Create: `apps/module-worker/src/processor.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `loadModuleAppWorkerConfig(env): ModuleAppWorkerConfig`.
- Produces: `createModuleAppWorkerDatabase(config)` returning `{ buildModel, close, ping }`.
- Produces: `createModuleAppWorkerStorage(config): ModuleAppObjectStorage`.
- Produces: `processModuleAppBuild(claim, dependencies): Promise<'ready' | 'retried' | 'failed'>`.

- [ ] **Step 1: Add failing configuration and processor tests**

```ts
expect(loadModuleAppWorkerConfig({
  DATABASE_URL: 'postgresql://worker:secret@db/comhub',
  MODULE_APP_ARTIFACT_ROOT: '/runtime/artifacts',
  S3_ACCESS_KEY_ID: 'key',
  S3_BUCKET: 'comhub',
  S3_ENDPOINT: 'http://s3:9000',
  S3_SECRET_ACCESS_KEY: 'secret',
})).toMatchObject({ maxAttempts: 4, maxRetries: 3, pollIntervalMs: 5000 });

await expect(processModuleAppBuild(claim, deps)).resolves.toBe('ready');
expect(deps.buildModel.complete).toHaveBeenCalledWith(expect.objectContaining({
  artifactSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  buildId: claim.id,
  claimToken: claim.claimToken,
}));
```

Assert exact operation order: source download, source hash/manifest validation, deterministic build, staging/final promotion, promoted-object download, materialization, completion. Add permanent error, retryable error, exhausted attempt, and lease-lost cases.

- [ ] **Step 2: Run worker tests and confirm RED**

```bash
bunx vitest run --silent='passed-only' apps/module-worker/src/processor.test.ts
```

Expected: FAIL because the worker package and processor are absent.

- [ ] **Step 3: Implement strict environment parsing**

Use these defaults: poll 5,000 ms, lease 60,000 ms, renewal 20,000 ms, shutdown 40,000 ms, cleanup every 600,000 ms, stale staging after 3,600,000 ms, maximum retries 3, maximum processing attempts 4, and retry delays `[30_000, 120_000, 600_000]`. Require `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and absolute `MODULE_APP_ARTIFACT_ROOT`. Support `S3_REGION` default `auto` and `S3_ENABLE_PATH_STYLE` default true.

- [ ] **Step 4: Implement PostgreSQL and S3 adapters**

Create a `pg.Pool` with application name `comhub-module-worker`, max 4 connections, 10-second connect timeout, 30-second idle timeout, and 120-second statement timeout. Build Drizzle with `@lobechat/database/schemas`, cast through the repository's established `LobeChatDatabase` adapter boundary, and instantiate exported `ModuleAppBuildModel`. The S3 adapter maps AWS SDK `HeadObject`, `GetObject`, `PutObject`, and `DeleteObject` commands to `ModuleAppObjectStorage` and buffers at most the configured 256 MiB artifact limit.

- [ ] **Step 5: Implement failure classification and processing**

Permanent codes are source hash mismatch, archive/manifest/policy rejection, missing frontend/function output, artifact hash mismatch, and materialized destination mismatch. Retryable codes are source download, S3 head/read/write, PostgreSQL availability, and filesystem availability. Staging-object deletion remains best-effort after a verified promotion and records a bounded cleanup failure metric. Unknown errors map to `MODULE_APP_BUILD_INTERNAL_FAILED` and fail permanently without storing stack traces or secrets.

On retryable failure after attempts 1, 2, and 3, call `retry` with delays 30 seconds, 2 minutes, and 10 minutes. On retryable failure during attempt 4, call token-guarded `fail` with `MODULE_APP_BUILD_RETRY_EXHAUSTED`. On lease loss, stop immediately and do not write build state. Error logs contain only build ID, bounded code, attempt, and outcome.

- [ ] **Step 6: Run worker tests and confirm GREEN**

```bash
bunx vitest run --silent='passed-only' apps/module-worker/src/processor.test.ts
```

Expected: PASS with no process-spawn or package-network mock ever called.

- [ ] **Step 7: Commit**

```bash
git add apps/module-worker pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: process module app builds in a standalone worker"
```

### Task 6: Polling, Lease Renewal, Health, Cleanup, And Metrics

**Files:**
- Create: `apps/module-worker/src/health.ts`
- Create: `apps/module-worker/src/health.test.ts`
- Create: `apps/module-worker/src/cleanup.ts`
- Create: `apps/module-worker/src/cleanup.test.ts`
- Create: `apps/module-worker/src/worker.ts`
- Create: `apps/module-worker/src/worker.test.ts`
- Create: `apps/module-worker/src/index.ts`
- Modify: `packages/observability-otel/src/modules/module-app/index.ts`
- Modify: `packages/observability-otel/src/modules/module-app/index.test.ts`

**Interfaces:**
- Produces: `ModuleAppWorker.run(signal): Promise<void>` and `runHealthcheck(config): Promise<void>`.
- Produces: `cleanupStaleModuleAppStaging(input): Promise<{ failed: number; removed: number }>`.
- Produces bounded build queue, claim, lease, result, artifact, materialization, and cleanup metrics.

- [ ] **Step 1: Add failing loop, health, cleanup, and metric tests**

```ts
await worker.pollOnce();
expect(buildModel.claimNext).toHaveBeenCalledWith({ leaseDurationMs: 60_000, workerId });
expect(healthState.lastSuccessfulPollAt).toEqual(now);

await expect(runHealthcheck(config)).resolves.toBeUndefined();
clock.advanceBy(31_000);
await expect(runHealthcheck(config)).rejects.toThrow('MODULE_APP_WORKER_HEALTH_STALE');
```

Test that renewal runs every 20 seconds while processing, SIGTERM stops new claims, current processing receives up to 40 seconds, stale staging is deleted only when `buildModel.isClaimActive({ buildId, claimToken })` is false, and content-addressed final directories are never deleted.

- [ ] **Step 2: Run tests and confirm RED**

```bash
bunx vitest run --silent='passed-only' apps/module-worker/src/health.test.ts apps/module-worker/src/cleanup.test.ts apps/module-worker/src/worker.test.ts packages/observability-otel/src/modules/module-app/index.test.ts
```

Expected: FAIL because loop, health, cleanup, and worker metrics are absent.

- [ ] **Step 3: Implement the worker loop and lease heartbeat**

`pollOnce` first calls `failExpiredExhausted`, records queue depth and oldest eligible age, claims one row, starts a renewal timer, processes the build, and always stops the timer. A lease renewal conflict aborts processing through an `AbortController`. An idle poll sleeps 5 seconds with an abortable timer. SIGINT/SIGTERM stop polling immediately and wait at most 40 seconds for the active promise before closing PostgreSQL. `index.ts` calls `register({ name: 'comhub-module-worker' })` from `@lobechat/observability-otel/node` before creating database or HTTP clients.

- [ ] **Step 4: Implement file-based health without a public port**

The main process writes `/tmp/module-app-worker-health.json` atomically after every successful poll with `{ eventLoopAt, lastSuccessfulPollAt, workerId }`. `node worker.mjs healthcheck` validates that the poll is at most 30 seconds old, runs `SELECT 1`, and creates, fsyncs, and removes `<artifactRoot>/.health/<random>.probe`. Health output is one bounded line and contains no URL credentials.

- [ ] **Step 5: Implement stale staging cleanup**

Parse only names matching `<uuid>-<uuid>` under `.staging`. Ignore unknown names and final hash directories. For directories older than one hour, call `isClaimActive`; remove only inactive directories, count failures, and continue. Run cleanup at startup and every ten minutes.

- [ ] **Step 6: Add bounded metrics**

Add counters/histograms for claims (`claimed`, `recovered`, `conflict`), lease renewals (`succeeded`, `lost`), build outcomes (`ready`, `retry`, `failed` plus bounded failure code), build duration, queue depth/oldest age, artifact bytes, materialization duration, and cleanup result. Do not attach build, package, version, worker, application, user, or storage keys as attributes.

- [ ] **Step 7: Run tests and confirm GREEN**

```bash
bunx vitest run --silent='passed-only' apps/module-worker/src/health.test.ts apps/module-worker/src/cleanup.test.ts apps/module-worker/src/worker.test.ts packages/observability-otel/src/modules/module-app/index.test.ts
```

Expected: PASS, including graceful shutdown and no-final-artifact-deletion coverage.

- [ ] **Step 8: Commit**

```bash
git add apps/module-worker/src packages/observability-otel/src/modules/module-app
git commit -m "feat: operate module worker with leases health and metrics"
```

### Task 7: Hardened Worker Image

**Files:**
- Create: `apps/module-worker/Dockerfile`
- Create: `apps/module-worker/.dockerignore`
- Modify: `apps/module-worker/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: a single bundled `/app/worker.mjs` entry supporting normal mode and `healthcheck` mode.
- Container default user is `10001:10001`; no port and no Docker CLI are installed.

- [ ] **Step 1: Add image build and metadata assertions to the worker package test script**

```bash
docker build -f apps/module-worker/Dockerfile -t comhub-module-worker:test .
docker image inspect comhub-module-worker:test --format '{{json .Config}}'
```

Expected RED before the Dockerfile exists.

- [ ] **Step 2: Build a minimal multi-stage image**

Use `node:22.22.0-alpine3.23` for build and runtime stages. Activate pnpm `10.33.0`, install the frozen workspace subset, and bundle `apps/module-worker/src/index.ts` with esbuild for Node 22 ESM. The runtime stage installs only `tini`, creates UID/GID 10001, creates `/app` and `/runtime/artifacts`, copies only `worker.mjs`, sets `USER 10001:10001`, uses `tini` as entrypoint, and defines:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "/app/worker.mjs", "healthcheck"]
CMD ["node", "/app/worker.mjs"]
```

Do not install Docker CLI, bash, compilers, package managers, or application source in the runtime stage.

- [ ] **Step 3: Build and inspect the image**

```bash
docker build -f apps/module-worker/Dockerfile -t comhub-module-worker:test .
docker image inspect comhub-module-worker:test --format '{{.Config.User}} {{json .Config.ExposedPorts}} {{json .Config.Healthcheck.Test}}'
```

Expected: `10001:10001`, no exposed ports, and the Node healthcheck command.

- [ ] **Step 4: Prove the image contains no Docker Socket client path**

```bash
docker run --rm --entrypoint node comhub-module-worker:test -e "const fs=require('fs');process.exit(fs.existsSync('/var/run/docker.sock')||fs.existsSync('/usr/bin/docker')?1:0)"
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/module-worker/Dockerfile apps/module-worker/.dockerignore apps/module-worker/package.json pnpm-lock.yaml
git commit -m "build: add hardened module worker image"
```

### Task 8: Independent Production Compose And Rollback

**Files:**
- Create: `docker-compose/deploy/module-worker/compose.yml`
- Create: `docker-compose/deploy/module-worker/.env.example`
- Create: `docker-compose/deploy/module-worker/deploy.sh`
- Create: `docker-compose/deploy/module-worker/rollback.sh`
- Create: `docker-compose/deploy/module-worker/compose.test.mjs`

**Interfaces:**
- Produces: independent Compose project `comhub-module-worker` with one service `module-app-worker`.
- Produces: `deploy.sh <immutable-image-ref>` and `rollback.sh` without main traffic switching.

- [ ] **Step 1: Add failing Compose policy tests**

Parse `docker compose -f docker-compose/deploy/module-worker/compose.yml config --format json` and assert one service, no ports, no privileged mode, `read_only=true`, all capabilities dropped, `no-new-privileges`, UID/GID 10001, one writable `/runtime/artifacts` bind, no `/var/run/docker.sock`, bounded `noexec,nosuid` tmpfs, restart policy, healthcheck, and all Module App mutation flags false.

- [ ] **Step 2: Run the Compose test and confirm RED**

```bash
node docker-compose/deploy/module-worker/compose.test.mjs
```

Expected: FAIL because the independent Compose project is absent.

- [ ] **Step 3: Add the exact production Compose contract**

Use image `${COMHUB_MODULE_WORKER_IMAGE:?immutable worker image required}`, `env_file: .env`, `stop_grace_period: 45s`, a writable `${MODULE_APP_ARTIFACT_ROOT:?}:/runtime/artifacts:rw` bind, and an external network named by `${COMHUB_PLATFORM_NETWORK:-comhub_default}`. Keep every mutation flag explicitly set to `false` in the service environment. Do not define Nginx labels or public ports.

- [ ] **Step 4: Implement deploy and rollback scripts**

`deploy.sh` rejects non-`sha-*` image tags, verifies migration `0144` columns through a read-only PostgreSQL query, stores the currently running image in `.previous-image`, exports the new image, runs `docker compose config`, pulls only `module-app-worker`, starts it with `--no-deps --wait`, and verifies image, user, read-only root, dropped capabilities, security options, mounts, no Socket, health, and disabled flags. When a `module-runtime` container exists, inspect its `/runtime/artifacts` mount and require the same host source path with `RW=false`. `rollback.sh` reads `.previous-image`, performs the same replacement and verification, and never deletes S3 objects or artifact directories.

- [ ] **Step 5: Run Compose policy tests and shell syntax checks**

```bash
node docker-compose/deploy/module-worker/compose.test.mjs
bash -n docker-compose/deploy/module-worker/deploy.sh docker-compose/deploy/module-worker/rollback.sh
```

Expected: PASS with no Compose port or Docker Socket mount.

- [ ] **Step 6: Commit**

```bash
git add docker-compose/deploy/module-worker
git commit -m "ops: add independent module worker compose deployment"
```

### Task 9: Real PostgreSQL, S3, Worker, And Runtime Gate

**Files:**
- Modify: `docker-compose/deploy/module-runtime.yml`
- Create: `apps/module-worker/src/integration.test.ts`
- Create: `scripts/fixtures/moduleAppWorkerFixture.mts`
- Modify: `scripts/verifyModuleAppProduction.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `verify:module-app-worker` as a fail-closed real-container gate.
- Extends: `verify:module-app-production` to include the worker gate before runtime assertions.

- [ ] **Step 1: Add a failing end-to-end fixture test**

The fixture creates an approved manifest v2 package and queued build, uploads the exact ZIP to isolated S3-compatible storage, and records the source SHA-256. The assertion waits for `ready`, reads the final S3 object, verifies database hash/key identity, verifies `<artifactRoot>/<sha>/dist/index.html`, and requests `/artifacts/<sha>/dist/index.html` from `module-runtime`.

- [ ] **Step 2: Run the new gate and confirm RED**

```bash
node scripts/verifyModuleAppProduction.mjs --worker-only
```

Expected: FAIL because Compose has no S3 service or worker and the fixture path does not exist.

- [ ] **Step 3: Extend isolated Compose infrastructure**

Add an S3-compatible RustFS service and bucket initializer, a `worker` profile for `module-app-worker`, and the shared host artifact root mounted worker `rw` and runtime `ro`. PostgreSQL and S3 use isolated test credentials. The worker service has no ports and no Docker Socket. Keep Redis for existing lease gates.

- [ ] **Step 4: Seed, migrate, and process a real build**

The verification runner must: start PostgreSQL/S3; run repository migrations; seed/upload the fixture; build and start the real worker image; wait with a 120-second deadline; assert status `ready`; stop the worker; start `module-runtime`; request the materialized file; inspect worker UID, read-only root, capabilities, security options, tmpfs, mount mode, and Socket absence; inspect runtime artifact mount as read-only.

- [ ] **Step 5: Add tamper and disabled-flag assertions**

Run a second fixture with a source hash mismatch and assert `failed`, bounded failure code, no final S3 artifact, and no content-addressed runtime directory. Assert all eight production mutation flags are not `true` in worker, runtime, and main-app probe environments.

- [ ] **Step 6: Run focused unit/integration gates**

```bash
node scripts/verifyModuleAppProduction.mjs --worker-only
```

Expected: the runner invokes `apps/module-worker/src/integration.test.ts` with isolated PostgreSQL/S3 environment values and passes one real queued-to-ready build, one tampered failed build, and runtime serving the read-only materialized asset.

- [ ] **Step 7: Run the full non-credentialed production gate**

```bash
pnpm verify:module-app-production
```

Expected: PASS for worker, PostgreSQL, S3, Redis, runtime, and existing security probes. Credentialed Alipay/browser tests remain outside this command.

- [ ] **Step 8: Commit**

```bash
git add docker-compose/deploy/module-runtime.yml apps/module-worker/src/integration.test.ts scripts/fixtures/moduleAppWorkerFixture.mts scripts/verifyModuleAppProduction.mjs package.json
git commit -m "test: verify module builds through worker and runtime"
```

### Task 10: CI Publication, Explicit Worker Deployment, Docs, And Final Verification

**Files:**
- Modify: `.github/workflows/comhub-deploy.yml`
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Produces: immutable `worker_image_ref` output from the build job.
- Produces: `deploy_module_worker` workflow input and independent `deploy-module-worker` job.
- Preserves: existing `deploy` input and blue-green application deployment job unchanged in behavior.

- [ ] **Step 1: Add the manual deployment input and worker image outputs**

Add `deploy_module_worker` as a required choice input defaulting to `false`. Resolve `${IMAGE_NAME}-module-worker:sha-${GITHUB_SHA::12}`, add optional manual tags, and publish it with `apps/module-worker/Dockerfile` for `linux/amd64`. Normal pushes build and push but never satisfy the deployment job condition.

- [ ] **Step 2: Add an independent deployment job**

The job condition is exactly `github.event_name == 'workflow_dispatch' && inputs.deploy_module_worker == 'true'`. Install SSH credentials, create `/www/compose/comhub/module-worker`, copy `compose.yml`, `deploy.sh`, and `rollback.sh` without overwriting server `.env`, and execute `deploy.sh` with the immutable worker image. Do not call the main `deploy.sh`, modify Nginx, or switch blue-green traffic.

- [ ] **Step 3: Keep worker verification required before image publication**

Ensure the existing non-credentialed Module App verification job runs `pnpm verify:module-app-production`, which now includes the real worker gate. Keep credentialed Alipay/browser probes conditional and keep both build and deployment jobs blocked if required verification fails.

- [ ] **Step 4: Update governance and operational docs**

Document migration `0144`, `@lobechat/module-app-build`, `apps/module-worker`, S3/PostgreSQL/artifact-root dependencies, production path, shared artifact mount modes, retry policy, health behavior, manual deploy/rollback commands, and the fact that `ready` does not publish or enable execution. Add changelog IDs `MODULE-APP-WORKER-001` through `MODULE-APP-WORKER-005` for leases, deterministic artifact, atomic materialization, independent deployment, and real-container verification.

- [ ] **Step 5: Validate workflow syntax and focused TypeScript contracts**

```bash
node -e "import('yaml').then(({parse})=>parse(require('fs').readFileSync('.github/workflows/comhub-deploy.yml','utf8')))"
bun run type-check
```

Expected: workflow YAML parses and type-check passes.

- [ ] **Step 6: Run the final focused verification matrix**

```bash
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppBuild.test.ts packages/module-app-build/src/source.test.ts packages/module-app-build/src/artifact.test.ts packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.test.ts apps/server/src/services/moduleAppBuild/service.test.ts apps/server/src/services/moduleAppBuild/storage.test.ts apps/module-worker/src/processor.test.ts apps/module-worker/src/health.test.ts apps/module-worker/src/cleanup.test.ts apps/module-worker/src/worker.test.ts packages/observability-otel/src/modules/module-app/index.test.ts
node docker-compose/deploy/module-worker/compose.test.mjs
pnpm verify:module-app-production
git diff --check
```

Expected: all focused tests pass, Compose policy passes, the real worker/runtime gate passes, and `git diff --check` prints no output.

- [ ] **Step 7: Review production-disabled controls from rendered Compose and workflow**

```bash
docker compose -f docker-compose/deploy/module-worker/compose.yml config | grep -E 'MODULE_APP_(EXECUTION|RUNTIME_INVOCATION|WORKFLOW_PRIVILEGED_EXECUTORS|SCHEDULE_DISPATCH|ALIPAY_PAYMENT_CREATION|ALIPAY_AUTO_SETTLEMENT|PUBLISHER_PAYOUT_RECORDING|PUBLIC_EXECUTION)_ENABLED: "?false"?'
```

Expected: all eight controls render false; no worker deployment path runs on `push`.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/comhub-deploy.yml docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "ci: publish and manually deploy module worker"
```

## Plan Acceptance Gate

- An approved clean manifest v2 package automatically advances from `queued` to `ready` through the real worker.
- Claims are exclusive, renewable, reclaimable only after expiry, and guarded by a unique active token.
- The retry budget is three after the initial attempt; delays are 30 seconds, 2 minutes, and 10 minutes, and no fifth processing attempt is possible.
- Source ZIP, deterministic TGZ, promoted S3 key/hash, database identity, marker, and local directory are cryptographically linked.
- Build completion occurs only after the promoted object is re-downloaded and atomically materialized.
- Existing valid content-addressed artifacts are reused; mismatched destinations fail closed.
- Package content never controls commands, dependency installation, images, mounts, credentials, URLs, or network requests.
- Worker container runs as UID/GID 10001 with read-only root, dropped capabilities, no new privileges, bounded tmpfs, no public port, and no Docker Socket.
- `module-runtime` reads the same artifact root read-only and can serve the materialized frontend asset.
- Pushes build and verify the worker image but never deploy it automatically.
- Manual worker deploy and rollback affect only `/www/compose/comhub/module-worker` and do not switch application traffic.
- All Module App execution, privileged workflow, schedule, Alipay mutation, payout, and public execution flags remain disabled.
- Focused tests, type-check, Compose policy, real container gate, workflow YAML parsing, and `git diff --check` pass.
