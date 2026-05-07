import type { LobeAgentConfig } from '@lobechat/types';
import { eq, inArray } from 'drizzle-orm';
import { type PartialDeep } from 'type-fest';

import { appSettings } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { type LobeChatDatabase } from '@/database/type';

export const APP_SETTING_KEYS = {
  brandFaviconUrl: 'brand.faviconUrl',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  cronAuditRetentionDays: 'cron.auditRetentionDays',
  cronPendingOrderExpiryDays: 'cron.pendingOrderExpiryDays',
  cronSecret: 'cron.secret',
  defaultAgentModel: 'defaultAgent.model',
  defaultAgentProvider: 'defaultAgent.provider',
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
  authSignupDisabledMessage: 'auth.signup.disabledMessage',
  authSignupEnabled: 'auth.signup.enabled',
  onboardingInitialCredits: 'onboarding.initialCredits',
  onboardingInitialCreditsEnabled: 'onboarding.initialCredits.enabled',
  uploadMaxActualSizeMb: 'upload.maxActualSizeMb',
  uploadMaxInputSizeMb: 'upload.maxInputSizeMb',
  modelPolicyAllowlist: 'model.policy.allowlist',
  modelPolicyApplyToEmbeddings: 'model.policy.applyToEmbeddings',
  modelPolicyApplyToGenerateObject: 'model.policy.applyToGenerateObject',
  modelPolicyBlocklist: 'model.policy.blocklist',
  modelPolicyDefaultModelFallback: 'model.policy.defaultModelFallback',
  modelPolicyDeniedMessage: 'model.policy.deniedMessage',
  modelPolicyEnabled: 'model.policy.enabled',
  modelPolicyMode: 'model.policy.mode',
  ordersManagementEnabled: 'orders.management.enabled',
  pricingCreditMultiplier: 'pricing.creditMultiplier',
  pricingModelRules: 'pricing.modelRules',
  referralRewardCredits: 'referral.rewardCredits',
  desktopUpdateServerUrl: 'desktop.update.serverUrl',
  desktopUpdateChannel: 'desktop.update.channel',
  desktopUpdateAutoCheck: 'desktop.update.autoCheck',
  desktopUpdateCheckInterval: 'desktop.update.checkInterval',
  desktopUpdateCurrentVersion: 'desktop.update.currentVersion',
  desktopUpdateReleaseNotes: 'desktop.update.releaseNotes',
  desktopOssBucket: 'desktop.oss.bucket',
  desktopOssEndpoint: 'desktop.oss.endpoint',
  desktopOssAccessKeyId: 'desktop.oss.accessKeyId',
  desktopOssAccessKeySecret: 'desktop.oss.accessKeySecret',
  desktopOssPath: 'desktop.oss.path',
  recommendationAssistantsEnabled: 'recommendation.assistants.enabled',
  recommendationAssistantTags: 'recommendation.assistantTags',
  recommendationGeneralSkillsEnabled: 'recommendation.generalSkills.enabled',
  recommendationGeneralSkillCategories: 'recommendation.generalSkillCategories',
  recommendationHotSkillsEnabled: 'recommendation.hotSkills.enabled',
  recommendationHotSkillSort: 'recommendation.hotSkillSort',
  recommendationMcpsEnabled: 'recommendation.mcps.enabled',
  recommendationMcpCategories: 'recommendation.mcpCategories',
  recommendationSectionEnabled: 'recommendation.section.enabled',
  recommendationSkillsEnabled: 'recommendation.skills.enabled',
  recommendationSelectedTags: 'recommendation.selectedTags',
  recommendationSkillCategories: 'recommendation.skillCategories',
  desktopDownloadUrl: 'desktop.download.url',
  desktopDownloadLabel: 'desktop.download.label',
  helpMenuItems: 'help.menu.items',
} as const;

const CACHED_KEYS = [
  APP_SETTING_KEYS.defaultAgentModel,
  APP_SETTING_KEYS.defaultAgentProvider,
  APP_SETTING_KEYS.modelPolicyAllowlist,
  APP_SETTING_KEYS.modelPolicyApplyToEmbeddings,
  APP_SETTING_KEYS.modelPolicyApplyToGenerateObject,
  APP_SETTING_KEYS.modelPolicyBlocklist,
  APP_SETTING_KEYS.modelPolicyDefaultModelFallback,
  APP_SETTING_KEYS.modelPolicyDeniedMessage,
  APP_SETTING_KEYS.modelPolicyEnabled,
  APP_SETTING_KEYS.modelPolicyMode,
] as const;

const TTL_MS = 30_000;

let cachedSettings: { at: number; data: Record<string, unknown> } | null = null;

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeModelIdList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;；，]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;；，]+/)
      : [];

  return Array.from(new Set(rawValues.map((item) => item.trim()).filter(Boolean)));
};

export const serializeModelIdList = (value: unknown) => {
  const modelIds = normalizeModelIdList(value);

  return modelIds.length > 0 ? modelIds.join('\n') : null;
};

const readCachedSettings = async (db?: LobeChatDatabase): Promise<Record<string, unknown>> => {
  if (cachedSettings && Date.now() - cachedSettings.at < TTL_MS) return cachedSettings.data;

  try {
    const serverDB = db ?? (await getServerDB());
    const rows = await serverDB.query.appSettings.findMany({
      where: inArray(appSettings.key, [...CACHED_KEYS]),
    });

    const data = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    cachedSettings = { at: Date.now(), data };

    return data;
  } catch {
    const data: Record<string, unknown> = {};
    cachedSettings = { at: Date.now(), data };

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
  const rawModel = await getAppSettingValue(APP_SETTING_KEYS.defaultAgentModel, db);
  const rawProvider = await getAppSettingValue(APP_SETTING_KEYS.defaultAgentProvider, db);
  const model = normalizeString(rawModel);
  const provider = normalizeString(rawProvider);

  return {
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
  };
};

export const getServerDefaultModelSuggestions = async ({
  currentModel,
}: {
  currentModel?: string | null;
}) => {
  return Array.from(new Set([currentModel?.trim()].filter(Boolean) as string[]));
};

export type ServerModelPolicyUsageType = 'chat' | 'embeddings' | 'generate_object';

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

const normalizeBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

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
};
