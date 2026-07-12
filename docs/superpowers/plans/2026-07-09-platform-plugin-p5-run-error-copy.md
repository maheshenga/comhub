# Platform Plugin P5 Run Error Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make platform plugin run failures readable and localized for users without exposing backend error codes or changing run authorization, billing, persistence, or runtime execution.

**Architecture:** Keep `lambda.platformPlugin.run` and `runPlatformPlugin` behavior unchanged. Add pure presentation helpers in the platform plugin marketplace feature to map known backend run error messages, failed run result status, and sentinel previews into locale keys. Wire `PluginRunPanel` to use those helpers for toast messages and result preview rendering.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, Ant Design, `@lobehub/ui`, react-i18next, Vitest.

## Global Constraints

- Do not change platform plugin database schema.
- Do not change server-side plugin authorization, billing, run persistence, audit logging, runtime execution, or error creation.
- Do not expose raw secrets, raw request bodies, raw runtime config, decrypted headers, or `inputSnapshot`.
- Do not import MCP entries or Skills into the platform plugin marketplace.
- Do not add desktop plugin integration or desktop-only execution.
- Keep this P scoped to frontend presentation helpers, locale keys, documentation, and tests.
- Ship default, en-US, and zh-CN locale keys together.

---

## File Structure

- `src/features/PlatformPluginMarket/helpers.ts`: add run error copy, run notice, and failed-preview helpers.
- `src/features/PlatformPluginMarket/helpers.test.ts`: TDD coverage for known error-code mapping, failed result notice mapping, and sentinel preview mapping.
- `src/features/PlatformPluginMarket/localeKeys.test.ts`: assert new run error keys exist in all runtime locale sources.
- `src/features/PlatformPluginMarket/PluginRunPanel.tsx`: use helper keys for failure/success toast and failed result preview.
- `packages/locales/src/default/subscription.ts`: default English keys.
- `locales/en-US/subscription.json`: English runtime keys.
- `locales/zh-CN/subscription.json`: Chinese runtime keys.
- `docs/FEATURE_REGISTRY.md`: P5 entry.
- `docs/CHANGELOG_INTERNAL.md`: P5 changelog entry.

---

### Task 1: Run Error Presentation Contract

**Files:**
- Modify: `src/features/PlatformPluginMarket/helpers.ts`
- Modify: `src/features/PlatformPluginMarket/helpers.test.ts`
- Modify: `src/features/PlatformPluginMarket/localeKeys.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**
- Consumes: `PlatformPluginRunStatus`, backend error messages from `lambda.platformPlugin.run` and `runPlatformPlugin`.
- Produces:
  - `getPlatformPluginRunErrorCopyKey(error: unknown): PlatformPluginRunErrorCopyKey`
  - `getPlatformPluginRunNoticeKey(status: PlatformPluginRunStatus): PlatformPluginRunNoticeKey`
  - `getPlatformPluginRunPreviewCopyKey(result: { preview?: string; status: PlatformPluginRunStatus }): PlatformPluginRunPreviewCopyKey | null`
  - locale keys:
    - `platformPlugins.run.failed`
    - `platformPlugins.run.failedPreview`
    - `platformPlugins.run.errors.actionUnavailable`
    - `platformPlugins.run.errors.adminConfiguration`
    - `platformPlugins.run.errors.externalApiFailed`
    - `platformPlugins.run.errors.insufficientBudget`
    - `platformPlugins.run.errors.pluginUnavailable`
    - `platformPlugins.run.errors.unsafeUrl`
    - `platformPlugins.run.errors.unknown`

- [ ] **Step 1: Write failing helper tests**

Add imports in `src/features/PlatformPluginMarket/helpers.test.ts`:

```typescript
  getPlatformPluginRunErrorCopyKey,
  getPlatformPluginRunNoticeKey,
  getPlatformPluginRunPreviewCopyKey,
```

Add tests:

```typescript
it('maps platform plugin run errors to localized copy keys', () => {
  expect(getPlatformPluginRunErrorCopyKey(new Error('plan_run_denied'))).toBe(
    'platformPlugins.restriction.planRunDenied',
  );
  expect(getPlatformPluginRunErrorCopyKey(new Error('platform_plugin_action_not_found'))).toBe(
    'platformPlugins.run.errors.actionUnavailable',
  );
  expect(getPlatformPluginRunErrorCopyKey(new Error('PLATFORM_PLUGIN_API_REQUEST_FAILED:429'))).toBe(
    'platformPlugins.run.errors.externalApiFailed',
  );
  expect(getPlatformPluginRunErrorCopyKey(new Error('InsufficientBudgetForModel'))).toBe(
    'platformPlugins.run.errors.insufficientBudget',
  );
  expect(getPlatformPluginRunErrorCopyKey(new Error('PLATFORM_PLUGIN_UNSAFE_URL'))).toBe(
    'platformPlugins.run.errors.unsafeUrl',
  );
  expect(getPlatformPluginRunErrorCopyKey(new Error('unexpected raw backend detail'))).toBe(
    'platformPlugins.run.errors.unknown',
  );
});

it('returns run notice and failed preview keys', () => {
  expect(getPlatformPluginRunNoticeKey('succeeded')).toBe('platformPlugins.run.completed');
  expect(getPlatformPluginRunNoticeKey('failed')).toBe('platformPlugins.run.failed');
  expect(
    getPlatformPluginRunPreviewCopyKey({
      preview: 'platform_plugin_run_failed',
      status: 'failed',
    }),
  ).toBe('platformPlugins.run.failedPreview');
  expect(
    getPlatformPluginRunPreviewCopyKey({
      preview: 'Readable runtime output',
      status: 'succeeded',
    }),
  ).toBeNull();
});
```

- [ ] **Step 2: Extend locale key contract test**

In `src/features/PlatformPluginMarket/localeKeys.test.ts`, add these required keys to `requiredRunKeys`:

```typescript
'platformPlugins.run.failed',
'platformPlugins.run.failedPreview',
'platformPlugins.run.errors.actionUnavailable',
'platformPlugins.run.errors.adminConfiguration',
'platformPlugins.run.errors.externalApiFailed',
'platformPlugins.run.errors.insufficientBudget',
'platformPlugins.run.errors.pluginUnavailable',
'platformPlugins.run.errors.unsafeUrl',
'platformPlugins.run.errors.unknown',
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: FAIL because the helper exports and locale keys are missing.

- [ ] **Step 4: Implement helper metadata**

Add to `src/features/PlatformPluginMarket/helpers.ts`:

```typescript
export type PlatformPluginRunErrorCopyKey =
  | PlatformPluginRestrictionCopyKey
  | 'platformPlugins.run.errors.actionUnavailable'
  | 'platformPlugins.run.errors.adminConfiguration'
  | 'platformPlugins.run.errors.externalApiFailed'
  | 'platformPlugins.run.errors.insufficientBudget'
  | 'platformPlugins.run.errors.pluginUnavailable'
  | 'platformPlugins.run.errors.unsafeUrl'
  | 'platformPlugins.run.errors.unknown';

export type PlatformPluginRunNoticeKey =
  | 'platformPlugins.run.completed'
  | 'platformPlugins.run.failed';

export type PlatformPluginRunPreviewCopyKey =
  | 'platformPlugins.run.failedPreview'
  | 'platformPlugins.run.noPreview';

const runErrorCopyKey: Record<string, PlatformPluginRunErrorCopyKey> = {
  COMMERCIAL_BALANCE_EXHAUSTED_ON_FINAL_CHARGE: 'platformPlugins.run.errors.insufficientBudget',
  InsufficientBudgetForModel: 'platformPlugins.run.errors.insufficientBudget',
  PLATFORM_PLUGIN_API_ACTION_NOT_CONFIGURED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_CONTENT_GENERATION_NOT_CONFIGURED:
    'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_RUN_REPOSITORY_REQUIRED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_SECRET_KEY_INVALID: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_SECRET_KEY_REQUIRED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_TEXT_GENERATOR_PROVIDER_MODEL_REQUIRED:
    'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_TEXT_GENERATOR_REQUIRED: 'platformPlugins.run.errors.adminConfiguration',
  PLATFORM_PLUGIN_UNSAFE_URL: 'platformPlugins.run.errors.unsafeUrl',
  platform_plugin_action_not_found: 'platformPlugins.run.errors.actionUnavailable',
  platform_plugin_not_found: 'platformPlugins.run.errors.pluginUnavailable',
  platform_plugin_version_not_found: 'platformPlugins.run.errors.actionUnavailable',
};

const normalizePlatformPluginErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return '';
};

export const getPlatformPluginRunErrorCopyKey = (
  error: unknown,
): PlatformPluginRunErrorCopyKey => {
  const message = normalizePlatformPluginErrorMessage(error);
  const restrictionKey = restrictionCopyKey[message as PlatformPluginRestrictionReason];
  if (restrictionKey) return restrictionKey;
  if (message.startsWith('PLATFORM_PLUGIN_API_REQUEST_FAILED:')) {
    return 'platformPlugins.run.errors.externalApiFailed';
  }

  return runErrorCopyKey[message] ?? 'platformPlugins.run.errors.unknown';
};

export const getPlatformPluginRunNoticeKey = (
  status: PlatformPluginRunStatus,
): PlatformPluginRunNoticeKey =>
  status === 'succeeded' ? 'platformPlugins.run.completed' : 'platformPlugins.run.failed';

export const getPlatformPluginRunPreviewCopyKey = ({
  preview,
  status,
}: {
  preview?: string;
  status: PlatformPluginRunStatus;
}): PlatformPluginRunPreviewCopyKey | null => {
  if (status === 'failed' && preview === 'platform_plugin_run_failed') {
    return 'platformPlugins.run.failedPreview';
  }
  if (!preview) return 'platformPlugins.run.noPreview';
  return null;
};
```

- [ ] **Step 5: Add locale keys**

Add to default/en-US:

```json
"platformPlugins.run.failed": "Plugin run failed",
"platformPlugins.run.failedPreview": "The plugin did not return a usable result. Check the configuration or try again later.",
"platformPlugins.run.errors.actionUnavailable": "This plugin action is not available. Ask an administrator to republish the plugin.",
"platformPlugins.run.errors.adminConfiguration": "This plugin needs administrator configuration before it can run.",
"platformPlugins.run.errors.externalApiFailed": "The external service request failed. Try again later or contact an administrator.",
"platformPlugins.run.errors.insufficientBudget": "Your available credits are not enough to run this plugin.",
"platformPlugins.run.errors.pluginUnavailable": "This plugin is unavailable or no longer visible to your current plan.",
"platformPlugins.run.errors.unsafeUrl": "This plugin is blocked because its API URL is not allowed.",
"platformPlugins.run.errors.unknown": "This plugin cannot run right now. Try again later or contact an administrator."
```

Add to zh-CN:

```json
"platformPlugins.run.failed": "插件运行失败",
"platformPlugins.run.failedPreview": "插件未返回可用结果，请检查配置或稍后重试。",
"platformPlugins.run.errors.actionUnavailable": "该插件动作当前不可用，请联系管理员重新发布插件。",
"platformPlugins.run.errors.adminConfiguration": "该插件需要管理员完成配置后才能运行。",
"platformPlugins.run.errors.externalApiFailed": "外部服务请求失败，请稍后重试或联系管理员。",
"platformPlugins.run.errors.insufficientBudget": "当前可用积分不足，无法运行该插件。",
"platformPlugins.run.errors.pluginUnavailable": "该插件不可用，或当前套餐已不可见。",
"platformPlugins.run.errors.unsafeUrl": "该插件的 API 地址不被允许，已被安全策略阻止。",
"platformPlugins.run.errors.unknown": "当前无法执行该插件，请稍后重试或联系管理员。"
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -f docs/superpowers/plans/2026-07-09-platform-plugin-p5-run-error-copy.md
git add src/features/PlatformPluginMarket/helpers.ts src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "🧭 Add platform plugin run error copy contract" -m "Constraint: frontend presentation contract only" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts"
```

---

### Task 2: Wire Run Panel Failure Copy

**Files:**
- Modify: `src/features/PlatformPluginMarket/PluginRunPanel.tsx`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: localized success/failure toast and localized failed-result preview without changing the run API.

- [ ] **Step 1: Import helpers**

Update the helper import in `PluginRunPanel.tsx`:

```typescript
import {
  formatPlatformPluginCredits,
  getPlatformPluginRunErrorCopyKey,
  getPlatformPluginRunNoticeKey,
  getPlatformPluginRunPreviewCopyKey,
  getPlatformPluginRunStatusMeta,
} from './helpers';
```

- [ ] **Step 2: Use status-aware toast**

Replace the success-only toast:

```typescript
message.success(t('platformPlugins.run.completed'));
```

with:

```typescript
const noticeKey = getPlatformPluginRunNoticeKey(runResult.status);
if (runResult.status === 'succeeded') {
  message.success(t(noticeKey));
} else {
  message.warning(t(noticeKey));
}
```

- [ ] **Step 3: Use localized catch error**

Replace catch block reason selection:

```typescript
const reason =
  error instanceof Error && error.message ? error.message : t('platformPlugins.restriction.unknown');
message.warning(reason);
```

with:

```typescript
message.warning(t(getPlatformPluginRunErrorCopyKey(error)));
```

- [ ] **Step 4: Use localized failed preview**

Before rendering `Paragraph`, derive:

```typescript
const previewCopyKey = result ? getPlatformPluginRunPreviewCopyKey(result) : null;
```

Render:

```tsx
{previewCopyKey ? t(previewCopyKey) : result.preview}
```

- [ ] **Step 5: Run focused verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/features/PlatformPluginMarket/PluginRunPanel.tsx
git commit -m "✨ Localize platform plugin run failures" -m "Constraint: no API authorization billing or persistence changes" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts" -m "Tested: bun run type-check"
```

---

### Task 3: Documentation And Final Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: governance documentation and final verification evidence.

- [ ] **Step 1: Update feature registry**

Add under Platform Plugin Marketplace:

```markdown
#### Platform Plugin Marketplace P5 Run Error Copy Update

- Status: experimental
- Description: P5 localizes user-facing run failures, failed-run notices, and backend error-code mapping without changing run authorization, billing, runtime execution, persistence, or MCP / Skills isolation.
- Maintenance risk: medium
- Test recommendation: add browser smoke for a configured failing plugin run once a seeded test database is available.
- Note: This slice keeps backend error creation and run history persistence unchanged; it only changes presentation copy.
```

- [ ] **Step 2: Update changelog**

Add:

```markdown
### Platform Plugin Marketplace P5 Run Error Copy

- Added localized run failure notice and failed-result preview copy.
- Added frontend mapping for known plugin run backend error codes.
- Stopped showing raw plugin run error strings directly in the user toast.
- Preserved plugin authorization, billing, persistence, runtime execution, and MCP / Skills isolation.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts
bun run type-check
git diff -- packages/database/src/models/plugin.ts apps/server/src/routers/lambda/plugin.ts apps/server/src/routers/tools/mcp.ts "src/routes/(main)/settings/skill" src/features/ChatInput/InputEditor/ActionTag
git diff --check
```

Expected:
- Tests PASS.
- Type-check PASS.
- Isolation diff prints no output.
- Diff check has no whitespace errors.

- [ ] **Step 4: Commit Task 3**

```powershell
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "📝 Document platform plugin P5 run error copy" -m "Constraint: docs only" -m "Tested: final platform plugin focused verification"
```

---

## Final Review Checklist

- [ ] Failed run results no longer show `platform_plugin_run_failed` as user-facing preview text.
- [ ] Failed run results no longer show the success toast.
- [ ] Known backend error messages map to localized user-facing copy.
- [ ] Unknown backend errors use a safe generic localized fallback.
- [ ] New copy exists in default, en-US, and zh-CN subscription locales.
- [ ] No server, database, billing, permission, MCP, Skills, desktop, or ActionTag code changes.
- [ ] Focused tests and `bun run type-check` pass before declaring P5 complete.

