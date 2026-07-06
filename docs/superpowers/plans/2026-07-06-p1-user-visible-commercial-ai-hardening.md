# P1 User Visible Commercial AI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the highest-impact user-visible commercial and AI-provider problems: credit page brand leakage, duplicate model grouping instability, and unclear AI model pricing/capability diagnostics.

**Architecture:** Keep existing TRPC contracts and database schemas. Use existing brand context, model switch data structures, and admin matrix logic. Add narrowly scoped tests first, then minimal implementation changes, then focused verification and review.

**Tech Stack:** Next.js 16, React 19, TypeScript, SWR, TRPC, Vitest, antd-style, @lobehub/ui.

---

## File Structure

- `src/business/client/BusinessSettingPages/Credits.tsx`
  - Use configured brand name instead of hardcoded LobeHub copy.
  - Replace the old recharge-balance tile with a non-duplicative usable balance summary while keeping subscription credits, ledger, and recharge history intact.
- `src/features/Admin/adminCommercialFlow.test.ts`
  - Add source-level regression assertions for the Credits page.
- `src/features/ModelSwitchPanel/utils.ts`
  - Make grouped model item keys stable and provider-aware enough to avoid display-name collisions.
- `src/features/ModelSwitchPanel/utils.test.ts`
  - Add direct tests for grouped item keys.
- `src/features/ModelSwitchPanel/hooks/useBuildListItems.ts`
  - Keep provider grouping as the safe default, preserve provider entries for same model ids from multiple providers, and avoid collapsing different model ids that share a display name.
- `src/features/ModelSwitchPanel/hooks/useBuildListItems.test.ts`
  - Add direct hook tests for duplicate model ids, duplicate display names, and provider grouping.
- `src/features/ModelSwitchPanel/components/List/index.tsx`
  - Use the shared item key helper in the actual rendered list path.
- `src/features/Admin/adminModelBillingMatrix.ts`
  - Distinguish matrix overrides from actual pricing/capability metadata completeness.
- `src/features/Admin/AdminModelBillingMatrixPage.tsx`
  - Display clearer health labels for missing pricing and missing ability metadata.
- `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
  - Return model pricing and ability completeness flags from persisted model metadata for admin matrix diagnostics.
- `src/features/Admin/adminModelBillingMatrix.test.ts`
  - Add focused tests for pricing and ability health summaries/focus.

---

### Task 1: Fix Credits Page Brand And Balance Presentation

**Files:**
- Modify: `src/business/client/BusinessSettingPages/Credits.tsx`
- Modify: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Write failing source-level tests**

Add a test to `adminCommercialFlow.test.ts`:

```typescript
it('uses configured brand copy and keeps usable balance in the credits summary', () => {
  const creditsPage = readRepoFile('src/business/client/BusinessSettingPages/Credits.tsx');

  expect(creditsPage).toContain("import { useBrand } from '@/features/Brand/BrandProvider'");
  expect(creditsPage).toContain('const brand = useBrand();');
  expect(creditsPage).toContain('brand.name');
  expect(creditsPage).toContain('formatCredits(accountSummary?.balance ?? 0)');
  expect(creditsPage).not.toContain('LOBEHUB CLOUD SUBSCRIPTION');
  expect(creditsPage).not.toContain('鍏呭€肩Н鍒嗕綑棰?/div>');
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: fail because the page still has hardcoded LobeHub text and the old recharge-balance label.

- [ ] **Step 3: Implement minimal UI fix**

In `Credits.tsx`:

```typescript
import { useBrand } from '@/features/Brand/BrandProvider';
```

Inside the component:

```typescript
const brand = useBrand();
```

Keep `balanceStats` as a compact two-column summary: usable balance plus subscription credits:

```typescript
grid-template-columns: repeat(2, minmax(0, 1fr));
```

Replace the old recharge-specific label with a usable balance label:

```tsx
<div>
  <div className={subscriptionPageStyles.caption}>可用积分余额</div>
  <div className={styles.bigValue}>{formatCredits(accountSummary?.balance ?? 0)}</div>
</div>
```

Replace the hardcoded subscription label:

```tsx
<div className={subscriptionPageStyles.caption}>{brand.name} Subscription</div>
```

- [ ] **Step 4: Run green test**

Run the same admin commercial flow test. Expected: pass.

---

### Task 2: Stabilize Model Switch Provider Grouping And Keys

**Files:**
- Modify: `src/features/ModelSwitchPanel/utils.ts`
- Create: `src/features/ModelSwitchPanel/utils.test.ts`
- Create: `src/features/ModelSwitchPanel/hooks/useBuildListItems.test.ts`

- [ ] **Step 1: Write failing key tests**

Create `utils.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { getListItemKey } from './utils';
import type { ListItem } from './types';

describe('ModelSwitchPanel utils', () => {
  it('uses provider ids in grouped model item keys', () => {
    const item = {
      data: {
        displayName: 'GPT-4o',
        model: { id: 'gpt-4o' },
        providers: [
          { id: 'provider-a', name: 'Provider A' },
          { id: 'provider-b', name: 'Provider B' },
        ],
      },
      type: 'model-item-multiple',
    } as ListItem;

    expect(getListItemKey(item)).toBe('model:gpt-4o:GPT-4o:provider-a,provider-b');
  });
});
```

- [ ] **Step 2: Write failing grouping tests**

Create `hooks/useBuildListItems.test.ts` with a renderHook test that passes two providers with the same model id and asserts:

```typescript
expect(byProviderItems.filter((item) => item.type === 'provider-model-item')).toHaveLength(2);
expect(byProviderItems.map(getListItemKey)).toContain('provider-a-gpt-4o');
expect(byProviderItems.map(getListItemKey)).toContain('provider-b-gpt-4o');
```

For `byModel`, assert a single `model-item-multiple` with both providers. Add another hook test that passes two models with the same display name and different ids under one provider, and assert both model ids remain visible:

```typescript
expect(result.current.map((item) => item.data.model.id)).toEqual(['chat-model-a', 'chat-model-b']);
```

- [ ] **Step 3: Run red tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/ModelSwitchPanel/utils.test.ts src/features/ModelSwitchPanel/hooks/useBuildListItems.test.ts src/features/ModelSwitchPanel/components/PanelContent.test.tsx
```

Expected: fail because `getListItemKey` currently returns only `displayName`, and `useBuildListItems` groups by display name.

- [ ] **Step 4: Implement stable key fix**

In `utils.ts`, change grouped item keys:

```typescript
const providerKey = item.data.providers.map((provider) => provider.id).join(',');
return `model:${item.data.model.id}:${item.data.displayName}:${providerKey}`;
```

Keep `provider-model-item` keys unchanged, because those are already provider+model based. In `useBuildListItems.ts`, use `modelItem.id` as the `byModel` map key. In `components/List/index.tsx`, replace inline render key generation with `getListItemKey(item)`.

- [ ] **Step 5: Run green tests**

Run the same ModelSwitchPanel test command. Expected: pass.

---

### Task 3: Improve Model Billing Matrix Pricing And Ability Diagnostics

**Files:**
- Modify: `src/features/Admin/adminModelBillingMatrix.ts`
- Modify: `src/features/Admin/AdminModelBillingMatrixPage.tsx`
- Modify: `src/features/Admin/adminModelBillingMatrix.test.ts`
- Modify: `src/features/Admin/adminCommercialFlow.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`

- [ ] **Step 1: Write failing matrix diagnostics tests**

Extend `MatrixSourceModel` fixtures with metadata flags:

```typescript
hasModelAbilities: true,
hasModelPricing: true,
```

Add a test:

```typescript
it('separates pricing overrides from missing provider pricing and ability metadata', () => {
  const rows = buildMatrixRows({
    models: [
      {
        displayName: 'Priced Model',
        hasModelAbilities: true,
        hasModelPricing: true,
        instanceId: 'inst-priced',
        instanceName: 'Priced Gateway',
        modelId: 'priced-model',
        modelType: 'chat',
        priority: 0,
      },
      {
        displayName: 'Missing Metadata Model',
        hasModelAbilities: false,
        hasModelPricing: false,
        instanceId: 'inst-missing',
        instanceName: 'Missing Gateway',
        modelId: 'missing-model',
        modelType: 'chat',
        priority: 1,
      },
    ],
    plans,
    planRulesByPlan: {},
    pricingRules: [{ model: 'priced-model', multiplier: 1.35, provider: 'newapi' }],
  });

  const health = getMatrixConfigHealth({
    defaultModelHealth: getDefaultModelHealth(rows, {}),
    globalPricingMultiplier: 1.35,
    plans,
    rows,
  });

  expect(health.summary).toMatchObject({
    missingAbilityModelCount: 1,
    missingPricingModelCount: 1,
    pricingOverrideCount: 1,
    providerPricingModelCount: 1,
  });
  expect(health.checks.map((check) => check.key)).toContain('missing-model-pricing');
  expect(health.checks.map((check) => check.key)).toContain('missing-model-abilities');
});
```

- [ ] **Step 2: Run red matrix tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminModelBillingMatrix.test.ts
```

Expected: fail because the row and health types do not include pricing/ability completeness.

- [ ] **Step 3: Add matrix metadata fields**

Extend `MatrixSourceModel`:

```typescript
hasModelAbilities?: boolean;
hasModelPricing?: boolean;
```

Extend `MatrixRow`:

```typescript
hasModelAbilities: boolean;
hasModelPricing: boolean;
```

In `buildMatrixRows`, set:

```typescript
hasModelAbilities: sorted.some((item) => item.hasModelAbilities === true),
hasModelPricing: sorted.some((item) => item.hasModelPricing === true),
```

- [ ] **Step 4: Improve health summary**

Replace the old fallback-only logic with:

```typescript
const pricingOverrideCount = rows.filter(
  (row) => Number.isFinite(row.pricingMultiplier) || Number.isFinite(row.creditsPerDollar),
).length;
const providerPricingModelCount = rows.filter((row) => row.hasModelPricing).length;
const providerPricingFallbackRows = rows.filter(
  (row) => !hasPricingOverride(row) && row.hasModelPricing,
);
const missingPricingModels = rows.filter(
  (row) => !row.hasModelPricing && !Number.isFinite(row.pricingMultiplier) && !Number.isFinite(row.creditsPerDollar),
);
const missingAbilityModels = rows.filter((row) => !row.hasModelAbilities);
const pricingFallbackModelCount = rows.length - pricingOverrideCount;
```

Add health checks:

```typescript
if (missingPricingModels.length > 0) {
  checks.push({
    count: missingPricingModels.length,
    key: 'missing-model-pricing',
    severity: 'warning',
    title: 'Some models have no synced or manual pricing',
  });
}

if (missingAbilityModels.length > 0) {
  checks.push({
    count: missingAbilityModels.length,
    key: 'missing-model-abilities',
    severity: 'info',
    title: 'Some models have no explicit capability metadata',
  });
}
```

Keep the existing `pricing-fallbacks` check only as an info signal for non-overridden rows that rely on provider/manual pricing. Missing-pricing rows are covered by `missing-model-pricing` instead of being double-counted as pricing fallbacks.

- [ ] **Step 5: Wire page input, backend metadata flags, and labels**

In `AdminModelBillingMatrixPage.tsx`, extend `EnabledModelItem` and `sourceModels` mapping:

```typescript
hasModelAbilities?: boolean;
hasModelPricing?: boolean;
```

In `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`, select model metadata and map it into completeness flags:

```typescript
metadata: adminNewapiInstanceModels.metadata,
```

```typescript
items: rows.map(({ metadata, ...item }) => ({
  ...item,
  hasModelAbilities: resolveModelAbilityCompleteness(metadata),
  hasModelPricing: resolveModelPricingCompleteness(metadata),
})),
```

`resolveModelPricingCompleteness` returns true when synced pricing exists (`pricingAvailable === true`), NewAPI price ratios exist, or manual pricing contains a positive rate. `resolveModelAbilityCompleteness` returns true when manual ability metadata contains at least one boolean ability flag.

Update summary labels:

```tsx
{t('admin.modelBillingMatrix.healthPricingMissing', 'Missing pricing')}:
{configHealth.summary.missingPricingModelCount}
```

```tsx
{t('admin.modelBillingMatrix.healthAbilitiesMissing', 'Missing abilities')}:
{configHealth.summary.missingAbilityModelCount}
```

- [ ] **Step 6: Run green tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminModelBillingMatrix.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Expected: pass.

---

### Task 4: P1 Verification, Review, And Commit

**Files:**
- All files changed by Tasks 1-3.

- [ ] **Step 1: Run focused verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts src/features/Admin/adminModelBillingMatrix.test.ts src/features/ModelSwitchPanel/utils.test.ts src/features/ModelSwitchPanel/hooks/useBuildListItems.test.ts src/features/ModelSwitchPanel/components/PanelContent.test.tsx
```

- [ ] **Step 2: Run diff checks**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

- [ ] **Step 3: Request multi-agent review**

Dispatch one reviewer for spec compliance against this P1 plan and one reviewer for code quality against the current diff.

- [ ] **Step 4: Fix review findings**

Fix Critical and Important findings. Re-run focused tests after fixes.

- [ ] **Step 5: Commit P1**

Commit only P1 changes:

```powershell
git add -f docs/superpowers/plans/2026-07-06-p1-user-visible-commercial-ai-hardening.md
git add packages/business-server/src/lambda-routers/admin/newapiProviders.ts src/business/client/BusinessSettingPages/Credits.tsx src/features/Admin/adminCommercialFlow.test.ts src/features/ModelSwitchPanel src/features/Admin/adminModelBillingMatrix.ts src/features/Admin/AdminModelBillingMatrixPage.tsx src/features/Admin/adminModelBillingMatrix.test.ts
git commit -m "harden commercial ai user-visible p1" -m "Constraint: preserve existing TRPC contracts and payment-disabled state." -m "Tested: bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts src/features/Admin/adminModelBillingMatrix.test.ts src/features/ModelSwitchPanel/utils.test.ts src/features/ModelSwitchPanel/hooks/useBuildListItems.test.ts src/features/ModelSwitchPanel/components/PanelContent.test.tsx" -m "Scope-risk: Medium; touches user credits, model switch grouping, and admin model billing diagnostics."
```
