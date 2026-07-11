# Internal Changelog

## 2026-07-12

### Module App Purchase And Usage UX

- MODULE-APP-COMMERCE-011: Added append-only developer revenue accrual, refund reversal, delayed settlement batches, finance-permission administration, and audit-backed Commerce controls. Resource costs remain excluded from developer revenue share.
- MODULE-APP-COMMERCE-012: Added server-catalog checkout UX with personal/team scope isolation, monthly/yearly product selection, immutable promotion breakdowns, pending-payment cancellation, paid activation blocking, cancelled/refunded status, and license-only authorization. The UI never presents a pending order as purchased and does not accept browser-supplied prices or settlement state.
- MODULE-APP-COMMERCE-013: Added runtime cost visibility from persisted server snapshots, including AI base credits, module multiplier, fixed service fee, external API credits, total settled credits, model/provider output metadata, and artifact count. The browser does not recompute settled charges.
- Payment boundary: online payment remains unavailable. Orders stay pending until the audited admin/manual settlement adapter or a future verified payment webhook settles them. Paid orders cannot be duplicated while license activation is pending.
- Scope boundary: team products, orders, licenses, launch links, and runtime history require the explicit `workspaceId` context and current server-side workspace membership. Personal and team catalog/order state are not mixed in the detail page.
- Configuration and deployment: no new app setting, environment variable, external service, Docker service, bind mount, or runtime enablement. Migrations `0138_add_module_app_commerce.sql` and `0139_add_module_app_revenue.sql` must be applied before enabling the commerce path. Production Module App execution remains disabled.

## 2026-07-11

### Module App Commerce And AI Settlement

- MODULE-APP-COMMERCE-001: Added bounded commerce contracts for products, pricing, licenses, orders, promotions, billing payers, and module multipliers.
- MODULE-APP-COMMERCE-002: Added personal and workspace credit reservations with immutable settlement ledgers, release/expiry handling, concurrency protection, and audited workspace funding transfers.
- MODULE-APP-COMMERCE-003: Centralized free, plan, purchase, trial, expiry, suspension, installation, and workspace entitlement decisions across marketplace, install, launch, interactive execution, jobs, schedules, and webhooks.
- MODULE-APP-COMMERCE-004: Routed Module App content generation through the current user's model runtime, preserved model policy and plan-model checks, captured final NewAPI failover metadata, quoted official/model pricing without double-debiting, and settled app/action multipliers through one reservation ledger entry. User-managed provider credentials do not reserve or consume platform credits.
- MODULE-APP-COMMERCE-005: Added Drizzle mappings and a transactional database model for products, active prices, pending orders, idempotent manual settlement, personal licenses, and refund-driven license revocation.
- MODULE-APP-COMMERCE-006: Added authenticated read-only user APIs and client wrappers for bounded order history and personal license resolution. User identity is derived only from the server session; settlement and refunds remain admin-only.
- MODULE-APP-COMMERCE-007: Added finance-permission admin mutations for manual order settlement and paid-order refunds with success audit events. Database transitions now row-lock orders, reject pending refunds, keep repeated settlement/refund idempotent, and revoke only the refunded order's licenses.
- MODULE-APP-COMMERCE-008: Added published-app catalog listing, server-side product quotes, authenticated pending-order creation, and purchaser-only cancellation with client service wrappers. Client inputs cannot set amount, currency, snapshots, purchaser identity, or order state; unpublished applications are excluded at the database boundary.
- MODULE-APP-COMMERCE-009: Added workspace and subscription commerce: workspace products require an explicit current-member workspace, settled licenses bind to the workspace rather than purchaser, monthly/yearly or trial periods are persisted, expired licenses are excluded, and refunds cancel subscriptions. Personal checkout remains unchanged.
- MODULE-APP-COMMERCE-010: Completed immutable order snapshots using the shared commerce contract. Orders now freeze promotion, seat count, app multiplier, revenue-share rate, terms version, price, currency, billing period, trial, product type, and license scope before later catalog edits.
- Impact: existing Module App pages and components are unchanged; `lambda.moduleApp.runAction`, ModelRuntime hooks, commercial pricing quotes, module app credit tables, and run billing snapshots are affected. No new configuration key, environment variable, external service, Docker service, volume, or production runtime enablement is introduced.
- Deployment: migration `0138_add_module_app_commerce.sql` must be applied before enabling the commerce path. Production Module App execution remains disabled pending the separate runtime security acceptance gate.

### Module App Data, Workflows, And Team History

- MODULE-APP-DATA-P2-001: Added migration `0137_add_module_app_data_workflows.sql` with installation-bound managed data schemas/rows, workflow runs/nodes, schedules, webhooks, and delivery replay state. Existing records, runs, and artifacts gained installation bindings with compatibility backfill rules.
- MODULE-APP-DATA-P2-002: Added bounded collection and logical-table APIs with schema validation, declared indexes/references, installation isolation, transactions, cursor pagination, and SDK `data.*` methods. Applications cannot execute SQL or query undeclared fields.
- MODULE-APP-WORKFLOW-P2-001: Added durable workflow graph validation and persisted execution for condition, transform, parallel, wait, approval, retry, timeout, compensation, cancellation, and stale-claim handling.
- MODULE-APP-WORKFLOW-P2-002: Added QStash dispatch, strict five-field schedules with server-side timezone calculation, QStash-signed internal delivery, HMAC external webhooks, replay-window validation, and durable delivery deduplication/reclaim.
- MODULE-APP-TEAM-P2-001: Changed user run and artifact history to active `installationId` scope with bounded opaque cursors. Every team request rechecks current workspace membership, and artifact history requires a run from the same installation.
- MODULE-APP-TEAM-P2-002: Added authorized persisted workflow run/node queries, explicit cancellation, and SWR progress polling. Navigation and component unmount do not cancel durable runs; polling stops only after a terminal state.
- Data modes: legacy JSON collections remain available through `module_app_records`; reviewed applications can use platform-managed logical tables through `module_app_data_schemas` and `module_app_data_rows`.
- External services and deployment: workflow dispatch reuses existing Upstash QStash configuration. No new Docker volume or production runtime service is enabled. Uploaded Module App execution remains disabled by default.

### Module App Executable Build Foundation

- MODULE-APP-RUNTIME-P1-001: Added strict manifest v2 `module-app.yaml` contracts for fixed `node22-static` and `python312-assets` build profiles while preserving legacy manifest v1 JSON packages and rejecting mixed manifest formats or custom images.
- MODULE-APP-RUNTIME-P1-002: Added migration `0136_add_module_app_build_runtime.sql`, immutable build records, installation secret persistence for encrypted values, runtime artifact snapshots, atomic build claims, and immutable completion transitions.
- MODULE-APP-RUNTIME-P1-003: Executable package approval now remains draft and creates its queued build in the same database transaction. Admin package review shows queued/building/failed/ready state and audit metadata includes the build identity.
- MODULE-APP-RUNTIME-P1-004: Added build-worker storage orchestration using the existing S3-compatible storage configuration. Workers receive short-lived reviewed-source downloads and build-scoped staging uploads; the server verifies artifact key, size, and SHA-256 before promoting bytes to a content-addressed final key.
- MODULE-APP-RUNTIME-P1-005: Added a database-level publication gate so manifest v2 applications cannot publish until the matching version has a ready build and identical runtime artifact snapshot. The admin API returns `PRECONDITION_FAILED` without writing a success audit when the gate blocks publication.
- MODULE-APP-RUNTIME-P1-006: Added `@lobechat/module-app-sdk` with a versioned request/response/event bridge that requires exact runtime origin, parent-window source, launch nonce, channel, and request identity. Added RS256 runtime capabilities with a maximum five-minute TTL, installation/user/version/workspace scope checks, and permission checks using the existing deployment `JWKS_KEY`.
- MODULE-APP-RUNTIME-P1-007: Added the controlled Module App capability gateway for context, private installation-scoped file URLs, reviewed-host HTTP, user-targeted notifications, and encrypted installation secrets. Gateway calls re-check the current plan's runnable entitlement, active published installation ownership, and current workspace membership; apply method permissions and request replay protection; bound HTTP responses; and never return secret plaintext to browser capabilities.
- MODULE-APP-RUNTIME-P1-008: Added the private Module App runtime service contract and main-server client. Invocations accept only strict immutable-artifact requests for fixed `node22` or `python312` profiles, require an internal bearer token and runtime-surface RS256 capability, bound input/stdout/stderr, terminate process groups on timeout, reject developer-selected images or commands, and use portable file-URL entry detection for Linux container startup.
- MODULE-APP-RUNTIME-P1-009: Added content-addressed immutable static asset serving, `moduleApp.getLaunchContext`, active installation/build lookup, plan and workspace revalidation, five-minute browser capabilities, SDK `waitForModuleAppLaunch`, and the main-site sandbox shell with redacted SDK relay plus explicit loading/denied/build/runtime/error/retry states.
- MODULE-APP-RUNTIME-P1-010: Bound runtime-surface capabilities to the immutable `artifactSha256` and made the runtime endpoint reject any invocation whose requested artifact differs from the signed claim.
- Configuration and deployment: the runtime contract introduces `MODULE_APP_EXECUTION_ENABLED`, `MODULE_APP_RUNTIME_PUBLIC_ORIGIN`, `MODULE_APP_RUNTIME_INTERNAL_URL`, `MODULE_APP_RUNTIME_INTERNAL_TOKEN`, and `MODULE_APP_RUNTIME_JWKS`. Fixed non-root Node.js and Python Dockerfiles are present, but no production compose service, network policy, or artifact bind mount is enabled.
- Runtime boundary: uploaded executable code remains disabled by default. The iframe omits `allow-same-origin`; its opaque-origin handshake validates exact window source, channel, server nonce, launch state, and server-issued URL before relaying capabilities. Production enablement remains blocked until Phase 5 namespace/seccomp/network/artifact-mount and browser E2E probes pass.
- Launch verification: 152 focused root/types/SDK/business-server tests and 13 pure database package tests passed; full `bun run type-check` and targeted ESLint passed. PostgreSQL integration suites remain environment-blocked when `DATABASE_TEST_URL` is absent.
- Verification: manifest/archive/type tests, build schema/model/approval/storage/service tests, admin router/UI tests, full `bun run type-check`, targeted lint, and `git diff --check`.

### Module App Package Risk Controls

- MODULE-APP-PACKAGE-P0-001: Added additive `module_app_package_uploads` persistence with upload/scan state, per-user open-session, rolling daily, and retained-storage quotas, atomic claims, and clean-scan approval enforcement.
- MODULE-APP-PACKAGE-P0-002: Added ZIP central-directory validation and bounded static scanning for ZIP64/malformed metadata, symlinks, encrypted entries, nested archives, command/native binaries, executable signatures, WebAssembly, and EICAR content.
- MODULE-APP-PACKAGE-P0-003: Moved pre-signing and submission into a durable ingestion service with user-scoped keys, actual-size checks, stable errors, storage compensation, and client feedback for quota, expiry, size, and security failures.
- MODULE-APP-PACKAGE-P0-004: Added explicit administrator legacy rescan, archive hash integrity checks, scan-state display, clean-only approval, rejection cleanup, and response allowlists that omit storage keys, hashes, upload ids, and scan internals. Unsafe legacy keys can be rejected but are never deleted; the cleanup skip is audited.
- MODULE-APP-PACKAGE-P0-005: Added bounded maintenance cleanup with `FOR UPDATE SKIP LOCKED`, a retry lease, idempotent missing-object handling, existing cron/manual maintenance integration, and cleanup result counts.
- Boundary: Packages remain review-only and non-executable. No iframe, remote module, server container, queue, environment variable, Docker volume, or external antivirus service was added.
- Deferred: package signing/provenance, external antivirus, executable package runtime, immutable upgrades/rollback, uninstall storage lifecycle, installed-app pagination, and browser E2E.
- Verification: focused type/schema/database/scanner/ingestion/lifecycle/router/service/UI/maintenance suites, `bun run type-check`, targeted ESLint, locale JSON parsing, and `git diff --check`.

## 2026-07-10

### Module App Platform Unification

- MODULE-APP-UNIFY-P0-001: Deprecated Platform Plugin Marketplace as a product track and redirected new extensibility work to Module App Platform.
- MODULE-APP-UNIFY-P1-001: Added Module App source ownership for `system`, `admin`, `user`, and `developer` app sources across type contracts, database schema, migrations, model list/detail responses, admin forms, and package approval.
- MODULE-APP-UNIFY-P1-002: Added the admin Module App package review queue tab with pending package listing, source/status display, and approve/reject actions.
- MODULE-APP-UNIFY-P2-001: Added Module App-owned API/content runtime parity with safe URL checks, redacted snapshots, artifacts, failed run records, and audit events.
- MODULE-APP-UNIFY-P3-001: Removed live Platform Plugin Marketplace code, user/admin routes, chat mention entry, service wrappers, routers, type/schema/model exports, seed script, and locale keys. Added `0134_drop_platform_plugin_tables.sql` to decommission `platform_plugin_*` tables by migration.
- MODULE-APP-P3-UPLOAD-001: Added a user-scoped Module App ZIP upload target, server-side OSS retrieval, bounded ZIP expansion, server-derived archive/file hashes, root `manifest.json` parsing, and trusted pending-review submission creation.
- MODULE-APP-P3-UPLOAD-002: Added the package submission control to `/apps/my`; the client uploads only to the server-issued object key and then asks the server to parse and submit the stored archive.
- MODULE-APP-P3-UPLOAD-003: Deletes the uploaded OSS/S3 object when the validated package cannot be persisted, preventing database-write failures from leaving permanent orphan archives.
- MODULE-APP-P3-MY-APPS-001: Added the `/apps/my` overview for installed Module Apps and the current user's package submissions, with independent loading, empty, error, and review-status states.
- MODULE-APP-P3-MY-APPS-002: Added `lambda.moduleApp.listMyPackageSubmissions` with mandatory user ownership filtering, bounded cursor pagination, optional review-status filtering, and an explicit public response allowlist.
- MODULE-APP-P3-MY-APPS-003: Refreshes the current user's submission list after a successful ZIP submission without duplicating the uploader surface.
- MODULE-APP-P3-MY-APPS-004: Hardened public package serialization so malformed or legacy JSONB package rows are skipped without failing the current user's full submission list.
- MODULE-APP-P3-I18N-001: Moved Module App market, package upload, installed-app, submission, and review-status copy into the common locale namespace with maintained English and Simplified Chinese resources.
- Boundary: MCP, Skills, and upstream discover/community plugin features remain unchanged and separate from Module App Platform. Production must have a fresh database backup before applying the table-drop migration.
- Upload boundary: Uploaded package code is not executed. This slice adds no container runtime, iframe, remote module loading, new database table, new environment variable, or Docker volume.

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
- MODULE-APP-P1-006: Added the admin `admin.moduleApps` router for listing, detail reads, upsert, publish/unpublish, pages/actions/billing/entitlement updates, installs, records, runs, artifacts, and audit-event reads. Admin write operations now emit module app audit logs.
- MODULE-APP-P1-007: Added typed client service wrappers for user `lambda.moduleApp` calls and admin `adminCommercialService.moduleApps` calls.
- MODULE-APP-P1-008: Added the user Module App route shell at `/apps`, `/apps/my`, `/apps/team`, `/apps/:appId`, `/apps/:appId/app`, and `/apps/:appId/app/:pageKey`, with matching web/Electron desktop router registration and navigation locale keys.
- Verification: `packages/types/src/moduleApp.test.ts`, `packages/database/src/schemas/moduleApp.schema.test.ts`, `packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`, `packages/business-server/src/module-apps/permission.test.ts`, `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`, `apps/server/src/routers/lambda/moduleApp.test.ts`, `src/services/moduleApp.test.ts`, `src/services/adminCommercial.test.ts`, `src/features/ModuleAppRuntime/runtimeHelpers.test.ts`, `src/spa/router/desktopRouter.sync.test.tsx`, `bun run type-check`, and `git diff --check`.

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

### Module App Platform P1

- MODULE-APP-P1-009: Added the admin Module Apps page shell, admin navigation entry, business desktop route registry segment, and `/settings/admin/module-apps` compatibility mapping.
- Verification: `src/features/Admin/moduleApps/formSchema.test.ts`, `src/features/Admin/adminNavigation.test.ts`, `src/business/client/BusinessDesktopRoutes.test.ts`, and `src/routes/(main)/settings/admin/index.test.tsx`.
- MODULE-APP-P1-010: Added the free standard-app record action runtime for `record_create`, `record_update`, and `record_archive`, and delegated `lambda.moduleApp.runAction` through the runtime instead of only creating a run row.
- Verification: `packages/business-server/src/module-apps/runModuleAppAction.test.ts` and `apps/server/src/routers/lambda/moduleApp.test.ts`.
- MODULE-APP-P1-011: Added Module App API URL safety checks and billable runtime snapshot support for injected `api_action`, `content_generation`, and `workflow_step` runners without enabling arbitrary frontend JS, iframe, MCP, or Skills execution.
- Verification: `packages/business-server/src/module-apps/safeUrl.test.ts` and `packages/business-server/src/module-apps/runModuleAppAction.test.ts`.
- MODULE-APP-P1-012: Added run preview formatting plus lightweight user run-result and admin records/runs/artifacts display shells for the Module App P1 surface.
- Verification: `src/features/ModuleAppRuntime/runtimeHelpers.test.ts`.
- MODULE-APP-P1-013: Added the package review foundation for Module App Platform packages, including package manifest/runtime contracts, pure package validation, `module_app_packages`, model submission/approval/rejection lifecycle, user submit API, admin review APIs, and client service wrappers.
- Boundaries: this slice does not unzip archives, add upload UI, execute uploaded code, run frontend JS, use iframe/remote modules, create Docker/server containers, or import MCP/Skills/Platform Plugin behavior.
- Verification: `packages/types/src/moduleApp.test.ts`, `packages/business-server/src/module-apps/packageManifest.test.ts`, `packages/database/src/schemas/moduleApp.schema.test.ts`, `packages/database/src/models/moduleApp.package.test.ts`, `apps/server/src/routers/lambda/moduleApp.test.ts`, `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`, `src/services/moduleApp.test.ts`, and `src/services/adminCommercial.test.ts`.

### Module App Platform P2-A Admin Editor

- Added the admin editor foundation for `/admin/module-apps`, including metadata authoring, page/action/entitlement/billing editors, publish controls, and operational inspection tabs.
- Added read-only admin installs, records, runs, artifacts, and audit table coverage for the selected module app.
- Preserved isolation from Platform Plugin Marketplace, MCP, and Skills; P2-A does not execute arbitrary frontend code, use iframe/remote modules, or post real credit ledger transactions.
- Verification: `src/features/Admin/moduleApps/formSchema.test.ts`, `src/features/Admin/moduleApps/editors.test.tsx`, `src/features/Admin/moduleApps/AppEditorModal.test.tsx`, `src/features/Admin/moduleApps/tables.test.tsx`, `src/services/adminCommercial.test.ts`, and `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`.

### Module App Commerce Task 6

- Added an append-only developer revenue ledger with exact platform fee, refundable reserve, developer pending amount, reversal, delayed settlement, and per-order/type idempotency protection in migration `0139`.
- Made manual order settlement and refund atomic with license/subscription changes, revenue accrual/reversal, and finance audit events. A revenue failure now rolls the whole order transition back.
- Added bounded revenue listing and audited batch settlement under existing `auditRead` and `financeWrite` capability boundaries.
- Added the admin Commerce table for filtering revenue, inspecting gross/platform/reserve/developer amounts, and settling only selected pending accrual entries.
- Updated the Module App billing editor to reflect the shared runtime credit ledger and the separate product revenue ledger; module multipliers remain bounded to `0..100`.
- Revenue is derived only from immutable product order snapshots. AI, runtime, storage, and network costs are not included in developer share. Publisher identity temporarily resolves from the latest approved package submitter.
- Deployment impact: apply migrations `0138` then `0139` before enabling the new admin APIs. No new environment variables or Docker volume changes are required. Production Module App execution remains disabled.
- Verification: `packages/business-server/src/module-apps/revenue.test.ts`, `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`, `src/features/Admin/moduleApps/CommerceTable.test.tsx`, `src/features/Admin/moduleApps/editors.test.tsx`, `src/features/Admin/moduleApps/packageReview.test.tsx`, TypeScript `tsgo --noEmit`, target ESLint, and `git diff --check`.
