/**
 * ComHub customization registry — the single source of truth for every way the
 * ComHub fork deviates from upstream LobeHub.
 *
 * Consumed by:
 * - scripts/comhub-customizations/verify.mjs (PR gate: every changed upstream
 *   file must belong to a registered module)
 * - scripts/comhub-customizations/report.mjs (regenerates
 *   docs/development/comhub-customization-registry.md)
 * - scripts/comhub-upstream-sync/run.mjs (touches report grouped by module)
 *
 * File matching rules (first match wins, evaluated top to bottom per module):
 * - "p:<prefix>"  path starts with the prefix (directory or file path)
 * - "<regex>"     otherwise treated as a regular expression
 *
 * Ownership semantics (relative to the upstream baseline tag):
 * - "owned"    file is new in ComHub (fork-created; upstream cannot delete it)
 * - "upstream" file exists upstream and ComHub modified it (merge-conflict
 *              surface; every change here must be re-verified after syncs)
 *
 * Sync strategies:
 * - re-apply      after an upstream merge, re-check each file and re-apply the
 *                 ComHub change if upstream rewrote it
 * - merge         normal git merge expected to preserve the change
 * - verify-only   no code to re-apply, but verify the invariant after a merge
 * - annotate-only pure documentation; never conflicts
 *
 * BASELINE: upstream tag `v2.2.19` (commit 234e0fc75). Advance via the
 * upstream-sync flow — never by hand — or verify.mjs loses meaning.
 */

const MODULES = [
  {
    id: 'database-migrations',
    name: 'Migration chain',
    sync: 'verify-only',
    description:
      'ComHub-owned migrations (0100-0122 commercial, 0168-0177) + repair 0178. Upstream renumbering: upstream 0111 rewritten in place as fork 0129 (carry-forward header comment); upstream 0112-0126 renumbered verbatim to 0153-0167 (blobs identical to upstream one-for-one); upstream 0110 keeps its original name. v2.2.19 wave: upstream 0167-0175 renumbered verbatim to fork 0179-0187 (+12 offset because the upstream tail collides with the fork-owned 0167_agent_quota_workspace_identity) — SQL blobs byte-identical to upstream, and _journal.json appends the 9 entries (idx 182-190) after the ComHub tail with only idx shifted (version/when/breakpoints verbatim).',
    ownershipRules: [
      [
        'p:packages/database/migrations/meta/',
        'upstream',
        '_journal.json + snapshots (incl. 0179-0187 snapshots of the v2.2.19 wave)',
      ],
      ['p:packages/database/migrations/', 'owned', 'ComHub SQL files'],
      ['p:scripts/verifyMigrationChain.mjs', 'owned', 'static chain check'],
      [
        'p:packages/database/src/models/__tests__/migrationChain.test.ts',
        'owned',
        'migration chain invariant test',
      ],
    ],
    tests: ['packages/database/src/models/__tests__/migrationChain.test.ts'],
    notes:
      'Never reorder/renumber deployed migrations. New upstream migrations append after the ComHub tail. 0178 replays skipped 0127-0148 guarded by created_at checks. CI: pnpm verify:database-migrations. 23 orphan original SQL files remain on disk unreferenced by _journal.json (upstream originals of 0104-0109 and 0111-0126, plus 0065_add_document_fields which is upstream-inherent); scripts/verifyMigrationChain.mjs does not detect orphans — when upstream later modifies a renumbered file the merge lands on the orphan copy and must be remapped by hand. v2.2.19 wave (upstream 0167-0175 → fork 0179-0187) left NO orphan originals on disk: the merge deleted the upstream-named copies when re-adding them under 0179-0187. The upstream journal tail is now idx 175 (tag 0175_environment_visibility_and_build_state) — the next upstream wave appends after fork 0187 with the same verbatim + idx-shift-only treatment.',
  },
  {
    id: 'branding',
    name: 'Brand embed (XuanguoAI)',
    sync: 're-apply',
    description:
      'XuanguoAI brand across web + desktop: static assets, runtime brand seam (app_settings → getServerBrand → BrandProvider), upstream component hooks.',
    ownershipRules: [
      // precise upstream rules first: these upstream asset files are fork-rebranded (M in diff)
      ['p:public/favicon.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-dev.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-done.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-error.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-progress.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-32x32.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-32x32-dev.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-32x32-done.ico', 'upstream', 'branded favicon'],
      ['p:public/favicon-32x32-progress.ico', 'upstream', 'branded favicon'],
      ['p:public/apple-touch-icon.png', 'upstream', 'branded touch icon'],
      ['p:public/app-icons/icon-192x192.png', 'upstream', 'branded app icon'],
      ['p:public/app-icons/icon-192x192.maskable.png', 'upstream', 'branded app icon'],
      ['p:public/app-icons/icon-512x512.png', 'upstream', 'branded app icon'],
      ['p:public/app-icons/icon-512x512.maskable.png', 'upstream', 'branded app icon'],
      ['p:apps/desktop/build/icon.ico', 'upstream', 'branded installer icon'],
      ['p:apps/desktop/build/icon.png', 'upstream', 'branded installer icon'],
      ['p:apps/desktop/build/nsis-header.bmp', 'upstream', 'branded NSIS header'],
      ['p:apps/desktop/build/nsis-sidebar.bmp', 'upstream', 'branded NSIS sidebar'],
      ['p:apps/desktop/resources/dmg.png', 'upstream', 'branded dmg background'],
      ['p:apps/desktop/resources/error.html', 'upstream', 'branded error page'],
      ['p:apps/desktop/resources/splash.html', 'upstream', 'branded splash page'],
      ['p:apps/desktop/resources/tray.png', 'upstream', 'branded tray icon'],
      ['p:apps/desktop/resources/trayTemplate.png', 'upstream', 'branded tray icon'],
      ['p:apps/desktop/resources/trayTemplate@2x.png', 'upstream', 'branded tray icon'],
      ['p:public/', 'owned', 'fork-new favicons, app icons, in-site brand logo'],
      ['p:apps/desktop/build/', 'owned', 'fork-new installer icon.ico/png + NSIS artwork'],
      ['p:apps/desktop/resources/', 'owned', 'fork-new tray, dmg, splash, error page art'],
      [
        'p:apps/desktop/src/main/core/browser/splash.ts',
        'owned',
        'fork-created branded splash content (A in diff; test in desktop-main-patches)',
      ],
      ['p:src/const/brand.ts', 'owned', 'DEFAULT_RUNTIME_BRAND (玄果AI / #12b981)'],
      ['p:src/features/Brand/', 'owned', 'BrandProvider, brandText, loadingBrand, useBrandName'],
      ['p:src/server/services/brand/', 'owned', 'getServerBrand (30s TTL, app_settings)'],
      ['p:src/server/metadata.ts', 'owned', 'APP_URL metadataBase (also serves SPA HTML)'],
      ['p:packages/const/src/defaultAgent.ts', 'owned', 'DEFAULT_COMHUB_AGENT_NAME const'],
      [
        'p:src/components/Branding/',
        'upstream',
        'ProductLogo runtime-brand hook; Custom.tsx simplification; conservative over-cover: also claims fork-new files (ProductLogo index.test.tsx)',
      ],
      ['p:src/components/BrandWatermark/', 'upstream', 'useBrand() attribution branch'],
      [
        'p:src/components/Loading/',
        'upstream',
        'BrandTextLoading brand text + spinner; conservative over-cover: also claims fork-new files (BrandTextLoading index.test.tsx)',
      ],
      [
        'p:src/app/[variants]/metadata.ts',
        'upstream',
        'server brand in metadata, server translation',
      ],
      ['p:src/app/manifest.ts', 'upstream', 'runtime brand in PWA manifest'],
      ['p:src/app/[variants]/metadata.test.ts', 'owned', 'metadata brand tests'],
      ['p:src/app/manifest.test.ts', 'owned', 'manifest brand tests'],
      ['p:src/app/sitemap', 'owned', 'sitemap route + tests'],
      ['p:src/layout/GlobalProvider/FaviconProvider.tsx', 'upstream', 'brand.faviconUrl override'],
      ['p:src/libs/metadata/', 'upstream', 'siteName parameter for title suffix'],
      [
        'p:packages/business/const/src/index.ts',
        'upstream',
        'ENABLE_BUSINESS_FEATURES=true fork flip',
      ],
    ],
    tests: [
      'src/features/Brand/BrandProvider.test.tsx',
      'src/features/Brand/brandText.test.ts',
      'src/features/Brand/loadingBrand.test.ts',
      'src/server/services/brand/__tests__/',
    ],
    notes:
      'NEVER edit packages/business/const/src/branding.ts (commercial license header). Brand flows only through the runtime seam. Upstream syncs re-break ProductLogo/FaviconProvider/metadata first — re-check those files.',
  },
  {
    id: 'desktop-deep-links',
    name: 'Desktop deep-link scheme (comhub://)',
    sync: 're-apply',
    description:
      'comhub:// protocol scheme detection + whitelist extension in the desktop main process.',
    ownershipRules: [
      [
        'p:apps/desktop/src/main/utils/comhubProtocol.ts',
        'owned',
        'extracted: comhub:// scheme 探测与白名单',
      ],
      [
        'p:apps/desktop/src/main/utils/',
        'upstream',
        'protocol.ts scheme probe + VALID_PROTOCOL_PREFIXES',
      ],
    ],
    tests: ['apps/desktop/src/main/utils/__tests__/protocol.test.ts'],
    notes:
      'Merge both scheme lists if upstream adds channel schemes. The whitelist gates MCP/skill install deep links in the branded build.',
  },
  {
    id: 'desktop-main-patches',
    name: 'Desktop main process patches',
    sync: 're-apply',
    description:
      'Electron main-process behavior: OFFICIAL_CLOUD_SERVER default, updater remote config, gateway/webview partitions, splash, Browser subscription partition, ComHub feature UI.',
    ownershipRules: [
      [
        'p:apps/desktop/electron-builder.mjs',
        'upstream',
        'loadDesktopBuildProfile + applyDesktopBuildProfile integration',
      ],
      [
        'p:apps/desktop/vite.renderer.config.ts',
        'upstream',
        'cloudDesktopBusinessConstPlugin + dev minify',
      ],
      [
        'p:apps/desktop/src/main/const/comhubServer.ts',
        'owned',
        'fork-new: OFFICIAL_CLOUD_SERVER default const',
      ],
      [
        'p:apps/desktop/src/main/core/browser/__tests__/splash.test.ts',
        'owned',
        'fork-new: branded splash tests',
      ],
      ['p:apps/desktop/src/main/env.test.ts', 'owned', 'fork-new: env tests'],
      [
        'p:apps/desktop/src/main/modules/updater/remoteConfig.ts',
        'owned',
        'extracted: updater remote config module',
      ],
      [
        'p:apps/desktop/src/main/modules/updater/__tests__/remoteConfig.test.ts',
        'owned',
        'remoteConfig tests',
      ],
      [
        'p:apps/desktop/src/main/',
        'upstream',
        'env.ts, updater, Browser, controllers, protocol.ts (see desktop-deep-links)',
      ],
      ['p:apps/desktop/src/', 'owned', 'remoteConfig module, tests, feature components'],
      ['p:apps/desktop/scripts/update-test/', 'upstream', 'file-mode only changes'],
      ['p:apps/desktop/scripts/', 'owned', 'update-test scripts, tray generator'],
      ['p:src/features/Electron/titlebar/SimpleTitleBar.tsx', 'upstream', 'title prop'],
      ['p:src/features/Electron/', 'owned', 'connection mode UI'],
      ['p:src/store/electron/', 'upstream', 'sync actions'],
      ['p:src/services/electron/', 'upstream', 'remoteServer service'],
    ],
    tests: [
      'apps/desktop/src/main/modules/updater/__tests__/',
      'apps/desktop/src/main/core/infrastructure/__tests__/',
      'apps/desktop/src/main/core/browser/__tests__/',
      'apps/desktop/src/main/controllers/__tests__/',
    ],
    notes:
      'Upstream owns the whole Electron shell and actively evolves it (asar split, OTA packs). semantic conflicts likely — verify updater/protocol/Browser after every merge.',
  },
  {
    id: 'desktop-build-profile',
    name: 'Desktop build profile pipeline',
    sync: 'verify-only',
    description:
      'Runtime installer branding: admin-authored profile → DB revisions → CI staging → electron-builder overrides (appId, icons, NSIS, protocol schemes).',
    ownershipRules: [
      ['p:apps/desktop/desktop-build-profile', 'owned', 'loader/validator + tests'],
      ['p:scripts/electronWorkflow/fetchDesktopBuildProfile.ts', 'owned', 'CI profile staging'],
      [
        'p:packages/database/src/models/desktopBuild',
        'owned',
        'profile/revision/release state machine',
      ],
      ['p:packages/database/src/schemas/desktopBuild', 'owned', 'schema + schema test'],
      ['p:packages/types/src/desktopBuild.ts', 'owned', 'types'],
      ['p:src/features/Admin/DesktopControlCenter/', 'owned', 'admin UI'],
    ],
    tests: [
      'apps/desktop/desktop-build-profile.test.ts',
      'packages/database/src/models/desktopBuild.test.ts',
      'src/features/Admin/DesktopControlCenter/',
    ],
    notes:
      'Frozen revisions are append-only. Prod profile id 5f1e2d34-c9a8-4b7e-9d10-2a6f8c1b3d77 (ComHub Brand Profile).',
  },
  {
    id: 'desktop-release-pipeline',
    name: 'Desktop release pipeline',
    sync: 're-apply',
    description:
      'GH desktop release workflow, release callback API, GitHub release health service, update-test scripts, publish actions.',
    ownershipRules: [
      ['p:.github/workflows/comhub-desktop-release.yml', 'owned', 'release workflow'],
      ['p:.github/actions/desktop-publish-s3/', 'upstream', 'OTA publish action + mainhash inputs'],
      [
        'p:.github/actions/desktop-upload-artifacts/',
        'upstream',
        'artifact upload incl. renderer mainhash',
      ],
      ['p:src/app/(backend)/api/admin/desktop-release/', 'owned', 'callback + profile API routes'],
      ['p:src/app/(backend)/api/admin/maintenance/', 'owned', 'admin maintenance route'],
      ['p:src/app/(backend)/api/webhooks/', 'owned', 'payment/module-app webhook routes'],
      ['p:src/app/(backend)/api/workflows/', 'owned', 'module-app run workflow route'],
      [
        'p:apps/server/src/services/desktopRelease/index.ts',
        'upstream',
        'upstream resolvers rewritten as delegation into fork helpers (+45/-99)',
      ],
      [
        'p:apps/server/src/services/desktopRelease/index.test.ts',
        'upstream',
        'index tests updated for the delegation split (+247/-3)',
      ],
      [
        'p:apps/server/src/services/desktopRelease/',
        'owned',
        'diagnostics.ts (SSRF/zod/timeout/channel health), downloadTypes.ts (matchers), github.ts health',
      ],
      [
        'p:scripts/electronWorkflow/',
        'upstream',
        'setDesktopVersion + remaining scripts; conservative over-cover: also claims fork-new files (desktopReleaseWorkflow/fetchDesktopBuildProfile/setDesktopVersion tests)',
      ],
    ],
    tests: ['apps/server/src/services/desktopRelease/index.test.ts'],
    notes:
      'Release callbacks require status + profileRevisionId + workflow metadata; publication needs downloadUrl + serverUrl. stage_profile uses direct node tsx (pnpm v12 ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR).',
  },
  {
    id: 'db-pool-guardrails',
    name: 'PostgreSQL pool guardrails',
    sync: 're-apply',
    description: 'DATABASE_POOL_* / statement & idle-in-transaction timeouts for Node pg pools.',
    ownershipRules: [
      ['p:packages/database/src/core/web-server.test.ts', 'owned', 'fork 新增测试'],
      ['p:packages/database/src/core/', 'upstream', 'web-server.ts guardrails'],
      ['p:packages/app-config/src/db.ts', 'upstream', 'env schema entries'],
    ],
    tests: [],
    notes: 'Tuning knobs surface as DATABASE_* env vars; production pool sizing depends on them.',
  },
  {
    id: 'commercial-billing',
    name: 'Commercial billing closure',
    sync: 'merge',
    description:
      'Credit ledger, workspace/personal payer resolution, image/video pre/post charge, model pricing, plan model rules, OpenAPI operation ids. Hooks ride the upstream ModelRuntimeHooks architecture.',
    plannedExtraction: true,
    ownershipRules: [
      [
        'p:packages/model-runtime/src/core/openaiCompatibleFactory/openaiVideoV2Task.ts',
        'owned',
        'extracted: OpenAI V2 video-task fallback (types, createVideoError, base-URL normalization, v2 status query + parse)',
      ],
      [
        'p:packages/model-runtime/src/core/openaiCompatibleFactory/structuredJson.ts',
        'owned',
        'extracted: structured-output JSON parsing with markdown-fence stripping (parseStructuredJson)',
      ],
      [
        'p:packages/model-runtime/',
        'upstream',
        'lifecycle hooks (ASR/embeddings/generateObject), image/video adapters, currency-aware computeImageCost, ollama/google fixes; conservative over-cover: also claims fork-new files (asyncImageTask, imageAdapter, imageRoute, deepseek tests)',
      ],
      [
        'p:packages/model-bank/',
        'upstream',
        'newapi provider card, siliconcloud/volcengine catalog, module-app export; fork 实际改动 = 新增 "./lobehub" export（无 observability dep）; conservative over-cover: also claims fork-new files (aiModels/lobehub)',
      ],
      [
        'p:packages/business-server/src/commercialModelRuntimeHooks.ts',
        'owned',
        'extracted: commercial model-runtime hooks (policy/plan asserts, reservation release/settle lifecycle, pricing-quote metadata passthrough)',
      ],
      [
        'p:packages/business-server/src/model-runtime.ts',
        'upstream',
        'delegates getBusinessModelRuntimeHooks to commercialModelRuntimeHooks.ts (hookExtracted)',
      ],
      [
        'p:packages/business-server/src/commercialBilling',
        'owned',
        'fork-new billing core: credit ledger + settlement (incl. co-located tests)',
      ],
      [
        'p:packages/business-server/src/generationBilling',
        'owned',
        'fork-new billing core: generation charge lifecycle (incl. co-located tests)',
      ],
      [
        'p:packages/business-server/src/serverModelPricing',
        'owned',
        'fork-new billing core: server model pricing (incl. co-located tests)',
      ],
      [
        'p:packages/business-server/src/planModelRules',
        'owned',
        'fork-new billing core: plan model rules (incl. co-located tests)',
      ],
      [
        'p:packages/business-server/src/resourceQuota',
        'owned',
        'fork-new billing core: resource quota (incl. co-located tests)',
      ],
      [
        'p:packages/business-server/src/modelPolicy',
        'owned',
        'fork-new billing core: model policy (incl. co-located tests)',
      ],
      [
        'p:packages/business-server/src/appSettings/writers/adminProcedures.ts',
        'owned',
        'fork-new: admin app_settings write procedures (per-section CAS revisions, assertSettingsWriteAccess single-key + batch call sites) — admin console service surface maintained for the admin-console redesign (parity 方案 A main battlefield)',
      ],
      [
        'p:packages/business-server/src/appSettings/moduleRuntimeValidation.ts',
        'owned',
        'fork-new: admin moduleApps runtime setting-key validation (runtimeSettingKeys) — admin console service surface maintained for the admin-console redesign',
      ],
      [
        'p:packages/business-server/src/appSettings/definitions/',
        'owned',
        'fork-new: appSettings definition face (metadata, valueDefinitions, runtimeConsumers key-evidence + sourcePath contracts) — admin console service surface maintained for the admin-console redesign',
      ],
      [
        'p:packages/business-server/src/',
        'upstream',
        'model-runtime.ts, image/video-generation charge helpers, lambda routers (accountDeletion/file/referral/spend/subscription), user.ts, trpc-middlewares; conservative over-cover: also claims fork-new files (appSettings/ residual — writers/adminProcedures.ts + moduleRuntimeValidation.ts + definitions/ precisely claimed above; lambda-routers/admin/, module-apps/, adminImpact/, desktopBuild/, subscriptionMaintenance, adminNewapiPricing, __tests__)',
      ],
      [
        'p:packages/business/',
        'upstream',
        'const index ENABLE_BUSINESS_FEATURES (see branding); business/model-runtime, business/model-bank',
      ],
      ['p:packages/const/src/currency.ts', 'upstream', 'USD_TO_CNY + credit helpers'],
      ['p:packages/const/src/fetch.ts', 'upstream', 'request id headers'],
      ['p:packages/types/src/usage/', 'upstream', 'usage record types'],
      ['p:packages/trpc/src/client/', 'upstream', 'lambda/async client surface'],
      [
        'p:src/server/services/newapiInstance/',
        'owned',
        'instance registry: resolver + round-robin, catalog, credentials, pricing',
      ],
      [
        'p:apps/server/src/modules/ModelRuntime/',
        'upstream',
        'initModelRuntimeFromDB + newapi route metadata; conservative over-cover: also claims fork-new files (newapiRouting)',
      ],
      [
        'p:apps/server/src/services/generation/videoPollingBilling.ts',
        'owned',
        'extracted: video background-polling billing settle/release wrappers around chargeAfterGenerate',
      ],
      [
        'p:apps/server/src/services/generation/',
        'upstream',
        'videoBackgroundPolling delegates billing settle/release to videoPollingBilling.ts (hookExtracted); model-mapping runtime init remains',
      ],
      [
        'p:apps/server/src/router-hono/webhooks/',
        'upstream',
        'video webhook route metadata; conservative over-cover: also claims fork-new files (handlers __tests__/video.test.ts)',
      ],
      [
        'p:apps/server/src/routers/async/',
        'upstream',
        'image/video/file async routers; conservative over-cover: also claims fork-new files (newapiRouting.test.ts)',
      ],
      [
        'p:apps/server/src/routers/lambda/generationBillingGuard.ts',
        'owned',
        'extracted: shared generation billing guard (policy/plan asserts, newapi route metadata, record-creation transactions, reservation release/reconcile)',
      ],
      [
        'p:apps/server/src/routers/lambda/image',
        'upstream',
        'delegates gates + record transaction + reservation release to generationBillingGuard.ts (hookExtracted); per-task compensation call sites remain',
      ],
      [
        'p:apps/server/src/routers/lambda/video',
        'upstream',
        'delegates gates + record transaction + reservation release to generationBillingGuard.ts (hookExtracted)',
      ],
      [
        'p:src/app/(backend)/webapi/',
        'upstream',
        'chat route metadata headers, pricing route, lobehub-model-ratings; conservative over-cover: also claims fork-new files (lobehub-model-config, lobehub-model-ratings, proxy routes)',
      ],
      [
        'p:src/business/client/BusinessSettingPages/',
        'upstream',
        'billing/credits/plans/usage/referral pages; conservative over-cover: also claims fork-new files (mobile pages, ledger/plan/referral display, planPurchase)',
      ],
      [
        'p:src/business/client/',
        'upstream',
        'business hooks (pricing/rating/guard/signup), model catalog merge; conservative over-cover: also claims fork-new files (adminSettingsRouteRegistry, commercialRefresh, modelCatalog/lobeHub, moduleAdminRouteImports)',
      ],
      ['p:src/services/chat/', 'upstream', 'request metadata pass-through'],
      ['p:src/features/Settings/stats/', 'upstream', 'UsageTable ledger-aware columns'],
      [
        'p:src/features/ModelSwitchPanel/components/List/ModelPriceSummary',
        'owned',
        'price display in model switcher',
      ],
      ['p:src/features/TopUp/', 'owned', 'top-up flow'],
      ['p:src/features/Payments/', 'owned', 'payment flows'],
      ['p:packages/database/src/models/commercial', 'owned', 'commercial models'],
      ['p:packages/database/src/schemas/commercial.ts', 'owned', 'commercial schema'],
      [
        'p:packages/database/src/schemas/index.ts',
        'upstream',
        're-exports commercial/desktopBuild/moduleApp/newapiInstance',
      ],
      [
        'p:packages/database/src/repositories/aiInfra/managedProviders.ts',
        'owned',
        'extracted: admin-managed provider list assembly (business enabled gating, virtual parentProviderId providers, mergeArrayById composition)',
      ],
      [
        'p:packages/database/src/repositories/aiInfra/index.ts',
        'upstream',
        'delegates getAiProviderList assembly to managedProviders.ts (hookExtracted); keeps BRANDING filters + parameters/pricing override',
      ],
      [
        'p:packages/database/src/models/__tests__/commercial',
        'owned',
        'commercial model tests (preCharge/referralSettings/topup/commercialGrantLock/commercialPricing)',
      ],
      [
        'p:packages/database/src/models/__tests__/planDeleteImpact.test.ts',
        'owned',
        'plan deletion impact test',
      ],
      [
        'p:packages/database/src/schemas/commercialInvariants.schema.test.ts',
        'owned',
        'commercial invariants schema test',
      ],
      [
        'p:packages/database/src/repositories/ftsSearchDocument/',
        'owned',
        'fork-new FTS search document schema + test',
      ],
      ['p:packages/database/src/repositories/', 'upstream', 'aiInfra pricing resolution + tests'],
    ],
    tests: [
      'packages/business-server/src/**/*.test.ts',
      'src/features/Admin/ (billing matrix suites)',
      'packages/model-runtime/src/core/**/*.test.ts',
    ],
    notes:
      'Deepest-coupling module (244 upstream files). plannedExtraction: keep the ModelRuntimeHooks seam shape; full physical extraction deferred until after the v2.2.19 upgrade window. New billable non-chat reference types go in BILLABLE_LEDGER_REFERENCE_TYPES (see server-usage-ledger).',
  },
  {
    id: 'server-usage-ledger',
    name: 'Usage ledger reconciliation',
    sync: 're-apply',
    description:
      'Usage service merges upstream message usage with credit_ledger_entries for non-chat billables (image/video/ppt/embedding/structured-output).',
    ownershipRules: [
      [
        'p:apps/server/src/services/usage/ledgerReconciliation.ts',
        'owned',
        'extracted: ledger reconciliation',
      ],
      ['p:apps/server/src/services/usage/', 'upstream', 'ledger merge in index.ts + cost.ts split'],
      [
        'p:apps/server/src/routers/lambda/usageInputSchemas.ts',
        'owned',
        'extracted: usage date-range validation schemas (usageDateRangeInput/agentUsageStatsInput)',
      ],
      [
        'p:apps/server/src/routers/lambda/usage.ts',
        'upstream',
        'delegates input schemas to usageInputSchemas.ts (hookExtracted); endpoints remain',
      ],
      ['p:src/services/usage.ts', 'upstream', 'findByDateRange client'],
    ],
    tests: ['apps/server/src/services/usage/index.test.ts'],
    notes:
      'Chat cost: usage.cost → metadata.cost → ledger fallback. Never double-count chat records that already carry message usage cost. New billable reference types must be added to BILLABLE_LEDGER_REFERENCE_TYPES.',
  },
  {
    id: 'server-storage-s3',
    name: 'Admin-managed S3 routing',
    sync: 're-apply',
    description:
      'FileS3 routes runtime methods through getRuntimeS3() built from admin app_settings; preview caches keyed by active S3 config.',
    ownershipRules: [
      [
        'p:apps/server/src/modules/S3/index.ts',
        'upstream',
        'barrel已化: routes FileS3 through getRuntimeS3() (upstream file, fork-modified)',
      ],
      [
        'p:apps/server/src/modules/S3/index.test.ts',
        'upstream',
        'barrel tests (upstream file, fork-modified)',
      ],
      [
        'p:apps/server/src/modules/S3/',
        'owned',
        's3Client.ts (upstream base + fork methods), fileS3Runtime.ts (FileS3 override + TTL cache), envFileS3.ts',
      ],
      ['p:apps/server/src/services/file/', 'upstream', 's3.ts impl reads config via getConfig()'],
      ['p:apps/server/src/services/connectorData/', 'upstream', 'S3 config usage'],
      ['p:src/services/upload.ts', 'upstream', 'client S3 path from server config'],
    ],
    tests: ['apps/server/src/modules/S3/index.test.ts'],
    notes:
      'Do not call inherited S3 methods from FileS3 unless they delegate through getRuntimeS3(). invalidateServerAppSettings() must clear the runtime cache.',
  },
  {
    id: 'server-agent-guard',
    name: 'Agent inbox/default-model guard',
    sync: 're-apply',
    description:
      'Admin default-agent settings layer + inbox runtime model preservation (user-updated inbox model/provider survives hydrate).',
    ownershipRules: [
      [
        'p:apps/server/src/services/agent/inboxModelGuard.ts',
        'owned',
        'extracted: inbox model guard',
      ],
      [
        'p:apps/server/src/services/agent/',
        'upstream',
        'mergeDefaultConfig admin layer + hasBeenUpdatedAfterCreate guard',
      ],
    ],
    tests: ['apps/server/src/services/agent/index.test.ts'],
    notes:
      'Workspace-scoped reads skip only the personal user layer, keep the admin layer. Inbox re-applies admin config minus model/provider when a runtime selection exists.',
  },
  {
    id: 'admin-app-settings',
    name: 'Admin app settings runtime config',
    sync: 'verify-only',
    description:
      'app_settings key/value store + typed registry + CAS revisions + per-section readers (brand, S3, composio, model policy, defaults) + newapi instance management.',
    ownershipRules: [
      ['p:src/const/appSettingsRegistry.ts', 'owned', 'APP_SETTING_KEYS registry'],
      ['p:src/server/services/appSettings/', 'owned', 'readers + 30s TTL cache + invalidation'],
      ['p:packages/builtin-tool-agent-builder/', 'upstream', 'executor tweaks'],
      ['p:packages/builtin-tool-agent-management/', 'upstream', 'executor tweaks'],
      ['p:packages/builtin-tool-group-agent-builder/', 'upstream', 'executor tweaks'],
      ['p:packages/const/src/currency.test.ts', 'owned', 'credit conversion tests'],
      ['p:packages/const/src/layoutTokens.ts', 'upstream', 'brand layout token adjustments'],
      ['p:packages/const/src/url.ts', 'upstream', 'modelRatings webapi route'],
      ['p:packages/trpc/src/utils/', 'owned', 'clientIp extraction util + tests'],
      ['p:packages/database/src/schemas/newapiInstance.ts', 'owned', 'newapi instance schema'],
      [
        'p:packages/database/src/schemas/appSettingRevision.schema.test.ts',
        'owned',
        'appSettingRevision schema test',
      ],
      [
        'p:apps/server/src/globalConfig/adminManagedProviders.ts',
        'owned',
        'extracted: admin-managed provider assembly (types, generic newapi params, uniqueModelIds, applyAdminManagedProviders)',
      ],
      [
        'p:apps/server/src/globalConfig/index.ts',
        'upstream',
        'delegates business-mode provider assembly to adminManagedProviders.ts (hookExtracted)',
      ],
      [
        'p:apps/server/src/globalConfig/',
        'upstream',
        'server global config + memory extraction config; conservative over-cover: also claims fork-new files (providerSpecificConfig, getServerAuthConfig/index.business tests)',
      ],
      ['p:apps/server/src/routers/lambda/config', 'upstream', 'config router extensions'],
      ['p:apps/server/src/routers/lambda/aiModel', 'upstream', 'admin-managed model lists'],
      ['p:apps/server/src/routers/lambda/aiProvider', 'upstream', 'admin-managed providers'],
      ['p:apps/server/src/routers/lambda/asr.ts', 'upstream', 'initModelRuntimeFromDB usage'],
      ['p:apps/server/src/routers/lambda/chunk.ts', 'upstream', 'server default embedding model'],
      ['p:apps/server/src/routers/lambda/composio.ts', 'upstream', 'runtime composio config'],
      ['p:apps/server/src/routers/lambda/file.ts', 'upstream', 'storage quota asserts'],
      ['p:apps/server/src/routers/tools/', 'upstream', 'composio tool router'],
      ['p:apps/server/src/services/composio/', 'upstream', 'runtime-configured client'],
      ['p:packages/app-config/src/composio.ts', 'upstream', 'env fallback helpers'],
      [
        'p:packages/types/src/serverConfig.ts',
        'upstream',
        'PublicCustomizationConfig + generation model config',
      ],
      ['p:packages/types/src/user/preference.ts', 'upstream', 'role exposure'],
      [
        'p:src/features/User/',
        'upstream',
        'help menu items from admin config; conservative over-cover: also claims fork-new files (helpMenuItems)',
      ],
    ],
    tests: [
      'src/server/services/appSettings/*.test.ts',
      'packages/business-server/src/appSettings/**/*.test.ts',
    ],
    notes:
      'All runtime config flows app_settings → readers → tRPC/React. Admin writes require monotonic revisions (compare-and-swap).',
  },
  {
    id: 'admin-console',
    name: 'Admin console',
    sync: 'verify-only',
    description:
      'Full admin surface: features (237 files), routes, business-server admin routers, admin types, nav entries.',
    ownershipRules: [
      // M2 design-system: the Admin max-lines gate lives in the root eslint
      // config (upstream file, claimed upstream per the deps-pins precedent —
      // an upstream file the fork deliberately extends) and its exemption
      // list is a fork-new JSON claimed owned below.
      [
        'p:eslint.config.mjs',
        'upstream',
        'admin-console M2 max-lines gate: scoped max-lines overrides + exemption-list import appended on top of the upstream config; upstream rule-set changes (alint recalibrations) must be re-merged around the appended Admin block at the tail',
      ],
      [
        'p:eslint-admin-legacy-oversized.json',
        'owned',
        'fork-new: Admin >300-line legacy tsx exemption list (38 entries, warn-only, only shrinks; see blueprint §4.5) consumed by eslint.config.mjs max-lines overrides',
      ],
      ['p:src/features/Admin/', 'owned', 'admin feature modules + tests'],
      ['p:src/routes/(main)/admin/', 'owned', 'admin routes'],
      ['p:src/routes/(main)/settings/_layout/index.tsx', 'upstream', 'admin entry for admins'],
      ['p:packages/types/src/admin.ts', 'owned', 'admin capability types'],
      ['p:packages/trpc/src/lambda/index.ts', 'upstream', 'admin router mounting'],
      [
        'p:apps/server/src/routers/lambda/index.ts',
        'upstream',
        'admin/redemption/payment router mounting',
      ],
      [
        'p:apps/server/src/services/user/',
        'upstream',
        'initNewUserForBusiness adds this.db param (role 字段落点在 packages/database/src/models/user.ts)',
      ],
      ['p:packages/database/src/models/user.ts', 'upstream', 'role field exposure'],
      ['p:src/features/NavPanel/', 'upstream', 'admin console path awareness'],
      [
        'p:src/features/Settings/about/',
        'upstream',
        'admin-driven about/version content; conservative over-cover: also claims fork-new files (About.test.tsx)',
      ],
      ['p:src/features/Settings/hooks/useCategory', 'upstream', 'admin settings category'],
    ],
    tests: [
      'src/features/Admin/**/*.test.*',
      'packages/business-server/src/lambda-routers/admin/**/*.test.ts',
    ],
    notes:
      'Admin setting writes enforce per-section CAS revisions; correlation IDs surface conflicts.',
  },
  {
    id: 'auth-fork',
    name: 'Auth fork (parallel Next.js auth tree)',
    sync: 'verify-only',
    description:
      'ComHub-owned src/app/[variants]/(auth) tree coexisting with upstream src/routes/auth; better-auth wiring, zh-CN default public locale, market auth providers.',
    ownershipRules: [
      ['p:src/app/[variants]/(auth)/', 'owned', '59-file parallel auth tree'],
      [
        'p:src/libs/better-auth/',
        'upstream',
        'upstream better-auth wiring: 47 files verbatim, only define-config.test.ts fork-modified',
      ],
      [
        'p:src/layout/AuthProvider/MarketAuth/tokenStorage',
        'owned',
        'fork-new market auth token storage + tests',
      ],
      [
        'p:src/layout/AuthProvider/MarketAuth/',
        'upstream',
        'market auth provider + types (fork-modified)',
      ],
      ['p:src/layout/SPAGlobalProvider/', 'upstream', 'SPA locale defaults (fork-modified)'],
      [
        'p:src/layout/',
        'owned',
        'fork-new layout files outside MarketAuth//SPAGlobalProvider (AnalyticsRSCProvider, GlobalProvider/StyleRegistry, FaviconProvider.test, auth tree layouts)',
      ],
      ['p:src/app/(backend)/api/auth/', 'upstream', 'better-auth catch-all route'],
      ['p:src/libs/next/', 'upstream', 'proxy locale default + nextjsOnlyRoutes + Link adapter'],
      ['p:src/store/user/slices/auth/', 'upstream', 'better-auth client actions'],
      ['p:packages/types/src/user/settings/index.ts', 'upstream', 'market tokens setting'],
    ],
    tests: ['src/libs/better-auth/define-config.test.ts'],
    notes:
      'Upstream may delete/rewrite src/routes/auth — the fork tree is independent but doubles the auth surface. nextjsOnlyRoutes list must merge both route sets.',
  },
  {
    id: 'mobile-workspace',
    name: 'Mobile workspace parity',
    sync: 'merge',
    description:
      'DingTalk-style four-tab mobile shell, workspace continuity (Recent/Desktop parity), shared route generators, workspace settings category gating.',
    ownershipRules: [
      ['p:src/features/MobileWorkspace/', 'owned', '54-file feature + tests'],
      [
        'p:src/features/MobileHome/',
        'upstream',
        'mobile home layouts (upstream dir; fork modified Layout, SessionHeader, Inbox, List items)',
      ],
      ['p:src/const/mobileConfig.ts', 'owned', 'mobile config'],
      [
        'p:src/spa/router/',
        'upstream',
        'mobileRouter.config + workspace routes; conservative over-cover: also claims fork-new files (mobileWorkspaceRoutes.tsx)',
      ],
      [
        'p:src/routes/(mobile)/',
        'upstream',
        '16+ mobile pages; conservative over-cover: also claims fork-new files (pages/tests)',
      ],
      ['p:src/features/WorkspaceSetting/', 'upstream', 'category gating (Devices default)'],
      ['p:src/components/server/MobileNavLayout.tsx', 'upstream', 'mobile nav layout'],
      [
        'p:packages/database/src/models/recentMobileWorkspace.ts',
        'owned',
        'extracted: mobile workspace recent query + latest-topics-by-parents (types, cursor codec, SYSTEM_TOPIC_TRIGGERS)',
      ],
      [
        'p:packages/database/src/models/recent.ts',
        'upstream',
        'MobileWorkspace recent query API (rest of models/ claimed per-file elsewhere)',
      ],
      [
        'p:apps/server/src/routers/lambda/recentMobileWorkspaceEndpoint.ts',
        'owned',
        'extracted: mobile workspace recent mappers + response types (toRecentItem/toMobileWorkspaceRecentItem)',
      ],
      [
        'p:apps/server/src/routers/lambda/recent.ts',
        'upstream',
        'delegates recent mappers + types to recentMobileWorkspaceEndpoint.ts (hookExtracted); getMobileWorkspace endpoint wiring remains',
      ],
      [
        'p:src/services/recent/',
        'upstream',
        'recent service; conservative over-cover: also claims fork-new files (index.test.ts)',
      ],
      ['p:src/types/workspaceSettings', 'upstream', 'workspace settings types'],
    ],
    tests: ['src/features/MobileWorkspace/**/*.test.*', 'src/spa/router/mobileRouter.test.tsx'],
    notes:
      'Add feature routes to the shared generator (mobileWorkspaceRoutes), never two copies. Reserved roots before /:workspaceSlug.',
  },
  {
    id: 'onboarding-community',
    name: 'Onboarding & community',
    sync: 're-apply',
    description:
      'Local onboarding agent templates, fork-and-chat community flow, market/discover services, expert plaza entries.',
    ownershipRules: [
      ['p:src/const/onboardingAgentTemplates.ts', 'owned', 'local agent templates'],
      [
        'p:src/features/DesktopOnboarding/',
        'upstream',
        'desktop onboarding (upstream dir; fork modified Layout/index, LobeMessage, LoginStep)',
      ],
      ['p:src/features/Onboarding/', 'upstream', 'agent picker + telemetry brand'],
      [
        'p:src/features/CommunitySkillDetail/',
        'upstream',
        'skill platform labels; conservative over-cover: also claims fork-new files (Platform.test.tsx)',
      ],
      [
        'p:src/routes/(main)/community/',
        'upstream',
        'fork-and-chat buttons, mcp/skill detail pages; conservative over-cover: also claims fork-new files (detail tests, workspace loading)',
      ],
      [
        'p:apps/server/src/services/market/marketSkillFallback.ts',
        'owned',
        'extracted: skill auth-error fallback + public sitemap + placeholder normalization',
      ],
      [
        'p:apps/server/src/services/market/index.ts',
        'upstream',
        'delegates searchSkill/getSkillDetail fallbacks to marketSkillFallback.ts (hookExtracted)',
      ],
      [
        'p:apps/server/src/services/market/',
        'upstream',
        'market SDK service; conservative over-cover: also claims fork-new files',
      ],
      [
        'p:apps/server/src/services/placeholderNormalization.ts',
        'owned',
        'extracted: shared placeholder cleanup for market/discover catalogue items (normalizeCatalogItem/ListResponse)',
      ],
      [
        'p:apps/server/src/services/discover/',
        'upstream',
        'delegates placeholder cleanup to placeholderNormalization.ts (hookExtracted)',
      ],
      ['p:apps/server/src/routers/lambda/market', 'upstream', 'market endpoints'],
      ['p:src/services/discover.ts', 'upstream', 'discover client'],
      ['p:src/services/installMarketplaceAgents', 'upstream', 'local template install path'],
      [
        'p:packages/trpc/src/lambda/middleware/marketUserInfo.ts',
        'upstream',
        'market user middleware',
      ],
      ['p:packages/const/src/index.ts', 'upstream', 'defaultAgent re-export'],
    ],
    tests: ['src/services/installMarketplaceAgents.test.ts'],
    notes:
      'ComHub skips the upstream community profile creation flow for fork-and-chat (local copy instead).',
  },
  {
    id: 'module-app-platform',
    name: 'Module App platform',
    sync: 'verify-only',
    description:
      'Module runtime/worker apps, module-app-build/sdk packages, marketplace UI, lifecycle governance, artifact cleanup, scheduled dispatch, S3 gate replacement.',
    ownershipRules: [
      ['p:apps/module-runtime/', 'owned', 'module runtime app'],
      ['p:apps/module-worker/', 'owned', 'worker + integration test (aws-cli gate)'],
      ['p:packages/module-app-', 'owned', 'build + sdk packages'],
      ['p:apps/server/src/services/moduleApp', 'owned', '7 moduleApp* services'],
      ['p:apps/server/src/workflows/', 'owned', 'moduleApp schedule dispatcher'],
      ['p:packages/database/src/schemas/moduleApp', 'owned', 'schema + schema test'],
      [
        'p:packages/database/src/models/__tests__/moduleApp',
        'owned',
        'moduleApp model tests (marketplace/ownership/commerce/credit/payment/...)',
      ],
      [
        'p:packages/database/src/models/moduleApp',
        'owned',
        'installation/payment/payout/publisher/trigger/workflow models',
      ],
      ['p:src/features/ModuleAppRuntime/', 'owned', 'runtime UI'],
      ['p:src/features/ModuleAppMarket/', 'owned', 'marketplace UI (AppDetail upstream-modified)'],
      ['p:src/features/AgentSetting/', 'owned', 'agent chat settings panel'],
      ['p:src/features/AgentShareVisitor/', 'owned', 'share visitor composer guard'],
      ['p:src/features/CommunityRecommendations/', 'owned', 'community recommendations'],
      ['p:src/features/DesktopDownload/', 'owned', 'desktop download entry resolution'],
      ['p:src/features/Downloads/', 'owned', 'downloads page + platform icons'],
      ['p:src/features/Eval/', 'owned', 'benchmark eval UI'],
      ['p:src/features/ExpertPlaza/', 'owned', 'expert plaza'],
      ['p:src/features/ModuleAppDeveloper/', 'owned', 'module developer portal'],
      ['p:src/features/Portal/', 'owned', 'local-file HTML artifact pipeline'],
      ['p:src/features/ProfileInterests/', 'owned', 'profile interest areas'],
      ['p:src/features/ProviderSettings/', 'owned', 'provider settings navigation helper'],
      ['p:src/features/MCPPluginDetail/', 'upstream', 'header display name fallback'],
      ['p:src/helpers/', 'owned', 'resolveEnabledChatModel'],
      ['p:src/features/Fleet/', 'owned', 'fleet UI'],
      ['p:docker-compose/deploy/module-runtime.yml', 'owned', 'deploy compose (aws-cli init)'],
      [
        'p:apps/server/src/router-hono/workflows/task/handlers/moduleAppScheduleHook.ts',
        'owned',
        'extracted: moduleApp schedule dispatch hook for the central cron tick (never-failing summary)',
      ],
      [
        'p:apps/server/src/router-hono/workflows/task/',
        'upstream',
        'scheduleDispatch delegates moduleApp hook to moduleAppScheduleHook.ts (hookExtracted); conservative over-cover: also claims fork-new files (scheduleDispatch.test.ts)',
      ],
      ['p:apps/server/package.json', 'upstream', 'module-app-build dependency'],
      ['p:apps/desktop/pnpm-workspace.yaml', 'upstream', 'module-app-build workspace entry'],
      ['p:src/routes/(main)/apps/index.tsx', 'upstream', 'apps route → ModuleAppMarket'],
      ['p:e2e/', 'owned', 'module-app production gates'],
    ],
    tests: [
      'apps/module-worker/src/integration.test.ts',
      'src/features/ModuleAppMarket/',
      'apps/server/src/services/moduleApp*/',
    ],
    notes:
      'module-app-s3-init uses digest-pinned public.ecr.aws/aws-cli (Quay minio/* went private 2026-09). Never revert to minio/mc. Cleanup only accepts generated module-apps/<app>/<run>/ keys.',
  },
  {
    id: 'ui-integration',
    name: 'UI integration points',
    sync: 'merge',
    description:
      'Point-edits in upstream UI that wire ComHub features in: sidebar admin entry + brand defaults, settings categories, provider visibility filter, model switcher, home layout, chat input flags, store slices.',
    plannedExtraction: true,
    ownershipRules: [
      [
        'p:src/features/HomeSidebar/',
        'upstream',
        'customize modal, footer, nav entries; conservative over-cover: also claims fork-new files (InboxEntry, helpMenuItems)',
      ],
      [
        'p:src/features/Home/',
        'upstream',
        'input area banner gating, agent select defaults; conservative over-cover: also claims fork-new files (CommunityAgents, InputArea banners/starter list, SuggestQuestions)',
      ],
      [
        'p:src/features/Settings/',
        'upstream',
        'layout/categories/provider filter/SSO/profile; conservative over-cover: also claims fork-new files (SettingsContent.test, filterProviders)',
      ],
      [
        'p:src/features/ModelSwitchPanel/',
        'upstream',
        'multi-provider dedup + price summary + business rating prefetch; conservative over-cover: also claims fork-new files (ModelRowMeta/Render, metaColumns, useModelEffortLabel)',
      ],
      ['p:src/features/ModelSelect/', 'upstream', 'selectedValue normalization'],
      [
        'p:src/features/Conversation/',
        'upstream',
        'agent meta default name, usage token progress; conservative over-cover: also claims fork-new files (installMarketplaceAgents, TokenProgress.test)',
      ],
      [
        'p:src/features/ChatInput/InputEditor/InputFloatMenu.tsx',
        'owned',
        'extracted: portal float menu for editor autocomplete popups (math/slash)',
      ],
      [
        'p:src/features/ChatInput/InputEditor/index.tsx',
        'upstream',
        'delegates InputFloatMenu to InputFloatMenu.tsx (hookExtracted); math plugin renderComp wiring remains',
      ],
      [
        'p:src/features/ChatInput/',
        'upstream',
        'disableMention/disableSlash flags; conservative over-cover: also claims fork-new files (ActionTagView, imports.test)',
      ],
      [
        'p:src/features/SkillStore/',
        'upstream',
        'market items normalization + default skill name; conservative over-cover: also claims fork-new files (AgentSkillItem, Community, normalizeMarketItems)',
      ],
      ['p:src/features/MCP/', 'upstream', 'mcp detail via discover service'],
      ['p:src/features/AgentHome/', 'upstream', 'agent info default name'],
      ['p:src/features/AgentSidebar/', 'upstream', 'header agent entry'],
      ['p:src/features/ResourceManager/', 'upstream', 'rename flow'],
      ['p:src/features/RouteMeta/', 'upstream', 'route meta bridge'],
      ['p:src/features/Pages/', 'upstream', 'mobile pages layout'],
      ['p:src/features/ProfileEditor/', 'upstream', 'default skill name in agent tool'],
      ['p:src/features/Recommendations/', 'upstream', 'visibility test'],
      ['p:src/features/Acceptance/', 'upstream', 'report viewer layout'],
      ['p:src/features/Setting/', 'upstream', 'footer brand name'],
      ['p:src/services/adminCommercial', 'owned', 'admin commercial client service'],
      ['p:src/services/agentCronJob.ts', 'owned', 'agent cron job client'],
      ['p:src/services/commercial.ts', 'owned', 'commercial client service'],
      ['p:src/services/discover.test.ts', 'owned', 'discover client tests'],
      ['p:src/services/docmee.ts', 'owned', 'docmee PPT client'],
      ['p:src/services/mobileDesign', 'owned', 'mobile design client + tests'],
      ['p:src/services/moduleApp', 'owned', 'module app client + tests'],
      ['p:src/services/redemption.ts', 'owned', 'redemption client'],
      ['p:src/services/usage.test.ts', 'owned', 'usage client tests'],
      ['p:src/services/thread/index.ts', 'upstream', 'thread service tweaks'],
      ['p:src/spa/entry.web.tsx', 'upstream', 'SPA web entry adjustments'],
      ['p:src/proxy.test.ts', 'upstream', 'proxy route tests'],
      [
        'p:src/routes/(main)/',
        'upstream',
        'home/group/apps/create/memory routes; conservative over-cover: also claims fork-new files (create/ppt-video, agent/cron, apps subpages, downloads, experts, fleet, topup)',
      ],
      ['p:src/routes/', 'owned', 'route files not under (main)/(mobile)'],
      [
        'p:src/store/aiInfra/slices/aiProvider/sliceHelpers.ts',
        'owned',
        'extracted: aiProvider slice fork helpers (lazy aiProviderService import vs circular dep, chat model catalog fallbacks, business offline provider list)',
      ],
      [
        'p:src/store/aiInfra/slices/aiProvider/action.ts',
        'upstream',
        'delegates helpers to sliceHelpers.ts (hookExtracted); per-callsite getAiProviderService() lines remain',
      ],
      [
        'p:src/store/',
        'upstream',
        'global/aiInfra/discover/user/image/video/tree/utils slices; conservative over-cover: also claims fork-new files (createAgentExecutors + fixtures, initialState.test, crud action.test)',
      ],
      [
        'p:src/hooks/',
        'upstream',
        'useNavLayout brand entries, useFetchAgentList; conservative over-cover: also claims fork-new files (useIsCloudActive)',
      ],
      [
        'p:src/components/',
        'upstream',
        'ModelSelect priceLabel, StatisticCard, StreamingMarkdown, mdx Image, errorResponse consumers; conservative over-cover: also claims fork-new files (SkillSourceTag, SuspenseRouteBoundary, antd-compat, FeatureList, HtmlPreview scanner)',
      ],
      ['p:src/libs/swr/keys.ts', 'upstream', 'SWR keys'],
      ['p:src/const/', 'owned', 'fork consts not covered elsewhere'],
      ['p:src/types/spaServerConfig', 'upstream', 'SPABrandConfig types'],
      ['p:src/types/', 'owned', 'fork types not covered elsewhere'],
      ['p:src/utils/errorResponse', 'upstream', 'internal error sanitization'],
      ['p:src/utils/navigation.ts', 'upstream', 'isExternalUrl helper'],
      ['p:src/utils/', 'owned', 'fork utils not covered elsewhere'],
      ['p:src/proxy.ts', 'upstream', 'SPA route list'],
      [
        'p:packages/app-config/src/routes/',
        'upstream',
        'nav route catalog (experts/ppt); conservative over-cover: also claims fork-new files (index.test.ts)',
      ],
      ['p:packages/types/src/user/settings/', 'upstream', 'image settings defaults'],
      ['p:apps/server/src/routers/lambda/user.ts', 'upstream', 'avatar preset whitelist'],
      [
        'p:packages/types/src/adminCommand.ts',
        'owned',
        'fork-new: admin command catalog types (171-command catalog, capability matrix) — maintained for the admin-console redesign; co-located adminCommand.test.ts rides the ui-integration package over-cover below',
      ],
      [
        'p:packages/types/src/',
        'upstream',
        'types not covered elsewhere; conservative over-cover: also claims fork-new files (admin*/moduleApp*/payment/business types)',
      ],
    ],
    tests: ['co-located *.test.* files under each listed dir'],
    notes:
      'plannedExtraction: largest raw count of upstream-owned edits (236). Upstream home rebuild already deleted starterModels.ts once — expect churn here every sync.',
  },
  {
    id: 'locales',
    name: 'Locale additions',
    sync: 'merge',
    description:
      'ComHub locale keys (admin.*, subscription, messenger banner, experts/ppt cmdk, electron) in root JSON + packages/locales defaults.',
    ownershipRules: [
      ['p:locales/', 'upstream', 'en-US/zh-CN JSON (subscription +904 lines zh-CN)'],
      ['p:packages/locales/', 'upstream', '12 default/*.ts files (+2921 lines)'],
    ],
    tests: [],
    notes: 'Merge-friendly (append-only keys). Keep zh-CN and en-US in sync.',
  },
  {
    id: 'spa-html',
    name: 'SPA HTML / static shell',
    sync: 're-apply',
    description:
      'Server-rendered SPA HTML with runtime brand/analytics/S3 config, build scripts, spaServerConfig types.',
    ownershipRules: [
      ['p:src/server/', 'owned', 'spaHtml.ts, translation.ts, metadata.ts'],
      ['p:src/libs/spaHtml/', 'upstream', 'shared HTML builder'],
      [
        'p:src/app/spa/',
        'upstream',
        'SPA route with brand injection; conservative over-cover: also claims fork-new files (route.test.ts)',
      ],
      [
        'p:scripts/copySpaBuildCore.ts',
        'upstream',
        'build copy logic (upstream file, fork-modified)',
      ],
      [
        'p:scripts/generateSpaTemplates.mts',
        'upstream',
        'template generation (upstream file, fork-modified)',
      ],
      ['p:vite.config.ts', 'upstream', 'mobile html fallback + dedupe aliases'],
    ],
    tests: ['src/libs/spaHtml/index.test.ts', 'src/server/services/brand/__tests__/'],
    notes:
      'New files under public/ are invisible to a running container until redeploy (Next scans public/ at start).',
  },
  {
    id: 'ci-deploy',
    name: 'CI / deploy workflows',
    sync: 're-apply',
    description:
      'ComHub-owned workflows (build/deploy/pr-check/upstream-sync/codeql), fork-secret tolerance in upstream workflows, deployment workflow contract test, Dockerfile build args.',
    ownershipRules: [
      [
        'p:.github/workflows/comhub',
        'owned',
        'build/deploy/deploy-worker/pr-check/upstream-sync + comhubDeploymentWorkflows.test.mjs (upstream has no comhub* workflows)',
      ],
      ['p:.github/workflows/codeql.yml', 'owned', 'fork-new: codeql workflow'],
      [
        'p:.github/workflows/dependency-review.yml',
        'owned',
        'fork-new: dependency review workflow',
      ],
      [
        'p:.github/workflows/',
        'upstream',
        'tolerance guards in verify-share/verify-workbench/claude-pr-assign; OTA release workflow; 8 upstream workflows deleted (auto-tag-release/bundle-analyzer/e2e/pr-build-desktop/release-desktop-beta/canary/stable/test); pr-build-docker + release-docker action version upgrades; release-sdk node version upgrade; manual-build-desktop.yml unmodified',
      ],
      ['p:.github/scripts/', 'owned', 'FTS history + bundle gates'],
      ['p:.github/actions/', 'upstream', 'setup-env node pin'],
      ['p:scripts/comhub-upstream-sync/', 'owned', 'sync tooling'],
      ['p:scripts/comhub-customizations/', 'owned', 'registry + gates'],
      ['p:scripts/dockerWorkspaceManifests.test.ts', 'upstream', 'compose manifest contract test'],
      [
        'p:docker-compose/deploy/',
        'owned',
        'fork-new deploy composes: module-worker/ + paradedb/ (module-runtime.yml claimed by module-app-platform)',
      ],
      [
        'p:docker-compose/',
        'upstream',
        'grafana/prometheus templates (dead minio known); conservative over-cover: also claims fork-new files (module-app-alerts.yml)',
      ],
      ['p:Dockerfile', 'upstream', 'COMHUB_* build args'],
      ['p:src/app/(backend)/api/version/route.test.ts', 'owned', 'deployment metadata route tests'],
      ['p:src/app/(backend)/api/version/', 'upstream', 'deployment metadata route'],
      ['p:docs/development/upstream-sync-reports/', 'owned', 'generated sync reports'],
    ],
    tests: ['.github/workflows/comhubDeploymentWorkflows.test.mjs'],
    notes:
      'pull_request uses HEAD-branch workflow definitions; pull_request_target uses BASE. CI fixes only affect PRs created after landing on main.',
  },
  {
    id: 'deps-pins',
    name: 'Dependency pins',
    sync: 'verify-only',
    description:
      'pnpm overrides (@lobehub/ui 5.48.2), electron 43.5, better-call zod4 pnpmfile, observability deps.',
    ownershipRules: [
      ['p:pnpm-workspace.yaml', 'upstream', '@lobehub/ui override pin'],
      ['p:.pnpmfile.cjs', 'owned', 'better-call zod4 alignment'],
      ['p:apps/desktop/package.json', 'upstream', 'electron 43.5'],
      ['p:apps/desktop/pnpm-lock.yaml', 'upstream', 'desktop lockfile'],
      ['p:package.json', 'upstream', 'root overrides: @lobehub/ui/editor/icons pins'],
      ['p:packages/editor-runtime/package.json', 'upstream', '@lobehub/editor pin 4.27.3'],
      ['p:packages/builtin-tool-lobe-agent/package.json', 'upstream', '@lobehub/editor pin 4.27.3'],
      ['p:packages/builtin-tools/package.json', 'upstream', '@lobehub/icons pin 5.21.0'],
      ['p:packages/heterogeneous-agents/package.json', 'upstream', '@lobehub/icons pin 5.21.0'],
      [
        'p:packages/observability-otel/',
        'upstream',
        'module-app OTel metrics（exports ./modules/module-app + 2 个新文件）；electron 依赖从未存在; conservative over-cover: also claims fork-new files',
      ],
      [
        'p:packages/electron-client-ipc/',
        'upstream',
        'electron 43.2.0→43.5.0（execa 实际加在 packages/heterogeneous-agents）',
      ],
    ],
    tests: [],
    notes:
      'Do not remove the @lobehub/ui pin without pnpm run build:docker + pnpm type-check (5.51.2 removed NeuralNetworkLoading / Empty padding props). @lobehub/editor 4.28+ and @lobehub/icons 5.23+ require ui ^5.54 (fork pins 5.48.2) — editor pinned 4.27.3, icons 5.21.0; re-evaluate pins when the ui pin moves.',
  },
  {
    id: 'runtime-quality',
    name: 'Runtime quality patches',
    sync: 'merge',
    description:
      'Upstream-file fixes carried by the fork: windows findstr argv, resolveCliCommand platform paths, llm error classifier, memory extraction config, qstash otel caching, SSRF-safe fetch, internal error sanitization, DB indexes, SDK regen, openapi operationId util.',
    ownershipRules: [
      [
        'p:packages/heterogeneous-agents/',
        'upstream',
        'resolveCliCommand win32 paths, builtin MCP error surface',
      ],
      [
        'p:packages/local-file-shell/',
        'upstream',
        'windows content search argv; conservative over-cover: also claims fork-new files (windows.test.ts)',
      ],
      ['p:packages/agent-runtime/', 'upstream', 'llmErrorClassifier code precedence'],
      ['p:packages/memory-user-memory/', 'upstream', 'structured result parsing'],
      ['p:packages/web-crawler/', 'upstream', 'mode change only'],
      [
        'p:packages/builtin-tool-calculator/',
        'upstream',
        'executor tweaks (representative; sibling builtin-tool-* follow the same rule)',
      ],
      [
        'p:packages/trpc/src/lambda/middleware/adminPermissions.ts',
        'owned',
        'extracted: admin permissions middleware',
      ],
      [
        'p:packages/trpc/src/lambda/middleware/requireSuperAdmin.ts',
        'owned',
        'extracted: super admin middleware',
      ],
      [
        'p:packages/trpc/src/lambda/middleware/__tests__/adminPermissions.test.ts',
        'owned',
        'adminPermissions middleware tests',
      ],
      [
        'p:packages/trpc/src/lambda/middleware/__tests__/requireSuperAdmin.test.ts',
        'owned',
        'requireSuperAdmin middleware tests',
      ],
      [
        'p:packages/trpc/src/lambda/middleware/marketUserInfo.test.ts',
        'owned',
        'marketUserInfo middleware tests',
      ],
      ['p:packages/trpc/src/lambda/', 'upstream', 'clientIp extraction, middleware ordering'],
      ['p:packages/utils/', 'upstream', 'apiKey prefix fallback, url sanitization, responsive'],
      ['p:packages/const/src/settings/', 'upstream', 'autoCreateTopic settings'],
      ['p:packages/const/src/protocol.ts', 'upstream', 'electron protocol const'],
      [
        'p:packages/openapi/',
        'upstream',
        'operationId util + chat metadata; conservative over-cover: also claims fork-new files (operationId util + test)',
      ],
      ['p:packages/sdk/', 'upstream', 'regenerated client'],
      [
        'p:packages/env/',
        'upstream',
        'APP_URL precedence; conservative over-cover: also claims fork-new files (app.alipay, app.module-app-controls tests)',
      ],
      ['p:packages/app-config/', 'upstream', 'db env schema'],
      ['p:packages/types/', 'upstream', 'agent chatConfig, fetch, error codes'],
      [
        'p:packages/database/src/schemas/message.ts',
        'upstream',
        'topic/user/workspace updated_at indexes',
      ],
      ['p:packages/database/src/schemas/topic.ts', 'upstream', 'workspace agent/group indexes'],
      ['p:packages/database/src/schemas/workspace.ts', 'upstream', 'comment cleanup'],
      ['p:packages/database/src/models/__tests__/', 'upstream', 'model test updates'],
      [
        'p:packages/database/src/models/',
        'upstream',
        'upstream model files modified by the fork (agentShare/aiModel/embedding/generationTopic)',
      ],
      ['p:packages/agent-tracing/', 'upstream', 'mode change only (100755→100644)'],
      [
        'p:apps/server/src/routers/lambda/userMemoryTrigger.ts',
        'owned',
        'extracted: memory extraction trigger-mode resolution + direct (QStash-less) execution scheduler',
      ],
      [
        'p:apps/server/src/routers/lambda/userMemory.ts',
        'upstream',
        'delegates trigger mode + direct extraction scheduling to userMemoryTrigger.ts (hookExtracted); endpoint wiring remains',
      ],
      [
        'p:apps/server/src/services/memory/userMemory/memoryRuntimeTargets.ts',
        'owned',
        'extracted: memory runtime target resolution + init (resolveMemoryRuntimeTargets, initMemoryRuntimeFromTarget, getMemoryRuntimeCacheKey, ADMIN_MANAGED_AI_PROVIDER)',
      ],
      [
        'p:apps/server/src/services/memory/userMemory/extract.ts',
        'upstream',
        'delegates runtime targets/init/cache-key to memoryRuntimeTargets.ts (hookExtracted)',
      ],
      [
        'p:apps/server/src/services/memory/',
        'upstream',
        'extraction config + runtime targets; conservative over-cover: also claims fork-new files (extract.progress.test.ts)',
      ],
      ['p:apps/server/src/services/taskTemplate/', 'upstream', 'task template tweaks'],
      ['p:apps/server/src/services/toolExecution/', 'upstream', 'memory server runtime'],
      ['p:apps/server/src/services/mcp/', 'upstream', 'content processor'],
      ['p:apps/server/src/router-hono/workflows/', 'upstream', 'qstash client availability guards'],
      [
        'p:apps/server/src/routers/',
        'upstream',
        'routers not covered elsewhere; conservative over-cover: also claims fork-new files (moduleApp routers, docmee, mobileDesign, agentCronJob, recent/usage tests)',
      ],
      [
        'p:apps/server/src/',
        'upstream',
        'catch-all for remaining server files; conservative over-cover: also claims fork-new files (desktopBuild services, nodemailer test, placeholderNormalization.test)',
      ],
      [
        'p:patches/',
        'upstream',
        'qstash patch (otel caching + error logging); watch for @upstash/qstash floating-resolve rot',
      ],
      ['p:src/libs/qstash/index.test.ts', 'owned', 'fork-new qstash otel cache tests'],
      ['p:src/libs/qstash/', 'upstream', 'otel client caching'],
      ['p:src/libs/composio/', 'upstream', 'composio client lib (fork-modified index.ts)'],
      ['p:src/libs/', 'owned', 'fork libs not covered elsewhere'],
    ],
    tests: ['co-located suites'],
    notes:
      'Assorted small fixes; individually low-risk, but each needs re-verification after upstream merges.',
  },
  {
    id: 'repo-infra',
    name: 'Repo infrastructure',
    sync: 'annotate-only',
    description:
      'Root configs, agent skills, docs, workspace packaging, FTS repo governance — repo-level plumbing that upstream also evolves.',
    ownershipRules: [
      [
        'p:.agents/',
        'upstream',
        'agent skill scripts + skills symlinks; conservative over-cover: also claims fork-new files (smoke scripts, resume/setup, skills)',
      ],
      ['p:.claude/', 'upstream', 'skills symlink'],
      ['p:.codex/', 'upstream', 'skills symlink'],
      [
        'p:.cursor/',
        'upstream',
        'skills symlink; conservative over-cover: also claims fork-new files (project-governance.mdc)',
      ],
      ['p:.conductor/', 'upstream', 'setup script'],
      ['p:.githooks/', 'upstream', 'pre-commit mode'],
      ['p:.superpowers/', 'owned', 'sdd reports'],
      ['p:.github/', 'upstream', 'CODEOWNERS + repo meta'],
      ['p:tsconfig.json', 'upstream', 'paths block'],
      ['p:vitest.config.mts', 'upstream', 'aliases + excludes'],
      ['p:drizzle.config.ts', 'upstream', 'drizzle config'],
      [
        'p:plugins/vite/',
        'upstream',
        'node module stub; conservative over-cover: also claims fork-new files (mobileHtmlFallback, nodeModuleStub tests)',
      ],
      ['p:packages/database/vitest.config.mts', 'upstream', 'db test aliases'],
      ['p:packages/database/package.json', 'upstream', 'exports'],
      ['p:packages/business-server/package.json', 'upstream', 'test scripts + deps'],
      ['p:packages/business-server/vitest.config.mts', 'owned', 'business-server tests'],
      ['p:pnpm-lock.yaml', 'owned', 'root lockfile'],
      [
        'p:tests/',
        'upstream',
        'shared test mocks/utils (upstream dir); conservative over-cover: also claims fork-new files (emojiMart mocks)',
      ],
      [
        'p:docs/development/comhub-upstream-customizations.md',
        'owned',
        'fork customization ledger (historical narrative)',
      ],
      [
        'p:docs/development/comhub-customization-registry.md',
        'owned',
        'registry human-readable report (regenerated by report.mjs)',
      ],
      [
        'p:docs/',
        'upstream',
        'upstream docs (database-schema.dbml fork-modified); conservative over-cover: also claims fork-new files (fork docs at docs/ root, docs/superpowers/specs, etc.)',
      ],
      [
        'p:scripts/test-baselines/',
        'owned',
        'fork-new red-set snapshot baselines for the dual-suite red governance (snapshot format + classification protocol in scripts/test-baselines/README.md); repo-infra hosts the plumbing but the admin-console workstream maintains it',
      ],
      [
        'p:scripts/',
        'upstream',
        'root scripts not covered elsewhere; conservative over-cover: also claims fork-new files (deploy scripts, seeds, removePaths, runDpdm, packageManagerPolicy, copySpaBuildCore.test)',
      ],
      [
        'p:apps/server/',
        'upstream',
        'server app shell (src/ claimed by runtime-quality, package.json by module-app-platform)',
      ],
      [
        'p:apps/auth/',
        'upstream',
        'auth app scripts (build.mjs fork-modified); conservative over-cover: also claims fork-new files (packageBin scripts)',
      ],
      [
        'p:apps/cli/',
        'upstream',
        'cli app (package.json + program.ts fork-modified); conservative over-cover: also claims fork-new files (module-app command, moduleApp devServer/project)',
      ],
      ['p:apps/share/', 'upstream', 'share app (no current diff; future-proofing)'],
      ['p:apps/workbench/', 'upstream', 'workbench app (no current diff; future-proofing)'],
      ['p:README.md', 'upstream', 'fork readme rewrite'],
      ['p:SECURITY.md', 'upstream', 'fork security policy'],
      ['p:CONTRIBUTING.md', 'upstream', 'fork contributing'],
      ['p:AGENTS.md', 'upstream', 'agent instructions'],
      [
        'p:CLAUDE.md',
        'owned',
        'ComHub AI governance (fork-restored after upstream #19957 removed it in v2.2.19; points at AGENTS.md + ComHub rules)',
      ],
      ['p:.dockerignore', 'upstream', 'docker ignore list'],
      ['p:.gitignore', 'upstream', 'ignore list'],
      ['p:.env.example', 'upstream', 'env docs'],
      ['p:.env.desktop', 'upstream', 'desktop env'],
    ],
    tests: [],
    notes:
      'Plumbing; rarely conflicts semantically. The customization ledger (docs/development/comhub-upstream-customizations.md) is the historical narrative; this registry is the machine-readable truth.',
  },
  {
    id: 'upstream-sync-v2219',
    name: 'Upstream sync v2.2.19',
    sync: 'verify-only',
    description:
      'Bulk upstream-only files absorbed by the v2.2.19 merge (fork did not touch any of them): new feature dirs (EnvironmentManager, MemoryRules, AgentTasks detail, DeviceManager/DeviceHealth, BackgroundActivity, ClarificationQuestions, GlobalApprovalNotification, Messenger integration, FileViewer image AI-edit, replica/core, device-gateway-client, agent-address-linq, alint fixtures, prompts chains, database schemas/utils, const, services, shared-tool-ui, desktop vite configs) plus upstream edits inside directories with no fork ownership. Narrowest-prefix directory rules; exact-file rules only where a parent dir also contains fork-owned files.',
    ownershipRules: [
      [
        'p:.gemini/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:apps/desktop/patches/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:apps/desktop/shell/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/agent-address-linq/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/agent-address-mail/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/agent-gateway-client/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/agent-signal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/alint/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-skills/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-activator/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-agent-documents/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-attachments/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-browser/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-claude-code/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-cloud-sandbox/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-goal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-group-management/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-image-generation/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-knowledge-base/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-lobe-agent/src/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-local-system/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-memory/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-message/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-notebook/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-page-agent/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-skills/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-task/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-user-interaction/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-video-generation/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tool-web-browsing/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/builtin-tools/src/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/chat-adapter-feishu/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/chat-adapter-wechat/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/connector-data/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/const/src/utils/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/context-engine/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/conversation-flow/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/database/src/schemas/__tests__/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/database/src/utils/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/device-control/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/device-gateway-client/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/editor-runtime/src/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/fetch-sse/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/file-loaders/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/mecha/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/prompts/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/replica/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/shared-tool-ui/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/tool-runtime/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/tool-view-model/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:packages/trpc/src/middleware/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/app/(backend)/oauth/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentBreadcrumb/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentBuilder/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentDocumentPage/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentDocumentsExplorer/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentGoals/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentIdentityModal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentMockDevtools/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentPermission/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentProfileArtwork/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentProfileCard/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentProfileTabs/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentQuotaCalendar/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentSkillEdit/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentTasks/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentTopicManager/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentTransferMigration/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentUsage/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AgentViewAll/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ArtworkStudio/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AttachmentInput/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Auth/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/AuthShell/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/BackgroundActivity/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Billboard/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ChatTerminal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ClarificationQuestions/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/CommandMenu/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/CommunityWorkspaceSettings/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ConnectAgent/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Connectors/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/DailyBrief/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/DataImporter/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/DevDock/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/DevFeatureFlagPanel/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/DevPanel/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/DeviceManager/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/EditLock/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/EditingPopover/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/EditorCanvas/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/EntityLink/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/EnvironmentManager/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/EvalCapture/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ExecutionTargetPicker/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ExplorerTree/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/FileTree/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/FileViewer/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/GlobalApprovalNotification/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/GroupPermission/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/HeteroSessionImport/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/HomeInbox/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Integrations/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/LibraryModal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/LocalFile/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/MemoryRules/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Messenger/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/OllamaModelDownloader/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PageEditor/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PageExplorer/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PluginDetailModal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PluginDevModal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PluginSettings/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PluginTag/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Projects/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/PromptTransform/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/RecommendTaskTemplates/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ResourceHome/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ResourcePermission/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ResourceTransferRequest/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/RightPanel/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/SelfLearning/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ServiceModel/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/SettingsSearch/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ShareModal/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/SharePopover/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/SkillsList/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/TaskDock/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/ToolSetting/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/TopicComment/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/VisibilityConfirmContent/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Work/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/WorkGallery/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/WorkingDirectory/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/features/Workspace/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/__tests__/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/document/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/file/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/llmRelay/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/message/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/resource/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/topic/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/user/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/services/userMemory/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/spa/BootShell/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'p:src/styles/',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched)',
      ],
      [
        'apps/desktop/vite.main.config.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'apps/desktop/vite.preload.config.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/agentShare.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/agentShare.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/apiKeyScope.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/bot.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/goal.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/heterogeneousAgent.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/llmGenerationTracing.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/plugin.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/recommendedSkill.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/taskTemplate.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/trash.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/userMemory.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/verify.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/verify.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/worktreeName.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/const/src/worktreeName.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/acceptanceComment.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/agentAccount.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/agentDocuments.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/agentLabel.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/agentOperations.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/agentQuota.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/agentShare.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/connector.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/dashboard.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/environment.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/environmentInstance.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/expertise.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/file.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/goalGraph.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/resourcePermission.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/scm.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/task.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/trash.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/widget.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'packages/database/src/schemas/work.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/business/agent-share.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/features/AgentSelectionEmpty.tsx',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/agentDocument.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/agentQuota.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/agentShare.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/aiAgent.execAgentTask.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/aiAgent.intervention.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/aiAgent.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/asr.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/device.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/expertise.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/github.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/goal.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/kimiCodeQuota.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/kimiCodeQuota.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/kimiCodeQuotaViewModel.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/kimiCodeQuotaViewModel.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/messenger.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/projectFile.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/projectFile.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/python.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/sandboxStorage.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/scm.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/search.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/shareChat.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/task.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/toolResultArchive.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/toolResultArchive.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/trash.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/verify.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/video.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/work.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        '.prettierignore',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        '.remarkignore',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'DESIGN.md',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'alint.audit.toml',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'alint.config.toml',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'eslint.config.mjs',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'prettier.config.mjs',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'stylelint.config.mjs',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'tsconfig.type-check.json',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'vercel.json',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'apps/desktop/stubs/business-const/package.json',
        'owned',
        'desktop isolated-workspace business-const stub (ENABLE_BUSINESS_FEATURES=false): upstream #20133 deleted it because the upstream real package ships the flag off; the fork real package has it ON, so the stub is the OSS-desktop guard and is fork-owned',
      ],
      [
        'apps/desktop/stubs/business-const/src/index.ts',
        'owned',
        'desktop isolated-workspace business-const stub (ENABLE_BUSINESS_FEATURES=false): upstream #20133 deleted it because the upstream real package ships the flag off; the fork real package has it ON, so the stub is the OSS-desktop guard and is fork-owned',
      ],
      [
        'src/services/agentRuntime/__tests__/client.test.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/agentRuntime/client.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/agentRuntime/index.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
      [
        'src/services/agentRuntime/type.ts',
        'upstream',
        'v2.2.19 upstream-sync: new/changed upstream files absorbed by the merge (fork untouched), exact file',
      ],
    ],
    tests: [
      'src/features/EnvironmentManager/',
      'src/features/MemoryRules/',
      'src/features/AgentTasks/',
      'packages/replica/src/',
    ],
    notes:
      'Created during the v2.2.19 upstream merge (commit 3ec81ae726) so verify.mjs kept every changed file registered while the v2.2.18 baseline was still in place; the baseline has since advanced to v2.2.19 and these exact-file rules carry forward as upstream coverage for future fork edits under these paths. If a later fork change touches a file under one of these dirs, add an explicit owned/exact rule in its real module BEFORE this module (first-match wins: earlier modules claim first).',
  },
];

export const UPSTREAM_BASELINE_TAG = 'v2.2.19';

export const registryModules = MODULES;

export const findModuleForPath = (path) => {
  for (const module of MODULES) {
    for (const [match, ownership, note] of module.ownershipRules) {
      const hit = match.startsWith('p:')
        ? path.startsWith(match.slice(2))
        : new RegExp(match).test(path);
      if (hit) return { module, note, ownership };
    }
  }
  return null;
};

export const listModuleFiles = (moduleId) => {
  const module = MODULES.find((m) => m.id === moduleId);
  if (!module) return [];
  return module.ownershipRules.map(([match, ownership, note]) => ({ match, note, ownership }));
};

/** All distinct sync strategies present in the registry. */
export const syncStrategies = [...new Set(MODULES.map((m) => m.sync))];
