# P1 Commercial AI Admin Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the highest-risk membership, billing, AI provider, and admin settings paths safer and more predictable before larger UI cleanup.

**Architecture:** Keep the existing TRPC routers and database schemas. Add guard checks and clearer runtime signals at the existing backend boundaries, then add focused regression tests around the affected behavior. Preserve the current user-facing API shapes unless the test explicitly requires a new warning or empty state.

**Tech Stack:** Next.js 16, React 19, TypeScript, TRPC, Drizzle/PostgreSQL, Vitest, pnpm/bun.

---

## File Structure

- `packages/business-server/src/lambda-routers/admin/plans.ts`
  - Owns admin plan mutations. Add delete protection and capability-specific write procedures.
- `packages/business-server/src/lambda-routers/admin/topupPackages.ts`
  - Owns admin top-up package mutations. Add delete protection and capability-specific write procedures.
- `packages/business-server/src/lambda-routers/admin/credits.ts`
  - Owns credit balance mutations. Move write actions to finance capability.
- `packages/business-server/src/lambda-routers/admin/subscriptions.ts`
  - Owns subscription changes. Move write actions to finance capability.
- `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
  - Owns AI provider/model mutations. Move write actions to model-ops capability and improve pricing-sync warnings.
- `packages/business-server/src/lambda-routers/admin/settings.ts`
  - Owns global settings mutations/cache refresh. Move write/maintenance actions to system capability where scoped safely.
- `packages/database/src/models/commercial.ts`
  - Owns public top-up packages. Remove implicit public fallback when admin has configured zero active packages.
- `src/server/services/newapiInstance/catalog.ts`
  - Owns provider catalog/pricing fetch. Return explicit pricing support state without crashing non-NewAPI providers.
- `src/features/ModelSwitchPanel/components/PanelContent.tsx`
  - Owns model switch grouping mode handoff. Keep provider grouping visible for admin-managed duplicate models.
- Tests:
  - `packages/database/src/models/__tests__/commercial.test.ts`
  - `packages/business-server/src/lambda-routers/admin/plans.test.ts`
  - `packages/business-server/src/lambda-routers/admin/topupPackages.test.ts`
  - `packages/business-server/src/lambda-routers/admin/orders.test.ts`
  - `src/server/services/newapiInstance/catalog.test.ts`
  - `src/features/ModelSwitchPanel/hooks/useBuildListItems.test.ts` or nearest existing ModelSwitchPanel test

---

### Task 1: Protect Plan And Top-Up Deletion

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/plans.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/topupPackages.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/plans.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/topupPackages.test.ts`

- [ ] **Step 1: Write failing plan delete tests**

Add tests that call `adminPlansRouter.createCaller(...).delete({ plan })`.

Expected tests:

```typescript
it('blocks deleting a plan with active user snapshots', async () => {
  const db = createDb();
  db.query.userPlanSnapshots.findMany.mockResolvedValueOnce([{ userId: 'user-1' }]);
  vi.mocked(getServerDB).mockResolvedValue(db);

  await expect(
    adminPlansRouter.createCaller({ userId: 'admin-user' } as any).delete({ plan: Plans.Premium }),
  ).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
  });
});
```

Also add a success-path test that `delete(planCatalog)` is called when no active snapshots exist.

- [ ] **Step 2: Write failing top-up delete tests**

Add tests that call `adminTopUpPackagesRouter.createCaller(...).delete({ id })`.

Expected tests:

```typescript
it('blocks deleting a package referenced by active redemption codes', async () => {
  const db = createDb();
  db.query.redemptionCodes.findMany.mockResolvedValueOnce([{ id: 'code-1' }]);
  vi.mocked(getServerDB).mockResolvedValue(db);

  await expect(
    adminTopUpPackagesRouter.createCaller({ userId: 'admin-user' } as any).delete({ id: 'growth' }),
  ).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
  });
});
```

Also add a success-path test that deletes when no redemption code references exist.

- [ ] **Step 3: Run red tests**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/plans.test.ts packages/business-server/src/lambda-routers/admin/topupPackages.test.ts
```

Expected: new tests fail because delete guards do not exist.

- [ ] **Step 4: Implement minimal guards**

In `plans.ts`, before deleting:

```typescript
const activeSnapshots = await ctx.serverDB.query.userPlanSnapshots.findMany({
  columns: { id: true },
  limit: 1,
  where: and(eq(userPlanSnapshots.plan, input.plan), eq(userPlanSnapshots.status, 'active')),
});

if (activeSnapshots.length > 0) {
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: 'Plan is used by active subscriptions. Disable it instead of deleting.',
  });
}
```

In `topupPackages.ts`, before deleting:

```typescript
const activeCodes = await ctx.serverDB.query.redemptionCodes.findMany({
  columns: { id: true },
  limit: 1,
  where: eq(redemptionCodes.topupPackageId, input.id),
});

if (activeCodes.length > 0) {
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: 'Top-up package is referenced by redemption codes. Disable it instead of deleting.',
  });
}
```

- [ ] **Step 5: Run green tests**

Run the same Vitest command. Expected: both files pass.

---

### Task 2: Make Empty Top-Up Package Configuration Honest

**Files:**
- Modify: `packages/database/src/models/commercial.ts`
- Modify: `packages/database/src/models/__tests__/commercial.test.ts`

- [ ] **Step 1: Write failing regression tests**

Change the existing empty DB test to expect an empty list instead of hardcoded defaults:

```typescript
it('returns an empty list when no active top-up packages are configured', async () => {
  const packages = await commercialModel.listTopUpPackages();
  expect(packages).toEqual([]);
});
```

Add a test for inactive-only packages:

```typescript
it('does not fall back to defaults when all configured packages are inactive', async () => {
  await serverDB.insert(topUpPackages).values({
    amount: 50,
    credits: 500 * CREDITS_PER_DOLLAR,
    currency: 'USD',
    displayName: 'Inactive',
    id: 'inactive',
    isActive: false,
    sortOrder: 1,
    validityMonths: 12,
  });

  await expect(commercialModel.listTopUpPackages()).resolves.toEqual([]);
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/commercial.test.ts
```

Expected: the top-up package tests fail because defaults are returned.

- [ ] **Step 3: Implement minimal fallback removal**

In `CommercialModel.listTopUpPackages`, replace:

```typescript
if (rows.length === 0) return DEFAULT_TOP_UP_PACKAGES;
```

with:

```typescript
return rows.map(normalizeTopUpPackageRow);
```

If `DEFAULT_TOP_UP_PACKAGES` becomes unused, remove the constant and any fallback-only usage. If another code path still uses it for legacy order lookup, keep it there but stop using it for the public package list.

- [ ] **Step 4: Run green test**

Run the same commercial model test file. Expected: targeted tests pass.

---

### Task 3: Apply Capability-Specific Admin Write Guards

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/plans.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/topupPackages.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/credits.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/subscriptions.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Tests: existing router tests plus a lightweight capability assertion test if needed

- [ ] **Step 1: Write failing scoped-role tests**

Extend existing router tests with at least these assertions:

```typescript
it('allows finance_admin to save plans', async () => {
  // caller role: finance_admin
  // expected: upsert resolves
});

it('rejects model_ops from saving plans', async () => {
  // caller role: model_ops
  // expected: FORBIDDEN
});

it('allows model_ops to refresh AI provider runtime cache', async () => {
  // caller role: model_ops
  // expected: refreshRuntimeCache resolves
});
```

- [ ] **Step 2: Run red tests**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/plans.test.ts packages/business-server/src/lambda-routers/admin/topupPackages.test.ts packages/business-server/src/lambda-routers/admin/orders.test.ts
```

Expected: scoped-role write tests fail because the routers still require `admin.access`.

- [ ] **Step 3: Implement capability procedures**

Use:

```typescript
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, adminProcedure, router } from '@/libs/trpc/lambda';
```

Apply:

- Finance write:
  - plan create/update/delete/setActive/setModelRules
  - top-up create/update/delete/setActive
  - credits adjust
  - subscriptions assign/force/approve/reject/bulk decisions
- Model ops write:
  - AI provider instance/model create/update/delete/toggle/sync/refresh
- System write:
  - settings mutation/cache refresh/maintenance operations
- Keep read-only list/detail endpoints as `adminProcedure` for now unless a test covers read-role behavior.

- [ ] **Step 4: Run green tests**

Run the router test command again. Expected: targeted tests pass.

---

### Task 4: Improve AI Pricing Sync Diagnostics Without Breaking Non-NewAPI Providers

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
- Modify: `src/server/services/newapiInstance/catalog.ts`
- Modify: `src/server/services/newapiInstance/catalog.test.ts`

- [ ] **Step 1: Write failing diagnostics tests**

Add or update catalog/router tests so:

```typescript
await expect(fetchNewapiPricing({
  apiKey: 'sk-test',
  baseUrl: 'https://siliconflow.example.com',
  providerType: 'siliconflow',
})).resolves.toEqual([]);
```

And the router warning for unsupported pricing sync includes:

```typescript
'Pricing sync is not supported for provider type siliconflow. Configure manual pricing in the model billing matrix.'
```

- [ ] **Step 2: Run red tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/server/services/newapiInstance/catalog.test.ts
```

Expected: warning assertions fail until implemented.

- [ ] **Step 3: Implement diagnostics**

Keep `fetchNewapiPricing` returning `[]` for unsupported provider types, but make `buildPricingSyncWarnings` return a clear unsupported warning for non-NewAPI provider types.

Expected implementation shape:

```typescript
const buildPricingSyncWarnings = (providerType: string | null | undefined, pricingCount: number) => {
  if (!supportsPricingSync(providerType)) {
    return [
      `Pricing sync is not supported for provider type ${providerType}. Configure manual pricing in the model billing matrix.`,
    ];
  }

  return pricingCount === 0 ? ['Pricing endpoint unavailable or empty'] : [];
};
```

Also fix any corrupted JSON error strings touched in `catalog.ts` while preserving behavior.

- [ ] **Step 4: Run green tests**

Run the same catalog tests. Expected: pass.

---

### Task 5: Preserve Provider Grouping For Duplicate Admin-Managed Models

**Files:**
- Modify: `src/features/ModelSwitchPanel/components/PanelContent.tsx`
- Test: nearest existing ModelSwitchPanel hook/component test

- [ ] **Step 1: Write failing test or static assertion**

Cover that non-dev rendering does not force `groupMode` to `byModel` when the store default is `byProvider`.

Expected assertion:

```typescript
expect(source).not.toContain("groupMode={isDevMode ? groupMode : 'byModel'}");
```

Prefer a real component test if one already exists and is cheap to extend.

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/ModelSwitchPanel
```

Expected: the new assertion fails.

- [ ] **Step 3: Implement grouping fix**

Change `PanelContent.tsx` so the list receives the actual `groupMode` instead of forcing `byModel` in non-dev mode:

```tsx
groupMode={groupMode}
```

Keep `showGroupModeSwitch={isDevMode}` if the UI intentionally hides the switch outside dev.

- [ ] **Step 4: Run green test**

Run the same ModelSwitchPanel test target. Expected: pass.

---

### Task 6: Verification, Review, And Commit

**Files:**
- All modified files from Tasks 1-5.

- [ ] **Step 1: Run targeted verification**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/plans.test.ts packages/business-server/src/lambda-routers/admin/topupPackages.test.ts packages/business-server/src/lambda-routers/admin/orders.test.ts src/server/services/newapiInstance/catalog.test.ts src/features/ModelSwitchPanel
```

Run commercial database model test if feasible:

```powershell
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/commercial.test.ts
```

- [ ] **Step 2: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git diff
```

Confirm:
- No unrelated files changed.
- No hard-coded secrets added.
- Admin write guards use the intended capability.
- Public top-up package empty state no longer falls back to defaults.
- AI pricing warnings are explicit for unsupported provider types.

- [ ] **Step 3: Commit**

Commit only P1 changes:

```powershell
git add docs/superpowers/plans/2026-07-06-p1-commercial-ai-admin-hardening.md packages/business-server/src/lambda-routers/admin packages/database/src/models/commercial.ts packages/database/src/models/__tests__/commercial.test.ts src/server/services/newapiInstance src/features/ModelSwitchPanel
git commit -m "harden commercial ai admin p1"
```

Commit body trailers:

```text
Constraint: preserve existing TRPC shapes and admin UI routes
Tested: <commands that passed>
Not-tested: <commands skipped with reason>
```

