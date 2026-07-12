# Module App Platform P1 Design

Date: 2026-07-09

## Summary

ComHub needs a general module/application platform, not only an AI plugin system. The existing Platform Plugin Marketplace is useful as a reference for commercial controls, but its P1 shape is action-centered: one plugin, one primary run panel, API action or content generation. The new platform should support normal business applications and AI-assisted applications with persistent personal and team data.

P1 introduces a separate `Module App` domain. It keeps the existing `platform_plugin_*` feature intact and adds a safer foundation for apps with pages, simple workflows, CRUD records, app runs, artifacts, plan access, and billing. AI is optional. Ordinary app pages and data operations must work without AI provider configuration or AI credit usage.

## Goals

- Support ordinary apps, AI apps, API apps, and simple workflow apps under one app marketplace.
- Support personal data and team/workspace data from day one.
- Save user and team records as first-class app data.
- Keep team permissions simple in P1.
- Allow app pages such as list, form, detail, result, and artifact pages.
- Allow actions such as save record, call API, generate AI content, and run a simple workflow step.
- Reuse the existing commercial concepts where appropriate: plan visibility, installability, run permission, fixed fees, AI multiplier, external API cost, run history, and artifacts.
- Avoid breaking the existing Platform Plugin Marketplace and MCP/Skill features.

## Non-Goals For P1

- No arbitrary external JavaScript execution.
- No iframe or remote module app sandbox in P1.
- No dynamic physical database table creation per app.
- No field-level permission model.
- No full RBAC workflow permissions.
- No complex workflow graph editor.
- No direct import of existing MCP or Skills into the Module App marketplace.
- No automatic migration or renaming of existing `platform_plugin_*` tables.

## Current Codebase Context

The existing Platform Plugin Marketplace is experimental and has useful pieces:

- Types: `packages/types/src/platformPlugin.ts`
- Database schema: `packages/database/src/schemas/platformPlugin.ts`
- Runtime services: `packages/business-server/src/platform-plugins/*`
- User API: `apps/server/src/routers/lambda/platformPlugin.ts`
- Admin API: `packages/business-server/src/lambda-routers/admin/platformPlugins.ts`
- User UI: `src/features/PlatformPluginMarket/*`
- Admin UI: `src/features/Admin/platformPlugins/*`

Limitations that justify a new Module App domain:

- The admin editor only persists one action per plugin.
- The user detail page runs `plugin.actions[0]`.
- There is no page manifest for multiple app screens.
- There is no app session or app record storage model.
- The current runtime assumes a plugin run, not a durable business app.
- Team data and simple collaboration are not represented.

## Product Model

### User-Facing Names

- User navigation: `应用市场`, `我的应用`, `团队应用`
- Admin navigation: `模块应用`
- Technical domain: `Module App`

### App Types

`appType` describes the product category:

- `standard_app`: ordinary app with pages, forms, lists, and saved records.
- `api_app`: ordinary app with external API actions.
- `ai_app`: app that uses AI generation or analysis.
- `workflow_app`: app with ordered steps.
- `hybrid_app`: app that mixes normal data operations, API calls, AI, and artifacts.

### Runtime Types

`runtimeType` describes a page action or module action:

- `none`: no backend execution, usually static page or local UI state.
- `record_create`: create a module app record.
- `record_update`: update a module app record.
- `record_archive`: archive a module app record.
- `api_action`: call a configured public external API.
- `server_action`: call an approved internal ComHub server action.
- `content_generation`: run AI content generation.
- `workflow_step`: run one simple ordered workflow step.

`mcp` and `skill` remain future runtime types. They should be modeled in type contracts only after the first Module App app flow is stable.

## Data Ownership

Every app record belongs to exactly one data scope:

- `personal`: personal data, visible and editable only by the owner.
- `workspace`: team/workspace data, visible to workspace members.

P1 record ownership fields:

- `scopeType`
- `ownerUserId`
- `workspaceId`
- `createdBy`
- `updatedBy`

Rules:

- Personal records require `ownerUserId` and must not require `workspaceId`.
- Workspace records require `workspaceId`.
- Workspace records should still store `ownerUserId` as the initial responsible user when available.
- All user APIs must resolve the current user and workspace membership before reading or mutating records.

## Simple Permission Model

P1 uses simple permissions.

Personal scope:

- The owner can view, create, edit, and archive their own records.
- Other users cannot access personal records.
- System admins may access for admin support only through admin APIs with audit logging.

Workspace scope:

- Workspace members can view workspace records.
- Workspace members can create and edit workspace records.
- Record creator, workspace admin, and system admin can archive records.
- Hard delete is not exposed to normal users in P1.

Admin scope:

- System admins can manage all module apps.
- System admins can view operational run history and audit logs.
- App configuration changes must be audit logged.

Future upgrade path:

- Add app-level roles.
- Add collection-level permissions.
- Add action-level permissions.
- Add field-level permissions only if a real product case demands it.

## Database Design

P1 should add new tables instead of modifying `platform_plugin_*` heavily.

### `module_apps`

Stores app metadata.

- `id`
- `slug`
- `displayName`
- `icon`
- `category`
- `description`
- `appType`
- `status`: `draft`, `published`, `unpublished`
- `tags`
- `billing`
- `metadata`
- `sortOrder`
- `createdAt`
- `updatedAt`

### `module_app_versions`

Stores version snapshots for publishing and rollback.

- `id`
- `appId`
- `version`
- `manifestSnapshot`
- `changelog`
- `publishedAt`
- `rollbackSourceVersionId`
- `createdAt`

### `module_app_pages`

Stores page definitions for each app version.

- `id`
- `appId`
- `versionId`
- `pageKey`
- `title`
- `pageType`: `overview`, `form`, `list`, `detail`, `result`, `artifact`, `custom`
- `routePath`
- `layoutSchema`
- `dataSource`
- `actionBindings`
- `sortOrder`
- `createdAt`
- `updatedAt`

### `module_app_actions`

Stores executable actions. This replaces the one-action limitation from current Platform Plugin admin UI.

- `id`
- `appId`
- `versionId`
- `actionKey`
- `runtimeType`
- `name`
- `inputSchema`
- `outputSchema`
- `moduleMultiplier`
- `runtimeConfig`
- `createdAt`
- `updatedAt`

### `module_app_entitlements`

Stores plan access.

- `id`
- `appId`
- `plan`
- `visible`
- `installable`
- `runnable`
- `freeQuotaCredits`
- `discountPercent`
- `createdAt`
- `updatedAt`

### `module_app_installations`

Stores personal or workspace installation state.

- `id`
- `appId`
- `versionId`
- `scopeType`
- `userId`
- `workspaceId`
- `status`
- `installedAt`
- `uninstalledAt`
- `createdAt`
- `updatedAt`

Rules:

- Personal installation uniqueness: `appId + userId + scopeType`.
- Workspace installation uniqueness: `appId + workspaceId + scopeType`.

### `module_app_records`

Stores app business data.

- `id`
- `appId`
- `collectionKey`
- `scopeType`
- `ownerUserId`
- `workspaceId`
- `recordKey`
- `title`
- `status`: `active`, `draft`, `archived`
- `data JSONB`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Indexes:

- `appId + scopeType + ownerUserId + collectionKey + updatedAt`
- `appId + scopeType + workspaceId + collectionKey + updatedAt`
- `appId + collectionKey + recordKey`
- JSONB GIN index can be added later after real query patterns are known.

### `module_app_record_events`

Stores record audit trail.

- `id`
- `appId`
- `recordId`
- `eventType`
- `actorUserId`
- `scopeType`
- `workspaceId`
- `beforeSnapshot`
- `afterSnapshot`
- `metadata`
- `createdAt`

### `module_app_runs`

Stores action and workflow execution history.

- `id`
- `appId`
- `versionId`
- `actionId`
- `recordId`
- `scopeType`
- `userId`
- `workspaceId`
- `status`: `queued`, `running`, `succeeded`, `failed`, `denied`
- `inputSnapshot`
- `outputSnapshot`
- `billingSnapshot`
- `errorType`
- `errorMessage`
- `durationMs`
- `createdAt`
- `updatedAt`

### `module_app_artifacts`

Stores generated files and outputs.

- `id`
- `appId`
- `runId`
- `recordId`
- `scopeType`
- `userId`
- `workspaceId`
- `storageKey`
- `fileName`
- `mimeType`
- `sizeBytes`
- `expiresAt`
- `downloadCount`
- `createdAt`

## Page Manifest

Each app version should expose a manifest with pages and actions.

Example shape:

```json
{
  "pages": [
    {
      "key": "overview",
      "title": "Overview",
      "type": "overview",
      "routePath": "/"
    },
    {
      "key": "records",
      "title": "Records",
      "type": "list",
      "routePath": "/records",
      "dataSource": {
        "collectionKey": "records"
      }
    },
    {
      "key": "create",
      "title": "Create",
      "type": "form",
      "routePath": "/records/new",
      "actionBindings": [
        {
          "event": "submit",
          "actionKey": "create_record"
        }
      ]
    }
  ]
}
```

P1 supported page types:

- `overview`: app introduction and CTA.
- `form`: schema-driven input form.
- `list`: table/list view of records.
- `detail`: one record detail page.
- `result`: action result page.
- `artifact`: file/artifact list.

## Runtime And Action Flow

### Record Actions

Record actions are ordinary CRUD operations:

- Validate input against action input schema.
- Resolve scope and permissions.
- Create, update, or archive `module_app_records`.
- Write `module_app_record_events`.
- Return record id and preview data.
- Do not charge credits by default.

### API Actions

API actions should reuse the safe URL and secret handling ideas from `platform-plugins`:

- Public http(s) host only.
- Block localhost and private network targets.
- Use app secrets through server-side template rendering.
- Redact secrets in run logs.
- Allow fixed service fee or external API cost credits.

### AI Actions

AI actions should use existing model runtime patterns:

- Resolve provider and model from action config.
- Call configured model through server-side runtime.
- Store generated text in run output.
- Optionally write artifact.
- Charge based on actual AI usage when available, plus fixed/multiplier config.

### Simple Workflow Actions

P1 workflow is ordered, not graph-based:

- A workflow app can define sequential steps.
- Each step maps to one action.
- Step state can be stored in record data and run output.
- No branching editor in P1.
- No parallel execution in P1.

## Billing Model

Ordinary page views and record CRUD are free by default.

Billable operations:

- AI actions.
- External API actions with configured cost.
- Actions with fixed service fee.
- Workflow steps that call billable actions.

Billing scope:

- Personal app actions charge the personal account.
- Workspace app actions charge the workspace account when team billing exists.
- If workspace billing is unavailable in the current system, P1 should block workspace billable actions with a clear error instead of silently charging a member.

P1 billing config:

- `defaultMultiplier`
- `fixedServiceFeeCredits`
- `externalApiCostCredits`
- `failureFixedFeePolicy`
- `chargeMode`: `free`, `fixed`, `ai_usage`, `external_api`, `hybrid`

## User Experience

### Routes

- `/apps`: app marketplace.
- `/apps/my`: personal installed apps.
- `/apps/team`: workspace enabled apps.
- `/apps/:appId`: app detail.
- `/apps/:appId/app`: app runtime shell.
- `/apps/:appId/app/:pageKey`: app page runtime.

### Runtime Shell

The runtime shell should provide:

- App header with icon, name, install status, and scope switch.
- Left navigation for app pages when the app has multiple pages.
- Main content rendered by page type.
- Record context when viewing or editing a record.
- Run result panel when an action executes.
- Artifact list when files are generated.

### Scope Switch

Users can switch between:

- Personal scope.
- Workspace scope when they belong to a workspace and the app is installed/enabled for that workspace.

The UI should make the current scope visible before saving or running actions.

## Admin Experience

Admin route:

- `/admin/module-apps`

P1 tabs:

- Overview: metadata, status, category, tags.
- Pages: page definitions and ordering.
- Actions: action definitions and runtime config.
- Data Collections: collection keys and basic display fields.
- Permissions: plan entitlements and install/run visibility.
- Billing: fixed fee, external API cost, AI multiplier.
- Installs: personal and workspace installation status.
- Records: admin read view with scope filters.
- Runs: action and workflow run history.
- Artifacts: generated output files.
- Audit: app config and record events.

P1 editor should remain schema-driven. It does not need a visual workflow canvas.

## API Surface

User router:

- `moduleApp.listMarketplace`
- `moduleApp.getDetail`
- `moduleApp.installPersonal`
- `moduleApp.uninstallPersonal`
- `moduleApp.listMyApps`
- `moduleApp.listTeamApps`
- `moduleApp.getRuntimeManifest`
- `moduleApp.listRecords`
- `moduleApp.getRecord`
- `moduleApp.createRecord`
- `moduleApp.updateRecord`
- `moduleApp.archiveRecord`
- `moduleApp.runAction`
- `moduleApp.listRuns`
- `moduleApp.listArtifacts`

Admin router:

- `admin.moduleApps.list`
- `admin.moduleApps.get`
- `admin.moduleApps.upsert`
- `admin.moduleApps.publish`
- `admin.moduleApps.unpublish`
- `admin.moduleApps.upsertPages`
- `admin.moduleApps.upsertActions`
- `admin.moduleApps.upsertEntitlements`
- `admin.moduleApps.upsertBilling`
- `admin.moduleApps.listInstalls`
- `admin.moduleApps.listRecords`
- `admin.moduleApps.listRuns`
- `admin.moduleApps.listArtifacts`
- `admin.moduleApps.listAuditEvents`

## Security And Isolation

- All record queries must include scope filters.
- Workspace reads and writes must verify membership.
- Admin APIs must use existing admin capability procedures.
- App secrets must be encrypted and server-only.
- Run logs must redact secrets.
- External URLs must pass safe URL validation.
- No external JS execution in P1.
- All mutations should write audit events where data or configuration changes.

## Migration And Compatibility

P1 should not migrate existing Platform Plugins into Module Apps.

Compatibility approach:

- Keep `/plugins` and `/admin/platform-plugins` working.
- Add `/apps` and `/admin/module-apps` as separate surfaces.
- Reuse helper patterns where safe, but keep domain names separate.
- Later, Platform Plugin entries can be represented as a compatibility app type only after Module App is stable.

## Testing Strategy

Core tests before implementation completion:

- Type schema tests for Module App manifest, page, action, entitlement, record, run, and billing DTOs.
- Database model tests for marketplace listing, personal records, workspace records, archive behavior, and permission filters.
- Permission tests for personal owner access and workspace member access.
- Router tests for user record CRUD and action execution denial paths.
- Billing tests for free CRUD, fixed fee, API cost, and AI usage modes.
- Frontend helper tests for page manifest navigation and scope selection.
- Router sync tests if new SPA routes are added.

## P1 Delivery Slices

1. Domain contract and database schema.
2. Database model and permission service.
3. User router for marketplace, detail, installation, and record CRUD.
4. Admin router and minimal admin page shell.
5. User app marketplace and runtime shell.
6. Action runtime for record actions and free standard apps.
7. API and AI action runtime with billing.
8. Run history, artifacts, and audit views.

Each slice should be independently testable and revertible.

## Open Decisions Resolved For P1

- The platform supports both ordinary apps and AI apps.
- App data must be saved.
- Data supports personal and workspace scopes.
- Team permissions are simple in P1.
- Existing Platform Plugin code remains intact.
- P1 does not execute external frontend code.

## Acceptance Criteria

- An admin can create a published standard app with at least an overview page, list page, form page, and detail page.
- A user can install the app personally and create, view, edit, and archive personal records.
- A workspace member can use the app in workspace scope and create, view, and edit workspace records.
- Workspace records are invisible to non-members.
- Personal records are invisible to other users.
- A free standard app can be used without AI provider configuration.
- A configured AI action can run through the app action system and produce a run history entry.
- Billing is not charged for ordinary CRUD.
- Billable actions produce run and billing snapshots.
- Existing `/plugins` and `/admin/platform-plugins` behavior is not modified by P1.
