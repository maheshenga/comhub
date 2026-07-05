# P3 Commercial Cycle Billing Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the user-facing Plans, Credits, and Billing pages reflect only real admin/backend configuration instead of showing estimated purchase modes or fake online-payment flows.

**Architecture:** Keep the existing commercial database schema and TRPC routers. Move cycle availability and price presentation rules into `plansDisplay.ts`, then let Plans/Billing/Credits consume those rules. This P3 does not add a real payment gateway; it makes the current no-gateway state explicit and routes upgrade actions to the configured Plans page.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, SWR, antd, Vitest focused tests, existing commercial TRPC services.

---

### Task 1: Make Plan Billing Cycles Configuration-Driven

**Files:**
- Modify: `src/business/client/BusinessSettingPages/plansDisplay.ts`
- Test: `src/business/client/BusinessSettingPages/plansDisplay.test.ts`

- [ ] **Step 1: Write failing tests for cycle availability**

Update the import in `plansDisplay.test.ts`:

```typescript
import {
  PLAN_DISPLAY_CURRENCY,
  formatPlanCurrencyAmount,
  getAvailableBillingCycles,
  getPlanYearlyDiscountPercent,
  getVisiblePaidPlans,
  getYearlyCycleDiscountLabel,
  resolvePlanCyclePrice,
} from './plansDisplay';
```

Add these tests:

```typescript
it('uses USD as the display fallback currency to match backend pricing defaults', () => {
  expect(PLAN_DISPLAY_CURRENCY).toBe('USD');
  expect(formatPlanCurrencyAmount(29)).toContain('29');
});

it('derives billing cycle tabs from configured catalog prices', () => {
  expect(
    getAvailableBillingCycles([
      { monthlyPrice: 59, yearlyPrice: 590 },
      { monthlyPrice: 99, yearlyPrice: 950 },
    ]),
  ).toEqual(['yearly', 'monthly']);

  expect(
    getAvailableBillingCycles([
      { lifetimePrice: 999, monthlyPrice: 59, oneTimePrice: 499, yearlyPrice: 590 },
    ]),
  ).toEqual(['yearly', 'monthly', 'one_time', 'lifetime']);

  expect(getAvailableBillingCycles([])).toEqual(['yearly', 'monthly']);
});

it('does not estimate one-time or lifetime prices when they are not configured', () => {
  const oneTime = resolvePlanCyclePrice(
    { currency: 'USD', monthlyPrice: 59, yearlyPrice: 590 },
    'one_time',
  );
  const lifetime = resolvePlanCyclePrice(
    { currency: 'USD', monthlyPrice: 59, yearlyPrice: 590 },
    'lifetime',
  );

  expect(oneTime.amount).toBe(0);
  expect(oneTime.isAvailable).toBe(false);
  expect(oneTime.secondaryLabel).toContain('未配置');
  expect(lifetime.amount).toBe(0);
  expect(lifetime.isAvailable).toBe(false);
  expect(lifetime.secondaryLabel).toContain('未配置');
});
```

Replace the old fallback-estimate test:

```typescript
it('resolves one-time prices from monthly catalog prices until dedicated prices exist', () => {
  // remove this test because P3 must not display fake one-time prices
});
```

- [ ] **Step 2: Run red tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/BusinessSettingPages/plansDisplay.test.ts
```

Expected: fail because `getAvailableBillingCycles` does not exist, fallback currency is still `CNY`, and one-time/lifetime still estimate prices.

- [ ] **Step 3: Implement the helper contract**

In `plansDisplay.ts`:

```typescript
export const PLAN_DISPLAY_CURRENCY = 'USD';

const hasPositivePrice = (value: unknown) => Number(value ?? 0) > 0;

export const getAvailableBillingCycles = (
  planCatalog: Array<PlanPriceCatalogLike> | null | undefined,
): PlanDisplayBillingCycle[] => {
  const plans = planCatalog ?? [];
  const hasYearly = plans.length === 0 || plans.some((item) => hasPositivePrice(item.yearlyPrice));
  const hasMonthly = plans.length === 0 || plans.some((item) => hasPositivePrice(item.monthlyPrice));
  const cycles: PlanDisplayBillingCycle[] = [];

  if (hasYearly) cycles.push('yearly');
  if (hasMonthly) cycles.push('monthly');
  if (plans.some((item) => hasPositivePrice(item.oneTimePrice))) cycles.push('one_time');
  if (plans.some((item) => hasPositivePrice(item.lifetimePrice))) cycles.push('lifetime');

  return cycles.length > 0 ? cycles : ['yearly', 'monthly'];
};
```

In `resolvePlanCyclePrice`, change `one_time` and `lifetime` so they only use configured values:

```typescript
case 'one_time': {
  return build({
    amount: oneTimePrice,
    secondaryLabel: oneTimePrice > 0 ? '一次性支付' : '暂未配置一次性价格',
    unit: '一次性',
  });
}

case 'lifetime': {
  return build({
    amount: lifetimePrice,
    secondaryLabel: lifetimePrice > 0 ? '终身权益价格' : '暂未配置终身价格',
    unit: '终身',
  });
}
```

Keep yearly/monthly behavior intact.

- [ ] **Step 4: Run green tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/BusinessSettingPages/plansDisplay.test.ts
```

Expected: pass.

### Task 2: Wire Dynamic Billing Cycles Into Plans Page

**Files:**
- Modify: `src/business/client/BusinessSettingPages/Plans.tsx`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Add source-level coverage**

In `adminCommercialFlow.test.ts`, inside the public plans page assertion, add:

```typescript
expect(publicPlansPage).toContain('getAvailableBillingCycles');
expect(publicPlansPage).toContain('availableBillingCycles.map');
expect(publicPlansPage).toContain('activeBillingCycle');
expect(publicPlansPage).toContain('!price.isAvailable');
```

- [ ] **Step 2: Run the focused red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: fail because Plans still hardcodes all cycle options and does not disable unavailable prices.

- [ ] **Step 3: Implement dynamic cycle options**

In `Plans.tsx`, import `getAvailableBillingCycles`:

```typescript
import {
  getAvailableBillingCycles,
  getPlanYearlyDiscountLabel,
  getVisiblePaidPlans,
  getYearlyCycleDiscountLabel,
  resolvePlanCyclePrice,
} from './plansDisplay';
```

Add:

```typescript
const availableBillingCycles = useMemo(
  () => getAvailableBillingCycles(planCatalog),
  [planCatalog],
);
const activeBillingCycle = availableBillingCycles.includes(billingCycle)
  ? billingCycle
  : (availableBillingCycles[0] ?? 'monthly');
```

Replace the hardcoded `Segmented` options with `availableBillingCycles.map`:

```tsx
options={availableBillingCycles.map((cycle) => ({
  label:
    cycle === 'yearly' ? (
      <Flexbox horizontal align="center" gap={8}>
        按年
        {yearlyCycleDiscountLabel ? (
          <Tag color="green" style={{ margin: 0 }}>
            {yearlyCycleDiscountLabel}
          </Tag>
        ) : null}
      </Flexbox>
    ) : cycle === 'monthly' ? (
      '按月'
    ) : cycle === 'one_time' ? (
      '一次性'
    ) : (
      '终身'
    ),
  value: cycle,
}))}
value={activeBillingCycle}
onChange={(value: string | number) => setBillingCycle(value as BillingCycle)}
```

Use `activeBillingCycle` for `resolvePlanCyclePrice` and `getSubscriptionCycleTranslationKey`.

Disable upgrade action when the selected cycle has no real price:

```tsx
<Button
  block
  className={styles.action}
  disabled={!price.isAvailable}
  icon={<Icon icon={ChevronRight} />}
  type="primary"
  onClick={() => handleUpgradeClick(catalogPlan)}
>
  {price.isAvailable ? '升级' : '暂未配置'}
</Button>
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts src/business/client/BusinessSettingPages/plansDisplay.test.ts
```

Expected: pass.

### Task 3: Clarify Billing Page Amount, Dates, And Actions

**Files:**
- Modify: `src/business/client/BusinessSettingPages/Billing.tsx`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Add source-level coverage**

Add a billing page assertion to `adminCommercialFlow.test.ts`:

```typescript
it('keeps billing page actions and cycle dates aligned with configured plans', () => {
  const billingPage = readRepoFile('src/business/client/BusinessSettingPages/Billing.tsx');

  expect(billingPage).toContain('subscriptionSummary?.cycle');
  expect(billingPage).toContain('subscriptionSummary?.renewsAt');
  expect(billingPage).toContain('subscriptionSummary?.endsAt');
  expect(billingPage).toContain('href="/settings/plans"');
  expect(billingPage).toContain('套餐变更记录');
  expect(billingPage).not.toContain('发票');
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: fail because Billing does not show cycle/dates and upgrade buttons have no destination.

- [ ] **Step 3: Implement billing UX corrections**

In `Billing.tsx`:
- Keep the amount value from `subscriptionSummary?.monthlyPrice` because backend snapshots store the selected cycle amount in that field.
- Label it as current cycle amount with the translated cycle.
- Show `startedAt`, `renewsAt`, and `endsAt` rows.
- Change upgrade buttons to link to `/settings/plans`.
- Keep the history section named "套餐变更记录", not invoice history.

Use:

```tsx
const cycleLabel = t(getSubscriptionCycleTranslationKey(subscriptionSummary?.cycle));
const nextDate = subscriptionSummary?.renewsAt ?? subscriptionSummary?.endsAt;
```

Add date captions:

```tsx
<div className={subscriptionPageStyles.caption}>
  周期：{cycleLabel}
</div>
<div className={subscriptionPageStyles.caption}>
  开始时间：{formatBusinessDate(subscriptionSummary?.startedAt)}
</div>
<div className={subscriptionPageStyles.caption}>
  续费/结束时间：{formatBusinessDate(nextDate)}
</div>
```

Use:

```tsx
<Button href="/settings/plans" size="small" type="link">
  升级计划
</Button>
```

and:

```tsx
<Button href="/settings/plans" type="primary">
  升级
</Button>
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: pass.

### Task 4: Make Credits Top-Up State Honest

**Files:**
- Modify: `src/business/client/BusinessSettingPages/Credits.tsx`
- Modify: `src/features/Admin/AdminTopUpPackagesPage.tsx`
- Modify: `src/routes/(main)/admin/plans/index.tsx`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Add source-level coverage**

Add assertions:

```typescript
it('keeps credits top-up purchase state honest while online payment is unavailable', () => {
  const creditsPage = readRepoFile('src/business/client/BusinessSettingPages/Credits.tsx');
  const adminTopupPage = readRepoFile('src/features/Admin/AdminTopUpPackagesPage.tsx');
  const adminPlansPage = readRepoFile('src/routes/(main)/admin/plans/index.tsx');

  expect(creditsPage).toContain('isPaidPlan(currentPlan)');
  expect(creditsPage).toContain('href="/settings/plans"');
  expect(creditsPage).toContain('在线支付暂未接入');
  expect(adminTopupPage).toContain("currency: 'USD'");
  expect(adminTopupPage).toContain("values.currency || 'USD'");
  expect(adminPlansPage).toContain('留空时前台不展示');
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: fail because Credits does not branch on paid plan and admin top-up defaults to `CNY`.

- [ ] **Step 3: Implement Credits page gating**

In `Credits.tsx`, import `isPaidPlan`:

```typescript
  isPaidPlan,
```

Add:

```typescript
const canPurchaseTopUp = isPaidPlan(currentPlan);
```

Replace `handleSubscribeFirst` with:

```typescript
const handleTopUpAction = () => {
  if (!canPurchaseTopUp) {
    message.info('积分充值仅对付费套餐开放，请先升级会员套餐。');
    return;
  }

  message.info('在线支付暂未接入，请联系管理员充值，或使用兑换码发放积分。');
};
```

For the main top-up button:

```tsx
<Button
  href={canPurchaseTopUp ? undefined : '/settings/plans'}
  icon={<Icon icon={ShoppingCart} />}
  type={'primary'}
  onClick={canPurchaseTopUp ? handleTopUpAction : undefined}
>
  {canPurchaseTopUp ? '联系管理员充值' : '升级会员'}
</Button>
```

For the auto top-up card, use the same logic and avoid implying auto-payment exists.

- [ ] **Step 4: Align admin defaults and hints**

In `AdminTopUpPackagesPage.tsx`, change new package and save fallbacks from `CNY` to `USD`:

```typescript
currency: 'USD',
```

and:

```typescript
currency: values.currency || 'USD',
```

In `src/routes/(main)/admin/plans/index.tsx`, update one-time/lifetime field hints so admins know blank values will hide the cycle:

```tsx
extra={t('admin.plans.field.oneTimeHint', '留空时前台不展示一次性周期。')}
```

```tsx
extra={t('admin.plans.field.lifetimeHint', '留空时前台不展示终身周期。')}
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts src/business/client/BusinessSettingPages/plansDisplay.test.ts
```

Expected: pass.

### Task 5: Review, Verify, Commit

**Files:**
- Verify only unless a review issue is found.

- [ ] **Step 1: Run P3 focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/BusinessSettingPages/plansDisplay.test.ts src/business/client/BusinessSettingPages/planPurchase.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Run P2 smoke tests to guard related settings:

```powershell
bunx vitest run --silent='passed-only' src/const/billingPresentation.test.ts src/features/Admin/adminSettingsForm.test.ts
```

- [ ] **Step 2: Run diff checks**

Run:

```powershell
git diff --check
git status --short --branch
```

- [ ] **Step 3: Review locally**

Check:
- Plans does not show one-time/lifetime tabs unless at least one active configured plan has those prices.
- Plans does not compute fake one-time/lifetime prices from monthly price.
- Billing page does not call change history "invoice history".
- Credits page does not imply online payment is active.
- Admin default currencies are consistent with backend `USD` defaults, while existing configured row currency still wins.

- [ ] **Step 4: Commit**

Use:

```powershell
git add -f docs/superpowers/plans/2026-07-06-p3-commercial-cycle-billing-credits.md
git add src/business/client/BusinessSettingPages/plansDisplay.ts src/business/client/BusinessSettingPages/plansDisplay.test.ts src/business/client/BusinessSettingPages/Plans.tsx src/business/client/BusinessSettingPages/Billing.tsx src/business/client/BusinessSettingPages/Credits.tsx src/features/Admin/adminCommercialFlow.test.ts src/features/Admin/AdminTopUpPackagesPage.tsx 'src/routes/(main)/admin/plans/index.tsx'
git commit -m "✨ Align commercial billing cycle and credit purchase UX" -m "Constraint: Do not add a payment gateway; show only configured cycles and current no-payment state." -m "Tested: bunx vitest run --silent='passed-only' src/business/client/BusinessSettingPages/plansDisplay.test.ts src/business/client/BusinessSettingPages/planPurchase.test.ts src/features/Admin/adminCommercialFlow.test.ts" -m "Tested: bunx vitest run --silent='passed-only' src/const/billingPresentation.test.ts src/features/Admin/adminSettingsForm.test.ts" -m "Scope-risk: Medium; touches public commercial pages and admin defaults only."
```
