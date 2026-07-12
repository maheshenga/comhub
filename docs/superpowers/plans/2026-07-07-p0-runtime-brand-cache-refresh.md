# P0 Runtime Brand Cache Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include the server-side brand cache in the admin runtime cache refresh action.

**Architecture:** Keep the existing admin settings router contract and add the missing brand cache invalidator to the same manual refresh path that already clears app settings, NewAPI instances, and S3 runtime caches. The change is intentionally small: one router mutation, one focused test file, and governance docs.

**Tech Stack:** Next.js 16, TypeScript, tRPC admin router, Vitest.

## Global Constraints

- Do not use subagents for this execution because the user asked to execute directly.
- Use TDD: update the failing test first, run it red, then implement the router change.
- Do not change database schema, public API shape beyond adding `brand` to the existing `refreshed` result, or deployment files.
- Do not deploy or push unless explicitly requested after commit.
- Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md` for the governance record.

---

## File Structure

- Modify `packages/business-server/src/lambda-routers/admin/settings.test.ts`: add the brand invalidator mock/import and update runtime cache refresh expectations.
- Modify `packages/business-server/src/lambda-routers/admin/settings.ts`: call `invalidateServerBrand()` inside `refreshRuntimeCaches` and include `brand` in the audited result.
- Modify `docs/CHANGELOG_INTERNAL.md`: add GOV-026.
- Modify `docs/FEATURE_REGISTRY.md`: add the governance execution note.

## Task 1: Red Test For Brand Cache Refresh

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`

**Interfaces:**
- Consumes: `invalidateServerBrand()` from `@/server/services/brand`.
- Produces: a failing expectation proving `refreshRuntimeCaches` must refresh `brand`.

- [ ] **Step 1: Add the mocked brand invalidator**

```ts
import { invalidateServerBrand } from '@/server/services/brand';

vi.mock('@/server/services/brand', () => ({
  invalidateServerBrand: vi.fn(),
}));
```

- [ ] **Step 2: Update expected refresh domains**

```ts
const expectedRefreshed = ['app-settings', 'newapi-instances', 's3-runtime', 'brand'] as const;
expect(result).toEqual({ ok: true, refreshed: expectedRefreshed });
expect(invalidateServerBrand).toHaveBeenCalledTimes(1);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
bunx vitest run --silent='passed-only' "packages/business-server/src/lambda-routers/admin/settings.test.ts"
```

Expected: FAIL because `refreshRuntimeCaches` does not yet call `invalidateServerBrand()` and does not return `brand`.

## Task 2: Implement Runtime Brand Refresh

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`

**Interfaces:**
- Consumes: existing `invalidateServerBrand()` import.
- Produces: `refreshRuntimeCaches()` returns and audits `['app-settings', 'newapi-instances', 's3-runtime', 'brand']`.

- [ ] **Step 1: Add minimal implementation**

```ts
invalidateServerAppSettings();
invalidateNewapiInstancesCache();
invalidateFileS3RuntimeCache();
invalidateServerBrand();

const refreshed = ['app-settings', 'newapi-instances', 's3-runtime', 'brand'] as const;
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
bunx vitest run --silent='passed-only' "packages/business-server/src/lambda-routers/admin/settings.test.ts"
```

Expected: PASS.

## Task 3: Governance Docs

**Files:**
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing GOV-001..GOV-025 governance note pattern.
- Produces: GOV-026 record for runtime brand cache refresh.

- [ ] **Step 1: Add changelog entry**

```md
- GOV-026: Added server brand cache invalidation to the admin runtime cache refresh action so loading SVG, favicon, and brand config can be refreshed without waiting for the brand TTL.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
```

- [ ] **Step 2: Add registry execution note**

Add one row to the `Governance Execution Notes` table:

```md
| 2026-07-07 | Runtime Brand Cache Refresh | active | GOV-026 added brand cache invalidation to the admin runtime cache refresh path for loading SVG, favicon, and runtime brand config. |
```

## Task 4: Verification, Review, And Commit

**Files:**
- Review all modified files.

- [ ] **Step 1: Run focused tests**

```bash
bunx vitest run --silent='passed-only' "packages/business-server/src/lambda-routers/admin/settings.test.ts"
```

Expected: PASS.

- [ ] **Step 2: Run diff check**

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Review diff locally**

```bash
git diff -- packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
```

Expected: only the intended runtime brand cache refresh and governance notes changed.

- [ ] **Step 4: Commit**

```bash
git add packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md docs/superpowers/plans/2026-07-07-p0-runtime-brand-cache-refresh.md
git commit -m "🛡️ refresh brand runtime cache from admin"
```

Suggested commit body:

```text
Constraint: Keep cache refresh change scoped to admin settings runtime refresh.
Scope-risk: Low; no schema or deployment changes.
Tested: bunx vitest run --silent='passed-only' "packages/business-server/src/lambda-routers/admin/settings.test.ts"
Tested: git diff --check
```

## Self-Review

- Spec coverage: The plan covers the selected P0/P3 brand cache refresh slice, test-first implementation, governance docs, verification, review, and commit.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: `invalidateServerBrand`, `refreshRuntimeCaches`, and `refreshed` names match existing code.
