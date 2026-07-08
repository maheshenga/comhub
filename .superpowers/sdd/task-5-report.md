# Task 5 Report: User Run History And Detail Experience

## Status

Completed.

## Requirements Implemented

- Added current-user plugin run history retrieval in `PlatformPluginModel.listUserRunHistory`.
- Added `lambda.platformPlugin.listRuns` guarded by `requirePluginDetail` before run-history access.
- Added `platformPluginService.listRuns` client passthrough.
- Added `PluginRunHistory` UI and wired recent runs into `PluginDetail`.
- Added i18n keys for the new run-history labels in default, `en-US`, and `zh-CN` subscription locale files.
- Kept run history sanitized: the returned shape contains only `runId`, `status`, `preview`, timestamps, billing summary, plugin metadata, and artifact ids. It does not expose `inputSnapshot`, raw request bodies, runtime config, decrypted headers, or secret values.

## TDD Evidence

### Red

I added failing tests first in:

- `apps/server/src/routers/lambda/platformPlugin.test.ts`
- `src/services/platformPlugin.test.ts`

Then I ran:

```bash
bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.test.ts
```

Observed failures:

- `No procedure found on path "listRuns"`
- `service.listRuns is not a function`

### Green

After implementing the model/router/service/UI path, I reran:

```bash
bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.test.ts
```

Result: both test files passed, 8 tests total.

## Files Changed

- `packages/database/src/models/platformPlugin.ts`
- `apps/server/src/routers/lambda/platformPlugin.ts`
- `apps/server/src/routers/lambda/platformPlugin.test.ts`
- `src/services/platformPlugin.ts`
- `src/services/platformPlugin.test.ts`
- `src/features/PlatformPluginMarket/PluginRunHistory.tsx`
- `src/features/PlatformPluginMarket/PluginDetail.tsx`
- `packages/locales/src/default/subscription.ts`
- `locales/en-US/subscription.json`
- `locales/zh-CN/subscription.json`

## Verification

Passed:

```bash
bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/platformPlugin.test.ts src/services/platformPlugin.test.ts
```

Pending / not run:

- Full branch type-check was not run because the task brief says broader branch issues may remain outside Task 5 ownership.

## Self-Review

- Router preserves the required detail/plan gate by calling `requirePluginDetail` before listing runs.
- Data access is scoped to `pluginId + userId`.
- Run-history mapping uses billing/output snapshots only to derive sanitized summary fields.
- UI copy introduced for the new run-history surface is i18n-backed.
- The implementation stayed within the requested ownership surface plus locale files explicitly allowed by the brief.

## Concerns

- There is no dedicated database-model test covering pagination/artifact grouping for `listUserRunHistory`; current verification is through router/service tests only.
- I did not run a browser/UI test pass, so the run-history presentation is unverified visually in this task.
