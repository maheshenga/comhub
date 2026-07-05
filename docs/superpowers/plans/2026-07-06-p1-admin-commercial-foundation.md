# P1 Admin Commercial Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the highest-risk admin commercial configuration paths consistent: shared setting keys, explicit cache refresh, AI provider pricing clarity, and provider-grouped model labels.

**Architecture:** Keep the existing database schema and admin pages. Add a shared setting-key registry that both server and admin UI import, add a server-side admin cache refresh mutation, keep AI-provider pricing metadata as official cost with one platform margin multiplier, and normalize model option labels so UUID-backed provider ids never leak into admin selectors.

**Tech Stack:** Next.js 16, React 19, TypeScript, tRPC, Drizzle ORM, SWR, antd, Vitest.

---

## File Structure

- Create `src/const/appSettingsRegistry.ts`: one shared setting-key object plus lightweight domain metadata.
- Modify `src/server/services/appSettings/index.ts`: import and re-export the shared setting keys instead of owning a duplicate object.
- Modify `src/features/Admin/adminSettingsForm.ts`: import the shared setting keys and fix provider/model option label formatting.
- Modify `src/features/Admin/AdminSystemDefaultsPage.tsx`: import the shared keys and use grouped provider/model labels from `adminSettingsForm`.
- Modify `packages/business-server/src/lambda-routers/admin/settings.ts`: add a `refreshRuntimeCaches` admin mutation that invalidates app settings, S3, and NewAPI runtime caches.
- Modify `src/services/adminCommercial.ts`: add a client wrapper for the cache refresh mutation.
- Modify `src/features/Admin/AdminSystemMaintenancePage.tsx`: add a "refresh user/admin runtime cache" action.
- Modify `src/features/Admin/adminProviderModelPricing.tsx`: make manual pricing metadata explicit as official cost and display the 35 percent platform margin estimate.
- Modify `src/features/Admin/AdminProvidersPage.tsx`: show missing pricing warnings and label provider pricing sync behavior.
- Update tests:
  - `src/features/Admin/adminSettingsForm.test.ts`
  - `src/features/Admin/adminProviderModelPricing.test.tsx` or nearest existing admin flow test
  - `packages/business-server/src/lambda-routers/admin/settings.test.ts`
  - `src/server/services/appSettings/index.test.ts`
  - `src/server/services/newapiInstance/index.test.ts`

---

### Task 1: Shared Setting Registry

**Files:**
- Create: `src/const/appSettingsRegistry.ts`
- Modify: `src/server/services/appSettings/index.ts`
- Modify: `src/features/Admin/adminSettingsForm.ts`
- Test: `src/server/services/appSettings/index.test.ts`
- Test: `src/features/Admin/adminSettingsForm.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions:

```ts
// src/server/services/appSettings/index.test.ts
import { describe, expect, it } from 'vitest';

import {
  APP_SETTING_KEYS,
  getAppSettingRegistryItem,
  isSensitiveAppSettingKey,
} from './index';

describe('app setting registry', () => {
  it('exposes shared keys and domain metadata', () => {
    expect(APP_SETTING_KEYS.brandName).toBe('brand.name');
    expect(getAppSettingRegistryItem(APP_SETTING_KEYS.brandName)).toMatchObject({
      domain: 'brand',
      publicRuntime: true,
    });
  });

  it('marks sensitive setting keys', () => {
    expect(isSensitiveAppSettingKey(APP_SETTING_KEYS.composioApiKey)).toBe(true);
    expect(isSensitiveAppSettingKey(APP_SETTING_KEYS.brandName)).toBe(false);
  });
});
```

Update `src/features/Admin/adminSettingsForm.test.ts`:

```ts
it('uses the shared app setting key registry', () => {
  expect(SETTING_KEYS.brandName).toBe('brand.name');
  expect(SETTING_KEYS.desktopDownloadUrl).toBe('desktop.download.url');
});
```

Run:

```bash
bunx vitest run --silent='passed-only' src/server/services/appSettings/index.test.ts src/features/Admin/adminSettingsForm.test.ts
```

Expected: FAIL because registry helpers are missing and the admin form still owns a local key object.

- [ ] **Step 2: Add shared registry**

Create `src/const/appSettingsRegistry.ts` with:

```ts
export const APP_SETTING_KEYS = {
  authSignupDisabledMessage: 'auth.signup.disabledMessage',
  authSignupEnabled: 'auth.signup.enabled',
  authSignupPhoneEnabled: 'auth.signup.phoneEnabled',
  aboutLinks: 'about.links',
  aboutLogoUrl: 'about.logoUrl',
  aboutPage: 'about.page',
  brandFaviconUrl: 'brand.faviconUrl',
  brandAuthTitle: 'brand.authTitle',
  brandCopyrightText: 'brand.copyrightText',
  brandLoadingText: 'brand.loadingText',
  brandLoadingSvgUrl: 'brand.loadingSvgUrl',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  communityForkAndChatLabel: 'community.forkAndChat.label',
  communitySkillUseButtonLabel: 'community.skill.useButton.label',
  communityCreatorRewardBannerEnabled: 'community.creatorRewardBanner.enabled',
  communityFeaturedAssistantPageSize: 'community.featuredAssistant.pageSize',
  communityFeaturedAssistantTitle: 'community.featuredAssistant.title',
  communityFeaturedAssistantsEnabled: 'community.featuredAssistants.enabled',
  communityFeaturedMcpPageSize: 'community.featuredMcp.pageSize',
  communityFeaturedMcpTitle: 'community.featuredMcp.title',
  communityFeaturedMcpsEnabled: 'community.featuredMcps.enabled',
  communityFeaturedSkillCategory: 'community.featuredSkill.category',
  communityFeaturedSkillPageSize: 'community.featuredSkill.pageSize',
  communityFeaturedSkillSort: 'community.featuredSkill.sort',
  communityFeaturedSkillTitle: 'community.featuredSkill.title',
  communityFeaturedSkillsEnabled: 'community.featuredSkills.enabled',
  communityHomeAnnouncementContent: 'community.homeAnnouncement.content',
  communityHomeAnnouncementEnabled: 'community.homeAnnouncement.enabled',
  communityHomeAnnouncementTitle: 'community.homeAnnouncement.title',
  communityHomeAnnouncementType: 'community.homeAnnouncement.type',
  composioApiKey: 'composio.apiKey',
  composioAuthConfigIds: 'composio.authConfigIds',
  composioEnabled: 'composio.enabled',
  cronAuditRetentionDays: 'cron.auditRetentionDays',
  cronPendingOrderExpiryDays: 'cron.pendingOrderExpiryDays',
  cronSecret: 'cron.secret',
  defaultAgentAvatar: 'defaultAgent.avatar',
  defaultAgentModel: 'defaultAgent.model',
  defaultAgentName: 'defaultAgent.name',
  defaultAgentProvider: 'defaultAgent.provider',
  defaultImageModel: 'defaultImage.model',
  defaultImageProvider: 'defaultImage.provider',
  defaultSkillName: 'defaultSkill.name',
  defaultVideoModel: 'defaultVideo.model',
  defaultVideoProvider: 'defaultVideo.provider',
  desktopDownloadLabel: 'desktop.download.label',
  desktopDownloadUrl: 'desktop.download.url',
  desktopLoginCloudButtonLabel: 'desktop.login.cloudButtonLabel',
  desktopLoginDescription: 'desktop.login.description',
  desktopLoginFooterText: 'desktop.login.footerText',
  desktopLoginLogoUrl: 'desktop.login.logoUrl',
  desktopLoginTitle: 'desktop.login.title',
  desktopLoginWindowTitle: 'desktop.login.windowTitle',
  desktopOssAccessKeyId: 'desktop.oss.accessKeyId',
  desktopOssAccessKeySecret: 'desktop.oss.accessKeySecret',
  desktopOssBucket: 'desktop.oss.bucket',
  desktopOssEndpoint: 'desktop.oss.endpoint',
  desktopOssPath: 'desktop.oss.path',
  desktopUpdateAutoCheck: 'desktop.update.autoCheck',
  desktopUpdateChannel: 'desktop.update.channel',
  desktopUpdateCheckInterval: 'desktop.update.checkInterval',
  desktopUpdateCurrentVersion: 'desktop.update.currentVersion',
  desktopUpdateReleaseNotes: 'desktop.update.releaseNotes',
  desktopUpdateServerUrl: 'desktop.update.serverUrl',
  docmeePptAllowPdfExport: 'docmee.ppt.allowPdfExport',
  docmeePptAllowPptxDownload: 'docmee.ppt.allowPptxDownload',
  docmeePptApiKey: 'docmee.ppt.apiKey',
  docmeePptAuditEnabled: 'docmee.ppt.auditEnabled',
  docmeePptBaseUrl: 'docmee.ppt.baseUrl',
  docmeePptCreatorVersion: 'docmee.ppt.creatorVersion',
  docmeePptDailyLimit: 'docmee.ppt.dailyLimit',
  docmeePptDefaultLang: 'docmee.ppt.defaultLang',
  docmeePptEnabled: 'docmee.ppt.enabled',
  docmeePptThemeColor: 'docmee.ppt.themeColor',
  docmeePptTokenTtlMinutes: 'docmee.ppt.tokenTtlMinutes',
  expertPlazaCards: 'expertPlaza.cards',
  expertPlazaCategories: 'expertPlaza.categories',
  expertPlazaDescription: 'expertPlaza.description',
  expertPlazaEnabled: 'expertPlaza.enabled',
  expertPlazaName: 'expertPlaza.name',
  homeMessengerEnabled: 'home.messenger.enabled',
  homeMessengerBannerTitle: 'home.messengerBanner.title',
  helpMenuItems: 'help.menu.items',
  memoryUserMemoryEmbeddingModel: 'memory.userMemory.embedding.model',
  memoryUserMemoryEmbeddingProvider: 'memory.userMemory.embedding.provider',
  memoryUserMemoryGatekeeperModel: 'memory.userMemory.gatekeeper.model',
  memoryUserMemoryGatekeeperProvider: 'memory.userMemory.gatekeeper.provider',
  memoryUserMemoryLayerExtractorModel: 'memory.userMemory.layerExtractor.model',
  memoryUserMemoryLayerExtractorProvider: 'memory.userMemory.layerExtractor.provider',
  memoryUserMemoryPersonaWriterModel: 'memory.userMemory.personaWriter.model',
  memoryUserMemoryPersonaWriterProvider: 'memory.userMemory.personaWriter.provider',
  memoryUserMemoryTriggerMode: 'memory.userMemory.triggerMode',
  notificationDesktopEnabled: 'notification.desktop.enabled',
  notificationEmailEnabled: 'notification.email.enabled',
  notificationEventDefaults: 'notification.eventDefaults',
  notificationInboxEnabled: 'notification.inbox.enabled',
  notificationPushEnabled: 'notification.push.enabled',
  notificationRetentionDays: 'notification.retentionDays',
  notificationSystemActionLabel: 'notification.system.actionLabel',
  notificationSystemActionUrl: 'notification.system.actionUrl',
  notificationSystemContent: 'notification.system.content',
  notificationSystemEnabled: 'notification.system.enabled',
  notificationSystemTitle: 'notification.system.title',
  notificationSystemType: 'notification.system.type',
  profileAvatarPresets: 'profile.avatarPresets',
  profileInterestAreas: 'profile.interestAreas',
  modelPolicyAllowlist: 'model.policy.allowlist',
  modelPolicyApplyToEmbeddings: 'model.policy.applyToEmbeddings',
  modelPolicyApplyToGenerateObject: 'model.policy.applyToGenerateObject',
  modelPolicyBlocklist: 'model.policy.blocklist',
  modelPolicyDefaultModelFallback: 'model.policy.defaultModelFallback',
  modelPolicyDeniedMessage: 'model.policy.deniedMessage',
  modelPolicyEnabled: 'model.policy.enabled',
  modelPolicyMode: 'model.policy.mode',
  onboardingInitialCredits: 'onboarding.initialCredits',
  onboardingInitialCreditsEnabled: 'onboarding.initialCredits.enabled',
  ordersManagementEnabled: 'orders.management.enabled',
  pricingCreditMultiplier: 'pricing.creditMultiplier',
  pricingModelRules: 'pricing.modelRules',
  recommendationAssistantTags: 'recommendation.assistantTags',
  recommendationAssistantTitle: 'recommendation.assistantTitle',
  recommendationAssistantsEnabled: 'recommendation.assistants.enabled',
  recommendationGeneralSkillCategories: 'recommendation.generalSkillCategories',
  recommendationGeneralSkillTitle: 'recommendation.generalSkillTitle',
  recommendationGeneralSkillsEnabled: 'recommendation.generalSkills.enabled',
  recommendationHotSkillSort: 'recommendation.hotSkillSort',
  recommendationHotSkillTitle: 'recommendation.hotSkillTitle',
  recommendationHotSkillsEnabled: 'recommendation.hotSkills.enabled',
  recommendationMcpCategories: 'recommendation.mcpCategories',
  recommendationMcpTitle: 'recommendation.mcpTitle',
  recommendationMcpsEnabled: 'recommendation.mcps.enabled',
  recommendationSectionEnabled: 'recommendation.section.enabled',
  recommendationSelectedTags: 'recommendation.selectedTags',
  recommendationSkillCategories: 'recommendation.skillCategories',
  recommendationSkillTitle: 'recommendation.skillTitle',
  recommendationSkillsEnabled: 'recommendation.skills.enabled',
  referralRewardCredits: 'referral.rewardCredits',
  storageS3AccessKeyId: 'storage.s3.accessKeyId',
  storageS3Bucket: 'storage.s3.bucket',
  storageS3EnablePathStyle: 'storage.s3.enablePathStyle',
  storageS3Endpoint: 'storage.s3.endpoint',
  storageS3FilePath: 'storage.s3.filePath',
  storageS3PreviewUrlExpireIn: 'storage.s3.previewUrlExpireIn',
  storageS3PublicDomain: 'storage.s3.publicDomain',
  storageS3Region: 'storage.s3.region',
  storageS3SecretAccessKey: 'storage.s3.secretAccessKey',
  storageS3SetAcl: 'storage.s3.setAcl',
  sidebarGenerationLabel: 'sidebar.generation.label',
  sidebarMemberLabel: 'sidebar.member.label',
  sidebarMemberUrl: 'sidebar.member.url',
  uploadMaxActualSizeMb: 'upload.maxActualSizeMb',
  uploadMaxInputSizeMb: 'upload.maxInputSizeMb',
  userGlobalSettingsDefaults: 'user.globalSettings.defaults',
  vectorEmbeddingModel: 'vector.embedding.model',
  vectorEmbeddingProvider: 'vector.embedding.provider',
  vectorQueryMode: 'vector.queryMode',
  vectorRerankerModel: 'vector.reranker.model',
  vectorRerankerProvider: 'vector.reranker.provider',
} as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS];
export type AppSettingDomain =
  | 'about'
  | 'auth'
  | 'brand'
  | 'client'
  | 'composio'
  | 'content'
  | 'growth'
  | 'model'
  | 'notification'
  | 'operations'
  | 'pricing'
  | 'storage'
  | 'system'
  | 'user-defaults';

export type AppSettingRegistryItem = {
  cacheScopes: Array<'app-settings' | 'brand' | 'runtime' | 's3' | 'user-state'>;
  domain: AppSettingDomain;
  key: AppSettingKey;
  publicRuntime: boolean;
  sensitive: boolean;
};

const inferDomain = (key: AppSettingKey): AppSettingDomain => {
  if (key.startsWith('about.')) return 'about';
  if (key.startsWith('auth.') || key.startsWith('onboarding.') || key.startsWith('upload.')) return 'growth';
  if (key.startsWith('brand.') || key.startsWith('sidebar.') || key.startsWith('home.')) return 'brand';
  if (key.startsWith('desktop.')) return 'client';
  if (key.startsWith('composio.')) return 'composio';
  if (key.startsWith('community.') || key.startsWith('recommendation.') || key.startsWith('expertPlaza.')) return 'content';
  if (key.startsWith('notification.')) return 'notification';
  if (key.startsWith('model.') || key.startsWith('default') || key.startsWith('memory.') || key.startsWith('vector.')) return 'model';
  if (key.startsWith('pricing.')) return 'pricing';
  if (key.startsWith('storage.')) return 'storage';
  if (key.startsWith('user.')) return 'user-defaults';
  if (key.startsWith('profile.')) return 'user-defaults';
  if (key.startsWith('orders.') || key.startsWith('referral.')) return 'operations';
  return 'system';
};

const SENSITIVE_KEYS = new Set<AppSettingKey>([
  APP_SETTING_KEYS.composioApiKey,
  APP_SETTING_KEYS.cronSecret,
  APP_SETTING_KEYS.desktopOssAccessKeySecret,
  APP_SETTING_KEYS.docmeePptApiKey,
  APP_SETTING_KEYS.storageS3SecretAccessKey,
]);

const PUBLIC_PREFIXES = ['about.', 'brand.', 'community.', 'desktop.download.', 'help.', 'home.', 'sidebar.'];

const getCacheScopes = (key: AppSettingKey): AppSettingRegistryItem['cacheScopes'] => {
  const scopes: AppSettingRegistryItem['cacheScopes'] = ['app-settings'];
  if (key.startsWith('brand.') || key.startsWith('about.') || key.startsWith('sidebar.') || key.startsWith('home.')) {
    scopes.push('brand');
  }
  if (
    key.startsWith('default') ||
    key.startsWith('memory.') ||
    key.startsWith('model.') ||
    key.startsWith('pricing.') ||
    key.startsWith('user.') ||
    key.startsWith('vector.')
  ) {
    scopes.push('runtime');
  }
  if (key.startsWith('storage.')) scopes.push('s3');
  if (key === APP_SETTING_KEYS.userGlobalSettingsDefaults) scopes.push('user-state');
  return Array.from(new Set(scopes));
};

export const APP_SETTING_REGISTRY: Record<AppSettingKey, AppSettingRegistryItem> = Object.fromEntries(
  Object.values(APP_SETTING_KEYS).map((key) => [
    key,
    {
      cacheScopes: getCacheScopes(key),
      domain: inferDomain(key),
      key,
      publicRuntime: PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix)),
      sensitive: SENSITIVE_KEYS.has(key),
    },
  ]),
) as Record<AppSettingKey, AppSettingRegistryItem>;

export const getAppSettingRegistryItem = (key: AppSettingKey | string) =>
  APP_SETTING_REGISTRY[key as AppSettingKey];

export const isSensitiveAppSettingKey = (key: AppSettingKey | string) =>
  getAppSettingRegistryItem(key)?.sensitive === true;
```

- [ ] **Step 3: Re-export from server service**

In `src/server/services/appSettings/index.ts`, delete the local `APP_SETTING_KEYS` object and add:

```ts
export {
  APP_SETTING_KEYS,
  APP_SETTING_REGISTRY,
  getAppSettingRegistryItem,
  isSensitiveAppSettingKey,
  type AppSettingKey,
} from '@/const/appSettingsRegistry';
```

- [ ] **Step 4: Use shared keys in admin form**

In `src/features/Admin/adminSettingsForm.ts`, replace the local `SETTING_KEYS` object with:

```ts
import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';

export const SETTING_KEYS = APP_SETTING_KEYS;
```

- [ ] **Step 5: Run tests**

Run:

```bash
bunx vitest run --silent='passed-only' src/server/services/appSettings/index.test.ts src/features/Admin/adminSettingsForm.test.ts
```

Expected: PASS.

---

### Task 2: Admin Runtime Cache Refresh

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/features/Admin/AdminSystemMaintenancePage.tsx`
- Test: `packages/business-server/src/lambda-routers/admin/settings.test.ts`

- [ ] **Step 1: Write failing backend test**

Add to `settings.test.ts`:

```ts
it('refreshes runtime caches on admin request', async () => {
  const db = createDb();
  vi.mocked(getServerDB).mockResolvedValue(db);

  const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
  const result = await caller.refreshRuntimeCaches();

  expect(result).toEqual({
    ok: true,
    refreshed: ['app-settings', 'newapi-instances', 's3-runtime'],
  });
  expect(invalidateFileS3RuntimeCache).toHaveBeenCalledTimes(1);
});
```

Run:

```bash
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts
```

Expected: FAIL because `refreshRuntimeCaches` is missing.

- [ ] **Step 2: Add backend mutation**

In `settings.ts`, import:

```ts
import { invalidateNewapiInstancesCache } from '@/server/services/newapiInstance';
```

Add mutation:

```ts
refreshRuntimeCaches: adminProcedure.mutation(async ({ ctx }) => {
  invalidateServerAppSettings();
  invalidateFileS3RuntimeCache();
  invalidateNewapiInstancesCache();

  const refreshed = ['app-settings', 'newapi-instances', 's3-runtime'] as const;
  await recordAdminAudit(ctx, {
    action: 'settings.refreshRuntimeCaches',
    payload: { refreshed },
    resourceType: 'app_setting',
  });

  return { ok: true, refreshed };
}),
```

- [ ] **Step 3: Add client service wrapper**

In `src/services/adminCommercial.ts`:

```ts
refreshRuntimeCaches = async () => {
  return lambdaClient.admin.settings.refreshRuntimeCaches.mutate();
};
```

- [ ] **Step 4: Add maintenance UI action**

In `src/features/Admin/AdminSystemMaintenancePage.tsx`, add a button near the other maintenance actions:

```tsx
<Button loading={refreshingCaches} onClick={handleRefreshRuntimeCaches}>
  刷新用户端配置缓存
</Button>
```

Use this handler:

```ts
const handleRefreshRuntimeCaches = async () => {
  setRefreshingCaches(true);
  try {
    const result = await adminCommercialService.refreshRuntimeCaches();
    message.success(`已刷新 ${result.refreshed.length} 类运行时缓存`);
  } catch {
    message.error('刷新缓存失败');
  } finally {
    setRefreshingCaches(false);
  }
};
```

- [ ] **Step 5: Run tests**

Run:

```bash
bunx vitest run --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts
```

Expected: PASS.

---

### Task 3: Provider-Grouped Model Labels

**Files:**
- Modify: `src/features/Admin/adminSettingsForm.ts`
- Modify: `src/features/Admin/AdminSystemDefaultsPage.tsx`
- Test: `src/features/Admin/adminSettingsForm.test.ts`

- [ ] **Step 1: Write failing label tests**

Update `adminSettingsForm.test.ts` to assert ASCII-safe, provider-grouped labels:

```ts
it('shows provider type and instance group without leaking UUID provider ids', () => {
  const options = buildModelOptions({
    enabledNewapiModels: [
      {
        displayName: 'Qwen Coder',
        instanceName: 'OpenCode Gateway',
        modelId: 'qwen-coder',
        modelType: 'chat',
        provider: '757e1732-8478-4c93-a4dd-1e17489a9c48',
        providerType: 'opencode-go',
      },
    ],
  });

  expect(options[0]).toMatchObject({
    label: 'Qwen Coder (opencode-go / OpenCode Gateway / chat)',
    providerLabel: 'opencode-go / OpenCode Gateway',
    value: '757e1732-8478-4c93-a4dd-1e17489a9c48:qwen-coder',
  });
  expect(options[0].label).not.toContain('757e1732');
});
```

Run:

```bash
bunx vitest run --silent='passed-only' src/features/Admin/adminSettingsForm.test.ts
```

Expected: FAIL until label builders are normalized.

- [ ] **Step 2: Fix label builders**

In `adminSettingsForm.ts`, replace `buildManagedModelOptionLabel` and `buildManagedProviderLabel` with:

```ts
const normalizeManagedProviderParts = ({
  instanceName,
  provider,
  providerType,
}: {
  instanceName: string;
  provider: string;
  providerType: string;
}) => {
  const baseProvider = providerType || (legacyProviderIdPattern.test(provider) ? 'newapi' : provider);
  return [baseProvider, instanceName].filter(Boolean);
};

const buildManagedModelOptionLabel = ({
  instanceName,
  modelType,
  name,
  provider,
  providerType,
}: {
  instanceName: string;
  modelType: string;
  name: string;
  provider: string;
  providerType: string;
}) => {
  const providerParts = normalizeManagedProviderParts({ instanceName, provider, providerType });
  return `${name} (${[...providerParts, modelType].join(' / ')})`;
};

const buildManagedProviderLabel = ({
  instanceName,
  provider,
  providerType,
}: {
  instanceName: string;
  provider: string;
  providerType: string;
}) => normalizeManagedProviderParts({ instanceName, provider, providerType }).join(' / ');
```

- [ ] **Step 3: Ensure system default provider selects use the grouped label**

In `AdminSystemDefaultsPage.tsx`, keep `buildProviderOptions` deriving labels from `resolveModelProviderLabel`, and ensure no local provider label fallback uses raw UUIDs.

- [ ] **Step 4: Run tests**

Run:

```bash
bunx vitest run --silent='passed-only' src/features/Admin/adminSettingsForm.test.ts
```

Expected: PASS.

---

### Task 4: AI Provider Pricing Clarity

**Files:**
- Modify: `src/features/Admin/adminProviderModelPricing.tsx`
- Modify: `src/features/Admin/AdminProvidersPage.tsx`
- Modify: `src/server/services/newapiInstance/index.ts`
- Test: `src/server/services/newapiInstance/index.test.ts`
- Test: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Write failing runtime pricing tests**

Update `src/server/services/newapiInstance/index.test.ts`:

```ts
it('keeps manual pricing as official cost and relies on billing multiplier for margin', async () => {
  const db = createDb([
    {
      displayName: 'Manual Cost Model',
      groupKey: 'basic',
      groupName: 'Basic',
      instanceId: 'basic-1',
      instanceName: 'Basic Gateway',
      metadata: {
        manualPricing: {
          inputCostRate: 1.2,
          marginMultiplier: 1.35,
          outputCostRate: 3.4,
          source: 'admin-manual',
        },
      },
      modelId: 'manual-cost-model',
      modelType: 'chat',
      providerType: 'newapi',
    },
  ]);

  await expect(getAllEnabledModels(db)).resolves.toEqual([
    expect.objectContaining({
      pricing: {
        units: [
          expect.objectContaining({ originalRate: 1.2, rate: 1.2 }),
          expect.objectContaining({ originalRate: 3.4, rate: 3.4 }),
        ],
      },
    }),
  ]);
});
```

Expected: FAIL because current pricing multiplies rates by `marginMultiplier`.

- [ ] **Step 2: Store and expose manual pricing as official cost**

In `src/server/services/newapiInstance/index.ts`, change `resolveManualPricing` so `rate` equals the official cost rate and `originalRate` equals the same value. Keep `marginMultiplier` in metadata for audit/display, but do not multiply model-card rates there. The commercial billing multiplier applies the 35 percent profit once.

Expected implementation shape:

```ts
const inputRetailRate = inputRate;
// use inputRetailRate for `rate`, not inputRate * marginMultiplier
```

- [ ] **Step 3: Make admin pricing labels explicit**

In `adminProviderModelPricing.tsx`, keep `buildManualTokenPricingMetadata` storing official cost fields. Change labels to say:

```tsx
{t('admin.providers.models.pricing.estimate', '官方成本：输入 {{input}} / 输出 {{output}}；默认利润后：输入 {{retailInput}} / 输出 {{retailOutput}}', {
  input: formatRate(draftInputCostRate ?? undefined),
  output: formatRate(draftOutputCostRate ?? undefined),
  retailInput: formatRate(draftInputCostRate ? draftInputCostRate * DEFAULT_PRICING_MARGIN_MULTIPLIER : undefined),
  retailOutput: formatRate(draftOutputCostRate ? draftOutputCostRate * DEFAULT_PRICING_MARGIN_MULTIPLIER : undefined),
})}
```

- [ ] **Step 4: Add missing-pricing warning in provider model list**

In `AdminProvidersPage.tsx`, when `metadata.pricingAvailable !== true` and no `metadata.manualPricing`, show a warning tag in the pricing column:

```tsx
{!hasSyncedOrManualPricing(r.metadata) ? <Tag color="orange">未设置价格</Tag> : null}
```

- [ ] **Step 5: Run tests**

Run:

```bash
bunx vitest run --silent='passed-only' src/server/services/newapiInstance/index.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Expected: PASS.

---

### Task 5: P1 Verification, Review, and Commit

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run P1 focused tests**

Run:

```bash
bunx vitest run --silent='passed-only' src/server/services/appSettings/index.test.ts src/features/Admin/adminSettingsForm.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/server/services/newapiInstance/index.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Request two-stage review**

Dispatch one reviewer for spec compliance against this plan and one reviewer for code quality against the P1 diff.

- [ ] **Step 4: Fix review findings**

Fix Critical and Important findings. Re-run the focused tests after fixes.

- [ ] **Step 5: Commit P1**

Run:

```bash
git status --short
git add docs/superpowers/plans/2026-07-06-p1-admin-commercial-foundation.md src/const/appSettingsRegistry.ts src/server/services/appSettings/index.ts src/features/Admin/adminSettingsForm.ts src/features/Admin/AdminSystemDefaultsPage.tsx packages/business-server/src/lambda-routers/admin/settings.ts src/services/adminCommercial.ts src/features/Admin/AdminSystemMaintenancePage.tsx src/features/Admin/adminProviderModelPricing.tsx src/features/Admin/AdminProvidersPage.tsx src/server/services/newapiInstance/index.ts src/server/services/appSettings/index.test.ts src/features/Admin/adminSettingsForm.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/server/services/newapiInstance/index.test.ts src/features/Admin/adminCommercialFlow.test.ts
git commit -m "Improve admin commercial configuration foundation"
```

Expected: one P1 commit on top of the current branch.
