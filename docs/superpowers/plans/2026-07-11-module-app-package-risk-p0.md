# Module App Package Risk P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable upload sessions, cross-instance package quotas, static package scanning, and deterministic S3/OSS cleanup without executing uploaded code.

**Architecture:** A new database-backed upload-session model owns quota reservations and state transitions. Server package services own ZIP inspection, scanning, storage compensation, legacy rescans, and cleanup; tRPC and maintenance routes stay thin. Package review remains human-controlled and approval requires a linked clean scan.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, Next.js route handlers, tRPC, AWS S3-compatible storage, fflate, Vitest, React 19.

## Global Constraints

- Uploaded package contents remain review-only and non-executable.
- Reuse the existing S3/OSS configuration; add no environment variables, Docker volumes, queues, containers, iframes, or remote module runtime.
- Use one additive migration named `0135_add_module_app_package_uploads.sql`; do not rewrite earlier migrations.
- New sessions always have an authenticated user, but the FK remains nullable with `ON DELETE SET NULL` so cleanup state survives user deletion.
- Default limits are 50 MiB per archive, 3 open sessions, 20 issued sessions per rolling 24 hours, 500 MiB retained bytes, 2-hour session lifetime, 100 cleanup rows per batch, and 100 persisted scan issues.
- Every production behavior starts with a failing test and is implemented in the smallest reversible slice.
- Do not touch MCP, Skills, discover/community, Platform Plugin, package execution, immutable upgrades, or installed-app pagination in P0.

---

### Task 1: Upload Contracts, Schema, And Additive Migration

**Files:**
- Modify: `packages/types/src/moduleApp.ts`
- Modify: `packages/types/src/moduleApp.test.ts`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`
- Create: `packages/database/migrations/0135_add_module_app_package_uploads.sql`
- Modify: `packages/database/migrations/meta/_journal.json`

**Interfaces:**
- Produces: `ModuleAppPackageUploadStatus`, `ModuleAppPackageScanStatus`, `ModuleAppPackageUploadTarget`, `moduleAppPackageUploadIdSchema`, and fixed quota constants.
- Produces: `moduleAppPackageUploads` and `ModuleAppPackageUploadItem`.
- Changes: `moduleAppPackageUploadedSubmitSchema` requires `uploadId`.

- [ ] **Step 1: Write failing contract and schema tests**

Add tests that parse a valid upload target/session status, reject submit input without `uploadId`, assert every limit constant, assert `moduleAppPackageUploads` is exported, and assert migration `0135` plus its journal entry exist. The core assertions are:

```typescript
expect(moduleAppPackageUploadedSubmitSchema.safeParse({
  fileName: 'app.zip',
  storageKey: 'module-app-packages/user/app.zip',
}).success).toBe(false);

expect(moduleAppPackageUploadedSubmitSchema.parse({
  fileName: 'app.zip',
  storageKey: 'module-app-packages/user/app.zip',
  uploadId: '00000000-0000-4000-8000-000000000001',
})).toMatchObject({ uploadId: '00000000-0000-4000-8000-000000000001' });

expect(moduleAppPackageUploads).toBeDefined();
expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_package_uploads"');
expect(journal.entries.some(({ tag }) => tag === '0135_add_module_app_package_uploads')).toBe(true);
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' packages/types/src/moduleApp.test.ts
Push-Location packages/database
bunx vitest run --silent='passed-only' src/schemas/moduleApp.schema.test.ts
Pop-Location
```

Expected: failures for missing upload status contracts, table export, migration, and journal entry.

- [ ] **Step 3: Add contracts and fixed limits**

Add these contracts to `packages/types/src/moduleApp.ts`:

```typescript
export const MODULE_APP_PACKAGE_MAX_OPEN_UPLOADS = 3;
export const MODULE_APP_PACKAGE_MAX_DAILY_UPLOADS = 20;
export const MODULE_APP_PACKAGE_MAX_RETAINED_BYTES = 500 * 1024 * 1024;
export const MODULE_APP_PACKAGE_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
export const MODULE_APP_PACKAGE_CLEANUP_BATCH_SIZE = 100;
export const MODULE_APP_PACKAGE_MAX_SCAN_ISSUES = 100;

export const moduleAppPackageUploadStatusSchema = z.enum([
  'issued',
  'processing',
  'submitted',
  'rejected',
  'failed',
  'cleaning',
  'expired',
]);
export type ModuleAppPackageUploadStatus = z.infer<typeof moduleAppPackageUploadStatusSchema>;

export const moduleAppPackageScanStatusSchema = z.enum(['pending', 'clean', 'blocked', 'error']);
export type ModuleAppPackageScanStatus = z.infer<typeof moduleAppPackageScanStatusSchema>;

export const moduleAppPackageUploadIdSchema = z.string().uuid();
export const moduleAppPackageUploadedSubmitSchema = z.object({
  fileName: moduleAppPackageFileNameSchema,
  storageKey: z.string().min(1).max(600),
  uploadId: moduleAppPackageUploadIdSchema,
});

export type ModuleAppPackageUploadTarget = {
  expiresAt: Date | string;
  headers: Record<string, string>;
  storageKey: string;
  uploadId: string;
  uploadUrl: string;
};
```

- [ ] **Step 4: Add Drizzle schema and migration**

Create `moduleAppPackageUploads` after `moduleAppPackages` with the approved columns, a unique storage key, a unique nullable package ID, `(userId,status,createdAt)` and `(status,expiresAt)` indexes, and typed text status fields. Add an additive SQL migration with the same FKs and indexes. Append journal entry `idx: 137`, tag `0135_add_module_app_package_uploads`, and a `when` value greater than the `0134` entry.

The storage-release field must be nullable and quota logic must later treat `NULL` as retained:

```typescript
storageReleasedAt: timestamptz('storage_released_at'),
scanReport: jsonb('scan_report')
  .$type<ModuleAppPackageValidationIssue[]>()
  .default([])
  .notNull(),
```

- [ ] **Step 5: Run tests and verify GREEN**

Run the two commands from Step 2. Expected: PASS.

- [ ] **Step 6: Commit the contract slice**

```powershell
git add packages/types/src/moduleApp.ts packages/types/src/moduleApp.test.ts packages/database/src/schemas/moduleApp.ts packages/database/src/schemas/moduleApp.schema.test.ts packages/database/migrations/0135_add_module_app_package_uploads.sql packages/database/migrations/meta/_journal.json
git commit -m "feat: add module app upload session schema" -m "Constraint: Migration is additive and uploaded code remains non-executable." -m "Tested: Module app type and database schema tests."
```

### Task 2: Transactional Upload Session Model And Quotas

**Files:**
- Create: `packages/database/src/models/moduleAppPackageUpload.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPackageUpload.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/database/src/models/moduleApp.package.test.ts`

**Interfaces:**
- Produces: `ModuleAppPackageUploadModel.createSession`, `claimSession`, `completeSubmission`, `markFailed`, `markRejected`, `getByPackageId`, `createLegacySession`, `listExpiredForCleanup`, and `markStorageReleased`.
- Consumes: `moduleAppPackageUploads`, quota constants, and `ModuleAppPackageSubmitInput`.

- [ ] **Step 1: Write failing integration tests for quota and state transitions**

Use `getTestDB()` and real schema rows. Cover:

```typescript
await expect(model.createSession(baseInput)).resolves.toMatchObject({ status: 'issued' });
await expect(model.createSession(baseInput)).rejects.toThrow('MODULE_APP_PACKAGE_OPEN_UPLOAD_LIMIT');
await expect(model.claimSession({ ...ownerInput, uploadId })).resolves.toMatchObject({ status: 'processing' });
await expect(model.claimSession({ ...ownerInput, uploadId })).rejects.toThrow('MODULE_APP_PACKAGE_UPLOAD_CONFLICT');
await expect(model.claimSession({ ...otherOwnerInput, uploadId })).rejects.toThrow('MODULE_APP_PACKAGE_UPLOAD_FORBIDDEN');
```

Add separate tests for rolling daily count, retained-byte reservation, larger actual size rejection, expired session rejection, storage release removing quota consumption, and concurrent `Promise.allSettled` creation never exceeding 3 open rows.

- [ ] **Step 2: Run the model test and verify RED**

```powershell
Push-Location packages/database
bunx vitest run --silent='passed-only' src/models/__tests__/moduleAppPackageUpload.test.ts
Pop-Location
```

Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement the upload-session model**

Use a transaction-scoped advisory lock before counts and insert:

```typescript
await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${params.userId}))`);
```

`createSession` must reserve declared bytes and throw only stable uppercase model codes. `claimSession` must conditionally update `issued -> processing` with ownership, key, file name, and non-expired predicates. When the conditional update returns no row, query by ID only to distinguish forbidden, expired, and conflict without returning foreign row data.

`completeSubmission` must parse the submission, insert `moduleAppPackages`, and conditionally update the session to `submitted/clean` with package ID, actual size, hash, and completion timestamp in the same transaction. Throw `MODULE_APP_PACKAGE_UPLOAD_CONFLICT` if the processing row was not updated.

- [ ] **Step 4: Add approval scan guard to the package model**

In `approvePackageSubmissionForAdmin`, query `moduleAppPackageUploads` by `packageId` inside the existing transaction and require:

```typescript
if (!upload || upload.status !== 'submitted' || upload.scanStatus !== 'clean') {
  throw new Error('MODULE_APP_PACKAGE_SCAN_NOT_CLEAN');
}
```

Update `moduleApp.package.test.ts` so the happy path supplies a clean session and add a failing unlinked/blocked case.

- [ ] **Step 5: Run tests and verify GREEN**

Run the new integration test and `src/models/moduleApp.package.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit the model slice**

```powershell
git add packages/database/src/models/moduleAppPackageUpload.ts packages/database/src/models/__tests__/moduleAppPackageUpload.test.ts packages/database/src/models/moduleApp.ts packages/database/src/models/moduleApp.package.test.ts
git commit -m "feat: enforce module app upload quotas" -m "Constraint: Quotas are serialized per user with a PostgreSQL advisory lock." -m "Tested: Upload session integration and package approval model tests."
```

### Task 3: ZIP Metadata Inspection And Static Scanner

**Files:**
- Create: `apps/server/src/services/moduleAppPackage/zipMetadata.ts`
- Create: `apps/server/src/services/moduleAppPackage/zipMetadata.test.ts`
- Create: `apps/server/src/services/moduleAppPackage/scanner.ts`
- Create: `apps/server/src/services/moduleAppPackage/scanner.test.ts`
- Modify: `apps/server/src/services/moduleAppPackage/archive.ts`
- Modify: `apps/server/src/services/moduleAppPackage/archive.test.ts`

**Interfaces:**
- Produces: `inspectModuleAppZipEntries(bytes)` returning entry names and Unix modes.
- Produces: `scanModuleAppPackage({ entries, files })` returning at most 100 validation issues.
- Changes: `ModuleAppPackageArchiveError` carries `issues: ModuleAppPackageValidationIssue[]`.

- [ ] **Step 1: Write failing ZIP metadata tests**

Build normal ZIP, Unix symlink, malformed central-directory, and ZIP64-sentinel fixtures in the test. Assert normal entries are returned and the other three cases throw `module_app_package_archive_metadata_invalid` or produce a symlink issue.

- [ ] **Step 2: Write failing scanner tests**

Use real byte arrays and assert blocking issues for EICAR, `MZ`, ELF, Mach-O, WebAssembly, forbidden extension, nested archive, and symlink. Assert an HTML/CSS/JS/JSON/image/font package returns `[]`. Assert more than 100 suspicious files yields exactly 100 issues.

- [ ] **Step 3: Run scanner tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/zipMetadata.test.ts apps/server/src/services/moduleAppPackage/scanner.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement central-directory inspection**

Parse EOCD and central file headers with bounds checks. Read `versionMadeBy`, file-name length, extra length, comment length, and external attributes. For Unix creator platform `3`, derive mode with `(externalAttributes >>> 16) & 0xffff`; flag symlink when `(mode & 0xf000) === 0xa000`. Reject ZIP64 sentinel values instead of partially parsing them.

- [ ] **Step 5: Implement scanner and archive integration**

The scanner must never log file bytes. Detect executable magic from the first 8 bytes, case-insensitive extensions from normalized paths, and the ASCII EICAR signature in decompressed bytes. Modify `archive.ts` to inspect metadata before decompression, scan after decompression, and throw:

```typescript
throw new ModuleAppPackageArchiveError(
  firstIssue.code,
  firstIssue.message,
  issues.slice(0, MODULE_APP_PACKAGE_MAX_SCAN_ISSUES),
);
```

- [ ] **Step 6: Run archive and scanner tests and verify GREEN**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/zipMetadata.test.ts apps/server/src/services/moduleAppPackage/scanner.test.ts apps/server/src/services/moduleAppPackage/archive.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the scanner slice**

```powershell
git add apps/server/src/services/moduleAppPackage
git commit -m "feat: scan module app package archives" -m "Constraint: Static scanning is a review gate and does not execute package contents." -m "Tested: ZIP metadata, scanner, and archive parser tests."
```

### Task 4: User Upload Ingestion And Client Contract

**Files:**
- Create: `apps/server/src/services/moduleAppPackage/ingestion.ts`
- Create: `apps/server/src/services/moduleAppPackage/ingestion.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `src/services/moduleApp.ts`
- Modify: `src/services/moduleApp.test.ts`
- Modify: `src/features/ModuleAppMarket/PackageUploader.tsx`
- Modify: `src/features/ModuleAppMarket/PackageUploader.test.tsx`
- Modify: `packages/locales/src/default/common.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Produces: `ModuleAppPackageIngestionService.issueUpload` and `submitUpload` with injectable storage and clock.
- Consumes: `ModuleAppPackageUploadModel`, `FileS3`, and `parseModuleAppPackageArchive`.
- Changes: upload target includes `uploadId` and `expiresAt`; submit input sends `uploadId`.

- [ ] **Step 1: Write failing ingestion service tests**

Cover session-before-signing order, signing failure release, ownership mismatch, declared/actual size increase rejection, archive error report persistence, generic read/parser failure compensation, database completion failure compensation, duplicate submit conflict, and successful clean submission.

Use a minimal injected storage contract:

```typescript
type ModuleAppPackageStorage = Pick<
  FileS3,
  'createPreSignedUpload' | 'deleteFile' | 'getFileByteArray' | 'getFileMetadata'
>;
```

- [ ] **Step 2: Run ingestion tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/ingestion.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement ingestion service**

`issueUpload` creates a session first, signs only its generated storage key, and marks issuance failed with `storageReleasedAt` when signing fails. `submitUpload` atomically claims the session, verifies metadata and actual size, reads bytes, parses/scans, then completes package/session persistence transactionally.

Every path after a possible object write must call one shared best-effort release helper. If release fails, leave `storageReleasedAt` null and preserve a retryable terminal row.

- [ ] **Step 4: Make the tRPC router thin**

Replace direct S3/parser orchestration in `createPackageUpload` and `submitUploadedPackage` with `ModuleAppPackageIngestionService`. Map model codes to `TOO_MANY_REQUESTS`, `FORBIDDEN`, `CONFLICT`, or `BAD_REQUEST`; never expose storage-provider exception text.

- [ ] **Step 5: Update client and uploader tests**

Change `uploadPackage` to submit:

```typescript
return submitUploadedPackage({
  fileName: file.name,
  storageKey: target.storageKey,
  uploadId: target.uploadId,
});
```

Keep current loading/error UI and add distinct user-facing copy for quota, expired upload, and security rejection codes in English and Simplified Chinese locale sources.

- [ ] **Step 6: Run user-chain tests and verify GREEN**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/ingestion.test.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.test.ts src/features/ModuleAppMarket/PackageUploader.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the ingestion slice**

```powershell
git add apps/server/src/services/moduleAppPackage/ingestion.ts apps/server/src/services/moduleAppPackage/ingestion.test.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.ts src/services/moduleApp.test.ts src/features/ModuleAppMarket/PackageUploader.tsx src/features/ModuleAppMarket/PackageUploader.test.tsx locales/en-US/common.json locales/zh-CN/common.json packages/locales/src/default/common.ts
git commit -m "feat: harden module app package ingestion" -m "Constraint: Storage errors are compensated and never expose provider details." -m "Tested: Ingestion, router, client service, and uploader tests."
```

### Task 5: Admin Scan Gate, Legacy Rescan, And Rejection Cleanup

**Files:**
- Create: `apps/server/src/services/moduleAppPackage/lifecycle.ts`
- Create: `apps/server/src/services/moduleAppPackage/lifecycle.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/database/src/models/moduleApp.package.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/features/Admin/moduleApps/types.ts`
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Modify: `src/features/Admin/moduleApps/packageReview.test.tsx`

**Interfaces:**
- Produces: `ModuleAppPackageLifecycleService.rescanLegacyPackage` and `releaseRejectedPackage`.
- Changes: admin list/get package includes bounded `scanStatus`; adds `rescanPackage({ packageId })`.

- [ ] **Step 1: Write failing lifecycle tests**

Cover clean legacy rescan, blocked legacy rescan, missing submitter, missing object, already-linked idempotency, rejection release success, rejection release failure remaining retryable, and no storage-key/hash leakage in returned scan summary.

- [ ] **Step 2: Run lifecycle test and verify RED**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/lifecycle.test.ts
```

Expected: FAIL because the lifecycle service does not exist.

- [ ] **Step 3: Implement lifecycle service**

Rescan reads only the package's server-side archive metadata, validates its user-scoped key, performs `HeadObject`, reads and parses the object, then creates a terminal linked session. Blocked content rejects the package and releases the object. Clean content creates `submitted/clean`; it does not approve the package.

Rejection first commits package/session state so the package cannot be approved, then releases storage. Cleanup failure is returned as `cleanupQueued: true` and remains retryable.

- [ ] **Step 4: Add admin router procedures and error mapping**

Add `rescanPackage` under `contentWriteProcedure`, audit `module_app.package_rescanned`, and route rejection through lifecycle cleanup. Map `MODULE_APP_PACKAGE_SCAN_NOT_CLEAN` to `PRECONDITION_FAILED` and stable rescan remediation errors to `BAD_REQUEST`.

- [ ] **Step 5: Add admin review UI state**

Update `ModuleAppModel.listAdminPackageSubmissions` and `getAdminPackageSubmission` to left join the linked upload scan state without exposing storage internals. Add `scanStatus` to `AdminModuleAppPackageRow`. Show a scan-status tag. Disable Approve unless `scanStatus === 'clean'`. For pending rows without clean status, show a `Scan` button calling `adminCommercialService.moduleApps.rescanPackage`, refresh package data, and render mutation errors through the existing message flow.

- [ ] **Step 6: Run admin tests and verify GREEN**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/lifecycle.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps/packageReview.test.tsx src/services/adminCommercial.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the admin slice**

```powershell
git add apps/server/src/services/moduleAppPackage/lifecycle.ts apps/server/src/services/moduleAppPackage/lifecycle.test.ts packages/database/src/models/moduleApp.ts packages/database/src/models/moduleApp.package.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/moduleApps/types.ts src/features/Admin/moduleApps/index.tsx src/features/Admin/moduleApps/packageReview.test.tsx
git commit -m "feat: gate module app review on clean scans" -m "Constraint: Legacy packages require explicit administrator rescan." -m "Tested: Lifecycle, admin router, admin service, and review UI tests."
```

### Task 6: Scheduled And Manual Maintenance Cleanup

**Files:**
- Modify: `apps/server/src/services/moduleAppPackage/lifecycle.ts`
- Modify: `apps/server/src/services/moduleAppPackage/lifecycle.test.ts`
- Modify: `src/app/(backend)/api/admin/maintenance/route.ts`
- Create: `src/app/(backend)/api/admin/maintenance/route.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/features/Admin/AdminSystemMaintenancePage.tsx`
- Modify: `src/features/Admin/AdminSystemMaintenancePage.test.tsx`

**Interfaces:**
- Consumes: `ModuleAppPackageLifecycleService.cleanupExpiredUploads({ limit: 100 })`.
- Changes: both cron and manual maintenance accept `skipModuleAppUploads` and return deleted/failed counts.

- [ ] **Step 1: Write failing cleanup and route tests**

Test a 100-row cap, expired-only selection, already-missing object success, storage deletion retry, row-lock-safe claiming, and result counts. Route tests must prove missing/wrong bearer token remains 401, valid token runs cleanup, and `skipModuleAppUploads: true` does not call cleanup.

- [ ] **Step 2: Run maintenance tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppPackage/lifecycle.test.ts "src/app/(backend)/api/admin/maintenance/route.test.ts" packages/business-server/src/lambda-routers/admin/settings.test.ts src/features/Admin/AdminSystemMaintenancePage.test.tsx
```

Expected: failures for missing cleanup integration and result fields.

- [ ] **Step 3: Implement idempotent cleanup batching**

Select eligible rows in a short transaction with `FOR UPDATE SKIP LOCKED`, mark them `cleaning`, then release objects outside the transaction. Mark successful/missing objects `expired` with `storageReleasedAt`; leave failed rows in `cleaning` with `storageReleasedAt` null so a later run can retry them.

- [ ] **Step 4: Integrate both maintenance entry points**

Add identical `skipModuleAppUploads` semantics to the bearer-authenticated route and `admin.settings.runMaintenance`. Return:

```typescript
moduleAppUploadCleanupFailed: number;
moduleAppUploadsExpired: number;
```

Update the manual maintenance result modal to display both values. Do not alter existing auth, audit, order, notification, or subscription behavior.

- [ ] **Step 5: Run maintenance tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit the maintenance slice**

```powershell
git add apps/server/src/services/moduleAppPackage/lifecycle.ts apps/server/src/services/moduleAppPackage/lifecycle.test.ts "src/app/(backend)/api/admin/maintenance/route.ts" "src/app/(backend)/api/admin/maintenance/route.test.ts" packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/services/adminCommercial.ts src/features/Admin/AdminSystemMaintenancePage.tsx src/features/Admin/AdminSystemMaintenancePage.test.tsx
git commit -m "feat: clean expired module app uploads" -m "Constraint: Cleanup is bounded, idempotent, and reuses existing maintenance authentication." -m "Tested: Lifecycle, cron route, admin maintenance router, and maintenance UI tests."
```

### Task 7: Governance Documentation, Review, And Full Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Add forcibly if ignored: `docs/superpowers/plans/2026-07-11-module-app-package-risk-p0.md`

**Interfaces:**
- Produces: durable feature status, risk boundary, verification evidence, and deferred P1/P2 notes.

- [ ] **Step 1: Update governance documentation**

Record that upload sessions, quotas, static scans, legacy rescans, and cleanup are active. Keep status `experimental` until production migration and object cleanup are observed. State explicitly that external antivirus, package signing, executable packages, immutable upgrades, and installed-list pagination remain deferred.

- [ ] **Step 2: Run the complete focused test set**

```powershell
bunx vitest run --silent='passed-only' packages/types/src/moduleApp.test.ts apps/server/src/services/moduleAppPackage/zipMetadata.test.ts apps/server/src/services/moduleAppPackage/scanner.test.ts apps/server/src/services/moduleAppPackage/archive.test.ts apps/server/src/services/moduleAppPackage/ingestion.test.ts apps/server/src/services/moduleAppPackage/lifecycle.test.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.test.ts src/features/ModuleAppMarket/PackageUploader.test.tsx packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps/packageReview.test.tsx src/services/adminCommercial.test.ts "src/app/(backend)/api/admin/maintenance/route.test.ts" packages/business-server/src/lambda-routers/admin/settings.test.ts src/features/Admin/AdminSystemMaintenancePage.test.tsx
Push-Location packages/database
bunx vitest run --silent='passed-only' src/schemas/moduleApp.schema.test.ts src/models/__tests__/moduleAppPackageUpload.test.ts src/models/moduleApp.package.test.ts
Pop-Location
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 3: Run static verification**

```powershell
bun run type-check
bunx eslint apps/server/src/services/moduleAppPackage apps/server/src/routers/lambda/moduleApp.ts packages/types/src/moduleApp.ts packages/database/src/schemas/moduleApp.ts packages/database/src/models/moduleAppPackageUpload.ts packages/database/src/models/moduleApp.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/settings.ts src/services/moduleApp.ts src/services/adminCommercial.ts src/features/ModuleAppMarket/PackageUploader.tsx src/features/Admin/moduleApps src/features/Admin/AdminSystemMaintenancePage.tsx "src/app/(backend)/api/admin/maintenance/route.ts"
git diff --check
```

Expected: type-check and ESLint exit 0; diff check has no errors.

- [ ] **Step 4: Perform a focused code review**

Review the complete P0 diff for ownership bypass, quota races, storage leaks, scan bypass, unbounded reports, sensitive response fields, legacy migration lockout, maintenance auth regression, and accidental package execution. Fix findings with a regression test before changing production code.

- [ ] **Step 5: Commit documentation and review fixes**

```powershell
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git add -f docs/superpowers/plans/2026-07-11-module-app-package-risk-p0.md
git commit -m "docs: record module app package risk controls" -m "Constraint: P1 immutable upgrades and P2 pagination remain deferred." -m "Tested: Focused module app suites, type-check, ESLint, and git diff check."
```

## Self-Review

- Every approved P0 requirement maps to one task.
- The only schema migration is additive `0135`; rollback does not require dropping it.
- Database quota serialization is explicit and cross-instance safe.
- Storage release remains retryable and still consumes quota until confirmed.
- Legacy packages have an explicit rescan route and cannot be silently grandfathered.
- Scanner output is bounded and packages remain non-executable after a clean result.
- Cron and manual maintenance paths are both covered.
- P1 immutable upgrades and P2 pagination are deliberately outside this plan.
