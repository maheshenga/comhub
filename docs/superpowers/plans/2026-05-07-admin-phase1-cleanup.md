# Admin Phase 1 Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin setup experience by fixing Chinese text, making default model selection catalog-driven, demoting legacy NewAPI settings, and showing payment gateway status clearly.

**Architecture:** Keep the existing admin routers and app settings storage. Add small client-side helpers for model-option normalization and payment status display, then update the existing settings, pricing, plans, and NewAPI admin pages without introducing new schemas.

**Tech Stack:** React, Ant Design, SWR, tRPC lambda client, Vitest, TypeScript, existing LobeHub admin services.

---

## File Structure

- Modify `src/features/Admin/adminSettingsForm.ts`
  - Add catalog model option types and helpers.
  - Keep save payload generation isolated from UI.
- Modify `src/features/Admin/adminSettingsForm.test.ts`
  - Add tests for model option normalization and default model refresh behavior.
- Modify `src/business/server/lambda-routers/admin/settings.ts`
  - Return enabled NewAPI model suggestions and payment gateway status.
- Modify `src/services/adminCommercial.ts`
  - Add a typed wrapper for `admin.newapiProviders.getAllEnabledModels` if needed by the UI.
- Modify `src/features/Admin/AdminSettingsPage.tsx`
  - Replace free-form default model UX with provider/model selectors.
  - Move legacy NewAPI single-instance fields into an advanced compatibility section.
  - Fix visible Chinese text and invalid JSX caused by mojibake.
  - Show payment gateway status.
- Modify `src/features/Admin/AdminPricingPage.tsx`
  - Fix Chinese text.
  - Rename UI terminology from "模型规则" to "计费规则".
- Modify `src/routes/(main)/admin/plans/index.tsx`
  - Fix Chinese text.
  - Rename "模型规则" to "套餐模型权限".
- Modify `src/features/Admin/AdminNewapiProvidersPage.tsx`
  - Fix Chinese text in labels, modals, table actions, and validation messages.
- Modify `src/features/Admin/adminNavigation.ts`
  - Fix sidebar Chinese text and make names match the Phase 1 structure.

Do not touch billing internals, schema files, payment adapter code, or deployment files in this phase.

---

### Task 1: Settings Form Helpers

**Files:**

- Modify: `src/features/Admin/adminSettingsForm.ts`
- Modify: `src/features/Admin/adminSettingsForm.test.ts`

- [ ] **Step 1: Add failing tests for model option normalization**

Add these imports and tests to `src/features/Admin/adminSettingsForm.test.ts`:

```ts
import {
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  normalizeGatewayUrls,
  normalizeModelIds,
  SETTING_KEYS,
} from './adminSettingsForm';

it('builds default model options from enabled NewAPI models and legacy suggestions', () => {
  expect(
    buildModelOptions({
      defaultModelSuggestions: ['legacy-chat', 'deepseek-chat'],
      enabledNewapiModels: [
        {
          displayName: 'DeepSeek Chat',
          instanceName: '主网关',
          modelId: 'deepseek-chat',
          modelType: 'chat',
          provider: 'newapi',
        },
        {
          displayName: null,
          instanceName: '图像网关',
          modelId: 'flux-kontext',
          modelType: 'image',
          provider: 'newapi',
        },
      ],
    }),
  ).toEqual([
    {
      label: 'DeepSeek Chat（newapi / chat / 主网关）',
      model: 'deepseek-chat',
      provider: 'newapi',
      value: 'newapi:deepseek-chat',
    },
    {
      label: 'flux-kontext（newapi / image / 图像网关）',
      model: 'flux-kontext',
      provider: 'newapi',
      value: 'newapi:flux-kontext',
    },
    {
      label: 'legacy-chat（newapi / legacy）',
      model: 'legacy-chat',
      provider: 'newapi',
      value: 'newapi:legacy-chat',
    },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminSettingsForm.test.ts
```

Expected: fails because `buildModelOptions` is not exported.

- [ ] **Step 3: Implement model option helpers**

Add these types and helper to `src/features/Admin/adminSettingsForm.ts`:

```ts
export type EnabledNewapiModelOption = {
  displayName?: string | null;
  instanceName?: string | null;
  modelId: string;
  modelType: string;
  provider?: string | null;
};

export type DefaultModelOption = {
  label: string;
  model: string;
  provider: string;
  value: string;
};

export const buildModelOptions = (data?: {
  defaultModelSuggestions?: string[] | null;
  enabledNewapiModels?: EnabledNewapiModelOption[] | null;
}): DefaultModelOption[] => {
  const seen = new Set<string>();
  const options: DefaultModelOption[] = [];

  for (const item of data?.enabledNewapiModels ?? []) {
    const model = normalizeText(item.modelId);
    if (!model) continue;

    const provider = normalizeText(item.provider) || 'newapi';
    const key = `${provider}:${model}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = normalizeText(item.displayName) || model;
    const modelType = normalizeText(item.modelType) || 'chat';
    const instanceName = normalizeText(item.instanceName);

    options.push({
      label: `${name}（${provider} / ${modelType}${instanceName ? ` / ${instanceName}` : ''}）`,
      model,
      provider,
      value: key,
    });
  }

  for (const suggestion of data?.defaultModelSuggestions ?? []) {
    const model = normalizeText(suggestion);
    if (!model) continue;

    const provider = 'newapi';
    const key = `${provider}:${model}`;
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({
      label: `${model}（${provider} / legacy）`,
      model,
      provider,
      value: key,
    });
  }

  return options;
};
```

- [ ] **Step 4: Run the helper test again**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminSettingsForm.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/Admin/adminSettingsForm.ts src/features/Admin/adminSettingsForm.test.ts
git commit -m "test: cover admin default model options"
```

---

### Task 2: Admin Settings API Shape

**Files:**

- Modify: `src/business/server/lambda-routers/admin/settings.ts`
- Modify: `src/services/adminCommercial.ts`

- [ ] **Step 1: Add enabled model and payment status fields to settings response**

In `src/business/server/lambda-routers/admin/settings.ts`, import the NewAPI model reader:

```ts
import { getAllEnabledModels } from '@/server/services/newapiInstance';
```

Inside `getAll`, next to `defaultModelSuggestions`, read enabled models:

```ts
const enabledNewapiModels = await getAllEnabledModels(ctx.serverDB);
```

Add these fields to the returned object:

```ts
enabledNewapiModels: enabledNewapiModels.map((item) => ({
  displayName: item.displayName,
  instanceName: null,
  modelId: item.id,
  modelType: item.type,
  provider: 'newapi',
})),
paymentGatewayStatus: {
  configured: false,
  message: '支付网关尚未接入，用户自助支付会返回 PAYMENT_GATEWAY_NOT_CONFIGURED。当前可使用后台手动结算订单。',
  provider: null,
},
```

This is intentionally conservative: existing payment router is still a stub, so the admin UI must say it is not configured.

- [ ] **Step 2: Add admin service wrapper for all enabled NewAPI models**

In `src/services/adminCommercial.ts`, add this method near the NewAPI provider methods:

```ts
  listAllEnabledNewapiModels = async (params?: {
    modelType?: 'chat' | 'embedding' | 'tts' | 'stt' | 'image' | 'video' | 'text2music' | 'realtime';
  }) => lambdaClient.admin.newapiProviders.getAllEnabledModels.query(params);
```

The settings page can use the settings payload first; this method is for future refreshes and keeps service coverage complete.

- [ ] **Step 3: Run TypeScript check for touched API shape**

Run:

```bash
pnpm type-check
```

Expected: completes without TypeScript errors.

- [ ] **Step 4: Commit Task 2**

```bash
git add src/business/server/lambda-routers/admin/settings.ts src/services/adminCommercial.ts
git commit -m "feat: expose admin model and payment setup status"
```

---

### Task 3: Settings Page UX Cleanup

**Files:**

- Modify: `src/features/Admin/AdminSettingsPage.tsx`
- Modify: `src/features/Admin/adminSettingsForm.ts`

- [ ] **Step 1: Extend settings data type**

In `src/features/Admin/adminSettingsForm.ts`, add these fields to `AdminSettingsData`:

```ts
defaultModelSuggestions?: string[] | null;
enabledNewapiModels?: EnabledNewapiModelOption[] | null;
paymentGatewayStatus?: {
  configured: boolean;
  message: string;
  provider?: string | null;
} | null;
```

- [ ] **Step 2: Replace default model option construction**

In `src/features/Admin/AdminSettingsPage.tsx`, import `buildModelOptions` and remove the old `defaultModelOptions` mapping:

```ts
import {
  ADMIN_SETTINGS_SWR_KEY,
  type AdminSettingsFormValues,
  buildFormValues,
  buildModelOptions,
  buildSettingUpdates,
  getAdminSettingsRefreshKeys,
  getGatewayUrlSummary,
  getModelIdSummary,
  normalizeGatewayUrls,
  normalizeModelIds,
  normalizeText,
} from '@/features/Admin/adminSettingsForm';
```

Then add:

```ts
const defaultModelOptions = buildModelOptions(data);
const paymentGatewayStatus = data?.paymentGatewayStatus;
```

- [ ] **Step 3: Add selector behavior for default model**

Update the default model `AutoComplete` so selecting a catalog option sets both provider and model:

```tsx
<AutoComplete
  options={defaultModelOptions}
  filterOption={(inputValue, option) =>
    String(option?.label ?? option?.value ?? '')
      .toLowerCase()
      .includes(inputValue.toLowerCase())
  }
  onSelect={(value) => {
    const selected = defaultModelOptions.find((item) => item.value === value);
    if (!selected) return;

    form.setFieldValue('defaultAgentProvider', selected.provider);
    form.setFieldValue('defaultAgentModel', selected.model);
  }}
>
  <Input
    allowClear
    placeholder="deepseek-chat"
    onBlur={() =>
      form.setFieldValue(
        'defaultAgentModel',
        normalizeText(form.getFieldValue('defaultAgentModel')),
      )
    }
  />
</AutoComplete>
```

- [ ] **Step 4: Replace visible mojibake text in settings page**

Use Chinese fallback text for these major strings:

```tsx
{t('admin.settings.title', '站点与 API 设置')}
{t('admin.settings.subtitle', '这里保留全站基础设置。套餐、模型策略、计费规则等独立管理项已移动到左侧对应模块。')}
{t('admin.settings.defaultModelNotice', '默认模型保存后会刷新运行时配置和用户状态。新用户、新建助手以及未单独指定模型的助手会优先使用这里的默认供应商和模型。')}
{t('admin.settings.brandSection', '品牌展示')}
{t('admin.settings.gatewaySection', '模型与 API 默认设置')}
{t('admin.settings.defaultProvider', '默认供应商（Provider）')}
{t('admin.settings.defaultProvider.help', '使用 NewAPI 中转站时填写 newapi。该值会写入后端默认助手配置。')}
{t('admin.settings.defaultModel', '默认模型（Model）')}
{t('admin.settings.defaultModel.help', '建议从已启用模型目录中选择；也可以手动输入网关支持的模型 ID。')}
```

Fix the invalid JSX in the NewAPI URL helper:

```tsx
{urlSummary.invalidUrls.length > 0 && (
  <Text type="danger">发现 {urlSummary.invalidUrls.length} 个地址格式不正确</Text>
)}
```

- [ ] **Step 5: Move legacy NewAPI single-instance settings into an advanced block**

Wrap `newapiEnabledModels`, `newapiApiKey`, and `newapiProxyUrl` fields in a card with this title and alert:

```tsx
<Card title={t('admin.settings.legacyNewapiSection', '兼容设置：旧版 NewAPI 单实例')}>
  <Alert
    showIcon
    type="warning"
    message={t(
      'admin.settings.legacyNewapiNotice',
      '推荐在“模型与 API / NewAPI 实例”中维护多实例和模型目录。这里仅用于兼容旧部署，未配置多实例时后端才会回退使用这些值。',
    )}
    style={{ marginBottom: 16 }}
  />
  {/* existing legacy fields */}
</Card>
```

- [ ] **Step 6: Add payment gateway status card**

Add a card near commercial settings:

```tsx
<Card title={t('admin.settings.paymentSection', '支付网关状态')}>
  <Alert
    showIcon
    type={paymentGatewayStatus?.configured ? 'success' : 'warning'}
    message={
      paymentGatewayStatus?.message ||
      '支付网关尚未接入，用户自助支付暂不可用。当前可以在后台手动结算订单。'
    }
  />
</Card>
```

- [ ] **Step 7: Run focused checks**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminSettingsForm.test.ts
pnpm exec eslint src/features/Admin/AdminSettingsPage.tsx src/features/Admin/adminSettingsForm.ts src/features/Admin/adminSettingsForm.test.ts
```

Expected: tests pass and ESLint exits without errors.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/features/Admin/AdminSettingsPage.tsx src/features/Admin/adminSettingsForm.ts src/features/Admin/adminSettingsForm.test.ts
git commit -m "feat: improve admin default model settings"
```

---

### Task 4: Pricing, Plans, NewAPI, and Navigation Text Cleanup

**Files:**

- Modify: `src/features/Admin/AdminPricingPage.tsx`
- Modify: `src/routes/(main)/admin/plans/index.tsx`
- Modify: `src/features/Admin/AdminNewapiProvidersPage.tsx`
- Modify: `src/features/Admin/adminNavigation.ts`

- [ ] **Step 1: Fix pricing page Chinese text**

In `src/features/Admin/AdminPricingPage.tsx`, replace mojibake fallback strings with:

```tsx
message.success(t('admin.pricing.saveSuccess', '计费规则已保存'));
message.error(t('admin.pricing.saveFailed', '保存失败，请检查计费规则 JSON 配置。'));

<Alert
  showIcon
  type="info"
  message={t(
    'admin.pricing.tip',
    '计费规则用于按 provider/model 调整积分消耗；model 目前只支持精确模型 ID 或 "*"，creditsPerDollar 可覆盖美元到积分的换算。',
  )}
/>
```

Also use:

```tsx
{t('admin.pricing.multiplier', '全局积分倍率')}
{t('admin.pricing.rules', '模型计费规则')}
{t('admin.pricing.rules.help', 'JSON 数组。每一项可包含 provider、model、multiplier、creditsPerDollar。')}
{t('admin.pricing.ordersEnabled', '启用订单管理')}
{t('admin.settings.save', '保存')}
{t('admin.pricing.example', '填入示例')}
```

- [ ] **Step 2: Fix plan page Chinese text and terminology**

In `src/routes/(main)/admin/plans/index.tsx`, replace visible fallback text with:

```tsx
message.success(t('admin.plans.modelRulesSaveSuccess', '套餐模型权限已保存'));
message.error(t('admin.plans.modelRulesSaveFailed', '保存失败'));
message.success(t('admin.plans.saveSuccess', '套餐已保存'));
message.error(t('admin.plans.saveFailed', '保存失败'));
message.success(t('admin.plans.deleted', '套餐已删除'));
```

Use these labels:

```tsx
{t('admin.plans.modelRulesTitle', '套餐模型权限 - {{name}}', { name: plan?.displayName ?? plan?.plan ?? '' })}
{t('admin.plans.modelRulesModeAllowlist', '仅允许列表中的模型')}
{t('admin.plans.modelRulesModeBlocklist', '禁用列表中的模型')}
{t('admin.plans.modelRulesAllowlist', '允许列表')}
{t('admin.plans.modelRulesBlocklist', '禁用列表')}
{t('admin.plans.modelRulesListHint', '每行一个模型 ID，支持 gpt-* 这类通配符。')}
{t('admin.plans.modelRulesEmpty', '此类型未设置权限规则，默认允许所有模型')}
{t('admin.plans.modelRulesAdd', '添加权限规则')}
{t('admin.plans.modelRules', '模型权限')}
```

- [ ] **Step 3: Fix NewAPI provider page Chinese text**

In `src/features/Admin/AdminNewapiProvidersPage.tsx`, replace modal and field fallbacks with:

```tsx
message.success(t('admin.newapi.saveSuccess', '已保存'));
message.error(t('admin.newapi.saveFailed', '保存失败'));
{t('admin.newapi.modal.editInstance', '编辑实例')}
{t('admin.newapi.modal.createInstance', '新建实例')}
{t('admin.newapi.field.name', '名称')}
{t('admin.newapi.field.nameRequired', '请填写名称')}
{t('admin.newapi.field.baseUrl', '基础地址（Base URL）')}
{t('admin.newapi.field.baseUrlRequired', '请填写基础地址')}
{t('admin.newapi.field.apiKeyEditHint', '留空表示保持现有密钥不变；填写新密钥会替换当前密钥。')}
{t('admin.newapi.field.apiKey', 'API 密钥（API Key）')}
{t('admin.newapi.field.priorityHint', '数字越小优先级越高，用于路由和故障切换。')}
{t('admin.newapi.field.priority', '优先级')}
{t('admin.newapi.field.enabled', '启用')}
{t('admin.newapi.field.fetchOnClient', '客户端拉取')}
{t('admin.newapi.field.description', '描述')}
```

Continue through the rest of the file and replace every mojibake fallback string with clear Chinese. Keep English protocol terms like `Base URL`, `API Key`, `Model ID` in parentheses.

- [ ] **Step 4: Fix admin navigation Chinese text**

In `src/features/Admin/adminNavigation.ts`, replace group/item labels and descriptions with clean Chinese. Use this exact structure:

```ts
label: '概览'
label: '用户'
label: '商业化'
label: '模型与 API'
label: '运营'
label: '系统'
```

Recommended item labels:

```ts
'工作台'
'用户管理'
'套餐管理'
'订阅管理'
'变更请求'
'充值套餐'
'订单管理'
'积分账户'
'兑换码'
'NewAPI 实例'
'模型策略'
'计费规则'
'站点与 API 设置'
'增长设置'
'推荐运营'
'运营配置'
'数据看板'
'审计日志'
'桌面端更新'
```

- [ ] **Step 5: Search for remaining mojibake in touched admin files**

Run:

```bash
rg -n "锛|绉|濂|鍚|璁|妯|閰|鐢|鈥|????" src/features/Admin src/routes/\\(main\\)/admin
```

Expected: no matches in the files touched by this task. Matches in unrelated files should remain untouched when they are outside the admin pages touched here.

- [ ] **Step 6: Run lint on touched pages**

Run:

```bash
pnpm exec eslint src/features/Admin/AdminPricingPage.tsx src/routes/\\(main\\)/admin/plans/index.tsx src/features/Admin/AdminNewapiProvidersPage.tsx src/features/Admin/adminNavigation.ts
```

Expected: exits without errors.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/features/Admin/AdminPricingPage.tsx src/routes/\(main\)/admin/plans/index.tsx src/features/Admin/AdminNewapiProvidersPage.tsx src/features/Admin/adminNavigation.ts
git commit -m "fix: clean admin Chinese copy"
```

---

### Task 5: Final Verification

**Files:**

- Verify only; no planned code edits.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminSettingsForm.test.ts src/features/Admin/adminNavigation.test.ts
```

Expected: both test files pass.

- [ ] **Step 2: Run lint on all touched files**

Run:

```bash
pnpm exec eslint src/features/Admin/AdminSettingsPage.tsx src/features/Admin/adminSettingsForm.ts src/features/Admin/adminSettingsForm.test.ts src/features/Admin/AdminPricingPage.tsx src/features/Admin/AdminNewapiProvidersPage.tsx src/features/Admin/adminNavigation.ts src/routes/\\(main\\)/admin/plans/index.tsx src/business/server/lambda-routers/admin/settings.ts src/services/adminCommercial.ts
```

Expected: exits without errors.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
pnpm type-check
```

Expected: exits without errors.

- [ ] **Step 4: Optional browser verification**

If a dev server is available, open `/settings/admin/settings`, `/settings/admin/pricing`, `/settings/admin/plans`, and `/settings/admin/newapi-providers`.

Check:

- No visible mojibake.
- Default model can be selected from enabled NewAPI models.
- Legacy NewAPI settings are visibly marked as compatibility settings.
- Payment gateway status says self-service payment is not configured.
- Plans page uses "模型权限", not "模型规则".
- Pricing page uses "计费规则", not "模型规则".

- [ ] **Step 5: Commit any verification-only copy fixes**

If verification reveals small text or lint fixes, commit them:

```bash
git add <fixed-files>
git commit -m "fix: polish admin phase one cleanup"
```

If no changes are needed, do not create an empty commit.
