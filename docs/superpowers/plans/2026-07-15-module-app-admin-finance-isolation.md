# Module App Admin Finance Isolation Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a red-green-refactor test cycle and review each scoped commit before continuing.

**Goal:** Keep `finance_admin` access to Module App finance operations without granting generic Module App governance reads or rendering governance controls.

**Architecture:** Preserve `/settings/admin/module-apps` as the single outer route. The catalog will support an explicit any-of route access contract, while backend procedures retain domain-specific capabilities. A thin role-aware feature entry will render either the existing governance page for full admins or a new finance-only page that loads only revenue, payment diagnostics, publisher finance context, and payouts.

**Tech Stack:** TypeScript, React 19, React Router, SWR, tRPC, Vitest, `@lobechat/types`, `@lobehub/ui`, antd.

## Global Constraints

- Keep `/settings/admin/module-apps` as the only Module App admin route.
- Do not rename or remove existing tRPC procedures.
- Do not change payment, refund, reconciliation, settlement, payout, or Alipay state transitions.
- Do not add database migrations or change schemas.
- A `finance_admin` must not receive `moduleApp.read` or `moduleApp.write`.
- A `finance_admin` may access the outer Module App route through `finance.read` and may call only finance-owned read/write procedures.
- Full `admin` behavior remains unchanged through the wildcard capability set.
- Use focused Vitest commands and run the root type check before completion.

---

### Task 1: Separate Route Access From Backend Domain Ownership

**Files:**
- Modify: `src/features/Admin/adminCatalog.ts`
- Modify: `src/features/Admin/adminCatalog.test.ts`
- Modify: `src/features/Admin/adminNavigation.ts`
- Modify: `src/features/Admin/adminNavigation.test.ts`
- Modify: `packages/types/src/admin.ts`
- Modify: `packages/types/src/admin.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`

**Interfaces:**
- Consumes: `AdminCapability`, `hasAdminCapability`, `ADMIN_CAPABILITIES.financeRead`, `ADMIN_CAPABILITIES.moduleAppRead`.
- Produces: optional `accessCapabilities` catalog metadata with any-of route semantics; finance-owned `listPublishers` authorization.

- [ ] **Step 1: Write failing route and role contract tests**

Add assertions that the Module App catalog entry exposes:

```ts
expect(byId['module-apps'].accessCapabilities).toEqual([
  ADMIN_CAPABILITIES.moduleAppRead,
  ADMIN_CAPABILITIES.financeRead,
]);
```

Change the shared role test to require:

```ts
expect(hasAdminCapability('finance_admin', ADMIN_CAPABILITIES.financeRead)).toBe(true);
expect(hasAdminCapability('finance_admin', ADMIN_CAPABILITIES.moduleAppRead)).toBe(false);
expect(hasAdminCapability('finance_admin', ADMIN_CAPABILITIES.moduleAppWrite)).toBe(false);
```

Keep the navigation expectation that `finance_admin` can access `/settings/admin/module-apps`, proving route access no longer depends on backend Module App ownership.

- [ ] **Step 2: Write failing backend ownership tests**

Move `listPublishers` from the Module App read expectation to the finance read expectation. Update the runtime authorization test so `finance_admin`:

```ts
await expect(caller.moduleApps.list({ limit: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
await expect(caller.moduleApps.listPublishers({ limit: 20 })).resolves.toEqual({
  items: [],
  nextCursor: null,
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
bunx vitest run --silent=passed-only packages/types/src/admin.test.ts src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.test.ts packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts
```

Expected: FAIL because route access still uses one capability, `finance_admin` still owns `moduleApp.read`, and `listPublishers` is still Module App-bound.

- [ ] **Step 4: Implement the minimal capability changes**

Add this optional field to `AdminCatalogItem`:

```ts
accessCapabilities?: AdminCapability[];
```

Set only the Module App item:

```ts
accessCapabilities: [ADMIN_CAPABILITIES.moduleAppRead, ADMIN_CAPABILITIES.financeRead],
```

Build the navigation capability map from `accessCapabilities ?? [readCapability]`, and authorize scoped roles when any listed capability matches. Remove `moduleAppRead` from `finance_admin`. Bind `listPublishers` to `financeReadProcedure`.

- [ ] **Step 5: Run tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/types/src/admin.ts packages/types/src/admin.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts packages/business-server/src/lambda-routers/admin/__tests__/scopedReadProcedures.test.ts src/features/Admin/adminCatalog.ts src/features/Admin/adminCatalog.test.ts src/features/Admin/adminNavigation.ts src/features/Admin/adminNavigation.test.ts
git commit -m "fix: isolate Module App finance route access" -m "Constraint: Preserve the unified route without granting finance admins Module App governance reads." -m "Tested: shared capability, catalog, navigation, and Module App router tests."
```

---

### Task 2: Add A Finance-Only Module App Surface

**Files:**
- Create: `src/features/Admin/moduleApps/access.ts`
- Create: `src/features/Admin/moduleApps/access.test.ts`
- Create: `src/features/Admin/moduleApps/AdminPage.tsx`
- Create: `src/features/Admin/moduleApps/AdminPage.test.tsx`
- Create: `src/features/Admin/moduleApps/FinancePage.tsx`
- Create: `src/features/Admin/moduleApps/FinancePage.test.tsx`
- Modify: `src/routes/(main)/admin/module-apps/index.tsx`
- Modify: `packages/locales/src/default/common.ts`
- Modify: `locales/en-US/common.json`
- Modify: `locales/zh-CN/common.json`

**Interfaces:**
- Consumes: the current governance page default export, `useUserStore`, shared capability helpers, existing finance tables, `adminCommercialService.moduleApps` finance procedures.
- Produces: `getModuleAppAdminSurface(role)` returning `finance`, `governance`, or `none`; an independently loaded finance page.

- [ ] **Step 1: Write failing access tests**

Define the desired pure contract:

```ts
expect(getModuleAppAdminSurface('admin')).toBe('governance');
expect(getModuleAppAdminSurface('finance_admin')).toBe('finance');
expect(getModuleAppAdminSurface('content_admin')).toBe('none');
```

- [ ] **Step 2: Write failing wrapper and finance page tests**

Mock the two page components and user store. Assert that `AdminPage` renders governance for `admin` and finance for `finance_admin`.

For `FinancePage`, mock `useClientDataSWR` and capture keys. Assert that it registers only:

```ts
[
  'admin-module-app-revenue',
  'admin-module-app-payments',
  'admin-module-app-publishers',
  'admin-module-app-payouts',
]
```

Assert that finance tabs render and governance labels such as `Package review`, `Pages`, `Actions`, `Products`, `Runs`, and `Audit` do not.

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
bunx vitest run --silent=passed-only src/features/Admin/moduleApps/access.test.ts src/features/Admin/moduleApps/AdminPage.test.tsx src/features/Admin/moduleApps/FinancePage.test.tsx
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 4: Implement the role-aware entry**

Use shared capability helpers in `access.ts`:

```ts
export const getModuleAppAdminSurface = (role?: string | null) => {
  if (hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite)) return 'governance';
  if (hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead)) return 'finance';
  return 'none';
};
```

`AdminPage.tsx` reads the initialized user role and renders `FinancePage` only for the finance surface; otherwise it renders the existing governance page. The outer Admin layout continues to handle unauthorized roles.

- [ ] **Step 5: Implement the independently loaded finance page**

The page must load only `listRevenue`, `listPaymentDiagnostics`, `listPublishers`, and `listPayouts`. Reuse `CommerceTable`, `PaymentReconciliationTable`, `PublisherTable`, `PayoutTable`, `CursorPager`, and `useCursorPagination`. Keep settlement on `finance.write`; do not add new mutation behavior.

Add default English and hand-maintained `en-US`/`zh-CN` keys under `moduleApps.admin.finance.*` for the title, description, refresh action, tabs, filters, success, and failure feedback.

- [ ] **Step 6: Point the route at the role-aware entry**

Change the thin route import to:

```ts
import AdminModuleAppsPage from '@/features/Admin/moduleApps/AdminPage';
```

- [ ] **Step 7: Run tests and verify GREEN**

Run the command from Step 3, then the existing Module App table tests. Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/features/Admin/moduleApps src/routes/(main)/admin/module-apps/index.tsx packages/locales/src/default/common.ts locales/en-US/common.json locales/zh-CN/common.json
git commit -m "feat: add a finance-only Module App admin surface" -m "Constraint: Finance admins must not load or render governance data and controls." -m "Tested: Module App access, finance page, wrapper, and table tests."
```

---

### Task 3: Verify The Incremental Phase 5 Boundary

**Files:**
- Modify: `docs/development/admin-refactor-progress.zh-CN.md`

- [ ] **Step 1: Record the boundary**

Document that `finance_admin` reaches the shared outer route through `finance.read`, receives a finance-only page, and no longer owns `moduleApp.read`.

- [ ] **Step 2: Run focused verification**

Run all tests changed by Tasks 1 and 2 plus existing Module App router/table tests.

- [ ] **Step 3: Run type and diff checks**

```powershell
bun run type-check
git diff --check
git status --short --branch
```

- [ ] **Step 4: Review behavior drift**

Confirm no tRPC name, input/output schema, payment state transition, Alipay adapter, database schema, or full-admin governance behavior changed.

- [ ] **Step 5: Commit documentation**

```powershell
git add docs/development/admin-refactor-progress.zh-CN.md
git commit -m "docs: record Module App finance isolation" -m "Constraint: Keep Phase 5 incremental and preserve payment behavior." -m "Tested: focused Module App suite, type-check, and diff-check."
```
