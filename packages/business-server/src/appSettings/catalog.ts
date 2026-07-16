import { z } from 'zod';

import {
  APP_SETTING_KEYS,
  type AppSettingKey,
  listAppSettingRegistryItems,
} from '@/const/appSettingsRegistry';

import type { AppSettingCatalogItem, AppSettingNormalizer, AppSettingsSection } from './types';

export type { AppSettingCatalogItem, AppSettingLifecycle, AppSettingsSection } from './types';

const EXTERNAL_SETTING_OWNERS: Partial<Record<AppSettingKey, string>> = {
  [APP_SETTING_KEYS.desktopOssAccessKeyId]: 'CI/GitHub Secrets',
  [APP_SETTING_KEYS.desktopOssAccessKeySecret]: 'CI/GitHub Secrets',
  [APP_SETTING_KEYS.desktopOssBucket]: 'CI/GitHub Secrets',
  [APP_SETTING_KEYS.desktopOssEndpoint]: 'CI/GitHub Secrets',
  [APP_SETTING_KEYS.desktopOssPath]: 'CI/GitHub Secrets',
};

const sectionForKey = (key: AppSettingKey): AppSettingsSection => {
  if (key.startsWith('desktop.')) return 'desktop-update';
  if (key.startsWith('expertPlaza.')) return 'expert-plaza';
  if (key.startsWith('storage.')) return 'file-storage';
  if (
    key.startsWith('auth.') ||
    key.startsWith('onboarding.') ||
    key.startsWith('referral.') ||
    key.startsWith('upload.')
  ) {
    return 'growth';
  }
  if (key.startsWith('cron.')) return 'maintenance';
  if (key.startsWith('pricing.') || key.startsWith('plans.') || key.startsWith('orders.')) {
    return 'model-billing-matrix';
  }
  if (key.startsWith('model.policy.')) return 'model-policy';
  if (key.startsWith('notification.')) return 'notifications';
  if (key.startsWith('community.')) return 'operations';
  if (key.startsWith('docmee.')) return 'ppt';
  if (key.startsWith('recommendation.')) return 'recommendations';
  if (key.startsWith('default') || key.startsWith('memory.') || key.startsWith('vector.')) {
    return 'system-defaults';
  }
  return 'settings';
};

const normalizerForKey = (key: AppSettingKey): AppSettingNormalizer => {
  if (
    key === APP_SETTING_KEYS.aboutLogoUrl ||
    key === APP_SETTING_KEYS.communityForkAndChatLabel ||
    key === APP_SETTING_KEYS.communitySkillUseButtonLabel ||
    key === APP_SETTING_KEYS.defaultSkillName
  ) {
    return 'brand';
  }
  if (key.startsWith('recommendation.')) return 'recommendation';
  if (key.startsWith('community.')) return 'operations';
  if (key.startsWith('notification.')) return 'notification';
  if (key.startsWith('storage.')) return 'storage';
  if (key.startsWith('model.policy.')) return 'model-policy';
  if (key.startsWith('desktop.login.')) return 'desktop-login';
  if (key.startsWith('desktop.update.') || key.startsWith('desktop.oss.')) return 'desktop-update';
  if (key.startsWith('expertPlaza.')) return 'expert-plaza';
  if (key.startsWith('profile.')) return 'profile';
  if (key.startsWith('about.')) return 'about';
  if (key.startsWith('brand.') || key.startsWith('home.') || key.startsWith('sidebar.')) {
    return 'brand';
  }
  if (key.startsWith('auth.') || key.startsWith('onboarding.') || key.startsWith('upload.')) {
    return key.endsWith('.enabled') ? 'boolean' : 'bounded-integer';
  }
  if (key.startsWith('pricing.') || key.startsWith('plans.') || key.startsWith('orders.')) {
    return key === APP_SETTING_KEYS.pricingModelRules ? 'object' : 'bounded-integer';
  }
  if (key.startsWith('memory.') || key.startsWith('vector.') || key.startsWith('default')) {
    return 'string';
  }
  if (key === APP_SETTING_KEYS.composioEnabled) return 'boolean';
  if (key.startsWith('composio.')) return 'string';
  if (key === APP_SETTING_KEYS.userGlobalSettingsDefaults) return 'object';
  return 'passthrough';
};

const schemaForNormalizer = (normalizer: AppSettingNormalizer) => {
  switch (normalizer) {
    case 'boolean':
      return z.boolean();
    case 'bounded-integer':
      return z.coerce.number().finite();
    case 'model-list':
      return z.array(z.string());
    case 'object':
      return z.record(z.string(), z.unknown());
    case 'string':
      return z.string();
    default:
      return z.unknown();
  }
};

const isWritableKey = (key: AppSettingKey) => !key.startsWith('docmee.') && !EXTERNAL_SETTING_OWNERS[key];

const runtimeConsumersFor = (key: AppSettingKey, section: AppSettingsSection, lifecycle: 'active' | 'external') => {
  if (lifecycle === 'external') return [];
  if (key.startsWith('docmee.')) return ['adminPptRouter'];
  if (key.startsWith('notification.')) return ['adminSettingsRouter.getPublicNotificationConfig'];
  if (key.startsWith('recommendation.')) return ['adminSettingsRouter.getPublicRecommendations'];
  if (key.startsWith('community.')) return ['adminSettingsRouter.getPublicOperations'];
  if (key.startsWith('expertPlaza.')) return ['adminSettingsRouter.getPublicExpertPlaza'];
  if (key.startsWith('auth.') || key.startsWith('onboarding.') || key.startsWith('upload.')) {
    return ['adminSettingsRouter.getPublicGrowth'];
  }
  if (key.startsWith('profile.')) return ['adminSettingsRouter.getPublicProfileOptions'];
  if (key.startsWith('desktop.')) return ['adminSettingsRouter.getPublicDesktopUpdate'];
  return [`adminSettingsRouter.getAll:${section}`];
};

const runtimeEffectsFor = (key: AppSettingKey, cacheScopes: AppSettingCatalogItem['cacheScopes']) =>
  Array.from(
    new Set([
      ...cacheScopes.filter((scope) => scope !== 'app-settings'),
      ...(key === APP_SETTING_KEYS.defaultSkillName ||
      key === APP_SETTING_KEYS.communityForkAndChatLabel ||
      key === APP_SETTING_KEYS.communitySkillUseButtonLabel
        ? ['brand']
        : []),
    ]),
  );

export const APP_SETTINGS_CATALOG: AppSettingCatalogItem[] = listAppSettingRegistryItems().map(
  (registryItem) => {
    const section = sectionForKey(registryItem.key);
    const externalOwner = EXTERNAL_SETTING_OWNERS[registryItem.key];
    const lifecycle = externalOwner ? 'external' : 'active';
    const normalizer = normalizerForKey(registryItem.key);
    const writable = lifecycle === 'active' && isWritableKey(registryItem.key);

    return {
      auditPolicy: writable ? (registryItem.sensitive ? 'write-redacted' : 'write') : 'none',
      cacheScopes: registryItem.cacheScopes,
      defaultSource: 'application defaults',
      domain: registryItem.domain,
      effectiveSource: registryItem.sensitive ? 'database > environment > application defaults' : 'database > application defaults',
      ...(externalOwner ? { externalOwner } : {}),
      key: registryItem.key,
      lifecycle,
      normalizer,
      ownership: externalOwner ? 'external' : 'application',
      publicRuntime: registryItem.publicRuntime,
      requiredCapability: writable ? 'systemWrite' : 'systemRead',
      runtimeConsumers: runtimeConsumersFor(registryItem.key, section, lifecycle),
      runtimeEffects: runtimeEffectsFor(registryItem.key, registryItem.cacheScopes),
      section,
      sensitive: registryItem.sensitive,
      valueSchema: schemaForNormalizer(normalizer),
      writable,
    };
  },
);

export const APP_SETTINGS_CATALOG_BY_KEY = new Map<string, AppSettingCatalogItem>(
  APP_SETTINGS_CATALOG.map((item) => [item.key, item]),
);

export const getAppSettingCatalogItem = (key: string) => APP_SETTINGS_CATALOG_BY_KEY.get(key);

export const WRITABLE_APP_SETTING_KEYS = APP_SETTINGS_CATALOG.filter((item) => item.writable).map(
  (item) => item.key,
);

export const SENSITIVE_APP_SETTING_KEYS = APP_SETTINGS_CATALOG.filter((item) => item.sensitive).map(
  (item) => item.key,
);

export const APP_SETTINGS_SECTION_KEYS = Object.fromEntries(
  Array.from(new Set(APP_SETTINGS_CATALOG.map((item) => item.section))).map((section) => [
    section,
    APP_SETTINGS_CATALOG.filter((item) => item.section === section).map((item) => item.key),
  ]),
) as Record<AppSettingsSection, AppSettingKey[]>;

export const APP_SETTINGS_NORMALIZATION_KEYS = Object.fromEntries(
  Array.from(new Set(APP_SETTINGS_CATALOG.map((item) => item.normalizer))).map((normalizer) => [
    normalizer,
    APP_SETTINGS_CATALOG.filter((item) => item.normalizer === normalizer).map((item) => item.key),
  ]),
) as Record<AppSettingNormalizer, AppSettingKey[]>;

export const listAppSettingsCatalogItems = () => [...APP_SETTINGS_CATALOG];

export const isSensitiveCatalogAppSettingKey = (key: string) =>
  getAppSettingCatalogItem(key)?.sensitive === true;
