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

- None within the Task 1 scope. The review fix moved per-setting write normalization behind catalog-owned adapters and retained the existing focused router coverage.

## Review Fix - Important Findings

### Changes

- Replaced generic source strings with ordered source metadata. All S3 keys now name their exact `S3_*` or `NEXT_PUBLIC_S3_*` fallbacks; Composio, cron-secret, and memory-trigger overrides name their exact database/environment/default order.
- Added catalog-owned value definitions with concrete Zod output schemas and normalization adapters for every registered key.
- Changed generic single and batch writes to invoke `normalizeAppSettingValue`, removing the router-owned key-specific normalization chain.
- Replaced synthetic consumer labels with concrete reader identifiers and added explicit family/runtime readers for S3, Composio, public settings, model defaults, memory, vector, and model policy.
- Kept all five desktop OSS keys fail-closed in generic batch writes.
- Updated `AdminDesktopUpdatePage` so desktop OSS values remain visible but all five controls are disabled, clearly marked as CI/GitHub Secrets owned, and excluded from save payloads.
- Added focused catalog, router, and desktop-page coverage without changing tRPC names, response shapes, payment behavior, navigation, Module App behavior, Worker deployment, or secret storage.

### TDD Evidence

1. Catalog red gate:
   `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts`
   - 4 tests ran; 3 failed for generic effective sources, permissive schemas/missing adapters, and synthetic consumer labels.
2. Router red gate:
   `bunx vitest run --silent='passed-only' src/lambda-routers/admin/settings.test.ts`
   - 46 tests ran; 1 failed because `cron.secret` bypassed catalog normalization and retained surrounding whitespace.
   - The five new desktop OSS rejection cases already passed, confirming the secure backend boundary before UI changes.
3. Desktop red gate:
   `bunx vitest run --silent='passed-only' src/features/Admin/AdminDesktopUpdatePage.test.tsx`
   - 1 test failed because the OSS bucket control was editable.

### Final Verification Evidence

- `packages/business-server`: `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts src/lambda-routers/admin/settings.test.ts`
  - 2 files passed, 50 tests passed.
- Repository root: `bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts src/features/Admin/adminSettingsForm.test.ts`
  - 2 files passed, 39 tests passed.
- Repository root: `bunx vitest run --silent='passed-only' --pool=forks --maxWorkers=1 src/features/Admin/AdminDesktopUpdatePage.test.tsx`
  - 1 file passed, 1 test passed.
  - A single fork is used for this component test to avoid the default worker teardown race observed during development; the final run exited cleanly with no unhandled errors.
- Repository root: targeted `bunx eslint` over all changed TypeScript/TSX files.
  - Passed with no errors or warnings.
- Repository root: `bun run type-check`
  - Passed (`tsgo --noEmit`).
- Repository root: `git diff --check`
  - Passed.

## Re-review Fix - Dedicated PPT Writes and Runtime Consumers

### Changes

- Added explicit catalog write surfaces for generic admin writes and `adminPptRouter.saveSettings`. PPT settings are now active writable settings with `systemWrite`, per-key audit policy, existing sensitivity metadata, and a dedicated-only write surface; the generic settings mutations still reject them.
- Added exact PPT schemas for booleans, API key, base URL, creator version, nullable daily limit, language, nullable theme color, and token TTL (`1..1440`). API-key clearing remains an explicit nullable stored-value operation without widening the existing `apiKey` procedure input.
- Changed `adminPptRouter.saveSettings` to derive its input schemas and setting-key list from the catalog and normalize every persisted setting through the dedicated catalog contract.
- Removed `adminSettingsRouter.getAll` and the nonexistent `adminPptRouter.readSettings` from runtime-consumer metadata. Every active family now names a real reader or effect, including the maintenance route for all cron keys, `adminSettingsRouter.runMaintenance` for retention settings, `DocmeePptService.readSettings`, `subscriptionRouter.listPlanFaq`, `resolveGenerationPricingMultiplier`, and the exact current admin UI effects for the two presentation-only settings.
- Restored pre-Task-1 `cron.secret` string semantics so boundary whitespace is persisted unchanged.
- Audited the moved generic normalizers against `821955c499^:packages/business-server/src/lambda-routers/admin/settings.ts` (`normalizeAppSettingUpdate`). The parity table covers every generic normalizer category and each distinct branch behavior; `cron.secret` trimming was the only drift found and was removed.

### TDD Evidence

1. Catalog RED gate:
   `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts`
   - 6 tests ran; 3 failed because PPT settings were read-only, placeholder consumers remained, and the generic write-surface/parity contract did not exist.
2. Generic-router RED gate:
   `bunx vitest run --silent='passed-only' src/lambda-routers/admin/settings.test.ts`
   - 46 tests ran; 1 failed because `cron.secret` was persisted as `test-secret` instead of preserving `  test-secret  `.
3. PPT-router RED gate:
   `bunx vitest run --silent='passed-only' src/lambda-routers/admin/ppt.test.ts`
   - 3 tests ran; 2 failed because `adminPptRouter.saveSettings` never called the catalog normalization contract, including for API-key clearing.
4. Focused GREEN gate:
   `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/ppt.test.ts`
   - 3 files passed, 55 tests passed.

### Final Verification Evidence

- `packages/business-server`: `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/ppt.test.ts`
  - 3 files passed, 55 tests passed.
- Repository root: `bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts src/features/Admin/adminSettingsForm.test.ts`
  - 2 files passed, 39 tests passed.
- Repository root: `bunx vitest run --silent='passed-only' --pool=forks --maxWorkers=1 src/features/Admin/AdminDesktopUpdatePage.test.tsx`
  - 1 file passed, 1 test passed.
- Repository root: `bunx vitest run --silent='passed-only' src/server/services/docmee/config.test.ts src/server/services/docmee/index.test.ts apps/server/src/routers/lambda/docmee.test.ts`
  - 3 files passed, 11 tests passed.
- Repository root: `node node_modules/vitest/vitest.mjs run --silent=passed-only src/routes/(main)/(create)/ppt/features/PptWorkspace.test.tsx`
  - 1 file passed, 4 tests passed. Direct Node invocation avoids the Windows `bunx.cmd` parenthesis-quoting issue for this path.
- Repository root: targeted `bunx eslint` over all changed TypeScript files.
  - Passed with no errors or warnings.
- Repository root: `bun run type-check`
  - Passed (`tsgo --noEmit`).
- Repository root: `git diff --check`
  - Passed.

### Re-review Self-review

- PPT procedure names, response shapes, prior input constraints, nullable daily-limit behavior, and API-key clear semantics remain unchanged.
- Generic writes remain fail-closed for PPT and external desktop OSS keys because each mutation validates against its exact catalog write surface.
- No payment, deployment, navigation, Module App, Worker, or secret-ownership boundary changed.

## Third Review Fix and Task 2 Scope Extension

### Changes

- Replaced the hand-maintained runtime-consumer allowlist with typed source contracts containing a source path, consumer symbol, key evidence strategy, and exact covered keys. Catalog runtime consumers are now derived from those contracts.
- Strengthened catalog tests with TypeScript AST inspection. Each contract must resolve its named symbol and prove the setting-key evidence inside that symbol; local key registries are modeled as an explicit consumer-to-evidence-symbol reference.
- Corrected `memory.userMemory.triggerMode` metadata to use its real `resolveUserMemoryTriggerMode` reader instead of the extraction-model reader discovered by the stronger contract test.
- Declared both current `cron.secret` consumers: the maintenance endpoint and desktop-release endpoint. Generic writes preserve whitespace-bearing strings and non-string JSON values so both readers retain their pre-task fallback behavior.
- Replaced broad representative normalizer assertions with a compact exact key-to-normalizer fixture covering every catalog key plus focused behavior cases for trimming, bounds, and exact `cron.secret` passthrough.
- Completed the approved Task 2 scope: referral rewards now consume `referral.rewardCredits`; `orders.management.enabled` is deprecated and non-writable; the compatibility response is always `false`; the billing UI is read-only for online payment and only submits pricing multiplier changes.

### TDD Evidence

1. Initial takeover focused gates were green before the final source relationship tightening:
   - Database referral suite: 1 file, 9 tests passed.
   - Business-server catalog/settings/PPT suites: 3 files, 58 tests passed.
   - Frontend commercial-flow/billing-helper suites: 2 files, 59 tests passed.
2. Symbol-scoped source contract RED 1:
   `bunx vitest run --silent='passed-only' src/appSettings/catalog.test.ts`
   - 1 of 6 tests failed because `DocmeePptService.readSettings` referenced `DOCMEE_SETTING_KEYS` instead of containing the prefix directly.
3. Symbol-scoped source contract RED 2 after modeling that indirection:
   - 1 of 6 tests failed because `memory.userMemory.triggerMode` was incorrectly assigned to `getServerMemoryExtractionSettingOverrides`.
4. GREEN after explicit evidence symbols and the correct memory-trigger consumer:
   - Catalog suite: 1 file, 6 tests passed.

### Final Verification Evidence

- `packages/database`: serialized commercial/referral/top-up suites
  - 3 files passed, 43 tests passed. This includes configured referral rewards, fallback/snapshot priority, one setting read per public operation, and the unchanged online-payment error code.
- `packages/business-server`: catalog/settings/PPT suites
  - 3 files passed, 58 tests passed.
- Repository root: governance, admin form, desktop update, commercial flow, billing helper, and Docmee suites
  - 8 files passed, 110 tests passed.
- Repository root: PPT workspace suite via direct Node Vitest invocation
  - 1 file passed, 4 tests passed.
- Final post-lint focused recheck
  - Catalog: 1 file, 6 tests passed.
  - Billing helper: 1 file, 20 tests passed.
- Locale contract: default, en-US, and zh-CN keys parsed and were present.
- `bun run type-check`: passed (`tsgo --noEmit`).
- Targeted ESLint over every changed TypeScript/TSX file: passed.
- `git diff --check`: passed.

### Third Review Self-review

- Runtime-consumer contracts reject admin editor pages and generic admin reads as operational consumers and prove source/symbol/key relationships.
- `cron.secret` remains byte-preserving for strings and passthrough for JSON values; non-string runtime values continue to fall back to `CRON_SECRET`.
- Online platform payment remains fail closed. No Alipay behavior, deployment behavior, Module App payment/refund/payout behavior, Worker behavior, navigation, or desktop secret ownership changed.
