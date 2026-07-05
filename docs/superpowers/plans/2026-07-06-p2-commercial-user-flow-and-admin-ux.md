# P2 Commercial User Flow And Admin UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the next commercial-system slice by making user-facing plan FAQ content admin-configurable, tightening plan/top-up presentation, and aligning tests with the upstream-style Plans/Credits pages.

**Architecture:** Keep plan catalog, model access, and package pricing in their existing routers and tables. Add FAQ presentation as a lightweight `app_settings` value so it can be edited without schema migration, then expose it through the existing subscription TRPC surface used by user-facing commercial pages.

**Tech Stack:** Next.js 16 SPA routes, React 19, TypeScript, TRPC lambda routers, Drizzle/PostgreSQL app settings, Vitest focused tests.

---

### Task 1: Add Plan FAQ Presentation Contract

**Files:**
- Modify: `src/const/billingPresentation.ts`
- Modify: `src/const/appSettingsRegistry.ts`
- Test: `src/const/billingPresentation.test.ts`

- [ ] **Step 1: Write the failing normalization test**

Add a test case that proves FAQ content is normalized, empty rows are removed, duplicate ids are made unique, and default FAQ rows are available when no admin value is configured:

```typescript
import {
  DEFAULT_PLAN_FAQ_ITEMS,
  normalizePlanFaqItems,
  normalizePlanCatalogPresentation,
  normalizeTopUpPackagePromotion,
} from './billingPresentation';

it('normalizes configurable plan FAQ items', () => {
  expect(
    normalizePlanFaqItems([
      { id: 'credits', question: ' What are credits? ', answer: ' Usage units. ', enabled: true },
      { id: 'credits', question: ' Duplicate ', answer: ' Still visible ', enabled: true },
      { id: 'blank', question: '', answer: 'hidden', enabled: true },
      { id: 'disabled', question: 'Disabled', answer: 'Hidden', enabled: false },
    ]),
  ).toEqual([
    { answer: 'Usage units.', enabled: true, id: 'credits', question: 'What are credits?' },
    { answer: 'Still visible', enabled: true, id: 'credits-2', question: 'Duplicate' },
  ]);

  expect(normalizePlanFaqItems(null)).toEqual(DEFAULT_PLAN_FAQ_ITEMS);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
bunx vitest run --silent='passed-only' src/const/billingPresentation.test.ts
```

Expected: fail because `DEFAULT_PLAN_FAQ_ITEMS` and `normalizePlanFaqItems` do not exist.

- [ ] **Step 3: Implement the FAQ contract**

Add the following type and helpers to `src/const/billingPresentation.ts`:

```typescript
export type PlanFaqItem = {
  answer: string;
  enabled: boolean;
  id: string;
  question: string;
};

export const DEFAULT_PLAN_FAQ_ITEMS: PlanFaqItem[] = [
  {
    answer: '可以。免费套餐可使用基础额度；升级后可获得更多积分、容量和高级模型权限。',
    enabled: true,
    id: 'free',
    question: '可以免费使用吗？',
  },
  {
    answer: '积分用于衡量模型调用、生成与部分高级能力的消耗，具体扣费以后台模型与计费矩阵为准。',
    enabled: true,
    id: 'credits',
    question: '什么是积分？',
  },
  {
    answer: '订阅积分会优先消耗，之后使用充值积分。积分不足时可以升级套餐、充值积分或使用兑换码。',
    enabled: true,
    id: 'topup',
    question: '积分用完怎么办？',
  },
  {
    answer: '套餐价格、年付优惠、权益、模型权限和购买链接均由管理员在后台维护。',
    enabled: true,
    id: 'admin',
    question: '套餐权益由哪里配置？',
  },
];

const normalizeFaqId = (value: unknown, fallback: string) => {
  const text = normalizeText(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

  return text || fallback;
};

export const normalizePlanFaqItems = (value: unknown): PlanFaqItem[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Map<string, number>();
  const normalized = source.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];

    const record = item as Record<string, unknown>;
    const question = normalizeText(record.question);
    const answer = normalizeText(record.answer);
    if (!question || !answer || record.enabled === false) return [];

    const baseId = normalizeFaqId(record.id, `faq-${index + 1}`);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    return [
      {
        answer,
        enabled: true,
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
        question,
      },
    ];
  });

  return normalized.length > 0 ? normalized : DEFAULT_PLAN_FAQ_ITEMS;
};
```

Add `plansFaqItems: 'plans.faq.items'` to `APP_SETTING_KEYS`, classify `plans.` keys as `pricing`, and add `plans.` to public prefixes only if later surfaced through runtime config. For this slice, runtime config is not required because the Plans page will call the subscription router.

- [ ] **Step 4: Re-run the focused test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/const/billingPresentation.test.ts
```

Expected: pass.

### Task 2: Wire Admin Settings For Plan FAQ

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `src/features/Admin/adminSettingsForm.ts`
- Modify: `src/features/Admin/AdminSettingsPage.tsx`
- Test: `src/features/Admin/adminSettingsForm.test.ts`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Write failing tests for settings plumbing**

Add assertions that:

```typescript
expect(SETTING_KEYS.plansFaqItems).toBe('plans.faq.items');
expect(buildFormValues({ plansFaqItems: [{ id: 'x', question: 'Q', answer: 'A' }] } as any).planFaqItems).toEqual([
  { answer: 'A', enabled: true, id: 'x', question: 'Q' },
]);
expect(
  buildSettingUpdates(
    { ...initial, planFaqItems: [{ id: 'new', question: 'Q', answer: 'A', enabled: true }] },
    initial,
  ),
).toContainEqual({
  key: SETTING_KEYS.plansFaqItems,
  value: [{ id: 'new', question: 'Q', answer: 'A', enabled: true }],
});
```

Add a source-level assertion in `adminCommercialFlow.test.ts` that `AdminSettingsPage.tsx` contains `name="planFaqItems"` and `settings.ts` contains `SETTING_KEYS.plansFaqItems`.

- [ ] **Step 2: Run failing focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminSettingsForm.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Expected: fail because the new form field and router key are not wired yet.

- [ ] **Step 3: Implement server and form wiring**

In `settings.ts`:
- Import `normalizePlanFaqItems`.
- Add `SETTING_KEYS.plansFaqItems` to `PRICING_KEYS` or `WRITABLE_SETTING_KEYS`.
- In `normalizeAppSettingUpdate`, normalize that key with `normalizePlanFaqItems(value)`.
- Read it in `getAll` and return `plansFaqItems: normalizePlanFaqItems(plansFaqItems)`.

In `adminSettingsForm.ts`:
- Import `type PlanFaqItem` and `normalizePlanFaqItems`.
- Add `plansFaqItems?: unknown` to `AdminSettingsData`.
- Add `planFaqItems: PlanFaqItem[]` to `AdminSettingsFormValues`.
- Build, normalize, key-map, materialize, update, and refresh this field.

- [ ] **Step 4: Implement admin UI**

In `AdminSettingsPage.tsx`, add a compact `Form.List name="planFaqItems"` section in the site entry/commercial area:

```tsx
<Form.Item
  extra={t('admin.settings.planFaqItems.help', '显示在用户端 /settings/plans 的常见问题区域。')}
  label={t('admin.settings.planFaqItems', '套餐页常见问题')}
>
  <Form.List name="planFaqItems">
    {(fields, { add, remove }) => (
      <Flexbox gap={8}>
        {fields.map(({ key, name, ...restField }) => (
          <Flexbox horizontal align="center" gap={8} key={key} style={{ flexWrap: 'wrap' }}>
            <Form.Item {...restField} hidden name={[name, 'id']}><Input /></Form.Item>
            <Form.Item {...restField} noStyle name={[name, 'question']} rules={[{ required: true }]}>
              <Input placeholder="问题" style={{ flex: 1 }} />
            </Form.Item>
            <Form.Item {...restField} noStyle name={[name, 'answer']} rules={[{ required: true }]}>
              <Input placeholder="答案" style={{ flex: 1.8 }} />
            </Form.Item>
            <Form.Item {...restField} noStyle name={[name, 'enabled']} valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
            <MinusCircleOutlined style={{ color: '#ff4d4f' }} onClick={() => remove(name)} />
          </Flexbox>
        ))}
        <Button block icon={<PlusOutlined />} type="dashed" onClick={() => add({ answer: '', enabled: true, id: '', question: '' })}>
          {t('admin.settings.planFaqItems.add', '添加常见问题')}
        </Button>
      </Flexbox>
    )}
  </Form.List>
</Form.Item>
```

- [ ] **Step 5: Re-run focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminSettingsForm.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Expected: pass.

### Task 3: Render Admin FAQ On User Plans Page

**Files:**
- Modify: `packages/business-server/src/lambda-routers/subscription.ts`
- Modify: `src/services/commercial.ts`
- Modify: `src/business/client/BusinessSettingPages/Plans.tsx`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Write failing source-level coverage**

Add assertions:

```typescript
expect(publicPlansPage).toContain('commercialService.listPlanFaq');
expect(publicPlansPage).toContain('planFaqItems.map');
expect(publicPlansPage).not.toContain("key: 'usage-fast'");
```

- [ ] **Step 2: Run the failing focused test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: fail because Plans page still hardcodes the Collapse items.

- [ ] **Step 3: Add the subscription query and client service**

In `subscription.ts`, import `APP_SETTING_KEYS`, `appSettings`, and `normalizePlanFaqItems`, then add:

```typescript
listPlanFaq: authedProcedure.use(serverDatabase).query(async ({ ctx }) => {
  const row = await ctx.serverDB.query.appSettings.findFirst({
    where: eq(appSettings.key, APP_SETTING_KEYS.plansFaqItems),
  });

  return normalizePlanFaqItems(row?.value);
}),
```

In `src/services/commercial.ts`, add:

```typescript
listPlanFaq = async () => {
  return lambdaClient.subscription.listPlanFaq.query();
};
```

- [ ] **Step 4: Render dynamic FAQ in Plans page**

In `Plans.tsx`, fetch FAQ with SWR:

```typescript
const { data: planFaqItems = DEFAULT_PLAN_FAQ_ITEMS } = useClientDataSWR(
  ['business-plan-faq'],
  () => commercialService.listPlanFaq(),
);
```

Replace the hardcoded `Collapse` items with:

```tsx
<Collapse
  ghost
  items={planFaqItems.map((item) => ({
    children: item.answer,
    key: item.id,
    label: item.question,
  }))}
/>
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts src/const/billingPresentation.test.ts
```

Expected: pass.

### Task 4: Tighten Top-Up And Credits Presentation

**Files:**
- Modify: `src/features/Admin/AdminTopUpPackagesPage.tsx`
- Modify: `src/business/client/BusinessSettingPages/Credits.tsx`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Add source-level expectations**

Assert the admin top-up page displays promotion metadata in the table and the Credits page uses upstream-style words:

```typescript
expect(topupPage).toContain('normalizeTopUpPackagePromotion(row.metadata)');
expect(topupPage).toContain("admin.topup.col.promotion");
expect(creditsPage).toContain('限时优惠');
expect(creditsPage).toContain('优先使用订阅积分，其次使用充值积分');
```

- [ ] **Step 2: Implement admin promotion column**

Add a `promotion` table column after amount:

```tsx
{
  dataIndex: 'metadata',
  key: 'promotion',
  render: (metadata: PackageRow['metadata'], row: PackageRow) => {
    const promotion = normalizeTopUpPackagePromotion(row.metadata);
    if (!promotion.enabled) return <Tag>未设置</Tag>;

    return (
      <Flexbox horizontal gap={4} wrap="wrap">
        <Tag color="red">{promotion.label || '限时优惠'}</Tag>
        {typeof promotion.originalAmount === 'number' ? <Tag>原价 {promotion.originalAmount} {row.currency}</Tag> : null}
        {promotion.note ? <Tag color="blue">{promotion.note}</Tag> : null}
      </Flexbox>
    );
  },
  title: t('admin.topup.col.promotion', '促销'),
}
```

- [ ] **Step 3: Keep Credits UI stable**

Avoid adding new payment behavior. Keep the current no-gateway hint and only adjust microcopy/layout if tests or manual review show obvious mismatch.

- [ ] **Step 4: Run focused test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts
```

Expected: pass.

### Task 5: Review, Verify, Commit

**Files:**
- Verify only unless a review issue is found.

- [ ] **Step 1: Run all P2 focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/const/billingPresentation.test.ts src/features/Admin/adminSettingsForm.test.ts src/features/Admin/adminCommercialFlow.test.ts src/business/client/BusinessSettingPages/plansDisplay.test.ts
```

Run from `packages/business-server`:

```powershell
bunx vitest run --silent='passed-only' src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/plans.test.ts src/lambda-routers/admin/topupPackages.test.ts
```

- [ ] **Step 2: Run diff checks**

Run:

```powershell
git diff --check
git status --short
```

- [ ] **Step 3: Review P2 locally**

Check:
- FAQ data is normalized on both write and read paths.
- Admin settings does not introduce another duplicate pricing area.
- Top-up promotion is display-only on user page; no fake payment is added.
- No unrelated deployment, desktop, or AI-provider changes are included.

- [ ] **Step 4: Commit**

Use:

```powershell
git add -f docs/superpowers/plans/2026-07-06-p2-commercial-user-flow-and-admin-ux.md
git add src/const/billingPresentation.ts src/const/billingPresentation.test.ts src/const/appSettingsRegistry.ts src/features/Admin/adminSettingsForm.ts src/features/Admin/adminSettingsForm.test.ts src/features/Admin/AdminSettingsPage.tsx src/features/Admin/adminCommercialFlow.test.ts src/features/Admin/AdminTopUpPackagesPage.tsx src/business/client/BusinessSettingPages/Plans.tsx src/business/client/BusinessSettingPages/Credits.tsx src/services/commercial.ts packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/subscription.ts
git commit -m "✨ Improve commercial plan FAQ and promotion UX" -m "Constraint: Preserve existing plan catalog and top-up schema; FAQ uses app_settings." -m "Tested: bunx vitest run --silent='passed-only' src/const/billingPresentation.test.ts src/features/Admin/adminSettingsForm.test.ts src/features/Admin/adminCommercialFlow.test.ts src/business/client/BusinessSettingPages/plansDisplay.test.ts" -m "Tested: cd packages/business-server; bunx vitest run --silent='passed-only' src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/plans.test.ts src/lambda-routers/admin/topupPackages.test.ts" -m "Scope-risk: Medium; touches admin settings, subscription TRPC, and public commercial pages."
```
