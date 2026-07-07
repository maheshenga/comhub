# Admin Settings Cache Sync Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured audit metadata to admin settings cache refresh and user default sync operations.

**Architecture:** Keep the existing mutation inputs and return values unchanged. Enrich only the audit payloads with stable operation names, success status, requested scope, and per-domain cache refresh results so future production investigations can distinguish "admin clicked refresh" from "which runtime domains were refreshed".

**Tech Stack:** TypeScript, tRPC router, Vitest.

## Global Constraints

- Do not change public mutation inputs or outputs.
- Preserve existing audit payload fields such as `refreshed`, `syncedFields`, `syncedUsers`, and `forceDefaultAgentMeta`.
- Keep the slice limited to admin settings cache/default sync audit metadata.
- Follow TDD: write failing tests before production changes.
- Do not use subagents for this execution because the user explicitly asked to execute directly.

---

## File Structure

- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
  - Responsibility: perform admin settings mutations and record audit entries.
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
  - Responsibility: verify cache refresh and default sync audit payloads include structured metadata.
- Modify: `docs/CHANGELOG_INTERNAL.md`
  - Responsibility: record the governance change as `GOV-032`.
- Modify: `docs/FEATURE_REGISTRY.md`
  - Responsibility: update governance execution notes.

## Task 1: Add structured audit metadata to cache refresh and default sync

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing `refreshRuntimeCaches` mutation input.
- Consumes: existing `syncUserGlobalSettingsDefaultsToUsers` mutation input.
- Produces: unchanged `refreshRuntimeCaches` result `{ ok: true, refreshed }`.
- Produces: unchanged sync result `{ ok: true, syncedFields, syncedUsers, forceDefaultAgentMeta? }`.
- Produces: enriched audit payloads with:
  - `operation`
  - `status: 'success'`
  - `requestedDomains` for cache refresh
  - `results` for cache refresh
  - `scope` for user default sync

- [ ] **Step 1: Write failing tests**

Update `packages/business-server/src/lambda-routers/admin/settings.test.ts`:

- `refreshes runtime caches on admin request` should expect `operation`, `status`, `requestedDomains`, and per-domain `results`.
- `syncs backend global settings defaults into all user settings` should expect `operation`, `status`, and `scope`.
- `records explicit force-sync when admin overwrites user default assistant meta` should keep asserting `forceDefaultAgentMeta: true` and also expect the new metadata.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/settings.test.ts"
```

Expected: FAIL because the current audit payloads do not include the new structured metadata.

- [ ] **Step 3: Implement minimal production change**

In `packages/business-server/src/lambda-routers/admin/settings.ts`:

- Add a local `runtimeCacheRefreshResults` value for the four existing cache domains.
- Build `refreshed` from that value to avoid payload drift.
- Add `operation: 'refreshRuntimeCaches'`, `status: 'success'`, `requestedDomains`, and `results` to the cache refresh audit payload.
- Add `operation: 'syncUserGlobalSettingsDefaultsToUsers'`, `status: 'success'`, and `scope` to the user default sync audit payload.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/settings.test.ts"
```

- [ ] **Step 5: Update governance docs**

Add `GOV-032` to `docs/CHANGELOG_INTERNAL.md` and `docs/FEATURE_REGISTRY.md`.

- [ ] **Step 6: Verify and review**

Run:

```powershell
git diff --check
bunx eslint "packages/business-server/src/lambda-routers/admin/settings.ts" "packages/business-server/src/lambda-routers/admin/settings.test.ts"
```

- [ ] **Step 7: Commit**

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-admin-settings-cache-sync-audit.md
git add packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":memo: audit settings cache sync operations" -m "Constraint: keep P0-09 slice scoped to admin settings cache/default sync audit payloads." -m "Tested: cd packages/business-server; bunx vitest run --silent=passed-only src/lambda-routers/admin/settings.test.ts" -m "Tested: git diff --check"
```

## Self-Review

- Spec coverage: covers P0-09-4 cache sync integration and keeps existing admin sync behavior unchanged.
- Placeholder scan: no placeholders.
- Type consistency: uses `before` and `after` only where snapshots exist; cache refresh uses `requestedDomains` and `results` instead.
