# Module App Platform Unification And Platform Plugin Removal Design

Date: 2026-07-10
Project: ComHub / LobeHub customization
Status: Approved direction, pending implementation plan

## 1. Decision

ComHub will use `Module App Platform` as the single extensibility domain for SaaS apps, app marketplace entries, module factory output, user-uploaded apps, developer submissions, admin-created modules, and system-maintained modules.

`Platform Plugin Marketplace` is no longer a future product track. It can be removed as a product surface and code domain after its useful concepts are folded into Module App Platform.

## 2. Product Scope

The unified platform must support four app sources:

- `system`: built-in modules maintained by the platform.
- `admin`: modules created directly by administrators in the module factory.
- `user`: apps uploaded by ordinary users and reviewed by administrators.
- `developer`: apps or plugin-style modules submitted by developers and reviewed by the platform.

The user-facing product names can remain flexible:

- App Marketplace
- Module Marketplace
- Module Factory
- SaaS App Platform

The internal technical domain should remain stable:

- `module_app_*` database tables
- `ModuleAppModel`
- `lambda.moduleApp`
- `admin.moduleApps`
- `ModuleAppMarket`
- `ModuleAppRuntime`
- `Admin/moduleApps`

## 3. Why Remove Platform Plugin Marketplace

The current `Platform Plugin Marketplace` duplicates platform concepts that Module App Platform already needs:

- marketplace listing
- admin editor
- plan entitlements
- billing rules
- runtime actions
- run records
- artifacts
- audit logs
- package/review lifecycle

Keeping both domains would create long-term confusion:

- two marketplaces
- two admin systems
- two billing paths
- two runtime models
- two sets of database tables
- two ways to submit or publish extensions

The preferred direction is to keep one extensibility platform and model plugin-style behavior as one app type or runtime type inside Module App Platform.

## 4. Target Architecture

Module App Platform becomes the only extensibility platform.

Core entities:

- App metadata
- App versions
- App pages
- App actions
- App entitlements
- App installations
- App records
- App runs
- App artifacts
- App audit logs
- App package submissions
- App source ownership
- App review lifecycle

Runtime styles:

- ordinary record apps
- API apps
- AI apps
- workflow apps
- plugin-style function apps
- hybrid apps

Plugin-style modules should be represented as Module Apps with one or more actions, not as `platform_plugin_*` records.

## 5. Removal Strategy

Removal must be staged. "Completely clear" means the product and code path are removed, but destructive production database drops require an explicit backup and migration step.

### Phase A: Freeze Platform Plugin Marketplace

Goal: stop further expansion.

Actions:

- Mark `Platform Plugin Marketplace` as deprecated in docs and feature registry.
- Stop adding new UI, routes, runtime types, or billing logic to `platformPlugin`.
- Keep current code compiling until removal slices are ready.
- Redirect new product work to `Module App Platform`.

### Phase B: Module App Feature Parity

Goal: make Module App capable of absorbing plugin-style use cases.

Required Module App additions:

- app source field: `system`, `admin`, `user`, `developer`
- review status lifecycle: `draft`, `pending_review`, `approved`, `rejected`, `published`, `unpublished`, `archived`
- package submission UI
- admin review console
- admin module factory
- market publish controls
- plugin-style app type or runtime semantics
- API action runner parity
- content generation runner parity
- artifact writer parity
- secret handling parity, if still needed
- billing snapshot parity
- run history parity

### Phase C: Product Surface Cutover

Goal: users and admins only see Module App surfaces.

Actions:

- Remove user `/plugins` navigation and routes.
- Remove admin `/admin/platform-plugins` navigation and routes.
- Remove chat input platform plugin mention category.
- Route any old plugin-facing links to `/apps` or a clear not-found/deprecated page.
- Keep MCP and Skills unchanged; they are not part of Platform Plugin Marketplace removal.

### Phase D: Code Domain Removal

Goal: remove unused Platform Plugin code after cutover tests pass.

Remove or replace:

- `packages/types/src/platformPlugin.ts`
- `packages/database/src/models/platformPlugin.ts`
- `packages/database/src/models/platformPluginOperations.ts`
- `packages/database/src/schemas/platformPlugin.ts`
- `packages/business-server/src/platform-plugins/*`
- `packages/business-server/src/lambda-routers/admin/platformPlugins.ts`
- `apps/server/src/routers/lambda/platformPlugin.ts`
- `src/services/platformPlugin.ts`
- `src/features/PlatformPluginMarket/*`
- `src/features/Admin/platformPlugins/*`
- `src/features/Admin/AdminPlatformPluginsPage.tsx`
- `src/features/ChatInput/InputEditor/platformPluginMentions.ts`
- `scripts/seedPlatformPlugins.ts`
- related tests and locale keys

Also remove router registrations, exports, admin route registry entries, desktop route config entries, package scripts, and feature registry entries that only exist for Platform Plugin Marketplace.

### Phase E: Database Decommission

Goal: remove database tables only after production safety checks.

Safe order:

1. Confirm no live code references `platform_plugin_*`.
2. Confirm production has a fresh database backup.
3. Export or archive any existing `platform_plugin_*` records if needed.
4. Add a migration that drops `platform_plugin_*` tables.
5. Verify deployment rollback plan before applying the migration.

If immediate data deletion is not required, keep the tables as deprecated for one release cycle and drop them later.

## 6. Data Migration Policy

Default policy: do not migrate existing Platform Plugin records automatically.

Reason:

- Platform Plugin was experimental.
- Module App schemas support broader app/page/action semantics.
- Blind migration could create broken marketplace entries.

Optional later tool:

- A one-off admin-only migration script can convert selected platform plugins into Module Apps after manual review.
- The script must create draft Module Apps, never publish automatically.

## 7. Security Rules

The unified platform must preserve the stronger safety boundaries from the latest Module App work:

- User-uploaded packages are reviewed before publishing.
- P1 package review does not execute uploaded code.
- No iframe, remote module, Docker, MCP, or Skill execution is introduced by the removal.
- API actions must keep safe URL validation.
- Secrets must remain server-only and encrypted if supported.
- Run logs must redact secret-like values.
- Admin write operations must be audit logged.
- Package approval must convert manifests into reviewed Module App records.

## 8. User Experience After Cutover

User side:

- `/apps`: unified app marketplace
- `/apps/my`: installed personal apps
- `/apps/team`: team apps
- `/apps/:appId`: app detail
- `/apps/:appId/app`: app runtime shell

Admin side:

- `/admin/module-apps`: module factory and app governance
- package submissions tab
- review queue tab
- source and ownership filters
- publish/unpublish/archive controls
- run/artifact/audit inspection

There should be no visible `Platform Plugin Marketplace` entry after cutover.

## 9. Developer Experience After Cutover

Developer submissions should use Module App packages.

Minimum package path:

1. Developer prepares an app package with `manifest.json`.
2. Developer uploads package metadata and archive.
3. System validates manifest and file list.
4. Submission enters `pending_review`.
5. Admin reviews manifest, source, runtime declarations, entitlements, billing, and package metadata.
6. Admin approves or rejects.
7. Approved package becomes a draft or published Module App according to platform policy.

## 10. Testing Requirements

Before removing Platform Plugin code:

- Module App package contract tests must pass.
- Module App package validation tests must pass.
- Module App database schema/model tests must pass.
- Module App user/admin router tests must pass.
- Module App service wrapper tests must pass.
- Admin route registry tests must prove `/admin/platform-plugins` is gone and `/admin/module-apps` remains.
- Desktop router sync tests must pass.
- Chat input mention tests must prove platform plugin mentions are gone or replaced by Module App mentions.
- Type-check must pass.
- `git diff --check` must pass.

Before dropping database tables:

- Add migration tests or schema governance tests proving intended table removal.
- Verify production backup and rollback procedure.

## 11. Recommended Implementation Slices

P0: Deprecation and freeze

- Mark Platform Plugin as deprecated in docs.
- Add a removal plan entry.
- Prevent future work from targeting Platform Plugin.

P1: Module App parity for source and review

- Add app source ownership fields.
- Build admin review queue UI for `module_app_packages`.
- Build package submit UI if storage upload is available.

P2: Module App plugin-style parity

- Move useful API action, content generation, safe URL, artifact, billing, and secret patterns into Module App services.
- Do not keep a shared dependency on `platform-plugins` after this slice.

P3: Product surface removal

- Remove `/plugins`, `/plugins/:pluginId`, `/admin/platform-plugins`, platform plugin nav, and chat platform plugin mentions.
- Update locales and docs.

P4: Code domain removal

- Delete Platform Plugin types, models, routers, services, UI, scripts, and tests.
- Remove exports and route registrations.

P5: Database decommission

- Keep deprecated tables for one release, or drop them after backup confirmation.

## 12. Acceptance Criteria

The unification is complete when:

- All new extensibility work is under Module App Platform.
- User-facing plugin marketplace routes no longer exist.
- Admin platform plugin management routes no longer exist.
- Chat input no longer exposes Platform Plugin Marketplace mentions.
- Module App can represent plugin-style apps through app/action/runtime schemas.
- Package review and admin module factory cover user, developer, admin, and system sources.
- No production code imports `platformPlugin` or `platform-plugins`.
- Type-check and targeted tests pass.
- Database table removal is either safely completed or explicitly documented as a deferred decommission step.

## 13. Explicit Non-Goals

- Do not remove MCP.
- Do not remove Skills.
- Do not remove LobeHub upstream legacy market/discover code unless separately scoped.
- Do not drop production database tables without backup confirmation.
- Do not auto-publish converted apps.
- Do not introduce uploaded code execution while removing Platform Plugin Marketplace.

