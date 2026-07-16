# Admin Governance Task 2 Report

## Scope

Completed Task 2 inside the approved Task 1 third-review fix wave:

- Wired `referral.rewardCredits` into `CommercialModel` overview and activation.
- Deprecated and fail-closed `orders.management.enabled` across catalog, router compatibility output, and admin UI writes.
- Preserved pricing multiplier editing and all existing public procedure/response contracts.

## Implementation

- Added a bounded `CommercialModel.resolveReferralRewardCredits` reader for the existing `app_settings` row.
- `getReferralOverview()` loads the configured reward once and returns it when it is a positive finite JSON number.
- `activateReferralReward()` loads the configured reward once per public operation. A positive relation-level snapshot remains first choice; otherwise the configured value is reused for relation update and both reward grants.
- Missing, null, string, object, zero, or negative setting values fall back to `100 * CREDITS_PER_DOLLAR`.
- Kept `createTopUpOrder` fail closed for every non-redemption source with `ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE`.
- Marked `orders.management.enabled` as `deprecated`, non-writable, `systemRead`, and application-default-only in the catalog. It is absent from generic writable keys and batch writes reject it.
- Removed the order setting database read from `adminSettingsRouter.getAll`; the compatibility field remains present and is always `false`.
- Extracted billing-basis helpers so frontend writes can only emit `pricing.creditMultiplier`. The payment switch is disabled, fixed to off, and paired with explicit default/en-US/zh-CN copy.
- Added source-backed runtime metadata for the referral resolver and exact normalizer/catalog regression coverage.

## TDD Evidence

- The interrupted worker had already added focused referral, router, catalog, and billing tests before this takeover.
- The takeover first ran those tests unchanged:
  - Referral database suite: 9 tests passed.
  - Catalog/settings/PPT suites: 58 tests passed.
  - Commercial-flow/billing-helper suites: 59 tests passed.
- The strengthened source-contract test then produced two deliberate red runs and found the unrelated memory-trigger metadata mismatch documented in the Task 1 report; both were resolved before final verification.

## Verification

- Database commercial/referral/top-up: 3 files, 43 tests passed.
- Business-server catalog/settings/PPT: 3 files, 58 tests passed.
- Root governance/admin/frontend/Docmee: 8 files, 110 tests passed.
- PPT workspace: 1 file, 4 tests passed.
- Final catalog and billing-helper recheck: 26 tests passed.
- Locale default/en-US/zh-CN key parity and JSON parsing: passed.
- `bun run type-check`: passed.
- Targeted ESLint over all changed TypeScript/TSX files: passed.
- `git diff --check`: passed.

## Self-review

- Referral setting reads are bounded to one per public operation and are not repeated across activation branches.
- Positive relation snapshots retain priority; invalid configured values preserve the historical fallback.
- Platform online payment remains closed in model behavior, backend compatibility output, catalog writes, and UI affordance.
- Pricing multiplier editing remains available and is the only billing-basis batch update.
- No credentials, payment-provider behavior, deployment content, navigation changes, Module App changes, or Worker changes were introduced.

## Residual Concerns

- `ordersManagementEnabled` remains in the compatibility response and legacy form types by design; it is ignored by billing writes and always returned as `false`.
