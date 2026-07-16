# Admin Governance Task 1 Report

## Scope

Implemented the schema-driven application-settings catalog required by Task 1.
Only these source areas changed:

- `packages/business-server/src/appSettings/types.ts`
- `packages/business-server/src/appSettings/catalog.ts`
- `packages/business-server/src/appSettings/catalog.test.ts`
- `packages/business-server/src/lambda-routers/admin/settings.ts`
- `src/server/services/appSettings/governance.ts`

## Implementation

- Added a typed catalog covering every registered `APP_SETTING_KEYS` entry.
- Catalog metadata includes page owner, Zod schema, default/effective source, sensitivity, public exposure, cache/runtime effects, runtime consumers, required capability, audit policy, lifecycle, and external ownership.
- Derived writable, sensitive, section, and normalization key lookups from the catalog.
- Migrated the admin settings router to use the catalog for writable-key validation, normalization groups, sensitivity, and cache invalidation effects.
- Migrated governance rows and unknown-key checks to use the catalog.
- Assigned `notification.retentionDays` exclusively to the `notifications` section.
- Marked desktop OSS configuration as externally owned by CI/GitHub Secrets, lifecycle `external`, and non-writable.
- Preserved existing tRPC procedure names and response shapes. No payment, desktop secret-storage, navigation, Module App, or Worker deployment behavior was changed.

## TDD Evidence

1. Added `catalog.test.ts` before creating production catalog files.
2. Red run:
   `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts`
   failed because `./catalog` did not exist.
3. Implemented the catalog and reran the focused test successfully.

## Verification

- `packages/business-server`: `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts src/lambda-routers/admin/settings.test.ts`
  - 2 files passed, 41 tests passed.
- Repository root: `bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts src/features/Admin/adminSettingsForm.test.ts`
  - 2 files passed, 39 tests passed.
- Repository root: `bun run type-check`
  - Passed (`tsgo --noEmit`).
- Repository root: `git diff --check`
  - Passed.

## Self-review

- The catalog remains additive over the existing registry, so public contracts continue to use the established key constants.
- Unknown keys remain fail-closed through catalog lookup and the writable-key Zod enum.
- Every active writable catalog item has a declared runtime consumer; external items are not writable.
- Desktop OSS values are no longer accepted by generic admin setting mutations. Existing read response contracts are unchanged.
- No credentials were added to the repository.

## Residual Concerns

- Task 1 centralizes metadata while retaining the existing per-setting normalization implementation in the router to avoid changing persistence behavior. A later task can move those normalizers behind catalog adapters once their behavior is separately covered.
