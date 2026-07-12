# P2 Admin Settings Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight, testable governance layer for admin app settings so operators can see which settings are registered, persisted, sensitive, public, cached, or legacy/unknown before larger admin UI cleanup.

**Architecture:** Keep the existing `APP_SETTING_REGISTRY`, `adminSettingsRouter`, and admin settings page. Add a pure diagnostics builder that summarizes persisted `app_settings` rows against the registry, expose it through a read-only admin query, then render a compact health card in the existing site settings page. Do not restructure the entire admin navigation in P2.

**Tech Stack:** Next.js 16, React 19, TypeScript, TRPC, Drizzle/PostgreSQL, SWR, antd, Vitest.

---

## File Structure

- `src/const/appSettingsRegistry.ts`
  - Add small registry helper exports for stable ordering and typed list access.
- `src/server/services/appSettings/governance.ts`
  - Create a pure server-side diagnostics builder. It accepts persisted app setting rows and returns summary counts, domain groups, cache scope groups, unknown keys, and sensitive configured keys without exposing setting values.
- `src/server/services/appSettings/governance.test.ts`
  - Unit tests for registry diagnostics, unknown key detection, sensitive redaction, and deterministic sorting.
- `packages/business-server/src/lambda-routers/admin/settings.ts`
  - Add a read-only `getGovernance` admin query that fetches `appSettings` rows and returns the diagnostics result.
- `packages/business-server/src/lambda-routers/admin/settings.test.ts`
  - Router test for `getGovernance`, including unknown key and sensitive key behavior.
- `src/services/adminCommercial.ts`
  - Add `getAppSettingsGovernance` client service helper.
- `src/features/Admin/AdminSettingsGovernanceCard.tsx`
  - Create a compact settings health card for the admin settings page.
- `src/features/Admin/AdminSettingsPage.tsx`
  - Render `AdminSettingsGovernanceCard` above the settings form.
- `src/features/Admin/adminCommercialFlow.test.ts`
  - Static integration test proving router, service, and page wiring stay connected.

---

### Task 1: Build Pure Settings Governance Diagnostics

**Files:**
- Modify: `src/const/appSettingsRegistry.ts`
- Create: `src/server/services/appSettings/governance.ts`
- Create: `src/server/services/appSettings/governance.test.ts`

- [ ] **Step 1: Add failing diagnostics tests**

Create `src/server/services/appSettings/governance.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';

import { buildAppSettingsGovernance } from './governance';

describe('buildAppSettingsGovernance', () => {
  it('reports registered, persisted, unknown and sensitive setting counts', () => {
    const result = buildAppSettingsGovernance([
      { key: APP_SETTING_KEYS.brandName, value: 'ComHub' },
      { key: APP_SETTING_KEYS.storageS3SecretAccessKey, value: 'secret-value' },
      { key: 'legacy.unknown.key', value: 'legacy-value' },
    ]);

    expect(result.summary.persistedCount).toBe(3);
    expect(result.summary.unknownCount).toBe(1);
    expect(result.summary.sensitiveConfiguredCount).toBe(1);
    expect(result.unknownKeys).toEqual([{ key: 'legacy.unknown.key' }]);
    expect(result.sensitiveConfiguredKeys).toEqual([
      expect.objectContaining({
        key: APP_SETTING_KEYS.storageS3SecretAccessKey,
        sensitive: true,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(JSON.stringify(result)).not.toContain('legacy-value');
  });

  it('groups registered settings by domain and cache scope with deterministic ordering', () => {
    const result = buildAppSettingsGovernance([
      { key: APP_SETTING_KEYS.brandName, value: 'ComHub' },
      { key: APP_SETTING_KEYS.defaultAgentModel, value: 'gpt-5.5' },
      { key: APP_SETTING_KEYS.storageS3Bucket, value: 'bucket' },
    ]);

    expect(result.domainGroups.map((group) => group.domain)).toEqual(
      [...result.domainGroups.map((group) => group.domain)].sort(),
    );
    expect(result.cacheScopeGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cacheScope: 'app-settings' }),
        expect.objectContaining({ cacheScope: 'brand' }),
        expect.objectContaining({ cacheScope: 'runtime' }),
        expect.objectContaining({ cacheScope: 's3' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts
```

Expected: fail because `governance.ts` does not exist.

- [ ] **Step 3: Add registry helper exports**

In `src/const/appSettingsRegistry.ts`, add after `APP_SETTING_REGISTRY`:

```typescript
export const listAppSettingRegistryItems = () =>
  Object.values(APP_SETTING_REGISTRY).sort((a, b) => a.key.localeCompare(b.key));

export const isKnownAppSettingKey = (key: AppSettingKey | string) =>
  Boolean(getAppSettingRegistryItem(key));
```

- [ ] **Step 4: Implement diagnostics builder**

Create `src/server/services/appSettings/governance.ts`:

```typescript
import {
  getAppSettingRegistryItem,
  type AppSettingDomain,
  type AppSettingRegistryItem,
  listAppSettingRegistryItems,
} from '@/const/appSettingsRegistry';

type AppSettingsGovernanceInputRow = {
  key: string;
  updatedAt?: Date | null;
  value?: unknown;
};

type AppSettingsGovernanceRegisteredRow = Pick<
  AppSettingRegistryItem,
  'cacheScopes' | 'domain' | 'key' | 'publicRuntime' | 'sensitive'
> & {
  configured: boolean;
  hasValue: boolean;
};

export type AppSettingsGovernance = {
  cacheScopeGroups: Array<{ cacheScope: string; configuredCount: number; registeredCount: number }>;
  domainGroups: Array<{
    configuredCount: number;
    domain: AppSettingDomain;
    registeredCount: number;
    sensitiveConfiguredCount: number;
  }>;
  registeredSettings: AppSettingsGovernanceRegisteredRow[];
  sensitiveConfiguredKeys: AppSettingsGovernanceRegisteredRow[];
  summary: {
    configuredRegisteredCount: number;
    persistedCount: number;
    publicRuntimeConfiguredCount: number;
    registeredCount: number;
    sensitiveConfiguredCount: number;
    unknownCount: number;
  };
  unknownKeys: Array<{ key: string }>;
};

const hasPersistedValue = (value: unknown) => value !== null && value !== undefined && value !== '';

export const buildAppSettingsGovernance = (
  rows: AppSettingsGovernanceInputRow[],
): AppSettingsGovernance => {
  const persistedByKey = new Map(rows.map((row) => [row.key, row]));
  const registeredSettings = listAppSettingRegistryItems().map((item) => {
    const row = persistedByKey.get(item.key);

    return {
      cacheScopes: item.cacheScopes,
      configured: Boolean(row),
      domain: item.domain,
      hasValue: row ? hasPersistedValue(row.value) : false,
      key: item.key,
      publicRuntime: item.publicRuntime,
      sensitive: item.sensitive,
    };
  });
  const unknownKeys = rows
    .filter((row) => !getAppSettingRegistryItem(row.key))
    .map((row) => ({ key: row.key }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const sensitiveConfiguredKeys = registeredSettings.filter(
    (item) => item.configured && item.sensitive,
  );
  const domainGroups = Array.from(
    registeredSettings.reduce(
      (groups, item) => {
        const current = groups.get(item.domain) ?? {
          configuredCount: 0,
          domain: item.domain,
          registeredCount: 0,
          sensitiveConfiguredCount: 0,
        };
        current.registeredCount += 1;
        if (item.configured) current.configuredCount += 1;
        if (item.configured && item.sensitive) current.sensitiveConfiguredCount += 1;
        groups.set(item.domain, current);
        return groups;
      },
      new Map<AppSettingDomain, AppSettingsGovernance['domainGroups'][number]>(),
    ).values(),
  ).sort((a, b) => a.domain.localeCompare(b.domain));
  const cacheScopeGroups = Array.from(
    registeredSettings.reduce(
      (groups, item) => {
        for (const cacheScope of item.cacheScopes) {
          const current = groups.get(cacheScope) ?? {
            cacheScope,
            configuredCount: 0,
            registeredCount: 0,
          };
          current.registeredCount += 1;
          if (item.configured) current.configuredCount += 1;
          groups.set(cacheScope, current);
        }
        return groups;
      },
      new Map<string, AppSettingsGovernance['cacheScopeGroups'][number]>(),
    ).values(),
  ).sort((a, b) => a.cacheScope.localeCompare(b.cacheScope));

  return {
    cacheScopeGroups,
    domainGroups,
    registeredSettings,
    sensitiveConfiguredKeys,
    summary: {
      configuredRegisteredCount: registeredSettings.filter((item) => item.configured).length,
      persistedCount: rows.length,
      publicRuntimeConfiguredCount: registeredSettings.filter(
        (item) => item.configured && item.publicRuntime,
      ).length,
      registeredCount: registeredSettings.length,
      sensitiveConfiguredCount: sensitiveConfiguredKeys.length,
      unknownCount: unknownKeys.length,
    },
    unknownKeys,
  };
};
```

- [ ] **Step 5: Run the green test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts
```

Expected: pass.

---

### Task 2: Expose Governance Through Admin Settings Router

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`

- [ ] **Step 1: Add failing router test**

In `settings.test.ts`, add a test inside the existing `describe`:

```typescript
it('returns app settings governance without exposing persisted values', async () => {
  const db = createDb({
    appSettingsMany: [
      { key: APP_SETTING_KEYS.brandName, value: 'ComHub' },
      { key: APP_SETTING_KEYS.storageS3SecretAccessKey, value: 'admin-secret-key' },
      { key: 'legacy.unknown.key', value: 'legacy-value' },
    ],
  });
  vi.mocked(getServerDB).mockResolvedValue(db);

  const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
  const result = await caller.getGovernance();

  expect(result.summary.unknownCount).toBe(1);
  expect(result.summary.sensitiveConfiguredCount).toBe(1);
  expect(result.unknownKeys).toEqual([{ key: 'legacy.unknown.key' }]);
  expect(result.sensitiveConfiguredKeys).toEqual([
    expect.objectContaining({ key: APP_SETTING_KEYS.storageS3SecretAccessKey }),
  ]);
  expect(JSON.stringify(result)).not.toContain('admin-secret-key');
  expect(JSON.stringify(result)).not.toContain('legacy-value');
});
```

- [ ] **Step 2: Run the red router test**

Run:

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts -t governance
```

Expected: fail because `getGovernance` is not defined.

- [ ] **Step 3: Implement router query**

In `settings.ts`, import:

```typescript
import { buildAppSettingsGovernance } from '@/server/services/appSettings/governance';
```

Add this router member near `getAll`:

```typescript
  getGovernance: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.serverDB.query.appSettings.findMany({
      columns: {
        key: true,
        updatedAt: true,
        value: true,
      },
    });

    return buildAppSettingsGovernance(rows);
  }),
```

- [ ] **Step 4: Run the green router test**

Run the same Vitest command. Expected: pass.

---

### Task 3: Add Client Service Helper And Admin Health Card

**Files:**
- Modify: `src/services/adminCommercial.ts`
- Create: `src/features/Admin/AdminSettingsGovernanceCard.tsx`
- Modify: `src/features/Admin/AdminSettingsPage.tsx`
- Modify: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Add failing static integration test**

In `adminCommercialFlow.test.ts`, add:

```typescript
it('surfaces app settings governance in the admin settings page', () => {
  const settingsRouter = readRepoFile(
    'packages/business-server/src/lambda-routers/admin/settings.ts',
  );
  const service = readRepoFile('src/services/adminCommercial.ts');
  const settingsPage = readRepoFile('src/features/Admin/AdminSettingsPage.tsx');
  const governanceCard = readRepoFile('src/features/Admin/AdminSettingsGovernanceCard.tsx');

  expect(settingsRouter).toContain('getGovernance: adminProcedure.query');
  expect(service).toContain('getAppSettingsGovernance');
  expect(service).toContain('admin.settings.getGovernance.query()');
  expect(settingsPage).toContain('AdminSettingsGovernanceCard');
  expect(governanceCard).toContain('unknownKeys');
  expect(governanceCard).toContain('sensitiveConfiguredKeys');
  expect(governanceCard).not.toContain('value');
});
```

- [ ] **Step 2: Run the red static test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts -t governance
```

Expected: fail because service/card/page wiring does not exist.

- [ ] **Step 3: Add service helper**

In `src/services/adminCommercial.ts`, add near the settings helpers:

```typescript
  getAppSettingsGovernance = async () => {
    return lambdaClient.admin.settings.getGovernance.query();
  };
```

- [ ] **Step 4: Create governance card**

Create `src/features/Admin/AdminSettingsGovernanceCard.tsx`:

```tsx
'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, List, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import { memo } from 'react';

import { Card } from '@/components/antd-compat/Card';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text } = Typography;
const GOVERNANCE_SWR_KEY = 'admin:settings:governance';

const AdminSettingsGovernanceCard = memo(() => {
  const { data, isLoading, mutate } = useClientDataSWR(GOVERNANCE_SWR_KEY, () =>
    adminCommercialService.getAppSettingsGovernance(),
  );

  if (isLoading && !data) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  if (!data) return null;

  const hasUnknownKeys = data.unknownKeys.length > 0;

  return (
    <Card
      extra={
        <Button size="small" onClick={() => mutate()}>
          刷新
        </Button>
      }
      title="设置治理健康检查"
    >
      <Flexbox gap={16}>
        <Space wrap>
          <Statistic title="已注册设置" value={data.summary.registeredCount} />
          <Statistic title="已写入设置" value={data.summary.persistedCount} />
          <Statistic title="未知设置" value={data.summary.unknownCount} />
          <Statistic title="敏感设置已配置" value={data.summary.sensitiveConfiguredCount} />
        </Space>
        {hasUnknownKeys ? (
          <Alert
            showIcon
            message="发现未注册设置项"
            description="这些 key 可能来自旧版本、手工写库或已经迁移的功能。建议确认后迁移或清理，避免后台出现重复设置或配置不生效。"
            type="warning"
          />
        ) : (
          <Alert showIcon message="没有发现未注册设置项" type="success" />
        )}
        {hasUnknownKeys && (
          <List
            bordered
            dataSource={data.unknownKeys}
            size="small"
            renderItem={(item) => <List.Item>{item.key}</List.Item>}
          />
        )}
        {data.sensitiveConfiguredKeys.length > 0 && (
          <Flexbox gap={8}>
            <Text type="secondary">已配置敏感项只显示 key，不显示值：</Text>
            <Space wrap>
              {data.sensitiveConfiguredKeys.map((item) => (
                <Tag key={item.key} color="red">
                  {item.key}
                </Tag>
              ))}
            </Space>
          </Flexbox>
        )}
      </Flexbox>
    </Card>
  );
});

AdminSettingsGovernanceCard.displayName = 'AdminSettingsGovernanceCard';

export default AdminSettingsGovernanceCard;
```

- [ ] **Step 5: Render the card**

In `AdminSettingsPage.tsx`, import and render above the `<Form>`:

```tsx
import AdminSettingsGovernanceCard from './AdminSettingsGovernanceCard';
```

```tsx
<AdminSettingsGovernanceCard />
```

- [ ] **Step 6: Run the green static test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts -t governance
```

Expected: pass.

---

### Task 4: Verification, Review, And Commit

**Files:**
- All files changed by Tasks 1-3.

- [ ] **Step 1: Run targeted verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Run:

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts
```

- [ ] **Step 2: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git diff
```

Confirm:
- Governance output never includes persisted values.
- Unknown key diagnostics are read-only.
- Sensitive configured keys show only metadata.
- No admin navigation restructure happened in P2.
- The P2 plan file is included with `git add -f` because `docs/superpowers/` is ignored.

- [ ] **Step 3: Commit P2**

Commit only P2 changes:

```powershell
git add -f docs/superpowers/plans/2026-07-06-p2-admin-settings-governance.md
git add src/const/appSettingsRegistry.ts src/server/services/appSettings/governance.ts src/server/services/appSettings/governance.test.ts packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/services/adminCommercial.ts src/features/Admin/AdminSettingsGovernanceCard.tsx src/features/Admin/AdminSettingsPage.tsx src/features/Admin/adminCommercialFlow.test.ts
git commit -m "add admin settings governance p2"
```

Commit body trailers:

```text
Constraint: keep admin route structure unchanged in P2
Tested: <commands that passed>
Not-tested: <commands skipped with reason>
```
