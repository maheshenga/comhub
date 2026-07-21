import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';

import { normalizeAboutLinksConfig, normalizeAboutPageConfig } from '@/const/aboutLinks';
import { normalizeAvatarPresets } from '@/const/avatarPresets';
import { normalizePlanFaqSettings } from '@/const/billingPresentation';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { DEFAULT_COMHUB_AGENT_AVATAR, DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import {
  DEFAULT_EXPERT_PLAZA_CONFIG,
  normalizeExpertPlazaCards,
  normalizeExpertPlazaConfig,
} from '@/const/expertPlaza';
import { normalizeHelpMenuItems } from '@/const/helpMenu';
import { normalizeMobileConfig } from '@/const/mobileConfig';
import { normalizeNotificationEventDefaults } from '@/const/notificationPreferences';
import {
  normalizeDesktopDownloadUrl,
  normalizeDesktopUpdateServerUrl,
} from '@/const/desktopUpdate';
import {
  APP_SETTING_KEYS,
  normalizeModelIdList,
  normalizeS3FilePath,
  serializeModelIdList,
} from '@/server/services/appSettings';
import {
  decryptAppSettingSecret,
  maskAppSettingSecret,
} from '@/server/services/appSettings/secrets';
import { normalizeDocmeePptSettings } from '@/server/services/docmee/config';

import { type AppSettingsSnapshot } from './loader';
import { type AppSettingsSection } from './types';

type DefaultAgentConfig = {
  avatar?: unknown;
  model?: unknown;
  provider?: unknown;
  title?: unknown;
};

export type AdminEnabledModelSource = {
  displayName?: null | string;
  groupName?: null | string;
  id: string;
  instanceId?: null | string;
  instanceName?: null | string;
  providerId?: null | string;
  providerType?: null | string;
  type: string;
};

export type AdminSettingsReadContext = {
  defaultAgentConfig?: DefaultAgentConfig;
  enabledModels?: AdminEnabledModelSource[];
};

const PAYMENT_GATEWAY_STATUS = {
  configured: false,
  message:
    '支付网关尚未接入，用户自助支付会返回 PAYMENT_GATEWAY_NOT_CONFIGURED。当前可使用后台手动结算订单。',
  provider: null,
} as const;

const toStringList = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;，；]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;，；]+/)
      : [];

  return Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
};

const toBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const toStoredNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

const toNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const toBoundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;

  return Math.max(min, Math.min(max, Math.round(number)));
};

const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const toRawString = <Fallback = ''>(value: unknown, fallback: Fallback = '' as Fallback) =>
  typeof value === 'string' ? value : fallback;

const toNonBlankRawString = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value : fallback;

const toNonEmptyRawString = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const normalizeMemoryUserMemoryTriggerMode = (value: unknown) =>
  value === 'direct' || value === 'workflow' || value === 'auto' ? value : 'auto';

const normalizeOptionalMemoryUserMemoryTriggerMode = (value: unknown) =>
  value === 'direct' || value === 'workflow' || value === 'auto' ? value : null;

const normalizeProfileInterestAreas = (value: unknown) => {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: Array<{ key: string; label: string }> = [];

  for (const item of items) {
    const label =
      typeof item === 'string'
        ? item.trim()
        : item && typeof item === 'object'
          ? toString((item as Record<string, unknown>).label)
          : '';
    const key =
      item && typeof item === 'object'
        ? toString((item as Record<string, unknown>).key) || label
        : label;

    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ key, label });
  }

  return normalized;
};

export const mapEnabledAdminModels = (items: AdminEnabledModelSource[] = []) =>
  items.map((item) => ({
    displayName: item.displayName,
    instanceName: item.instanceName ?? item.groupName ?? null,
    modelId: item.id,
    modelType: item.type,
    provider: item.providerId ?? item.instanceId ?? item.providerType ?? 'newapi',
    providerType: item.providerType ?? null,
  }));

export type AdminSettingsSharedHealth = {
  enabledNewapiModels?: ReturnType<typeof mapEnabledAdminModels>;
  memoryUserMemoryTriggerModeEnv?: 'auto' | 'direct' | 'workflow' | null;
  paymentGatewayStatus?: typeof PAYMENT_GATEWAY_STATUS;
  qstashTokenConfigured?: boolean;
};

export const buildRecommendationSettings = (snapshot: AppSettingsSnapshot) => ({
  assistantTags: toStringList(snapshot.get(APP_SETTING_KEYS.recommendationAssistantTags)),
  assistantTitle: toString(
    snapshot.get(APP_SETTING_KEYS.recommendationAssistantTitle),
    '为你推荐的助理',
  ),
  assistantsEnabled: toBoolean(
    snapshot.get(APP_SETTING_KEYS.recommendationAssistantsEnabled),
    true,
  ),
  enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.recommendationSectionEnabled), false),
  generalSkillCategories: toStringList(
    snapshot.get(APP_SETTING_KEYS.recommendationGeneralSkillCategories),
  ),
  generalSkillTitle: toString(
    snapshot.get(APP_SETTING_KEYS.recommendationGeneralSkillTitle),
    '通用推荐技能',
  ),
  generalSkillsEnabled: toBoolean(
    snapshot.get(APP_SETTING_KEYS.recommendationGeneralSkillsEnabled),
    true,
  ),
  hotSkillsEnabled: toBoolean(snapshot.get(APP_SETTING_KEYS.recommendationHotSkillsEnabled), true),
  hotSkillSort: toNonEmptyRawString(
    snapshot.get(APP_SETTING_KEYS.recommendationHotSkillSort),
    'installCount',
  ),
  hotSkillTitle: toString(snapshot.get(APP_SETTING_KEYS.recommendationHotSkillTitle), '热门技能'),
  mcpCategories: toStringList(snapshot.get(APP_SETTING_KEYS.recommendationMcpCategories)),
  mcpTitle: toString(snapshot.get(APP_SETTING_KEYS.recommendationMcpTitle), '推荐 MCP / 工具'),
  mcpsEnabled: toBoolean(snapshot.get(APP_SETTING_KEYS.recommendationMcpsEnabled), true),
  selectedTags: toStringList(snapshot.get(APP_SETTING_KEYS.recommendationSelectedTags)),
  skillCategories: toStringList(snapshot.get(APP_SETTING_KEYS.recommendationSkillCategories)),
  skillTitle: toString(snapshot.get(APP_SETTING_KEYS.recommendationSkillTitle), '推荐技能'),
  skillsEnabled: toBoolean(snapshot.get(APP_SETTING_KEYS.recommendationSkillsEnabled), true),
});

export const buildOperationsSettings = (snapshot: AppSettingsSnapshot) => ({
  announcement: {
    content: toString(snapshot.get(APP_SETTING_KEYS.communityHomeAnnouncementContent)),
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.communityHomeAnnouncementEnabled), false),
    title: toString(snapshot.get(APP_SETTING_KEYS.communityHomeAnnouncementTitle)),
    type: ['success', 'info', 'warning', 'error'].includes(
      toString(snapshot.get(APP_SETTING_KEYS.communityHomeAnnouncementType)),
    )
      ? toString(snapshot.get(APP_SETTING_KEYS.communityHomeAnnouncementType))
      : 'info',
  },
  creatorRewardBannerEnabled: toBoolean(
    snapshot.get(APP_SETTING_KEYS.communityCreatorRewardBannerEnabled),
    true,
  ),
  featuredAssistants: {
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.communityFeaturedAssistantsEnabled), true),
    pageSize: toBoundedInt(
      snapshot.get(APP_SETTING_KEYS.communityFeaturedAssistantPageSize),
      12,
      1,
      24,
    ),
    title: toString(snapshot.get(APP_SETTING_KEYS.communityFeaturedAssistantTitle)),
  },
  featuredMcps: {
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.communityFeaturedMcpsEnabled), true),
    pageSize: toBoundedInt(snapshot.get(APP_SETTING_KEYS.communityFeaturedMcpPageSize), 12, 1, 24),
    title: toString(snapshot.get(APP_SETTING_KEYS.communityFeaturedMcpTitle)),
  },
  featuredSkills: {
    category: toString(snapshot.get(APP_SETTING_KEYS.communityFeaturedSkillCategory)),
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.communityFeaturedSkillsEnabled), false),
    pageSize: toBoundedInt(snapshot.get(APP_SETTING_KEYS.communityFeaturedSkillPageSize), 8, 1, 24),
    sort:
      toString(snapshot.get(APP_SETTING_KEYS.communityFeaturedSkillSort), 'installCount') ||
      'installCount',
    title: toString(snapshot.get(APP_SETTING_KEYS.communityFeaturedSkillTitle)),
  },
});

export const buildGrowthSettings = (snapshot: AppSettingsSnapshot) => ({
  initialCredits: {
    amount: toBoundedInt(
      snapshot.get(APP_SETTING_KEYS.onboardingInitialCredits),
      0,
      0,
      10_000_000_000,
    ),
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.onboardingInitialCreditsEnabled), false),
  },
  signup: {
    disabledMessage:
      toString(snapshot.get(APP_SETTING_KEYS.authSignupDisabledMessage)) ||
      'Registration is temporarily closed.',
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.authSignupEnabled), true),
    phoneEnabled: toBoolean(snapshot.get(APP_SETTING_KEYS.authSignupPhoneEnabled), false),
  },
  upload: {
    maxActualSizeMb: toBoundedInt(
      snapshot.get(APP_SETTING_KEYS.uploadMaxActualSizeMb),
      0,
      0,
      10_240,
    ),
    maxInputSizeMb: toBoundedInt(snapshot.get(APP_SETTING_KEYS.uploadMaxInputSizeMb), 0, 0, 10_240),
  },
});

export const buildExpertPlazaSettings = (snapshot: AppSettingsSnapshot) =>
  normalizeExpertPlazaConfig({
    cards: normalizeExpertPlazaCards(snapshot.get(APP_SETTING_KEYS.expertPlazaCards)),
    categories: toStringList(snapshot.get(APP_SETTING_KEYS.expertPlazaCategories)),
    description: toString(
      snapshot.get(APP_SETTING_KEYS.expertPlazaDescription),
      DEFAULT_EXPERT_PLAZA_CONFIG.description,
    ),
    enabled: toBoolean(
      snapshot.get(APP_SETTING_KEYS.expertPlazaEnabled),
      DEFAULT_EXPERT_PLAZA_CONFIG.enabled,
    ),
    name: toString(
      snapshot.get(APP_SETTING_KEYS.expertPlazaName),
      DEFAULT_EXPERT_PLAZA_CONFIG.name,
    ),
  });

export const buildSiteSettings = (
  snapshot: AppSettingsSnapshot,
  context: AdminSettingsReadContext,
) => {
  const brandName = snapshot.get(APP_SETTING_KEYS.brandName);
  const defaultAgentConfig = context.defaultAgentConfig ?? {};
  const defaultAgentName =
    toString(snapshot.get(APP_SETTING_KEYS.defaultAgentName)) ||
    toString(defaultAgentConfig.title) ||
    DEFAULT_COMHUB_AGENT_NAME;
  const defaultAgentAvatar =
    toString(snapshot.get(APP_SETTING_KEYS.defaultAgentAvatar)) ||
    toString(defaultAgentConfig.avatar) ||
    DEFAULT_COMHUB_AGENT_AVATAR;

  return {
    aboutLinks: normalizeAboutLinksConfig(snapshot.get(APP_SETTING_KEYS.aboutLinks)),
    aboutLogoUrl: toString(snapshot.get(APP_SETTING_KEYS.aboutLogoUrl)),
    aboutPage: normalizeAboutPageConfig(snapshot.get(APP_SETTING_KEYS.aboutPage)),
    brandAuthTitle: toRawString(
      snapshot.get(APP_SETTING_KEYS.brandAuthTitle),
      DEFAULT_RUNTIME_BRAND.authTitle,
    ),
    brandCopyrightText: toRawString(
      snapshot.get(APP_SETTING_KEYS.brandCopyrightText),
      DEFAULT_RUNTIME_BRAND.copyrightText,
    ),
    brandFaviconUrl: toRawString(snapshot.get(APP_SETTING_KEYS.brandFaviconUrl)),
    brandLoadingSvgUrl: toString(snapshot.get(APP_SETTING_KEYS.brandLoadingSvgUrl)),
    brandLoadingText: toNonBlankRawString(
      snapshot.get(APP_SETTING_KEYS.brandLoadingText),
      DEFAULT_RUNTIME_BRAND.loadingText,
    ),
    brandLogoUrl: toRawString(
      snapshot.get(APP_SETTING_KEYS.brandLogoUrl),
      DEFAULT_RUNTIME_BRAND.logoUrl,
    ),
    brandName: toRawString(brandName, DEFAULT_RUNTIME_BRAND.name),
    brandPrimaryColor: toRawString(
      snapshot.get(APP_SETTING_KEYS.brandPrimaryColor),
      DEFAULT_RUNTIME_BRAND.primaryColor,
    ),
    brandSlogan: toNonBlankRawString(
      snapshot.get(APP_SETTING_KEYS.brandSlogan),
      DEFAULT_RUNTIME_BRAND.authTitle,
    ),
    communityForkAndChatLabel: toRawString(
      snapshot.get(APP_SETTING_KEYS.communityForkAndChatLabel),
    ),
    communitySkillUseButtonLabel: toRawString(
      snapshot.get(APP_SETTING_KEYS.communitySkillUseButtonLabel),
    ),
    defaultAgentAvatar,
    defaultAgentName,
    defaultSkillName: toNonBlankRawString(
      snapshot.get(APP_SETTING_KEYS.defaultSkillName),
      toNonBlankRawString(brandName, DEFAULT_RUNTIME_BRAND.name),
    ),
    helpMenuItems: normalizeHelpMenuItems(snapshot.get(APP_SETTING_KEYS.helpMenuItems)),
    homeMessengerBannerTitle: toRawString(snapshot.get(APP_SETTING_KEYS.homeMessengerBannerTitle)),
    homeMessengerEnabled: toBoolean(snapshot.get(APP_SETTING_KEYS.homeMessengerEnabled), true),
    plansFaqItems: normalizePlanFaqSettings(snapshot.get(APP_SETTING_KEYS.plansFaqItems)),
    profileInterestAreas: normalizeProfileInterestAreas(
      snapshot.get(APP_SETTING_KEYS.profileInterestAreas),
    ),
    sidebarGenerationLabel:
      toString(snapshot.get(APP_SETTING_KEYS.sidebarGenerationLabel), '生成') || '生成',
    sidebarMemberLabel:
      toString(snapshot.get(APP_SETTING_KEYS.sidebarMemberLabel), '会员') || '会员',
    sidebarMemberUrl:
      toString(snapshot.get(APP_SETTING_KEYS.sidebarMemberUrl), '/settings/plans') ||
      '/settings/plans',
  };
};

export const buildModelBillingSettings = (
  snapshot: AppSettingsSnapshot,
  context: AdminSettingsReadContext = {},
) => {
  const defaultAgentConfig = context.defaultAgentConfig ?? {};
  const defaultAgentModel =
    toString(snapshot.get(APP_SETTING_KEYS.defaultAgentModel)) ||
    toString(defaultAgentConfig.model);
  const defaultAgentProvider =
    toString(snapshot.get(APP_SETTING_KEYS.defaultAgentProvider)) ||
    toString(defaultAgentConfig.provider);
  const pricingModelRules = snapshot.get(APP_SETTING_KEYS.pricingModelRules);

  return {
    defaultAgentModel,
    defaultAgentProvider,
    defaultImageModel: toRawString(snapshot.get(APP_SETTING_KEYS.defaultImageModel)),
    defaultImageProvider: toRawString(snapshot.get(APP_SETTING_KEYS.defaultImageProvider)),
    defaultModelSuggestions: Array.from(new Set([defaultAgentModel].filter(Boolean))),
    defaultVideoModel: toRawString(snapshot.get(APP_SETTING_KEYS.defaultVideoModel)),
    defaultVideoProvider: toRawString(snapshot.get(APP_SETTING_KEYS.defaultVideoProvider)),
    ordersManagementEnabled: false,
    pricingCreditMultiplier: toPositiveNumber(
      snapshot.get(APP_SETTING_KEYS.pricingCreditMultiplier),
      DEFAULT_PRICING_CREDIT_MULTIPLIER,
    ),
    pricingModelRules: Array.isArray(pricingModelRules) ? pricingModelRules : [],
  };
};

export const buildModelPolicySettings = (snapshot: AppSettingsSnapshot) => {
  const allowlist = normalizeModelIdList(snapshot.get(APP_SETTING_KEYS.modelPolicyAllowlist));
  const blocklist = normalizeModelIdList(snapshot.get(APP_SETTING_KEYS.modelPolicyBlocklist));

  return {
    allowlist,
    allowlistText: serializeModelIdList(allowlist) ?? '',
    applyToEmbeddings: toBoolean(snapshot.get(APP_SETTING_KEYS.modelPolicyApplyToEmbeddings), true),
    applyToGenerateObject: toBoolean(
      snapshot.get(APP_SETTING_KEYS.modelPolicyApplyToGenerateObject),
      true,
    ),
    blocklist,
    blocklistText: serializeModelIdList(blocklist) ?? '',
    defaultModelFallback:
      toString(snapshot.get(APP_SETTING_KEYS.modelPolicyDefaultModelFallback)) || null,
    deniedMessage:
      toString(snapshot.get(APP_SETTING_KEYS.modelPolicyDeniedMessage)) ||
      '当前模型未开放使用，请在后台模型权限中调整可用模型。',
    enabled: toBoolean(snapshot.get(APP_SETTING_KEYS.modelPolicyEnabled), false),
    mode:
      snapshot.get(APP_SETTING_KEYS.modelPolicyMode) === 'allowlist'
        ? ('allowlist' as const)
        : ('blocklist' as const),
  };
};

export const buildMobileSettings = (snapshot: AppSettingsSnapshot) =>
  normalizeMobileConfig(snapshot.get(APP_SETTING_KEYS.mobileConfig));

export const buildMaintenanceSettings = async (snapshot: AppSettingsSnapshot) => {
  const decryptedCronSecret = await decryptAppSettingSecret(
    APP_SETTING_KEYS.cronSecret,
    snapshot.get(APP_SETTING_KEYS.cronSecret),
  );
  const databaseCronSecret = typeof decryptedCronSecret === 'string' ? decryptedCronSecret : null;
  const effectiveCronSecret = databaseCronSecret ?? process.env.CRON_SECRET;

  return {
    cronAuditRetentionDays: toStoredNumber(
      snapshot.get(APP_SETTING_KEYS.cronAuditRetentionDays),
      365,
    ),
    cronPendingOrderExpiryDays: toStoredNumber(
      snapshot.get(APP_SETTING_KEYS.cronPendingOrderExpiryDays),
      7,
    ),
    cronSecretConfigured: Boolean(effectiveCronSecret),
    cronSecretMasked: maskAppSettingSecret(effectiveCronSecret),
    memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
      snapshot.get(APP_SETTING_KEYS.memoryUserMemoryTriggerMode),
    ),
  };
};

export const buildDesktopSettings = (snapshot: AppSettingsSnapshot) => {
  const storedOssSecret = toString(snapshot.get(APP_SETTING_KEYS.desktopOssAccessKeySecret));
  const downloadUrl = normalizeDesktopDownloadUrl(
    snapshot.get(APP_SETTING_KEYS.desktopDownloadUrl),
  );
  const serverUrl = normalizeDesktopUpdateServerUrl(
    snapshot.get(APP_SETTING_KEYS.desktopUpdateServerUrl),
  );

  return {
    desktopDownloadLabel: toString(snapshot.get(APP_SETTING_KEYS.desktopDownloadLabel)) || null,
    desktopDownloadUrl: 'url' in downloadUrl ? downloadUrl.url || null : null,
    desktopLoginConfig: {
      cloudButtonLabel: toString(snapshot.get(APP_SETTING_KEYS.desktopLoginCloudButtonLabel)),
      description: toString(snapshot.get(APP_SETTING_KEYS.desktopLoginDescription)),
      footerText: toString(snapshot.get(APP_SETTING_KEYS.desktopLoginFooterText)),
      logoUrl: toString(snapshot.get(APP_SETTING_KEYS.desktopLoginLogoUrl)),
      title: toString(snapshot.get(APP_SETTING_KEYS.desktopLoginTitle)),
      windowTitle: toString(snapshot.get(APP_SETTING_KEYS.desktopLoginWindowTitle)),
    },
    desktopOssConfig: {
      bucket: toString(snapshot.get(APP_SETTING_KEYS.desktopOssBucket)),
      credentialsConfigured: Boolean(
        toString(snapshot.get(APP_SETTING_KEYS.desktopOssAccessKeyId)) && storedOssSecret,
      ),
      endpoint: toString(snapshot.get(APP_SETTING_KEYS.desktopOssEndpoint)),
      path: toString(snapshot.get(APP_SETTING_KEYS.desktopOssPath), 'releases'),
    },
    desktopUpdateConfig: {
      autoCheck: toBoolean(snapshot.get(APP_SETTING_KEYS.desktopUpdateAutoCheck), true),
      channel: toString(snapshot.get(APP_SETTING_KEYS.desktopUpdateChannel), 'stable') || 'stable',
      checkInterval: toNumber(snapshot.get(APP_SETTING_KEYS.desktopUpdateCheckInterval), 60),
      currentVersion: toString(snapshot.get(APP_SETTING_KEYS.desktopUpdateCurrentVersion)),
      releaseNotes: toString(snapshot.get(APP_SETTING_KEYS.desktopUpdateReleaseNotes)),
      serverUrl: 'url' in serverUrl ? serverUrl.url : '',
    },
  };
};

export const buildSystemDefaultsSettings = async (snapshot: AppSettingsSnapshot) => {
  const decryptedComposioApiKey = await decryptAppSettingSecret(
    APP_SETTING_KEYS.composioApiKey,
    snapshot.get(APP_SETTING_KEYS.composioApiKey),
  );
  const databaseComposioApiKey =
    typeof decryptedComposioApiKey === 'string' ? decryptedComposioApiKey : null;
  const effectiveComposioApiKey = databaseComposioApiKey ?? process.env.COMPOSIO_API_KEY;
  const userGlobalSettingsDefaults = snapshot.get(APP_SETTING_KEYS.userGlobalSettingsDefaults);

  return {
    avatarPresets: normalizeAvatarPresets(snapshot.get(APP_SETTING_KEYS.profileAvatarPresets)),
    composioConfig: {
      apiKeyConfigured: Boolean(effectiveComposioApiKey),
      apiKeyMasked: maskAppSettingSecret(effectiveComposioApiKey),
      authConfigIds:
        toString(snapshot.get(APP_SETTING_KEYS.composioAuthConfigIds)) ||
        toString(process.env.COMPOSIO_AUTH_CONFIG_IDS),
      enabled: toBoolean(
        snapshot.get(APP_SETTING_KEYS.composioEnabled),
        Boolean(effectiveComposioApiKey),
      ),
    },
    memoryExtractionConfig: {
      embeddingModel: toString(snapshot.get(APP_SETTING_KEYS.memoryUserMemoryEmbeddingModel)),
      embeddingProvider: toString(snapshot.get(APP_SETTING_KEYS.memoryUserMemoryEmbeddingProvider)),
      gatekeeperModel: toString(snapshot.get(APP_SETTING_KEYS.memoryUserMemoryGatekeeperModel)),
      gatekeeperProvider: toString(
        snapshot.get(APP_SETTING_KEYS.memoryUserMemoryGatekeeperProvider),
      ),
      layerExtractorModel: toString(
        snapshot.get(APP_SETTING_KEYS.memoryUserMemoryLayerExtractorModel),
      ),
      layerExtractorProvider: toString(
        snapshot.get(APP_SETTING_KEYS.memoryUserMemoryLayerExtractorProvider),
      ),
      personaWriterModel: toString(
        snapshot.get(APP_SETTING_KEYS.memoryUserMemoryPersonaWriterModel),
      ),
      personaWriterProvider: toString(
        snapshot.get(APP_SETTING_KEYS.memoryUserMemoryPersonaWriterProvider),
      ),
    },
    profileInterestAreas: normalizeProfileInterestAreas(
      snapshot.get(APP_SETTING_KEYS.profileInterestAreas),
    ),
    userGlobalSettingsDefaults:
      userGlobalSettingsDefaults &&
      typeof userGlobalSettingsDefaults === 'object' &&
      !Array.isArray(userGlobalSettingsDefaults)
        ? userGlobalSettingsDefaults
        : {},
    vectorConfig: {
      dimensions: 1024,
      embeddingModel: toString(snapshot.get(APP_SETTING_KEYS.vectorEmbeddingModel)),
      embeddingProvider: toString(snapshot.get(APP_SETTING_KEYS.vectorEmbeddingProvider)),
      queryMode: toString(snapshot.get(APP_SETTING_KEYS.vectorQueryMode)),
      rerankerModel: toString(snapshot.get(APP_SETTING_KEYS.vectorRerankerModel)),
      rerankerProvider: toString(snapshot.get(APP_SETTING_KEYS.vectorRerankerProvider)),
    },
  };
};

export const buildNotificationSettings = (snapshot: AppSettingsSnapshot) => {
  const desktopEnabled = toBoolean(snapshot.get(APP_SETTING_KEYS.notificationDesktopEnabled), true);
  const systemType = toString(snapshot.get(APP_SETTING_KEYS.notificationSystemType));

  return {
    notificationDesktopEnabled: desktopEnabled,
    notificationEmailEnabled: toBoolean(
      snapshot.get(APP_SETTING_KEYS.notificationEmailEnabled),
      false,
    ),
    notificationEventDefaults: normalizeNotificationEventDefaults(
      snapshot.get(APP_SETTING_KEYS.notificationEventDefaults),
    ),
    notificationInboxEnabled: toBoolean(
      snapshot.get(APP_SETTING_KEYS.notificationInboxEnabled),
      true,
    ),
    notificationPushEnabled: toBoolean(
      snapshot.get(APP_SETTING_KEYS.notificationPushEnabled),
      desktopEnabled,
    ),
    notificationRetentionDays: toBoundedInt(
      snapshot.get(APP_SETTING_KEYS.notificationRetentionDays),
      90,
      1,
      3650,
    ),
    notificationSystemActionLabel: toString(
      snapshot.get(APP_SETTING_KEYS.notificationSystemActionLabel),
    ),
    notificationSystemActionUrl: toString(
      snapshot.get(APP_SETTING_KEYS.notificationSystemActionUrl),
    ),
    notificationSystemContent: toString(snapshot.get(APP_SETTING_KEYS.notificationSystemContent)),
    notificationSystemEnabled: toBoolean(
      snapshot.get(APP_SETTING_KEYS.notificationSystemEnabled),
      false,
    ),
    notificationSystemTitle: toString(snapshot.get(APP_SETTING_KEYS.notificationSystemTitle)),
    notificationSystemType: ['success', 'info', 'warning', 'error'].includes(systemType)
      ? systemType
      : 'warning',
  };
};

export const buildStorageSettings = async (snapshot: AppSettingsSnapshot) => {
  const decryptedSecret = await decryptAppSettingSecret(
    APP_SETTING_KEYS.storageS3SecretAccessKey,
    snapshot.get(APP_SETTING_KEYS.storageS3SecretAccessKey),
  );
  const databaseSecret = typeof decryptedSecret === 'string' ? decryptedSecret : null;
  const effectiveSecret = databaseSecret ?? process.env.S3_SECRET_ACCESS_KEY;

  return {
    storageS3AccessKeyId:
      toString(snapshot.get(APP_SETTING_KEYS.storageS3AccessKeyId)) ||
      toString(process.env.S3_ACCESS_KEY_ID),
    storageS3Bucket:
      toString(snapshot.get(APP_SETTING_KEYS.storageS3Bucket)) || toString(process.env.S3_BUCKET),
    storageS3EnablePathStyle: toBoolean(
      snapshot.get(APP_SETTING_KEYS.storageS3EnablePathStyle),
      process.env.S3_ENABLE_PATH_STYLE === '1',
    ),
    storageS3Endpoint:
      toString(snapshot.get(APP_SETTING_KEYS.storageS3Endpoint)) ||
      toString(process.env.S3_ENDPOINT),
    storageS3FilePath:
      normalizeS3FilePath(snapshot.get(APP_SETTING_KEYS.storageS3FilePath)) ||
      normalizeS3FilePath(process.env.NEXT_PUBLIC_S3_FILE_PATH) ||
      'files',
    storageS3PreviewUrlExpireIn: toBoundedInt(
      snapshot.get(APP_SETTING_KEYS.storageS3PreviewUrlExpireIn),
      Number.parseInt(process.env.S3_PREVIEW_URL_EXPIRE_IN || '7200') || 7200,
      60,
      604_800,
    ),
    storageS3PublicDomain:
      toString(snapshot.get(APP_SETTING_KEYS.storageS3PublicDomain)) ||
      toString(process.env.S3_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_S3_DOMAIN),
    storageS3Region:
      toString(snapshot.get(APP_SETTING_KEYS.storageS3Region)) || toString(process.env.S3_REGION),
    storageS3SecretAccessKeyConfigured: Boolean(effectiveSecret),
    storageS3SecretAccessKeyMasked: maskAppSettingSecret(effectiveSecret),
    storageS3SetAcl: toBoolean(
      snapshot.get(APP_SETTING_KEYS.storageS3SetAcl),
      process.env.S3_SET_ACL === '1',
    ),
  };
};

const buildPptSettings = async (snapshot: AppSettingsSnapshot) => {
  const raw = snapshot.toRecord();
  raw[APP_SETTING_KEYS.docmeePptApiKey] = await decryptAppSettingSecret(
    APP_SETTING_KEYS.docmeePptApiKey,
    snapshot.get(APP_SETTING_KEYS.docmeePptApiKey),
  );
  const settings = normalizeDocmeePptSettings(raw);

  return {
    ...settings,
    apiKey: '',
    apiKeyConfigured: Boolean(settings.apiKey),
    apiKeyMasked: maskAppSettingSecret(settings.apiKey),
  };
};

const buildSharedHealth = (
  section: AppSettingsSection,
  context: AdminSettingsReadContext,
): AdminSettingsSharedHealth => {
  if (
    section === 'ai-runtime-defaults' ||
    section === 'model-policy' ||
    section === 'system-defaults' ||
    section === 'user-defaults'
  ) {
    return { enabledNewapiModels: mapEnabledAdminModels(context.enabledModels) };
  }

  if (section === 'maintenance') {
    return {
      memoryUserMemoryTriggerModeEnv: normalizeOptionalMemoryUserMemoryTriggerMode(
        process.env.MEMORY_USER_MEMORY_TRIGGER_MODE,
      ),
      qstashTokenConfigured: Boolean(process.env.QSTASH_TOKEN),
    };
  }

  if (section === 'model-billing-matrix') {
    return { paymentGatewayStatus: PAYMENT_GATEWAY_STATUS };
  }

  return {};
};

export const buildAdminSettingsSectionReadModel = async (
  section: AppSettingsSection,
  snapshot: AppSettingsSnapshot,
  context: AdminSettingsReadContext = {},
) => {
  const sharedHealth = buildSharedHealth(section, context);

  switch (section) {
    case 'desktop-update': {
      return { ...buildDesktopSettings(snapshot), section, sharedHealth };
    }
    case 'expert-plaza': {
      return {
        expertPlazaConfig: buildExpertPlazaSettings(snapshot),
        section,
        sharedHealth,
      };
    }
    case 'file-storage': {
      return { ...(await buildStorageSettings(snapshot)), section, sharedHealth };
    }
    case 'growth': {
      return {
        growthConfig: buildGrowthSettings(snapshot),
        referralRewardCredits: toStoredNumber(
          snapshot.get(APP_SETTING_KEYS.referralRewardCredits),
          0,
        ),
        section,
        sharedHealth,
      };
    }
    case 'maintenance': {
      return { ...(await buildMaintenanceSettings(snapshot)), section, sharedHealth };
    }
    case 'mobile': {
      return { mobileConfig: buildMobileSettings(snapshot), section, sharedHealth };
    }
    case 'model-billing-matrix': {
      return { ...buildModelBillingSettings(snapshot, context), section, sharedHealth };
    }
    case 'model-policy': {
      return {
        modelPolicyConfig: buildModelPolicySettings(snapshot),
        section,
        sharedHealth,
      };
    }
    case 'notifications': {
      return { ...buildNotificationSettings(snapshot), section, sharedHealth };
    }
    case 'operations': {
      return {
        operationsConfig: buildOperationsSettings(snapshot),
        section,
        sharedHealth,
      };
    }
    case 'ppt': {
      return { ...(await buildPptSettings(snapshot)), section, sharedHealth };
    }
    case 'recommendations': {
      return {
        recommendationConfig: buildRecommendationSettings(snapshot),
        section,
        sharedHealth,
      };
    }
    case 'settings': {
      return { ...buildSiteSettings(snapshot, context), section, sharedHealth };
    }
    case 'ai-runtime-defaults':
    case 'integrations':
    case 'system-defaults':
    case 'user-defaults': {
      return { ...(await buildSystemDefaultsSettings(snapshot)), section, sharedHealth };
    }
    case 'plans': {
      return { ...buildSiteSettings(snapshot, context), section, sharedHealth };
    }
  }

  const exhaustiveSection: never = section;
  throw new Error(`Unsupported app settings section: ${exhaustiveSection}`);
};

export const buildAdminSettingsReadModel = async (
  snapshot: AppSettingsSnapshot,
  context: AdminSettingsReadContext = {},
) => {
  const [maintenance, storage, systemDefaults] = await Promise.all([
    buildMaintenanceSettings(snapshot),
    buildStorageSettings(snapshot),
    buildSystemDefaultsSettings(snapshot),
  ]);
  const modelBilling = buildModelBillingSettings(snapshot, context);

  return {
    ...buildSiteSettings(snapshot, context),
    ...maintenance,
    ...modelBilling,
    ...buildDesktopSettings(snapshot),
    ...systemDefaults,
    ...buildNotificationSettings(snapshot),
    ...storage,
    enabledNewapiModels: mapEnabledAdminModels(context.enabledModels),
    expertPlazaConfig: buildExpertPlazaSettings(snapshot),
    growthConfig: buildGrowthSettings(snapshot),
    memoryUserMemoryTriggerModeEnv: normalizeOptionalMemoryUserMemoryTriggerMode(
      process.env.MEMORY_USER_MEMORY_TRIGGER_MODE,
    ),
    modelPolicyConfig: buildModelPolicySettings(snapshot),
    operationsConfig: buildOperationsSettings(snapshot),
    paymentGatewayStatus: PAYMENT_GATEWAY_STATUS,
    qstashTokenConfigured: Boolean(process.env.QSTASH_TOKEN),
    recommendationConfig: buildRecommendationSettings(snapshot),
    referralRewardCredits: toStoredNumber(snapshot.get(APP_SETTING_KEYS.referralRewardCredits), 0),
  };
};
