# Task 4: Verified S3 Promotion And Atomic Materialization

## Status

COMPLETE. Verified object-store promotion and atomic local materialization are implemented on `feat/module-app-compose-worker`.

## Scoped Changes

- Added `packages/module-app-build/src/storage.ts` with `ModuleAppObjectStorage` and `publishVerifiedModuleAppArtifact`.
- Added `packages/module-app-build/src/materializer.ts` with `materializeModuleAppArtifact`.
- Added focused shared-package tests in `storage.test.ts` and `materializer.test.ts`.
- Exported the new shared APIs from `packages/module-app-build/src/index.ts`.
- Adapted the server `FileS3` boundary to the shared publisher without changing presigned request preparation or rewriting the existing claim-scoped staging object.
- Added server coverage for promoted-object re-read verification and preserved stable server error codes.
- Did not create or modify `pnpm-lock.yaml`.

## Implemented Guarantees

- Staging keys remain `module-app-build-staging/<buildId>/<claimToken>.tgz`.
- Final keys remain `module-app-builds/<buildId>/<artifactSha256>.tgz`.
- Build and claim key segments are validated before any object write.
- Staging and final objects are each checked by bounded `Content-Length`, exact byte length, and SHA-256 after writing.
- Final objects use `application/gzip` and `private, max-age=31536000, immutable`.
- Staging deletion occurs only after final verification and is best-effort.
- Materialization first reuses the shared streaming, bounded artifact inspector.
- Extraction occurs only under `<artifactRoot>/.staging/<buildId>-<claimToken>` and accepts only safe file/directory entries.
- Declared frontend and runtime function outputs must be regular files after extraction and during reuse.
- `.module-app-artifact.json` records `artifactSha256`, `buildId`, canonical `manifestSha256`, and `schemaVersion: 1`.
- Files receive `0444`; directories receive `0555` where the platform supports POSIX mode representation.
- Files and directories are fsynced where supported before atomic rename.
- Existing destinations are reused only after marker identity and declared-file validation.
- Existing destination mismatch throws `MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH` and is never deleted.
- Owned staging trees are cleaned on failure, including read-only nested directories; a post-rename durability failure rolls back the newly created final directory.

## RED Evidence

Shared package command:

```powershell
bunx vitest run --config packages/module-app-build/vitest.config.mts --silent='passed-only' packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.test.ts
```

Initial result: exit code 1, 2 failed files, 19 failed tests. Every test failed because the public APIs were absent:

```text
TypeError: publishVerifiedModuleAppArtifact is not a function
TypeError: materializeModuleAppArtifact is not a function
```

Server command:

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppBuild/storage.test.ts
```

Initial result: exit code 1, 2 failed and 4 passed. The existing adapter did not re-read the promoted object, and the promoted-byte tamper case resolved instead of rejecting.

Additional fencing RED command:

```powershell
bunx vitest run --config packages/module-app-build/vitest.config.mts --silent='passed-only' packages/module-app-build/src/storage.test.ts
```

Result before the key-segment fix: exit code 1, 2 failed and 4 passed. Unsafe build/claim segments resolved and produced keys containing `../` instead of throwing `MODULE_APP_BUILD_ARTIFACT_KEY_INVALID`.

Server preservation RED command:

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppBuild/storage.test.ts
```

Result before the adapter no-op fix: exit code 1, 1 failed and 5 passed. `uploadBuffer` was called twice because the server rewrote the already uploaded staging object; the required preserved behavior is one final-object upload.

## GREEN Evidence

Exact requested command:

```powershell
bunx vitest run --silent='passed-only' packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.test.ts apps/server/src/services/moduleAppBuild/storage.test.ts
```

Result: exit code 0. The root Vitest configuration selected the server file only: 1 test file passed, 6 tests passed. The shared package tests require the package-local config in this workspace.

Shared package plus inspector regression command:

```powershell
bunx vitest run --config packages/module-app-build/vitest.config.mts --silent='passed-only' packages/module-app-build/src/artifact.test.ts packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.test.ts
```

Result: exit code 0, 3 test files passed, 31 tests passed.

Server storage and service regression command:

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppBuild/storage.test.ts apps/server/src/services/moduleAppBuild/service.test.ts
```

Result: exit code 0, 2 test files passed, 12 tests passed.

## Static Verification

Targeted lint:

```powershell
bunx eslint packages/module-app-build/src/storage.ts packages/module-app-build/src/storage.test.ts packages/module-app-build/src/materializer.ts packages/module-app-build/src/materializer.test.ts packages/module-app-build/src/index.ts apps/server/src/services/moduleAppBuild/storage.ts apps/server/src/services/moduleAppBuild/storage.test.ts
```

Result: exit code 0.

Whitespace validation:

```powershell
git diff --check
```

Result: exit code 0.

Package type check:

```powershell
bunx tsc --noEmit -p packages/module-app-build/tsconfig.json
```

Result: exit code 1 with only pre-existing workspace dependency/global errors in `packages/const/src/version.ts`, `packages/model-runtime/src/providers/replicate/index.ts`, and `packages/ssrf-safe-fetch/index.ts`. No Task 4 file diagnostic was reported.

Root type check:

```powershell
bun run type-check
```

Result: exit code 1 due existing unresolved workspace dependencies and unrelated type errors, including `gpt-tokenizer`, `mathjs`, `tsup`, `@electric-sql/pglite`, `xlsx`, OpenTelemetry packages, `request-filtering-agent`, and existing `fetch-sse` typing errors. No Task 4 file diagnostic was reported.

## Process Check

After the user stop request, `Get-Process` showed no `bun` or `vitest` process. Only long-lived CodeGraph, Hermes, and Codex Node processes were present, so no test process was terminated.

## Concerns

- POSIX directory mode `0555` is requested with `chmod`. Windows reports the resulting read-only directory mode as `0444`; the test accounts for the platform representation while verifying the requested immutable behavior.
- Full repository type-check remains blocked by unrelated missing dependencies and existing diagnostics listed above.

