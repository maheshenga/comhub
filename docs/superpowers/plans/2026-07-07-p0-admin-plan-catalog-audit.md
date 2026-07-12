# Admin Plan Catalog Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add before/after plan-catalog snapshots to admin plan create/update/delete audit logs.

**Architecture:** Keep this as a narrow P0-09 slice for `adminPlansRouter.upsert` and `adminPlansRouter.delete`. The router continues to use the existing DB writes and external API contracts; audit payloads gain normalized snapshots that are safe to store in JSON and useful for rollback review.

**Tech Stack:** TypeScript, tRPC router, Drizzle query builder, Vitest.

## Global Constraints

- Do not change the external input/output contract of `adminPlansRouter.upsert` or `adminPlansRouter.delete`.
- Do not change plan catalog schema or subscription assignment behavior.
- Do not change `setActive` or `setModelRules` in this slice.
- Follow TDD: write failing audit-payload tests before production changes.
- Keep the change independently revertible.
- Do not use subagents for this execution because the user explicitly asked to execute directly.

---

## File Structure

- Modify: `packages/business-server/src/lambda-routers/admin/plans.ts`
  - Responsibility: perform admin plan catalog mutations and record audit entries.
- Modify: `packages/business-server/src/lambda-routers/admin/plans.test.ts`
  - Responsibility: verify plan update/delete audit payloads include normalized `before` and `after` snapshots.
- Modify: `docs/CHANGELOG_INTERNAL.md`
  - Responsibility: record the governance change as `GOV-030`.
- Modify: `docs/FEATURE_REGISTRY.md`
  - Responsibility: update governance execution notes for the plan catalog audit slice.

## Task 1: Add plan catalog audit snapshots for update and delete

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/plans.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/plans.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing plan catalog mutation inputs.
- Produces: unchanged mutation result `{ ok: true }`.
- Produces: audit payloads:
  - `plan.update`: `{ before, after, activeUserCount, quotaUpdate }`
  - `plan.create`: `{ before: null, after, activeUserCount, quotaUpdate }`
  - `plan.delete`: `{ before, after: null }`

- [ ] **Step 1: Write failing tests**

Update `packages/business-server/src/lambda-routers/admin/plans.test.ts`:

- Add a `planCatalogRow` option to `createDb`.
- Assert `upsert` audit payload contains `before`, `after`, `activeUserCount`, and `quotaUpdate`.
- Assert `delete` audit payload contains `before` and `after: null`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/plans.test.ts"
```

Expected: FAIL because current audit payloads do not include `before`/`after`.

- [ ] **Step 3: Implement minimal production change**

In `packages/business-server/src/lambda-routers/admin/plans.ts`:

- Add a small `toPlanCatalogAuditSnapshot` helper that returns only:
  - `plan`
  - `displayName`
  - `monthlyCredits`
  - `monthlyPrice`
  - `yearlyPrice`
  - `currency`
  - `features`
  - `isActive`
  - `sortOrder`
  - `modelRules`
  - `metadata`
- In `delete`, read the current plan catalog row before deletion and put it in audit payload as `before`; set `after: null`.
- In `upsert`, convert `existing` into `before`; build `after` from the normalized payload written to DB; include `activeUserCount` and `quotaUpdate`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/plans.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Update governance docs**

Add `GOV-030` to `docs/CHANGELOG_INTERNAL.md` and add a governance execution note to `docs/FEATURE_REGISTRY.md`.

- [ ] **Step 6: Verify and review**

Run:

```powershell
git diff --check
bunx eslint "packages/business-server/src/lambda-routers/admin/plans.ts" "packages/business-server/src/lambda-routers/admin/plans.test.ts"
```

Expected: all exit 0.

- [ ] **Step 7: Commit**

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-admin-plan-catalog-audit.md
git add packages/business-server/src/lambda-routers/admin/plans.ts packages/business-server/src/lambda-routers/admin/plans.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":memo: audit plan catalog mutations with snapshots" -m "Constraint: keep P0-09 slice scoped to plan catalog upsert and delete audit payloads." -m "Tested: cd packages/business-server; bunx vitest run --silent=passed-only src/lambda-routers/admin/plans.test.ts" -m "Tested: git diff --check"
```

## Self-Review

- Spec coverage: covers P0-09 plan catalog create/update/delete audit snapshots; `setActive` and `setModelRules` remain for a later smaller slice.
- Placeholder scan: no placeholders.
- Type consistency: `before` and `after` field names match the previous credit adjustment audit pattern.
