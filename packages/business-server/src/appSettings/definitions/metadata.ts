import { APP_SETTING_KEYS, type AppSettingKey } from '@/const/appSettingsRegistry';

import type { AppSettingLifecycle } from '../types';

type SourceMetadata = {
  defaultSource: string;
  effectiveSource: string[];
};

const databaseSource = (key: AppSettingKey) => `database:${key}`;
const environmentSource = (name: string) => `environment:${name}`;

const environmentFallback = (
  key: AppSettingKey,
  environmentNames: string[],
  includeApplicationDefault = false,
): SourceMetadata => ({
  defaultSource: environmentSource(environmentNames[0]),
  effectiveSource: [
    databaseSource(key),
    ...environmentNames.map(environmentSource),
    ...(includeApplicationDefault ? ['application-default'] : []),
  ],
});

const SOURCE_OVERRIDES: Partial<Record<AppSettingKey, SourceMetadata>> = {
  [APP_SETTING_KEYS.composioApiKey]: environmentFallback(APP_SETTING_KEYS.composioApiKey, [
    'COMPOSIO_API_KEY',
  ]),
  [APP_SETTING_KEYS.composioAuthConfigIds]: environmentFallback(
    APP_SETTING_KEYS.composioAuthConfigIds,
    ['COMPOSIO_AUTH_CONFIG_IDS'],
  ),
  [APP_SETTING_KEYS.composioEnabled]: {
    defaultSource: 'derived:composio.apiKey-or-application-default',
    effectiveSource: [
      databaseSource(APP_SETTING_KEYS.composioEnabled),
      environmentSource('COMPOSIO_ENABLED'),
      databaseSource(APP_SETTING_KEYS.composioApiKey),
      environmentSource('COMPOSIO_API_KEY'),
      'application-default',
    ],
  },
  [APP_SETTING_KEYS.cronSecret]: environmentFallback(APP_SETTING_KEYS.cronSecret, ['CRON_SECRET']),
  [APP_SETTING_KEYS.memoryUserMemoryTriggerMode]: {
    defaultSource: 'application-default',
    effectiveSource: [
      environmentSource('MEMORY_USER_MEMORY_TRIGGER_MODE'),
      databaseSource(APP_SETTING_KEYS.memoryUserMemoryTriggerMode),
      'application-default',
    ],
  },
  [APP_SETTING_KEYS.storageS3AccessKeyId]: environmentFallback(
    APP_SETTING_KEYS.storageS3AccessKeyId,
    ['S3_ACCESS_KEY_ID'],
  ),
  [APP_SETTING_KEYS.storageS3Bucket]: environmentFallback(APP_SETTING_KEYS.storageS3Bucket, [
    'S3_BUCKET',
  ]),
  [APP_SETTING_KEYS.storageS3EnablePathStyle]: environmentFallback(
    APP_SETTING_KEYS.storageS3EnablePathStyle,
    ['S3_ENABLE_PATH_STYLE'],
    true,
  ),
  [APP_SETTING_KEYS.storageS3Endpoint]: environmentFallback(APP_SETTING_KEYS.storageS3Endpoint, [
    'S3_ENDPOINT',
  ]),
  [APP_SETTING_KEYS.storageS3FilePath]: environmentFallback(
    APP_SETTING_KEYS.storageS3FilePath,
    ['NEXT_PUBLIC_S3_FILE_PATH'],
    true,
  ),
  [APP_SETTING_KEYS.storageS3PreviewUrlExpireIn]: environmentFallback(
    APP_SETTING_KEYS.storageS3PreviewUrlExpireIn,
    ['S3_PREVIEW_URL_EXPIRE_IN'],
    true,
  ),
  [APP_SETTING_KEYS.storageS3PublicDomain]: environmentFallback(
    APP_SETTING_KEYS.storageS3PublicDomain,
    ['S3_PUBLIC_DOMAIN', 'NEXT_PUBLIC_S3_DOMAIN'],
  ),
  [APP_SETTING_KEYS.storageS3Region]: environmentFallback(APP_SETTING_KEYS.storageS3Region, [
    'S3_REGION',
  ]),
  [APP_SETTING_KEYS.storageS3SecretAccessKey]: environmentFallback(
    APP_SETTING_KEYS.storageS3SecretAccessKey,
    ['S3_SECRET_ACCESS_KEY'],
  ),
  [APP_SETTING_KEYS.storageS3SetAcl]: environmentFallback(
    APP_SETTING_KEYS.storageS3SetAcl,
    ['S3_SET_ACL'],
    true,
  ),
};

export const getAppSettingSourceMetadata = (
  key: AppSettingKey,
  lifecycle: AppSettingLifecycle,
): SourceMetadata => {
  if (lifecycle === 'external') {
    return {
      defaultSource: 'external:CI/GitHub Secrets',
      effectiveSource: ['external:CI/GitHub Secrets'],
    };
  }

  return (
    SOURCE_OVERRIDES[key] ?? {
      defaultSource: 'application-default',
      effectiveSource: [databaseSource(key), 'application-default'],
    }
  );
};

export const getAppSettingRuntimeConsumers = (
  key: AppSettingKey,
  lifecycle: AppSettingLifecycle,
): string[] => {
  if (lifecycle === 'external') return [];
  if (key.startsWith('docmee.')) return ['adminPptRouter.readSettings'];

  const consumers = ['adminSettingsRouter.getAll'];

  if (key.startsWith('composio.')) consumers.push('getServerComposioConfig');
  if (key.startsWith('storage.')) consumers.push('getServerFileS3Config');
  if (key.startsWith('recommendation.'))
    consumers.push('adminSettingsRouter.getPublicRecommendations');
  if (
    key.startsWith('community.') &&
    key !== APP_SETTING_KEYS.communityForkAndChatLabel &&
    key !== APP_SETTING_KEYS.communitySkillUseButtonLabel
  ) {
    consumers.push('adminSettingsRouter.getPublicOperations');
  }
  if (key === APP_SETTING_KEYS.communitySkillUseButtonLabel) {
    consumers.push('getServerPublicCustomizationConfig');
  }
  if (key.startsWith('expertPlaza.')) consumers.push('adminSettingsRouter.getPublicExpertPlaza');
  if (key.startsWith('auth.') || key.startsWith('onboarding.') || key.startsWith('upload.')) {
    consumers.push('adminSettingsRouter.getPublicGrowth');
  }
  if (key.startsWith('profile.')) consumers.push('adminSettingsRouter.getPublicProfileOptions');
  if (key.startsWith('notification.') && key !== APP_SETTING_KEYS.notificationRetentionDays) {
    consumers.push('adminSettingsRouter.getPublicNotificationConfig');
  }
  if (key.startsWith('desktop.')) consumers.push('adminSettingsRouter.getPublicDesktopUpdate');
  if (key === APP_SETTING_KEYS.helpMenuItems)
    consumers.push('adminSettingsRouter.getPublicHelpMenu');
  if (key === APP_SETTING_KEYS.aboutLinks || key === APP_SETTING_KEYS.aboutLogoUrl) {
    consumers.push('adminSettingsRouter.getPublicAboutLinks');
  }
  if (key === APP_SETTING_KEYS.aboutPage) consumers.push('adminSettingsRouter.getPublicAboutPage');
  if (
    key.startsWith('brand.') ||
    key.startsWith('home.') ||
    key.startsWith('sidebar.') ||
    key === APP_SETTING_KEYS.defaultSkillName ||
    key === APP_SETTING_KEYS.communityForkAndChatLabel
  ) {
    consumers.push('adminSettingsRouter.getPublicBrand');
  }
  if (key.startsWith('defaultAgent.')) consumers.push('getServerDefaultAgentSettingOverrides');
  if (key.startsWith('defaultImage.') || key.startsWith('defaultVideo.')) {
    consumers.push('getServerDefaultGenerationModelSettingOverrides');
  }
  if (key.startsWith('vector.')) consumers.push('getServerVectorSettingOverrides');
  if (key.startsWith('memory.') && key !== APP_SETTING_KEYS.memoryUserMemoryTriggerMode) {
    consumers.push('getServerMemoryExtractionSettingOverrides');
  }
  if (key === APP_SETTING_KEYS.memoryUserMemoryTriggerMode) {
    consumers.push('resolveUserMemoryTriggerMode');
  }
  if (key === APP_SETTING_KEYS.userGlobalSettingsDefaults) {
    consumers.push('getServerUserGlobalSettingsDefaults');
  }
  if (key.startsWith('model.policy.')) consumers.push('getServerModelPolicyConfig');

  return Array.from(new Set(consumers));
};
