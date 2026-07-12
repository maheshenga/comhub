# Module App Admin Editor P2-A Design

Date: 2026-07-09

## Summary

P1 created the independent Module App Platform foundation: types, database tables, user/admin routers, user route shells, a minimal admin route, action runtime foundations, and lightweight history tables. P2-A turns `/admin/module-apps` from a placeholder into a usable admin editor for creating and maintaining module apps.

This phase focuses on admin authoring and operational visibility. It does not add a visual workflow canvas, arbitrary frontend code execution, iframe apps, MCP/Skill import, or real payment ledger posting. It must keep the Module App domain separate from the existing Platform Plugin Marketplace.

## Current State

The backend and contracts already exist:

- Types and validation: `packages/types/src/moduleApp.ts`
- Database schema: `packages/database/src/schemas/moduleApp.ts`
- Database model: `packages/database/src/models/moduleApp.ts`
- Admin router: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Client service wrapper: `src/services/adminCommercial.ts`
- Admin route: `src/routes/(main)/admin/module-apps/index.tsx`
- Admin feature shell: `src/features/Admin/moduleApps`

The admin feature currently contains mostly placeholders:

- `index.tsx` renders only `Module Apps`.
- `AppEditorModal.tsx`, `PageEditor.tsx`, `ActionEditor.tsx`, `EntitlementEditor.tsx`, and `BillingEditor.tsx` render empty test nodes.
- `RecordsTable.tsx`, `RunsTable.tsx`, and `ArtifactsTable.tsx` are lightweight read-only tables.
- `formSchema.ts` normalizes a minimal upsert payload through `moduleAppAdminUpsertSchema`.

## Goals

- Let admins list module apps with status, type, category, and basic metrics-ready metadata.
- Let admins create and edit app metadata: slug, name, icon, category, description, app type, status, and tags.
- Let admins edit pages in a schema-driven table/editor.
- Let admins edit actions and runtime configuration in a schema-driven table/editor.
- Let admins edit plan entitlements: visible, installable, runnable, free quota, and discount per plan.
- Let admins edit billing config: charge mode, fixed service fee, external API cost, multiplier, and failure policy.
- Let admins publish and unpublish apps through existing router methods.
- Let admins inspect records, runs, artifacts, installs, and audit events for a selected app.
- Keep route files thin and keep feature logic under `src/features/Admin/moduleApps`.
- Preserve the current API contracts unless a failing test proves a contract gap.

## Non-Goals

- No dynamic database tables per app.
- No visual workflow graph editor.
- No external frontend JavaScript execution.
- No iframe or remote module sandbox.
- No MCP or Skills import into Module App.
- No changes to `/plugins` or `/admin/platform-plugins`.
- No real credit ledger posting for Module App billing in this phase.
- No large redesign of the entire admin information architecture.

## Approach Options

### Option A: Single-page admin editor

One admin page manages list, detail, editor modal, and operational panels. This is the recommended option for P2-A because the router and backend are already available, and it keeps the change small and reversible.

Trade-offs:

- Pros: fastest path to a working editor, smallest route impact, easiest rollback.
- Cons: the feature file can grow if not split into focused subcomponents.

### Option B: Multi-route admin editor

Add `/admin/module-apps/:appId` plus nested editor routes for pages, actions, entitlements, billing, and history.

Trade-offs:

- Pros: better long-term navigation for large app catalogs.
- Cons: more router sync work and more surface area before the editor is useful.

### Option C: JSON-only editor first

Expose a raw manifest JSON editor and validate with `moduleAppAdminUpsertSchema`.

Trade-offs:

- Pros: extremely small UI.
- Cons: poor admin experience, high chance of invalid authoring mistakes, and not aligned with the product goal.

Recommendation: implement Option A first, with focused subcomponents that can later be moved into Option B routes.

## Architecture

P2-A should keep a simple layered shape:

- `src/routes/(main)/admin/module-apps/index.tsx` remains a thin route that imports the feature page.
- `src/features/Admin/moduleApps/index.tsx` owns page-level data loading, selection state, filters, save/publish/unpublish actions, and panel composition.
- `AppEditorModal.tsx` owns create/edit modal layout and metadata form composition.
- `PageEditor.tsx`, `ActionEditor.tsx`, `EntitlementEditor.tsx`, and `BillingEditor.tsx` own focused schema-driven editing blocks.
- `RecordsTable.tsx`, `RunsTable.tsx`, `ArtifactsTable.tsx`, plus a new lightweight `AuditEventsTable.tsx` and optional `InstallsTable.tsx`, own read-only operational tables.
- `formSchema.ts` remains the pure normalization and validation boundary for UI form state.
- `src/services/adminCommercial.ts` remains the single frontend API wrapper for `admin.moduleApps`.

The first implementation should prefer pure helper functions for normalization and previews so tests can cover behavior without rendering the full page.

## Data Flow

### List flow

1. Admin opens `/admin/module-apps`.
2. `AdminModuleAppsPage` calls `adminCommercialService.moduleApps.list`.
3. Page shows apps with filters for status and category.
4. Selecting a row stores `selectedAppId`.
5. Detail queries run only when `selectedAppId` exists.

### Create flow

1. Admin clicks `Create module app`.
2. `AppEditorModal` opens with `parseModuleAppAdminForm` defaults.
3. Admin fills metadata, pages, actions, entitlements, and billing.
4. Submit validates through `parseModuleAppAdminForm`.
5. Page calls `adminCommercialService.moduleApps.upsert`.
6. List refreshes and the new app becomes selected.

### Edit flow

1. Admin selects an app.
2. Page calls `adminCommercialService.moduleApps.get`.
3. Detail response is normalized into editor state.
4. Saving metadata can call `upsert` with the full manifest.
5. Saving focused sections can call the existing focused APIs:
   - `upsertPages`
   - `upsertActions`
   - `upsertEntitlements`
   - `upsertBilling`

### Publish flow

1. Admin clicks publish or unpublish.
2. Page calls `publish` or `unpublish`.
3. Detail and list refresh.
4. Audit events become visible through `listAuditEvents`.

## UI Design

The UI should be dense and operational, not marketing-like.

Recommended layout:

- Top toolbar: title, status/category filters, refresh, create button.
- Left or upper table: app list with name, slug, status, type, category, tags, updated time, and actions.
- Right or lower detail area: selected app summary and tabs.
- Detail tabs:
  - Overview
  - Pages
  - Actions
  - Entitlements
  - Billing
  - Installs
  - Records
  - Runs
  - Artifacts
  - Audit

Component style:

- Prefer `@lobehub/ui/base-ui` where available, then `@lobehub/ui`, then antd.
- Avoid nested cards inside card-like admin containers.
- Use compact tables, segmented controls, switches, inputs, selects, and tooltips.
- Show empty, loading, and error states for every async panel.

## Editor Rules

### Metadata

Required fields:

- `slug`
- `displayName`
- `icon`
- `category`
- `description`
- `appType`

Optional fields:

- `tags`
- `status`

Validation source:

- Always use `moduleAppAdminUpsertSchema` through `parseModuleAppAdminForm`.

### Pages

Supported editable fields:

- `key`
- `title`
- `type`
- `routePath`
- `sortOrder`
- `dataSource` as JSON textarea
- `layoutSchema` as JSON textarea
- `actionBindings` as JSON textarea

The page editor should include an `Add overview page` fallback when the list is empty.

### Actions

Supported editable fields:

- `id`
- `name`
- `runtimeType`
- `moduleMultiplier`
- `inputSchema` as JSON textarea
- `outputSchema` as JSON textarea
- `runtimeConfig` as JSON textarea

Runtime types should use the existing enum from `@lobechat/types`.

### Entitlements

Supported editable fields:

- `plan`
- `visible`
- `installable`
- `runnable`
- `freeQuotaCredits`
- `discountPercent`

The editor should support adding one row per plan key. It should not assume a fixed plan list unless a plan catalog is loaded later.

### Billing

Supported editable fields:

- `chargeMode`
- `defaultMultiplier`
- `fixedServiceFeeCredits`
- `externalApiCostCredits`
- `failureFixedFeePolicy`

The UI must explain that this phase stores billing snapshots and runtime config but does not post real payment ledger transactions.

## Error Handling

- Validation failures should remain client-side and show field-level or section-level messages.
- API errors should show a non-destructive alert/toast with the backend error message.
- JSON textarea parse errors should not submit; the editor should identify the broken field.
- Publish/unpublish should require a confirmation if the app has no visible entitlement, no page, or no runnable action. This can be a warning in P2-A and a hard guard in a later phase.
- If a focused section save fails, the modal should keep unsaved state instead of closing.

## Security And Permissions

- Use existing admin router capability procedures.
- Do not expose secrets in the admin editor.
- Do not add arbitrary frontend code fields.
- External API runtime config remains server-side and must keep using safe URL validation when execution is added.
- Publishing does not bypass user plan entitlements; user routes still require `visible`, `installable`, and `runnable`.

## Testing Strategy

P2-A should use TDD for each implementation slice.

Required tests:

- `formSchema.test.ts` coverage for default form normalization, JSON-like payload preservation, and invalid payload rejection.
- Pure admin view-model/helper tests for list filtering, selected app normalization, JSON textarea parsing, and publish warnings.
- Component tests for each editor subcomponent where practical.
- Admin service wrapper tests for `moduleApps` methods if contracts change.
- Business-server admin router tests if backend input or audit behavior changes.
- Existing desktop router sync test if route registration changes.
- Type-check before completion.

Target commands:

- `bunx vitest run --silent='passed-only' src\features\Admin\moduleApps\formSchema.test.ts`
- `bunx vitest run --silent='passed-only' src\services\adminCommercial.test.ts`
- From `packages/business-server`: `bunx vitest run --silent='passed-only' src\lambda-routers\admin\moduleApps.test.ts`
- `bun run type-check`
- `git diff --check`

## Documentation Updates

Implementation must update:

- `docs/FEATURE_REGISTRY.md`
- `docs/CHANGELOG_INTERNAL.md`

If the editor introduces new known limits, add them to the Module App Platform registry entry rather than burying them in code comments.

## Acceptance Criteria

- Admins can open `/admin/module-apps` and see an app list instead of a placeholder.
- Admins can create a draft module app with metadata, at least one page, billing config, and entitlements.
- Admins can edit pages, actions, entitlements, and billing for an existing app.
- Admins can publish and unpublish an app through existing APIs.
- Admins can inspect records, runs, artifacts, installs, and audit events for the selected app.
- Invalid form payloads are blocked before submission.
- JSON editor fields report parse errors clearly.
- The implementation does not modify Platform Plugin Marketplace behavior.
- The implementation does not add arbitrary JS, iframe, remote module, or MCP/Skill import behavior.

## Rollback Plan

P2-A should be reversible by reverting frontend admin editor commits and any helper tests. Backend contract changes should be avoided unless strictly needed. If a backend change is required, it must be isolated behind existing router procedures and covered by tests so it can be reverted independently.

## Open Decisions For Later Phases

- Whether `/admin/module-apps/:appId` should become a dedicated route after the single-page editor stabilizes.
- Whether plan entitlement rows should load the active plan catalog automatically.
- Whether actions should gain a richer runtime-specific form instead of JSON runtime config.
- Whether workflow apps need a visual step editor.
- Whether workspace billable runs should be blocked or charged to a workspace account once workspace billing is finished.
