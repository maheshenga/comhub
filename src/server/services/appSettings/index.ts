import type { LobeAgentConfig } from '@lobechat/types';
import { eq, inArray } from 'drizzle-orm';
import { type PartialDeep } from 'type-fest';

import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { type LobeChatDatabase } from '@/database/type';
import { type UserSettings } from '@/types/user/settings';

export const APP_SETTING_KEYS = {
  authSignupDisabledMessage: 'auth.signup.disabledMessage',
  authSignupEnabled: 'auth.signup.enabled',
  authSignupPhoneEnabled: 'auth.signup.phoneEnabled',
  aboutLinks: 'about.links',
  brandFaviconUrl: 'brand.faviconUrl',
  brandAuthTitle: 'brand.authTitle',
  brandCopyrightText: 'brand.copyrightText',
  brandLoadingText: 'brand.loadingText',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  // ComHub runtime UI copy: keep these backend-controlled during upstream sync.
  communityForkAndChatLabel: 'community.forkAndChat.label',
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
  memoryUserMemoryTriggerMode: 'memory.userMemory.triggerMode',
  notificationDesktopEnabled: 'notification.desktop.enabled',
  notificationEmailEnabled: 'notification.email.enabled',
  notificationInboxEnabled: 'notification.inbox.enabled',
  notificationRetentionDays: 'notification.retentionDays',
  notificationSystemActionUrl: 'notification.system.actionUrl',
  notificationSystemContent: 'notification.system.content',
  notificationSystemEnabled: 'notification.system.enabled',
  notificationSystemTitle: 'notification.system.title',
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
  uploadMaxActualSizeMb: 'upload.maxActualSizeMb',
  uploadMaxInputSizeMb: 'upload.maxInputSizeMb',
  userGlobalSettingsDefaults: 'user.globalSettings.defaults',
  vectorEmbeddingModel: 'vector.embedding.model',
  vectorEmbeddingProvider: 'vector.embedding.provider',
  vectorQueryMode: 'vector.queryMode',
  vectorRerankerModel: 'vector.reranker.model',
  vectorRerankerProvider: 'vector.reranker.provider',
} as const;

const CACHED_KEYS = [
  APP_SETTING_KEYS.defaultAgentAvatar,
  APP_SETTING_KEYS.defaultAgentModel,
  APP_SETTING_KEYS.defaultAgentName,
  APP_SETTING_KEYS.defaultAgentProvider,
  APP_SETTING_KEYS.defaultImageModel,
  APP_SETTING_KEYS.defaultImageProvider,
  APP_SETTING_KEYS.defaultVideoModel,
  APP_SETTING_KEYS.defaultVideoProvider,
  APP_SETTING_KEYS.modelPolicyAllowlist,
  APP_SETTING_KEYS.modelPolicyApplyToEmbeddings,
  APP_SETTING_KEYS.modelPolicyApplyToGenerateObject,
  APP_SETTING_KEYS.modelPolicyBlocklist,
  APP_SETTING_KEYS.modelPolicyDefaultModelFallback,
  APP_SETTING_KEYS.modelPolicyDeniedMessage,
  APP_SETTING_KEYS.modelPolicyEnabled,
  APP_SETTING_KEYS.modelPolicyMode,
  APP_SETTING_KEYS.memoryUserMemoryTriggerMode,
  APP_SETTING_KEYS.notificationInboxEnabled,
  APP_SETTING_KEYS.pricingCreditMultiplier,
  APP_SETTING_KEYS.pricingModelRules,
  APP_SETTING_KEYS.storageS3AccessKeyId,
  APP_SETTING_KEYS.storageS3Bucket,
  APP_SETTING_KEYS.storageS3EnablePathStyle,
  APP_SETTING_KEYS.storageS3Endpoint,
  APP_SETTING_KEYS.storageS3FilePath,
  APP_SETTING_KEYS.storageS3PreviewUrlExpireIn,
  APP_SETTING_KEYS.storageS3PublicDomain,
  APP_SETTING_KEYS.storageS3Region,
  APP_SETTING_KEYS.storageS3SecretAccessKey,
  APP_SETTING_KEYS.storageS3SetAcl,
  APP_SETTING_KEYS.userGlobalSettingsDefaults,
  APP_SETTING_KEYS.vectorEmbeddingModel,
  APP_SETTING_KEYS.vectorEmbeddingProvider,
  APP_SETTING_KEYS.vectorQueryMode,
  APP_SETTING_KEYS.vectorRerankerModel,
  APP_SETTING_KEYS.vectorRerankerProvider,
] as const;

const TTL_MS = 30_000;

type CachedSettings = { at: number; data: Record<string, unknown> };

let cachedSettings: CachedSettings | null = null;
let cachedSettingsByDb = new WeakMap<LobeChatDatabase, CachedSettings>();

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const normalizePositiveInt = (value: unknown, fallback: number, min: number, max: number) => {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(min, Math.min(max, Math.round(n)));
};

const DEFAULT_S3_FILE_PATH = 'files';

export const normalizeS3FilePath = (value: unknown) => {
  const text = normalizeString(value);

  if (!text) return null;

  return text.replaceAll('\\', '/').replaceAll(/^\/+|\/+$/g, '') || null;
};

export type ServerFileS3Config = {
  accessKeyId?: string;
  bucket?: string;
  enablePathStyle: boolean;
  endpoint?: string;
  filePath: string;
  previewUrlExpireIn: number;
  publicDomain?: string;
  region?: string;
  secretAccessKey?: string;
  setAcl: boolean;
};

export const getServerFileS3Config = async (db?: LobeChatDatabase): Promise<ServerFileS3Config> => {
  const [
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket,
    region,
    publicDomain,
    enablePathStyle,
    setAcl,
    previewUrlExpireIn,
    filePath,
  ] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.storageS3AccessKeyId, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3SecretAccessKey, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3Endpoint, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3Bucket, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3Region, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3PublicDomain, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3EnablePathStyle, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3SetAcl, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3PreviewUrlExpireIn, db),
    getAppSettingValue(APP_SETTING_KEYS.storageS3FilePath, db),
  ]);

  const envPreviewUrlExpireIn = Number.parseInt(process.env.S3_PREVIEW_URL_EXPIRE_IN || '7200');

  return {
    accessKeyId: normalizeString(accessKeyId) ?? process.env.S3_ACCESS_KEY_ID,
    bucket: normalizeString(bucket) ?? process.env.S3_BUCKET,
    enablePathStyle: normalizeBoolean(enablePathStyle, process.env.S3_ENABLE_PATH_STYLE === '1'),
    endpoint: normalizeString(endpoint) ?? process.env.S3_ENDPOINT,
    filePath:
      normalizeS3FilePath(filePath) ||
      normalizeS3FilePath(process.env.NEXT_PUBLIC_S3_FILE_PATH) ||
      DEFAULT_S3_FILE_PATH,
    previewUrlExpireIn: normalizePositiveInt(
      previewUrlExpireIn,
      Number.isFinite(envPreviewUrlExpireIn) ? envPreviewUrlExpireIn : 7200,
      60,
      604_800,
    ),
    publicDomain:
      normalizeString(publicDomain) ??
      process.env.S3_PUBLIC_DOMAIN ??
      process.env.NEXT_PUBLIC_S3_DOMAIN,
    region: normalizeString(region) ?? process.env.S3_REGION,
    secretAccessKey: normalizeString(secretAccessKey) ?? process.env.S3_SECRET_ACCESS_KEY,
    setAcl: normalizeBoolean(setAcl, process.env.S3_SET_ACL === '1'),
  };
};

export const normalizeModelIdList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;，；]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;，；]+/)
      : [];

  return Array.from(new Set(rawValues.map((item) => item.trim()).filter(Boolean)));
};

export const serializeModelIdList = (value: unknown) => {
  const modelIds = normalizeModelIdList(value);

  return modelIds.length > 0 ? modelIds.join('\n') : null;
};

const readCachedSettings = async (db?: LobeChatDatabase): Promise<Record<string, unknown>> => {
  const now = Date.now();
  const explicitCache = db ? cachedSettingsByDb.get(db) : cachedSettings;

  if (explicitCache && now - explicitCache.at < TTL_MS) return explicitCache.data;

  try {
    const serverDB = db ?? (await getServerDB());
    const rows = await serverDB.query.appSettings.findMany({
      where: inArray(appSettings.key, [...CACHED_KEYS]),
    });

    const data = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const nextCache = { at: now, data };
    if (db) {
      cachedSettingsByDb.set(db, nextCache);
    } else {
      cachedSettings = nextCache;
    }

    return data;
  } catch {
    const data: Record<string, unknown> = {};
    const nextCache = { at: now, data };
    if (db) {
      cachedSettingsByDb.set(db, nextCache);
    } else {
      cachedSettings = nextCache;
    }

    return data;
  }
};

export const getAppSettingValue = async (key: string, db?: LobeChatDatabase): Promise<unknown> => {
  if ((CACHED_KEYS as readonly string[]).includes(key)) {
    const cached = await readCachedSettings(db);
    return cached[key] ?? null;
  }

  try {
    const serverDB = db ?? (await getServerDB());
    const row = await serverDB.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
    return row?.value ?? null;
  } catch {
    return null;
  }
};

export const getServerDefaultAgentSettingOverrides = async (
  db?: LobeChatDatabase,
): Promise<PartialDeep<LobeAgentConfig>> => {
  const [rawModel, rawProvider, rawName, rawAvatar] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.defaultAgentModel, db),
    getAppSettingValue(APP_SETTING_KEYS.defaultAgentProvider, db),
    getAppSettingValue(APP_SETTING_KEYS.defaultAgentName, db),
    getAppSettingValue(APP_SETTING_KEYS.defaultAgentAvatar, db),
  ]);
  const model = normalizeString(rawModel);
  const provider = normalizeString(rawProvider);
  const title = normalizeString(rawName);
  const avatar = normalizeString(rawAvatar);

  return {
    ...(avatar ? { avatar } : {}),
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
    ...(title ? { title } : {}),
  };
};

export const getServerDefaultGenerationModelSettingOverrides = async (
  db?: LobeChatDatabase,
): Promise<{
  image?: { model?: string; provider?: string };
  video?: { model?: string; provider?: string };
}> => {
  const [rawImageModel, rawImageProvider, rawVideoModel, rawVideoProvider] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.defaultImageModel, db),
    getAppSettingValue(APP_SETTING_KEYS.defaultImageProvider, db),
    getAppSettingValue(APP_SETTING_KEYS.defaultVideoModel, db),
    getAppSettingValue(APP_SETTING_KEYS.defaultVideoProvider, db),
  ]);
  const imageModel = normalizeString(rawImageModel);
  const imageProvider = normalizeString(rawImageProvider);
  const videoModel = normalizeString(rawVideoModel);
  const videoProvider = normalizeString(rawVideoProvider);

  return {
    ...(imageModel || imageProvider
      ? {
          image: {
            ...(imageModel ? { model: imageModel } : {}),
            ...(imageProvider ? { provider: imageProvider } : {}),
          },
        }
      : {}),
    ...(videoModel || videoProvider
      ? {
          video: {
            ...(videoModel ? { model: videoModel } : {}),
            ...(videoProvider ? { provider: videoProvider } : {}),
          },
        }
      : {}),
  };
};

export const getServerVectorSettingOverrides = async (
  db?: LobeChatDatabase,
): Promise<{
  embeddingModel?: { model?: string; provider?: string };
  queryMode?: string;
  rerankerModel?: { model?: string; provider?: string };
}> => {
  const [
    rawEmbeddingProvider,
    rawEmbeddingModel,
    rawRerankerProvider,
    rawRerankerModel,
    rawQueryMode,
  ] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.vectorEmbeddingProvider, db),
    getAppSettingValue(APP_SETTING_KEYS.vectorEmbeddingModel, db),
    getAppSettingValue(APP_SETTING_KEYS.vectorRerankerProvider, db),
    getAppSettingValue(APP_SETTING_KEYS.vectorRerankerModel, db),
    getAppSettingValue(APP_SETTING_KEYS.vectorQueryMode, db),
  ]);

  const embeddingProvider = normalizeString(rawEmbeddingProvider);
  const embeddingModel = normalizeString(rawEmbeddingModel);
  const rerankerProvider = normalizeString(rawRerankerProvider);
  const rerankerModel = normalizeString(rawRerankerModel);
  const queryMode = normalizeString(rawQueryMode);

  return {
    ...(embeddingProvider || embeddingModel
      ? {
          embeddingModel: {
            ...(embeddingProvider ? { provider: embeddingProvider } : {}),
            ...(embeddingModel ? { model: embeddingModel } : {}),
          },
        }
      : {}),
    ...(queryMode ? { queryMode } : {}),
    ...(rerankerProvider || rerankerModel
      ? {
          rerankerModel: {
            ...(rerankerProvider ? { provider: rerankerProvider } : {}),
            ...(rerankerModel ? { model: rerankerModel } : {}),
          },
        }
      : {}),
  };
};

export const getServerUserGlobalSettingsDefaults = async (
  db?: LobeChatDatabase,
): Promise<PartialDeep<UserSettings>> => {
  const raw = await getAppSettingValue(APP_SETTING_KEYS.userGlobalSettingsDefaults, db);

  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as PartialDeep<UserSettings>)
    : {};
};

export const getServerDefaultModelSuggestions = async ({
  currentModel,
}: {
  currentModel?: string | null;
}) => {
  return Array.from(new Set([currentModel?.trim()].filter(Boolean) as string[]));
};

export type ServerModelPolicyUsageType =
  | 'chat'
  | 'embeddings'
  | 'generate_object'
  | 'image'
  | 'video';

export type ServerModelPolicyConfig = {
  allowlist: string[];
  applyToEmbeddings: boolean;
  applyToGenerateObject: boolean;
  blocklist: string[];
  defaultModelFallback: string | null;
  deniedMessage: string;
  enabled: boolean;
  mode: 'allowlist' | 'blocklist';
};

const normalizeModelPolicyMode = (value: unknown): ServerModelPolicyConfig['mode'] =>
  value === 'allowlist' || value === 'blocklist' ? value : 'blocklist';

export const getServerModelPolicyConfig = async (
  db?: LobeChatDatabase,
): Promise<ServerModelPolicyConfig> => {
  const [
    enabled,
    mode,
    allowlist,
    blocklist,
    deniedMessage,
    applyToEmbeddings,
    applyToGenerateObject,
    defaultModelFallback,
  ] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyEnabled, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyMode, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyAllowlist, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyBlocklist, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyDeniedMessage, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyApplyToEmbeddings, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyApplyToGenerateObject, db),
    getAppSettingValue(APP_SETTING_KEYS.modelPolicyDefaultModelFallback, db),
  ]);

  return {
    allowlist: normalizeModelIdList(allowlist),
    applyToEmbeddings: normalizeBoolean(applyToEmbeddings, true),
    applyToGenerateObject: normalizeBoolean(applyToGenerateObject, true),
    blocklist: normalizeModelIdList(blocklist),
    defaultModelFallback: normalizeString(defaultModelFallback),
    deniedMessage:
      normalizeString(deniedMessage) || '当前模型未开放使用，请在后台模型权限中调整可用模型。',
    enabled: normalizeBoolean(enabled, false),
    mode: normalizeModelPolicyMode(mode),
  };
};

export const invalidateServerAppSettings = () => {
  cachedSettings = null;
  cachedSettingsByDb = new WeakMap<LobeChatDatabase, CachedSettings>();
};
