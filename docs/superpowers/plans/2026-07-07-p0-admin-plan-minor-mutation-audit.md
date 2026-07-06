# Admin Plan Minor Mutation Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add before/after plan-catalog snapshots to `setActive` and `setModelRules` audit logs.

**Architecture:** Reuse the normalized plan-catalog audit snapshot helper created for plan update/delete. Each minor mutation reads the current plan row, builds an after snapshot with the requested field patched, performs the existing DB update, then records the old payload plus `before` and `after`.

**Tech Stack:** TypeScript, tRPC router, Drizzle query builder, Vitest.

## Global Constraints

- Do not change external inputs or outputs for `setActive` or `setModelRules`.
- Do not change plan catalog schema.
- Keep the slice limited to audit payloads for these two existing mutations.
- Follow TDD: write failing tests before production changes.
- Do not use subagents for this execution because the user explicitly asked to execute directly.

---

## File Structure

- Modify: `packages/business-server/src/lambda-routers/admin/plans.ts`
  - Responsibility: perform admin plan catalog mutations and record audit entries.
- Modify: `packages/business-server/src/lambda-routers/admin/plans.test.ts`
  - Responsibility: verify `setActive` and `setModelRules` audit payloads include `before` and `after` snapshots.
- Modify: `docs/CHANGELOG_INTERNAL.md`
  - Responsibility: record the governance change as `GOV-031`.
- Modify: `docs/FEATURE_REGISTRY.md`
  - Responsibility: update governance execution notes.

## Task 1: Add snapshots to setActive and setModelRules audits

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/plans.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/plans.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing mutation inputs.
- Produces: unchanged mutation results `{ ok: true }`.
- Produces: audit payloads:
  - `plan.setActive`: `{ isActive, before, after }`
  - `plan.setModelRules`: `{ modelRules, before, after }`

- [ ] **Step 1: Write failing tests**

Add two focused tests to `packages/business-server/src/lambda-routers/admin/plans.test.ts`:

- `records before and after snapshots when toggling plan active state`
- `records before and after snapshots when updating plan model rules`

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/plans.test.ts"
```

Expected: FAIL because current payloads only include the changed field.

- [ ] **Step 3: Implement minimal production change**

In `packages/business-server/src/lambda-routers/admin/plans.ts`:

- In `setModelRules`, fetch `existing` plan row first; throw `NOT_FOUND` if missing; build `after` with patched `modelRules`.
- In `setActive`, fetch `existing` plan row first; throw `NOT_FOUND` if missing; build `after` with patched `isActive`.
- Keep the existing DB update operations and old payload fields.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/plans.test.ts"
```

- [ ] **Step 5: Update governance docs**

Add `GOV-031` to `docs/CHANGELOG_INTERNAL.md` and `docs/FEATURE_REGISTRY.md`.

- [ ] **Step 6: Verify and review**

Run:

```powershell
git diff --check
bunx eslint "packages/business-server/src/lambda-routers/admin/plans.ts" "packages/business-server/src/lambda-routers/admin/plans.test.ts"
```

- [ ] **Step 7: Commit**

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-admin-plan-minor-mutation-audit.md
git add packages/business-server/src/lambda-routers/admin/plans.ts packages/business-server/src/lambda-routers/admin/plans.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":memo: audit plan minor mutations with snapshots" -m "Constraint: keep P0-09 slice scoped to plan setActive and setModelRules audit payloads." -m "Tested: cd packages/business-server; bunx vitest run --silent=passed-only src/lambda-routers/admin/plans.test.ts" -m "Tested: git diff --check"
```

## Self-Review

- Spec coverage: covers the two remaining plan catalog mutations not handled by GOV-030.
- Placeholder scan: no placeholders.
- Type consistency: reuses `before` and `after` names established in GOV-029/GOV-030.
