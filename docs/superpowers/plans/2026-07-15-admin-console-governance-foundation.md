# Admin Console Governance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 admin governance foundation so navigation, route registration, feature status, and read/write capabilities have explicit contracts without changing existing business APIs or deleting legacy deep links.

**Architecture:** Add a frontend-only Admin catalog that drives navigation and route registration, while shared capability IDs remain in `@lobechat/types` for both frontend and backend. Migrate read-only tRPC procedures to read capabilities, isolate Module App administration behind its own capability pair, and keep compatibility routes as explicit non-menu entries.

**Tech Stack:** TypeScript, React 19, React Router, tRPC, Vitest, `@lobechat/types`, `@lobehub/ui`, antd.

## Global Constraints

- `/settings/admin` remains the only canonical admin base path.
- `/admin/*`, `pricing`, `topup`, and `change-requests` remain compatibility behavior; do not delete their source files in this phase.
- Do not add database migrations or change database schemas.
- Do not rename tRPC routers or procedure names; existing client contracts must remain valid.
- Do not implement platform plan/top-up Alipay payment in this phase.
- Do not move or expose any Alipay private key, certificate, S3 secret, Composio key, or provider API key.
- Module App Alipay payment/refund/payout behavior and idempotency must remain unchanged.
- Keep `src/spa/router/desktopRouter.config.tsx` and `src/spa/router/desktopRouter.config.desktop.tsx` synchronized.
- Route files remain unchanged except for compatibility annotations/tests; page extraction belongs to Phase 3.
- Use focused Vitest commands. Do not run the full `bun run test` suite by default.
- Preserve unrelated user changes and do not reset or revert the worktree.
- Each implementation commit follows the Lore protocol: intent line first, then only useful trailers.

---

## File Structure

### New files

- `src/features/Admin/adminCatalog.ts`: frontend Admin group and route metadata; no React imports.
- `src/features/Admin/adminCatalog.test.ts`: catalog uniqueness, grouping, status, capability, and compatibility tests.

### Files changed together

- `src/features/Admin/adminNavigation.ts`: derives menu groups, aliases, selected path, and route access from `adminCatalog.ts`.
- `src/features/Admin/adminNavigation.test.ts`: verifies the new information architecture and scoped-role access.
- `src/business/client/adminSettingsRouteRegistry.ts`: maps catalog route IDs to lazy page imports and appends compatibility routes.
- `src/business/client/BusinessDesktopRoutes.test.ts`: verifies catalog/route parity and one canonical settings route.
- `packages/types/src/admin.ts`: shared capability IDs and default role capability sets.
- `packages/types/src/admin.test.ts`: shared capability contract tests.
- `packages/trpc/src/lambda/middleware/__tests__/adminPermissions.test.ts`: server re-export and full-admin compatibility tests.
- `packages/trpc/src/lambda/middleware/__tests__/requireSuperAdmin.test.ts`: middleware acceptance/rejection tests for new read capabilities.
- `packages/business-server/src/lambda-routers/admin/{users,content,newapiProviders,settings,ppt,moduleApps}.ts`: read/write procedure binding.
- `packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts`: static procedure-to-capability contract.
- `src/features/Admin/adminCommercialFlow.test.ts`: update existing source assertions that refer to procedure names.
- `src/routes/(main)/admin/_layout/index.test.tsx`: canonical-path route guard coverage.
- `src/routes/(main)/settings/admin/index.tsx`: add an explicit deprecation annotation only; do not remove behavior.
- `docs/development/admin-refactor-progress.zh-CN.md`: record the completed Phase 1 boundaries.

---

### Task 1: Expand The Shared Admin Capability Contract

**Files:**
- Modify: `packages/types/src/admin.ts`
- Modify: `packages/types/src/admin.test.ts`
- Modify: `packages/trpc/src/lambda/middleware/__tests__/adminPermissions.test.ts`
- Modify: `packages/trpc/src/lambda/middleware/__tests__/requireSuperAdmin.test.ts`

**Interfaces:**
- Consumes: existing `AdminRole`, `ADMIN_ROLE_IDS`, `hasAdminCapability`, and `adminCapabilityProcedure` contracts.
- Produces: `contentRead`, `modelOpsRead`, `moduleAppRead`, `moduleAppWrite`, `supportRead`, `systemRead`, and `userRead` capability IDs.

- [ ] **Step 1: Write failing shared capability tests**

Update `packages/types/src/admin.test.ts` with exact capability and role expectations:

```ts
it('publishes read/write capability pairs for every governed admin domain', () => {
  expect(ADMIN_CAPABILITIES).toMatchObject({
    contentRead: 'content.read',
    contentWrite: 'content.write',
    modelOpsRead: 'modelOps.read',
    modelOpsWrite: 'modelOps.write',
    moduleAppRead: 'moduleApp.read',
    moduleAppWrite: 'moduleApp.write',
    supportRead: 'support.read',
    supportWrite: 'support.write',
    systemRead: 'system.read',
    systemWrite: 'system.write',
    userRead: 'user.read',
    userWrite: 'user.write',
  });
});

it('grants scoped roles their read capability without cross-domain access', () => {
  expect(getAdminRoleCapabilities('content_admin')).toEqual(
    expect.arrayContaining([
      ADMIN_CAPABILITIES.auditRead,
      ADMIN_CAPABILITIES.contentRead,
      ADMIN_CAPABILITIES.contentWrite,
    ]),
  );
  expect(getAdminRoleCapabilities('model_ops')).toEqual(
    expect.arrayContaining([
      ADMIN_CAPABILITIES.auditRead,
      ADMIN_CAPABILITIES.modelOpsRead,
      ADMIN_CAPABILITIES.modelOpsWrite,
    ]),
  );
  expect(getAdminRoleCapabilities('support_admin')).toEqual(
    expect.arrayContaining([
      ADMIN_CAPABILITIES.auditRead,
      ADMIN_CAPABILITIES.supportRead,
      ADMIN_CAPABILITIES.supportWrite,
      ADMIN_CAPABILITIES.userRead,
    ]),
  );
  expect(getAdminRoleCapabilities('system_admin')).toEqual(
    expect.arrayContaining([
      ADMIN_CAPABILITIES.auditRead,
      ADMIN_CAPABILITIES.systemRead,
      ADMIN_CAPABILITIES.systemWrite,
    ]),
  );
  expect(hasAdminCapability('content_admin', ADMIN_CAPABILITIES.moduleAppWrite)).toBe(false);
  expect(hasAdminCapability('support_admin', ADMIN_CAPABILITIES.financeWrite)).toBe(false);
});
```

Add a read-capability route to `requireSuperAdmin.test.ts`:

```ts
const testRouter = trpc.router({
  contentRead: trpc.procedure
    .use(requireAdminCapability(ADMIN_CAPABILITIES.contentRead))
    .query(({ ctx }) => ({ adminRole: (ctx as any).adminRole })),
  // keep existing finance and ping procedures
});

it('accepts a scoped role for its read capability', async () => {
  const caller = createCaller({
    serverDB: createServerDB({ banned: false, role: 'content_admin' }),
    userId: 'content-user',
  } as any);

  await expect(caller.contentRead()).resolves.toEqual({ adminRole: 'content_admin' });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/types/src/admin.test.ts packages/trpc/src/lambda/middleware/__tests__/adminPermissions.test.ts packages/trpc/src/lambda/middleware/__tests__/requireSuperAdmin.test.ts
```

Expected: FAIL because `contentRead`, `modelOpsRead`, `moduleAppRead`, `moduleAppWrite`, `supportRead`, `systemRead`, and `userRead` do not exist.

- [ ] **Step 3: Add the capability IDs and role mappings**

Replace the capability object and scoped role mapping in `packages/types/src/admin.ts` with:

```ts
export const ADMIN_CAPABILITIES = {
  adminAccess: 'admin.access',
  auditRead: 'audit.read',
  contentRead: 'content.read',
  contentWrite: 'content.write',
  financeRead: 'finance.read',
  financeWrite: 'finance.write',
  modelOpsRead: 'modelOps.read',
  modelOpsWrite: 'modelOps.write',
  moduleAppRead: 'moduleApp.read',
  moduleAppWrite: 'moduleApp.write',
  supportRead: 'support.read',
  supportWrite: 'support.write',
  systemRead: 'system.read',
  systemWrite: 'system.write',
  userRead: 'user.read',
  userWrite: 'user.write',
} as const;

export const ADMIN_ROLE_CAPABILITIES: Record<AdminRole, AdminRoleCapabilitySet> = {
  admin: '*',
  content_admin: [
    ADMIN_CAPABILITIES.contentRead,
    ADMIN_CAPABILITIES.contentWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
  finance_admin: [
    ADMIN_CAPABILITIES.financeRead,
    ADMIN_CAPABILITIES.financeWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
  model_ops: [
    ADMIN_CAPABILITIES.modelOpsRead,
    ADMIN_CAPABILITIES.modelOpsWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
  support_admin: [
    ADMIN_CAPABILITIES.supportRead,
    ADMIN_CAPABILITIES.supportWrite,
    ADMIN_CAPABILITIES.userRead,
    ADMIN_CAPABILITIES.auditRead,
  ],
  system_admin: [
    ADMIN_CAPABILITIES.systemRead,
    ADMIN_CAPABILITIES.systemWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
};
```

Do not add `moduleAppRead` or `moduleAppWrite` to a scoped role in this phase. Full `admin` receives them through `'*'`.

- [ ] **Step 4: Run the capability tests**

Run the command from Step 2.

Expected: PASS. `adminPermissions.test.ts` must also prove that full `admin` automatically has every newly added capability.

- [ ] **Step 5: Commit the shared contract**

```powershell
git add packages/types/src/admin.ts packages/types/src/admin.test.ts packages/trpc/src/lambda/middleware/__tests__/adminPermissions.test.ts packages/trpc/src/lambda/middleware/__tests__/requireSuperAdmin.test.ts
git commit -m "refactor: define admin read capability pairs" -m "Constraint: Keep existing role IDs and full-admin wildcard behavior." -m "Tested: focused admin capability and middleware tests."
```

---

### Task 2: Introduce The Admin Catalog And Derive Navigation

**Files:**
- Create: `src/features/Admin/adminCatalog.ts`
- Create: `src/features/Admin/adminCatalog.test.ts`
- Modify: `src/features/Admin/adminNavigation.ts`
- Modify: `src/features/Admin/adminNavigation.test.ts`

**Interfaces:**
- Consumes: `ADMIN_CAPABILITIES`, `AdminCapability`, `hasAdminCapability`, and `ADMIN_BASE_PATH`.
- Produces: `ADMIN_CATALOG_GROUPS`, `ADMIN_CATALOG`, `ADMIN_LEGACY_ROUTES`, `AdminCatalogId`, `AdminFeatureStatus`, and catalog-driven `ADMIN_NAV_GROUPS`.

- [ ] **Step 1: Write the failing catalog contract test**

Create `src/features/Admin/adminCatalog.test.ts`:

```ts
import { ADMIN_CAPABILITIES } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  ADMIN_LEGACY_ROUTES,
} from './adminCatalog';

describe('adminCatalog', () => {
  it('defines the approved eight admin groups in order', () => {
    expect(ADMIN_CATALOG_GROUPS.map((group) => group.key)).toEqual([
      'overview',
      'user-access',
      'commercial',
      'ai-platform',
      'module-apps',
      'content-operations',
      'client-integrations',
      'system-security',
    ]);
  });

  it('keeps route IDs, segments, and paths unique', () => {
    expect(new Set(ADMIN_CATALOG.map((item) => item.id)).size).toBe(ADMIN_CATALOG.length);
    expect(new Set(ADMIN_CATALOG.map((item) => item.segment)).size).toBe(ADMIN_CATALOG.length);
    expect(new Set(ADMIN_CATALOG.map((item) => item.path)).size).toBe(ADMIN_CATALOG.length);
  });

  it('keeps compatibility routes outside the visible catalog', () => {
    expect(ADMIN_LEGACY_ROUTES).toEqual([
      { segment: 'pricing', targetSegment: 'model-billing-matrix' },
      { segment: 'topup', targetSegment: 'orders' },
      { segment: 'change-requests', targetSegment: 'subscriptions' },
    ]);
    expect(ADMIN_CATALOG.map((item) => item.segment)).not.toEqual(
      expect.arrayContaining(['pricing', 'topup', 'change-requests']),
    );
  });

  it('assigns read capabilities to high-risk domains', () => {
    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(byId.users.readCapability).toBe(ADMIN_CAPABILITIES.userRead);
    expect(byId.providers.readCapability).toBe(ADMIN_CAPABILITIES.modelOpsRead);
    expect(byId.topics.readCapability).toBe(ADMIN_CAPABILITIES.contentRead);
    expect(byId.settings.readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId['module-apps'].readCapability).toBe(ADMIN_CAPABILITIES.moduleAppRead);
  });
});
```

Update `adminNavigation.test.ts` to expect the new group keys:

```ts
expect(ADMIN_NAV_GROUPS.map((group) => group.key)).toEqual([
  'overview',
  'user-access',
  'commercial',
  'ai-platform',
  'module-apps',
  'content-operations',
  'client-integrations',
  'system-security',
]);
```

Update open-key expectations:

```ts
expect(getAdminOpenKeys('/settings/admin/providers/edit')).toEqual(['ai-platform']);
expect(getAdminOpenKeys('/settings/admin/module-apps')).toEqual(['module-apps']);
expect(getAdminOpenKeys('/settings/admin/topics')).toEqual(['content-operations']);
expect(getAdminOpenKeys('/settings/admin/file-storage')).toEqual(['client-integrations']);
expect(getAdminOpenKeys('/settings/admin/settings')).toEqual(['system-security']);
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.test.ts
```

Expected: FAIL because `adminCatalog.ts` does not exist and navigation still uses the old group keys.

- [ ] **Step 3: Create the catalog types and group definitions**

Create `src/features/Admin/adminCatalog.ts` with these interfaces:

```ts
import { ADMIN_CAPABILITIES, type AdminCapability } from '@lobechat/types';

export const ADMIN_BASE_PATH = '/settings/admin';

export type AdminFeatureStatus =
  | 'active'
  | 'compatibility'
  | 'deprecated'
  | 'experimental'
  | 'planned';

export type AdminNavGroupKey =
  | 'overview'
  | 'user-access'
  | 'commercial'
  | 'ai-platform'
  | 'module-apps'
  | 'content-operations'
  | 'client-integrations'
  | 'system-security';

export type AdminNavIcon =
  | 'audit'
  | 'billing'
  | 'credits'
  | 'desktop'
  | 'documents'
  | 'expert-plaza'
  | 'file-storage'
  | 'files'
  | 'growth'
  | 'maintenance'
  | 'models'
  | 'notifications'
  | 'orders'
  | 'overview'
  | 'plans'
  | 'plugins'
  | 'ppt'
  | 'pricing'
  | 'providers'
  | 'redemption'
  | 'recommendations'
  | 'settings'
  | 'stats'
  | 'subscriptions'
  | 'system-defaults'
  | 'topup'
  | 'topics'
  | 'users';

export type AdminCatalogGroup = {
  description: string;
  icon: AdminNavIcon;
  key: AdminNavGroupKey;
  label: string;
};

export type AdminCatalogItem = {
  backendDomains: string[];
  debugId: string;
  description: string;
  group: AdminNavGroupKey;
  icon: AdminNavIcon;
  id: string;
  label: string;
  owner: string;
  path: string;
  readCapability: AdminCapability;
  segment: string;
  status: AdminFeatureStatus;
  writeCapabilities: AdminCapability[];
};
```

Use these exact group definitions:

```ts
export const ADMIN_CATALOG_GROUPS: readonly AdminCatalogGroup[] = [
  { description: '关键指标、待处理事项、运行健康和版本信息', icon: 'overview', key: 'overview', label: '工作台' },
  { description: '用户身份、角色、支持动作和用户级审计', icon: 'users', key: 'user-access', label: '用户与权限' },
  { description: '套餐、订阅、平台订单、积分、兑换码和商业统计', icon: 'orders', key: 'commercial', label: '商业化' },
  { description: '服务商、模型目录、价格、策略、默认值和生成服务', icon: 'models', key: 'ai-platform', label: 'AI 平台' },
  { description: '模块应用目录、审核、商业化、运行数据和审计', icon: 'plugins', key: 'module-apps', label: '模块应用' },
  { description: '内容治理、推荐运营、专家广场、通知和增长', icon: 'documents', key: 'content-operations', label: '内容与运营' },
  { description: '桌面客户端、文件存储和外部集成状态', icon: 'desktop', key: 'client-integrations', label: '客户端与集成' },
  { description: '站点品牌、系统默认值、维护和审计日志', icon: 'settings', key: 'system-security', label: '系统与安全' },
];
```

- [ ] **Step 4: Add the exact visible route metadata**

Populate `ADMIN_CATALOG` with the following rows and finish the declaration with `as const satisfies readonly AdminCatalogItem[]`. Use `path = segment ? `${ADMIN_BASE_PATH}/${segment}` : ADMIN_BASE_PATH` and preserve the listed order inside each group.

| id / segment | group | label | read capability | write capabilities | owner | backend domains | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `overview` / `` | overview | 工作台 | `adminAccess` | none | admin-platform | stats, subscriptions, settings | active |
| `users` | user-access | 用户管理 | `userRead` | `supportWrite`, `financeWrite`, `adminAccess` | identity | users, credits, subscriptions | active |
| `plans` | commercial | 套餐与权益 | `financeRead` | `financeWrite` | commercial | plans | active |
| `subscriptions` | commercial | 订阅管理 | `financeRead` | `financeWrite` | commercial | subscriptions | active |
| `orders` | commercial | 平台订单与充值 | `financeRead` | `financeWrite` | commercial | orders, topupPackages | active |
| `credits` | commercial | 积分账户与流水 | `financeRead` | `financeWrite` | commercial | credits | active |
| `redemption` | commercial | 兑换码 | `financeRead` | `financeWrite` | commercial | redemption | active |
| `stats` | commercial | 商业统计 | `financeRead` | none | commercial | stats, referral | active |
| `providers` | ai-platform | 服务商与实例 | `modelOpsRead` | `modelOpsWrite` | ai-platform | newapiProviders | active |
| `model-billing-matrix` | ai-platform | 模型目录与计费 | `adminAccess` | `modelOpsWrite`, `financeWrite`, `systemWrite` | ai-platform | newapiProviders, plans, settings | active |
| `model-policy` | ai-platform | 模型访问策略 | `adminAccess` | `systemWrite` | ai-platform | settings | active |
| `ppt` | ai-platform | 生成服务 | `systemRead` | `systemWrite` | ai-platform | ppt | experimental |
| `system-defaults` | ai-platform | 默认模型与运行默认值 | `systemRead` | `systemWrite` | ai-platform | settings | active |
| `module-apps` | module-apps | 模块应用中心 | `moduleAppRead` | `moduleAppWrite`, `financeWrite`, `auditRead` | module-apps | moduleApps | experimental |
| `topics` | content-operations | 话题管理 | `contentRead` | `contentWrite` | content | content | active |
| `files` | content-operations | 资源文件 | `contentRead` | `contentWrite` | content | content | active |
| `documents` | content-operations | 用户文档 | `contentRead` | `contentWrite` | content | content | active |
| `recommendations` | content-operations | 推荐运营 | `systemRead` | `systemWrite` | operations | settings | active |
| `expert-plaza` | content-operations | 专家广场 | `systemRead` | `systemWrite` | operations | settings | active |
| `operations` | content-operations | 运营配置 | `systemRead` | `systemWrite` | operations | settings | active |
| `notifications` | content-operations | 通知中心 | `systemRead` | `systemWrite` | operations | settings | experimental |
| `growth` | content-operations | 注册与增长 | `systemRead` | `systemWrite` | operations | settings, referral | active |
| `desktop-update` | client-integrations | 桌面客户端 | `systemRead` | `systemWrite` | client | settings, desktop-release | experimental |
| `file-storage` | client-integrations | 文件存储 | `systemRead` | `systemWrite` | storage | settings, s3 | active |
| `settings` | system-security | 站点与品牌 | `systemRead` | `systemWrite` | system | settings | active |
| `maintenance` | system-security | 缓存与维护 | `systemRead` | `systemWrite` | system | settings | active |
| `audit` | system-security | 审计日志 | `auditRead` | none | security | audit | active |

Set each `debugId` deterministically to `Desktop > Admin > ${id}` and use concise Chinese descriptions matching the responsibility in the table. Keep existing icon names for each route. Use `writeCapabilities: []` for rows whose table entry says `none`.

Add compatibility metadata:

```ts
export const ADMIN_LEGACY_ROUTES = [
  { segment: 'pricing', targetSegment: 'model-billing-matrix' },
  { segment: 'topup', targetSegment: 'orders' },
  { segment: 'change-requests', targetSegment: 'subscriptions' },
] as const;

export type AdminCatalogId = (typeof ADMIN_CATALOG)[number]['id'];
```

- [ ] **Step 5: Derive navigation and path access from the catalog**

In `adminNavigation.ts`:

1. Re-export `ADMIN_BASE_PATH`, `AdminNavGroupKey`, and `AdminNavIcon` from `adminCatalog.ts`.
2. Keep the public `AdminNavItem` and `AdminNavGroup` shapes used by `AdminSidebar`.
3. Replace the literal `ADMIN_NAV_GROUPS` and `ADMIN_PATH_CAPABILITIES` with:

```ts
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = ADMIN_CATALOG_GROUPS.map((group) => ({
  ...group,
  items: ADMIN_CATALOG.filter((item) => item.group === group.key).map((item) => ({
    description: item.description,
    icon: item.icon,
    label: item.label,
    path: item.path,
  })),
}));

const ADMIN_PATH_CAPABILITIES = new Map(
  ADMIN_CATALOG.map((item) => [item.path, item.readCapability] as const),
);

const ADMIN_NAV_ALIASES = Object.fromEntries(
  ADMIN_LEGACY_ROUTES.map(({ segment, targetSegment }) => [
    `${ADMIN_BASE_PATH}/${segment}`,
    `${ADMIN_BASE_PATH}/${targetSegment}`,
  ]),
);
```

Change `canAccessAdminPath` to read from the map:

```ts
const capability = ADMIN_PATH_CAPABILITIES.get(selectedPath);
return !!capability && hasAdminCapability(role, capability);
```

Keep the existing role default paths unchanged.

- [ ] **Step 6: Run catalog/navigation tests**

Run the command from Step 2.

Expected: PASS. Existing deep-link selection tests must still pass with the new group keys.

- [ ] **Step 7: Commit the catalog and menu information architecture**

```powershell
git add src/features/Admin/adminCatalog.ts src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.ts src/features/Admin/adminNavigation.test.ts
git commit -m "refactor: centralize admin catalog and navigation" -m "Constraint: Preserve every existing visible admin path." -m "Tested: focused admin catalog and navigation tests."
```

---

### Task 3: Derive The Route Registry And Preserve Compatibility Routes

**Files:**
- Modify: `src/business/client/adminSettingsRouteRegistry.ts`
- Modify: `src/business/client/BusinessDesktopRoutes.test.ts`

**Interfaces:**
- Consumes: `ADMIN_CATALOG`, `ADMIN_LEGACY_ROUTES`, and `AdminCatalogId` from Task 2.
- Produces: catalog-derived `ADMIN_SETTINGS_ROUTE_REGISTRY` plus explicit legacy route records.

- [ ] **Step 1: Write failing route parity tests**

Update `BusinessDesktopRoutes.test.ts`:

```ts
import { ADMIN_CATALOG, ADMIN_LEGACY_ROUTES } from '@/features/Admin/adminCatalog';
import {
  BusinessDesktopRoutesWithMainLayout,
  BusinessDesktopRoutesWithSettingsLayout,
} from './BusinessDesktopRoutes';

it('registers every visible catalog route exactly once', () => {
  const visibleSegments = ADMIN_CATALOG.map((item) => item.segment);
  const registryVisibleSegments = ADMIN_SETTINGS_ROUTE_REGISTRY
    .filter((item) => item.status !== 'compatibility')
    .map((item) => item.segment);

  expect(registryVisibleSegments).toEqual(visibleSegments);
  expect(new Set(registryVisibleSegments).size).toBe(registryVisibleSegments.length);
});

it('keeps legacy segments reachable but outside the visible catalog', () => {
  expect(ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS).toEqual(
    ADMIN_LEGACY_ROUTES.map((item) => item.segment),
  );
  for (const segment of ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS) {
    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain(segment);
    expect(ADMIN_CATALOG.map((item) => item.segment)).not.toContain(segment);
  }
});

it('mounts admin only under the settings route tree', () => {
  expect(BusinessDesktopRoutesWithMainLayout).not.toContainEqual(
    expect.objectContaining({ path: 'admin' }),
  );
  expect(BusinessDesktopRoutesWithSettingsLayout).toHaveLength(1);
  expect(BusinessDesktopRoutesWithSettingsLayout[0]?.path).toBe('admin');
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/BusinessDesktopRoutes.test.ts
```

Expected: FAIL because route records have no `status` and are not derived from the catalog.

- [ ] **Step 3: Add a typed page import map**

In `adminSettingsRouteRegistry.ts`, define:

```ts
import type { ComponentType } from 'react';

import {
  ADMIN_CATALOG,
  type AdminCatalogId,
  ADMIN_LEGACY_ROUTES,
  type AdminFeatureStatus,
} from '@/features/Admin/adminCatalog';

type ImportPage = () => Promise<{ default: ComponentType } | ComponentType>;

const ADMIN_PAGE_IMPORTS: Record<AdminCatalogId, ImportPage> = {
  audit: () => import('@/routes/(main)/admin/audit'),
  credits: () => import('@/routes/(main)/admin/credits'),
  'desktop-update': () => import('@/routes/(main)/admin/desktop-update'),
  documents: () => import('@/routes/(main)/admin/documents'),
  'expert-plaza': () => import('@/routes/(main)/admin/expert-plaza'),
  'file-storage': () => import('@/routes/(main)/admin/file-storage'),
  files: () => import('@/routes/(main)/admin/files'),
  growth: () => import('@/routes/(main)/admin/growth'),
  maintenance: () => import('@/routes/(main)/admin/maintenance'),
  'model-billing-matrix': () => import('@/routes/(main)/admin/model-billing-matrix'),
  'model-policy': () => import('@/routes/(main)/admin/model-policy'),
  'module-apps': () => import('@/routes/(main)/admin/module-apps'),
  notifications: () => import('@/routes/(main)/admin/notifications'),
  operations: () => import('@/routes/(main)/admin/operations'),
  orders: () => import('@/routes/(main)/admin/orders'),
  overview: () => import('@/routes/(main)/admin/overview'),
  plans: () => import('@/routes/(main)/admin/plans'),
  ppt: () => import('@/routes/(main)/admin/ppt'),
  providers: () => import('@/routes/(main)/admin/providers'),
  recommendations: () => import('@/routes/(main)/admin/recommendations'),
  redemption: () => import('@/routes/(main)/admin/redemption'),
  settings: () => import('@/routes/(main)/admin/settings'),
  stats: () => import('@/routes/(main)/admin/stats'),
  subscriptions: () => import('@/routes/(main)/admin/subscriptions'),
  'system-defaults': () => import('@/routes/(main)/admin/system-defaults'),
  topics: () => import('@/routes/(main)/admin/topics'),
  users: () => import('@/routes/(main)/admin/users'),
};
```

Define legacy imports separately:

```ts
const ADMIN_LEGACY_PAGE_IMPORTS: Record<string, ImportPage> = {
  'change-requests': () => import('@/routes/(main)/admin/change-requests'),
  pricing: () => import('@/routes/(main)/admin/pricing'),
  topup: () => import('@/routes/(main)/admin/topup'),
};
```

- [ ] **Step 4: Build the registry from catalog metadata**

Use this route record shape:

```ts
export type AdminSettingsRouteRegistryItem = {
  debugId: string;
  id: string;
  importPage: ImportPage;
  segment: string;
  status: AdminFeatureStatus;
};
```

Build the exports:

```ts
const visibleRoutes: AdminSettingsRouteRegistryItem[] = ADMIN_CATALOG.map((item) => ({
  debugId: item.debugId,
  id: item.id,
  importPage: ADMIN_PAGE_IMPORTS[item.id],
  segment: item.segment,
  status: item.status,
}));

const compatibilityRoutes: AdminSettingsRouteRegistryItem[] = ADMIN_LEGACY_ROUTES.map(
  ({ segment }) => ({
    debugId: `Desktop > Admin > Legacy > ${segment}`,
    id: `legacy-${segment}`,
    importPage: ADMIN_LEGACY_PAGE_IMPORTS[segment],
    segment,
    status: 'compatibility',
  }),
);

export const ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS = ADMIN_LEGACY_ROUTES.map(
  (route) => route.segment,
);

export const ADMIN_SETTINGS_ROUTE_REGISTRY = [...visibleRoutes, ...compatibilityRoutes];
export const ADMIN_SETTINGS_ROUTE_SEGMENTS = ADMIN_SETTINGS_ROUTE_REGISTRY.map(
  (route) => route.segment,
);
```

Do not change `BusinessDesktopRoutes.tsx`; it should continue mapping the registry into one nested `admin` route.

- [ ] **Step 5: Run route and router-sync tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/BusinessDesktopRoutes.test.ts src/spa/router/desktopRouter.sync.test.tsx
```

Expected: PASS. Both desktop router variants still mount `BusinessDesktopRoutesWithSettingsLayout` before generic settings tabs.

- [ ] **Step 6: Commit the route registry**

```powershell
git add src/business/client/adminSettingsRouteRegistry.ts src/business/client/BusinessDesktopRoutes.test.ts
git commit -m "refactor: derive admin routes from the catalog" -m "Constraint: Keep legacy merged routes reachable outside the sidebar." -m "Tested: business route registry and desktop router sync tests."
```

---

### Task 4: Split Read Capabilities In Standard Admin Routers

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/users.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/content.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/newapiProviders.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/ppt.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts`
- Modify: `src/features/Admin/adminCommercialFlow.test.ts`

**Interfaces:**
- Consumes: read capability IDs from Task 1.
- Produces: unchanged tRPC names with corrected read/write middleware.

- [ ] **Step 1: Change the static contract test to the target bindings**

Replace the second test in `scopedReadProcedures.test.ts` with these expectations:

```ts
it('uses read capabilities for user, model, content, audit, and system reads', () => {
  const expectations: Array<[string, string, string[]]> = [
    [
      'users',
      'ADMIN_CAPABILITIES.userRead',
      [
        'detail: userReadProcedure',
        'fullDetail: userReadProcedure',
        'list: userReadProcedure',
        'exportAll: userReadProcedure',
      ],
    ],
    [
      'newapiProviders',
      'ADMIN_CAPABILITIES.modelOpsRead',
      [
        'getInstance: modelOpsReadProcedure',
        'listInstances: modelOpsReadProcedure',
        'getModelCatalogDiagnostics: modelOpsReadProcedure',
        'listModels: modelOpsReadProcedure',
        'getAllEnabledModels: modelOpsReadProcedure',
      ],
    ],
    [
      'content',
      'ADMIN_CAPABILITIES.contentRead',
      [
        'listDocuments: contentReadProcedure',
        'listFiles: contentReadProcedure',
        'listTopics: contentReadProcedure',
      ],
    ],
    [
      'audit-router',
      'ADMIN_CAPABILITIES.auditRead',
      ['list: auditReadProcedure', 'exportAll: auditReadProcedure'],
    ],
    [
      'settings',
      'ADMIN_CAPABILITIES.systemRead',
      [
        'getGovernance: systemReadProcedure',
        'getAll: systemReadProcedure',
        'validateDefaultAgentSettings: systemReadProcedure',
      ],
    ],
    [
      'ppt',
      'ADMIN_CAPABILITIES.systemRead',
      ['getSettings: systemReadProcedure'],
    ],
  ];

  for (const [router, capability, fragments] of expectations) {
    const source = readRouter(router);
    expect(source).toContain(capability);
    for (const fragment of fragments) expect(source).toContain(fragment);
  }
});
```

Add assertions that side-effecting model and system procedures remain write-bound:

```ts
it('keeps side-effecting diagnostics and cache operations write-bound', () => {
  const providers = readRouter('newapiProviders');
  const settings = readRouter('settings');

  expect(providers).toContain('testInstanceConnection: modelOpsWriteProcedure');
  expect(providers).toContain('refreshRuntimeCache: modelOpsWriteProcedure');
  expect(providers).toContain('syncInstanceModels: modelOpsWriteProcedure');
  expect(settings).toContain('refreshRuntimeCaches: systemWriteProcedure');
  expect(settings).toContain('testS3Storage: systemWriteProcedure');
  expect(settings).toContain('runMaintenance: systemWriteProcedure');
});
```

- [ ] **Step 2: Run the static contract test and verify it fails**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts
```

Expected: FAIL because the current routers bind these reads to write procedures.

- [ ] **Step 3: Split users and content read procedures**

In `users.ts`:

```ts
const supportWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.supportWrite);
const userReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.userRead);
```

Bind `detail`, `fullDetail`, `list`, and `exportAll` to `userReadProcedure`. Keep `ban`, `unban`, and `recordImpersonationAttempt` on `supportWriteProcedure`; keep `setRole`, reset preview, and reset mutation on `adminProcedure`. Remove `userWriteProcedure` if no procedure uses it.

In `content.ts`:

```ts
const contentReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentRead);
const contentWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentWrite);
```

Bind only `listDocuments`, `listFiles`, and `listTopics` to `contentReadProcedure`. Bind archive/delete procedures to `contentWriteProcedure`.

- [ ] **Step 4: Split model provider read procedures**

In `newapiProviders.ts`:

```ts
const modelOpsReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.modelOpsRead);
const modelOpsWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.modelOpsWrite);
```

Use `modelOpsReadProcedure` for:

- `getInstance`
- `listInstances`
- `getModelCatalogDiagnostics`
- `listModels`
- `getAllEnabledModels`

Keep `modelOpsWriteProcedure` for:

- create/update/delete/toggle instance
- `syncInstanceModels`
- `testInstanceConnection`
- `refreshRuntimeCache`
- add/remove/update model

The test connection remains write-bound because it performs an external request.

- [ ] **Step 5: Split settings and PPT read procedures**

In `settings.ts` replace the alias:

```ts
const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);
const systemWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemWrite);
```

Keep public procedures unchanged. Bind `getGovernance`, `getAll`, and `validateDefaultAgentSettings` to `systemReadProcedure`. Keep all setting mutations, cache refresh, S3 test, synchronization, unknown-key deletion, and maintenance on `systemWriteProcedure`.

In `ppt.ts`:

```ts
const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);
const systemWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemWrite);
```

Bind `getSettings` to read and `saveSettings` to write.

- [ ] **Step 6: Update existing source assertion tests**

In `adminCommercialFlow.test.ts`, replace old assertions that expect read procedures to use `modelOpsWriteProcedure` or `systemWriteProcedure`. Keep assertions for `refreshRuntimeCache`, unknown-setting deletion, and other mutations on write procedures.

- [ ] **Step 7: Run focused router tests**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts packages/business-server/src/lambda-routers/admin/users.test.ts packages/business-server/src/lambda-routers/admin/content.test.ts packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Expected: PASS with unchanged procedure names and response contracts.

- [ ] **Step 8: Commit the standard router capability split**

```powershell
git add packages/business-server/src/lambda-routers/admin/users.ts packages/business-server/src/lambda-routers/admin/content.ts packages/business-server/src/lambda-routers/admin/newapiProviders.ts packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/ppt.ts packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts src/features/Admin/adminCommercialFlow.test.ts
git commit -m "refactor: separate admin read procedures from mutations" -m "Constraint: Preserve tRPC names and response contracts." -m "Tested: scoped read contracts and focused admin router tests."
```

---

### Task 5: Isolate Module App Administration Capabilities

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts`
- Modify: `packages/types/src/admin.test.ts`

**Interfaces:**
- Consumes: `moduleAppRead`, `moduleAppWrite`, `financeWrite`, and `auditRead`.
- Produces: Module App read/edit ownership that no longer piggybacks on content or generic audit capabilities.

- [ ] **Step 1: Add failing ownership assertions**

Add to `scopedReadProcedures.test.ts`:

```ts
it('isolates Module App reads and edits from content administration', () => {
  const source = readRouter('moduleApps');

  expect(source).toContain('ADMIN_CAPABILITIES.moduleAppRead');
  expect(source).toContain('ADMIN_CAPABILITIES.moduleAppWrite');
  expect(source).toContain('get: moduleAppReadProcedure');
  expect(source).toContain('list: moduleAppReadProcedure');
  expect(source).toContain('listProducts: moduleAppReadProcedure');
  expect(source).toContain('publish: moduleAppWriteProcedure');
  expect(source).toContain('approvePackage: moduleAppWriteProcedure');
  expect(source).toContain('upsert: moduleAppWriteProcedure');
  expect(source).not.toContain('const contentWriteProcedure =');
});
```

Add to `packages/types/src/admin.test.ts`:

```ts
it('keeps Module App governance full-admin-only by default', () => {
  for (const role of ADMIN_ROLE_IDS.filter((role) => role !== 'admin')) {
    expect(hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppRead)).toBe(false);
    expect(hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite)).toBe(false);
  }
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/types/src/admin.test.ts packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts
```

Expected: FAIL because `moduleApps.ts` currently uses `auditReadProcedure` and `contentWriteProcedure` for generic reads/edits.

- [ ] **Step 3: Define Module App procedure bindings**

At the top of `moduleApps.ts` use:

```ts
const auditReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.auditRead);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);
const moduleAppReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.moduleAppRead);
const moduleAppWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.moduleAppWrite);
```

- [ ] **Step 4: Apply the exact procedure ownership matrix**

Bind to `moduleAppReadProcedure`:

- `get`
- `list`
- `getPackage`
- `listArtifacts`
- `listInstalls`
- `listPackages`
- `listPaymentDiagnostics`
- `listPayouts`
- `listProducts`
- `listPublishers`
- `listRecords`
- `listRevenue`
- `listRuns`

Bind to `auditReadProcedure`:

- `exportPaymentReconciliation`
- `listAuditEvents`

Bind to `moduleAppWriteProcedure`:

- `assignPublisher`
- `createProduct`
- `createPublisher`
- `publish`
- `approvePackage`
- `rejectPackage`
- `rescanPackage`
- `suspendPublisher`
- `unpublish`
- `updateProduct`
- `upsert`
- `upsertActions`
- `upsertPages`
- `verifyPublisher`

Keep financial state changes on `financeWriteProcedure`:

- payment discrepancy acknowledgement/reconciliation
- payout creation/transition/manual Alipay payout
- refund/query/retry/settlement operations
- revenue settlement
- `upsertBilling`
- `upsertEntitlements`

Do not change any input schema, database call, audit event, Alipay adapter call, feature flag, or return value.

- [ ] **Step 5: Add one runtime authorization test**

Refactor the mocked admin role in `moduleApps.test.ts` into a hoisted variable:

```ts
const authState = vi.hoisted(() => ({ role: 'admin' }));

// in the mocked users.findFirst
findFirst: vi.fn().mockImplementation(async () => ({ banned: false, role: authState.role })),
```

Reset `authState.role = 'admin'` in `beforeEach`, then add:

```ts
it('rejects content admins from Module App governance procedures', async () => {
  authState.role = 'content_admin';
  const caller = createCaller();

  await expect(caller.moduleApps.list({ limit: 20 })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(caller.moduleApps.publish({ appId: APP_ID })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});
```

- [ ] **Step 6: Run Module App tests**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/types/src/admin.test.ts packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts
```

Expected: PASS. Existing payment, refund, reconciliation, revenue, and payout tests must remain unchanged and pass.

- [ ] **Step 7: Commit Module App capability isolation**

```powershell
git add packages/types/src/admin.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts
git commit -m "refactor: isolate Module App admin capabilities" -m "Constraint: Preserve Alipay and payout state transitions." -m "Scope-risk: Tightens scoped-role access to Module App governance." -m "Tested: Module App router, payment, refund, reconciliation, and capability tests."
```

---

### Task 6: Align Frontend Guards, Compatibility Documentation, And Verification

**Files:**
- Modify: `src/routes/(main)/admin/_layout/index.test.tsx`
- Modify: `src/routes/(main)/settings/admin/index.tsx`
- Modify: `src/features/Admin/adminNavigation.test.ts`
- Modify: `docs/development/admin-refactor-progress.zh-CN.md`

**Interfaces:**
- Consumes: catalog-driven navigation and read capability role mapping.
- Produces: canonical-path guard coverage and an explicit lifecycle marker for the unregistered legacy renderer.

- [ ] **Step 1: Update layout tests to the real canonical path**

In `src/routes/(main)/admin/_layout/index.test.tsx`, change the default location and scoped-role test paths from `/admin` to `/settings/admin`:

```ts
const locationMock = vi.hoisted(() => ({ pathname: '/settings/admin' }));

afterEach(() => {
  act(() => {
    userStoreMock.useUserStore.reset();
    locationMock.pathname = '/settings/admin';
  });
});
```

Use `/settings/admin/plans` and `/settings/admin/settings` in scoped-role tests. Keep `/admin/*` normalization coverage in `adminNavigation.test.ts`; do not duplicate that compatibility behavior in the layout test.

- [ ] **Step 2: Mark the legacy settings renderer explicitly**

Add this comment immediately before `SettingsAdminPage` in `src/routes/(main)/settings/admin/index.tsx`:

```ts
/**
 * @deprecated The declarative desktop router mounts AdminLayout and catalog routes directly.
 * Keep this unregistered renderer only until compatibility usage has been audited.
 */
```

Do not change its imports, page map, or tests in this phase.

- [ ] **Step 3: Complete scoped navigation assertions**

Extend `adminNavigation.test.ts` so every scoped role receives its intended default page and no cross-domain pages:

```ts
it.each([
  ['content_admin', `${ADMIN_BASE_PATH}/topics`, `${ADMIN_BASE_PATH}/plans`],
  ['finance_admin', `${ADMIN_BASE_PATH}/subscriptions`, `${ADMIN_BASE_PATH}/settings`],
  ['model_ops', `${ADMIN_BASE_PATH}/providers`, `${ADMIN_BASE_PATH}/users`],
  ['support_admin', `${ADMIN_BASE_PATH}/users`, `${ADMIN_BASE_PATH}/providers`],
  ['system_admin', `${ADMIN_BASE_PATH}/settings`, `${ADMIN_BASE_PATH}/credits`],
] as const)('keeps %s inside its default domain', (role, allowedPath, deniedPath) => {
  expect(getAdminDefaultPath(role)).toBe(allowedPath);
  expect(canAccessAdminPath(role, allowedPath)).toBe(true);
  expect(canAccessAdminPath(role, deniedPath)).toBe(false);
});
```

Keep the existing `/admin/*` selected-key tests to prove compatibility normalization.

- [ ] **Step 4: Update the admin refactor progress document**

Append a dated section to `docs/development/admin-refactor-progress.zh-CN.md` recording:

```markdown
## 2026-07-15 后台治理底座 Phase 1

- `/settings/admin` 继续作为唯一主入口；`/admin/*` 只保留路径规范化语义。
- 后台菜单和可见路由已收敛到统一 Admin catalog，兼容入口不进入主菜单。
- 管理能力已拆分 read/write，用户、内容、模型、系统设置和 PPT 的只读 procedure 不再要求写权限。
- Module App 管理使用独立 `moduleApp.read/moduleApp.write`，平台财务动作继续使用 `finance.write`。
- 平台套餐/充值支付仍未实现；模块应用支付宝电脑网站支付保持独立域和原有环境开关。
```

- [ ] **Step 5: Run the complete Phase 1 focused suite**

Run:

```powershell
bunx vitest run --silent='passed-only' packages/types/src/admin.test.ts packages/trpc/src/lambda/middleware/__tests__/adminPermissions.test.ts packages/trpc/src/lambda/middleware/__tests__/requireSuperAdmin.test.ts src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.test.ts src/business/client/BusinessDesktopRoutes.test.ts src/spa/router/desktopRouter.sync.test.tsx src/routes/(main)/admin/_layout/index.test.tsx packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts packages/business-server/src/lambda-routers/admin/users.test.ts packages/business-server/src/lambda-routers/admin/content.test.ts packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Run the layout test with its parenthesized path quoted:

```powershell
bunx vitest run --silent='passed-only' 'src/routes/(main)/admin/_layout/index.test.tsx'
```

Expected: all selected tests PASS.

- [ ] **Step 6: Run type and diff verification**

Run:

```powershell
bun run type-check
git diff --check
git status --short
```

Expected:

- `type-check` exits 0.
- `git diff --check` emits no output.
- `git status --short` lists only the Phase 1 files before commit.

- [ ] **Step 7: Review the complete diff for behavior drift**

Run:

```powershell
git diff -- packages/types/src/admin.ts src/features/Admin/adminCatalog.ts src/features/Admin/adminNavigation.ts src/business/client/adminSettingsRouteRegistry.ts packages/business-server/src/lambda-routers/admin
```

Review must confirm:

- no route or procedure name was removed;
- no input/output schema changed;
- no payment, refund, payout, order, credit, or setting mutation body changed;
- only middleware bindings, catalog metadata, tests, and documentation changed;
- compatibility segments remain registered.

- [ ] **Step 8: Commit frontend alignment and progress documentation**

```powershell
git add 'src/routes/(main)/admin/_layout/index.test.tsx' 'src/routes/(main)/settings/admin/index.tsx' src/features/Admin/adminNavigation.test.ts docs/development/admin-refactor-progress.zh-CN.md
git commit -m "docs: record the admin governance foundation" -m "Constraint: Keep the legacy settings renderer unregistered but available for audit." -m "Tested: complete Phase 1 focused suite and type-check."
```

---

## Final Review Gate

After all six tasks:

1. Run `git log --oneline -8` and verify six scoped implementation commits follow the design order.
2. Run `git status --short --branch`; the worktree must be clean.
3. Run `git diff <phase-start-commit>..HEAD --check`; it must emit no output.
4. Re-run any test that failed or timed out; do not report success from partial output.
5. Review against `docs/superpowers/specs/2026-07-15-admin-console-redesign-design.md`, limiting the claim to Phase 1.
6. Perform a code-review pass with findings first. Fix P0/P1 findings before final submission.
7. Create no deployment, push, or merge unless the user requests it after reviewing the Phase 1 commit set.

## Expected Phase 1 Result

- The sidebar displays the approved eight information-architecture groups.
- Every visible admin route has one catalog record, one lazy import, one status, one owner, and one read capability.
- Compatibility routes remain reachable but never appear as primary menu entries.
- Scoped roles can read their own domain without requiring write permission.
- Module App governance no longer inherits content/audit access accidentally.
- Existing tRPC procedure names, response types, payment flows, and database behavior remain unchanged.
