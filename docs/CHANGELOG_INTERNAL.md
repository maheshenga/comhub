# Internal Changelog

## 2026-07-09

### Module App Platform

- MODULE-APP-P1-DESIGN-001: Added the planned Module App Platform P1 design for ordinary apps, AI apps, API apps, simple workflow apps, and hybrid apps with personal and workspace data scopes.
- Scope: documentation and feature governance only; no business code, routes, database migrations, or deployment files changed.
- Design: `docs/superpowers/specs/2026-07-09-module-app-platform-p1-design.md`.
- MODULE-APP-P1-001: Added independent Module App type contracts and schema guardrails for app metadata, pages, actions, entitlements, records, runs, and admin/user inputs.
- MODULE-APP-P1-002: Added the independent `module_app_*` database schema, migration registration, and Drizzle model foundations without touching `platform_plugin_*`, MCP, or Skills tables.
- MODULE-APP-P1-003: Added the Module App permission service for personal records, workspace membership, workspace admin/archive rules, and admin override.
- MODULE-APP-P1-004: Added Module App model marketplace/detail/install/record/run/artifact foundations, including personal install/uninstall and archived-record filtering.
- MODULE-APP-P1-005: Added the authenticated user `lambda.moduleApp` router with marketplace, detail, personal install, personal/team app listing, runtime manifest, record CRUD, run, and artifact endpoints. `createRecord`, `updateRecord`, and `runAction` now enforce the current plan's runnable entitlement before mutating module app data.
- Verification: `packages/types/src/moduleApp.test.ts`, `packages/database/src/schemas/moduleApp.schema.test.ts`, `packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`, `packages/business-server/src/module-apps/permission.test.ts`, `apps/server/src/routers/lambda/moduleApp.test.ts`, `bun run type-check`, and `git diff --check`.

## 2026-07-07

### Governance

- GOV-001: Added admin settings guardrails for app setting form classification, registry metadata completeness, and sensitive desktop OSS values in public desktop config.
- Verification: `src/features/Admin/adminSettingsForm.test.ts`, `src/server/services/appSettings/governance.test.ts`, and `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-002: Added ledger provider/model display-name formatting so user credit ledger rows prefer metadata display names and hide raw provider UUIDs.
- Verification: `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`.
- GOV-003: Added Community/MCP/Skill market fallback normalization so placeholder `UN` labels and blank descriptions render as readable fallback content.
- Verification: `src/features/SkillStore/SkillList/normalizeMarketItems.test.ts`, `apps/server/src/services/discover/index.test.ts`, and `apps/server/src/services/market/index.test.ts`.
- GOV-004 to GOV-015: Executed Governance Sprint 002 with 12 small tasks covering the sprint register, admin settings map, commercial page boundaries, deployment version probe, governance index, long-term registry/changelog updates, secret-like settings guard, public desktop config allowlist, ledger/plans/top-up formatter guardrails, top-up serializer cleanup, and referral input formatter extraction.
- Verification: `src/server/services/appSettings/governance.test.ts`, `src/const/billingPresentation.test.ts`, `src/business/client/BusinessSettingPages/referralDisplay.test.ts`, `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`, `src/business/client/BusinessSettingPages/plansDisplay.test.ts`, and `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-016 to GOV-025: Executed Governance Sprint 003 with model catalog display resolvers, cross-provider duplicate model diagnostics, credit ledger allocation formatter extraction, model catalog display rules documentation, registry updates, and governance index updates.
- Verification: `src/server/services/modelCatalog/visibleModels.test.ts`, `src/server/services/modelCatalog/diagnostics.test.ts`, `src/business/client/BusinessSettingPages/creditsDisplay.test.ts`, `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`, and `git diff --check`.
- GOV-026: Added server brand cache invalidation to the admin runtime cache refresh action so loading SVG, favicon, and brand config can be refreshed without waiting for the brand TTL.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-027: Extended the public `/api/version` probe with safe deployment metadata and injected commit/image build metadata through the Docker build workflow.
- Verification: `src/app/(backend)/api/version/route.test.ts`.
- GOV-028: Added explicit user default settings sync priority coverage. Default assistant meta is preserved by default during backend default sync, while the admin "save and sync" action can explicitly force default assistant meta into existing users and records that force flag in the audit payload.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-029: Added before/after credit-account snapshots to the admin `credits.adjust` audit payload so manual credit changes have a reversible asset trail.
- Verification: `packages/business-server/src/lambda-routers/admin/credits.test.ts`.
- GOV-030: Added before/after plan-catalog snapshots to admin plan update/delete audit payloads while preserving the existing payload fields.
- Verification: `packages/business-server/src/lambda-routers/admin/plans.test.ts`.
- GOV-031: Added before/after plan-catalog snapshots to admin `plan.setActive` and `plan.setModelRules` audit payloads.
- Verification: `packages/business-server/src/lambda-routers/admin/plans.test.ts`.
- GOV-032: Added structured operation, status, scope, and cache-domain result metadata to admin settings cache refresh and user-default sync audit payloads.
- Verification: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- GOV-033: Added a pure business model pricing margin transform for model-bank pricing objects. The first P0-04 slice covers fixed, tiered, lookup, and approximate media price fields without mutating source pricing or changing billing transactions.
- Verification: `src/business/client/hooks/useBusinessModelPricing.test.ts`.
- GOV-034: Added a server-side model pricing snapshot helper that records whether pricing comes from admin/database metadata, static model-bank data, or is missing while preserving the existing pricing-only helper output.
- Verification: `packages/business-server/src/serverModelPricing.test.ts`.
- GOV-035: Added admin model billing matrix pricing-source visibility so rows can distinguish manual overrides, database/admin pricing, model-bank pricing, and missing pricing without changing billing transactions.
- Verification: `src/features/Admin/adminModelBillingMatrix.test.ts`.
- GOV-036: Added `pricingSource` to the admin enabled AI provider models API so the billing matrix can receive database/missing pricing source metadata from the backend.
- Verification: `packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts`.
- GOV-037: Added exact static model-bank pricing source detection to the admin enabled AI provider models API for safe provider mappings only, preserving DB pricing priority and leaving generic compatible gateways as missing.
- Verification: `packages/business-server/src/lambda-routers/admin/newapiProviders.test.ts`.

### Platform Plugins

- PLATFORM-PLUGIN-P1-001: Added the shared platform plugin type contract for P1 `api_action` and `content_generation` plugins, including status, runtime, permission, billing, entitlement, action config, detail, and run-result DTO schemas.
- Verification: `packages/types/src/platformPlugin.test.ts`.
- PLATFORM-PLUGIN-P1-002: Added the `platform_plugin_*` database schema, migration registration, and `PlatformPluginModel` marketplace/admin data access while keeping the domain separate from legacy MCP/Skill plugin tables.
- Verification: `packages/database/src/models/__tests__/platformPlugin.marketplace.test.ts` when `DATABASE_TEST_URL` is available.
- PLATFORM-PLUGIN-P1-003: Added platform plugin domain guards for plan visibility/install/run permissions, billing calculations, secret masking/encryption helpers, URL safety checks, DNS hardening, and audit payload helpers.
- Verification: `packages/business-server/src/platform-plugins/permission.test.ts`, `packages/business-server/src/platform-plugins/billing.test.ts`, `packages/business-server/src/platform-plugins/secrets.test.ts`, and `packages/business-server/src/platform-plugins/urlSafety.test.ts`.
- PLATFORM-PLUGIN-P1-004: Added the admin `admin.platformPlugins` router for plugin CRUD, publishing state, entitlements, billing configuration, secret metadata, run records, artifacts, and audit-safe operations.
- Verification: `packages/business-server/src/lambda-routers/admin/platformPlugins.test.ts`.
- PLATFORM-PLUGIN-P1-005: Added the authenticated user `lambda.platformPlugin` router for marketplace listing, detail reads, install/uninstall, Agent binding, and run entry points with server-side permission checks.
- Verification: `apps/server/src/routers/lambda/platformPlugin.test.ts`.
- PLATFORM-PLUGIN-P1-006: Added the independent admin platform plugin navigation entry and page shell at `/admin/platform-plugins` without placing plugin settings into AI provider, model pricing, or system-default pages.
- Verification: `src/features/Admin/adminNavigation.test.ts`, `src/business/client/BusinessDesktopRoutes.test.ts`, and `src/features/Admin/adminChineseCopy.test.ts`.
- PLATFORM-PLUGIN-P1-007: Added the admin platform plugin editor surface, including entitlement, billing, secret metadata, run record, and artifact panels plus admin service wrappers.
- Verification: admin editor files under `src/features/Admin/platformPlugins` and service wrappers under `src/services/adminCommercial.ts`.
- PLATFORM-PLUGIN-P1-008: Added the user platform plugin marketplace and detail/run UI routes at `/plugins` and `/plugins/:pluginId`, with desktop router sync protection and presentation helpers.
- Verification: `src/services/platformPlugin.test.ts`, `src/features/PlatformPluginMarket/helpers.test.ts`, and `src/spa/router/desktopRouter.sync.test.tsx`.
- PLATFORM-PLUGIN-P1-009: Added runtime execution orchestration for API action and content generation plugins, including safe API runner behavior, artifact metadata writing, billing policy integration, sanitized failure handling, and user router delegation.
- Verification: `packages/business-server/src/platform-plugins/runners/apiActionRunner.test.ts`, `packages/business-server/src/platform-plugins/runners/contentGenerationRunner.test.ts`, `packages/business-server/src/platform-plugins/artifactWriter.test.ts`, `packages/business-server/src/platform-plugins/runPlatformPlugin.test.ts`, and `apps/server/src/routers/lambda/platformPlugin.test.ts`.
- PLATFORM-PLUGIN-P1-010: Added a chat input platform plugin shortcut category for installed runnable platform plugins. Selecting a platform plugin opens the explicit `/plugins/:pluginId` detail/run surface with the current Agent id instead of dispatching legacy MCP/Skill ActionTag commands.
- Verification: `src/features/ChatInput/InputEditor/platformPluginMentions.test.tsx`, `src/features/ChatInput/InputEditor/index.test.tsx`, `src/services/platformPlugin.test.ts`, `src/features/PlatformPluginMarket/helpers.test.ts`, and `src/spa/router/desktopRouter.sync.test.tsx`.
- PLATFORM-PLUGIN-P1-011: Added an idempotent `platform-plugin:seed` script for two draft P1 sample plugins: `dictionary-lookup` API action and `research-notes` content generation with plan entitlements.
- Verification: `scripts/seedPlatformPlugins.test.ts`.

### Platform Plugin Marketplace P2-lite

- Added admin operations metadata for featured state, sort weight, promotion label, use case, plan benefit summary, and upgrade CTA.
- Added admin plugin stats for installations, runs, success rate, charged credits, and fixed service fee estimate.
- Added user marketplace filtering by search, category, and runtime type with featured-first ordering.
- Added user plugin detail availability copy, billing summary, and current-user run history.
- Preserved MCP / Skills isolation and did not add new plugin runtime types.

### Platform Plugin Marketplace P3 Run Experience

- Replaced hardcoded/mojibake platform plugin detail and run panel copy with localized subscription namespace keys.
- Added presentation helpers for restriction copy keys and run status metadata.
- Refreshed recent run history after a successful plugin run.
- Preserved server-side install/run authorization and billing behavior.

### Platform Plugin Marketplace P4 Run History Pagination

- Added deduplicated current-user run history page merging.
- Added localized Load more controls for plugin run history.
- Wired plugin detail pages to fetch additional run pages through the existing `listRuns` cursor API.
- Preserved server-side authorization, billing behavior, and MCP / Skills isolation.

### Platform Plugin Marketplace P5 Run Error Copy

- Added localized run failure notice and failed-result preview copy.
- Added frontend mapping for known plugin run backend error codes.
- Stopped showing raw plugin run error strings directly in the user toast.
- Preserved plugin authorization, billing, persistence, runtime execution, and MCP / Skills isolation.

### Platform Plugin Marketplace P6 Detail Operation Error Copy

- Added localized detail-page operation failure copy for install, uninstall, and Agent binding actions.
- Added frontend mapping for known detail operation backend error codes.
- Stopped showing raw plugin detail operation error strings directly in the user toast.
- Preserved plugin authorization, entitlement checks, billing, persistence, runtime execution, and MCP / Skills isolation.

### Platform Plugin Marketplace P7 Run History Preview Copy

- Added run-history presentation coverage for failed sentinel previews.
- Reused the existing localized failed-preview copy in history rows.
- Preserved readable runtime previews and existing run-history pagination.
- Preserved plugin authorization, billing, persistence, runtime execution, and MCP / Skills isolation.
