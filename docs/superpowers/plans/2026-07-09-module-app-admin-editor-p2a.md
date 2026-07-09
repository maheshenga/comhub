# Module App Admin Editor P2-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable `/admin/module-apps` editor for listing, creating, editing, publishing, and inspecting Module Apps.

**Architecture:** Keep the route thin and implement the editor under `src/features/Admin/moduleApps`. Add pure form/view-model helpers first, then section editors, then the page shell, then operational read-only panels and docs. Reuse the existing `admin.moduleApps` router and `adminCommercialService.moduleApps` wrapper without changing backend contracts unless a focused failing test proves a gap.

**Tech Stack:** Next.js SPA route, React 19, TypeScript, SWR, `@lobehub/ui`, antd, tRPC, Vitest.

## Global Constraints

- Read `docs/FEATURE_REGISTRY.md`, `docs/PROJECT_AUDIT.md`, and `docs/REFACTOR_PLAN.md` before code changes.
- Keep `src/routes/(main)/admin/module-apps/index.tsx` thin and delegate UI to `src/features/Admin/moduleApps`.
- Do not modify Platform Plugin Marketplace behavior.
- Do not import MCP or Skills into Module App.
- Do not add arbitrary frontend JavaScript, iframe apps, or remote module execution.
- Do not add real credit ledger posting in P2-A.
- Preserve existing `admin.moduleApps` router contracts unless tests require a small additive change.
- New or modified Module App behavior must update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md`.
- Use TDD for implementation: write failing tests, verify red, implement, verify green.
- User directive for this phase: execute inline; do not use subagents.

---

## File Structure

- Modify: `src/features/Admin/moduleApps/formSchema.ts`
  - Pure form normalization, JSON parsing, upsert payload building, publish warning helpers.
- Modify: `src/features/Admin/moduleApps/formSchema.test.ts`
  - TDD coverage for form defaults, JSON parsing, invalid payloads, publish warnings.
- Create: `src/features/Admin/moduleApps/types.ts`
  - Admin UI row/detail aliases used by page and subcomponents.
- Modify: `src/features/Admin/moduleApps/PageEditor.tsx`
  - Schema-driven page rows inside an antd `Form.List`.
- Modify: `src/features/Admin/moduleApps/ActionEditor.tsx`
  - Schema-driven action rows inside an antd `Form.List`.
- Modify: `src/features/Admin/moduleApps/EntitlementEditor.tsx`
  - Plan entitlement row editor.
- Modify: `src/features/Admin/moduleApps/BillingEditor.tsx`
  - Billing config form section.
- Modify: `src/features/Admin/moduleApps/AppEditorModal.tsx`
  - Create/edit modal using the helpers and section editors.
- Modify: `src/features/Admin/moduleApps/index.tsx`
  - Admin list/detail shell, filters, publish/unpublish, save flows, tabs.
- Create: `src/features/Admin/moduleApps/InstallsTable.tsx`
  - Read-only admin installation table.
- Create: `src/features/Admin/moduleApps/AuditEventsTable.tsx`
  - Read-only admin audit event table.
- Modify: `src/features/Admin/moduleApps/RecordsTable.tsx`
  - Add loading prop and safer date/status rendering.
- Modify: `src/features/Admin/moduleApps/RunsTable.tsx`
  - Add loading prop, readable run/billing/error preview.
- Modify: `src/features/Admin/moduleApps/ArtifactsTable.tsx`
  - Add loading prop and artifact metadata rendering.
- Modify: `src/services/adminCommercial.test.ts`
  - Add service wrapper coverage for Module App detail and mutations if implementation uses them directly.
- Modify: `docs/FEATURE_REGISTRY.md`
  - Update Module App Platform entry with P2-A admin editor status.
- Modify: `docs/CHANGELOG_INTERNAL.md`
  - Add internal changelog note for P2-A.

## Task 1: Form Helpers And View-Model Foundation

**Files:**
- Modify: `src/features/Admin/moduleApps/formSchema.ts`
- Modify: `src/features/Admin/moduleApps/formSchema.test.ts`
- Create: `src/features/Admin/moduleApps/types.ts`

**Interfaces:**
- Consumes: `moduleAppAdminUpsertSchema`, `ModuleAppAdminUpsertInput`, `ModuleAppBillingConfig`, `ModuleAppPage`, `ModuleAppActionConfig`, `ModuleAppPlanEntitlement` from `@lobechat/types`.
- Produces:
  - `type ModuleAppAdminFormInput`
  - `type ModuleAppAdminFormValues`
  - `createDefaultModuleAppFormValues(): ModuleAppAdminFormValues`
  - `normalizeModuleAppFormValues(input: ModuleAppAdminFormInput): ModuleAppAdminFormValues`
  - `buildModuleAppUpsertInput(values: ModuleAppAdminFormValues): ModuleAppAdminUpsertInput`
  - `parseModuleAppAdminForm(value: unknown): ModuleAppAdminUpsertInput`
  - `buildModuleAppPublishWarnings(app: { actions?: unknown[]; entitlements?: Array<{ runnable?: boolean; visible?: boolean }>; pages?: unknown[] }): string[]`

- [ ] **Step 1: Write failing tests for defaults, JSON parsing, invalid data, and publish warnings**

Replace `src/features/Admin/moduleApps/formSchema.test.ts` with these tests:

```typescript
import { describe, expect, it } from 'vitest';

import {
  buildModuleAppPublishWarnings,
  buildModuleAppUpsertInput,
  createDefaultModuleAppFormValues,
  normalizeModuleAppFormValues,
  parseModuleAppAdminForm,
} from './formSchema';

describe('module app admin form schema', () => {
  it('creates a safe default draft app form', () => {
    expect(createDefaultModuleAppFormValues()).toMatchObject({
      actions: [],
      appType: 'standard_app',
      billing: {
        chargeMode: 'free',
        defaultMultiplier: 1,
        externalApiCostCredits: 0,
        failureFixedFeePolicy: 'do_not_charge',
        fixedServiceFeeCredits: 0,
      },
      pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
      status: 'draft',
      tags: [],
    });
  });

  it('normalizes form strings, numbers, tags, pages, actions, entitlements, and billing', () => {
    const values = normalizeModuleAppFormValues({
      actions: [
        {
          id: 'Create Record',
          inputSchemaJson: '{ "fields": [] }',
          moduleMultiplier: '2',
          name: 'Create Record',
          outputSchemaJson: '{}',
          runtimeConfigJson: '{ "collectionKey": "records" }',
          runtimeType: 'record_create',
        },
      ],
      appType: 'standard_app',
      category: ' office ',
      description: ' Saved records app ',
      displayName: ' Workbench ',
      entitlements: [
        {
          discountPercent: '5',
          freeQuotaCredits: '100',
          installable: true,
          plan: 'pro',
          runnable: true,
          visible: true,
        },
      ],
      icon: '',
      pages: [
        {
          actionBindingsJson: '[{ "event": "submit", "actionKey": "create_record" }]',
          dataSourceJson: '{ "collectionKey": "records" }',
          key: 'Records',
          layoutSchemaJson: '{}',
          routePath: 'records',
          sortOrder: '3',
          title: ' Records ',
          type: 'list',
        },
      ],
      slug: ' Work Bench ',
      tags: 'office, records, office',
    });

    expect(values).toMatchObject({
      category: 'office',
      displayName: 'Workbench',
      icon: 'Blocks',
      slug: 'work-bench',
      tags: ['office', 'records'],
    });
    expect(values.pages[0]).toMatchObject({
      dataSource: { collectionKey: 'records' },
      key: 'records',
      routePath: '/records',
      sortOrder: 3,
    });
    expect(values.actions[0]).toMatchObject({
      id: 'create_record',
      moduleMultiplier: 2,
      runtimeConfig: { collectionKey: 'records' },
    });
    expect(values.entitlements[0]).toMatchObject({
      discountPercent: 5,
      freeQuotaCredits: 100,
      plan: 'pro',
      runnable: true,
    });
  });

  it('builds a module app upsert payload accepted by the shared type schema', () => {
    const input = buildModuleAppUpsertInput(
      normalizeModuleAppFormValues({
        appType: 'standard_app',
        category: 'office',
        description: 'Simple workbench app.',
        displayName: 'Workbench',
        icon: 'Blocks',
        slug: 'workbench',
      }),
    );

    expect(input).toMatchObject({
      appType: 'standard_app',
      category: 'office',
      displayName: 'Workbench',
      pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
      slug: 'workbench',
      status: 'draft',
    });
  });

  it('keeps parseModuleAppAdminForm compatible with existing minimum payloads', () => {
    expect(
      parseModuleAppAdminForm({
        appType: 'standard_app',
        category: 'Productivity',
        description: 'A saved records app',
        displayName: 'Record Desk',
        icon: 'Notebook',
        slug: 'record-desk',
      }),
    ).toMatchObject({
      appType: 'standard_app',
      slug: 'record-desk',
      status: 'draft',
    });
  });

  it('rejects invalid JSON fields before building the upsert payload', () => {
    expect(() =>
      normalizeModuleAppFormValues({
        appType: 'standard_app',
        category: 'office',
        description: 'Simple workbench app.',
        displayName: 'Workbench',
        pages: [{ dataSourceJson: '{', key: 'records', routePath: '/records', title: 'Records', type: 'list' }],
        slug: 'workbench',
      }),
    ).toThrow('Invalid JSON in pages[0].dataSourceJson');
  });

  it('builds publish warnings for incomplete app manifests', () => {
    expect(buildModuleAppPublishWarnings({ actions: [], entitlements: [], pages: [] })).toEqual([
      'No pages configured',
      'No runnable actions configured',
      'No visible plan entitlement configured',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run from `E:\code\comhub\ci-verify-3bbf64f`:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\formSchema.test.ts
```

Expected: FAIL because the new helper exports do not exist.

- [ ] **Step 3: Implement helpers and types**

Create `src/features/Admin/moduleApps/types.ts`:

```typescript
import type {
  ModuleAppActionConfig,
  ModuleAppAdminUpsertInput,
  ModuleAppBillingConfig,
  ModuleAppPage,
  ModuleAppPlanEntitlement,
  ModuleAppStatus,
  ModuleAppType,
} from '@lobechat/types';

export type AdminModuleAppItem = {
  appType: ModuleAppType;
  billing?: ModuleAppBillingConfig;
  category: string;
  description?: string;
  displayName: string;
  icon: string;
  id: string;
  slug: string;
  status: ModuleAppStatus;
  tags?: string[];
  updatedAt?: Date | string;
};

export type AdminModuleAppDetail = AdminModuleAppItem & {
  actions: ModuleAppActionConfig[];
  entitlements: ModuleAppPlanEntitlement[];
  pages: ModuleAppPage[];
  version?: string;
};

export type AdminModuleAppUpsertResult = Pick<ModuleAppAdminUpsertInput, 'slug'> & {
  id: string;
};

export type AdminPlanOption = {
  displayName?: string;
  plan: string;
};
```

Replace `src/features/Admin/moduleApps/formSchema.ts` with a pure helper module that exports the interfaces listed above. The implementation must:

- trim text with `String(value ?? '').trim()`.
- normalize slug to lowercase kebab-case.
- normalize page/action ids to lowercase snake-case.
- parse JSON strings with error messages in the exact shape `Invalid JSON in ${fieldName}`.
- default `icon` to `Blocks`.
- default pages to one overview page.
- default billing to free mode.
- call `moduleAppAdminUpsertSchema.parse` inside `buildModuleAppUpsertInput` and `parseModuleAppAdminForm`.

Use these constants:

```typescript
const DEFAULT_BILLING = {
  chargeMode: 'free',
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge',
  fixedServiceFeeCredits: 0,
} as const;

const DEFAULT_PAGE = {
  actionBindings: [],
  dataSource: {},
  key: 'overview',
  layoutSchema: {},
  routePath: '/',
  sortOrder: 0,
  title: 'Overview',
  type: 'overview',
} as const;
```

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\formSchema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/Admin/moduleApps/formSchema.ts src/features/Admin/moduleApps/formSchema.test.ts src/features/Admin/moduleApps/types.ts
git commit -m "feat: add module app admin form helpers" -m "Tested: bunx vitest run --silent='passed-only' src\\features\\Admin\\moduleApps\\formSchema.test.ts"
```

## Task 2: Section Editors

**Files:**
- Modify: `src/features/Admin/moduleApps/PageEditor.tsx`
- Modify: `src/features/Admin/moduleApps/ActionEditor.tsx`
- Modify: `src/features/Admin/moduleApps/EntitlementEditor.tsx`
- Modify: `src/features/Admin/moduleApps/BillingEditor.tsx`

**Interfaces:**
- Consumes: antd `Form` context field names:
  - `pages`
  - `actions`
  - `entitlements`
  - `billing`
- Produces visual sections that can be composed by `AppEditorModal`.

- [ ] **Step 1: Write failing render tests**

Create `src/features/Admin/moduleApps/editors.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it } from 'vitest';

import ActionEditor from './ActionEditor';
import BillingEditor from './BillingEditor';
import EntitlementEditor from './EntitlementEditor';
import PageEditor from './PageEditor';

const renderWithForm = (node: React.ReactNode, initialValues = {}) =>
  render(
    <Form initialValues={initialValues}>
      {node}
    </Form>,
  );

describe('module app admin section editors', () => {
  it('renders page editor controls', () => {
    renderWithForm(<PageEditor />, { pages: [] });

    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add page/i })).toBeInTheDocument();
  });

  it('renders action editor controls', () => {
    renderWithForm(<ActionEditor />, { actions: [] });

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add action/i })).toBeInTheDocument();
  });

  it('renders entitlement editor controls', () => {
    renderWithForm(<EntitlementEditor />, { entitlements: [] });

    expect(screen.getByText('Plan entitlements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add entitlement/i })).toBeInTheDocument();
  });

  it('renders billing editor controls', () => {
    renderWithForm(<BillingEditor />, {
      billing: { chargeMode: 'free', defaultMultiplier: 1 },
    });

    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByLabelText('Charge mode')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\editors.test.tsx
```

Expected: FAIL because current editors render only empty test nodes.

- [ ] **Step 3: Implement editor components**

Implement the editors with antd `Form.List`, `Input`, `InputNumber`, `Select`, `Switch`, `Button`, and `Typography`.

Required labels and field names:

- `PageEditor`
  - title text: `Pages`
  - button text: `Add page`
  - fields under `pages`: `key`, `title`, `type`, `routePath`, `sortOrder`, `dataSourceJson`, `layoutSchemaJson`, `actionBindingsJson`
  - page type options: `overview`, `form`, `list`, `detail`, `result`, `artifact`, `custom`
- `ActionEditor`
  - title text: `Actions`
  - button text: `Add action`
  - fields under `actions`: `id`, `name`, `runtimeType`, `moduleMultiplier`, `inputSchemaJson`, `outputSchemaJson`, `runtimeConfigJson`
  - runtime type options: `none`, `record_create`, `record_update`, `record_archive`, `api_action`, `server_action`, `content_generation`, `workflow_step`
- `EntitlementEditor`
  - title text: `Plan entitlements`
  - button text: `Add entitlement`
  - fields under `entitlements`: `plan`, `visible`, `installable`, `runnable`, `freeQuotaCredits`, `discountPercent`
- `BillingEditor`
  - title text: `Billing`
  - fields under `billing`: `chargeMode`, `defaultMultiplier`, `fixedServiceFeeCredits`, `externalApiCostCredits`, `failureFixedFeePolicy`
  - include static help text: `P2-A stores billing configuration only; real credit ledger posting is not enabled in this editor.`

Keep component exports as default memoized components.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\editors.test.tsx src\features\Admin\moduleApps\formSchema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/Admin/moduleApps/PageEditor.tsx src/features/Admin/moduleApps/ActionEditor.tsx src/features/Admin/moduleApps/EntitlementEditor.tsx src/features/Admin/moduleApps/BillingEditor.tsx src/features/Admin/moduleApps/editors.test.tsx
git commit -m "feat: add module app admin section editors" -m "Tested: bunx vitest run --silent='passed-only' src\\features\\Admin\\moduleApps\\editors.test.tsx src\\features\\Admin\\moduleApps\\formSchema.test.ts"
```

## Task 3: App Editor Modal

**Files:**
- Modify: `src/features/Admin/moduleApps/AppEditorModal.tsx`
- Modify: `src/features/Admin/moduleApps/formSchema.ts`
- Modify: `src/features/Admin/moduleApps/formSchema.test.ts`

**Interfaces:**
- Consumes:
  - `AdminModuleAppDetail`
  - `normalizeModuleAppFormValues`
  - `buildModuleAppUpsertInput`
  - section editors from Task 2
- Produces:
  - `AppEditorModal` props:
    ```typescript
    type AppEditorModalProps = {
      initialApp?: AdminModuleAppDetail | null;
      onCancel: () => void;
      onSubmit: (input: ModuleAppAdminUpsertInput) => Promise<void>;
      open: boolean;
      submitting?: boolean;
    };
    ```

- [ ] **Step 1: Add failing tests for detail-to-form conversion**

Append to `formSchema.test.ts`:

```typescript
it('converts an existing app detail into editable form values', () => {
  const values = normalizeModuleAppFormValues({
    actions: [
      {
        id: 'create_record',
        inputSchema: { fields: [] },
        moduleMultiplier: 1,
        name: 'Create record',
        outputSchema: {},
        runtimeConfig: { collectionKey: 'records' },
        runtimeType: 'record_create',
      },
    ],
    appType: 'standard_app',
    billing: { chargeMode: 'free', defaultMultiplier: 1 },
    category: 'office',
    description: 'Simple workbench app.',
    displayName: 'Workbench',
    icon: 'Blocks',
    id: '00000000-0000-4000-8000-000000000001',
    pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
    slug: 'workbench',
    status: 'draft',
    tags: ['office'],
  });

  expect(values.id).toBe('00000000-0000-4000-8000-000000000001');
  expect(values.actions[0].runtimeConfigJson).toContain('collectionKey');
  expect(values.pages[0].dataSourceJson).toBe('');
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\formSchema.test.ts
```

Expected: FAIL if helper does not yet convert object fields into JSON text fields.

- [ ] **Step 3: Implement conversion support and modal**

Update `normalizeModuleAppFormValues` so object-shaped `pages`, `actions`, and `billing` from `AdminModuleAppDetail` convert into editable values:

- object fields remain available as parsed objects.
- matching `*Json` fields are generated with `JSON.stringify(value, null, 2)` unless the object or array is empty.

Replace `AppEditorModal.tsx` with a modal that:

- uses `Form.useForm<ModuleAppAdminFormInput>()`.
- sets initial values when `open` changes.
- renders metadata fields: displayName, slug, category, icon, appType, status, tags, description.
- renders `PageEditor`, `ActionEditor`, `EntitlementEditor`, and `BillingEditor`.
- on OK calls:
  ```typescript
  const values = await form.validateFields();
  const normalized = normalizeModuleAppFormValues(values);
  await onSubmit(buildModuleAppUpsertInput(normalized));
  ```
- catches non-field errors and displays `message.error(error instanceof Error ? error.message : 'Module app form validation failed')`.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\formSchema.test.ts src\features\Admin\moduleApps\editors.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/Admin/moduleApps/AppEditorModal.tsx src/features/Admin/moduleApps/formSchema.ts src/features/Admin/moduleApps/formSchema.test.ts
git commit -m "feat: add module app editor modal" -m "Tested: bunx vitest run --silent='passed-only' src\\features\\Admin\\moduleApps\\formSchema.test.ts src\\features\\Admin\\moduleApps\\editors.test.tsx"
```

## Task 4: Admin List And Detail Page Shell

**Files:**
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Modify: `src/services/adminCommercial.test.ts`

**Interfaces:**
- Consumes:
  - `adminCommercialService.moduleApps.list`
  - `get`
  - `upsert`
  - `publish`
  - `unpublish`
  - `listRecords`
  - `listRuns`
  - `listArtifacts`
  - `listInstalls`
  - `listAuditEvents`
- Produces:
  - `/admin/module-apps` page with list, selected detail, editor modal, and tabs.

- [ ] **Step 1: Expand service wrapper tests**

Append to `src/services/adminCommercial.test.ts`:

```typescript
it('calls the module app admin detail endpoint', async () => {
  (lambdaClient.admin.moduleApps as any).get = { query: vi.fn().mockResolvedValue({ id: 'app1' }) };

  await expect(adminCommercialService.moduleApps.get({ appId: 'app1' })).resolves.toEqual({
    id: 'app1',
  });

  expect((lambdaClient.admin.moduleApps as any).get.query).toHaveBeenCalledWith({ appId: 'app1' });
});

it('calls the module app admin publish endpoint', async () => {
  (lambdaClient.admin.moduleApps as any).publish = { mutate: vi.fn().mockResolvedValue({ ok: true }) };

  await expect(adminCommercialService.moduleApps.publish({ appId: 'app1' })).resolves.toEqual({
    ok: true,
  });

  expect((lambdaClient.admin.moduleApps as any).publish.mutate).toHaveBeenCalledWith({
    appId: 'app1',
  });
});

it('calls the module app admin upsert endpoint', async () => {
  (lambdaClient.admin.moduleApps as any).upsert = {
    mutate: vi.fn().mockResolvedValue({ id: 'app1', slug: 'workbench' }),
  };

  const input = {
    actions: [],
    appType: 'standard_app',
    billing: {},
    category: 'office',
    description: 'Simple workbench app.',
    displayName: 'Workbench',
    icon: 'Blocks',
    pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
    slug: 'workbench',
    status: 'draft',
    tags: [],
  };

  await expect(adminCommercialService.moduleApps.upsert(input)).resolves.toEqual({
    id: 'app1',
    slug: 'workbench',
  });

  expect((lambdaClient.admin.moduleApps as any).upsert.mutate).toHaveBeenCalledWith(input);
});
```

- [ ] **Step 2: Run tests to verify red or existing coverage gap**

Run:

```powershell
bunx vitest run --silent='passed-only' src\services\adminCommercial.test.ts
```

Expected: PASS if wrappers already exist and mocks are sufficient, or FAIL if the test mock needs the full `moduleApps` shape. If it fails because the mock is incomplete, update the mock only with the missing `moduleApps` methods and rerun until the test verifies the intended calls.

- [ ] **Step 3: Implement `AdminModuleAppsPage`**

Replace `src/features/Admin/moduleApps/index.tsx` with a client component that follows this structure:

- imports `useClientDataSWR` and `mutate` from `@/libs/swr`.
- keeps state:
  ```typescript
  const [statusFilter, setStatusFilter] = useState<'all' | ModuleAppStatus>('all');
  const [selectedAppId, setSelectedAppId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AdminModuleAppDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  ```
- list key: `['admin-module-apps', statusFilter]`
- detail key: `selectedAppId ? ['admin-module-app-detail', selectedAppId] : null`
- operation keys:
  - `['admin-module-app-records', selectedAppId]`
  - `['admin-module-app-runs', selectedAppId]`
  - `['admin-module-app-artifacts', selectedAppId]`
  - `['admin-module-app-installs', selectedAppId]`
  - `['admin-module-app-audit-events', selectedAppId]`
- auto-select the first app after list load when no app is selected.
- implement `refreshAppData(appId = selectedAppId)` that mutates list and all selected detail keys.
- implement `handleSaveApp(input)` through `adminCommercialService.moduleApps.upsert`.
- implement `handlePublish(app)` and `handleUnpublish(app)` with `buildModuleAppPublishWarnings`.
- render:
  - toolbar with title `Module apps`, status filter, refresh, edit, create.
  - info alert explaining Module Apps are separate from Platform Plugins, MCP, and Skills.
  - list table with columns: App, Slug, Type, Category, Status, Tags, Updated, Actions.
  - tabs: Overview, Pages, Actions, Entitlements, Billing, Installs, Records, Runs, Artifacts, Audit.
  - `AppEditorModal`.

Use English admin labels for new Module App UI in this phase. Do not add locale keys unless the implementation explicitly chooses to localize.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
bunx vitest run --silent='passed-only' src\services\adminCommercial.test.ts src\features\Admin\moduleApps\formSchema.test.ts src\features\Admin\moduleApps\editors.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/Admin/moduleApps/index.tsx src/services/adminCommercial.test.ts
git commit -m "feat: add module app admin page shell" -m "Tested: bunx vitest run --silent='passed-only' src\\services\\adminCommercial.test.ts src\\features\\Admin\\moduleApps\\formSchema.test.ts src\\features\\Admin\\moduleApps\\editors.test.tsx"
```

## Task 5: Operational Tables

**Files:**
- Create: `src/features/Admin/moduleApps/InstallsTable.tsx`
- Create: `src/features/Admin/moduleApps/AuditEventsTable.tsx`
- Modify: `src/features/Admin/moduleApps/RecordsTable.tsx`
- Modify: `src/features/Admin/moduleApps/RunsTable.tsx`
- Modify: `src/features/Admin/moduleApps/ArtifactsTable.tsx`
- Modify: `src/features/Admin/moduleApps/index.tsx`

**Interfaces:**
- Consumes list responses from existing admin router methods.
- Produces read-only operational tabs for selected app.

- [ ] **Step 1: Write failing table render tests**

Create `src/features/Admin/moduleApps/tables.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArtifactsTable from './ArtifactsTable';
import AuditEventsTable from './AuditEventsTable';
import InstallsTable from './InstallsTable';
import RecordsTable from './RecordsTable';
import RunsTable from './RunsTable';

describe('module app admin operational tables', () => {
  it('renders installs', () => {
    render(<InstallsTable items={[{ id: 'install-1', scopeType: 'personal', status: 'installed', userId: 'user-1' }]} />);

    expect(screen.getByText('install-1')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('renders audit events', () => {
    render(<AuditEventsTable items={[{ actorUserId: 'admin-1', eventType: 'module_app.upserted', id: 'audit-1' }]} />);

    expect(screen.getByText('module_app.upserted')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });

  it('renders record rows', () => {
    render(<RecordsTable items={[{ collectionKey: 'records', id: 'record-1', scopeType: 'personal', status: 'active' }]} />);

    expect(screen.getByText('record-1')).toBeInTheDocument();
  });

  it('renders run rows', () => {
    render(<RunsTable items={[{ id: 'run-1', status: 'succeeded' }]} />);

    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
  });

  it('renders artifact rows', () => {
    render(<ArtifactsTable items={[{ fileName: 'result.md', id: 'artifact-1', mimeType: 'text/markdown' }]} />);

    expect(screen.getByText('result.md')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\tables.test.tsx
```

Expected: FAIL because `InstallsTable` and `AuditEventsTable` do not exist and existing artifact prop names differ.

- [ ] **Step 3: Implement operational tables**

Implement tables as small memoized components with these prop shapes:

```typescript
type TableProps<T> = {
  items?: T[];
  loading?: boolean;
};
```

Use antd `Table`, `Empty`, and `Spin` or a simple HTML table consistently. Existing table tests should pass by visible text.

Required row fields:

- Installs: `id`, `scopeType`, `status`, `userId`, `workspaceId`, `installedAt`
- Audit events: `id`, `eventType`, `actorUserId`, `createdAt`
- Records: `id`, `title`, `collectionKey`, `scopeType`, `status`, `updatedAt`
- Runs: `id`, `actionId`, `status`, `errorType`, `durationMs`, `createdAt`
- Artifacts: `id`, `artifactType`, `mimeType`, `fileName`, `sizeBytes`, `storageUrl`

Update `index.tsx` to render these tables in the matching tabs.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\tables.test.tsx src\features\Admin\moduleApps\editors.test.tsx src\features\Admin\moduleApps\formSchema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/Admin/moduleApps/InstallsTable.tsx src/features/Admin/moduleApps/AuditEventsTable.tsx src/features/Admin/moduleApps/RecordsTable.tsx src/features/Admin/moduleApps/RunsTable.tsx src/features/Admin/moduleApps/ArtifactsTable.tsx src/features/Admin/moduleApps/index.tsx src/features/Admin/moduleApps/tables.test.tsx
git commit -m "feat: add module app admin operation tables" -m "Tested: bunx vitest run --silent='passed-only' src\\features\\Admin\\moduleApps\\tables.test.tsx src\\features\\Admin\\moduleApps\\editors.test.tsx src\\features\\Admin\\moduleApps\\formSchema.test.ts"
```

## Task 6: Documentation And Final Verification

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes the completed P2-A implementation.
- Produces governance documentation for future maintenance.

- [ ] **Step 1: Update feature registry**

In `docs/FEATURE_REGISTRY.md`, update the `Module App Platform` entry note to include:

```markdown
P2-A adds a usable admin editor at `/admin/module-apps` for listing apps, creating/editing metadata, pages, actions, entitlements, billing config, publish state, and read-only installs/records/runs/artifacts/audit inspection. It remains experimental and still does not import MCP/Skills, execute arbitrary frontend code, use iframes/remote modules, or post real credit ledger transactions.
```

- [ ] **Step 2: Update internal changelog**

Append to `docs/CHANGELOG_INTERNAL.md`:

```markdown
## 2026-07-09

- Module App Platform P2-A: added the admin editor foundation for `/admin/module-apps`, including metadata authoring, page/action/entitlement/billing editors, publish controls, and operational inspection tabs. The feature remains isolated from Platform Plugin Marketplace, MCP, and Skills.
```

- [ ] **Step 3: Run full targeted verification**

Run from `E:\code\comhub\ci-verify-3bbf64f`:

```powershell
bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\formSchema.test.ts src\features\Admin\moduleApps\editors.test.tsx src\features\Admin\moduleApps\tables.test.tsx src\services\adminCommercial.test.ts
```

Run from `E:\code\comhub\ci-verify-3bbf64f\packages\business-server`:

```powershell
bunx vitest run --silent='passed-only' src\lambda-routers\admin\moduleApps.test.ts
```

Run from `E:\code\comhub\ci-verify-3bbf64f`:

```powershell
bun run type-check
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit docs and final state**

```powershell
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "docs: update module app admin editor registry" -m "Tested: bunx vitest run --silent='passed-only' src\\features\\Admin\\moduleApps\\formSchema.test.ts src\\features\\Admin\\moduleApps\\editors.test.tsx src\\features\\Admin\\moduleApps\\tables.test.tsx src\\services\\adminCommercial.test.ts; packages/business-server bunx vitest run --silent='passed-only' src\\lambda-routers\\admin\\moduleApps.test.ts; bun run type-check; git diff --check"
```

## Self-Review Checklist

- Spec coverage: covered list, create/edit metadata, pages, actions, entitlements, billing, publish/unpublish, records, runs, artifacts, installs, audit, docs, and verification.
- Scope boundary: no Platform Plugin changes except reading its pattern; no MCP/Skills import; no iframe/remote module; no real ledger posting.
- Type consistency: helper names, prop names, and route/service names match the current P2-A design.
- Reversibility: every task commits a small slice that can be reverted independently.
- Test-first execution: every production code task starts with a failing test command before implementation.

## Execution Mode

The normal writing-plans handoff offers subagent-driven execution or inline execution. The user has already directed this project phase to avoid subagents, so execute this plan inline with review checkpoints after each task.
