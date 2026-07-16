import {
  APP_SETTING_KEYS,
  type AppSettingKey,
  listAppSettingRegistryItems,
} from '@/const/appSettingsRegistry';

import { getAppSettingRuntimeConsumers, getAppSettingSourceMetadata } from './definitions/metadata';
import { getAppSettingValueDefinition } from './definitions/valueDefinitions';
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

const isWritableKey = (key: AppSettingKey) =>
  !key.startsWith('docmee.') && !EXTERNAL_SETTING_OWNERS[key];

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
    const sourceMetadata = getAppSettingSourceMetadata(registryItem.key, lifecycle);
    const valueDefinition = getAppSettingValueDefinition(registryItem.key);
    const writable = lifecycle === 'active' && isWritableKey(registryItem.key);

    return {
      auditPolicy: writable ? (registryItem.sensitive ? 'write-redacted' : 'write') : 'none',
      cacheScopes: registryItem.cacheScopes,
      defaultSource: sourceMetadata.defaultSource,
      domain: registryItem.domain,
      effectiveSource: sourceMetadata.effectiveSource,
      ...(externalOwner ? { externalOwner } : {}),
      key: registryItem.key,
      lifecycle,
      ...valueDefinition,
      ownership: externalOwner ? 'external' : 'application',
      publicRuntime: registryItem.publicRuntime,
      requiredCapability: writable ? 'systemWrite' : 'systemRead',
      runtimeConsumers: getAppSettingRuntimeConsumers(registryItem.key, lifecycle),
      runtimeEffects: runtimeEffectsFor(registryItem.key, registryItem.cacheScopes),
      section,
      sensitive: registryItem.sensitive,
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

export const normalizeAppSettingValue = (key: string, value: unknown) => {
  const definition = getAppSettingCatalogItem(key);
  if (!definition?.writable) throw new Error(`App setting is not writable: ${key}`);
  return definition.normalizeValue(value);
};
