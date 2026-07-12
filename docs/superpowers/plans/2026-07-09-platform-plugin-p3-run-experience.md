# Platform Plugin P3 Run Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the user-facing platform plugin detail and run experience so users see localized, readable state, billing, artifact, and restriction messages instead of hardcoded or mojibake text.

**Architecture:** Keep the existing P1/P2-lite platform plugin domain and APIs. This P3 slice is frontend-only except for documentation: move display decisions into pure helpers, use existing `subscription` i18n namespace, and keep server authorization as the source of truth for install/run availability.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, React Router, SWR, Ant Design, `@lobehub/ui`, react-i18next, Vitest.

## Global Constraints

- Do not import MCP entries or Skills into the platform plugin marketplace.
- Do not add desktop plugin integration, desktop update prompts, or desktop-only execution.
- Do not add runtime types beyond `api_action` and `content_generation`.
- Do not change server authorization, billing formula, run persistence, or database schema.
- Do not expose secrets, raw request bodies, raw runtime config, decrypted headers, or `inputSnapshot`.
- Keep changes small, reversible, and independently testable.
- Ship English defaults, `locales/en-US`, and `locales/zh-CN` together for new i18n keys.

---

## File Structure

- `src/features/PlatformPluginMarket/helpers.ts`: pure presentation helpers for restriction keys, runtime keys, billing values, and run status metadata.
- `src/features/PlatformPluginMarket/helpers.test.ts`: contract tests for helper behavior and localization key selection.
- `src/features/PlatformPluginMarket/PluginRestrictionNotice.tsx`: localized restriction alert.
- `src/features/PlatformPluginMarket/PluginDetail.tsx`: localized detail page labels and status tags.
- `src/features/PlatformPluginMarket/PluginRunPanel.tsx`: localized run form, result, billing, artifact, and error display.
- `packages/locales/src/default/subscription.ts`: default English i18n keys.
- `locales/en-US/subscription.json`: English runtime locale.
- `locales/zh-CN/subscription.json`: Chinese runtime locale.
- `docs/FEATURE_REGISTRY.md`: note P3 run experience status.
- `docs/CHANGELOG_INTERNAL.md`: internal changelog entry.

---

### Task 1: Presentation Helper Contract

**Files:**
- Modify: `src/features/PlatformPluginMarket/helpers.ts`
- Modify: `src/features/PlatformPluginMarket/helpers.test.ts`

**Interfaces:**
- Consumes: `PlatformPluginListItem`, `PlatformPluginRunResult`, `PlatformPluginRunHistoryItem['status']`, `PlatformPluginRestrictionReason`
- Produces:
  - `getPlatformPluginRestrictionCopyKey(reason: string): PlatformPluginRestrictionCopyKey`
  - `getPlatformPluginRuntimeLabelKey(runtimeType): 'platformPlugins.marketplace.runtime.apiAction' | 'platformPlugins.marketplace.runtime.contentGeneration'`
  - `getPlatformPluginBillingSummaryValues(plugin): { fixedCredits: string; multiplier: number }`
  - `getPlatformPluginRunStatusMeta(status): { color: string; labelKey: PlatformPluginRunStatusLabelKey }`

- [ ] **Step 1: Write failing helper tests**

In `src/features/PlatformPluginMarket/helpers.test.ts`, replace the copy-string assertions with localization-key assertions and add run status metadata coverage:

```typescript
import {
  filterAndSortPlatformPlugins,
  formatPlatformPluginCredits,
  getPlatformPluginBillingSummaryValues,
  getPlatformPluginPlanStatusLabel,
  getPlatformPluginRestrictionCopyKey,
  getPlatformPluginRunStatusMeta,
  getPlatformPluginRuntimeLabelKey,
  isPlatformPluginRunnable,
} from './helpers';

it('returns localization keys for run restrictions', () => {
  expect(getPlatformPluginRestrictionCopyKey('plan_run_denied')).toBe(
    'platformPlugins.restriction.planRunDenied',
  );
  expect(getPlatformPluginRestrictionCopyKey('agent_not_enabled')).toBe(
    'platformPlugins.restriction.agentNotEnabled',
  );
  expect(getPlatformPluginRestrictionCopyKey('unknown_reason')).toBe(
    'platformPlugins.restriction.unknown',
  );
});

it('returns status label metadata for run results', () => {
  expect(getPlatformPluginRunStatusMeta('succeeded')).toEqual({
    color: 'green',
    labelKey: 'platformPlugins.runHistory.status.succeeded',
  });
  expect(getPlatformPluginRunStatusMeta('failed')).toEqual({
    color: 'red',
    labelKey: 'platformPlugins.runHistory.status.failed',
  });
});
```

- [ ] **Step 2: Run helper tests to verify RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts
```

Expected: FAIL because `getPlatformPluginRestrictionCopyKey` and `getPlatformPluginRunStatusMeta` do not exist.

- [ ] **Step 3: Implement helper metadata**

In `src/features/PlatformPluginMarket/helpers.ts`, replace `restrictionCopy` with key metadata and add run status metadata:

```typescript
export type PlatformPluginRestrictionCopyKey =
  | 'platformPlugins.restriction.agentNotEnabled'
  | 'platformPlugins.restriction.notInstalled'
  | 'platformPlugins.restriction.planInstallDenied'
  | 'platformPlugins.restriction.planRunDenied'
  | 'platformPlugins.restriction.planVisibilityDenied'
  | 'platformPlugins.restriction.runtimeNotReady'
  | 'platformPlugins.restriction.unknown';

const restrictionCopyKey: Record<PlatformPluginRestrictionReason, PlatformPluginRestrictionCopyKey> = {
  agent_not_enabled: 'platformPlugins.restriction.agentNotEnabled',
  not_installed: 'platformPlugins.restriction.notInstalled',
  plan_install_denied: 'platformPlugins.restriction.planInstallDenied',
  plan_run_denied: 'platformPlugins.restriction.planRunDenied',
  plan_visibility_denied: 'platformPlugins.restriction.planVisibilityDenied',
  runtime_not_ready: 'platformPlugins.restriction.runtimeNotReady',
  unknown: 'platformPlugins.restriction.unknown',
};

export const getPlatformPluginRestrictionCopyKey = (reason: string): PlatformPluginRestrictionCopyKey =>
  restrictionCopyKey[(reason as PlatformPluginRestrictionReason) || 'unknown'] ??
  restrictionCopyKey.unknown;

export const getPlatformPluginRestrictionCopy = (reason: string) =>
  getPlatformPluginRestrictionCopyKey(reason);

export type PlatformPluginRunStatusLabelKey =
  | 'platformPlugins.runHistory.status.denied'
  | 'platformPlugins.runHistory.status.failed'
  | 'platformPlugins.runHistory.status.queued'
  | 'platformPlugins.runHistory.status.running'
  | 'platformPlugins.runHistory.status.succeeded';

export const getPlatformPluginRunStatusMeta = (
  status: 'denied' | 'failed' | 'queued' | 'running' | 'succeeded',
): { color: string; labelKey: PlatformPluginRunStatusLabelKey } => {
  const map = {
    denied: { color: 'orange', labelKey: 'platformPlugins.runHistory.status.denied' },
    failed: { color: 'red', labelKey: 'platformPlugins.runHistory.status.failed' },
    queued: { color: 'default', labelKey: 'platformPlugins.runHistory.status.queued' },
    running: { color: 'blue', labelKey: 'platformPlugins.runHistory.status.running' },
    succeeded: { color: 'green', labelKey: 'platformPlugins.runHistory.status.succeeded' },
  } satisfies Record<string, { color: string; labelKey: PlatformPluginRunStatusLabelKey }>;

  return map[status];
};
```

- [ ] **Step 4: Run helper tests to verify GREEN**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/features/PlatformPluginMarket/helpers.ts src/features/PlatformPluginMarket/helpers.test.ts docs/superpowers/plans/2026-07-09-platform-plugin-p3-run-experience.md
git commit -m "🧭 Add platform plugin run presentation helpers" -m "Constraint: frontend presentation only" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts"
```

---

### Task 2: Localize Detail And Restriction Copy

**Files:**
- Modify: `src/features/PlatformPluginMarket/PluginRestrictionNotice.tsx`
- Modify: `src/features/PlatformPluginMarket/PluginDetail.tsx`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**
- Consumes: Task 1 `getPlatformPluginRestrictionCopyKey`, `getPlatformPluginRuntimeLabelKey`, `getPlatformPluginBillingSummaryValues`
- Produces: readable localized detail page copy and no mojibake in the platform plugin detail shell.

- [ ] **Step 1: Add locale keys**

Add these keys to `packages/locales/src/default/subscription.ts` and `locales/en-US/subscription.json`:

```json
"platformPlugins.detail.agentBinding": "Agent binding",
"platformPlugins.detail.agentBindingDisabled": "Agent binding disabled",
"platformPlugins.detail.agentBindingEnabled": "Agent binding enabled",
"platformPlugins.detail.agentIdPlaceholder": "Enter Agent ID",
"platformPlugins.detail.available.installable": "Installable",
"platformPlugins.detail.available.runnable": "Runnable",
"platformPlugins.detail.available.visible": "Visible",
"platformPlugins.detail.enable": "Enable",
"platformPlugins.detail.install": "Install",
"platformPlugins.detail.installed": "Plugin installed",
"platformPlugins.detail.installRequired": "Install this plugin before binding an Agent and running it.",
"platformPlugins.detail.loadError": "Failed to load plugin details",
"platformPlugins.detail.missing": "Plugin does not exist or is not visible on the current plan",
"platformPlugins.detail.runPlugin": "Run plugin",
"platformPlugins.detail.slug": "Slug",
"platformPlugins.detail.tags": "Tags",
"platformPlugins.detail.uninstall": "Uninstall",
"platformPlugins.detail.uninstalled": "Plugin uninstalled",
"platformPlugins.detail.unavailable": "Currently unavailable",
"platformPlugins.detail.version": "Version",
"platformPlugins.restriction.agentNotEnabled": "Enable this plugin for the current Agent before running it.",
"platformPlugins.restriction.notInstalled": "Install this plugin before running it.",
"platformPlugins.restriction.planInstallDenied": "Your current plan cannot install this plugin. Upgrade to use it.",
"platformPlugins.restriction.planRunDenied": "Your current plan cannot run this plugin. Upgrade to use it.",
"platformPlugins.restriction.planVisibilityDenied": "Your current plan cannot view this plugin. Upgrade to unlock more capabilities.",
"platformPlugins.restriction.runtimeNotReady": "Plugin runtime is still being connected. You can install and bind it first.",
"platformPlugins.restriction.unknown": "This plugin cannot run right now. Try again later or contact an administrator."
```

Add Chinese equivalents to `locales/zh-CN/subscription.json`.

- [ ] **Step 2: Update restriction alert**

In `PluginRestrictionNotice.tsx`, use `useTranslation('subscription')` and render:

```tsx
<Alert
  showIcon
  description={t(getPlatformPluginRestrictionCopyKey(reason))}
  message={t('platformPlugins.detail.unavailable')}
  type="warning"
/>
```

- [ ] **Step 3: Update detail page labels**

In `PluginDetail.tsx`, replace hardcoded/mojibake strings with `t(...)`, runtime label keys, and `platformPlugins.marketplace.billingSummary`. Keep the same layout and actions.

- [ ] **Step 4: Verify detail compile path**

Run:

```powershell
bun run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/features/PlatformPluginMarket/PluginRestrictionNotice.tsx src/features/PlatformPluginMarket/PluginDetail.tsx packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "🌐 Localize platform plugin detail copy" -m "Constraint: no API or authorization behavior changes" -m "Tested: bun run type-check"
```

---

### Task 3: Localize And Structure Run Panel Output

**Files:**
- Modify: `src/features/PlatformPluginMarket/PluginRunPanel.tsx`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**
- Consumes: Task 1 `getPlatformPluginRunStatusMeta`, `formatPlatformPluginCredits`
- Produces: localized run button, empty-input hint, no-action fallback, success/failure messages, status tag, billing line, artifact line, and preview fallback.

- [ ] **Step 1: Add run panel locale keys**

Add these keys to default/en-US subscription locales:

```json
"platformPlugins.run.action": "Run plugin",
"platformPlugins.run.agentRequired": "Enter an Agent ID before running this plugin",
"platformPlugins.run.artifacts": "Artifacts: {{ids}}",
"platformPlugins.run.billing": "Billing: {{credits}} credits",
"platformPlugins.run.completed": "Plugin run completed",
"platformPlugins.run.emptyInput": "This plugin does not require extra input.",
"platformPlugins.run.noAction": "No runnable action is available.",
"platformPlugins.run.noPreview": "No preview returned",
"platformPlugins.run.result": "Run result",
"platformPlugins.run.status": "Status: {{status}}"
```

Add Chinese equivalents to `locales/zh-CN/subscription.json`.

- [ ] **Step 2: Update run panel**

In `PluginRunPanel.tsx`:

```tsx
const { t } = useTranslation('subscription');
...
message.warning(t('platformPlugins.run.agentRequired'));
...
message.success(t('platformPlugins.run.completed'));
...
const statusMeta = getPlatformPluginRunStatusMeta(result.status);
...
<Tag color={statusMeta.color}>{t(statusMeta.labelKey)}</Tag>
<Text type="secondary">
  {t('platformPlugins.run.billing', {
    credits: formatPlatformPluginCredits(result.billing?.chargedCredits),
  })}
</Text>
```

- [ ] **Step 3: Refresh history after run**

Add an optional `onRunComplete?: () => void | Promise<void>` prop to `PluginRunPanel`. Call it after setting a successful result. In `PluginDetail.tsx`, pass `onRunComplete={refresh}` so the recent run history updates after execution.

- [ ] **Step 4: Run focused tests and type-check**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/features/PlatformPluginMarket/PluginRunPanel.tsx src/features/PlatformPluginMarket/PluginDetail.tsx packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "✨ Improve platform plugin run panel feedback" -m "Constraint: user history refresh only after successful run" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts" -m "Tested: bun run type-check"
```

---

### Task 4: Documentation And Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: governance documentation and final verification evidence.

- [ ] **Step 1: Update feature registry**

Under the Platform Plugin Marketplace entry, add:

```markdown
#### Platform Plugin Marketplace P3 Run Experience Update

- Status: experimental
- Description: P3 run experience adds localized detail-page copy, localized restriction explanations, readable run result metadata, and recent-run refresh after successful execution.
- Maintenance risk: medium
- Test recommendation: add browser smoke for install -> bind Agent -> run -> see history once a seeded test database is available.
- Note: This slice is frontend presentation only and does not change plugin permissions, billing calculation, runtime types, MCP / Skills isolation, or database schema.
```

- [ ] **Step 2: Update changelog**

Add under Platform Plugins:

```markdown
### Platform Plugin Marketplace P3 Run Experience

- Replaced hardcoded/mojibake platform plugin detail and run panel copy with localized subscription namespace keys.
- Added presentation helpers for restriction copy keys and run status metadata.
- Refreshed recent run history after a successful plugin run.
- Preserved server-side install/run authorization and billing behavior.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts
bun run type-check
git diff -- packages/database/src/models/plugin.ts apps/server/src/routers/lambda/plugin.ts apps/server/src/routers/tools/mcp.ts "src/routes/(main)/settings/skill" src/features/ChatInput/InputEditor/ActionTag
git diff --check
```

Expected:
- Tests PASS.
- Type-check PASS.
- Isolation diff prints no output.
- Diff check has no whitespace errors.

- [ ] **Step 4: Commit Task 4**

```powershell
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "📝 Document platform plugin P3 run experience" -m "Constraint: docs only" -m "Tested: final platform plugin focused verification"
```

---

## Final Review Checklist

- [ ] Plugin detail page no longer renders mojibake/hardcoded Chinese strings for common labels.
- [ ] Restriction messages use `subscription` locale keys.
- [ ] Run panel uses localized labels for no-action, empty input, run button, success, billing, status, artifacts, and preview fallback.
- [ ] Run status metadata is covered by tests.
- [ ] Recent run history refreshes after a successful run.
- [ ] MCP routes, Skills pages, legacy plugin routers, desktop code, and chat ActionTag code have no diff.
- [ ] No server authorization, billing formula, runtime type, or database schema changes.
- [ ] Focused tests and `bun run type-check` pass before declaring this P complete.

