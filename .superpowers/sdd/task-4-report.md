# Task 4 Report: User Marketplace Filtering And Availability Presentation

## Implementation

- Added `filterAndSortPlatformPlugins` and `getPlatformPluginPlanStatusLabel` in `src/features/PlatformPluginMarket/helpers.ts`.
- Expanded marketplace query matching to include `displayName`, `slug`, `category`, and `tags` in both the helper and database-side filter.
- Forwarded marketplace filters through `src/services/platformPlugin.ts` and `apps/server/src/routers/lambda/platformPlugin.ts`.
- Updated `packages/database/src/models/platformPlugin.ts` so `listMarketplacePlugins` accepts optional marketplace filters and applies the same category/runtime/query predicate after mapping rows to `PlatformPluginListItem`.
- Updated `src/features/PlatformPluginMarket/index.tsx` to:
  - track `query`, `category`, and `runtimeType`
  - send marketplace filters through the SWR key and service request
  - use `filterAndSortPlatformPlugins` for featured-first display ordering
  - expose a runtime filter select with `all`, `api_action`, and `content_generation`
- Updated `src/features/PlatformPluginMarket/PluginCard.tsx` to render:
  - featured tag
  - promo label tag
  - plan availability tag derived from helper logic

## Tests

- Added helper coverage in `src/features/PlatformPluginMarket/helpers.test.ts` for:
  - featured-first sorting
  - query filtering by display name / slug
  - query filtering by category / tags while preserving featured-first ordering
  - plan status label mapping
- Updated `src/services/platformPlugin.test.ts` to assert filtered marketplace input forwarding.
- Updated `apps/server/src/routers/lambda/platformPlugin.test.ts` to assert router filter forwarding and adjusted the default no-input expectation to `filters: {}`.

## Follow-up Fix

- Corrected the marketplace query predicate to match the task brief and the database filter contract:
  - `displayName`
  - `slug`
  - `category`
  - `tags`
- Reworked the helper test data so the `research` query is no longer self-contradictory:
  - `query: 'featured'` resolves to the featured plugin only
  - `query: 'research'` resolves to both plugins in featured-first order

## Verification

Ran:

- `bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts`
- `git diff --check`

Result:

- 3 test files passed, 12 tests passed
- `git diff --check` passed with no output

## Files Changed

- `packages/database/src/models/platformPlugin.ts`
- `apps/server/src/routers/lambda/platformPlugin.ts`
- `apps/server/src/routers/lambda/platformPlugin.test.ts`
- `src/services/platformPlugin.ts`
- `src/services/platformPlugin.test.ts`
- `src/features/PlatformPluginMarket/helpers.ts`
- `src/features/PlatformPluginMarket/helpers.test.ts`
- `src/features/PlatformPluginMarket/index.tsx`
- `src/features/PlatformPluginMarket/PluginCard.tsx`
- `.superpowers/sdd/task-4-report.md`

## Self-Review

- Kept server-side plan visibility and authorization unchanged; frontend tags are presentation-only.
- Kept edits inside the task-owned files.
- Preserved existing marketplace card structure while adding filtering and availability tags.
- Ensured router `toListItem` now includes `operations`, which is required by the current type contract.

## Concerns

- None.

## Review Fix: Important Findings

- Fixed `getPlatformPluginRestrictionReason` precedence so plan visibility/install/run denials are evaluated before `not_installed`.
- Changed `getPlatformPluginPlanStatusLabel` to return semantic `labelKey` values instead of hardcoded user-facing strings.
- Updated `PluginCard` to translate marketplace status labels and the featured tag through `useTranslation('subscription')`.
- Localized the Task 4 runtime/category filter labels in `src/features/PlatformPluginMarket/index.tsx`.
- Added marketplace translation keys to:
  - `packages/locales/src/default/subscription.ts`
  - `locales/en-US/subscription.json`
  - `locales/zh-CN/subscription.json`
- Expanded helper coverage for:
  - label-key return shape
  - upgrade-required precedence when `installed: false` and `planState.runnable: false`
  - installable label-key mapping for uninstalled runnable plugins

## Review Fix Verification

Ran:

- `bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts`
- `git diff --check`

Result:

- 3 test files passed, 14 tests passed
- `git diff --check` returned exit code 0; Git printed a line-ending warning for `packages/locales/src/default/subscription.ts`
