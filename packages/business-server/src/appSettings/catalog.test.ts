import { describe, expect, it } from 'vitest';

import { normalizeAboutLinksConfig, normalizeAboutPageConfig } from '@/const/aboutLinks';
import { normalizeAvatarPresets } from '@/const/avatarPresets';
import { normalizePlanFaqSettings } from '@/const/billingPresentation';
import { normalizeExpertPlazaCards } from '@/const/expertPlaza';
import { normalizeHelpMenuItems } from '@/const/helpMenu';
import { normalizeNotificationEventDefaults } from '@/const/notificationPreferences';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import {
  APP_SETTINGS_CATALOG,
  APP_SETTINGS_SECTION_KEYS,
  GENERIC_WRITABLE_APP_SETTING_KEYS,
  getAppSettingCatalogItem,
  normalizeAppSettingValue,
  PPT_WRITABLE_APP_SETTING_KEYS,
  WRITABLE_APP_SETTING_KEYS,
} from './catalog';

const GENERIC_WRITE_SURFACE = 'adminSettingsRouter.setAppSetting';
const PPT_WRITE_SURFACE = 'adminPptRouter.saveSettings';

const catalogItem = (key: string) => {
  const item = getAppSettingCatalogItem(key);
  expect(item).toBeDefined();
  return item!;
};

describe('APP_SETTINGS_CATALOG', () => {
  it('gives every registered setting one owner and complete active editable governance', () => {
    const registeredKeys = Object.values(APP_SETTING_KEYS).sort();
    const catalogKeys = APP_SETTINGS_CATALOG.map((item) => item.key).sort();

    expect(catalogKeys).toEqual(registeredKeys);
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);

    for (const setting of APP_SETTINGS_CATALOG) {
      expect(setting.defaultSource).toBeTruthy();
      expect(setting.effectiveSource).toBeTruthy();
      expect(setting.auditPolicy).toBeTruthy();
      expect(setting.cacheScopes).toContain('app-settings');
      expect(setting.section).toBeTruthy();
      expect(setting.valueSchema).toBeTruthy();

      if (setting.lifecycle === 'active' && setting.writable) {
        expect(setting.normalizeValue).toBeTypeOf('function');
        expect(setting.runtimeConsumers.length).toBeGreaterThan(0);
      }

      if (setting.ownership === 'external') {
        expect(setting.writable).toBe(false);
        expect(setting.lifecycle).toBe('external');
      }
    }

    expect(APP_SETTINGS_SECTION_KEYS.notifications).toContain(
      APP_SETTING_KEYS.notificationRetentionDays,
    );
    expect(
      Object.values(APP_SETTINGS_SECTION_KEYS).filter((keys) =>
        keys.includes(APP_SETTING_KEYS.notificationRetentionDays),
      ),
    ).toHaveLength(1);
    expect(WRITABLE_APP_SETTING_KEYS).not.toContain(APP_SETTING_KEYS.desktopOssAccessKeySecret);
  });

  it('declares exact environment fallback order for S3 and Composio settings', () => {
    const expectedS3Sources = new Map<string, string[]>([
      [APP_SETTING_KEYS.storageS3AccessKeyId, ['environment:S3_ACCESS_KEY_ID']],
      [APP_SETTING_KEYS.storageS3Bucket, ['environment:S3_BUCKET']],
      [
        APP_SETTING_KEYS.storageS3EnablePathStyle,
        ['environment:S3_ENABLE_PATH_STYLE', 'application-default'],
      ],
      [APP_SETTING_KEYS.storageS3Endpoint, ['environment:S3_ENDPOINT']],
      [
        APP_SETTING_KEYS.storageS3FilePath,
        ['environment:NEXT_PUBLIC_S3_FILE_PATH', 'application-default'],
      ],
      [
        APP_SETTING_KEYS.storageS3PreviewUrlExpireIn,
        ['environment:S3_PREVIEW_URL_EXPIRE_IN', 'application-default'],
      ],
      [
        APP_SETTING_KEYS.storageS3PublicDomain,
        ['environment:S3_PUBLIC_DOMAIN', 'environment:NEXT_PUBLIC_S3_DOMAIN'],
      ],
      [APP_SETTING_KEYS.storageS3Region, ['environment:S3_REGION']],
      [APP_SETTING_KEYS.storageS3SecretAccessKey, ['environment:S3_SECRET_ACCESS_KEY']],
      [
        APP_SETTING_KEYS.storageS3SetAcl,
        ['environment:S3_SET_ACL', 'application-default'],
      ],
    ]);

    for (const [key, fallbacks] of expectedS3Sources) {
      expect(catalogItem(key).effectiveSource).toEqual([`database:${key}`, ...fallbacks]);
    }

    expect(catalogItem(APP_SETTING_KEYS.storageS3AccessKeyId).defaultSource).toBe(
      'environment:S3_ACCESS_KEY_ID',
    );
    expect(catalogItem(APP_SETTING_KEYS.composioEnabled)).toMatchObject({
      defaultSource: 'derived:composio.apiKey-or-application-default',
      effectiveSource: [
        `database:${APP_SETTING_KEYS.composioEnabled}`,
        'environment:COMPOSIO_ENABLED',
        `database:${APP_SETTING_KEYS.composioApiKey}`,
        'environment:COMPOSIO_API_KEY',
        'application-default',
      ],
    });
    expect(catalogItem(APP_SETTING_KEYS.composioAuthConfigIds)).toMatchObject({
      defaultSource: 'environment:COMPOSIO_AUTH_CONFIG_IDS',
      effectiveSource: [
        `database:${APP_SETTING_KEYS.composioAuthConfigIds}`,
        'environment:COMPOSIO_AUTH_CONFIG_IDS',
      ],
    });
    expect(catalogItem(APP_SETTING_KEYS.cronSecret).effectiveSource).toEqual([
      `database:${APP_SETTING_KEYS.cronSecret}`,
      'environment:CRON_SECRET',
    ]);
    expect(catalogItem(APP_SETTING_KEYS.memoryUserMemoryTriggerMode).effectiveSource).toEqual([
      'environment:MEMORY_USER_MEMORY_TRIGGER_MODE',
      `database:${APP_SETTING_KEYS.memoryUserMemoryTriggerMode}`,
      'application-default',
    ]);

    for (const setting of APP_SETTINGS_CATALOG) {
      expect(setting.defaultSource).toMatch(
        /^(application-default|database:|derived:|environment:|external:)/,
      );
      for (const source of setting.effectiveSource) {
        expect(source).toMatch(/^(application-default|database:|environment:|external:)/);
      }
    }
  });

  it('owns concrete schemas and normalization adapters for writable values', () => {
    const brandName = catalogItem(APP_SETTING_KEYS.brandName);
    const retentionDays = catalogItem(APP_SETTING_KEYS.notificationRetentionDays);

    expect(brandName.valueSchema.safeParse(42).success).toBe(false);
    expect(brandName.normalizeValue).toBeTypeOf('function');
    expect(brandName.normalizeValue('  ComHub  ')).toBe('ComHub');
    expect(retentionDays.valueSchema.safeParse('90').success).toBe(false);
    expect(retentionDays.normalizeValue('10000')).toBe(3650);
  });

  it('models PPT settings as dedicated system-write contracts with exact schemas', () => {
    const pptKeys = [
      APP_SETTING_KEYS.docmeePptAllowPdfExport,
      APP_SETTING_KEYS.docmeePptAllowPptxDownload,
      APP_SETTING_KEYS.docmeePptApiKey,
      APP_SETTING_KEYS.docmeePptAuditEnabled,
      APP_SETTING_KEYS.docmeePptBaseUrl,
      APP_SETTING_KEYS.docmeePptCreatorVersion,
      APP_SETTING_KEYS.docmeePptDailyLimit,
      APP_SETTING_KEYS.docmeePptDefaultLang,
      APP_SETTING_KEYS.docmeePptEnabled,
      APP_SETTING_KEYS.docmeePptThemeColor,
      APP_SETTING_KEYS.docmeePptTokenTtlMinutes,
    ];

    for (const key of pptKeys) {
      const setting = catalogItem(key);
      expect(setting).toMatchObject({
        auditPolicy: setting.sensitive ? 'write-redacted' : 'write',
        lifecycle: 'active',
        ownership: 'application',
        requiredCapability: 'systemWrite',
        section: 'ppt',
        writable: true,
      });
      expect(setting.writeSurfaces).toEqual([PPT_WRITE_SURFACE]);
    }
    expect([...PPT_WRITABLE_APP_SETTING_KEYS].sort()).toEqual([...pptKeys].sort());
    for (const key of pptKeys) expect(GENERIC_WRITABLE_APP_SETTING_KEYS).not.toContain(key);

    for (const key of [
      APP_SETTING_KEYS.docmeePptAllowPdfExport,
      APP_SETTING_KEYS.docmeePptAllowPptxDownload,
      APP_SETTING_KEYS.docmeePptAuditEnabled,
      APP_SETTING_KEYS.docmeePptEnabled,
    ]) {
      expect(catalogItem(key).valueSchema.safeParse(true).success).toBe(true);
      expect(catalogItem(key).valueSchema.safeParse('true').success).toBe(false);
    }
    expect(catalogItem(APP_SETTING_KEYS.docmeePptApiKey).valueSchema.safeParse('key').success).toBe(
      true,
    );
    expect(catalogItem(APP_SETTING_KEYS.docmeePptApiKey).valueSchema.safeParse(null).success).toBe(
      false,
    );

    const dailyLimit = catalogItem(APP_SETTING_KEYS.docmeePptDailyLimit).valueSchema;
    expect(dailyLimit.safeParse(null).success).toBe(true);
    expect(dailyLimit.safeParse(0).success).toBe(true);
    expect(dailyLimit.safeParse(1).success).toBe(true);
    expect(dailyLimit.safeParse(-1).success).toBe(false);
    expect(dailyLimit.safeParse(1.5).success).toBe(false);

    const tokenTtl = catalogItem(APP_SETTING_KEYS.docmeePptTokenTtlMinutes).valueSchema;
    expect(tokenTtl.safeParse(1).success).toBe(true);
    expect(tokenTtl.safeParse(1440).success).toBe(true);
    expect(tokenTtl.safeParse(0).success).toBe(false);
    expect(tokenTtl.safeParse(1441).success).toBe(false);
    expect(tokenTtl.safeParse(null).success).toBe(false);

    expect(
      catalogItem(APP_SETTING_KEYS.docmeePptCreatorVersion).valueSchema.safeParse('v3').success,
    ).toBe(false);
    expect(catalogItem(APP_SETTING_KEYS.docmeePptBaseUrl).valueSchema.safeParse('').success).toBe(
      false,
    );
    expect(
      catalogItem(APP_SETTING_KEYS.docmeePptDefaultLang).valueSchema.safeParse('').success,
    ).toBe(false);
    expect(
      catalogItem(APP_SETTING_KEYS.docmeePptThemeColor).valueSchema.safeParse(null).success,
    ).toBe(true);

    expect(
      normalizeAppSettingValue(
        APP_SETTING_KEYS.docmeePptDailyLimit,
        0,
        PPT_WRITE_SURFACE,
      ),
    ).toBeNull();
    expect(() =>
      normalizeAppSettingValue(
        APP_SETTING_KEYS.docmeePptEnabled,
        true,
        GENERIC_WRITE_SURFACE,
      ),
    ).toThrow(/not writable/);
  });

  it('uses concrete runtime reader identifiers for active settings', () => {
    const knownConsumers = new Set([
      'AdminGrowthPage',
      'AdminModelBillingMatrixPage',
      'DocmeePptService.readSettings',
      'adminPptRouter.getSettings',
      'adminSettingsRouter.getPublicAboutLinks',
      'adminSettingsRouter.getPublicAboutPage',
      'adminSettingsRouter.getPublicBrand',
      'adminSettingsRouter.getPublicDesktopUpdate',
      'adminSettingsRouter.getPublicExpertPlaza',
      'adminSettingsRouter.getPublicGrowth',
      'adminSettingsRouter.getPublicHelpMenu',
      'adminSettingsRouter.getPublicNotificationConfig',
      'adminSettingsRouter.getPublicOperations',
      'adminSettingsRouter.getPublicProfileOptions',
      'adminSettingsRouter.getPublicRecommendations',
      'adminSettingsRouter.runMaintenance',
      'getServerComposioConfig',
      'getServerDefaultAgentSettingOverrides',
      'getServerDefaultGenerationModelSettingOverrides',
      'getServerFileS3Config',
      'getServerMemoryExtractionSettingOverrides',
      'getServerModelPolicyConfig',
      'getServerPublicCustomizationConfig',
      'getServerUserGlobalSettingsDefaults',
      'getServerVectorSettingOverrides',
      'resolveUserMemoryTriggerMode',
      'resolveGenerationPricingMultiplier',
      'src/app/(backend)/api/admin/maintenance/route.POST',
      'subscriptionRouter.listPlanFaq',
    ]);
    const forbiddenConsumers = new Set([
      'adminPptRouter.readSettings',
      'adminSettingsRouter.getAll',
    ]);

    for (const setting of APP_SETTINGS_CATALOG.filter((item) => item.lifecycle === 'active')) {
      expect(setting.runtimeConsumers.length).toBeGreaterThan(0);
      for (const consumer of setting.runtimeConsumers) {
        expect(forbiddenConsumers.has(consumer)).toBe(false);
        expect(knownConsumers.has(consumer)).toBe(true);
      }
    }

    expect(catalogItem(APP_SETTING_KEYS.storageS3Bucket).runtimeConsumers).toContain(
      'getServerFileS3Config',
    );
    expect(catalogItem(APP_SETTING_KEYS.composioApiKey).runtimeConsumers).toContain(
      'getServerComposioConfig',
    );
    for (const key of [
      APP_SETTING_KEYS.cronAuditRetentionDays,
      APP_SETTING_KEYS.cronPendingOrderExpiryDays,
      APP_SETTING_KEYS.cronSecret,
    ]) {
      expect(catalogItem(key).runtimeConsumers).toContain(
        'src/app/(backend)/api/admin/maintenance/route.POST',
      );
    }
    expect(catalogItem(APP_SETTING_KEYS.notificationRetentionDays).runtimeConsumers).toContain(
      'adminSettingsRouter.runMaintenance',
    );
    expect(catalogItem(APP_SETTING_KEYS.ordersManagementEnabled).runtimeConsumers).toContain(
      'AdminModelBillingMatrixPage',
    );
    expect(catalogItem(APP_SETTING_KEYS.plansFaqItems).runtimeConsumers).toContain(
      'subscriptionRouter.listPlanFaq',
    );
    for (const key of [
      APP_SETTING_KEYS.pricingCreditMultiplier,
      APP_SETTING_KEYS.pricingModelRules,
    ]) {
      expect(catalogItem(key).runtimeConsumers).toContain('resolveGenerationPricingMultiplier');
    }
    expect(catalogItem(APP_SETTING_KEYS.referralRewardCredits).runtimeConsumers).toContain(
      'AdminGrowthPage',
    );
    expect(catalogItem(APP_SETTING_KEYS.docmeePptEnabled).runtimeConsumers).toContain(
      'DocmeePptService.readSettings',
    );
  });

  it('preserves cron.secret bytes and matches every pre-task normalization branch', () => {
    type ParityCase = {
      expected: unknown;
      input: unknown;
      key: string;
      normalizer: string;
    };

    const cases: ParityCase[] = [
      {
        expected: '  exact secret  ',
        input: '  exact secret  ',
        key: APP_SETTING_KEYS.cronSecret,
        normalizer: 'string',
      },
      {
        expected: 3650,
        input: 9999,
        key: APP_SETTING_KEYS.cronAuditRetentionDays,
        normalizer: 'bounded-integer',
      },
      {
        expected: 1,
        input: -4,
        key: APP_SETTING_KEYS.cronPendingOrderExpiryDays,
        normalizer: 'bounded-integer',
      },
      {
        expected: 0,
        input: -4,
        key: APP_SETTING_KEYS.referralRewardCredits,
        normalizer: 'bounded-integer',
      },
      {
        expected: true,
        input: 'false',
        key: APP_SETTING_KEYS.composioEnabled,
        normalizer: 'boolean',
      },
      {
        expected: '{"provider":"id"}',
        input: '  {"provider":"id"}  ',
        key: APP_SETTING_KEYS.composioAuthConfigIds,
        normalizer: 'string',
      },
      {
        expected: 'model',
        input: '  model  ',
        key: APP_SETTING_KEYS.defaultAgentModel,
        normalizer: 'string',
      },
      {
        expected: 100,
        input: 101,
        key: APP_SETTING_KEYS.pricingCreditMultiplier,
        normalizer: 'bounded-integer',
      },
      {
        expected: [],
        input: 'not-an-array',
        key: APP_SETTING_KEYS.pricingModelRules,
        normalizer: 'object',
      },
      {
        expected: false,
        input: 0,
        key: APP_SETTING_KEYS.ordersManagementEnabled,
        normalizer: 'boolean',
      },
      {
        expected: normalizePlanFaqSettings([]),
        input: [],
        key: APP_SETTING_KEYS.plansFaqItems,
        normalizer: 'object',
      },
      {
        expected: true,
        input: 1,
        key: APP_SETTING_KEYS.homeMessengerEnabled,
        normalizer: 'brand',
      },
      {
        expected: 24,
        input: 99,
        key: APP_SETTING_KEYS.communityFeaturedAssistantPageSize,
        normalizer: 'operations',
      },
      {
        expected: 'Announcement',
        input: '  Announcement  ',
        key: APP_SETTING_KEYS.communityHomeAnnouncementTitle,
        normalizer: 'operations',
      },
      {
        expected: 10_000_000_000,
        input: Number.MAX_SAFE_INTEGER,
        key: APP_SETTING_KEYS.uploadMaxActualSizeMb,
        normalizer: 'bounded-integer',
      },
      {
        expected: [{ key: 'ai', label: 'AI' }],
        input: [{ key: 'ai', label: ' AI ' }],
        key: APP_SETTING_KEYS.profileInterestAreas,
        normalizer: 'profile',
      },
      {
        expected: normalizeAvatarPresets([]),
        input: [],
        key: APP_SETTING_KEYS.profileAvatarPresets,
        normalizer: 'profile',
      },
      {
        expected: 'auto',
        input: 'invalid',
        key: APP_SETTING_KEYS.memoryUserMemoryTriggerMode,
        normalizer: 'string',
      },
      {
        expected: 'provider',
        input: '  provider  ',
        key: APP_SETTING_KEYS.vectorEmbeddingProvider,
        normalizer: 'string',
      },
      {
        expected: {},
        input: [],
        key: APP_SETTING_KEYS.userGlobalSettingsDefaults,
        normalizer: 'object',
      },
      {
        expected: normalizeExpertPlazaCards([]),
        input: [],
        key: APP_SETTING_KEYS.expertPlazaCards,
        normalizer: 'expert-plaza',
      },
      {
        expected: ['news', 'tools'],
        input: 'news, tools, news',
        key: APP_SETTING_KEYS.expertPlazaCategories,
        normalizer: 'expert-plaza',
      },
      {
        expected: normalizeNotificationEventDefaults({}),
        input: {},
        key: APP_SETTING_KEYS.notificationEventDefaults,
        normalizer: 'notification',
      },
      {
        expected: 'warning',
        input: 'invalid',
        key: APP_SETTING_KEYS.notificationSystemType,
        normalizer: 'notification',
      },
      {
        expected: 604_800,
        input: 999_999,
        key: APP_SETTING_KEYS.storageS3PreviewUrlExpireIn,
        normalizer: 'storage',
      },
      {
        expected: 'folder/child',
        input: ' /folder\\child/ ',
        key: APP_SETTING_KEYS.storageS3FilePath,
        normalizer: 'storage',
      },
      {
        expected: 'https://s3.example.com',
        input: ' https://s3.example.com ',
        key: APP_SETTING_KEYS.storageS3Endpoint,
        normalizer: 'storage',
      },
      {
        expected: ['model-a', 'model-b'],
        input: 'model-a, model-b, model-a',
        key: APP_SETTING_KEYS.modelPolicyAllowlist,
        normalizer: 'model-policy',
      },
      {
        expected: 'blocklist',
        input: 'invalid',
        key: APP_SETTING_KEYS.modelPolicyMode,
        normalizer: 'model-policy',
      },
      {
        expected: 'installCount',
        input: '   ',
        key: APP_SETTING_KEYS.recommendationHotSkillSort,
        normalizer: 'recommendation',
      },
      {
        expected: ['tag-a', 'tag-b'],
        input: 'tag-a, tag-b, tag-a',
        key: APP_SETTING_KEYS.recommendationAssistantTags,
        normalizer: 'recommendation',
      },
      {
        expected: 'ComHub',
        input: '  ComHub  ',
        key: APP_SETTING_KEYS.brandName,
        normalizer: 'brand',
      },
      {
        expected: normalizeHelpMenuItems([]),
        input: [],
        key: APP_SETTING_KEYS.helpMenuItems,
        normalizer: 'about',
      },
      {
        expected: normalizeAboutLinksConfig({}),
        input: {},
        key: APP_SETTING_KEYS.aboutLinks,
        normalizer: 'about',
      },
      {
        expected: normalizeAboutPageConfig({}),
        input: {},
        key: APP_SETTING_KEYS.aboutPage,
        normalizer: 'about',
      },
      {
        expected: 'Sign in',
        input: '  Sign in  ',
        key: APP_SETTING_KEYS.desktopLoginTitle,
        normalizer: 'desktop-login',
      },
      {
        expected: 1440,
        input: 9999,
        key: APP_SETTING_KEYS.desktopUpdateCheckInterval,
        normalizer: 'desktop-update',
      },
      {
        expected: 'stable',
        input: 'beta',
        key: APP_SETTING_KEYS.desktopUpdateChannel,
        normalizer: 'desktop-update',
      },
    ];

    const genericNormalizers = new Set(
      APP_SETTINGS_CATALOG.filter((item) =>
        GENERIC_WRITABLE_APP_SETTING_KEYS.includes(item.key),
      ).map((item) => item.normalizer),
    );
    expect(new Set(cases.map((item) => item.normalizer))).toEqual(genericNormalizers);

    for (const item of cases) {
      expect(
        normalizeAppSettingValue(item.key, item.input, GENERIC_WRITE_SURFACE),
        item.key,
      ).toEqual(item.expected);
    }
  });
});
