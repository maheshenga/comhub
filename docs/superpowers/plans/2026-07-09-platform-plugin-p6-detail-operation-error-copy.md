# Platform Plugin P6 Detail Operation Error Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the platform plugin detail page from showing raw backend error strings for install, uninstall, and Agent binding operations.

**Architecture:** Keep `lambda.platformPlugin.install`, `lambda.platformPlugin.uninstall`, and `lambda.platformPlugin.setAgentBinding` unchanged. Add a frontend-only presentation helper that maps known backend operation error messages to subscription locale keys, then wire `PluginDetail` to use that helper in its shared action catch block.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, Ant Design, `@lobehub/ui`, react-i18next, Vitest.

## Global Constraints

- Do not change platform plugin database schema.
- Do not change server-side plugin authorization, billing, run persistence, audit logging, runtime execution, or error creation.
- Do not expose raw backend error messages, secrets, request bodies, runtime config, decrypted headers, or `inputSnapshot`.
- Do not import MCP entries or Skills into the platform plugin marketplace.
- Do not add desktop plugin integration or desktop-only execution.
- Keep this P scoped to frontend presentation helpers, locale keys, docs, and tests.
- Ship default, en-US, and zh-CN locale keys together.

---

## File Structure

- `src/features/PlatformPluginMarket/helpers.ts`: add `getPlatformPluginDetailActionErrorCopyKey`.
- `src/features/PlatformPluginMarket/helpers.test.ts`: add TDD coverage for detail operation error mapping.
- `src/features/PlatformPluginMarket/localeKeys.test.ts`: require new detail error keys across default/en-US/zh-CN locale sources.
- `packages/locales/src/default/subscription.ts`: default English detail operation error keys.
- `locales/en-US/subscription.json`: English runtime detail operation error keys.
- `locales/zh-CN/subscription.json`: Chinese runtime detail operation error keys.
- `src/features/PlatformPluginMarket/PluginDetail.tsx`: use the helper for install/uninstall/Agent binding failures.
- `docs/FEATURE_REGISTRY.md`: P6 entry.
- `docs/CHANGELOG_INTERNAL.md`: P6 changelog entry.

---

### Task 1: Detail Operation Error Presentation Contract

**Files:**
- Modify: `src/features/PlatformPluginMarket/helpers.ts`
- Modify: `src/features/PlatformPluginMarket/helpers.test.ts`
- Modify: `src/features/PlatformPluginMarket/localeKeys.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**
- Consumes: backend error messages from `lambda.platformPlugin.install`, `lambda.platformPlugin.uninstall`, and `lambda.platformPlugin.setAgentBinding`.
- Produces:
  - `getPlatformPluginDetailActionErrorCopyKey(error: unknown): PlatformPluginDetailActionErrorCopyKey`
  - locale keys:
    - `platformPlugins.detail.errors.agentBindingUnavailable`
    - `platformPlugins.detail.errors.pluginUnavailable`
    - `platformPlugins.detail.errors.unknown`

- [ ] **Step 1: Write failing helper tests**

Add import in `src/features/PlatformPluginMarket/helpers.test.ts`:

```typescript
  getPlatformPluginDetailActionErrorCopyKey,
```

Add this test inside `describe('platform plugin marketplace helpers', () => { ... })`:

```typescript
  it('maps platform plugin detail operation errors to localized copy keys', () => {
    expect(getPlatformPluginDetailActionErrorCopyKey(new Error('plan_install_denied'))).toBe(
      'platformPlugins.restriction.planInstallDenied',
    );
    expect(getPlatformPluginDetailActionErrorCopyKey(new Error('plan_run_denied'))).toBe(
      'platformPlugins.restriction.planRunDenied',
    );
    expect(getPlatformPluginDetailActionErrorCopyKey(new Error('not_installed'))).toBe(
      'platformPlugins.detail.errors.agentBindingUnavailable',
    );
    expect(getPlatformPluginDetailActionErrorCopyKey(new Error('platform_plugin_not_found'))).toBe(
      'platformPlugins.detail.errors.pluginUnavailable',
    );
    expect(getPlatformPluginDetailActionErrorCopyKey(new Error('plugin_not_published'))).toBe(
      'platformPlugins.detail.errors.pluginUnavailable',
    );
    expect(getPlatformPluginDetailActionErrorCopyKey(new Error('raw database detail'))).toBe(
      'platformPlugins.detail.errors.unknown',
    );
  });
```

- [ ] **Step 2: Extend locale key contract test**

In `src/features/PlatformPluginMarket/localeKeys.test.ts`, add these keys to `requiredDetailKeys`:

```typescript
  'platformPlugins.detail.errors.agentBindingUnavailable',
  'platformPlugins.detail.errors.pluginUnavailable',
  'platformPlugins.detail.errors.unknown',
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: FAIL because the helper export and locale keys are missing.

- [ ] **Step 4: Implement helper metadata**

Add to `src/features/PlatformPluginMarket/helpers.ts` after `PlatformPluginRunPreviewCopyKey`:

```typescript
export type PlatformPluginDetailActionErrorCopyKey =
  | PlatformPluginRestrictionCopyKey
  | 'platformPlugins.detail.errors.agentBindingUnavailable'
  | 'platformPlugins.detail.errors.pluginUnavailable'
  | 'platformPlugins.detail.errors.unknown';
```

Add this mapping after `normalizePlatformPluginErrorMessage`:

```typescript
const detailActionErrorCopyKey: Record<string, PlatformPluginDetailActionErrorCopyKey> = {
  agent_not_enabled: 'platformPlugins.restriction.agentNotEnabled',
  not_installed: 'platformPlugins.detail.errors.agentBindingUnavailable',
  plan_install_denied: 'platformPlugins.restriction.planInstallDenied',
  plan_run_denied: 'platformPlugins.restriction.planRunDenied',
  plan_visibility_denied: 'platformPlugins.restriction.planVisibilityDenied',
  plugin_not_published: 'platformPlugins.detail.errors.pluginUnavailable',
  platform_plugin_not_found: 'platformPlugins.detail.errors.pluginUnavailable',
  platform_plugin_version_not_found: 'platformPlugins.detail.errors.pluginUnavailable',
};

export const getPlatformPluginDetailActionErrorCopyKey = (
  error: unknown,
): PlatformPluginDetailActionErrorCopyKey => {
  const message = normalizePlatformPluginErrorMessage(error);
  const restrictionKey = restrictionCopyKey[message as PlatformPluginRestrictionReason];

  if (restrictionKey && message !== 'not_installed') return restrictionKey;

  return detailActionErrorCopyKey[message] ?? 'platformPlugins.detail.errors.unknown';
};
```

- [ ] **Step 5: Add locale keys**

Add to `packages/locales/src/default/subscription.ts` and `locales/en-US/subscription.json`:

```json
"platformPlugins.detail.errors.agentBindingUnavailable": "Install this plugin and make sure your plan can run it before updating Agent binding.",
"platformPlugins.detail.errors.pluginUnavailable": "This plugin is unavailable or no longer visible to your current plan.",
"platformPlugins.detail.errors.unknown": "This plugin action cannot be completed right now. Try again later or contact an administrator."
```

Add to `locales/zh-CN/subscription.json`:

```json
"platformPlugins.detail.errors.agentBindingUnavailable": "请先安装该插件，并确认当前套餐可运行后再更新 Agent 绑定。",
"platformPlugins.detail.errors.pluginUnavailable": "该插件不可用，或当前套餐已不可见。",
"platformPlugins.detail.errors.unknown": "当前无法完成该插件操作，请稍后重试或联系管理员。"
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -f docs/superpowers/plans/2026-07-09-platform-plugin-p6-detail-operation-error-copy.md
git add src/features/PlatformPluginMarket/helpers.ts src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "🧭 Add platform plugin detail operation error copy contract" -m "Constraint: frontend presentation contract only" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts"
```

---

### Task 2: Wire Detail Operation Failure Copy

**Files:**
- Modify: `src/features/PlatformPluginMarket/PluginDetail.tsx`

**Interfaces:**
- Consumes: `getPlatformPluginDetailActionErrorCopyKey(error)`.
- Produces: localized install, uninstall, and Agent binding failure toast copy without changing the operation API.

- [ ] **Step 1: Import helper**

Update the helper import in `PluginDetail.tsx`:

```typescript
import {
  getPlatformPluginBillingSummaryValues,
  getPlatformPluginDetailActionErrorCopyKey,
  getPlatformPluginRestrictionReason,
  getPlatformPluginRuntimeLabelKey,
  isPlatformPluginRunnable,
  mergePlatformPluginRunHistoryItems,
} from './helpers';
```

- [ ] **Step 2: Use localized catch error**

Replace the `catch` block inside `runAction`:

```typescript
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('platformPlugins.restriction.unknown'));
    } finally {
```

with:

```typescript
    } catch (error) {
      message.error(t(getPlatformPluginDetailActionErrorCopyKey(error)));
    } finally {
```

- [ ] **Step 3: Run focused verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

```powershell
git add src/features/PlatformPluginMarket/PluginDetail.tsx
git commit -m "✨ Localize platform plugin detail operation failures" -m "Constraint: no API authorization billing or persistence changes" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts" -m "Tested: bun run type-check"
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
#### Platform Plugin Marketplace P6 Detail Operation Error Copy Update

- Status: experimental
- Description: P6 localizes install, uninstall, and Agent binding operation failures without changing plugin authorization, entitlement checks, persistence, runtime execution, billing, or MCP / Skills isolation.
- Maintenance risk: medium
- Test recommendation: add browser smoke for install denied, plugin missing, and Agent binding denied states once a seeded test database is available.
- Note: This slice only changes frontend presentation copy for detail-page operation failures.
```

- [ ] **Step 2: Update changelog**

Add:

```markdown
### Platform Plugin Marketplace P6 Detail Operation Error Copy

- Added localized detail-page operation failure copy for install, uninstall, and Agent binding actions.
- Added frontend mapping for known detail operation backend error codes.
- Stopped showing raw plugin detail operation error strings directly in the user toast.
- Preserved plugin authorization, entitlement checks, billing, persistence, runtime execution, and MCP / Skills isolation.
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
git commit -m "📝 Document platform plugin P6 detail operation error copy" -m "Constraint: docs only" -m "Tested: final platform plugin focused verification"
```

---

## Final Review Checklist

- [ ] Install failures no longer show raw backend strings.
- [ ] Uninstall failures no longer show raw backend strings.
- [ ] Agent binding failures no longer show raw backend strings.
- [ ] Known detail operation errors map to localized user-facing copy.
- [ ] Unknown detail operation errors use a safe generic localized fallback.
- [ ] New copy exists in default, en-US, and zh-CN subscription locales.
- [ ] No server, database, billing, permission, MCP, Skills, desktop, or ActionTag code changes.
- [ ] Focused tests and `bun run type-check` pass before declaring P6 complete.
