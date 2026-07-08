# Task 4 Report: User Marketplace Filtering And Availability Presentation

## Implementation

- Added `filterAndSortPlatformPlugins` and `getPlatformPluginPlanStatusLabel` in `src/features/PlatformPluginMarket/helpers.ts`.
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
  - query filtering
  - plan status label mapping
- Updated `src/services/platformPlugin.test.ts` to assert filtered marketplace input forwarding.
- Updated `apps/server/src/routers/lambda/platformPlugin.test.ts` to assert router filter forwarding and adjusted the default no-input expectation to `filters: {}`.

## TDD Evidence

### Red

1. Ran:
   - `bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts`
   - Failure: `filterAndSortPlatformPlugins is not a function`
   - Failure: `getPlatformPluginPlanStatusLabel is not a function`
2. Ran:
   - `bunx vitest run --silent='passed-only' src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts`
   - Failure: service did not forward marketplace filters
   - Failure: router did not forward marketplace filters

### Green

Ran:

`bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts`

Result:

- 3 test files passed
- 12 tests passed

Also ran:

- `git diff --check`

Result:

- Passed with no whitespace or conflict-marker issues

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

- The brief’s sample helper predicate text included matching query against category and tags, but the provided failing test data only passes if query matching is limited to display name and slug. The implementation follows the tested behavior and mirrors it in the database filter so client/server remain consistent.
