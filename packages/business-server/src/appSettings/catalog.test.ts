import { describe, expect, it } from 'vitest';

import { APP_SETTING_KEYS } from '@/server/services/appSettings';

import {
  APP_SETTINGS_CATALOG,
  APP_SETTINGS_SECTION_KEYS,
  getAppSettingCatalogItem,
  WRITABLE_APP_SETTING_KEYS,
} from './catalog';

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

  it('uses concrete runtime reader identifiers for active settings', () => {
    const knownConsumers = new Set([
      'adminPptRouter.readSettings',
      'adminSettingsRouter.getAll',
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
    ]);

    for (const setting of APP_SETTINGS_CATALOG.filter((item) => item.lifecycle === 'active')) {
      expect(setting.runtimeConsumers.length).toBeGreaterThan(0);
      for (const consumer of setting.runtimeConsumers)
        expect(knownConsumers.has(consumer)).toBe(true);
    }

    expect(catalogItem(APP_SETTING_KEYS.storageS3Bucket).runtimeConsumers).toContain(
      'getServerFileS3Config',
    );
    expect(catalogItem(APP_SETTING_KEYS.composioApiKey).runtimeConsumers).toContain(
      'getServerComposioConfig',
    );
  });
});
