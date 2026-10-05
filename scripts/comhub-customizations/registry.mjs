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
 * BASELINE: upstream tag `v2.2.18` (commit 14dfc07b14). Advance via the
 * upstream-sync flow — never by hand — or verify.mjs loses meaning.
 */

const MODULES = [
  {
    id: 'database-migrations',
    name: 'Migration chain',
    sync: 'verify-only',
    description:
      'ComHub-owned migrations (0100-0122 commercial, 0168-0177), repair migration 0178, renumbered upstream 0123-0128, journal invariants.',
    ownershipRules: [
      [
        'p:packages/database/migrations/meta/',
        'upstream',
        '_journal.json + snapshots (0103/0107/0149)',
      ],
      ['p:packages/database/migrations/', 'owned', 'ComHub SQL files'],
      ['p:scripts/verifyMigrationChain.mjs', 'owned', 'static chain check'],
    ],
    tests: ['packages/database/src/models/__tests__/migrationChain.test.ts'],
    notes:
      'Never reorder/renumber deployed migrations. New upstream migrations append after the ComHub tail. 0178 replays skipped 0127-0148 guarded by created_at checks. CI: pnpm verify:database-migrations.',
  },
  {
    id: 'branding',
    name: 'Brand embed (XuanguoAI)',
    sync: 're-apply',
    description:
      'XuanguoAI brand across web + desktop: static assets, runtime brand seam (app_settings → getServerBrand → BrandProvider), upstream component hooks.',
    ownershipRules: [
      ['p:public/', 'owned', 'favicons, app icons, in-site brand logo'],
      ['p:apps/desktop/build/', 'owned', 'installer icon.ico/png + NSIS artwork'],
      ['p:apps/desktop/resources/', 'owned', 'tray, dmg, splash, error page art'],
      ['p:apps/desktop/src/main/core/browser/splash.ts', 'upstream', 'branded splash content'],
      ['p:src/const/brand.ts', 'owned', 'DEFAULT_RUNTIME_BRAND (玄果AI / #12b981)'],
      ['p:src/features/Brand/', 'owned', 'BrandProvider, brandText, loadingBrand, useBrandName'],
      ['p:src/server/services/brand/', 'owned', 'getServerBrand (30s TTL, app_settings)'],
      ['p:src/server/metadata.ts', 'owned', 'APP_URL metadataBase (also serves SPA HTML)'],
      ['p:packages/const/src/defaultAgent.ts', 'owned', 'DEFAULT_COMHUB_AGENT_NAME const'],
      [
        'p:src/components/Branding/',
        'upstream',
        'ProductLogo runtime-brand hook; Custom.tsx simplification',
      ],
      ['p:src/components/BrandWatermark/', 'upstream', 'useBrand() attribution branch'],
      ['p:src/components/Loading/', 'upstream', 'BrandTextLoading brand text + spinner'],
      [
        'p:src/app/[variants]/metadata.ts',
        'upstream',
        'server brand in metadata, server translation',
      ],
      ['p:src/app/manifest.ts', 'upstream', 'runtime brand in PWA manifest'],
      ['p:src/app/[variants]/metadata.test.ts', 'owned', 'metadata brand tests'],
      ['p:src/app/metadata.test.ts', 'owned', 'metadata brand tests'],
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
        'p:apps/desktop/src/main/',
        'upstream',
        'env.ts, updater, Browser, controllers, protocol.ts (see desktop-deep-links)',
      ],
      ['p:apps/desktop/src/', 'owned', 'remoteConfig module, tests, feature components'],
      ['p:apps/desktop/scripts/', 'owned', 'update-test scripts, tray generator'],
      ['p:apps/desktop/src/main/utils/', 'upstream', 'protocol.ts (see desktop-deep-links)'],
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
      ['p:packages/database/src/schemas/desktopBuild.ts', 'owned', 'schema'],
      ['p:packages/types/src/desktopBuild.ts', 'owned', 'types'],
      ['p:src/features/Admin/DesktopControlCenter/', 'owned', 'admin UI'],
    ],
    tests: [
      'apps/desktop/desktop-build-profile.test.ts',
      'packages/database/src/models/__tests__/desktopBuild',
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
      ['p:.github/workflows/comhub-manual-desktop.yml', 'owned', 'manual dispatch workflow'],
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
        'p:apps/server/src/services/desktopRelease/',
        'owned',
        'index.ts = upstream resolvers + delegation; diagnostics.ts (SSRF/zod/timeout/channel health), downloadTypes.ts (matchers), github.ts health',
      ],
      ['p:apps/desktop/scripts/update-test/', 'upstream', 'file-mode only changes'],
      ['p:scripts/electronWorkflow/', 'upstream', 'setDesktopVersion + remaining scripts'],
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
        'p:packages/model-runtime/',
        'upstream',
        'lifecycle hooks (ASR/embeddings/generateObject), image/video adapters, currency-aware computeImageCost, ollama/google fixes',
      ],
      [
        'p:packages/model-bank/',
        'upstream',
        'newapi provider card, siliconcloud/volcengine catalog, module-app export',
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
        'p:packages/business-server/src/',
        'upstream',
        'model-runtime.ts, image/video-generation charge helpers, lambda routers (accountDeletion/file/referral/spend/subscription), user.ts, trpc-middlewares',
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
        'initModelRuntimeFromDB + newapi route metadata',
      ],
      ['p:apps/server/src/services/generation/', 'upstream', 'videoBackgroundPolling settle'],
      ['p:apps/server/src/router-hono/webhooks/', 'upstream', 'video webhook route metadata'],
      ['p:apps/server/src/routers/async/', 'upstream', 'image/video/file async routers'],
      [
        'p:apps/server/src/routers/lambda/image',
        'upstream',
        'policy/plan asserts + newapi metadata',
      ],
      ['p:apps/server/src/routers/lambda/video', 'upstream', 'same as image'],
      [
        'p:src/app/(backend)/webapi/',
        'upstream',
        'chat route metadata headers, pricing route, lobehub-model-ratings',
      ],
      [
        'p:src/business/client/BusinessSettingPages/',
        'upstream',
        'billing/credits/plans/usage/referral pages',
      ],
      [
        'p:src/business/client/',
        'upstream',
        'business hooks (pricing/rating/guard/signup), model catalog merge',
      ],
      [
        'p:src/business/',
        'owned',
        'server billing core (commercialBilling, generationBilling, serverModelPricing, planModelRules, resourceQuota, modelPolicy)',
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
      ['p:src/features/PlanIcon/', 'owned', 'plan icons'],
      ['p:packages/database/src/models/commercial', 'owned', 'commercial models'],
      ['p:packages/database/src/schemas/commercial.ts', 'owned', 'commercial schema'],
      [
        'p:packages/database/src/schemas/index.ts',
        'upstream',
        're-exports commercial/desktopBuild/moduleApp/newapiInstance',
      ],
      ['p:packages/database/src/repositories/', 'upstream', 'aiInfra pricing resolution + tests'],
      ['p:packages/database/', 'owned', 'new commercial models/schemas added under database/'],
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
      ['p:apps/server/src/services/usage/', 'upstream', 'ledger merge in index.ts + cost.ts split'],
      ['p:apps/server/src/routers/lambda/usage.ts', 'upstream', 'date-range validation + endpoint'],
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
        'p:apps/server/src/modules/S3/',
        'owned',
        'index.ts = upstream barrel; s3Client.ts (upstream base + fork methods), fileS3Runtime.ts (FileS3 override + TTL cache), envFileS3.ts',
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
      ['p:src/config/', 'owned', 'composio config helpers'],
      [
        'p:packages/business-server/src/appSettings/',
        'owned',
        'public readers + CAS write helpers',
      ],
      ['p:packages/builtin-tool-agent-builder/', 'upstream', 'executor tweaks'],
      ['p:packages/builtin-tool-agent-management/', 'upstream', 'executor tweaks'],
      ['p:packages/builtin-tool-group-agent-builder/', 'upstream', 'executor tweaks'],
      ['p:packages/const/src/currency.test.ts', 'owned', 'credit conversion tests'],
      ['p:packages/const/src/layoutTokens.ts', 'upstream', 'brand layout token adjustments'],
      ['p:packages/const/src/url.ts', 'upstream', 'modelRatings webapi route'],
      ['p:packages/trpc/src/utils/', 'owned', 'clientIp extraction util + tests'],
      ['p:packages/database/src/schemas/newapiInstance.ts', 'owned', 'newapi instance schema'],
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
        'server global config + memory extraction config',
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
      ['p:src/business/server/', 'owned', 'lambda settings router + admin service'],
      ['p:src/features/User/', 'upstream', 'help menu items from admin config'],
    ],
    tests: [
      'src/server/services/appSettings/__tests__/',
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
      ['p:src/features/Admin/', 'owned', 'admin feature modules + tests'],
      ['p:src/routes/(main)/admin/', 'owned', 'admin routes'],
      ['p:src/routes/(main)/settings/admin/', 'owned', 'settings admin section'],
      ['p:src/routes/(main)/settings/_layout/index.tsx', 'upstream', 'admin entry for admins'],
      [
        'p:src/features/Admin/DesktopControlCenter/',
        'owned',
        'desktop control center (see desktop-build-profile)',
      ],
      ['p:packages/business-server/src/lambda-routers/admin/', 'owned', '40+ admin router files'],
      ['p:packages/types/src/admin.ts', 'owned', 'admin capability types'],
      ['p:packages/trpc/src/lambda/index.ts', 'upstream', 'admin router mounting'],
      [
        'p:apps/server/src/routers/lambda/index.ts',
        'upstream',
        'admin/redemption/payment router mounting',
      ],
      ['p:apps/server/src/services/user/', 'upstream', 'role in user service'],
      ['p:src/features/NavPanel/', 'upstream', 'admin console path awareness'],
      ['p:src/features/Settings/about/', 'upstream', 'admin-driven about/version content'],
      ['p:src/features/Settings/hooks/useCategory', 'upstream', 'admin settings category'],
      ['p:packages/types/src/user/preference.ts', 'upstream', 'role field'],
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
      ['p:src/libs/better-auth/', 'owned', 'define-config + tests'],
      ['p:src/layout/', 'owned', 'auth layouts not under MarketAuth'],
      ['p:src/app/(backend)/api/auth/', 'upstream', 'better-auth catch-all route'],
      ['p:src/libs/next/', 'upstream', 'proxy locale default + nextjsOnlyRoutes + Link adapter'],
      ['p:src/layout/AuthProvider/MarketAuth/', 'upstream', 'market auth provider + types'],
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
      ['p:src/features/MobileHome/', 'owned', 'mobile home layouts'],
      ['p:src/const/mobileConfig.ts', 'owned', 'mobile config'],
      ['p:src/spa/router/', 'upstream', 'mobileRouter.config + workspace routes'],
      ['p:src/routes/(mobile)/', 'upstream', '16+ mobile pages'],
      ['p:src/features/WorkspaceSetting/', 'upstream', 'category gating (Devices default)'],
      ['p:src/components/server/MobileNavLayout.tsx', 'upstream', 'mobile nav layout'],
      [
        'p:packages/database/src/models/recentMobileWorkspace.ts',
        'owned',
        'extracted: mobile workspace recent query + latest-topics-by-parents (types, cursor codec, SYSTEM_TOPIC_TRIGGERS)',
      ],
      ['p:packages/database/src/models/', 'upstream', 'recent.ts MobileWorkspace query API'],
      [
        'p:apps/server/src/routers/lambda/recent.ts',
        'upstream',
        'mobile workspace recent endpoint',
      ],
      ['p:src/services/recent/', 'upstream', 'recent service'],
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
      ['p:packages/const/src/onboardingAgentTemplates.ts', 'owned', 'const package copy'],
      ['p:src/features/DesktopOnboarding/', 'owned', 'desktop onboarding'],
      ['p:src/features/Onboarding/', 'upstream', 'agent picker + telemetry brand'],
      ['p:src/features/CommunitySkillDetail/', 'upstream', 'skill platform labels'],
      [
        'p:src/routes/(main)/community/',
        'upstream',
        'fork-and-chat buttons, mcp/skill detail pages',
      ],
      ['p:apps/server/src/services/market/', 'upstream', 'market SDK service'],
      ['p:apps/server/src/services/discover/', 'upstream', 'placeholder-description fallbacks'],
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
      ['p:apps/server/src/services/moduleApp', 'owned', '8 moduleApp services'],
      ['p:apps/server/src/workflows/', 'owned', 'moduleApp schedule dispatcher'],
      ['p:packages/database/src/schemas/moduleApp.ts', 'owned', 'schema'],
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
        'p:apps/server/src/router-hono/workflows/task/',
        'upstream',
        'scheduleDispatch moduleApp hook',
      ],
      ['p:apps/server/package.json', 'upstream', 'module-app-build dependency'],
      ['p:apps/desktop/pnpm-workspace.yaml', 'upstream', 'module-app-build workspace entry'],
      ['p:src/routes/(main)/apps/index.tsx', 'upstream', 'apps route → ModuleAppMarket'],
      ['p:e2e/', 'owned', 'module-app production gates'],
    ],
    tests: [
      'apps/module-worker/src/integration.test.ts',
      'src/features/ModuleAppMarket/',
      'apps/server/src/services/moduleApp',
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
      ['p:src/features/HomeSidebar/', 'upstream', 'customize modal, footer, nav entries'],
      ['p:src/features/Home/', 'upstream', 'input area banner gating, agent select defaults'],
      ['p:src/features/Settings/', 'upstream', 'layout/categories/provider filter/SSO/profile'],
      [
        'p:src/features/ModelSwitchPanel/',
        'upstream',
        'multi-provider dedup + price summary + business rating prefetch',
      ],
      ['p:src/features/ModelSelect/', 'upstream', 'selectedValue normalization'],
      ['p:src/features/Conversation/', 'upstream', 'agent meta default name, usage token progress'],
      ['p:src/features/ChatInput/', 'upstream', 'disableMention/disableSlash flags'],
      ['p:src/features/SkillStore/', 'upstream', 'market items normalization + default skill name'],
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
      ['p:src/routes/(main)/', 'upstream', 'home/group/apps/create/memory routes'],
      ['p:src/routes/', 'owned', 'route files not under (main)/(mobile)'],
      ['p:src/store/', 'upstream', 'global/aiInfra/discover/user/image/video/tree/utils slices'],
      ['p:src/hooks/', 'upstream', 'useNavLayout brand entries, useFetchAgentList'],
      [
        'p:src/components/',
        'upstream',
        'ModelSelect priceLabel, StatisticCard, StreamingMarkdown, mdx Image, errorResponse consumers',
      ],
      ['p:src/libs/swr/keys.ts', 'upstream', 'SWR keys'],
      ['p:src/const/', 'owned', 'fork consts not covered elsewhere'],
      ['p:src/types/', 'owned', 'fork types not covered elsewhere'],
      ['p:src/utils/', 'owned', 'fork utils (navigation, errorResponse is upstream)'],
      ['p:src/proxy.ts', 'upstream', 'SPA route list'],
      ['p:packages/app-config/src/routes/', 'upstream', 'nav route catalog (experts/ppt)'],
      ['p:packages/types/src/user/settings/', 'upstream', 'image settings defaults'],
      ['p:apps/server/src/routers/lambda/user.ts', 'upstream', 'avatar preset whitelist'],
      ['p:packages/types/src/', 'upstream', 'types not covered elsewhere'],
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
      ['p:src/app/spa/', 'upstream', 'SPA route with brand injection'],
      ['p:src/types/spaServerConfig', 'upstream', 'SPABrandConfig types'],
      ['p:scripts/copySpaBuildCore.ts', 'owned', 'build copy logic'],
      ['p:scripts/generateSpaTemplates.mts', 'owned', 'template generation'],
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
      ['p:.github/workflows/comhub-', 'owned', 'build/deploy/deploy-worker/pr-check/upstream-sync'],
      [
        'p:.github/workflows/',
        'upstream',
        'tolerance guards in verify-share/verify-workbench/claude-pr-assign; OTA release workflow',
      ],
      ['p:.github/scripts/', 'owned', 'FTS history + bundle gates'],
      ['p:.github/actions/', 'upstream', 'setup-env node pin'],
      ['p:scripts/comhub-upstream-sync/', 'owned', 'sync tooling'],
      ['p:scripts/dockerWorkspaceManifests.test.ts', 'upstream', 'compose manifest contract test'],
      ['p:docker-compose/', 'upstream', 'grafana/prometheus templates (dead minio known)'],
      ['p:Dockerfile', 'upstream', 'COMHUB_* build args'],
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
      ['p:packages/model-bank/package.json', 'upstream', 'export map + observability dep'],
      ['p:packages/observability-otel/', 'upstream', 'electron dep bump'],
      ['p:packages/electron-client-ipc/', 'upstream', 'electron dep bump + execa'],
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
      ['p:packages/local-file-shell/', 'upstream', 'windows content search argv'],
      ['p:packages/agent-runtime/', 'upstream', 'llmErrorClassifier code precedence'],
      ['p:packages/memory-user-memory/', 'upstream', 'structured result parsing'],
      ['p:packages/web-crawler/', 'upstream', 'mode change only'],
      [
        'p:packages/builtin-tool-calculator/',
        'upstream',
        'executor tweaks (representative; sibling builtin-tool-* follow the same rule)',
      ],
      ['p:packages/trpc/src/lambda/', 'upstream', 'clientIp extraction, middleware ordering'],
      ['p:packages/utils/', 'upstream', 'apiKey prefix fallback, url sanitization, responsive'],
      ['p:packages/const/src/settings/', 'upstream', 'autoCreateTopic settings'],
      ['p:packages/const/src/protocol.ts', 'upstream', 'electron protocol const'],
      ['p:packages/openapi/', 'upstream', 'operationId util + chat metadata'],
      ['p:packages/sdk/', 'upstream', 'regenerated client'],
      ['p:packages/env/', 'upstream', 'APP_URL precedence'],
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
      ['p:packages/agent-tracing/', 'upstream', 'cli error surface'],
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
      ['p:apps/server/src/services/memory/', 'upstream', 'extraction config + runtime targets'],
      ['p:apps/server/src/services/taskTemplate/', 'upstream', 'task template tweaks'],
      ['p:apps/server/src/services/toolExecution/', 'upstream', 'memory server runtime'],
      ['p:apps/server/src/services/mcp/', 'upstream', 'content processor'],
      ['p:apps/server/src/router-hono/workflows/', 'upstream', 'qstash client availability guards'],
      ['p:apps/server/src/routers/', 'upstream', 'routers not covered elsewhere'],
      ['p:apps/server/src/', 'upstream', 'catch-all for remaining server files'],
      [
        'p:patches/',
        'upstream',
        'qstash patch (otel caching + error logging); watch for @upstash/qstash floating-resolve rot',
      ],
      ['p:src/libs/qstash/', 'upstream', 'otel client caching'],
      ['p:src/libs/', 'owned', 'fork libs not covered elsewhere'],
      ['p:src/utils/errorResponse', 'upstream', 'internal error sanitization'],
      ['p:packages/model-runtime/', 'upstream', 'see commercial-billing (hooks live there)'],
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
      ['p:.agents/', 'upstream', 'agent skill scripts + skills symlinks'],
      ['p:.claude/', 'upstream', 'skills symlink'],
      ['p:.codex/', 'upstream', 'skills symlink'],
      ['p:.cursor/', 'upstream', 'skills symlink'],
      ['p:.conductor/', 'upstream', 'setup script'],
      ['p:.githooks/', 'upstream', 'pre-commit mode'],
      ['p:.superpowers/', 'owned', 'sdd reports'],
      ['p:.github/', 'upstream', 'CODEOWNERS + repo meta'],
      ['p:package.json', 'upstream', 'root scripts/deps'],
      ['p:tsconfig.json', 'upstream', 'paths block'],
      ['p:vitest.config.mts', 'upstream', 'aliases + excludes'],
      ['p:drizzle.config.ts', 'upstream', 'drizzle config'],
      ['p:plugins/vite/', 'upstream', 'node module stub'],
      ['p:packages/database/vitest.config.mts', 'upstream', 'db test aliases'],
      ['p:packages/database/package.json', 'upstream', 'exports'],
      ['p:packages/types/src/index.ts', 'upstream', 'type re-exports'],
      ['p:packages/business-server/package.json', 'upstream', 'test scripts + deps'],
      ['p:packages/business-server/vitest.config.mts', 'owned', 'business-server tests'],
      ['p:pnpm-lock.yaml', 'owned', 'root lockfile'],
      ['p:tests/', 'owned', 'shared test mocks/utils'],
      ['p:docs/', 'owned', 'fork docs (ledger lives in repo-infra entry)'],
      ['p:scripts/', 'upstream', 'root scripts not covered elsewhere'],
      ['p:apps/server/', 'owned', 'server app shell files'],
      ['p:apps/auth/', 'owned', 'auth app scripts'],
      ['p:apps/cli/', 'owned', 'cli app'],
      ['p:apps/share/', 'owned', 'share app'],
      ['p:apps/workbench/', 'owned', 'workbench app'],
      ['p:README.md', 'upstream', 'fork readme rewrite'],
      ['p:SECURITY.md', 'upstream', 'fork security policy'],
      ['p:CONTRIBUTING.md', 'upstream', 'fork contributing'],
      ['p:AGENTS.md', 'upstream', 'agent instructions'],
      ['p:CLAUDE.md', 'upstream', 'claude instructions'],
      ['p:.dockerignore', 'upstream', 'docker ignore list'],
      ['p:.gitignore', 'upstream', 'ignore list'],
      ['p:.env.example', 'upstream', 'env docs'],
      ['p:.env.desktop', 'upstream', 'desktop env'],
    ],
    tests: [],
    notes:
      'Plumbing; rarely conflicts semantically. The customization ledger (docs/development/comhub-upstream-customizations.md) is the historical narrative; this registry is the machine-readable truth.',
  },
];

export const UPSTREAM_BASELINE_TAG = 'v2.2.18';

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
