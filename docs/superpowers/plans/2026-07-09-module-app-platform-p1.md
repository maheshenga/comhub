# Module App Platform P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate Module App Platform that supports ordinary apps, AI/API apps, simple workflow apps, persistent personal/team records, plan access, action runs, artifacts, and billing without changing existing Platform Plugin, MCP, or Skills behavior.

**Architecture:** Add a new `moduleApp` domain with its own type contracts, Drizzle tables, database model, permission service, lambda routers, client services, route shells, admin shell, and runtime services. Reuse existing patterns from `platformPlugin` only as implementation references; do not reuse `platform_plugin_*` tables, routes, or runtime names. Deliver in small slices so every task can be tested and reverted independently.

**Tech Stack:** Next.js 16, React 19, TypeScript, React Router SPA routes, tRPC lambda routers, Drizzle ORM, PostgreSQL, SWR client services, Vitest, `bun`/`bunx`.

## Global Constraints

- P1 is a new `Module App` domain; existing `platform_plugin_*`, `/plugins`, `/admin/platform-plugins`, MCP, and Skills remain intact.
- No arbitrary external JavaScript execution in P1.
- No iframe or remote module sandbox in P1.
- No dynamic physical database table creation per app.
- Ordinary app pages and record CRUD must work without AI provider configuration and without credit charges.
- Personal records are visible/editable only by the owner.
- Workspace records are visible/createable/editable by workspace members; archive requires creator, workspace admin, or system admin.
- Hard delete is not exposed to normal users in P1.
- Billable workspace actions must fail clearly when workspace billing is unavailable.
- All new SPA routes must be registered in both `src/spa/router/desktopRouter.config.tsx` and `src/spa/router/desktopRouter.config.desktop.tsx`.
- Use `@lobehub/ui/base-ui` first for new UI primitives when available, then `@lobehub/ui`, then antd.
- Keep route files under `src/routes/` thin; feature logic belongs under `src/features/ModuleAppMarket`, `src/features/ModuleAppRuntime`, and `src/features/Admin/moduleApps`.
- Use targeted Vitest commands; do not run full `bun run test`.
- For docs under `docs/superpowers/`, use `git add -f` because the directory is ignored.

---

## File Structure Map

### Type Contracts

- `packages/types/src/moduleApp.ts`: Zod schemas and exported TS types for app metadata, page/action manifests, scope, billing, entitlements, records, runs, artifacts, admin inputs, and user router inputs.
- `packages/types/src/moduleApp.test.ts`: schema parsing tests and non-goal guardrails.
- `packages/types/src/index.ts`: export `./moduleApp`.

### Database

- `packages/database/src/schemas/moduleApp.ts`: Drizzle tables for `module_apps`, `module_app_versions`, `module_app_pages`, `module_app_actions`, `module_app_entitlements`, `module_app_installations`, `module_app_records`, `module_app_record_events`, `module_app_runs`, `module_app_artifacts`, `module_app_audit_logs`.
- `packages/database/src/schemas/index.ts`: export `./moduleApp`.
- `packages/database/migrations/0131_add_module_apps.sql`: SQL migration matching the Drizzle schema.
- `packages/database/src/models/moduleApp.ts`: marketplace, detail, installation, manifest, records, runs, artifacts, and admin persistence.
- `packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`: model tests for published listings, plan filters, installs, personal/workspace records, archive filtering, and run/artifact listing.

### Server Domain

- `packages/business-server/src/module-apps/permission.ts`: pure permission resolver for personal/workspace/admin access.
- `packages/business-server/src/module-apps/permission.test.ts`: permission matrix tests.
- `packages/business-server/src/module-apps/audit.ts`: write admin/config/record/run audit events.
- `packages/business-server/src/module-apps/safeUrl.ts`: public http(s) API URL validation for module app API actions.
- `packages/business-server/src/module-apps/runModuleAppAction.ts`: runtime dispatcher for record, API, AI, and ordered workflow actions.
- `packages/business-server/src/module-apps/runModuleAppAction.test.ts`: free CRUD, denied workspace billing, fixed/API/AI billing snapshots, and run persistence tests.

### Routers

- `apps/server/src/routers/lambda/moduleApp.ts`: user tRPC router.
- `apps/server/src/routers/lambda/moduleApp.test.ts`: user router tests.
- `apps/server/src/routers/lambda/index.ts`: register `moduleApp`.
- `packages/business-server/src/lambda-routers/admin/moduleApps.ts`: admin tRPC router.
- `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`: admin router tests.
- `packages/business-server/src/lambda-routers/admin/index.ts`: register `moduleApps`.

### Client Services

- `src/services/moduleApp.ts`: typed client service wrapper for user `lambda.moduleApp`.
- `src/services/moduleApp.test.ts`: client wrapper tests.
- `src/services/adminCommercial.ts`: add `moduleApps` admin wrapper methods only; keep existing exports stable.
- `src/services/adminCommercial.test.ts`: admin wrapper coverage.

### User UI

- `src/features/ModuleAppMarket/index.tsx`: marketplace and installed app views.
- `src/features/ModuleAppMarket/AppCard.tsx`: app card.
- `src/features/ModuleAppMarket/AppDetail.tsx`: detail and install panel.
- `src/features/ModuleAppMarket/helpers.ts`: filtering, scope labels, manifest helpers.
- `src/features/ModuleAppMarket/helpers.test.ts`: helper tests.
- `src/features/ModuleAppRuntime/index.tsx`: runtime shell.
- `src/features/ModuleAppRuntime/ScopeSwitch.tsx`: personal/workspace scope selector.
- `src/features/ModuleAppRuntime/PageRenderer.tsx`: page-type renderer.
- `src/features/ModuleAppRuntime/RecordForm.tsx`: schema-driven record form.
- `src/features/ModuleAppRuntime/RecordList.tsx`: record list.
- `src/features/ModuleAppRuntime/RunResultPanel.tsx`: run result and artifacts.
- `src/features/ModuleAppRuntime/runtimeHelpers.ts`: manifest navigation and action binding helpers.
- `src/features/ModuleAppRuntime/runtimeHelpers.test.ts`: runtime helper tests.
- `src/routes/(main)/apps/index.tsx`: thin marketplace route.
- `src/routes/(main)/apps/my/index.tsx`: thin personal installed apps route.
- `src/routes/(main)/apps/team/index.tsx`: thin workspace apps route.
- `src/routes/(main)/apps/[appId]/index.tsx`: thin app detail route.
- `src/routes/(main)/apps/[appId]/app/index.tsx`: thin runtime overview route.
- `src/routes/(main)/apps/[appId]/app/[pageKey]/index.tsx`: thin runtime page route.
- `src/spa/router/desktopRouter.config.tsx`: async route registration.
- `src/spa/router/desktopRouter.config.desktop.tsx`: sync Electron route registration.
- `src/spa/router/desktopRouter.sync.test.tsx`: must remain passing.

### Admin UI

- `src/features/Admin/moduleApps/index.tsx`: admin module apps page shell.
- `src/features/Admin/moduleApps/AppEditorModal.tsx`: metadata editor.
- `src/features/Admin/moduleApps/PageEditor.tsx`: page manifest editor.
- `src/features/Admin/moduleApps/ActionEditor.tsx`: action editor.
- `src/features/Admin/moduleApps/EntitlementEditor.tsx`: plan entitlement editor.
- `src/features/Admin/moduleApps/BillingEditor.tsx`: billing editor.
- `src/features/Admin/moduleApps/RecordsTable.tsx`: admin record view.
- `src/features/Admin/moduleApps/RunsTable.tsx`: admin run view.
- `src/features/Admin/moduleApps/ArtifactsTable.tsx`: admin artifact view.
- `src/features/Admin/moduleApps/formSchema.ts`: local form parsing.
- `src/features/Admin/moduleApps/formSchema.test.ts`: form tests.
- `src/routes/(main)/admin/module-apps/index.tsx`: thin admin route.
- `src/features/Admin/adminNavigation.ts`: add Module Apps entry.
- `src/features/Admin/adminNavigation.test.ts`: navigation test.

### Documentation

- `docs/FEATURE_REGISTRY.md`: update Module App status to `experimental` after routes exist.
- `docs/CHANGELOG_INTERNAL.md`: record each completed slice.

---

## Task 1: Module App Type Contracts

**Files:**
- Create: `packages/types/src/moduleApp.ts`
- Create: `packages/types/src/moduleApp.test.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Consumes: `zod`
- Produces:
  - `moduleAppStatusSchema`, `ModuleAppStatus`
  - `moduleAppTypeSchema`, `ModuleAppType`
  - `moduleAppRuntimeTypeSchema`, `ModuleAppRuntimeType`
  - `moduleAppScopeTypeSchema`, `ModuleAppScopeType`
  - `moduleAppPageSchema`, `ModuleAppPage`
  - `moduleAppActionConfigSchema`, `ModuleAppActionConfig`
  - `moduleAppBillingConfigSchema`, `ModuleAppBillingConfig`
  - `moduleAppPlanEntitlementSchema`, `ModuleAppPlanEntitlement`
  - `moduleAppAdminUpsertSchema`, `ModuleAppAdminUpsertInput`
  - `moduleAppMarketplaceListInputSchema`, `ModuleAppMarketplaceListInput`
  - `moduleAppRecordInputSchema`, `ModuleAppRecordInput`
  - `moduleAppRunInputSchema`, `ModuleAppRunInput`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/types/src/moduleApp.test.ts
import { describe, expect, it } from 'vitest';

import {
  moduleAppActionConfigSchema,
  moduleAppAdminUpsertSchema,
  moduleAppBillingConfigSchema,
  moduleAppMarketplaceListInputSchema,
  moduleAppPageSchema,
  moduleAppRecordInputSchema,
  moduleAppRuntimeTypeSchema,
} from './moduleApp';

describe('module app type contracts', () => {
  it('accepts standard app pages and record actions', () => {
    expect(
      moduleAppPageSchema.parse({
        key: 'records',
        routePath: '/records',
        title: 'Records',
        type: 'list',
      }),
    ).toMatchObject({ key: 'records', type: 'list' });

    expect(
      moduleAppActionConfigSchema.parse({
        id: 'create_record',
        inputSchema: { fields: [{ key: 'title', label: 'Title', required: true, type: 'text' }] },
        name: 'Create record',
        runtimeType: 'record_create',
      }),
    ).toMatchObject({ id: 'create_record', runtimeType: 'record_create' });
  });

  it('keeps unsafe P1 runtimes out of the runtime enum', () => {
    expect(() => moduleAppRuntimeTypeSchema.parse('external_js')).toThrow();
    expect(() => moduleAppRuntimeTypeSchema.parse('iframe')).toThrow();
    expect(() => moduleAppRuntimeTypeSchema.parse('mcp')).toThrow();
    expect(() => moduleAppRuntimeTypeSchema.parse('skill')).toThrow();
  });

  it('defaults billing to free CRUD semantics', () => {
    expect(moduleAppBillingConfigSchema.parse({})).toEqual({
      chargeMode: 'free',
      defaultMultiplier: 1,
      externalApiCostCredits: 0,
      failureFixedFeePolicy: 'do_not_charge',
      fixedServiceFeeCredits: 0,
    });
  });

  it('parses admin app definitions with multiple pages and actions', () => {
    const input = moduleAppAdminUpsertSchema.parse({
      appType: 'standard_app',
      billing: {},
      category: 'Productivity',
      description: 'Simple saved records app',
      displayName: 'Record Desk',
      icon: 'Notebook',
      pages: [
        { key: 'overview', routePath: '/', title: 'Overview', type: 'overview' },
        { key: 'records', routePath: '/records', title: 'Records', type: 'list' },
      ],
      actions: [
        {
          id: 'create_record',
          inputSchema: { fields: [] },
          name: 'Create',
          runtimeType: 'record_create',
        },
      ],
      slug: 'record-desk',
      status: 'draft',
      tags: ['records'],
    });

    expect(input.pages).toHaveLength(2);
    expect(input.actions).toHaveLength(1);
  });

  it('normalizes optional list and record inputs', () => {
    expect(moduleAppMarketplaceListInputSchema.parse({ query: '  desk  ' })).toEqual({
      query: 'desk',
    });

    expect(
      moduleAppRecordInputSchema.parse({
        appId: '00000000-0000-4000-8000-000000000001',
        collectionKey: 'records',
        data: { title: 'A' },
        scopeType: 'personal',
      }),
    ).toMatchObject({ collectionKey: 'records', scopeType: 'personal' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleApp.test.ts`

Expected: FAIL with `Failed to resolve import "./moduleApp"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/types/src/moduleApp.ts
import { z } from 'zod';

const optionalTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text ? text : undefined;
  }, z.string().max(max).optional());

const stripUndefinedValues = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

export const moduleAppStatusSchema = z.enum(['draft', 'published', 'unpublished']);
export type ModuleAppStatus = z.infer<typeof moduleAppStatusSchema>;

export const moduleAppTypeSchema = z.enum([
  'standard_app',
  'api_app',
  'ai_app',
  'workflow_app',
  'hybrid_app',
]);
export type ModuleAppType = z.infer<typeof moduleAppTypeSchema>;

export const moduleAppRuntimeTypeSchema = z.enum([
  'none',
  'record_create',
  'record_update',
  'record_archive',
  'api_action',
  'server_action',
  'content_generation',
  'workflow_step',
]);
export type ModuleAppRuntimeType = z.infer<typeof moduleAppRuntimeTypeSchema>;

export const moduleAppScopeTypeSchema = z.enum(['personal', 'workspace']);
export type ModuleAppScopeType = z.infer<typeof moduleAppScopeTypeSchema>;

export const moduleAppPageTypeSchema = z.enum([
  'overview',
  'form',
  'list',
  'detail',
  'result',
  'artifact',
  'custom',
]);
export type ModuleAppPageType = z.infer<typeof moduleAppPageTypeSchema>;

export const moduleAppInputFieldSchema = z.object({
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  helpText: z.string().max(500).optional(),
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  label: z.string().min(1).max(80),
  required: z.boolean().default(false),
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'select', 'date']),
  validationPattern: z.string().max(300).optional(),
});

export const moduleAppInputSchema = z.object({
  fields: z.array(moduleAppInputFieldSchema).max(80).default([]),
});
export type ModuleAppInputSchema = z.infer<typeof moduleAppInputSchema>;

export const moduleAppPageSchema = z.object({
  actionBindings: z.array(z.object({ actionKey: z.string(), event: z.string() })).default([]),
  dataSource: z.record(z.string(), z.unknown()).default({}),
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  layoutSchema: z.record(z.string(), z.unknown()).default({}),
  routePath: z.string().min(1).max(160),
  sortOrder: z.coerce.number().int().default(0),
  title: z.string().min(1).max(120),
  type: moduleAppPageTypeSchema,
});
export type ModuleAppPage = z.infer<typeof moduleAppPageSchema>;

export const moduleAppFailureFixedFeePolicySchema = z.enum(['do_not_charge']);
export const moduleAppChargeModeSchema = z.enum(['free', 'fixed', 'ai_usage', 'external_api', 'hybrid']);

export const moduleAppBillingConfigSchema = z
  .object({
    chargeMode: moduleAppChargeModeSchema.default('free'),
    defaultMultiplier: z.coerce.number().finite().min(0).default(1),
    externalApiCostCredits: z.coerce.number().finite().min(0).default(0),
    failureFixedFeePolicy: moduleAppFailureFixedFeePolicySchema.default('do_not_charge'),
    fixedServiceFeeCredits: z.coerce.number().finite().min(0).default(0),
  })
  .default({});
export type ModuleAppBillingConfig = z.infer<typeof moduleAppBillingConfigSchema>;

export const moduleAppActionConfigSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  inputSchema: moduleAppInputSchema.default({ fields: [] }),
  moduleMultiplier: z.coerce.number().finite().min(0).default(1),
  name: z.string().min(1).max(120),
  outputSchema: z.record(z.string(), z.unknown()).default({}),
  runtimeConfig: z.record(z.string(), z.unknown()).default({}),
  runtimeType: moduleAppRuntimeTypeSchema,
});
export type ModuleAppActionConfig = z.infer<typeof moduleAppActionConfigSchema>;

export const moduleAppPlanEntitlementSchema = z.object({
  discountPercent: z.coerce.number().finite().min(0).max(100).default(0),
  freeQuotaCredits: z.coerce.number().finite().min(0).default(0),
  installable: z.boolean().default(false),
  plan: z.string().min(1).max(80),
  runnable: z.boolean().default(false),
  visible: z.boolean().default(false),
});
export type ModuleAppPlanEntitlement = z.infer<typeof moduleAppPlanEntitlementSchema>;

export const moduleAppAdminUpsertSchema = z.object({
  actions: z.array(moduleAppActionConfigSchema).max(80).default([]),
  appType: moduleAppTypeSchema,
  billing: moduleAppBillingConfigSchema,
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(4000),
  displayName: z.string().min(1).max(120),
  icon: z.string().min(1).max(240),
  id: z.string().uuid().optional(),
  pages: z.array(moduleAppPageSchema).max(80).default([]),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: moduleAppStatusSchema.default('draft'),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});
export type ModuleAppAdminUpsertInput = z.infer<typeof moduleAppAdminUpsertSchema>;

export const moduleAppMarketplaceListInputSchema = z
  .object({
    appType: moduleAppTypeSchema.optional(),
    category: optionalTrimmedString(80),
    query: optionalTrimmedString(120),
  })
  .optional()
  .default({})
  .transform((value) => stripUndefinedValues(value));
export type ModuleAppMarketplaceListInput = z.infer<typeof moduleAppMarketplaceListInputSchema>;

export const moduleAppRecordInputSchema = z.object({
  appId: z.string().uuid(),
  collectionKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  data: z.record(z.string(), z.unknown()).default({}),
  recordId: z.string().uuid().optional(),
  scopeType: moduleAppScopeTypeSchema,
  title: z.string().max(240).optional(),
  workspaceId: z.string().optional(),
});
export type ModuleAppRecordInput = z.infer<typeof moduleAppRecordInputSchema>;

export const moduleAppRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'denied']);
export type ModuleAppRunStatus = z.infer<typeof moduleAppRunStatusSchema>;

export const moduleAppRunInputSchema = z.object({
  actionId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  appId: z.string().uuid(),
  input: z.record(z.string(), z.unknown()).default({}),
  recordId: z.string().uuid().optional(),
  scopeType: moduleAppScopeTypeSchema,
  workspaceId: z.string().optional(),
});
export type ModuleAppRunInput = z.infer<typeof moduleAppRunInputSchema>;
```

Append this line to `packages/types/src/index.ts`:

```typescript
export * from './moduleApp';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleApp.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/moduleApp.ts packages/types/src/moduleApp.test.ts packages/types/src/index.ts
git commit -m "feat: add module app type contracts"
```

## Task 2: Database Schema And Migration

**Files:**
- Create: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/migrations/0131_add_module_apps.sql`
- Modify: `packages/database/src/schemas/index.ts`

**Interfaces:**
- Consumes: types from `@lobechat/types`, `users`, `workspaces`, Drizzle helpers.
- Produces: exported Drizzle tables and row types used by `ModuleAppModel`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/database/src/schemas/moduleApp.schema.test.ts
import { describe, expect, it } from 'vitest';

import {
  moduleAppActions,
  moduleAppArtifacts,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppPages,
  moduleAppRecordEvents,
  moduleAppRecords,
  moduleAppRuns,
  moduleApps,
  moduleAppVersions,
} from './moduleApp';

describe('module app schema exports', () => {
  it('exports all P1 tables', () => {
    expect(moduleApps).toBeDefined();
    expect(moduleAppVersions).toBeDefined();
    expect(moduleAppPages).toBeDefined();
    expect(moduleAppActions).toBeDefined();
    expect(moduleAppEntitlements).toBeDefined();
    expect(moduleAppInstallations).toBeDefined();
    expect(moduleAppRecords).toBeDefined();
    expect(moduleAppRecordEvents).toBeDefined();
    expect(moduleAppRuns).toBeDefined();
    expect(moduleAppArtifacts).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: FAIL with `Failed to resolve import "./moduleApp"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/database/src/schemas/moduleApp.ts` with the same naming style as `platformPlugin.ts`. Use `jsonb` for schemas and snapshots, `text` for enum-like fields, and indexes for scope-filtered record reads.

```typescript
import type {
  ModuleAppActionConfig,
  ModuleAppBillingConfig,
  ModuleAppInputSchema,
  ModuleAppPage,
  ModuleAppRunStatus,
  ModuleAppScopeType,
  ModuleAppStatus,
  ModuleAppType,
} from '@lobechat/types';
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';
import { users } from './user';
import { workspaces } from './workspace';

const DEFAULT_MODULE_APP_BILLING: ModuleAppBillingConfig = {
  chargeMode: 'free',
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge',
  fixedServiceFeeCredits: 0,
};

export const moduleApps = pgTable(
  'module_apps',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    icon: text('icon').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    appType: text('app_type').$type<ModuleAppType>().notNull(),
    status: text('status').$type<ModuleAppStatus>().default('draft').notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    billing: jsonb('billing').$type<ModuleAppBillingConfig>().default(DEFAULT_MODULE_APP_BILLING).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('module_apps_status_category_sort_idx').on(table.status, table.category, table.sortOrder)],
);

export type NewModuleApp = typeof moduleApps.$inferInsert;
export type ModuleAppItem = typeof moduleApps.$inferSelect;

export const moduleAppVersions = pgTable('module_app_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
  version: text('version').notNull(),
  manifestSnapshot: jsonb('manifest_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
  changelog: text('changelog').default('').notNull(),
  publishedAt: timestamptz('published_at'),
  rollbackSourceVersionId: uuid('rollback_source_version_id'),
  createdAt: createdAt(),
});

export const moduleAppPages = pgTable(
  'module_app_pages',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    versionId: uuid('version_id').references(() => moduleAppVersions.id, { onDelete: 'cascade' }).notNull(),
    pageKey: text('page_key').notNull(),
    title: text('title').notNull(),
    pageType: text('page_type').notNull(),
    routePath: text('route_path').notNull(),
    layoutSchema: jsonb('layout_schema').$type<ModuleAppPage['layoutSchema']>().default({}).notNull(),
    dataSource: jsonb('data_source').$type<ModuleAppPage['dataSource']>().default({}).notNull(),
    actionBindings: jsonb('action_bindings').$type<ModuleAppPage['actionBindings']>().default([]).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('module_app_pages_app_version_sort_idx').on(table.appId, table.versionId, table.sortOrder)],
);

export const moduleAppActions = pgTable(
  'module_app_actions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    versionId: uuid('version_id').references(() => moduleAppVersions.id, { onDelete: 'cascade' }).notNull(),
    actionKey: text('action_key').notNull(),
    runtimeType: text('runtime_type').$type<ModuleAppActionConfig['runtimeType']>().notNull(),
    name: text('name').notNull(),
    inputSchema: jsonb('input_schema').$type<ModuleAppInputSchema>().default({ fields: [] }).notNull(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>().default({}).notNull(),
    moduleMultiplier: integer('module_multiplier').default(1).notNull(),
    runtimeConfig: jsonb('runtime_config').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('module_app_actions_app_version_action_idx').on(table.appId, table.versionId, table.actionKey)],
);

export const moduleAppEntitlements = pgTable(
  'module_app_entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    plan: text('plan').notNull(),
    visible: boolean('visible').default(false).notNull(),
    installable: boolean('installable').default(false).notNull(),
    runnable: boolean('runnable').default(false).notNull(),
    freeQuotaCredits: integer('free_quota_credits').default(0).notNull(),
    discountPercent: integer('discount_percent').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('module_app_entitlements_app_plan_unique').on(table.appId, table.plan)],
);

export const moduleAppInstallations = pgTable(
  'module_app_installations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    versionId: uuid('version_id').references(() => moduleAppVersions.id, { onDelete: 'cascade' }).notNull(),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    status: text('status').default('installed').notNull(),
    installedAt: timestamptz('installed_at').defaultNow().notNull(),
    uninstalledAt: timestamptz('uninstalled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('module_app_install_personal_unique').on(table.appId, table.scopeType, table.userId),
    uniqueIndex('module_app_install_workspace_unique').on(table.appId, table.scopeType, table.workspaceId),
  ],
);

export const moduleAppRecords = pgTable(
  'module_app_records',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    collectionKey: text('collection_key').notNull(),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    recordKey: text('record_key'),
    title: text('title'),
    status: text('status').default('active').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_app_records_personal_idx').on(table.appId, table.scopeType, table.ownerUserId, table.collectionKey, table.updatedAt),
    index('module_app_records_workspace_idx').on(table.appId, table.scopeType, table.workspaceId, table.collectionKey, table.updatedAt),
    index('module_app_records_record_key_idx').on(table.appId, table.collectionKey, table.recordKey),
  ],
);

export const moduleAppRecordEvents = pgTable('module_app_record_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
  recordId: uuid('record_id').references(() => moduleAppRecords.id, { onDelete: 'cascade' }).notNull(),
  eventType: text('event_type').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  beforeSnapshot: jsonb('before_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
  afterSnapshot: jsonb('after_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt(),
});

export const moduleAppRuns = pgTable(
  'module_app_runs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    versionId: uuid('version_id').references(() => moduleAppVersions.id, { onDelete: 'set null' }),
    actionId: uuid('action_id').references(() => moduleAppActions.id, { onDelete: 'set null' }),
    recordId: uuid('record_id').references(() => moduleAppRecords.id, { onDelete: 'set null' }),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    status: text('status').$type<ModuleAppRunStatus>().default('queued').notNull(),
    inputSnapshot: jsonb('input_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    outputSnapshot: jsonb('output_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    billingSnapshot: jsonb('billing_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    errorType: text('error_type'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_app_runs_user_created_idx').on(table.userId, table.createdAt),
    index('module_app_runs_workspace_created_idx').on(table.workspaceId, table.createdAt),
    index('module_app_runs_app_created_idx').on(table.appId, table.createdAt),
  ],
);

export const moduleAppArtifacts = pgTable(
  'module_app_artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, { onDelete: 'cascade' }).notNull(),
    runId: uuid('run_id').references(() => moduleAppRuns.id, { onDelete: 'cascade' }).notNull(),
    recordId: uuid('record_id').references(() => moduleAppRecords.id, { onDelete: 'set null' }),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    expiresAt: timestamptz('expires_at'),
    downloadCount: integer('download_count').default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('module_app_artifacts_run_id_idx').on(table.runId)],
);

export const moduleAppAuditLogs = pgTable(
  'module_app_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    eventType: text('event_type').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('module_app_audit_resource_created_idx').on(table.resourceType, table.resourceId, table.createdAt)],
);
```

Append this line to `packages/database/src/schemas/index.ts`:

```typescript
export * from './moduleApp';
```

Create `packages/database/migrations/0131_add_module_apps.sql` with table names and columns matching the Drizzle schema. Use `jsonb default '{}'::jsonb` for object snapshots and `jsonb default '[]'::jsonb` for arrays.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schemas/moduleApp.ts packages/database/src/schemas/moduleApp.schema.test.ts packages/database/src/schemas/index.ts packages/database/migrations/0131_add_module_apps.sql
git commit -m "feat: add module app database schema"
```

## Task 3: Permission Service

**Files:**
- Create: `packages/business-server/src/module-apps/permission.ts`
- Create: `packages/business-server/src/module-apps/permission.test.ts`

**Interfaces:**
- Consumes: `ModuleAppScopeType`
- Produces:
  - `resolveModuleAppRecordPermission(input): ModuleAppPermissionDecision`
  - `assertModuleAppRecordPermission(input, operation): void`
  - permission reasons: `personal_not_owner`, `workspace_required`, `workspace_not_member`, `archive_denied`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/business-server/src/module-apps/permission.test.ts
import { describe, expect, it } from 'vitest';

import { resolveModuleAppRecordPermission } from './permission';

describe('resolveModuleAppRecordPermission', () => {
  it('allows personal owner operations', () => {
    const decision = resolveModuleAppRecordPermission({
      actorUserId: 'u1',
      createdBy: 'u1',
      operation: 'update',
      ownerUserId: 'u1',
      scopeType: 'personal',
      workspaceMembership: null,
    });

    expect(decision.allowed).toBe(true);
  });

  it('denies personal records for other users', () => {
    const decision = resolveModuleAppRecordPermission({
      actorUserId: 'u2',
      createdBy: 'u1',
      operation: 'view',
      ownerUserId: 'u1',
      scopeType: 'personal',
      workspaceMembership: null,
    });

    expect(decision).toEqual({ allowed: false, reason: 'personal_not_owner' });
  });

  it('allows workspace members to view and edit workspace records', () => {
    const decision = resolveModuleAppRecordPermission({
      actorUserId: 'u2',
      createdBy: 'u1',
      operation: 'update',
      ownerUserId: 'u1',
      scopeType: 'workspace',
      workspaceId: 'w1',
      workspaceMembership: { role: 'member', workspaceId: 'w1' },
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows workspace archive only by creator, workspace admin, or system admin', () => {
    expect(
      resolveModuleAppRecordPermission({
        actorUserId: 'u2',
        createdBy: 'u1',
        operation: 'archive',
        ownerUserId: 'u1',
        scopeType: 'workspace',
        workspaceId: 'w1',
        workspaceMembership: { role: 'member', workspaceId: 'w1' },
      }),
    ).toEqual({ allowed: false, reason: 'archive_denied' });

    expect(
      resolveModuleAppRecordPermission({
        actorUserId: 'u2',
        createdBy: 'u1',
        operation: 'archive',
        ownerUserId: 'u1',
        scopeType: 'workspace',
        workspaceId: 'w1',
        workspaceMembership: { role: 'admin', workspaceId: 'w1' },
      }).allowed,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/permission.test.ts`

Expected: FAIL with `Failed to resolve import "./permission"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/business-server/src/module-apps/permission.ts
import type { ModuleAppScopeType } from '@lobechat/types';

export type ModuleAppRecordOperation = 'archive' | 'create' | 'update' | 'view';
export type ModuleAppPermissionReason =
  | 'archive_denied'
  | 'personal_not_owner'
  | 'workspace_not_member'
  | 'workspace_required';

export type ModuleAppPermissionDecision =
  | { allowed: true; reason?: never }
  | { allowed: false; reason: ModuleAppPermissionReason };

export type ModuleAppWorkspaceMembership = {
  role: 'admin' | 'member' | 'owner';
  workspaceId: string;
} | null;

export function resolveModuleAppRecordPermission(input: {
  actorIsSystemAdmin?: boolean;
  actorUserId: string;
  createdBy?: null | string;
  operation: ModuleAppRecordOperation;
  ownerUserId?: null | string;
  scopeType: ModuleAppScopeType;
  workspaceId?: null | string;
  workspaceMembership: ModuleAppWorkspaceMembership;
}): ModuleAppPermissionDecision {
  if (input.actorIsSystemAdmin) return { allowed: true };

  if (input.scopeType === 'personal') {
    return input.ownerUserId === input.actorUserId
      ? { allowed: true }
      : { allowed: false, reason: 'personal_not_owner' };
  }

  if (!input.workspaceId) return { allowed: false, reason: 'workspace_required' };
  if (!input.workspaceMembership || input.workspaceMembership.workspaceId !== input.workspaceId) {
    return { allowed: false, reason: 'workspace_not_member' };
  }

  if (input.operation !== 'archive') return { allowed: true };

  const isCreator = input.createdBy === input.actorUserId;
  const isWorkspaceAdmin =
    input.workspaceMembership.role === 'admin' || input.workspaceMembership.role === 'owner';

  return isCreator || isWorkspaceAdmin ? { allowed: true } : { allowed: false, reason: 'archive_denied' };
}

export function assertModuleAppRecordPermission(
  input: Parameters<typeof resolveModuleAppRecordPermission>[0],
): void {
  const decision = resolveModuleAppRecordPermission(input);
  if (!decision.allowed) throw new Error(decision.reason);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/permission.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/business-server/src/module-apps/permission.ts packages/business-server/src/module-apps/permission.test.ts
git commit -m "feat: add module app permission rules"
```

## Task 4: Database Model For Marketplace, Installs, Records, Runs

**Files:**
- Create: `packages/database/src/models/moduleApp.ts`
- Create: `packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`

**Interfaces:**
- Consumes: tables from Task 2 and type schemas from Task 1.
- Produces:
  - `ModuleAppModel.listMarketplaceApps({ plan, userId, filters })`
  - `ModuleAppModel.getAppDetail({ appIdOrSlug, plan, userId })`
  - `ModuleAppModel.installApp({ appId, versionId, scopeType, userId, workspaceId })`
  - `ModuleAppModel.listRecords(...)`
  - `ModuleAppModel.createRecord(...)`
  - `ModuleAppModel.updateRecord(...)`
  - `ModuleAppModel.archiveRecord(...)`
  - `ModuleAppModel.createRun(...)`
  - `ModuleAppModel.updateRun(...)`
  - `ModuleAppModel.listRuns(...)`
  - `ModuleAppModel.listArtifacts(...)`
  - `ModuleAppModel.upsertAppForAdmin(...)`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/database/src/models/__tests__/moduleApp.marketplace.test.ts
import { describe, expect, it } from 'vitest';

import { ModuleAppModel } from '../moduleApp';

describe('ModuleAppModel contract', () => {
  it('exposes P1 model methods', () => {
    const model = new ModuleAppModel({} as never);

    expect(model.listMarketplaceApps).toBeTypeOf('function');
    expect(model.getAppDetail).toBeTypeOf('function');
    expect(model.installApp).toBeTypeOf('function');
    expect(model.createRecord).toBeTypeOf('function');
    expect(model.updateRecord).toBeTypeOf('function');
    expect(model.archiveRecord).toBeTypeOf('function');
    expect(model.createRun).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`

Expected: FAIL with `Failed to resolve import "../moduleApp"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/database/src/models/moduleApp.ts
import type {
  ModuleAppAdminUpsertInput,
  ModuleAppMarketplaceListInput,
  ModuleAppRecordInput,
  ModuleAppRunInput,
  ModuleAppScopeType,
} from '@lobechat/types';

import type { LobeChatDatabase } from '../type';

export class ModuleAppModel {
  constructor(private readonly db: LobeChatDatabase) {}

  listMarketplaceApps = async (_params: {
    filters?: ModuleAppMarketplaceListInput;
    plan: string;
    userId: string;
  }) => {
    return [];
  };

  getAppDetail = async (_params: { appIdOrSlug: string; plan: string; userId: string }) => {
    return null;
  };

  installApp = async (_params: {
    appId: string;
    scopeType: ModuleAppScopeType;
    userId: string;
    versionId: string;
    workspaceId?: string;
  }) => {
    return;
  };

  listRecords = async (_params: {
    appId: string;
    collectionKey: string;
    scopeType: ModuleAppScopeType;
    userId: string;
    workspaceId?: string;
  }) => {
    return [];
  };

  createRecord = async (_params: ModuleAppRecordInput & { userId: string }) => {
    return { id: '' };
  };

  updateRecord = async (_params: ModuleAppRecordInput & { userId: string }) => {
    return { id: _params.recordId ?? '' };
  };

  archiveRecord = async (_params: { appId: string; recordId: string; userId: string }) => {
    return { ok: true as const };
  };

  createRun = async (_params: ModuleAppRunInput & { userId: string }) => {
    return { id: '' };
  };

  updateRun = async (_params: { output?: Record<string, unknown>; runId: string; status: string }) => {
    return { ok: true as const };
  };

  listRuns = async (_params: { appId: string; userId: string }) => {
    return { items: [], nextCursor: null };
  };

  listArtifacts = async (_params: { appId: string; userId: string }) => {
    return { items: [], nextCursor: null };
  };

  upsertAppForAdmin = async (_params: ModuleAppAdminUpsertInput) => {
    return { id: _params.id ?? '', slug: _params.slug };
  };
}
```

After this contract skeleton passes, replace method bodies in the same task with real Drizzle queries:

```typescript
// Real implementation direction inside ModuleAppModel:
// - Query only `module_app_*` tables.
// - `listMarketplaceApps` joins `moduleApps`, `moduleAppEntitlements`, and active installations.
// - `getAppDetail` loads latest version, pages, actions, entitlements, and active install state.
// - `installApp` upserts personal/workspace installation according to `scopeType`.
// - `listRecords` always includes scope filters and excludes `status = 'archived'`.
// - `createRecord`, `updateRecord`, and `archiveRecord` write `moduleAppRecordEvents`.
// - Run/artifact list methods filter by personal user or workspace id.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`

Expected: PASS. Add model behavior tests for real Drizzle queries before moving to Task 5.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/models/moduleApp.ts packages/database/src/models/__tests__/moduleApp.marketplace.test.ts
git commit -m "feat: add module app database model"
```

## Task 5: User Module App Router

**Files:**
- Create: `apps/server/src/routers/lambda/moduleApp.ts`
- Create: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `apps/server/src/routers/lambda/index.ts`

**Interfaces:**
- Consumes: `ModuleAppModel`, `resolveModuleAppRecordPermission`, subscription plan lookup.
- Produces `lambda.moduleApp` routes:
  - `listMarketplace`
  - `getDetail`
  - `installPersonal`
  - `uninstallPersonal`
  - `listMyApps`
  - `listTeamApps`
  - `getRuntimeManifest`
  - `listRecords`
  - `getRecord`
  - `createRecord`
  - `updateRecord`
  - `archiveRecord`
  - `runAction`
  - `listRuns`
  - `listArtifacts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/routers/lambda/moduleApp.test.ts
import { describe, expect, it } from 'vitest';

import { lambdaRouter } from './index';

describe('moduleApp router registration', () => {
  it('registers the moduleApp router on lambda root', () => {
    expect(lambdaRouter._def.record.moduleApp).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/moduleApp.test.ts`

Expected: FAIL because `lambdaRouter._def.record.moduleApp` is undefined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/routers/lambda/moduleApp.ts
import {
  moduleAppMarketplaceListInputSchema,
  moduleAppRecordInputSchema,
  moduleAppRunInputSchema,
} from '@lobechat/types';
import { z } from 'zod';

import { getSubscriptionPlan } from '@/business/server/user';
import { ModuleAppModel } from '@/database/models/moduleApp';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const AppIdInputSchema = z.object({ appId: z.string().uuid() });
const AppIdOrSlugInputSchema = z.object({ appIdOrSlug: z.string().min(1).max(160) });
const RecordIdInputSchema = z.object({ appId: z.string().uuid(), recordId: z.string().uuid() });

const moduleAppProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const currentPlan = await getSubscriptionPlan(opts.ctx.serverDB, opts.ctx.userId);

  return opts.next({
    ctx: {
      currentPlan,
      moduleAppModel: new ModuleAppModel(opts.ctx.serverDB),
    },
  });
});

export const moduleAppRouter = router({
  archiveRecord: moduleAppProcedure.input(RecordIdInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.archiveRecord({ ...input, userId: ctx.userId });
  }),
  createRecord: moduleAppProcedure.input(moduleAppRecordInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.createRecord({ ...input, userId: ctx.userId });
  }),
  getDetail: moduleAppProcedure.input(AppIdOrSlugInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.getAppDetail({
      appIdOrSlug: input.appIdOrSlug,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });
  }),
  getRecord: moduleAppProcedure.input(RecordIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.getRecord({ ...input, userId: ctx.userId });
  }),
  getRuntimeManifest: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.getRuntimeManifest({ ...input, userId: ctx.userId });
  }),
  installPersonal: moduleAppProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.installPersonalApp({ ...input, userId: ctx.userId });
  }),
  listArtifacts: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listArtifacts({ ...input, userId: ctx.userId });
  }),
  listMarketplace: moduleAppProcedure.input(moduleAppMarketplaceListInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listMarketplaceApps({
      filters: input,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });
  }),
  listMyApps: moduleAppProcedure.query(async ({ ctx }) => {
    return ctx.moduleAppModel.listInstalledApps({ scopeType: 'personal', userId: ctx.userId });
  }),
  listRecords: moduleAppProcedure.input(moduleAppRecordInputSchema.pick({
    appId: true,
    collectionKey: true,
    scopeType: true,
    workspaceId: true,
  })).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listRecords({ ...input, userId: ctx.userId });
  }),
  listRuns: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listRuns({ ...input, userId: ctx.userId });
  }),
  listTeamApps: moduleAppProcedure.input(z.object({ workspaceId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listInstalledApps({ scopeType: 'workspace', userId: ctx.userId, workspaceId: input.workspaceId });
  }),
  runAction: moduleAppProcedure.input(moduleAppRunInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.createRun({ ...input, userId: ctx.userId });
  }),
  uninstallPersonal: moduleAppProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.uninstallPersonalApp({ ...input, userId: ctx.userId });
  }),
  updateRecord: moduleAppProcedure.input(moduleAppRecordInputSchema.required({ recordId: true })).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.updateRecord({ ...input, userId: ctx.userId });
  }),
});

export type ModuleAppRouter = typeof moduleAppRouter;
```

Register it in `apps/server/src/routers/lambda/index.ts`:

```typescript
import { moduleAppRouter } from './moduleApp';

export const lambdaRouter = router({
  moduleApp: moduleAppRouter,
});
```

When editing the real root object, add only `moduleApp: moduleAppRouter` and keep all existing entries.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/moduleApp.test.ts`

Expected: PASS. Add procedure-level tests for `createRecord` denied personal/workspace access once the model has real query behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts apps/server/src/routers/lambda/index.ts
git commit -m "feat: add module app user router"
```

## Task 6: Admin Module Apps Router

**Files:**
- Create: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Create: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/index.ts`
- Create: `packages/business-server/src/module-apps/audit.ts`

**Interfaces:**
- Consumes: `ModuleAppModel`, admin capability procedures.
- Produces `admin.moduleApps` routes: `list`, `get`, `upsert`, `publish`, `unpublish`, `upsertPages`, `upsertActions`, `upsertEntitlements`, `upsertBilling`, `listInstalls`, `listRecords`, `listRuns`, `listArtifacts`, `listAuditEvents`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/business-server/src/lambda-routers/admin/moduleApps.test.ts
import { describe, expect, it } from 'vitest';

import { adminRouter } from './index';

describe('admin module apps router', () => {
  it('registers admin.moduleApps', () => {
    expect(adminRouter._def.record.moduleApps).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`

Expected: FAIL because `adminRouter._def.record.moduleApps` is undefined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/business-server/src/module-apps/audit.ts
import { moduleAppAuditLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export const writeModuleAppAuditLog = async (params: {
  actorUserId?: null | string;
  db: LobeChatDatabase;
  eventType: string;
  metadata?: Record<string, unknown> | null;
  resourceId: string;
  resourceType: string;
}) => {
  await params.db.insert(moduleAppAuditLogs).values({
    actorUserId: params.actorUserId ?? null,
    eventType: params.eventType,
    metadata: params.metadata ?? {},
    resourceId: params.resourceId,
    resourceType: params.resourceType,
  });
};
```

```typescript
// packages/business-server/src/lambda-routers/admin/moduleApps.ts
import { moduleAppAdminUpsertSchema, moduleAppBillingConfigSchema, moduleAppPlanEntitlementSchema } from '@lobechat/types';
import { z } from 'zod';

import { ModuleAppModel } from '@/database/models/moduleApp';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';

import { writeModuleAppAuditLog } from '../../module-apps/audit';

const auditReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.auditRead);
const contentWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentWrite);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

const AppIdInputSchema = z.object({ appId: z.string().uuid() });

export const adminModuleAppsRouter = router({
  get: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).getAdminApp({ appId: input.appId });
  }),
  list: auditReadProcedure.query(async ({ ctx }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminApps();
  }),
  listArtifacts: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminArtifacts(input);
  }),
  listAuditEvents: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminAuditEvents(input);
  }),
  listInstalls: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminInstalls(input);
  }),
  listRecords: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminRecords(input);
  }),
  listRuns: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminRuns(input);
  }),
  publish: contentWriteProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    await new ModuleAppModel(ctx.serverDB).setStatus({ appId: input.appId, status: 'published' });
    await writeModuleAppAuditLog({ actorUserId: ctx.userId, db: ctx.serverDB, eventType: 'module_app.published', resourceId: input.appId, resourceType: 'moduleApp' });
    return { ok: true };
  }),
  unpublish: contentWriteProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    await new ModuleAppModel(ctx.serverDB).setStatus({ appId: input.appId, status: 'unpublished' });
    await writeModuleAppAuditLog({ actorUserId: ctx.userId, db: ctx.serverDB, eventType: 'module_app.unpublished', resourceId: input.appId, resourceType: 'moduleApp' });
    return { ok: true };
  }),
  upsert: contentWriteProcedure.input(moduleAppAdminUpsertSchema).mutation(async ({ ctx, input }) => {
    const result = await new ModuleAppModel(ctx.serverDB).upsertAppForAdmin(input);
    await writeModuleAppAuditLog({ actorUserId: ctx.userId, db: ctx.serverDB, eventType: 'module_app.upserted', metadata: { slug: input.slug, status: input.status }, resourceId: result.id, resourceType: 'moduleApp' });
    return result;
  }),
  upsertActions: contentWriteProcedure.input(z.object({ actions: moduleAppAdminUpsertSchema.shape.actions, appId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).upsertActionsForAdmin(input);
  }),
  upsertBilling: financeWriteProcedure.input(z.object({ appId: z.string().uuid(), billing: moduleAppBillingConfigSchema })).mutation(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).upsertBillingForAdmin(input);
  }),
  upsertEntitlements: financeWriteProcedure.input(z.object({ appId: z.string().uuid(), entitlements: z.array(moduleAppPlanEntitlementSchema).max(100) })).mutation(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).upsertEntitlementsForAdmin(input);
  }),
  upsertPages: contentWriteProcedure.input(z.object({ appId: z.string().uuid(), pages: moduleAppAdminUpsertSchema.shape.pages })).mutation(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).upsertPagesForAdmin(input);
  }),
});
```

Register it in `packages/business-server/src/lambda-routers/admin/index.ts`:

```typescript
import { adminModuleAppsRouter } from './moduleApps';

export const adminRouter = router({
  moduleApps: adminModuleAppsRouter,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`

Expected: PASS. Add mutation audit tests before this task is considered complete.

- [ ] **Step 5: Commit**

```bash
git add packages/business-server/src/module-apps/audit.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts packages/business-server/src/lambda-routers/admin/index.ts
git commit -m "feat: add admin module apps router"
```

## Task 7: Client Services

**Files:**
- Create: `src/services/moduleApp.ts`
- Create: `src/services/moduleApp.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`

**Interfaces:**
- Consumes: `lambdaClient.moduleApp` and `lambdaClient.admin.moduleApps`.
- Produces:
  - `createModuleAppService(client)`
  - `moduleAppService`
  - `adminCommercialService.moduleApps.*`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/moduleApp.test.ts
import { describe, expect, it, vi } from 'vitest';

import { createModuleAppService } from './moduleApp';

describe('createModuleAppService', () => {
  it('calls moduleApp listMarketplace query', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'app1' }]);
    const service = createModuleAppService({
      moduleApp: {
        listMarketplace: { query },
      },
    } as never);

    await expect(service.listMarketplace({ query: 'desk' })).resolves.toEqual([{ id: 'app1' }]);
    expect(query).toHaveBeenCalledWith({ query: 'desk' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' src/services/moduleApp.test.ts`

Expected: FAIL with `Failed to resolve import "./moduleApp"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/moduleApp.ts
import type {
  ModuleAppMarketplaceListInput,
  ModuleAppRecordInput,
  ModuleAppRunInput,
} from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';

type ModuleAppClient = {
  moduleApp: Record<string, { mutate?: (input: unknown) => Promise<unknown>; query?: (input?: unknown) => Promise<unknown> }>;
};

export const createModuleAppService = (client: ModuleAppClient) => ({
  archiveRecord: (input: { appId: string; recordId: string }) => client.moduleApp.archiveRecord.mutate!(input),
  createRecord: (input: ModuleAppRecordInput) => client.moduleApp.createRecord.mutate!(input),
  getDetail: (input: { appIdOrSlug: string }) => client.moduleApp.getDetail.query!(input),
  getRuntimeManifest: (input: { appId: string }) => client.moduleApp.getRuntimeManifest.query!(input),
  installPersonal: (input: { appId: string }) => client.moduleApp.installPersonal.mutate!(input),
  listArtifacts: (input: { appId: string }) => client.moduleApp.listArtifacts.query!(input),
  listMarketplace: (input?: ModuleAppMarketplaceListInput) => client.moduleApp.listMarketplace.query!(input),
  listMyApps: () => client.moduleApp.listMyApps.query!(),
  listRecords: (input: Pick<ModuleAppRecordInput, 'appId' | 'collectionKey' | 'scopeType' | 'workspaceId'>) => client.moduleApp.listRecords.query!(input),
  listRuns: (input: { appId: string }) => client.moduleApp.listRuns.query!(input),
  listTeamApps: (input: { workspaceId: string }) => client.moduleApp.listTeamApps.query!(input),
  runAction: (input: ModuleAppRunInput) => client.moduleApp.runAction.mutate!(input),
  uninstallPersonal: (input: { appId: string }) => client.moduleApp.uninstallPersonal.mutate!(input),
  updateRecord: (input: ModuleAppRecordInput & { recordId: string }) => client.moduleApp.updateRecord.mutate!(input),
});

export const moduleAppService = createModuleAppService(lambdaClient as unknown as ModuleAppClient);
```

Extend `src/services/adminCommercial.ts` with a `moduleApps` object that forwards to `lambdaClient.admin.moduleApps`. Keep existing service names unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' src/services/moduleApp.test.ts src/services/adminCommercial.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/moduleApp.ts src/services/moduleApp.test.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts
git commit -m "feat: add module app client services"
```

## Task 8: User Marketplace And Runtime Routes

**Files:**
- Create the user UI files listed in the User UI section.
- Modify both desktop router config files.
- Modify locale files only for keys used by the new routes.

**Interfaces:**
- Consumes: `moduleAppService`.
- Produces: `/apps`, `/apps/my`, `/apps/team`, `/apps/:appId`, `/apps/:appId/app`, `/apps/:appId/app/:pageKey`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/ModuleAppRuntime/runtimeHelpers.test.ts
import { describe, expect, it } from 'vitest';

import { getInitialModuleAppPageKey, resolveModuleAppPagePath } from './runtimeHelpers';

describe('module app runtime helpers', () => {
  const pages = [
    { key: 'overview', routePath: '/', title: 'Overview', type: 'overview' as const },
    { key: 'records', routePath: '/records', title: 'Records', type: 'list' as const },
  ];

  it('uses overview as the first runtime page', () => {
    expect(getInitialModuleAppPageKey(pages)).toBe('overview');
  });

  it('builds stable app page paths', () => {
    expect(resolveModuleAppPagePath('app-1', 'records')).toBe('/apps/app-1/app/records');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/runtimeHelpers.test.ts`

Expected: FAIL with `Failed to resolve import "./runtimeHelpers"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/ModuleAppRuntime/runtimeHelpers.ts
import type { ModuleAppPage } from '@lobechat/types';

export const getInitialModuleAppPageKey = (pages: ModuleAppPage[]) =>
  pages.find((page) => page.key === 'overview')?.key ?? pages[0]?.key ?? 'overview';

export const resolveModuleAppPagePath = (appId: string, pageKey: string) =>
  `/apps/${appId}/app/${pageKey}`;
```

```tsx
// src/routes/(main)/apps/index.tsx
import ModuleAppMarket from '@/features/ModuleAppMarket';

export default ModuleAppMarket;
```

```tsx
// src/features/ModuleAppMarket/index.tsx
import { memo } from 'react';

const ModuleAppMarket = memo(() => {
  return <div data-testid="module-app-market">Module Apps</div>;
});

export default ModuleAppMarket;
```

Register the route in both router configs. Async config:

```tsx
{
  children: [
    {
      element: dynamicElement(() => import('@/routes/(main)/apps'), 'Desktop > Apps'),
      handle: { meta: routeMeta({ icon: ShapesIcon, titleKey: 'navigation.apps' }) },
      index: true,
    },
    {
      element: dynamicElement(() => import('@/routes/(main)/apps/my'), 'Desktop > Apps > My'),
      path: 'my',
    },
    {
      element: dynamicElement(() => import('@/routes/(main)/apps/team'), 'Desktop > Apps > Team'),
      path: 'team',
    },
    {
      element: dynamicElement(() => import('@/routes/(main)/apps/[appId]'), 'Desktop > Apps > Detail'),
      path: ':appId',
    },
    {
      element: dynamicElement(() => import('@/routes/(main)/apps/[appId]/app'), 'Desktop > Apps > Runtime'),
      path: ':appId/app',
    },
    {
      element: dynamicElement(() => import('@/routes/(main)/apps/[appId]/app/[pageKey]'), 'Desktop > Apps > Runtime Page'),
      path: ':appId/app/:pageKey',
    },
  ],
  errorElement: <ErrorBoundary />,
  path: 'apps',
}
```

Sync desktop config must import the route components and mirror the same paths.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/runtimeHelpers.test.ts src/spa/router/desktopRouter.sync.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ModuleAppMarket src/features/ModuleAppRuntime src/routes/(main)/apps src/spa/router/desktopRouter.config.tsx src/spa/router/desktopRouter.config.desktop.tsx src/spa/router/desktopRouter.sync.test.tsx
git commit -m "feat: add module app user routes"
```

## Task 9: Admin Module Apps Page

**Files:**
- Create the admin UI files listed in the Admin UI section.
- Create: `src/routes/(main)/admin/module-apps/index.tsx`
- Modify: `src/features/Admin/adminNavigation.ts`
- Modify: `src/features/Admin/adminNavigation.test.ts`

**Interfaces:**
- Consumes: `adminCommercialService.moduleApps`.
- Produces: `/admin/module-apps` page shell with tabs for Overview, Pages, Actions, Data Collections, Permissions, Billing, Installs, Records, Runs, Artifacts, Audit.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/Admin/moduleApps/formSchema.test.ts
import { describe, expect, it } from 'vitest';

import { parseModuleAppAdminForm } from './formSchema';

describe('parseModuleAppAdminForm', () => {
  it('parses the minimum standard app editor form', () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/formSchema.test.ts`

Expected: FAIL with `Failed to resolve import "./formSchema"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/Admin/moduleApps/formSchema.ts
import { moduleAppAdminUpsertSchema } from '@lobechat/types';

export const parseModuleAppAdminForm = (value: unknown) =>
  moduleAppAdminUpsertSchema.parse({
    actions: [],
    billing: {},
    pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
    status: 'draft',
    tags: [],
    ...(value as Record<string, unknown>),
  });
```

```tsx
// src/routes/(main)/admin/module-apps/index.tsx
import AdminModuleAppsPage from '@/features/Admin/moduleApps';

export default AdminModuleAppsPage;
```

```tsx
// src/features/Admin/moduleApps/index.tsx
import { memo } from 'react';

const AdminModuleAppsPage = memo(() => {
  return <div data-testid="admin-module-apps">Module Apps</div>;
});

export default AdminModuleAppsPage;
```

Add navigation entry:

```typescript
{
  key: 'module-apps',
  path: '/admin/module-apps',
  title: '模块应用',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/formSchema.test.ts src/features/Admin/adminNavigation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/Admin/moduleApps src/routes/(main)/admin/module-apps/index.tsx src/features/Admin/adminNavigation.ts src/features/Admin/adminNavigation.test.ts
git commit -m "feat: add admin module apps page"
```

## Task 10: Record Action Runtime For Free Standard Apps

**Files:**
- Create: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Create: `packages/business-server/src/module-apps/runModuleAppAction.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`

**Interfaces:**
- Consumes: `ModuleAppModel`, `ModuleAppActionConfig`, permission service.
- Produces: `runModuleAppAction(params): Promise<ModuleAppRunResult>` for `record_create`, `record_update`, and `record_archive`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/business-server/src/module-apps/runModuleAppAction.test.ts
import { describe, expect, it, vi } from 'vitest';

import { runModuleAppAction } from './runModuleAppAction';

describe('runModuleAppAction record actions', () => {
  it('does not charge credits for record_create', async () => {
    const model = {
      createRecord: vi.fn().mockResolvedValue({ id: 'record-1' }),
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      updateRun: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await runModuleAppAction({
      action: { id: 'create_record', inputSchema: { fields: [] }, moduleMultiplier: 1, name: 'Create', outputSchema: {}, runtimeConfig: {}, runtimeType: 'record_create' },
      appId: '00000000-0000-4000-8000-000000000001',
      input: { title: 'A' },
      model: model as never,
      scopeType: 'personal',
      userId: 'u1',
    });

    expect(result.billing.chargedCredits).toBe(0);
    expect(model.createRecord).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/runModuleAppAction.test.ts`

Expected: FAIL with `Failed to resolve import "./runModuleAppAction"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/business-server/src/module-apps/runModuleAppAction.ts
import type { ModuleAppActionConfig, ModuleAppScopeType } from '@lobechat/types';

export type ModuleAppRuntimeModel = {
  archiveRecord: (input: { appId: string; recordId: string; userId: string }) => Promise<unknown>;
  createRecord: (input: { appId: string; collectionKey: string; data: Record<string, unknown>; scopeType: ModuleAppScopeType; title?: string; userId: string; workspaceId?: string }) => Promise<{ id: string }>;
  createRun: (input: Record<string, unknown>) => Promise<{ id: string }>;
  updateRecord: (input: Record<string, unknown>) => Promise<{ id: string }>;
  updateRun: (input: Record<string, unknown>) => Promise<unknown>;
};

export const runModuleAppAction = async (params: {
  action: ModuleAppActionConfig;
  appId: string;
  input: Record<string, unknown>;
  model: ModuleAppRuntimeModel;
  recordId?: string;
  scopeType: ModuleAppScopeType;
  userId: string;
  workspaceId?: string;
}) => {
  const run = await params.model.createRun({
    actionId: params.action.id,
    appId: params.appId,
    input: params.input,
    scopeType: params.scopeType,
    userId: params.userId,
    workspaceId: params.workspaceId,
  });

  if (params.action.runtimeType === 'record_create') {
    const record = await params.model.createRecord({
      appId: params.appId,
      collectionKey: String(params.input.collectionKey ?? 'records'),
      data: params.input,
      scopeType: params.scopeType,
      title: typeof params.input.title === 'string' ? params.input.title : undefined,
      userId: params.userId,
      workspaceId: params.workspaceId,
    });

    const output = { preview: String(params.input.title ?? record.id), recordId: record.id };
    await params.model.updateRun({ output, runId: run.id, status: 'succeeded' });

    return {
      artifactIds: [],
      billing: { chargedCredits: 0, fixedServiceFeeCharged: false },
      preview: output.preview,
      runId: run.id,
      status: 'succeeded' as const,
    };
  }

  throw new Error(`MODULE_APP_RUNTIME_NOT_IMPLEMENTED:${params.action.runtimeType}`);
};
```

Wire `moduleApp.runAction` to `runModuleAppAction` instead of directly calling `createRun`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/runModuleAppAction.test.ts apps/server/src/routers/lambda/moduleApp.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/business-server/src/module-apps/runModuleAppAction.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts apps/server/src/routers/lambda/moduleApp.ts
git commit -m "feat: add module app record runtime"
```

## Task 11: API And AI Action Runtime With Billing Snapshots

**Files:**
- Create: `packages/business-server/src/module-apps/safeUrl.ts`
- Create: `packages/business-server/src/module-apps/safeUrl.test.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.test.ts`

**Interfaces:**
- Consumes: existing model runtime initialization and commercial billing concepts.
- Produces API/AI runtime branches for `api_action`, `content_generation`, `workflow_step`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/business-server/src/module-apps/safeUrl.test.ts
import { describe, expect, it } from 'vitest';

import { isSafeModuleAppApiUrl } from './safeUrl';

describe('isSafeModuleAppApiUrl', () => {
  it('allows public https urls', () => {
    expect(isSafeModuleAppApiUrl('https://api.example.com/run')).toBe(true);
  });

  it('blocks localhost and private networks', () => {
    expect(isSafeModuleAppApiUrl('http://localhost:3000')).toBe(false);
    expect(isSafeModuleAppApiUrl('http://127.0.0.1:3000')).toBe(false);
    expect(isSafeModuleAppApiUrl('http://10.0.0.2/run')).toBe(false);
    expect(isSafeModuleAppApiUrl('ftp://api.example.com/run')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/safeUrl.test.ts`

Expected: FAIL with `Failed to resolve import "./safeUrl"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/business-server/src/module-apps/safeUrl.ts
const privateIpv4Patterns = [/^10\./, /^127\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^169\.254\./];

export function isSafeModuleAppApiUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (host === '0.0.0.0') return false;
    if (privateIpv4Patterns.some((pattern) => pattern.test(host))) return false;

    return true;
  } catch {
    return false;
  }
}
```

Extend `runModuleAppAction` with billable branch snapshots:

```typescript
const buildBillingSnapshot = (input: {
  actualAiCredits?: number;
  chargeMode: string;
  externalApiCostCredits?: number;
  fixedServiceFeeCredits?: number;
  multiplier?: number;
}) => {
  const fixed = input.fixedServiceFeeCredits ?? 0;
  const external = input.externalApiCostCredits ?? 0;
  const ai = (input.actualAiCredits ?? 0) * (input.multiplier ?? 1);
  return {
    actualAiCredits: input.actualAiCredits ?? 0,
    chargedCredits: fixed + external + ai,
    chargeMode: input.chargeMode,
    externalApiCostCredits: external,
    fixedServiceFeeCharged: fixed > 0,
    fixedServiceFeeCredits: fixed,
    multiplier: input.multiplier ?? 1,
  };
};
```

Use this helper for `api_action`, `content_generation`, and `workflow_step`; keep record actions at zero charge.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/safeUrl.test.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/business-server/src/module-apps/safeUrl.ts packages/business-server/src/module-apps/safeUrl.test.ts packages/business-server/src/module-apps/runModuleAppAction.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts
git commit -m "feat: add module app billable runtimes"
```

## Task 12: Run History, Artifacts, Audit Views, Registry Update

**Files:**
- Modify: `src/features/ModuleAppRuntime/RunResultPanel.tsx`
- Modify: `src/features/Admin/moduleApps/RunsTable.tsx`
- Modify: `src/features/Admin/moduleApps/ArtifactsTable.tsx`
- Modify: `src/features/Admin/moduleApps/RecordsTable.tsx`
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes: Task 5/6 list routes.
- Produces visible user/admin history panels and updated governance docs.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/ModuleAppRuntime/runtimeHelpers.test.ts
import { describe, expect, it } from 'vitest';

import { formatModuleAppRunPreview } from './runtimeHelpers';

describe('formatModuleAppRunPreview', () => {
  it('prefers explicit preview and falls back to status', () => {
    expect(formatModuleAppRunPreview({ preview: 'Created A', status: 'succeeded' })).toBe('Created A');
    expect(formatModuleAppRunPreview({ status: 'failed' })).toBe('Run failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/runtimeHelpers.test.ts`

Expected: FAIL because `formatModuleAppRunPreview` is not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/ModuleAppRuntime/runtimeHelpers.ts
export const formatModuleAppRunPreview = (run: { preview?: string; status: string }) => {
  if (run.preview?.trim()) return run.preview.trim();
  if (run.status === 'failed') return 'Run failed';
  if (run.status === 'denied') return 'Run denied';
  if (run.status === 'succeeded') return 'Run succeeded';
  return 'Run pending';
};
```

Update docs:

```markdown
<!-- docs/FEATURE_REGISTRY.md Module App Platform entry -->
| 功能状态 | `experimental` |
| 备注 | P1 routes, DB domain, record runtime, admin shell, user shell, run history, artifacts, and audit views are implemented as a separate Module App domain. Existing Platform Plugin, MCP, and Skills remain isolated. |
```

```markdown
<!-- docs/CHANGELOG_INTERNAL.md -->
## 2026-07-09

- Added Module App Platform P1 foundation: separate types, database tables, user/admin routers, client services, marketplace/runtime shells, record runtime, billable runtime snapshots, run history, artifacts, and audit views.
- Kept existing Platform Plugin Marketplace, MCP, and Skills isolated from Module App Platform.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/runtimeHelpers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ModuleAppRuntime/RunResultPanel.tsx src/features/Admin/moduleApps/RunsTable.tsx src/features/Admin/moduleApps/ArtifactsTable.tsx src/features/Admin/moduleApps/RecordsTable.tsx docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "feat: finish module app p1 history and docs"
```

---

## Execution Order

1. Task 1: Type contracts
2. Task 2: Database schema and migration
3. Task 3: Permission service
4. Task 4: Database model
5. Task 5: User router
6. Task 6: Admin router
7. Task 7: Client services
8. Task 8: User routes and runtime shell
9. Task 9: Admin page
10. Task 10: Free record runtime
11. Task 11: API/AI billing runtime
12. Task 12: History, artifacts, audit views, docs

## Verification Bundle

Run these targeted tests before the final P1 integration commit or PR:

```bash
bunx vitest run --silent='passed-only' packages/types/src/moduleApp.test.ts
bunx vitest run --silent='passed-only' packages/database/src/schemas/moduleApp.schema.test.ts packages/database/src/models/__tests__/moduleApp.marketplace.test.ts
bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/permission.test.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts packages/business-server/src/module-apps/safeUrl.test.ts
bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/moduleApp.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts
bunx vitest run --silent='passed-only' src/services/moduleApp.test.ts src/services/adminCommercial.test.ts
bunx vitest run --silent='passed-only' src/features/ModuleAppRuntime/runtimeHelpers.test.ts src/features/Admin/moduleApps/formSchema.test.ts src/features/Admin/adminNavigation.test.ts src/spa/router/desktopRouter.sync.test.tsx
```

Run type-check after Task 12:

```bash
bun run type-check
```

## Rollback Strategy

- Tasks 1-7 are backend/type/service foundation tasks and can be reverted one commit at a time before routes are exposed.
- Tasks 8-9 expose UI routes; rollback by reverting route registration commits first, then UI feature commits.
- Tasks 10-11 change action execution; rollback by reverting runtime commits while keeping CRUD/router foundation intact.
- Task 12 is presentation/docs only; rollback independently if history panels need more polish.
- The migration in Task 2 only creates new `module_app_*` tables. It does not mutate `platform_plugin_*` or existing commercial tables, so rollback can drop only the new tables in reverse dependency order when no production data needs preservation.

## Self-Review

- Spec coverage: The plan covers type contracts, separate DB domain, personal/workspace records, simple permissions, user/admin APIs, user/admin UI, free CRUD runtime, API/AI billing snapshots, run history, artifacts, audit, and docs. It explicitly preserves Platform Plugin, MCP, and Skills isolation.
- Placeholder scan: The plan avoids generic placeholders and names exact files, commands, and produced interfaces. Implementation comments identify concrete behavior required in the same task.
- Type consistency: The same names are used throughout: `ModuleAppModel`, `moduleAppRouter`, `adminModuleAppsRouter`, `moduleAppService`, `ModuleAppActionConfig`, `ModuleAppBillingConfig`, `ModuleAppScopeType`, `module_app_*` tables.
