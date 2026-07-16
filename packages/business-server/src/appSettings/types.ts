import type { z } from 'zod';

import type { AppSettingDomain, AppSettingKey } from '@/const/appSettingsRegistry';

export type AppSettingsSection =
  | 'desktop-update'
  | 'expert-plaza'
  | 'file-storage'
  | 'growth'
  | 'maintenance'
  | 'model-billing-matrix'
  | 'model-policy'
  | 'notifications'
  | 'operations'
  | 'ppt'
  | 'recommendations'
  | 'settings'
  | 'system-defaults';

export type AppSettingLifecycle = 'active' | 'external';

export type AppSettingWriteSurface =
  | 'adminPptRouter.saveSettings'
  | 'adminSettingsRouter.setAppSetting';

export type AppSettingNormalizer =
  | 'about'
  | 'boolean'
  | 'brand'
  | 'bounded-integer'
  | 'desktop-login'
  | 'desktop-update'
  | 'expert-plaza'
  | 'model-list'
  | 'model-policy'
  | 'notification'
  | 'object'
  | 'operations'
  | 'passthrough'
  | 'profile'
  | 'recommendation'
  | 'storage'
  | 'string';

export type AppSettingCatalogItem = {
  auditPolicy: 'none' | 'write' | 'write-redacted';
  cacheScopes: Array<'app-settings' | 'brand' | 'runtime' | 's3' | 'user-state'>;
  clearValue?: null;
  defaultSource: string;
  domain: AppSettingDomain;
  effectiveSource: string[];
  externalOwner?: string;
  key: AppSettingKey;
  lifecycle: AppSettingLifecycle;
  normalizer: AppSettingNormalizer;
  normalizeValue: (value: unknown) => unknown;
  ownership: 'application' | 'external';
  publicRuntime: boolean;
  requiredCapability: 'systemRead' | 'systemWrite';
  runtimeConsumers: string[];
  runtimeEffects: string[];
  section: AppSettingsSection;
  sensitive: boolean;
  valueSchema: z.ZodType<unknown>;
  writable: boolean;
  writeSurfaces: AppSettingWriteSurface[];
};

export type AppSettingValueDefinition = Pick<
  AppSettingCatalogItem,
  'clearValue' | 'normalizer' | 'normalizeValue' | 'valueSchema'
>;
