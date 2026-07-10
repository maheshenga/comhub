# Module App Package Risk P0 Design

## Goal

Close the highest-risk gaps in Module App package ingestion before package execution is considered:

- persist every pre-signed upload grant;
- enforce per-user upload and retained-storage quotas across application instances;
- clean abandoned or rejected S3/OSS objects;
- statically scan package contents before a review submission can exist;
- preserve the current rule that uploaded package code is never executed.

Package version upgrades and list pagination remain separate P1 and P2 slices so this change stays reversible.

## Current Problems

The current flow creates a one-hour pre-signed PUT URL before any database row exists. A user can therefore create upload URLs that cannot be counted, revoked, associated with a later submission, or cleaned deterministically. The submit path deletes objects for known validation failures, but storage metadata failures, unexpected parser failures, abandoned uploads, and admin rejection can leave objects behind.

Archive parsing already protects against path traversal, duplicate paths, excessive file counts, oversized files, excessive expanded size, and high compression ratios. It does not maintain a durable scan state and does not reject executable payload signatures, EICAR content, nested archives, or ZIP entries marked as symbolic links.

## Scope

### Included

- One new `module_app_package_uploads` table and migration.
- Durable upload-session state transitions.
- Fixed platform safety limits defined in `@lobechat/types`.
- Per-user open-session, rolling issuance, and retained-byte quotas.
- Static package scanning integrated with archive parsing.
- Idempotent expired-session and rejected-package object cleanup.
- Integration with the existing authenticated admin maintenance endpoint.
- Admin approval guard requiring a clean linked upload session.
- An explicit admin rescan action for pre-migration package submissions.
- Focused database, router, parser, maintenance, and schema tests.
- Feature registry and internal changelog updates.

### Excluded

- Executing uploaded JavaScript, binaries, containers, remote modules, or iframe applications.
- ClamAV, third-party malware APIs, queues, or new infrastructure services.
- Package signing and developer identity verification.
- Immutable version upgrades and user-controlled upgrade/rollback UI; this is P1.
- Pagination changes for installed applications; this is P2.
- New environment variables or Docker volumes.

## Architecture

The upload session is the authority for package ingestion. A pre-signed upload URL is issued only after a session row is inserted and quota checks pass. Submission claims that row atomically, verifies the S3/OSS object, parses and scans it, creates the package review record, then links the session to the package.

The session lifecycle and storage object are coordinated with compensating operations rather than a distributed transaction. Database state transitions are transactional. Object deletion is idempotent and retryable through the existing maintenance endpoint.

## Data Model

Add `moduleAppPackageUploads` to `packages/database/src/schemas/moduleApp.ts` and migration `packages/database/migrations/0135_add_module_app_package_uploads.sql`.

Fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Upload-session identity returned to the client. |
| `userId` | nullable user FK | Ownership and quota scope. New sessions always set it; deletion of a user preserves cleanup state. |
| `packageId` | package FK, nullable | Set only after a review submission is created. |
| `storageKey` | text, unique, not null | User-scoped S3/OSS object key. |
| `fileName` | text, not null | Validated ZIP file name. |
| `mimeType` | text, not null | Requested MIME type. |
| `declaredSizeBytes` | integer, not null | Client file size used for pre-upload quota reservation. |
| `actualSizeBytes` | integer, nullable | S3/OSS `HeadObject` size. |
| `sha256` | text, nullable | Server-derived archive digest. |
| `status` | text, not null | `issued`, `processing`, `submitted`, `rejected`, `failed`, or `expired`. |
| `scanStatus` | text, not null | `pending`, `clean`, `blocked`, or `error`. |
| `scanReport` | JSONB, not null | Bounded validation issues without file contents. |
| `failureCode` | text, nullable | Stable machine-readable failure reason. |
| `storageReleasedAt` | timestamptz, nullable | Set only when no package object remains or no object was ever created. |
| `expiresAt` | timestamptz, not null | Cleanup eligibility for incomplete sessions. |
| `completedAt` | timestamptz, nullable | Terminal transition timestamp. |
| `createdAt` / `updatedAt` | timestamptz | Audit timestamps. |

Indexes:

- unique `storageKey`;
- `(userId, status, createdAt)` for quotas and user lookup;
- `(status, expiresAt)` for maintenance batches;
- unique nullable `packageId` so one package cannot link to multiple upload sessions.

The migration is additive and does not synthesize a clean result for existing packages. Existing `module_app_packages` rows remain visible. A storage-backed row without a linked upload session cannot be approved until an administrator explicitly runs the rescan action. The action reads the existing object, applies the same parser and scanner, and creates a linked terminal session. A clean result makes the package approvable; a blocked result rejects the package and deletes its object. Missing submitter ownership or a missing object leaves the package unapprovable with a stable remediation error.

## Fixed Safety Limits

Define the following constants in `packages/types/src/moduleApp.ts`:

- maximum archive size: existing 50 MiB;
- maximum open sessions per user: 3;
- maximum issued sessions per rolling 24 hours: 20;
- maximum retained package bytes per user: 500 MiB;
- session lifetime: 2 hours;
- maintenance batch size: 100.
- maximum persisted scan issues per session: 100.

Quota reservation uses `declaredSizeBytes` until an actual size is known, then uses `actualSizeBytes`. Any row with `storageReleasedAt IS NULL` consumes retained-byte quota, including cleanup failures. Limits are platform safety boundaries rather than commercial plan entitlements, so they are code constants and are not added to the general settings UI.

## State Transitions

Allowed transitions:

```text
issued -> processing -> submitted
issued -> expired
issued -> failed
processing -> rejected
processing -> failed
processing -> expired
submitted -> rejected
rejected -> expired
failed -> expired
```

Rules:

- `createPackageUpload` inserts `issued` before generating the pre-signed URL.
- A pre-signing failure records `failed`; no URL is returned.
- `submitUploadedPackage` requires `uploadId`, `storageKey`, matching ownership, matching file metadata, non-expired state, and `issued` status.
- Claiming uses a conditional update from `issued` to `processing`; concurrent or repeated submit calls fail without reprocessing.
- A clean scan and successful package insert set `submitted`, `scanStatus=clean`, `packageId`, actual size, hash, and completion time in one database transaction.
- Policy violations set `rejected`, `scanStatus=blocked`, persist at most 100 bounded issue codes, delete the object, and set `storageReleasedAt` only after deletion succeeds.
- Unexpected scanner/parser failures set `failed`, `scanStatus=error`, attempt object deletion, and preserve a stable failure code without exposing internal stack traces. A failed deletion leaves `storageReleasedAt` null for quota and maintenance retry.
- Repeating cleanup or a terminal client request is idempotent.

## Quota Enforcement

`ModuleAppModel.createPackageUploadSession` performs the quota checks and insert in a database transaction. It acquires a transaction-scoped PostgreSQL advisory lock derived from `userId` before counting and inserting, preventing concurrent requests on different application instances from exceeding a quota. It counts open sessions, sessions issued in the previous 24 hours, and retained bytes. The retained-byte query reserves the declared size of the new session before insertion.

The router never signs a URL unless the insert succeeds. Quota failures use distinct stable codes:

- `module_app_package_open_upload_limit`;
- `module_app_package_daily_upload_limit`;
- `module_app_package_storage_quota_exceeded`.

The server still verifies `HeadObject.contentLength` before reading bytes. A mismatch between declared and actual size is allowed only when the actual size is smaller and remains within all limits; a larger actual size is rejected and deleted.

## Static Security Scan

Create `apps/server/src/services/moduleAppPackage/scanner.ts`. The scanner consumes the decompressed file map and ZIP entry metadata and returns bounded `ModuleAppPackageValidationIssue` items.

Blocking checks:

- EICAR test signature in any decompressed file;
- PE (`MZ`), ELF, Mach-O, or WebAssembly executable magic;
- native/package executable extensions such as `.exe`, `.dll`, `.so`, `.dylib`, `.node`, `.msi`, `.apk`, `.dmg`, `.pkg`, `.deb`, and `.rpm`;
- command/script payload extensions `.bat`, `.cmd`, `.com`, `.ps1`, and `.sh`;
- nested archive extensions `.zip`, `.7z`, `.rar`, `.tar`, `.gz`, `.bz2`, and `.xz`;
- ZIP central-directory entries whose Unix mode marks a symbolic link;
- malformed central-directory metadata.

HTML, CSS, JSON, images, fonts, Markdown, text, and JavaScript assets remain allowed because future `frontend_static` packages need them. Passing the scanner does not make code trusted or executable; it only makes the package eligible for human review.

Reports contain only issue code, severity, path, and a bounded message. File bytes, secrets, storage credentials, stack traces, and full manifests are never logged in the report.

## Storage Cleanup

Create `apps/server/src/services/moduleAppPackage/lifecycle.ts` with an injected storage interface for tests.

Responsibilities:

- delete a single session object idempotently;
- reject a package and clean its linked object;
- select at most 100 expired incomplete sessions using row locking with skip-locked semantics;
- delete objects, then mark successfully handled rows `expired`;
- set `storageReleasedAt` only after deletion or confirmed object absence;
- leave rows retryable when storage deletion fails;
- treat an already-missing object as a successful cleanup.

Extend `POST /api/admin/maintenance` with:

- request field `skipModuleAppUploads?: boolean`;
- result fields `moduleAppUploadsExpired` and `moduleAppUploadCleanupFailed`.

The endpoint continues to use the existing `cron.secret` / `CRON_SECRET` authentication. No new scheduled endpoint or secret is introduced.

Admin rejection invokes the same lifecycle service. Approval first verifies that the linked session is `submitted` and `scanStatus=clean`; otherwise it returns `MODULE_APP_PACKAGE_SCAN_NOT_CLEAN`.

The admin package-review router adds `rescanPackage`. The existing package review page shows this command only when a package has no clean linked session. Rescan is explicit rather than automatic during approval so administrators receive a deterministic result and approval does not perform an unexpected long-running storage read.

## API Changes

`moduleAppPackageUploadRequestSchema` already includes `sizeBytes`; the server begins enforcing it.

The upload target adds `uploadId` and `expiresAt`. `moduleAppPackageUploadedSubmitSchema` adds `uploadId` and `sizeBytes` is not trusted again at submission time. The client stores the target for the duration of the PUT and submits the matching identifiers.

The admin API adds `rescanPackage({ packageId })`. Its response contains only scan status and bounded issue codes; it does not return object keys or file hashes to the browser.

No storage key, hash, scan report, or upload-session identifier is added to public package-submission list responses.

## Error Handling

- Ownership, key-prefix, upload ID, and storage-key mismatches return `FORBIDDEN` without revealing whether another user's session exists.
- Missing or expired sessions return stable `BAD_REQUEST` codes.
- Duplicate submit attempts return `CONFLICT`.
- S3/OSS read errors do not expose provider messages to clients.
- Object deletion failures are recorded for retry and do not turn a blocked package into a reviewable submission.
- Database insertion failure triggers object deletion; if deletion fails, the session remains `failed` for maintenance retry.

## Tests

Use TDD for every behavior.

Required focused coverage:

- schema defaults, indexes, and migration-chain inclusion;
- quota boundaries and transactional session creation;
- upload ownership and atomic claim behavior;
- declared-versus-actual size checks;
- EICAR, executable magic, nested archives, symbolic links, and clean frontend assets;
- all parser and scanner failure cleanup paths;
- package insert failure compensation;
- approval rejection when scan is not clean;
- legacy package rescan success, blocked content, missing object, and missing submitter behavior;
- admin rejection object cleanup;
- maintenance authentication remains unchanged;
- cleanup batching, retry, missing-object idempotency, and skip option;
- client upload sends `uploadId` and handles quota/security errors;
- public response remains free of storage and scan internals.

Verification gates:

- focused Vitest suites for types, database, server router/services, business admin router, client service, and maintenance route;
- `bun run type-check`;
- targeted ESLint for changed TypeScript/TSX files;
- locale JSON parsing when messages are added;
- `git diff --check`.

## Rollback

The application code can be rolled back without dropping the additive table. Existing package rows are unchanged. The new migration must not be reversed during an application rollback because doing so could remove upload audit state while newer application instances are still running.

Storage cleanup only touches keys belonging to expired/rejected rows under the existing user-scoped `module-app-packages/` prefix. It never lists or deletes unrelated S3/OSS prefixes.

## Follow-up Slices

P1 creates immutable package-version snapshots, pins runtime to installation version, adds explicit upgrade and rollback operations, and prevents silent upgrades.

P2 adds cursor pagination to installed-app and team-app lists and updates the UI to load pages without replacing existing content.
