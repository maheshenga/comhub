# Platform Plugin P4 Run History Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users page through platform plugin run history from the plugin detail page using the existing `listRuns` cursor/limit API.

**Architecture:** Keep the existing `lambda.platformPlugin.listRuns` API and database query unchanged. Add a pure client helper for deduplicated page merging, add localized Load more copy, and wire `PluginDetail` to append more current-user run history records through `platformPluginService.listRuns({ pluginId, cursor, limit })`.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, SWR, React Router, Ant Design, `@lobehub/ui`, react-i18next, Vitest.

## Global Constraints

- Do not change platform plugin database schema.
- Do not change server-side install/run authorization or billing behavior.
- Do not expose secrets, raw request bodies, raw runtime config, decrypted headers, or `inputSnapshot`.
- Do not import MCP entries or Skills into the platform plugin marketplace.
- Do not add desktop plugin integration or desktop-only execution.
- Keep pagination client-side and compatible with the existing `{ items, nextCursor }` response.
- Ship default, en-US, and zh-CN locale keys together.

---

## File Structure

- `src/features/PlatformPluginMarket/helpers.ts`: add `mergePlatformPluginRunHistoryItems`.
- `src/features/PlatformPluginMarket/helpers.test.ts`: TDD coverage for deduplicated history merge order.
- `src/features/PlatformPluginMarket/localeKeys.test.ts`: assert new pagination locale keys exist in all runtime locale sources.
- `src/features/PlatformPluginMarket/PluginRunHistory.tsx`: add optional load-more props and localized button.
- `src/features/PlatformPluginMarket/PluginDetail.tsx`: maintain appended history state, call `listRuns` with `cursor`, pass load-more props.
- `packages/locales/src/default/subscription.ts`: default English keys.
- `locales/en-US/subscription.json`: English runtime keys.
- `locales/zh-CN/subscription.json`: Chinese runtime keys.
- `docs/FEATURE_REGISTRY.md`: P4 entry.
- `docs/CHANGELOG_INTERNAL.md`: P4 changelog entry.

---

### Task 1: Run History Merge Helper And Locale Contract

**Files:**
- Modify: `src/features/PlatformPluginMarket/helpers.ts`
- Modify: `src/features/PlatformPluginMarket/helpers.test.ts`
- Modify: `src/features/PlatformPluginMarket/localeKeys.test.ts`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**
- Consumes: `PlatformPluginRunHistoryItem`
- Produces:
  - `mergePlatformPluginRunHistoryItems(current, next): PlatformPluginRunHistoryItem[]`
  - locale keys `platformPlugins.runHistory.loadMore` and `platformPlugins.runHistory.loadingMore`

- [ ] **Step 1: Write failing merge helper test**

Add to `src/features/PlatformPluginMarket/helpers.test.ts`:

```typescript
it('merges run history pages without duplicating run ids', () => {
  const first = {
    artifactIds: [],
    chargedCredits: 10,
    createdAt: '2026-07-09T00:00:00.000Z',
    fixedServiceFeeCharged: false,
    pluginId: 'plugin-1',
    pluginName: 'Research Notes',
    runId: 'run-1',
    status: 'succeeded' as const,
  };
  const duplicate = { ...first, chargedCredits: 20 };
  const second = { ...first, runId: 'run-2', status: 'failed' as const };

  expect(mergePlatformPluginRunHistoryItems([first], [duplicate, second])).toEqual([
    first,
    second,
  ]);
});
```

- [ ] **Step 2: Extend locale key contract test**

In `src/features/PlatformPluginMarket/localeKeys.test.ts`, add these required keys to the run-history group:

```typescript
'platformPlugins.runHistory.loadMore',
'platformPlugins.runHistory.loadingMore',
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: FAIL because `mergePlatformPluginRunHistoryItems` and new locale keys are missing.

- [ ] **Step 4: Implement helper**

Add to `src/features/PlatformPluginMarket/helpers.ts`:

```typescript
export const mergePlatformPluginRunHistoryItems = (
  current: PlatformPluginRunHistoryItem[],
  next: PlatformPluginRunHistoryItem[],
) => {
  const seen = new Set(current.map((item) => item.runId));
  const merged = [...current];

  for (const item of next) {
    if (seen.has(item.runId)) continue;
    seen.add(item.runId);
    merged.push(item);
  }

  return merged;
};
```

- [ ] **Step 5: Add locale keys**

Add to default/en-US:

```json
"platformPlugins.runHistory.loadMore": "Load more",
"platformPlugins.runHistory.loadingMore": "Loading more..."
```

Add to zh-CN:

```json
"platformPlugins.runHistory.loadMore": "加载更多",
"platformPlugins.runHistory.loadingMore": "正在加载..."
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -f docs/superpowers/plans/2026-07-09-platform-plugin-p4-run-history-pagination.md
git add src/features/PlatformPluginMarket/helpers.ts src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "🧾 Add platform plugin run history pagination contract" -m "Constraint: client presentation contract only" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts"
```

---

### Task 2: Wire Load More UI

**Files:**
- Modify: `src/features/PlatformPluginMarket/PluginRunHistory.tsx`
- Modify: `src/features/PlatformPluginMarket/PluginDetail.tsx`

**Interfaces:**
- Consumes: Task 1 `mergePlatformPluginRunHistoryItems`
- Produces: Load-more UI for recent run history without backend changes.

- [ ] **Step 1: Update PluginRunHistory props**

In `PluginRunHistory.tsx`, add:

```typescript
hasMore?: boolean;
loadingMore?: boolean;
onLoadMore?: () => void;
```

Render a button after items when `hasMore` is true:

```tsx
{hasMore ? (
  <Button loading={loadingMore} onClick={onLoadMore}>
    {t(loadingMore ? 'platformPlugins.runHistory.loadingMore' : 'platformPlugins.runHistory.loadMore')}
  </Button>
) : null}
```

- [ ] **Step 2: Wire detail page state**

In `PluginDetail.tsx`:

```typescript
const RUN_HISTORY_LIMIT = 20;
const [runHistoryItems, setRunHistoryItems] = useState<PlatformPluginRunHistoryItem[]>([]);
const [nextRunCursor, setNextRunCursor] = useState<null | number>(null);
const [loadingMoreRuns, setLoadingMoreRuns] = useState(false);
```

When SWR returns the initial page, sync local state:

```typescript
useEffect(() => {
  setRunHistoryItems(runHistory?.items ?? []);
  setNextRunCursor(runHistory?.nextCursor ?? null);
}, [runHistory]);
```

Add load-more handler:

```typescript
const loadMoreRuns = async () => {
  if (nextRunCursor === null) return;
  setLoadingMoreRuns(true);
  try {
    const nextPage = await platformPluginService.listRuns({
      cursor: nextRunCursor,
      limit: RUN_HISTORY_LIMIT,
      pluginId: plugin.id,
    });
    setRunHistoryItems((items) => mergePlatformPluginRunHistoryItems(items, nextPage.items));
    setNextRunCursor(nextPage.nextCursor);
  } finally {
    setLoadingMoreRuns(false);
  }
};
```

Update initial SWR call to pass `{ limit: RUN_HISTORY_LIMIT }` and pass props to `PluginRunHistory`.

- [ ] **Step 3: Run focused verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

```powershell
git add src/features/PlatformPluginMarket/PluginRunHistory.tsx src/features/PlatformPluginMarket/PluginDetail.tsx
git commit -m "🔎 Add platform plugin run history load more" -m "Constraint: uses existing listRuns cursor API" -m "Tested: bunx vitest run --silent='passed-only' src/features/PlatformPluginMarket/helpers.test.ts src/features/PlatformPluginMarket/localeKeys.test.ts" -m "Tested: bun run type-check"
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
#### Platform Plugin Marketplace P4 Run History Pagination Update

- Status: experimental
- Description: P4 adds client-side pagination for current-user plugin run history using the existing `listRuns` cursor API.
- Maintenance risk: medium
- Test recommendation: add browser smoke for repeated plugin runs and history load-more once a seeded test database is available.
- Note: This slice does not change plugin run authorization, billing, runtime types, database schema, MCP / Skills isolation, or desktop behavior.
```

- [ ] **Step 2: Update changelog**

Add:

```markdown
### Platform Plugin Marketplace P4 Run History Pagination

- Added deduplicated current-user run history page merging.
- Added localized Load more controls for plugin run history.
- Wired plugin detail pages to fetch additional run pages through the existing `listRuns` cursor API.
- Preserved server-side authorization, billing behavior, and MCP / Skills isolation.
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
git commit -m "📝 Document platform plugin P4 run history pagination" -m "Constraint: docs only" -m "Tested: final platform plugin focused verification"
```

---

## Final Review Checklist

- [ ] Run history can load additional pages when `nextCursor` exists.
- [ ] Load-more merge does not duplicate `runId`s.
- [ ] Empty history still renders the existing empty state.
- [ ] New copy exists in default, en-US, and zh-CN subscription locales.
- [ ] No server, database, billing, permission, MCP, Skills, desktop, or ActionTag code changes.
- [ ] Focused tests and `bun run type-check` pass before declaring P4 complete.

