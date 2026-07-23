# Admin Module Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1,227-line Module App admin page with a capability-aware, deeply linkable module center at `/settings/admin/modules`, then remove `/settings/admin/module-apps` without redirects or aliases.

**Architecture:** Keep the existing database schema, `admin.moduleApps` tRPC router, service boundary, payment state machines, and capability IDs. Add a recursive admin route registry and a module route/section catalog, then move each existing workflow into a route-level feature that owns its URL state and data request. Register the completed route tree atomically at the end so intermediate commits remain testable without exposing half-migrated navigation.

**Tech Stack:** Next.js 16 SPA, React 19, TypeScript, React Router, SWR, tRPC, Zustand, `@lobehub/ui`, `@lobehub/ui/base-ui`, antd-style, Vitest, Testing Library, Drizzle/PostgreSQL.

## Global Constraints

- Keep `/settings/admin` as the only admin root and use `/settings/admin/modules` as the only Module App admin root.
- Do not register, redirect, alias, normalize, or render a migration page for `/settings/admin/module-apps` or any child of it.
- Do not change the Module App database schema, payment environment variables, Alipay callback behavior, payout state machine, order results, or runtime execution behavior.
- Keep `admin.moduleApps`, `adminCommercialService.moduleApps`, and all existing capability string values; backward-compatible input additions are allowed only where this plan names them.
- Treat backend capability procedures as authoritative: publisher reads use `finance.read`; publisher governance uses `moduleApp.write`; entitlement and billing writes use `finance.write`; audit reads use `audit.read`.
- Route files under `src/routes/(main)/admin/modules/` stay thin and only import feature components.
- Do not edit either desktop router config directly. Both configs already consume `BusinessDesktopRoutesWithSettingsLayout`; keep `desktopRouter.sync.test.tsx` green.
- Use route IDs and one recursive route metadata tree as the source of segment/path truth. Section navigation references route IDs and must not repeat route segments or lazy imports.
- Put search, filters, selected app, sort order, and cursor trail in the URL. Keep only modal visibility and transient row selection local.
- Persist only non-sensitive drafts, scoped by `appId + view`; never persist payment references, Alipay evidence, recipient data, or other sensitive finance input.
- Use `@lobehub/ui/base-ui` before `@lobehub/ui`, and `@lobehub/ui` before antd for newly written controls. Use Lucide icons and tooltips for unfamiliar icon-only actions.
- Do not use antd `Spin`. Use stable skeletons for lists/details and `NeuralNetworkLoading` for indeterminate in-flight actions.
- Every data page must distinguish loading, request error, no data yet, and no filter match. Preserve filters and URL position after mutation failures.
- Keep each new business component under roughly 800 lines and avoid nested cards.
- Add English and Simplified Chinese copy in the same task. Other locales remain unchanged for the repository translation workflow.
- Use focused red/green tests per task. At the end, run one combined focused test round, changed-file lint/format checks, type-check, and one browser acceptance pass; do not run the full test suite.

---

### Task 1: Make the Admin Route Registry Recursive

**Files:**
- Modify: `src/business/client/adminSettingsRouteRegistry.ts`
- Modify: `src/business/client/BusinessDesktopRoutes.tsx`
- Modify: `src/business/client/adminSettingsRouteRegistry.test.ts`
- Modify: `src/business/client/BusinessDesktopRoutes.test.ts`

**Interfaces:**
- Produces: recursive `AdminSettingsRouteRegistryItem.children`.
- Produces: `buildAdminSettingsRouteObject(node): RouteObject`.
- Preserves: the current flat registry output and route order until Task 10 performs the cutover.

- [ ] **Step 1: Add a failing recursive-registry contract test**

Add a synthetic nested node to `BusinessDesktopRoutes.test.ts` and assert that index, static, dynamic, and layout nodes retain their nesting:

```ts
it('builds nested admin route nodes recursively', () => {
  const route = buildAdminSettingsRouteObject({
    children: [
      { debugId: 'Index', id: 'index', importPage: async () => () => null, index: true, status: 'active' },
      {
        children: [
          { debugId: 'Detail', id: 'detail', importPage: async () => () => null, index: true, status: 'active' },
        ],
        debugId: 'App layout',
        id: 'app-layout',
        importPage: async () => () => null,
        segment: 'apps/:appId',
        status: 'active',
      },
    ],
    debugId: 'Modules layout',
    id: 'modules',
    importPage: async () => () => null,
    segment: 'modules',
    status: 'active',
  });

  expect(route.path).toBe('modules');
  expect(route.children?.[0]?.index).toBe(true);
  expect(route.children?.[1]?.path).toBe('apps/:appId');
  expect(route.children?.[1]?.children?.[0]?.index).toBe(true);
});
```

- [ ] **Step 2: Run the focused route test and verify RED**

Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/BusinessDesktopRoutes.test.ts
```

Expected: FAIL because `children`, `index`, and `buildAdminSettingsRouteObject` do not exist.

- [ ] **Step 3: Extend the registry type without changing current routes**

Change the route node contract to:

```ts
export type AdminSettingsRouteRegistryItem = {
  children?: readonly AdminSettingsRouteRegistryItem[];
  debugId: string;
  id: string;
  importPage?: ImportPage;
  index?: boolean;
  segment?: string;
  status: AdminFeatureStatus;
};
```

Keep current catalog routes as leaf nodes. Represent the existing root overview with `index: true`; other leaves retain `segment`.

- [ ] **Step 4: Build React Router objects recursively**

Export this helper from `BusinessDesktopRoutes.tsx` and use it for the registry:

```tsx
export const buildAdminSettingsRouteObject = (
  node: AdminSettingsRouteRegistryItem,
): RouteObject => {
  const hasChildren = Boolean(node.children?.length);
  const route: RouteObject = {
    ...(node.children ? { children: node.children.map(buildAdminSettingsRouteObject) } : {}),
    ...(node.importPage
      ? {
          element: hasChildren
            ? dynamicLayout(node.importPage, node.debugId)
            : dynamicElement(node.importPage, node.debugId),
        }
      : {}),
    ...(node.index ? { index: true } : { path: node.segment }),
  };

  return route;
};
```

Build `settingsAdminRoute.children` with `ADMIN_SETTINGS_ROUTE_REGISTRY.map(buildAdminSettingsRouteObject)`.

- [ ] **Step 5: Update flat-registry assertions and verify GREEN**

Keep `ADMIN_SETTINGS_ROUTE_SEGMENTS` as the top-level segment list and assert no behavior change for the current flat registry. Run:

```powershell
bunx vitest run --silent='passed-only' src/business/client/adminSettingsRouteRegistry.test.ts src/business/client/BusinessDesktopRoutes.test.ts
```

Expected: both files PASS.

- [ ] **Step 6: Commit the routing foundation**

```powershell
git add src/business/client/adminSettingsRouteRegistry.ts src/business/client/BusinessDesktopRoutes.tsx src/business/client/adminSettingsRouteRegistry.test.ts src/business/client/BusinessDesktopRoutes.test.ts
git commit -m "♻️ refactor(admin): support nested settings routes" -m "Constraint: Preserve the current flat admin route behavior until the Module Center cutover."
```

---

### Task 2: Define Module Route IDs, Sections, and Capability Policies

**Files:**
- Create: `src/features/Admin/moduleApps/navigation/catalog.ts`
- Create: `src/features/Admin/moduleApps/navigation/policy.ts`
- Create: `src/features/Admin/moduleApps/navigation/catalog.test.ts`
- Create: `src/features/Admin/moduleApps/navigation/policy.test.ts`

**Interfaces:**
- Produces: `MODULE_ADMIN_ROUTE_TREE`, the only source of Module Center segments.
- Produces: `MODULE_ADMIN_ROUTE_PATHS: Record<ModuleAdminRouteId, string>`.
- Produces: `MODULE_ADMIN_SECTIONS` and `MODULE_APP_DETAIL_SECTIONS`.
- Produces: `canAccessAdminPolicy`, `findModuleAdminSectionByPath`, `getModuleCenterSectionsForRole`, and `getModuleAppSectionsForRole`.

- [ ] **Step 1: Write failing route-path and policy tests**

Cover these exact cases:

```ts
expect(MODULE_ADMIN_ROUTE_PATHS['module-overview']).toBe('/settings/admin/modules');
expect(MODULE_ADMIN_ROUTE_PATHS['module-app-configuration']).toBe(
  '/settings/admin/modules/apps/:appId/configuration',
);
expect(findModuleAdminSectionByPath('/settings/admin/modules/apps/abc/products')?.id).toBe(
  'module-app-products',
);
expect(getModuleCenterSectionsForRole('finance_admin').map((item) => item.id)).toEqual([
  'module-overview',
  'module-publishers',
  'module-revenue',
  'module-payments',
  'module-payouts',
  'module-audit',
]);
expect(canAccessAdminPolicy('finance_admin', { allOf: [ADMIN_CAPABILITIES.moduleAppRead] })).toBe(
  false,
);
```

Also assert that every section route ID exists in the generated path map and that no two navigable center sections share a path.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/navigation/catalog.test.ts src/features/Admin/moduleApps/navigation/policy.test.ts
```

Expected: FAIL because the navigation modules do not exist.

- [ ] **Step 3: Create the recursive route metadata tree**

Define IDs and relative segments once:

```ts
export type ModuleAdminRouteNode = {
  children?: readonly ModuleAdminRouteNode[];
  id: ModuleAdminRouteId;
  index?: boolean;
  segment?: string;
};

export type ModuleAdminRouteId =
  | 'module-center-layout'
  | 'module-overview'
  | 'module-apps'
  | 'module-app-detail-layout'
  | 'module-app-overview'
  | 'module-app-configuration'
  | 'module-app-entitlements'
  | 'module-app-products'
  | 'module-app-runtime'
  | 'module-reviews'
  | 'module-publishers'
  | 'module-finance'
  | 'module-revenue'
  | 'module-payments'
  | 'module-payouts'
  | 'module-operations'
  | 'module-installs'
  | 'module-records'
  | 'module-runs'
  | 'module-artifacts'
  | 'module-audit';

export const MODULE_ADMIN_ROUTE_TREE: ModuleAdminRouteNode = {
  children: [
    { id: 'module-overview', index: true },
    { id: 'module-apps', segment: 'apps' },
    {
      children: [
        { id: 'module-app-overview', index: true },
        { id: 'module-app-configuration', segment: 'configuration' },
        { id: 'module-app-entitlements', segment: 'entitlements' },
        { id: 'module-app-products', segment: 'products' },
        { id: 'module-app-runtime', segment: 'runtime' },
      ],
      id: 'module-app-detail-layout',
      segment: 'apps/:appId',
    },
    { id: 'module-reviews', segment: 'reviews' },
    { id: 'module-publishers', segment: 'publishers' },
    {
      children: [
        { id: 'module-revenue', segment: 'revenue' },
        { id: 'module-payments', segment: 'payments' },
        { id: 'module-payouts', segment: 'payouts' },
      ],
      id: 'module-finance',
      segment: 'finance',
    },
    {
      children: [
        { id: 'module-installs', segment: 'installs' },
        { id: 'module-records', segment: 'records' },
        { id: 'module-runs', segment: 'runs' },
        { id: 'module-artifacts', segment: 'artifacts' },
      ],
      id: 'module-operations',
      segment: 'operations',
    },
    { id: 'module-audit', segment: 'audit' },
  ],
  id: 'module-center-layout',
  segment: 'modules',
};
```

Generate absolute paths recursively from `ADMIN_BASE_PATH`; index nodes inherit their parent path. Export `MODULE_ADMIN_ROOT_PATH = MODULE_ADMIN_ROUTE_PATHS['module-center-layout']` for global access matching.

- [ ] **Step 4: Define exact access policies**

Use this evaluator:

```ts
export type AdminAccessPolicy = {
  allOf?: readonly AdminCapability[];
  anyOf?: readonly AdminCapability[];
};

export const canAccessAdminPolicy = (role: string | null | undefined, policy: AdminAccessPolicy) => {
  if (!isAdminRole(role)) return false;
  if (isFullAdminRole(role)) return true;

  const allAllowed = (policy.allOf ?? []).every((capability) =>
    hasAdminCapability(role, capability),
  );
  const anyAllowed =
    !policy.anyOf?.length ||
    policy.anyOf.some((capability) => hasAdminCapability(role, capability));

  return allAllowed && anyAllowed;
};
```

Apply these policies:

| Route IDs | Access | Write controls |
| --- | --- | --- |
| `module-overview` | any `moduleApp.read`, `finance.read` | none |
| `module-apps`, `module-app-overview`, `module-app-configuration`, `module-app-products`, `module-app-runtime`, `module-reviews`, operation routes | all `moduleApp.read` | `moduleApp.write` where the page has mutations |
| `module-app-entitlements` | all `moduleApp.read` | `finance.write` |
| `module-publishers` | all `finance.read` | `moduleApp.write` |
| revenue, payments, payouts | all `finance.read` | `finance.write` |
| `module-audit` | all `audit.read`, plus any `moduleApp.read`, `finance.read` | none |

- [ ] **Step 5: Match the most specific section and verify GREEN**

Use React Router `matchPath({ end: true, path: pattern }, pathname)` over paths sorted by segment specificity. Run the two focused tests and expect PASS.

- [ ] **Step 6: Commit the route and permission catalog**

```powershell
git add src/features/Admin/moduleApps/navigation
git commit -m "✨ feat(admin): define module center route policies" -m "Constraint: Keep existing backend capability assignments authoritative."
```

---

### Task 3: Add Shared URL, Cache, Draft, and Layout Primitives

**Files:**
- Create: `src/features/Admin/moduleApps/shared/cacheKeys.ts`
- Create: `src/features/Admin/moduleApps/shared/cacheKeys.test.ts`
- Create: `src/features/Admin/moduleApps/shared/queryState.ts`
- Create: `src/features/Admin/moduleApps/shared/queryState.test.ts`
- Create: `src/features/Admin/moduleApps/shared/draftStorage.ts`
- Create: `src/features/Admin/moduleApps/shared/draftStorage.test.ts`
- Create: `src/features/Admin/moduleApps/shared/ModulePageState.tsx`
- Create: `src/features/Admin/moduleApps/shared/ModulePageState.test.tsx`
- Create: `src/features/Admin/moduleApps/shared/useModuleAppDetail.ts`
- Create: `src/features/Admin/moduleApps/shared/useModuleAppDetail.test.ts`
- Create: `src/features/Admin/moduleApps/shared/useUnsavedChangesGuard.ts`
- Modify: `src/features/Admin/moduleApps/AdminTableState.tsx`
- Create: `src/features/Admin/moduleApps/navigation/ModuleSectionNav.tsx`
- Create: `src/features/Admin/moduleApps/navigation/ModuleSectionNav.test.tsx`
- Create: `src/features/Admin/moduleApps/layouts/ModuleCenterLayout.tsx`
- Create: `src/features/Admin/moduleApps/layouts/ModuleAppDetailLayout.tsx`
- Create: `src/features/Admin/moduleApps/layouts/ModuleLayouts.test.tsx`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Produces: `moduleAppCacheKeys` tuple builders.
- Produces: URL cursor helpers that preserve a previous-cursor trail.
- Produces: versioned non-sensitive draft storage helpers.
- Produces: `ModulePageState`, `ModuleCenterLayout`, and `ModuleAppDetailLayout`.
- Consumes: route paths and policy filters from Task 2.

- [ ] **Step 1: Write failing pure-helper tests**

Test exact cache tuples and URL navigation:

```ts
expect(moduleAppCacheKeys.detail('app-1')).toEqual(['admin-module-apps', 'detail', 'app-1']);

const next = advanceCursor(new URLSearchParams('status=draft'), 'cursor-2');
expect(next.get('cursor')).toBe('cursor-2');
expect(next.getAll('previousCursor')).toEqual(['']);

const previous = retreatCursor(next);
expect(previous.get('cursor')).toBeNull();
expect(previous.getAll('previousCursor')).toEqual([]);
```

Test that changing a filter removes `cursor` and every `previousCursor`, and that drafts are isolated by `new/configuration` and `appId/entitlements` scope.

- [ ] **Step 2: Run helper tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/shared/cacheKeys.test.ts src/features/Admin/moduleApps/shared/queryState.test.ts src/features/Admin/moduleApps/shared/draftStorage.test.ts
```

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement stable cache keys**

Use one namespace and explicit domain methods:

```ts
const ROOT = 'admin-module-apps' as const;

export const moduleAppCacheKeys = {
  apps: (filters: string, cursor?: string) => [ROOT, 'apps', filters, cursor ?? ''] as const,
  artifacts: (appId: string, cursor?: string) => [ROOT, 'artifacts', appId, cursor ?? ''] as const,
  audit: (appId: string, cursor?: string) => [ROOT, 'audit', appId, cursor ?? ''] as const,
  detail: (appId: string) => [ROOT, 'detail', appId] as const,
  installs: (appId: string, cursor?: string) => [ROOT, 'installs', appId, cursor ?? ''] as const,
  packages: (status: string, cursor?: string) => [ROOT, 'packages', status, cursor ?? ''] as const,
  payments: (filters: string, cursor?: string) => [ROOT, 'payments', filters, cursor ?? ''] as const,
  payouts: (status: string, cursor?: string) => [ROOT, 'payouts', status, cursor ?? ''] as const,
  products: (appId: string) => [ROOT, 'products', appId] as const,
  publishers: (status: string, cursor?: string) => [ROOT, 'publishers', status, cursor ?? ''] as const,
  records: (appId: string, cursor?: string) => [ROOT, 'records', appId, cursor ?? ''] as const,
  revenue: (filters: string, cursor?: string) => [ROOT, 'revenue', filters, cursor ?? ''] as const,
  runs: (appId: string, cursor?: string) => [ROOT, 'runs', appId, cursor ?? ''] as const,
};
```

- [ ] **Step 4: Implement recoverable URL cursor state**

`advanceCursor` appends the current cursor or an empty string to repeated `previousCursor` parameters. `retreatCursor` pops the last value. `setFilter` deletes cursor state before setting or deleting the named filter. Never serialize an object or opaque cursor by splitting on punctuation.

- [ ] **Step 5: Implement versioned draft storage and leave protection**

Use keys shaped as `admin-module-app-draft:v1:<scope>`. Parse stored JSON defensively, clear corrupt or version-mismatched envelopes, and expose `loadModuleDraft`, `saveModuleDraft`, and `clearModuleDraft`. `useUnsavedChangesGuard` combines `beforeunload` with React Router `useBlocker`; cancel keeps the user on the form and confirm proceeds.

- [ ] **Step 6: Build loading, empty, error, and layout components**

`ModulePageState` accepts `loading`, `error`, `isEmpty`, `emptyKind: 'initial' | 'filtered'`, `onRetry`, `onClearFilters`, and `primaryAction`. Use list/detail skeletons during initial loads, not `Spin`. Refactor `AdminTableState` into a compatibility wrapper around `ModulePageState` so existing tables also stop rendering `Spin`. `useModuleAppDetail(appId)` owns the stable detail SWR key and exposes `{ app, error, isLoading, refresh }` for the detail layout.

`ModuleSectionNav` renders only policy-allowed center sections, keeps finance and operations children grouped, and navigates with route paths from the generated path map. `ModuleAppDetailLayout` loads the app by `:appId`, renders a stable app header, exposes `{ app, refresh }` through `Outlet` context, and shows a true not-found state instead of selecting another app.

- [ ] **Step 7: Add English and Chinese shared copy**

Add keys under `moduleApps.admin.center.*` for navigation labels, loading, initial-empty, filtered-empty, retry, clear filters, unsaved confirmation, app-not-found, and section descriptions. Tests must assert the Chinese labels for all center and detail sections.

- [ ] **Step 8: Run shared component tests and verify GREEN**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/shared src/features/Admin/moduleApps/navigation src/features/Admin/moduleApps/layouts
```

Expected: all Task 2 and Task 3 tests PASS; no `Spin` source reference exists in the new files.

- [ ] **Step 9: Commit shared Module Center UI foundations**

```powershell
git add src/features/Admin/moduleApps/shared src/features/Admin/moduleApps/navigation src/features/Admin/moduleApps/layouts src/features/Admin/moduleApps/AdminTableState.tsx locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): add module center navigation primitives" -m "Constraint: URL state is recoverable and local drafts exclude sensitive finance input."
```

---

### Task 4: Build the Application Directory and Overview

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.readModels.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.readModels.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`
- Create: `src/features/Admin/moduleApps/apps/AppIdentityModal.tsx`
- Create: `src/features/Admin/moduleApps/apps/AppIdentityModal.test.tsx`
- Create: `src/features/Admin/moduleApps/apps/ModuleAppsPage.tsx`
- Create: `src/features/Admin/moduleApps/apps/ModuleAppsPage.test.tsx`
- Create: `src/features/Admin/moduleApps/apps/ModuleAppOverviewPage.tsx`
- Create: `src/features/Admin/moduleApps/apps/ModuleAppOverviewPage.test.tsx`
- Create: `src/features/Admin/moduleApps/apps/identityForm.ts`
- Create: `src/features/Admin/moduleApps/apps/identityForm.test.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Extends: `moduleApps.list({ query?: string; sort?: 'catalog' | 'name_asc' | 'updated_desc' })` without changing response shape.
- Produces: `buildIdentityUpsertInput(identity, currentApp?)` that preserves nested configuration.
- Produces: route-ready application list and overview pages.

- [ ] **Step 1: Add failing server search tests**

Add `query` and `sort` to the router/read-model contract tests. Verify that `listApplications({ query: 'work', sort: 'updated_desc' })` adds a case-insensitive display-name/slug condition and produces an updated-at cursor ordered by `updatedAt DESC, id DESC`. The router input trims query to 80 characters; omitted sort keeps the current catalog order and cursor envelope.

- [ ] **Step 2: Run server tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/moduleApps.readModels.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts
```

Expected: FAIL because `query` is not accepted or forwarded.

- [ ] **Step 3: Add backward-compatible application search**

Import `ilike` and add this read-model condition:

```ts
input.query
  ? or(
      ilike(moduleApps.displayName, `%${input.query.trim()}%`),
      ilike(moduleApps.slug, `%${input.query.trim()}%`),
    )
  : undefined;
```

Add a discriminated application cursor for `catalog`, `name_asc`, and `updated_desc`, validate that an incoming cursor mode matches the requested sort, and generate the next cursor from the active order. Extend the service facade input with `query` and `sort`. Do not change capability procedures or database indexes in this slice.

- [ ] **Step 4: Add failing identity-form tests**

Assert that editing display name/category/status preserves current pages, actions, entitlements, and billing, while a new application starts from `createDefaultModuleAppFormValues()`.

- [ ] **Step 5: Implement identity input composition**

Use the existing normalization/build functions:

```ts
export const buildIdentityUpsertInput = (
  identity: ModuleAppIdentityFormValues,
  current?: AdminModuleAppDetail | null,
) => {
  const base = current ?? createDefaultModuleAppFormValues();
  return buildModuleAppUpsertInput(
    normalizeModuleAppFormValues({
      ...base,
      ...identity,
      actions: current?.actions ?? base.actions,
      billing: current?.billing ?? base.billing,
      entitlements: current?.entitlements ?? base.entitlements,
      pages: current?.pages ?? base.pages,
    }),
  );
};
```

- [ ] **Step 6: Build the directory page with URL state**

`ModuleAppsPage` reads `q`, `status`, `category`, `publisherId`, `sort`, `cursor`, and `previousCursor` from `useSearchParams`; calls only `moduleApps.list`; uses a debounced query update; and navigates rows to `MODULE_ADMIN_ROUTE_PATHS['module-app-overview']` with `:appId` replaced. Creating an app uses `AppIdentityModal`, restores the non-sensitive `new` draft after refresh, clears it on success, invalidates only the apps list key, and navigates to the created app. Publisher filtering is shown only when the role can read publishers; a deep-linked `publisherId` still remains in the URL.

Test that opening the directory never calls packages, payments, payouts, publishers, runtime, or audit service methods.

- [ ] **Step 7: Build the overview page**

Consume `ModuleAppDetailLayout` outlet context. Render identity, version, status, source, category, tags, and publish state. `Edit` uses the identity modal; `Publish`/`Unpublish` require `moduleApp.write`, show warnings from `buildModuleAppPublishWarnings`, and refresh only the detail plus affected app-list cache.

- [ ] **Step 8: Verify application pages GREEN**

```powershell
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/moduleApps.readModels.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/services/adminCommercial.test.ts src/features/Admin/moduleApps/apps
```

Expected: search, preserved nested configuration, URL state, request isolation, and mutation behavior PASS.

- [ ] **Step 9: Commit application directory and overview**

```powershell
git add packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.readModels.ts packages/business-server/src/lambda-routers/admin/moduleApps.readModels.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/moduleApps/apps locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): split module app directory and overview" -m "Constraint: Search extends the existing list input and preserves backend authorization."
```

---

### Task 5: Split Configuration, Entitlements, and Products

**Files:**
- Create: `src/features/Admin/moduleApps/apps/configuration/ModuleAppConfigurationPage.tsx`
- Create: `src/features/Admin/moduleApps/apps/configuration/ModuleAppConfigurationPage.test.tsx`
- Create: `src/features/Admin/moduleApps/apps/entitlements/ModuleAppEntitlementsPage.tsx`
- Create: `src/features/Admin/moduleApps/apps/entitlements/ModuleAppEntitlementsPage.test.tsx`
- Create: `src/features/Admin/moduleApps/apps/products/ModuleAppProductsPage.tsx`
- Create: `src/features/Admin/moduleApps/apps/products/ModuleAppProductsPage.test.tsx`
- Modify: `src/features/Admin/moduleApps/PageEditor.tsx`
- Modify: `src/features/Admin/moduleApps/ActionEditor.tsx`
- Modify: `src/features/Admin/moduleApps/EntitlementEditor.tsx`
- Modify: `src/features/Admin/moduleApps/BillingEditor.tsx`
- Modify: `src/features/Admin/moduleApps/ProductManager.tsx`
- Modify: `src/features/Admin/moduleApps/editors.test.tsx`
- Modify: `src/features/Admin/moduleApps/ProductManager.test.tsx`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Consumes: app detail outlet context and draft/guard helpers.
- Uses: `upsertPages`, `upsertActions`, `upsertEntitlements`, `upsertBilling`, `listProducts`, `createProduct`, and `updateProduct`.
- Preserves: backend capability split between module configuration and finance configuration.

- [ ] **Step 1: Write failing page-level mutation tests**

Assert:

```ts
expect(moduleApps.upsertPages).toHaveBeenCalledWith({ appId: 'app-1', pages });
expect(moduleApps.upsertActions).toHaveBeenCalledWith({ actions, appId: 'app-1' });
expect(moduleApps.upsertEntitlements).toHaveBeenCalledWith({ appId: 'app-1', entitlements });
expect(moduleApps.upsertBilling).toHaveBeenCalledWith({ appId: 'app-1', billing });
```

Also assert that configuration does not call entitlement/billing methods, and entitlements does not call page/action methods.

- [ ] **Step 2: Run page tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/apps/configuration src/features/Admin/moduleApps/apps/entitlements src/features/Admin/moduleApps/apps/products
```

Expected: FAIL because the route pages do not exist.

- [ ] **Step 3: Build configuration as one guarded form**

Initialize Pages and Actions from the outlet app. Persist only `{ pages, actions }` to the `appId/configuration` draft. On save, validate once, call `upsertPages` and `upsertActions` sequentially, keep the draft when either fails, and report which half was accepted so a retry is understandable. Clear the draft only after both succeed, then refresh app detail.

- [ ] **Step 4: Build entitlement and billing editing with finance-write controls**

Render read-only values for any role that reached the page with `moduleApp.read`. Enable Save only when `hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite)` is true. Persist `{ entitlements, billing }` to the `appId/entitlements` draft; never persist data from payout or payment forms. If one targeted mutation succeeds and the other fails, retain the complete draft and state the accepted and failed portions before retry.

- [ ] **Step 5: Route the existing product manager by app context**

Remove optional app selection behavior from the route wrapper: `ModuleAppProductsPage` always passes the outlet app ID. Keep product form lifecycle tests for create and update, use one primary `Add product` action, and invalidate only the product key after a mutation.

- [ ] **Step 6: Replace hardcoded user-facing editor copy**

Move editor labels, empty states, save feedback, and validation messages to `moduleApps.admin.configuration.*`, `moduleApps.admin.entitlements.*`, and `moduleApps.admin.products.*` keys in both English and Chinese files.

- [ ] **Step 7: Verify configuration pages GREEN**

Run the three page test directories plus `editors.test.tsx` and `ProductManager.test.tsx`. Expected: capability gating, draft recovery, request isolation, failed-save preservation, and product lifecycle PASS.

- [ ] **Step 8: Commit application configuration pages**

```powershell
git add src/features/Admin/moduleApps/apps src/features/Admin/moduleApps/PageEditor.tsx src/features/Admin/moduleApps/ActionEditor.tsx src/features/Admin/moduleApps/EntitlementEditor.tsx src/features/Admin/moduleApps/BillingEditor.tsx src/features/Admin/moduleApps/ProductManager.tsx src/features/Admin/moduleApps/editors.test.tsx src/features/Admin/moduleApps/ProductManager.test.tsx locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): route module configuration workflows" -m "Constraint: Billing and entitlement writes remain finance-write operations."
```

---

### Task 6: Split Package Reviews and Complete Publisher Governance

**Files:**
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`
- Create: `src/features/Admin/moduleApps/reviews/ModuleReviewsPage.tsx`
- Create: `src/features/Admin/moduleApps/reviews/ModuleReviewsPage.test.tsx`
- Create: `src/features/Admin/moduleApps/reviews/packageColumns.tsx`
- Create: `src/features/Admin/moduleApps/publishers/ModulePublishersPage.tsx`
- Create: `src/features/Admin/moduleApps/publishers/ModulePublishersPage.test.tsx`
- Create: `src/features/Admin/moduleApps/publishers/PublisherFormModal.tsx`
- Create: `src/features/Admin/moduleApps/publishers/PublisherFormModal.test.tsx`
- Modify: `src/features/Admin/moduleApps/PublisherTable.tsx`
- Modify: `src/features/Admin/moduleApps/PublisherTable.test.tsx`
- Modify: `src/features/Admin/moduleApps/packageReview.test.tsx`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Adds facade methods: `createPublisher`, `verifyPublisher`, `suspendPublisher`, and `assignPublisher`.
- Uses: existing `listPublishers` for the route's finance-read data source.
- Uses: package `reviewStatus` URL state and publisher `status`, `userId`, and cursor URL state.
- Enforces: publisher route read with `finance.read`; governance controls with `moduleApp.write`.

- [ ] **Step 1: Add failing service-facade tests**

Verify one-to-one delegation for:

```ts
createPublisher({ displayName, recipientMask, userId })
verifyPublisher({ publisherId, verificationMetadata: {} })
suspendPublisher({ publisherId })
assignPublisher({ appId, publisherId })
```

- [ ] **Step 2: Add facade methods and verify service tests GREEN**

Delegate directly to existing `lambdaClient.admin.moduleApps` mutations. Do not weaken their `moduleAppWriteProcedure` guards.

- [ ] **Step 3: Write failing page tests**

Reviews must call only `listPackages` on mount, preserve `reviewStatus`, `buildStatus`, `appId`, `publisherId`, `submittedByUserId`, and cursor state in the URL, and refresh packages plus app detail only after approval changes application state. Publisher tests must show read-only rows to `finance_admin` and hide create/verify/suspend/assign controls without `moduleApp.write`.

- [ ] **Step 4: Build the review queue**

Move package columns and actions out of the old monolith. Reject requires a reason modal instead of the hardcoded `Rejected from admin review queue`; approve, reject, and rescan use confirm/in-progress/success-or-error feedback in one interaction surface.

- [ ] **Step 5: Build complete publisher lifecycle controls**

Add a create modal for display name, owner user ID, and masked recipient. Add row actions for verify and suspend. Add assignment UI that requires both a selected publisher and app and calls `assignPublisher`. After each mutation, invalidate only publisher data plus the affected app detail/list keys.

- [ ] **Step 6: Verify review and publisher pages GREEN**

```powershell
bunx vitest run --silent='passed-only' src/services/adminCommercial.test.ts src/features/Admin/moduleApps/reviews src/features/Admin/moduleApps/publishers src/features/Admin/moduleApps/packageReview.test.tsx src/features/Admin/moduleApps/PublisherTable.test.tsx
```

Expected: request isolation, URL restoration, reason capture, lifecycle operations, and capability-gated actions PASS.

- [ ] **Step 7: Commit governance workflows**

```powershell
git add src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/moduleApps/reviews src/features/Admin/moduleApps/publishers src/features/Admin/moduleApps/PublisherTable.tsx src/features/Admin/moduleApps/PublisherTable.test.tsx src/features/Admin/moduleApps/packageReview.test.tsx locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): split module review and publisher governance" -m "Constraint: Publisher reads require finance-read while governance actions require module-app-write."
```

---

### Task 7: Split Revenue, Payments, and Payouts

**Files:**
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`
- Create: `src/features/Admin/moduleApps/finance/revenue/ModuleRevenuePage.tsx`
- Create: `src/features/Admin/moduleApps/finance/revenue/ModuleRevenuePage.test.tsx`
- Create: `src/features/Admin/moduleApps/finance/payments/ModulePaymentsPage.tsx`
- Create: `src/features/Admin/moduleApps/finance/payments/ModulePaymentsPage.test.tsx`
- Create: `src/features/Admin/moduleApps/finance/payouts/ModulePayoutsPage.tsx`
- Create: `src/features/Admin/moduleApps/finance/payouts/ModulePayoutsPage.test.tsx`
- Create: `src/features/Admin/moduleApps/finance/payouts/PayoutActionModal.tsx`
- Create: `src/features/Admin/moduleApps/finance/payouts/PayoutActionModal.test.tsx`
- Modify: `src/features/Admin/moduleApps/CommerceTable.tsx`
- Modify: `src/features/Admin/moduleApps/CommerceTable.test.tsx`
- Modify: `src/features/Admin/moduleApps/PaymentReconciliationTable.tsx`
- Modify: `src/features/Admin/moduleApps/PaymentReconciliationTable.test.tsx`
- Modify: `src/features/Admin/moduleApps/PayoutTable.tsx`
- Modify: `src/features/Admin/moduleApps/PayoutTable.test.tsx`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Adds existing backend operations to the facade: reconciliation export/run, discrepancy acknowledgement, query/refund retry, refund/settlement, payout create/transition/manual evidence.
- Uses: independent URL filters and cache keys per finance page.
- Enforces: read pages with `finance.read`; mutation controls with `finance.write`.

- [ ] **Step 1: Add failing facade delegation tests**

Cover exact methods and input shapes:

```ts
acknowledgePaymentDiscrepancy({ discrepancyId })
exportPaymentReconciliation({ cursor, limit, status })
reconcilePendingPayments({ limit: 100 })
refundOrder({ offlineRefundReference, orderId, reason })
refundPaymentOrder({ orderId, reason })
retryPaymentQuery({ outTradeNo })
retryRefundStatus({ orderId })
settleOrder({ orderId, paymentReference })
createPayoutBatch({ publisherId, requestedAmount, revenueEntryIds })
recordManualAlipayPayout({ batchId, evidenceReference, recipientMask, transactionNo })
transitionPayoutBatch({ batchId, failureReason, status })
```

- [ ] **Step 2: Implement facade methods and verify service tests GREEN**

Delegate to the existing tRPC procedures without changing input names, environment guards, audit wrapping, or backend capability procedures.

- [ ] **Step 3: Write failing finance page tests**

Each page test must prove it calls only its own list endpoint. Both `finance_admin` and full admin see finance-write controls because the current role matrix grants `finance.write`; component-level tests with `canWrite={false}` must hide every mutation action so future read-only roles remain safe. Payment and payout action inputs must never appear in `localStorage`.

- [ ] **Step 4: Build revenue as a dedicated batch-settlement page**

Put status, app, publisher, and cursor in the URL. Keep multi-select settlement in `CommerceTable`, require confirmation with selected count and amount, and refresh only revenue data after success.

- [ ] **Step 5: Build payment reconciliation and recovery actions**

Put payment, refund, discrepancy, app, and cursor filters in the URL. Add row/menu actions only when their required identifiers are present. The existing export procedure exports payment discrepancies, so export uses only the current discrepancy status plus its cursor/limit and is labeled accordingly; it must not imply that app/payment/refund filters were exported. Reconcile pending and retries show progress and a final result; refund/settlement modals keep entered values after server failure and clear them only after success.

- [ ] **Step 6: Build payout lifecycle actions**

Put status, publisher, and cursor in the URL. Add create batch, transition, and manual Alipay evidence flows. Masked recipient is displayed but never persisted locally. Lock modal dismissal while a transition is in flight and keep error details inside the modal.

- [ ] **Step 7: Verify finance pages GREEN**

Run service plus all finance/table tests. Expected: request isolation, capability-gated actions, exact backend inputs, filter restoration, sensitive-input non-persistence, and failure preservation PASS.

- [ ] **Step 8: Commit finance workflows**

```powershell
git add src/services/adminCommercial.ts src/services/adminCommercial.test.ts src/features/Admin/moduleApps/finance src/features/Admin/moduleApps/CommerceTable.tsx src/features/Admin/moduleApps/CommerceTable.test.tsx src/features/Admin/moduleApps/PaymentReconciliationTable.tsx src/features/Admin/moduleApps/PaymentReconciliationTable.test.tsx src/features/Admin/moduleApps/PayoutTable.tsx src/features/Admin/moduleApps/PayoutTable.test.tsx locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): split module finance workflows" -m "Constraint: Preserve payment, refund, reconciliation, and payout state machines."
```

---

### Task 8: Split Runtime Operations and Audit

**Files:**
- Create: `src/features/Admin/moduleApps/operations/ModuleAppFilter.tsx`
- Create: `src/features/Admin/moduleApps/operations/ModuleAppFilter.test.tsx`
- Create: `src/features/Admin/moduleApps/operations/installs/ModuleInstallsPage.tsx`
- Create: `src/features/Admin/moduleApps/operations/records/ModuleRecordsPage.tsx`
- Create: `src/features/Admin/moduleApps/operations/runs/ModuleRunsPage.tsx`
- Create: `src/features/Admin/moduleApps/operations/artifacts/ModuleArtifactsPage.tsx`
- Create: `src/features/Admin/moduleApps/operations/operations.test.tsx`
- Create: `src/features/Admin/moduleApps/apps/runtime/ModuleAppRuntimePage.tsx`
- Create: `src/features/Admin/moduleApps/apps/runtime/ModuleAppRuntimePage.test.tsx`
- Create: `src/features/Admin/moduleApps/audit/ModuleAuditPage.tsx`
- Create: `src/features/Admin/moduleApps/audit/ModuleAuditPage.test.tsx`
- Modify: `src/features/Admin/moduleApps/InstallsTable.tsx`
- Modify: `src/features/Admin/moduleApps/RecordsTable.tsx`
- Modify: `src/features/Admin/moduleApps/RunsTable.tsx`
- Modify: `src/features/Admin/moduleApps/ArtifactsTable.tsx`
- Modify: `src/features/Admin/moduleApps/AuditEventsTable.tsx`
- Modify: `src/features/Admin/moduleApps/tables.test.tsx`
- Modify: `src/features/Admin/moduleApps/types.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Global operation/audit pages consume `appId` from search params and call exactly one domain endpoint.
- Detail runtime page consumes `appId` from route context and calls installs, records, runs, and artifacts only.
- `ModuleAppFilter` preserves a deep-linked selected app even when it is outside the first list page.

- [ ] **Step 1: Write failing global operation tests**

For `/operations/runs?appId=app-1`, assert only `listRuns` is called. With no `appId`, assert no runtime endpoint is called and the page asks the admin to choose an app. Repeat explicit endpoint assertions for installs, records, artifacts, and audit.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/operations src/features/Admin/moduleApps/apps/runtime src/features/Admin/moduleApps/audit
```

Expected: FAIL because the pages do not exist.

- [ ] **Step 3: Build the reusable app filter**

Load a cursor page of applications for options. If the URL app ID is absent from that page, fetch it by `moduleApps.get` and prepend it. Selecting an app sets `appId` and clears cursor history. Loading more options must not reset the selected deep link.

- [ ] **Step 4: Build four isolated global operation pages**

Move the record, run, artifact, install, and audit row types out of the deleted monolith into `types.ts`. Each page owns one endpoint, one cache key, one cursor trail, and one existing table. Use a page-specific title and empty copy. No operation page mounts sibling hooks.

- [ ] **Step 5: Build the app-scoped runtime summary**

The detail runtime page intentionally loads installs, records, runs, and artifacts for its one app. Render four flat sections with independent error/retry states and links to their global operation route carrying `?appId=<id>`.

- [ ] **Step 6: Build module audit with the combined access rule**

Require an app filter before calling `listAuditEvents`. The route policy requires `audit.read` plus module or finance read; the backend call remains guarded by `auditReadProcedure`. Audit is read-only and exposes no mutation controls.

- [ ] **Step 7: Verify operations and audit GREEN**

Run operation, runtime, audit, and existing table tests. Expected: endpoint isolation, selected-app restoration, cursor behavior, four-section runtime behavior, and read-only audit PASS.

- [ ] **Step 8: Commit runtime and audit workflows**

```powershell
git add src/features/Admin/moduleApps/operations src/features/Admin/moduleApps/apps/runtime src/features/Admin/moduleApps/audit src/features/Admin/moduleApps/InstallsTable.tsx src/features/Admin/moduleApps/RecordsTable.tsx src/features/Admin/moduleApps/RunsTable.tsx src/features/Admin/moduleApps/ArtifactsTable.tsx src/features/Admin/moduleApps/AuditEventsTable.tsx src/features/Admin/moduleApps/tables.test.tsx src/features/Admin/moduleApps/types.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): split module runtime and audit views" -m "Constraint: Global operation pages request only their selected app and domain."
```

---

### Task 9: Add the Module Overview and Thin Route Files

**Files:**
- Create: `src/business/client/moduleAdminRouteImports.ts`
- Create: `src/features/Admin/moduleApps/overview/ModuleOverviewPage.tsx`
- Create: `src/features/Admin/moduleApps/overview/ModuleOverviewPage.test.tsx`
- Create: `src/routes/(main)/admin/modules/_layout/index.tsx`
- Create: `src/routes/(main)/admin/modules/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/[appId]/_layout/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/[appId]/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/[appId]/configuration/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/[appId]/entitlements/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/[appId]/products/index.tsx`
- Create: `src/routes/(main)/admin/modules/apps/[appId]/runtime/index.tsx`
- Create: `src/routes/(main)/admin/modules/reviews/index.tsx`
- Create: `src/routes/(main)/admin/modules/publishers/index.tsx`
- Create: `src/routes/(main)/admin/modules/finance/revenue/index.tsx`
- Create: `src/routes/(main)/admin/modules/finance/payments/index.tsx`
- Create: `src/routes/(main)/admin/modules/finance/payouts/index.tsx`
- Create: `src/routes/(main)/admin/modules/operations/installs/index.tsx`
- Create: `src/routes/(main)/admin/modules/operations/records/index.tsx`
- Create: `src/routes/(main)/admin/modules/operations/runs/index.tsx`
- Create: `src/routes/(main)/admin/modules/operations/artifacts/index.tsx`
- Create: `src/routes/(main)/admin/modules/audit/index.tsx`
- Create: `src/routes/(main)/admin/modules/routes.test.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Produces: every route import named by `MODULE_ADMIN_ROUTE_TREE`.
- Produces: `MODULE_ADMIN_ROUTE_IMPORTS: Record<ModuleAdminRouteId, ImportPage | undefined>` without registering it yet.
- Keeps: route files as one-import default exports.
- Overview loads only capability-allowed summary requests.

- [ ] **Step 1: Write failing overview isolation tests**

For a pure overview request-policy case with module read enabled and finance read disabled, expect pending packages, recently updated apps, and app-scoped recent runs only after an app is selected. For `finance_admin`, expect open payment discrepancies and no package/runtime request. For full admin, expect both sets without loading complete tables.

- [ ] **Step 2: Build the lightweight overview**

Use limits of five. Render pending review, open discrepancy, recent application, and selected-app recent-run sections as flat bands with direct links. Store selected overview `appId` in the URL. Do not perform mutations from overview.

- [ ] **Step 3: Create every thin route module**

Each file contains only a feature import and default export, for example:

```tsx
import ModulePaymentsPage from '@/features/Admin/moduleApps/finance/payments/ModulePaymentsPage';

export default ModulePaymentsPage;
```

The layout files export `ModuleCenterLayout` and `ModuleAppDetailLayout` respectively. Create the complete lazy import map in `moduleAdminRouteImports.ts`; `module-finance` and `module-operations` map to `undefined`, while every layout/page ID maps to exactly one thin route file.

- [ ] **Step 4: Add route-file completeness tests**

Walk every route ID with an importer in `MODULE_ADMIN_ROUTE_IMPORTS` and assert the file exists. Assert route files do not import SWR, services, stores, or antd. This catches business logic leaking into route roots.

- [ ] **Step 5: Verify overview and route roots GREEN**

Run overview and route tests. Expected: role-aware request isolation and all thin route files PASS.

- [ ] **Step 6: Commit completed but not yet registered pages**

```powershell
git add src/business/client/moduleAdminRouteImports.ts src/features/Admin/moduleApps/overview src/routes/'(main)'/admin/modules locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): complete module center route pages" -m "Constraint: Route roots remain thin and the overview avoids unauthorized requests."
```

---

### Task 10: Atomically Cut Over Navigation and Delete the Monolith

**Files:**
- Modify: `src/business/client/adminSettingsRouteRegistry.ts`
- Modify: `src/business/client/adminSettingsRouteRegistry.test.ts`
- Modify: `src/business/client/BusinessDesktopRoutes.test.ts`
- Modify: `src/features/Admin/adminCatalog.ts`
- Modify: `src/features/Admin/adminCatalog.test.ts`
- Modify: `src/features/Admin/adminNavigation.ts`
- Modify: `src/features/Admin/adminNavigation.test.ts`
- Modify: `src/routes/(main)/admin/_layout/index.tsx`
- Modify: `src/routes/(main)/admin/_layout/index.test.tsx`
- Delete: `src/routes/(main)/admin/module-apps/index.tsx`
- Delete: `src/features/Admin/moduleApps/AdminPage.tsx`
- Delete: `src/features/Admin/moduleApps/AdminPage.test.tsx`
- Delete: `src/features/Admin/moduleApps/FinancePage.tsx`
- Delete: `src/features/Admin/moduleApps/FinancePage.test.tsx`
- Delete: `src/features/Admin/moduleApps/index.tsx`
- Delete: `src/features/Admin/moduleApps/access.ts`
- Delete: `src/features/Admin/moduleApps/access.test.ts`
- Delete: `src/features/Admin/moduleApps/AppEditorModal.tsx`
- Delete: `src/features/Admin/moduleApps/AppEditorModal.test.tsx`
- Delete: `src/features/Admin/moduleApps/useCursorPagination.ts`
- Modify: `src/spa/router/desktopRouter.sync.test.tsx`
- Modify: `src/features/Admin/adminChineseCopy.test.ts`

**Interfaces:**
- Changes: top-level catalog ID/segment/path from `module-apps` to `modules`.
- Registers: the recursive Module Center route tree with exact lazy import mapping.
- Changes: `canAccessAdminPath` to use the most-specific module policy before top-level fallback.
- Produces: `getAdminUnauthorizedFallbackPath(role, pathname)`.
- Removes: every old Module App page and route reference.

- [ ] **Step 1: Write failing cutover tests first**

Assert all of the following before editing production registration:

```ts
expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain('modules');
expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).not.toContain('module-apps');
expect(getAdminSelectedKey('/settings/admin/modules/apps/app-1/products')).toBe(
  '/settings/admin/modules',
);
expect(getAdminSelectedKey('/settings/admin/module-apps')).toBe(ADMIN_BASE_PATH);
expect(canAccessAdminPath('finance_admin', '/settings/admin/modules/finance/payments')).toBe(true);
expect(canAccessAdminPath('finance_admin', '/settings/admin/modules/apps')).toBe(false);
expect(canAccessAdminPath('content_admin', '/settings/admin/modules')).toBe(false);
expect(matchRoutes(BusinessDesktopRoutesWithSettingsLayout, '/admin/module-apps')).toBeNull();
```

Also assert every module route node with an element has exactly one importer and every navigable section resolves to exactly one leaf.

- [ ] **Step 2: Run the cutover tests and verify RED**

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.test.ts src/business/client/adminSettingsRouteRegistry.test.ts src/business/client/BusinessDesktopRoutes.test.ts src/routes/'(main)'/admin/_layout/index.test.tsx
```

Expected: FAIL because production registration still uses `module-apps`.

- [ ] **Step 3: Register the full recursive route tree**

Import the exact `MODULE_ADMIN_ROUTE_IMPORTS` mapping from Task 9. Convert the metadata tree to recursive registry nodes and substitute it for the `modules` top-level catalog item.

- [ ] **Step 4: Switch the top-level catalog and navigation**

Replace the current item with:

```ts
{
  accessCapabilities: [ADMIN_CAPABILITIES.moduleAppRead, ADMIN_CAPABILITIES.financeRead],
  backendDomains: ['moduleApps'],
  debugId: 'Desktop > Admin > modules',
  description: '治理模块应用、审核、商业化和运行数据',
  group: 'module-apps',
  icon: 'plugins',
  id: 'modules',
  label: '模块应用中心',
  owner: 'module-apps',
  path: pathFor('modules'),
  readCapability: ADMIN_CAPABILITIES.moduleAppRead,
  segment: 'modules',
  status: 'experimental',
  writeCapabilities: [
    ADMIN_CAPABILITIES.moduleAppWrite,
    ADMIN_CAPABILITIES.financeWrite,
    ADMIN_CAPABILITIES.auditRead,
  ],
}
```

Do not add `module-apps` to `ADMIN_LEGACY_ROUTES`.

- [ ] **Step 5: Wire most-specific access and safe fallback**

In `canAccessAdminPath`, normalize the path, resolve a Module Center section first, and evaluate its `allOf`/`anyOf` policy. Only non-module paths fall back to `ADMIN_PATH_CAPABILITIES`.

Implement:

```ts
export const getAdminUnauthorizedFallbackPath = (role: string | null | undefined, pathname: string) => {
  const cleanPath = normalizeAdminPath(pathname);
  if (cleanPath === MODULE_ADMIN_ROOT_PATH || cleanPath.startsWith(`${MODULE_ADMIN_ROOT_PATH}/`)) {
    return getModuleCenterSectionsForRole(role)[0]?.path ?? getAdminDefaultPath(role);
  }
  return getAdminDefaultPath(role);
};
```

Use it in `AdminLayout` when access is denied.

- [ ] **Step 6: Delete the old route, role switch, monolith, and combined modal**

Remove the files listed above only after all registry/access tests pass against the new tree. Remove imports and tests that exist solely for the `governance | finance` surface switch. Keep reusable tables, editors, schemas, and types referenced by the new pages.

- [ ] **Step 7: Run the single combined focused verification round**

Run once:

```powershell
bunx vitest run --silent='passed-only' src/business/client/adminSettingsRouteRegistry.test.ts src/business/client/BusinessDesktopRoutes.test.ts src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.test.ts src/features/Admin/adminChineseCopy.test.ts src/routes/'(main)'/admin/_layout/index.test.tsx src/spa/router/desktopRouter.sync.test.tsx src/features/Admin/moduleApps packages/business-server/src/lambda-routers/admin/moduleApps.readModels.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/services/adminCommercial.test.ts
```

Expected: all selected tests PASS with no unhandled promise rejection.

- [ ] **Step 8: Run type, lint, format, and diff checks**

```powershell
bun run type-check
bunx eslint src/business/client src/features/Admin src/routes/'(main)'/admin/modules packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.readModels.ts src/services/adminCommercial.ts
bunx prettier --check src/business/client src/features/Admin src/routes/'(main)'/admin/modules packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.readModels.ts src/services/adminCommercial.ts locales/en-US/common.json locales/zh-CN/common.json
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 9: Perform one browser acceptance pass**

Start the full development environment:

```powershell
bun run dev
```

Verify visibly at desktop width and a 768px narrow viewport:

1. Full admin can deep-link to overview, apps, app detail, configuration, entitlements, products, runtime, reviews, publishers, all finance pages, all operation pages, and audit.
2. Finance admin sees overview, publishers, finance, and audit only; direct `/modules/apps` access redirects to the first permitted Module Center section.
3. An unrelated scoped admin does not see Module Center and cannot enter it directly.
4. App, filters, and cursor position survive refresh and browser back/forward.
5. Non-sensitive configuration draft restores after refresh; payment/payout input does not appear in local storage.
6. `/settings/admin/module-apps` reaches the normal unmatched-route behavior and never renders Module App administration.
7. Loading, initial-empty, filtered-empty, error, success, and failed-mutation states do not overlap or horizontally overflow.

Record any auth or environment blocker exactly; do not replace visible role checks with source inspection.

- [ ] **Step 10: Review the final diff and commit the cutover**

Confirm `git status --short` contains no unrelated files and `rg -n "settings/admin/module-apps|admin/module-apps|segment: 'module-apps'" src packages --glob '!**/*.test.*'` returns no production route reference. Then commit:

```powershell
git add src/business/client src/features/Admin src/routes/'(main)'/admin src/spa/router/desktopRouter.sync.test.tsx packages/business-server/src/lambda-routers/admin src/services/adminCommercial.ts src/services/adminCommercial.test.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "✨ feat(admin): replace module app monolith with module center" -m "Constraint: Remove the old Module App URL without redirects, aliases, or compatibility rendering." -m "Scope-risk: Admin routing, scoped navigation, Module App governance, finance, operations, and audit UI." -m "Tested: focused Vitest round; type-check; changed-scope ESLint and Prettier; git diff --check; one browser acceptance pass."
```

## Final Review Checklist

- [ ] Every design-spec route exists exactly once and resolves to a thin route file.
- [ ] No old Module App URL, import, alias, compatibility item, tab query, or role-surface switch remains.
- [ ] Finance, module governance, entitlement/billing, publisher, and audit permissions match backend procedures.
- [ ] Opening one leaf page does not mount sibling data hooks.
- [ ] Every list uses URL filters and cursor trail and distinguishes all four data states.
- [ ] Every editable non-sensitive page restores scoped drafts and keeps input after failed saves.
- [ ] Payment and payout form values are never persisted locally.
- [ ] No new component uses antd `Spin`, hardcoded colors, nested cards, or multiple primary actions.
- [ ] Existing database schema, payment callbacks, state machines, and runtime results are unchanged.
- [ ] Final verification evidence distinguishes focused tests, type-check, and browser acceptance; no build result is reported as full E2E proof.
