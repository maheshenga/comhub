# Platform Plugin P7 Run History Preview Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop platform plugin run history from displaying internal sentinel preview text such as `platform_plugin_run_failed`.

**Architecture:** Reuse the existing frontend run preview helper from P5. Add a focused component test for `PluginRunHistory`, then wire history rows to translate failed sentinel previews while preserving readable runtime previews and existing pagination behavior.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, Ant Design, `@lobehub/ui`, react-i18next, Vitest, Testing Library with happy-dom.

## Global Constraints

- Do not change platform plugin database schema.
- Do not change server-side run history persistence or `lambda.platformPlugin.listRuns`.
- Do not change billing, authorization, runtime execution, MCP / Skills isolation, desktop behavior, or pagination contract.
- Do not expose raw secrets, request bodies, runtime config, decrypted headers, or `inputSnapshot`.
- Keep this P scoped to run-history presentation, tests, docs, and existing locale keys.
- Do not add new locale keys unless the existing `platformPlugins.run.failedPreview` key is insufficient.

---

## File Structure

- `src/features/PlatformPluginMarket/PluginRunHistory.test.tsx`: new component test covering failed sentinel preview replacement and readable preview preservation.
- `src/features/PlatformPluginMarket/PluginRunHistory.tsx`: use `getPlatformPluginRunPreviewCopyKey` for history preview display.
- `docs/FEATURE_REGISTRY.md`: P7 entry.
- `docs/CHANGELOG_INTERNAL.md`: P7 changelog entry.

---

### Task 1: Run History Preview Presentation Test And Wiring

**Files:**
- Create: `src/features/PlatformPluginMarket/PluginRunHistory.test.tsx`
- Modify: `src/features/PlatformPluginMarket/PluginRunHistory.tsx`

**Interfaces:**
- Consumes: `getPlatformPluginRunPreviewCopyKey({ preview, status })`.
- Produces: history preview text that hides `platform_plugin_run_failed` and displays `platformPlugins.run.failedPreview` through `t(...)`.

- [ ] **Step 1: Write failing component test**

Create `src/features/PlatformPluginMarket/PluginRunHistory.test.tsx`:

```tsx
/**
 * @vitest-environment happy-dom
 */
import type { PlatformPluginRunHistoryItem } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PluginRunHistory from './PluginRunHistory';

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => {
  const Empty = ({ description }: any) => <div>{description}</div>;
  Empty.PRESENTED_IMAGE_SIMPLE = 'simple';

  return {
    Button: ({ children, loading, onClick }: any) => (
      <button aria-busy={loading} type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Empty,
    Tag: ({ children }: any) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: any) => <span>{children}</span>,
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const buildRun = (
  overrides: Partial<PlatformPluginRunHistoryItem>,
): PlatformPluginRunHistoryItem => ({
  artifactIds: [],
  chargedCredits: 0,
  createdAt: '2026-07-09T00:00:00.000Z',
  fixedServiceFeeCharged: false,
  pluginId: 'plugin-1',
  pluginName: 'Research Notes',
  runId: 'run-1',
  status: 'succeeded',
  ...overrides,
});

describe('PluginRunHistory', () => {
  it('localizes failed sentinel previews instead of rendering raw backend text', () => {
    render(
      <PluginRunHistory
        items={[
          buildRun({
            preview: 'platform_plugin_run_failed',
            status: 'failed',
          }),
        ]}
      />,
    );

    expect(screen.queryByText('platform_plugin_run_failed')).toBeNull();
    expect(screen.getByText('platformPlugins.run.failedPreview')).toBeTruthy();
  });

  it('keeps readable runtime previews unchanged', () => {
    render(<PluginRunHistory items={[buildRun({ preview: 'Readable runtime output' })]} />);

    expect(screen.getByText('Readable runtime output')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/PluginRunHistory.test.tsx
```

Expected: FAIL because `platform_plugin_run_failed` is still rendered directly.

- [ ] **Step 3: Wire history preview helper**

Update `src/features/PlatformPluginMarket/PluginRunHistory.tsx` import:

```typescript
import { formatPlatformPluginCredits, getPlatformPluginRunPreviewCopyKey } from './helpers';
```

Inside `items.map`, change the callback to a block and derive preview text:

```tsx
        {items.map((item) => {
          const previewCopyKey = item.preview ? getPlatformPluginRunPreviewCopyKey(item) : null;
          const previewText = previewCopyKey ? t(previewCopyKey) : item.preview;

          return (
            <Flexbox
              gap={6}
              key={item.runId}
              padding={12}
              style={{ border: '1px solid var(--lobe-color-border-secondary)', borderRadius: 8 }}
            >
```

Then replace:

```tsx
            {item.preview ? <Text ellipsis>{item.preview}</Text> : null}
```

with:

```tsx
            {previewText ? <Text ellipsis>{previewText}</Text> : null}
```

Close the block callback:

```tsx
          );
        })}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/PluginRunHistory.test.tsx src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run type-check**

Run:

```powershell
bun run type-check
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -f docs/superpowers/plans/2026-07-09-platform-plugin-p7-run-history-preview-copy.md
git add src/features/PlatformPluginMarket/PluginRunHistory.test.tsx src/features/PlatformPluginMarket/PluginRunHistory.tsx
git commit -m "🧾 Localize platform plugin run history failed previews" -m "Constraint: frontend run-history presentation only" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/PluginRunHistory.test.tsx src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts" -m "Tested: bun run type-check"
```

---

### Task 2: Documentation And Final Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes: Task 1.
- Produces: governance documentation and final verification evidence.

- [ ] **Step 1: Update feature registry**

Add under Platform Plugin Marketplace:

```markdown
#### Platform Plugin Marketplace P7 Run History Preview Copy Update

- Status: experimental
- Description: P7 localizes failed run-history sentinel previews while preserving readable runtime previews and existing run-history pagination.
- Maintenance risk: low
- Test recommendation: add browser smoke for failed plugin runs appearing in history once a seeded test database is available.
- Note: This slice only changes frontend run-history presentation and does not change history persistence, billing, authorization, runtime execution, or MCP / Skills isolation.
```

- [ ] **Step 2: Update changelog**

Add:

```markdown
### Platform Plugin Marketplace P7 Run History Preview Copy

- Added run-history presentation coverage for failed sentinel previews.
- Reused the existing localized failed-preview copy in history rows.
- Preserved readable runtime previews and existing run-history pagination.
- Preserved plugin authorization, billing, persistence, runtime execution, and MCP / Skills isolation.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/PluginRunHistory.test.tsx src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts src/services/platformPlugin.test.ts apps/server/src/routers/lambda/platformPlugin.test.ts
bun run type-check
git diff -- packages/database/src/models/plugin.ts apps/server/src/routers/lambda/plugin.ts apps/server/src/routers/tools/mcp.ts "src/routes/(main)/settings/skill" src/features/ChatInput/InputEditor/ActionTag
git diff --check
```

Expected:
- Tests PASS.
- Type-check PASS.
- Isolation diff prints no output.
- Diff check has no whitespace errors.

- [ ] **Step 4: Commit Task 2**

```powershell
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "📝 Document platform plugin P7 run history preview copy" -m "Constraint: docs only" -m "Tested: final platform plugin focused verification"
```

---

## Final Review Checklist

- [ ] Run history no longer renders `platform_plugin_run_failed`.
- [ ] Run history still renders readable runtime preview text.
- [ ] No new locale keys were needed because P5 already added `platformPlugins.run.failedPreview`.
- [ ] No server, database, billing, permission, MCP, Skills, desktop, ActionTag, or pagination code changes.
- [ ] Focused tests and `bun run type-check` pass before declaring P7 complete.
