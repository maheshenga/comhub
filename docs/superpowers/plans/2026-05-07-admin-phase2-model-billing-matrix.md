# Admin Phase 2 Model Billing Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings/admin/model-billing-matrix` page that lets admins inspect and update model source, default model, plan access, and pricing rules from one matrix.

**Architecture:** Build the matrix as a frontend aggregation layer over existing admin APIs. Keep persistence in the current stores: NewAPI model rows, app settings for default model/pricing rules, and `plan_catalog.model_rules` for plan access. Add pure helper functions for matrix assembly and payload conversion so the UI remains thin and testable.

**Tech Stack:** React, Ant Design Table, SWR, tRPC lambda client, Vitest, TypeScript, existing adminCommercialService.

---

## File Structure

- Create `src/features/Admin/adminModelBillingMatrix.ts`
  - Pure types and helpers for building matrix rows, toggling plan access, and generating pricing rule updates.
- Create `src/features/Admin/adminModelBillingMatrix.test.ts`
  - Unit tests for row aggregation, default model flags, plan rule conversion, and pricing rule conversion.
- Create `src/features/Admin/AdminModelBillingMatrixPage.tsx`
  - Matrix UI and save actions.
- Create `src/routes/(main)/admin/model-billing-matrix/index.tsx`
  - Route entry exporting the page.
- Modify `src/services/adminCommercial.ts`
  - Ensure all needed service methods are available with stable names.
- Modify `src/features/Admin/adminNavigation.ts`
  - Add sidebar item under "模型与 API".
- Modify `src/features/Admin/adminNavigation.test.ts`
  - Assert the new route is reachable.
- Modify `src/business/client/BusinessDesktopRoutes.tsx`
  - Register the new admin route.

No database schema changes are required in this phase.

---

### Task 1: Matrix Helper Tests and Types

**Files:**

- Create: `src/features/Admin/adminModelBillingMatrix.ts`
- Create: `src/features/Admin/adminModelBillingMatrix.test.ts`

- [ ] **Step 1: Add failing tests**

Create `src/features/Admin/adminModelBillingMatrix.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  buildMatrixRows,
  buildPlanModelRulesFromRows,
  buildPricingRulesFromRows,
  togglePlanAccess,
} from './adminModelBillingMatrix';

describe('adminModelBillingMatrix', () => {
  const plans = [
    { displayName: 'Free', plan: 'free' },
    { displayName: 'Starter', plan: 'starter' },
  ];

  const models = [
    {
      displayName: 'DeepSeek Chat',
      instanceId: 'inst-1',
      instanceName: '主网关',
      modelId: 'deepseek-chat',
      modelType: 'chat',
      priority: 0,
    },
    {
      displayName: 'DeepSeek Chat Backup',
      instanceId: 'inst-2',
      instanceName: '备用网关',
      modelId: 'deepseek-chat',
      modelType: 'chat',
      priority: 1,
    },
    {
      displayName: null,
      instanceId: 'inst-3',
      instanceName: '图像网关',
      modelId: 'flux-kontext',
      modelType: 'image',
      priority: 0,
    },
  ];

  it('deduplicates models and marks default/pricing/plan access', () => {
    const rows = buildMatrixRows({
      defaultModel: 'deepseek-chat',
      defaultProvider: 'newapi',
      models,
      plans,
      pricingRules: [{ model: 'deepseek-chat', multiplier: 0.8, provider: 'newapi' }],
      planRulesByPlan: {
        free: { chat: { allowlist: ['deepseek-chat'], mode: 'allowlist' } },
        starter: { image: { blocklist: ['flux-*'], mode: 'blocklist' } },
      },
    });

    expect(rows).toEqual([
      {
        creditsPerDollar: undefined,
        displayName: 'DeepSeek Chat',
        instanceNames: ['主网关', '备用网关'],
        isDefault: true,
        key: 'newapi:chat:deepseek-chat',
        modelId: 'deepseek-chat',
        modelType: 'chat',
        planAccess: { free: true, starter: true },
        pricingMultiplier: 0.8,
        provider: 'newapi',
      },
      {
        creditsPerDollar: undefined,
        displayName: 'flux-kontext',
        instanceNames: ['图像网关'],
        isDefault: false,
        key: 'newapi:image:flux-kontext',
        modelId: 'flux-kontext',
        modelType: 'image',
        planAccess: { free: true, starter: false },
        pricingMultiplier: undefined,
        provider: 'newapi',
      },
    ]);
  });

  it('toggles plan access and serializes allowlist rules by plan/type', () => {
    const rows = buildMatrixRows({
      models,
      plans,
      pricingRules: [],
      planRulesByPlan: {},
    });
    const nextRows = togglePlanAccess(rows, 'newapi:image:flux-kontext', 'starter', false);

    expect(buildPlanModelRulesFromRows(nextRows, plans)).toEqual({
      free: undefined,
      starter: {
        image: { allowlist: [], mode: 'allowlist' },
      },
    });
  });

  it('serializes pricing rules only for rows with overrides', () => {
    const rows = buildMatrixRows({
      models,
      plans,
      pricingRules: [],
      planRulesByPlan: {},
    }).map((row) =>
      row.modelId === 'deepseek-chat'
        ? { ...row, creditsPerDollar: 1_000_000, pricingMultiplier: 0.9 }
        : row,
    );

    expect(buildPricingRulesFromRows(rows)).toEqual([
      {
        creditsPerDollar: 1_000_000,
        model: 'deepseek-chat',
        multiplier: 0.9,
        provider: 'newapi',
      },
    ]);
  });
});
```

- [ ] **Step 2: Create empty helper module**

Create `src/features/Admin/adminModelBillingMatrix.ts`:

```ts
export type MatrixModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export type MatrixPlan = {
  displayName: string;
  plan: string;
};

export type MatrixSourceModel = {
  displayName: string | null;
  instanceId: string;
  instanceName: string;
  modelId: string;
  modelType: MatrixModelType;
  priority: number;
};

export type MatrixPricingRule = {
  creditsPerDollar?: number;
  model?: string;
  multiplier?: number;
  provider?: string;
};

export type MatrixPlanRule = {
  allowlist?: string[];
  blocklist?: string[];
  mode: 'allowlist' | 'blocklist';
};

export type MatrixPlanRules = Partial<Record<MatrixModelType, MatrixPlanRule>>;

export type MatrixRow = {
  creditsPerDollar?: number;
  displayName: string;
  instanceNames: string[];
  isDefault: boolean;
  key: string;
  modelId: string;
  modelType: MatrixModelType;
  planAccess: Record<string, boolean>;
  pricingMultiplier?: number;
  provider: string;
};
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminModelBillingMatrix.test.ts
```

Expected: fail because helper functions are not exported.

- [ ] **Step 4: Commit failing tests only if project policy allows**

Do not commit failing tests. Continue to Task 2.

---

### Task 2: Matrix Helper Implementation

**Files:**

- Modify: `src/features/Admin/adminModelBillingMatrix.ts`
- Test: `src/features/Admin/adminModelBillingMatrix.test.ts`

- [ ] **Step 1: Add helper implementation**

Append this implementation to `src/features/Admin/adminModelBillingMatrix.ts`:

```ts
const wildcardMatch = (pattern: string, value: string) => {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;

  const escaped = pattern
    .split('*')
    .map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}$`, 'i').test(value);
};

const matchesList = (list: string[] | undefined, modelId: string) =>
  (list ?? []).some((item) => wildcardMatch(item.trim().toLowerCase(), modelId.toLowerCase()));

const isAllowedByRule = (rule: MatrixPlanRule | undefined, modelId: string) => {
  if (!rule) return true;
  if (rule.mode === 'allowlist') return matchesList(rule.allowlist, modelId);
  return !matchesList(rule.blocklist, modelId);
};

const findPricingRule = ({
  modelId,
  pricingRules,
  provider,
}: {
  modelId: string;
  pricingRules: MatrixPricingRule[];
  provider: string;
}) =>
  pricingRules.find((rule) => {
    const ruleProvider = rule.provider?.trim().toLowerCase();
    const ruleModel = rule.model?.trim().toLowerCase();

    const providerMatched = !ruleProvider || ruleProvider === '*' || ruleProvider === provider;
    const modelMatched = !ruleModel || ruleModel === '*' || ruleModel === modelId.toLowerCase();

    return providerMatched && modelMatched;
  });

export const buildMatrixRows = ({
  defaultModel,
  defaultProvider = 'newapi',
  models,
  plans,
  pricingRules,
  planRulesByPlan,
}: {
  defaultModel?: string | null;
  defaultProvider?: string | null;
  models: MatrixSourceModel[];
  plans: MatrixPlan[];
  pricingRules: MatrixPricingRule[];
  planRulesByPlan: Record<string, MatrixPlanRules | null | undefined>;
}): MatrixRow[] => {
  const grouped = new Map<string, MatrixSourceModel[]>();

  for (const model of models) {
    const key = `newapi:${model.modelType}:${model.modelId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), model]);
  }

  return Array.from(grouped.entries())
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.priority - b.priority);
      const first = sorted[0];
      const provider = 'newapi';
      const pricingRule = findPricingRule({
        modelId: first.modelId,
        pricingRules,
        provider,
      });

      return {
        creditsPerDollar: pricingRule?.creditsPerDollar,
        displayName: first.displayName || first.modelId,
        instanceNames: sorted.map((item) => item.instanceName),
        isDefault:
          (defaultProvider || provider).toLowerCase() === provider &&
          defaultModel === first.modelId,
        key,
        modelId: first.modelId,
        modelType: first.modelType,
        planAccess: Object.fromEntries(
          plans.map((plan) => [
            plan.plan,
            isAllowedByRule(planRulesByPlan[plan.plan]?.[first.modelType], first.modelId),
          ]),
        ),
        pricingMultiplier: pricingRule?.multiplier,
        provider,
      };
    })
    .sort((a, b) => a.modelType.localeCompare(b.modelType) || a.modelId.localeCompare(b.modelId));
};

export const togglePlanAccess = (
  rows: MatrixRow[],
  rowKey: string,
  plan: string,
  allowed: boolean,
): MatrixRow[] =>
  rows.map((row) =>
    row.key === rowKey
      ? { ...row, planAccess: { ...row.planAccess, [plan]: allowed } }
      : row,
  );

export const buildPlanModelRulesFromRows = (rows: MatrixRow[], plans: MatrixPlan[]) => {
  const result: Record<string, MatrixPlanRules | undefined> = {};

  for (const plan of plans) {
    const deniedRows = rows.filter((row) => row.planAccess[plan.plan] === false);
    if (deniedRows.length === 0) {
      result[plan.plan] = undefined;
      continue;
    }

    const rules: MatrixPlanRules = {};
    for (const row of deniedRows) {
      const existing = rules[row.modelType] ?? { allowlist: [], mode: 'allowlist' as const };
      rules[row.modelType] = existing;
    }
    result[plan.plan] = rules;
  }

  return result;
};

export const buildPricingRulesFromRows = (rows: MatrixRow[]): MatrixPricingRule[] =>
  rows.flatMap((row) => {
    const hasMultiplier = Number.isFinite(row.pricingMultiplier);
    const hasCreditsPerDollar = Number.isFinite(row.creditsPerDollar);
    if (!hasMultiplier && !hasCreditsPerDollar) return [];

    return [
      {
        ...(hasCreditsPerDollar ? { creditsPerDollar: row.creditsPerDollar } : {}),
        model: row.modelId,
        ...(hasMultiplier ? { multiplier: row.pricingMultiplier } : {}),
        provider: row.provider,
      },
    ];
  });
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminModelBillingMatrix.test.ts
```

Expected: tests pass.

- [ ] **Step 3: Commit helper and tests**

```bash
git add src/features/Admin/adminModelBillingMatrix.ts src/features/Admin/adminModelBillingMatrix.test.ts
git commit -m "test: cover admin model billing matrix helpers"
```

---

### Task 3: Add Matrix Route and Navigation

**Files:**

- Modify: `src/features/Admin/adminNavigation.ts`
- Modify: `src/features/Admin/adminNavigation.test.ts`
- Modify: `src/business/client/BusinessDesktopRoutes.tsx`
- Create: `src/routes/(main)/admin/model-billing-matrix/index.tsx`

- [ ] **Step 1: Update navigation test first**

In `src/features/Admin/adminNavigation.test.ts`, update labels and route expectations:

```ts
expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toEqual([
  '概览',
  '用户',
  '商业化',
  '模型与 API',
  '运营',
  '系统',
]);
```

Add route expectation:

```ts
`${ADMIN_BASE_PATH}/model-billing-matrix`,
```

Add selected route assertion:

```ts
expect(getAdminSelectedKey('/settings/admin/model-billing-matrix')).toBe(
  `${ADMIN_BASE_PATH}/model-billing-matrix`,
);
expect(getAdminOpenKeys('/settings/admin/model-billing-matrix')).toEqual(['model-api']);
```

- [ ] **Step 2: Add sidebar item**

In `src/features/Admin/adminNavigation.ts`, add this item under the `model-api` group after `NewAPI 实例`:

```ts
{
  description: '统一查看模型来源、套餐权限、默认模型和计费倍率',
  icon: 'pricing',
  label: '模型与计费矩阵',
  path: `${ADMIN_BASE_PATH}/model-billing-matrix`,
},
```

- [ ] **Step 3: Register desktop route**

In `src/business/client/BusinessDesktopRoutes.tsx`, add:

```tsx
{
  element: dynamicElement(
    () => import('@/routes/(main)/admin/model-billing-matrix'),
    'Desktop > Admin > Model Billing Matrix',
  ),
  path: 'model-billing-matrix',
},
```

Place it near `newapi-providers` and `pricing`.

- [ ] **Step 4: Create route entry**

Create `src/routes/(main)/admin/model-billing-matrix/index.tsx`:

```tsx
import AdminModelBillingMatrixPage from '@/features/Admin/AdminModelBillingMatrixPage';

export default AdminModelBillingMatrixPage;
```

- [ ] **Step 5: Run navigation tests**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminNavigation.test.ts
```

Expected: fails only because page component does not exist yet, or passes if dynamic import is not resolved by the test.

Do not commit until Task 4 creates the page.

---

### Task 4: Matrix Page UI and Save Actions

**Files:**

- Create: `src/features/Admin/AdminModelBillingMatrixPage.tsx`
- Modify: `src/features/Admin/adminModelBillingMatrix.ts`
- Modify: `src/services/adminCommercial.ts` only if method names need adjustment.

- [ ] **Step 1: Create first page implementation**

Create `src/features/Admin/AdminModelBillingMatrixPage.tsx`:

```tsx
'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, InputNumber, message, Space, Switch, Table, Tag, Typography } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMIN_SETTINGS_SWR_KEY,
  SETTING_KEYS,
  getAdminSettingsRefreshKeys,
} from '@/features/Admin/adminSettingsForm';
import {
  type MatrixRow,
  buildMatrixRows,
  buildPlanModelRulesFromRows,
  buildPricingRulesFromRows,
  togglePlanAccess,
} from '@/features/Admin/adminModelBillingMatrix';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const MATRIX_KEY = ['admin-model-billing-matrix'];
const PLANS_KEY = ['admin-plans'];

const AdminModelBillingMatrixPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [rowsOverride, setRowsOverride] = useState<MatrixRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: modelData, isLoading: modelsLoading } = useClientDataSWR(MATRIX_KEY, () =>
    adminCommercialService.listAllEnabledNewapiModels(),
  );
  const { data: planData, isLoading: plansLoading } = useClientDataSWR(PLANS_KEY, () =>
    adminCommercialService.listPlans(),
  );
  const { data: settings, isLoading: settingsLoading } = useClientDataSWR(
    ADMIN_SETTINGS_SWR_KEY,
    () => adminCommercialService.getAllSettings(),
  );

  const plans = useMemo(
    () =>
      (planData?.items ?? []).map((plan: any) => ({
        displayName: plan.displayName,
        plan: plan.plan,
      })),
    [planData],
  );

  const baseRows = useMemo(
    () =>
      buildMatrixRows({
        defaultModel: settings?.defaultAgentModel,
        defaultProvider: settings?.defaultAgentProvider,
        models: (modelData?.items ?? []).map((item: any) => ({
          displayName: item.displayName,
          instanceId: item.instanceId,
          instanceName: item.instanceName,
          modelId: item.modelId,
          modelType: item.modelType,
          priority: item.priority,
        })),
        plans,
        pricingRules: settings?.pricingModelRules ?? [],
        planRulesByPlan: Object.fromEntries(
          (planData?.items ?? []).map((plan: any) => [plan.plan, plan.modelRules]),
        ),
      }),
    [modelData, planData, plans, settings],
  );

  const rows = rowsOverride ?? baseRows;
  const loading = modelsLoading || plansLoading || settingsLoading;

  const updateRow = (rowKey: string, patch: Partial<MatrixRow>) => {
    setRowsOverride((current) =>
      (current ?? baseRows).map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  };

  const handleSetDefault = async (row: MatrixRow) => {
    setSaving(true);
    try {
      const updates = [
        { key: SETTING_KEYS.defaultAgentProvider, value: row.provider },
        { key: SETTING_KEYS.defaultAgentModel, value: row.modelId },
      ];
      await Promise.all(updates.map((update) => adminCommercialService.setAppSetting(update)));
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      for (const key of getAdminSettingsRefreshKeys(updates)) {
        await mutate(key);
      }
      message.success(t('admin.modelBillingMatrix.defaultSaved', '默认模型已保存'));
    } catch {
      message.error(t('admin.modelBillingMatrix.defaultSaveFailed', '保存默认模型失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccess = async () => {
    setSaving(true);
    try {
      const rulesByPlan = buildPlanModelRulesFromRows(rows, plans);
      await Promise.all(
        Object.entries(rulesByPlan).map(([plan, modelRules]) =>
          adminCommercialService.setPlanModelRules({ modelRules: modelRules as any, plan }),
        ),
      );
      await mutate(PLANS_KEY);
      message.success(t('admin.modelBillingMatrix.accessSaved', '套餐模型权限已保存'));
    } catch {
      message.error(t('admin.modelBillingMatrix.accessSaveFailed', '保存套餐模型权限失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      await adminCommercialService.setAppSetting({
        key: SETTING_KEYS.pricingModelRules,
        value: buildPricingRulesFromRows(rows),
      });
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      message.success(t('admin.modelBillingMatrix.pricingSaved', '模型计费规则已保存'));
    } catch {
      message.error(t('admin.modelBillingMatrix.pricingSaveFailed', '保存模型计费规则失败'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      dataIndex: 'modelId',
      key: 'modelId',
      render: (_: unknown, row: MatrixRow) => (
        <Flexbox gap={4}>
          <Text strong>{row.displayName}</Text>
          <Text type="secondary">{row.modelId}</Text>
          <Space size={4}>
            <Tag>{row.provider}</Tag>
            <Tag>{row.modelType}</Tag>
            {row.isDefault && <Tag color="green">默认</Tag>}
          </Space>
        </Flexbox>
      ),
      title: t('admin.modelBillingMatrix.col.model', '模型'),
      width: 260,
    },
    {
      dataIndex: 'instanceNames',
      key: 'instanceNames',
      render: (names: string[]) => names.join(' / '),
      title: t('admin.modelBillingMatrix.col.instances', '来源实例'),
      width: 220,
    },
    ...plans.map((plan) => ({
      key: `plan-${plan.plan}`,
      render: (_: unknown, row: MatrixRow) => (
        <Switch
          checked={row.planAccess[plan.plan] !== false}
          size="small"
          onChange={(checked) =>
            setRowsOverride((current) =>
              togglePlanAccess(current ?? baseRows, row.key, plan.plan, checked),
            )
          }
        />
      ),
      title: plan.displayName || plan.plan,
      width: 96,
    })),
    {
      dataIndex: 'pricingMultiplier',
      key: 'pricingMultiplier',
      render: (value: number | undefined, row: MatrixRow) => (
        <InputNumber
          min={0}
          placeholder="默认"
          precision={4}
          size="small"
          step={0.1}
          style={{ width: 96 }}
          value={value}
          onChange={(next) =>
            updateRow(row.key, {
              pricingMultiplier: typeof next === 'number' ? next : undefined,
            })
          }
        />
      ),
      title: t('admin.modelBillingMatrix.col.multiplier', '倍率'),
      width: 120,
    },
    {
      dataIndex: 'creditsPerDollar',
      key: 'creditsPerDollar',
      render: (value: number | undefined, row: MatrixRow) => (
        <InputNumber
          min={1}
          placeholder="默认"
          size="small"
          style={{ width: 130 }}
          value={value}
          onChange={(next) =>
            updateRow(row.key, {
              creditsPerDollar: typeof next === 'number' ? next : undefined,
            })
          }
        />
      ),
      title: t('admin.modelBillingMatrix.col.creditsPerDollar', '每美元积分'),
      width: 150,
    },
    {
      key: 'actions',
      render: (_: unknown, row: MatrixRow) => (
        <Button disabled={row.isDefault} size="small" onClick={() => handleSetDefault(row)}>
          {row.isDefault ? '当前默认' : '设为默认'}
        </Button>
      ),
      title: t('admin.modelBillingMatrix.col.actions', '操作'),
      width: 120,
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.modelBillingMatrix.title', '模型与计费矩阵')}
        </Title>
        <Text type="secondary">
          {t(
            'admin.modelBillingMatrix.subtitle',
            '统一查看模型来源、套餐权限、默认模型和计费倍率。当前版本复用现有设置存储，不新增数据库表。',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        message={t(
          'admin.modelBillingMatrix.notice',
          '套餐权限保存为按套餐/模型类型的允许列表。未关闭任何模型时，该套餐保持不限制。',
        )}
        type="info"
      />

      <Space>
        <Button loading={saving} type="primary" onClick={handleSaveAccess}>
          保存套餐权限
        </Button>
        <Button loading={saving} onClick={handleSavePricing}>
          保存计费规则
        </Button>
        {rowsOverride && (
          <Button onClick={() => setRowsOverride(null)}>
            放弃本页未保存调整
          </Button>
        )}
      </Space>

      <Table
        columns={columns as any}
        dataSource={rows}
        loading={loading}
        pagination={false}
        rowKey="key"
        scroll={{ x: 900 + plans.length * 100 }}
      />
    </Flexbox>
  );
});

AdminModelBillingMatrixPage.displayName = 'AdminModelBillingMatrixPage';

export default AdminModelBillingMatrixPage;
```

- [ ] **Step 2: Run route/page lint**

Run:

```bash
pnpm exec eslint src/features/Admin/AdminModelBillingMatrixPage.tsx src/features/Admin/adminModelBillingMatrix.ts
```

Expected: exits without errors after applying `--fix` if necessary.

- [ ] **Step 3: Commit route and page**

```bash
git add src/features/Admin/AdminModelBillingMatrixPage.tsx src/routes/\(main\)/admin/model-billing-matrix/index.tsx src/features/Admin/adminNavigation.ts src/features/Admin/adminNavigation.test.ts src/business/client/BusinessDesktopRoutes.tsx
git commit -m "feat: add admin model billing matrix page"
```

---

### Task 5: Final Verification

**Files:**

- Verify only.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run src/features/Admin/adminModelBillingMatrix.test.ts src/features/Admin/adminNavigation.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run lint on touched files**

Run:

```bash
pnpm exec eslint src/features/Admin/adminModelBillingMatrix.ts src/features/Admin/adminModelBillingMatrix.test.ts src/features/Admin/AdminModelBillingMatrixPage.tsx src/features/Admin/adminNavigation.ts src/features/Admin/adminNavigation.test.ts src/business/client/BusinessDesktopRoutes.tsx src/routes/\\(main\\)/admin/model-billing-matrix/index.tsx
```

Expected: exits without errors.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
pnpm type-check
```

Expected: exits without errors.

- [ ] **Step 4: Manual UI check**

Start the dev server if needed and open `/settings/admin/model-billing-matrix`.

Check:

- The page loads without blank screen.
- NewAPI models are deduplicated by provider/type/model.
- Plan columns appear from `plan_catalog`.
- Default model tag appears on the configured default model.
- Plan switches can be toggled locally.
- Saving permissions calls existing plan model rules mutation.
- Saving pricing calls app setting mutation for `pricing.modelRules`.
- Setting default model updates both provider and model.

