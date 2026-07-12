# Module App Runtime, SDK, And Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproducibly build reviewed source packages, launch their static frontend inside the ComHub shell, and expose a capability-scoped SDK and isolated Node.js/Python execution contract.

**Architecture:** Extend the existing upload and review pipeline with manifest v2, immutable build records, and an external runtime boundary. ComHub signs short-lived installation capabilities; a separate runtime service serves static assets and executes one reviewed artifact through fixed platform images. The feature remains disabled until the production sandbox gate in plan 5 passes.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, TRPC, React 19, Vitest, Node.js 22, Python 3.12, S3-compatible storage, Docker/OCI fixed images.

## Global Constraints

- Execute this plan first; migrations `0137` through `0140` depend on migration `0136`.
- Reuse `module_app_*`, `ModuleAppModel`, `ModuleAppPackageIngestionService`, and `FileS3`.
- Keep existing `manifest.json` packages readable; executable packages use `module-app.yaml` with `manifestVersion: 2`.
- Application frontends run on `MODULE_APP_RUNTIME_ORIGIN`, never the ComHub origin.
- Do not grant iframe `allow-same-origin`; validate every `postMessage` origin and nonce.
- Runtime code may use only platform Node.js 22 or Python 3.12 images.
- Reject user Dockerfiles, arbitrary images, privileged execution, and long-lived daemons.
- Do not add external antivirus integration.
- Keep executable launch behind `MODULE_APP_EXECUTION_ENABLED=false` by default.
- Core contracts and security boundaries require tests before implementation.

---

## File Structure

- `packages/types/src/moduleAppRuntime.ts`: manifest v2, build, capability, launch, and invocation contracts.
- `packages/module-app-sdk/`: browser SDK and typed bridge protocol.
- `packages/database/migrations/0136_add_module_app_build_runtime.sql`: build records and immutable version artifact fields.
- `packages/database/src/schemas/moduleApp.ts`: Drizzle representation of build/runtime state.
- `packages/database/src/models/moduleAppBuild.ts`: build claims, completion, and failure transitions.
- `apps/server/src/services/moduleAppBuild/`: build orchestration and runtime-service client.
- `apps/server/src/services/moduleAppRuntime/`: capability signing and launch policy.
- `apps/module-runtime/`: separate static-asset and invocation service.
- `src/features/ModuleAppRuntime/`: trusted shell and sandboxed iframe host.

### Task 1: Manifest V2 And Runtime Contracts

**Files:**
- Create: `packages/types/src/moduleAppRuntime.ts`
- Create: `packages/types/src/moduleAppRuntime.test.ts`
- Modify: `packages/types/src/moduleApp.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/business-server/src/module-apps/packageManifest.ts`
- Modify: `packages/business-server/src/module-apps/packageManifest.test.ts`
- Modify: `apps/server/src/services/moduleAppPackage/archive.ts`
- Modify: `apps/server/src/services/moduleAppPackage/archive.test.ts`

**Interfaces:**
- Produces: `ModuleAppManifestV2`, `ModuleAppBuildProfile`, `ModuleAppCapabilityClaims`, `ModuleAppLaunchContext`, and `ModuleAppInvocation`.
- Preserves: `ModuleAppPackageManifest` v1 parsing for non-executable legacy packages.

- [ ] **Step 1: Add failing manifest and capability contract tests**

```ts
expect(moduleAppManifestV2Schema.parse({
  app: { id: 'jobs-board', name: 'Jobs Board' },
  build: { frontend: { output: 'dist', profile: 'node22-static' } },
  manifestVersion: 2,
  permissions: ['data.read', 'data.write'],
  runtime: { functions: [{ entry: 'server/search.ts', key: 'search', runtime: 'node22' }] },
  version: '1.0.0',
}).version).toBe('1.0.0');

expect(() => moduleAppManifestV2Schema.parse({
  build: { image: 'developer/custom:latest' },
  manifestVersion: 2,
})).toThrow();
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppRuntime.test.ts packages/business-server/src/module-apps/packageManifest.test.ts apps/server/src/services/moduleAppPackage/archive.test.ts`

Expected: FAIL because `moduleAppManifestV2Schema` and YAML archive parsing do not exist.

- [ ] **Step 3: Implement the versioned schemas and discriminated parser**

```ts
export const moduleAppRuntimeLanguageSchema = z.enum(['node22', 'python312']);
export const moduleAppBuildProfileSchema = z.enum(['node22-static', 'python312-assets']);
export const moduleAppManifestV2Schema = z.object({
  app: z.object({ id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(120) }),
  build: z.object({ frontend: z.object({ output: z.string(), profile: moduleAppBuildProfileSchema }) }),
  manifestVersion: z.literal(2),
  permissions: z.array(z.string()).max(80).default([]),
  runtime: z.object({ functions: z.array(z.object({
    entry: z.string(), key: z.string().regex(/^[a-z][a-z0-9_]+$/), runtime: moduleAppRuntimeLanguageSchema,
  })).max(80).default([]) }),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
});
```

Parse root `module-app.yaml` as v2 with the repository's YAML dependency. Continue parsing root `manifest.json` through the current v1 schema. Reject packages containing a Dockerfile, OCI manifest, executable entry outside declared paths, or both manifest formats.

- [ ] **Step 4: Run tests and type contracts**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppRuntime.test.ts packages/types/src/moduleApp.test.ts packages/business-server/src/module-apps/packageManifest.test.ts apps/server/src/services/moduleAppPackage/archive.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/moduleAppRuntime.ts packages/types/src/moduleAppRuntime.test.ts packages/types/src/moduleApp.ts packages/types/src/index.ts packages/business-server/src/module-apps/packageManifest.ts packages/business-server/src/module-apps/packageManifest.test.ts apps/server/src/services/moduleAppPackage/archive.ts apps/server/src/services/moduleAppPackage/archive.test.ts
git commit -m "feat: define module app executable package contracts"
```

### Task 2: Immutable Build Persistence

**Files:**
- Create: `packages/database/migrations/0136_add_module_app_build_runtime.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppBuild.ts`
- Create: `packages/database/src/models/__tests__/moduleAppBuild.test.ts`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`

**Interfaces:**
- Produces: `ModuleAppBuildModel.claimNext`, `complete`, `fail`, and `getByVersionId`.
- Consumes: manifest v2 build profile and content hashes from Task 1.

- [ ] **Step 1: Add failing schema and state-transition tests**

```ts
const build = await model.create({ packageId, sourceSha256, versionId });
const claimed = await model.claimNext({ workerId: 'builder-1' });
expect(claimed?.id).toBe(build.id);
await model.complete({ artifactKey: 'module-app-builds/a/hash.tgz', artifactSha256, buildId: build.id });
await expect(model.complete({ artifactKey: 'other', artifactSha256, buildId: build.id })).rejects.toThrow('MODULE_APP_BUILD_IMMUTABLE');
```

- [ ] **Step 2: Run focused database tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppBuild.test.ts packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: FAIL because `module_app_builds` is absent.

- [ ] **Step 3: Add the migration and model**

Create `module_app_builds` with `package_id`, `version_id`, `status`, `source_sha256`, `artifact_key`, `artifact_sha256`, `build_profile`, `worker_id`, `claimed_at`, `completed_at`, `failure_code`, timestamps, and a unique `version_id`. Add `runtime_artifact_key`, `runtime_artifact_sha256`, and `runtime_manifest` to `module_app_versions`. Add `module_app_installation_secrets` with installation, secret key, encrypted value, actor, and timestamps; never store plaintext. Use `FOR UPDATE SKIP LOCKED` when claiming a queued build.

```ts
export class ModuleAppBuildModel {
  create: (input: CreateBuildInput) => Promise<ModuleAppBuildItem>;
  claimNext: (input: { workerId: string }) => Promise<ModuleAppBuildItem | null>;
  complete: (input: CompleteBuildInput) => Promise<ModuleAppBuildItem>;
  fail: (input: { buildId: string; failureCode: string }) => Promise<ModuleAppBuildItem>;
}
```

- [ ] **Step 4: Verify migration registration and transitions**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppBuild.test.ts packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: PASS, including concurrent claim and immutable completion cases.

- [ ] **Step 5: Commit**

```bash
git add packages/database/migrations/0136_add_module_app_build_runtime.sql packages/database/migrations/meta/_journal.json packages/database/src/schemas/moduleApp.ts packages/database/src/models/moduleAppBuild.ts packages/database/src/models/__tests__/moduleAppBuild.test.ts packages/database/src/schemas/moduleApp.schema.test.ts
git commit -m "feat: persist immutable module app builds"
```

### Task 3: Build Orchestration

**Files:**
- Create: `apps/server/src/services/moduleAppBuild/contracts.ts`
- Create: `apps/server/src/services/moduleAppBuild/service.ts`
- Create: `apps/server/src/services/moduleAppBuild/service.test.ts`
- Create: `apps/server/src/services/moduleAppBuild/storage.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `src/features/Admin/moduleApps/packageReview.test.tsx`

**Interfaces:**
- Produces: `ModuleAppBuildService.enqueueApprovedPackage`, `claimBuild`, and `recordBuildResult`.
- Consumes: `ModuleAppBuildModel` and `FileS3`.

- [ ] **Step 1: Add failing orchestration tests**

```ts
await service.enqueueApprovedPackage({ packageId, reviewerId });
expect(buildModel.create).toHaveBeenCalledWith(expect.objectContaining({ packageId, sourceSha256 }));
expect(packageModel.approvePackageSubmissionForAdmin).not.toHaveBeenCalledBefore(buildModel.create);
```

Assert that approval creates a build for v2 packages, while v1 manifest-only approval keeps current behavior. A build failure must leave the version unpublished.

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppBuild/service.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps/packageReview.test.tsx`

Expected: FAIL because executable approval has no build stage.

- [ ] **Step 3: Implement orchestration and admin actions**

```ts
export interface ModuleAppBuildWorkerRequest {
  buildId: string;
  buildProfile: 'node22-static' | 'python312-assets';
  sourceDownloadUrl: string;
  sourceSha256: string;
  uploadUrl: string;
}
```

Approval of v2 packages changes review status to `approved` and build status to `queued`; publication remains blocked until `recordBuildResult` verifies artifact metadata and content hash. Return stable error codes to the admin UI and show queued, building, failed, and ready states.

- [ ] **Step 4: Verify the approval-to-build gate**

Run the same focused command from Step 2.

Expected: PASS; executable packages cannot publish before a successful build.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/moduleAppBuild packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps/packageReview.test.tsx
git commit -m "feat: gate executable module apps on platform builds"
```

### Task 4: Capability Gateway And Browser SDK

**Files:**
- Create: `packages/module-app-sdk/package.json`
- Create: `packages/module-app-sdk/tsconfig.json`
- Create: `packages/module-app-sdk/src/index.ts`
- Create: `packages/module-app-sdk/src/bridge.ts`
- Create: `packages/module-app-sdk/src/client.ts`
- Create: `packages/module-app-sdk/src/client.test.ts`
- Create: `apps/server/src/services/moduleAppRuntime/capability.ts`
- Create: `apps/server/src/services/moduleAppRuntime/capability.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `createModuleAppSdk`, `signModuleAppCapability`, and `verifyModuleAppCapability`.
- Capability claims: application, version, installation, user, workspace, permissions, nonce, audience, issued-at, and expiry.

- [ ] **Step 1: Add failing token and bridge tests**

```ts
const token = await signModuleAppCapability({
  appId, audience: 'module-runtime', expiresInSeconds: 300, installationId,
  permissions: ['data.read'], userId, versionId,
});
await expect(verifyModuleAppCapability(token, { installationId })).resolves.toMatchObject({ appId });
await expect(verifyModuleAppCapability(token, { installationId: otherId })).rejects.toThrow('MODULE_APP_CAPABILITY_SCOPE_MISMATCH');
```

The browser test must ignore messages from a wrong origin or wrong nonce.

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/module-app-sdk/src/client.test.ts apps/server/src/services/moduleAppRuntime/capability.test.ts`

Expected: FAIL because the package and capability signer are absent.

- [ ] **Step 3: Implement the SDK and five-minute capability**

```ts
export interface ModuleAppSdk {
  invoke<T>(method: string, input: unknown): Promise<T>;
  context(): Promise<ModuleAppRuntimeContext>;
  on(event: 'progress' | 'navigation', listener: (payload: unknown) => void): () => void;
}
```

Use an asymmetric or deployment-managed signing key, `aud=module-runtime`, a maximum five-minute expiry, and nonce replay checks for mutation calls. Never expose the signing key or internal runtime URL to the iframe.

- [ ] **Step 4: Verify token isolation and SDK bridge behavior**

Run the focused command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/module-app-sdk pnpm-workspace.yaml packages/types/src/index.ts apps/server/src/services/moduleAppRuntime/capability.ts apps/server/src/services/moduleAppRuntime/capability.test.ts
git commit -m "feat: add module app capability SDK"
```

### Task 5: Controlled Core Capability Gateway

**Files:**
- Create: `packages/business-server/src/module-apps/sdk/context.ts`
- Create: `packages/business-server/src/module-apps/sdk/files.ts`
- Create: `packages/business-server/src/module-apps/sdk/http.ts`
- Create: `packages/business-server/src/module-apps/sdk/notifications.ts`
- Create: `packages/business-server/src/module-apps/sdk/secrets.ts`
- Create: `packages/business-server/src/module-apps/sdk/gateway.ts`
- Create: `packages/business-server/src/module-apps/sdk/gateway.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `packages/module-app-sdk/src/client.ts`
- Modify: `packages/module-app-sdk/src/client.test.ts`

**Interfaces:**
- Produces: capability-scoped `context`, `files`, `http`, `notifications`, and server-only `secrets` handlers.
- Consumes: `FileS3`, `NotificationModel`, `assertSafeModuleAppApiUrl`, and `KeyVaultsGateKeeper`.

- [ ] **Step 1: Add failing capability and leakage tests**

```ts
await expect(gateway.call({ capability: readOnly, method: 'files.createUpload', input: {} })).rejects.toThrow('MODULE_APP_CAPABILITY_DENIED');
await expect(gateway.call({ capability: runtimeToken, method: 'secrets.get', input: { key: 'CRM_TOKEN' } })).resolves.toEqual({ value: 'secret' });
expect(await gateway.call({ capability: browserToken, method: 'secrets.get', input: { key: 'CRM_TOKEN' } })).not.toHaveProperty('value');
await expect(gateway.call({ capability: httpToken, method: 'http.fetch', input: { url: 'http://169.254.169.254/' } })).rejects.toThrow('MODULE_APP_UNSAFE_API_URL');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/sdk/gateway.test.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/module-app-sdk/src/client.test.ts`

Expected: FAIL because the core capability gateway does not exist.

- [ ] **Step 3: Implement bounded handlers**

```ts
export type ModuleAppGatewayMethod =
  | 'context.get'
  | 'files.createUpload'
  | 'files.createDownload'
  | 'http.fetch'
  | 'notifications.create'
  | 'secrets.get';
```

Bind file keys to the installation prefix and return short-lived signed URLs. Restrict notifications to the invoking user or current workspace and enforce per-installation rate limits. Validate HTTP hosts against reviewed manifest permissions and the existing SSRF guard. Encrypt installation secrets with `KeyVaultsGateKeeper`; decrypt only inside the server runtime path and never return plaintext to browser capabilities. Expose context fields through an allowlist rather than serializing user or workspace records.

- [ ] **Step 4: Verify handlers and commit**

Run the focused command from Step 2.

Expected: PASS, including cross-installation file denial, notification target denial, secret redaction, and private-network denial.

```bash
git add packages/business-server/src/module-apps/sdk packages/database/src/models/moduleApp.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/module-app-sdk/src/client.ts packages/module-app-sdk/src/client.test.ts
git commit -m "feat: expose controlled module app system capabilities"
```

### Task 6: Runtime Service Contract And Fixed Images

**Files:**
- Create: `apps/module-runtime/package.json`
- Create: `apps/module-runtime/tsconfig.json`
- Create: `apps/module-runtime/src/server.ts`
- Create: `apps/module-runtime/src/invocation.ts`
- Create: `apps/module-runtime/src/policy.ts`
- Create: `apps/module-runtime/src/invocation.test.ts`
- Create: `apps/module-runtime/docker/Dockerfile.node22`
- Create: `apps/module-runtime/docker/Dockerfile.python312`
- Create: `apps/server/src/services/moduleAppRuntime/client.ts`
- Create: `apps/server/src/services/moduleAppRuntime/client.test.ts`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**
- Produces: internal `POST /v1/invocations` and public read-only static asset routes.
- Consumes: verified capability, immutable artifact hash, runtime policy, and S3 object.

- [ ] **Step 1: Add failing protocol and denial tests**

```ts
expect(await invoke({ runtime: 'node22', timeoutMs: 1000 })).toMatchObject({ status: 'succeeded' });
await expect(invoke({ runtime: 'node22', timeoutMs: 60_001 })).rejects.toThrow('MODULE_APP_RUNTIME_POLICY_DENIED');
await expect(invoke({ image: 'custom/image' } as never)).rejects.toThrow();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' apps/module-runtime/src/invocation.test.ts apps/server/src/services/moduleAppRuntime/client.test.ts`

Expected: FAIL because no runtime service exists.

- [ ] **Step 3: Implement the internal service contract**

```ts
export interface RuntimeInvocationRequest {
  artifactSha256: string;
  capability: string;
  entry: string;
  input: unknown;
  invocationId: string;
  runtime: 'node22' | 'python312';
  timeoutMs: number;
}
```

The service verifies capability and artifact hash, uses a read-only artifact mount and ephemeral `/tmp`, runs as a non-root UID, denies network by default, captures bounded stdout/stderr, and kills the process group on timeout. The platform Dockerfiles contain only approved runtimes and the platform launcher; package dependencies come from the immutable build artifact. Production isolation is not enabled until plan 5 verifies namespace/seccomp controls.

- [ ] **Step 4: Verify service contracts**

Run the focused command from Step 2.

Expected: PASS without executing arbitrary host commands in tests; tests use a fake launcher adapter.

- [ ] **Step 5: Commit**

```bash
git add apps/module-runtime apps/server/src/services/moduleAppRuntime/client.ts apps/server/src/services/moduleAppRuntime/client.test.ts pnpm-workspace.yaml
git commit -m "feat: add fixed module app runtime service"
```

### Task 7: Main-Site Sandbox Shell And Launch API

**Files:**
- Create: `src/features/ModuleAppRuntime/SandboxFrame.tsx`
- Create: `src/features/ModuleAppRuntime/SandboxFrame.test.tsx`
- Modify: `src/features/ModuleAppRuntime/index.tsx`
- Modify: `src/features/ModuleAppRuntime/PageRenderer.tsx`
- Modify: `src/services/moduleApp.ts`
- Modify: `src/services/moduleApp.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`

**Interfaces:**
- Produces: `moduleApp.getLaunchContext` and `SandboxFrame`.
- Consumes: capability signer and immutable ready version.

- [x] **Step 1: Add failing launch authorization and iframe tests**

```tsx
expect(screen.getByTitle('Jobs Board')).toHaveAttribute('sandbox', 'allow-forms allow-scripts allow-downloads');
expect(screen.getByTitle('Jobs Board')).not.toHaveAttribute('sandbox', expect.stringContaining('allow-same-origin'));
```

Router tests must reject uninstalled, unentitled, suspended, wrong-workspace, and non-ready versions.

- [x] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/SandboxFrame.test.tsx src/services/moduleApp.test.ts apps/server/src/routers/lambda/moduleApp.test.ts`

Expected: FAIL because the launch context and iframe do not exist.

- [x] **Step 3: Implement the trusted shell**

```ts
type ModuleAppLaunchContext = {
  capability: string;
  expiresAt: string;
  iframeUrl: string;
  installationId: string;
  nonce: string;
  runtimeOrigin: string;
};
```

Render loading, denied, build-not-ready, runtime-unavailable, and retry states. Send capability only after the iframe posts a ready message with the expected origin and nonce. Keep current route files thin and preserve both desktop router configurations.

- [x] **Step 4: Run the focused suite and router sync test**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/SandboxFrame.test.tsx src/services/moduleApp.test.ts apps/server/src/routers/lambda/moduleApp.test.ts src/spa/router/desktopRouter.sync.test.tsx`

Expected: PASS.

- [x] **Step 5: Run plan verification**

Run: `bun run type-check`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [x] **Step 6: Update governance docs and commit**

Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md` with the disabled runtime capability, required environment variables, Docker impact, and production gate.

```bash
git add src/features/ModuleAppRuntime src/services/moduleApp.ts src/services/moduleApp.test.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts packages/database/src/models/moduleApp.ts docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "feat: launch module apps in the isolated site shell"
```

## Plan Acceptance Gate

- Manifest v1 remains readable and v2 executable packages are reproducible.
- A successful build produces one immutable artifact hash per version.
- No executable package can publish before build success.
- SDK messages reject wrong origin, installation, version, user, workspace, nonce, and expiry.
- File, notification, HTTP, context, and secret APIs enforce reviewed capabilities and installation scope.
- The main-site iframe never receives same-origin privileges.
- Runtime service tests use fixed Node.js/Python profiles and deny custom images.
- `MODULE_APP_EXECUTION_ENABLED` remains false in production.
- Targeted tests, router sync, type-check, and `git diff --check` pass.

## Phase 1 Acceptance Review (2026-07-11)

- Status: accepted for disabled, non-production integration only. Production execution remains blocked.
- Review correction: runtime capabilities now carry an immutable `artifactSha256`, and the runtime service compares that signed hash with every invocation before launching a process.
- Fresh verification: 152 focused root/types/SDK/business-server tests passed, plus 13 pure database package tests; `bun run type-check` and targeted ESLint passed.
- Environment-limited verification: PostgreSQL integration suites for build claiming, executable approval, and launch-context isolation require `DATABASE_TEST_URL`, which is not configured in this workspace. They remain required in CI or a seeded test environment.
- Deferred production gates: production artifact extraction and read-only bind mount, shared replay/rate-limit storage, per-invocation namespace/seccomp/network/resource isolation, Browser E2E, migration rehearsal, smoke probes, and blue-green rollback proof.
- Operational rule: do not set `MODULE_APP_EXECUTION_ENABLED=true` in production until the Phase 5 gate is complete.
