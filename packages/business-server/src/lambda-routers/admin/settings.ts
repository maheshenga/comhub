import { randomUUID } from 'node:crypto';

import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq, lt } from 'drizzle-orm';
import { z } from 'zod';

import { normalizeAboutLinksConfig } from '@/const/aboutLinks';
import { normalizeAvatarPresets } from '@/const/avatarPresets';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { DEFAULT_COMHUB_AGENT_AVATAR, DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import {
  DEFAULT_EXPERT_PLAZA_CONFIG,
  normalizeExpertPlazaCards,
  normalizeExpertPlazaConfig,
} from '@/const/expertPlaza';
import {
  adminAuditLogs,
  appSettings,
  notifications,
  planCatalog,
  topUpOrders,
} from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { adminProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { getResolvedServerDefaultAgentConfig } from '@/server/globalConfig';
import { invalidateFileS3RuntimeCache, S3 } from '@/server/modules/S3';
import {
  APP_SETTING_KEYS,
  getServerDefaultModelSuggestions,
  getServerFileS3Config,
  getServerModelPolicyConfig,
  invalidateServerAppSettings,
  normalizeS3FilePath,
  serializeModelIdList,
} from '@/server/services/appSettings';
import { invalidateServerBrand } from '@/server/services/brand';
import { getAllEnabledModels } from '@/server/services/newapiInstance';

import { isModelAllowedByPlanRules } from '../../planModelRules';
import { syncExpiredSubscriptionsToFree } from '../../subscriptionMaintenance';
import { recordAdminAudit } from './audit';

const publicDbProcedure = publicProcedure.use(serverDatabase);

const maskApiKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (key.length <= 4) return '****';
  return `****${key.slice(-4)}`;
};

const SETTING_KEYS = APP_SETTING_KEYS;
const S3_HEALTH_CHECK_CONTENT = 'comhub-s3-health-check';
const S3_HEALTH_CHECK_DIR = 'admin-s3-health-check';

const getAppUrlFallback = () => {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;

  return process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT || 3010}`
    : `http://localhost:${process.env.PORT || 3210}`;
};

const getAppOriginForCorsTest = () => {
  try {
    return new URL(getAppUrlFallback()).origin;
  } catch {
    throw new Error('APP_URL must be a valid URL before testing S3 CORS');
  }
};

const createS3HealthCheckKey = (filePath: string | undefined) => {
  const prefix = normalizeS3FilePath(filePath || 'files') || 'files';

  return `${prefix}/${S3_HEALTH_CHECK_DIR}/${Date.now()}-${randomUUID()}.txt`;
};

const readResponseSnippet = async (response: Response) => {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
};

const assertHttpOk = async (response: Response, code: string) => {
  if (response.ok) return;

  const body = await readResponseSnippet(response);
  throw new Error(`${code}: ${response.status}${body ? ` ${body}` : ''}`);
};

const SENSITIVE_KEYS = new Set<string>([
  SETTING_KEYS.cronSecret,
  SETTING_KEYS.desktopOssAccessKeySecret,
  SETTING_KEYS.docmeePptApiKey,
  SETTING_KEYS.storageS3SecretAccessKey,
]);

const BRAND_KEYS = [
  SETTING_KEYS.brandAuthTitle,
  SETTING_KEYS.brandCopyrightText,
  SETTING_KEYS.brandLoadingText,
  SETTING_KEYS.brandName,
  SETTING_KEYS.brandLogoUrl,
  SETTING_KEYS.brandFaviconUrl,
  SETTING_KEYS.brandPrimaryColor,
  SETTING_KEYS.brandSlogan,
  SETTING_KEYS.homeMessengerEnabled,
  SETTING_KEYS.homeMessengerBannerTitle,
  SETTING_KEYS.communityForkAndChatLabel,
  SETTING_KEYS.sidebarMemberLabel,
  SETTING_KEYS.sidebarMemberUrl,
  SETTING_KEYS.sidebarGenerationLabel,
  SETTING_KEYS.defaultSkillName,
] as const;

const RECOMMENDATION_KEYS = [
  SETTING_KEYS.recommendationSectionEnabled,
  SETTING_KEYS.recommendationAssistantsEnabled,
  SETTING_KEYS.recommendationMcpsEnabled,
  SETTING_KEYS.recommendationSkillsEnabled,
  SETTING_KEYS.recommendationGeneralSkillsEnabled,
  SETTING_KEYS.recommendationHotSkillsEnabled,
  SETTING_KEYS.recommendationSelectedTags,
  SETTING_KEYS.recommendationAssistantTags,
  SETTING_KEYS.recommendationAssistantTitle,
  SETTING_KEYS.recommendationSkillCategories,
  SETTING_KEYS.recommendationSkillTitle,
  SETTING_KEYS.recommendationMcpCategories,
  SETTING_KEYS.recommendationMcpTitle,
  SETTING_KEYS.recommendationGeneralSkillCategories,
  SETTING_KEYS.recommendationGeneralSkillTitle,
  SETTING_KEYS.recommendationHotSkillSort,
  SETTING_KEYS.recommendationHotSkillTitle,
] as const;

const PRICING_KEYS = [
  SETTING_KEYS.pricingCreditMultiplier,
  SETTING_KEYS.pricingModelRules,
  SETTING_KEYS.ordersManagementEnabled,
] as const;

const OPERATIONS_KEYS = [
  SETTING_KEYS.communityCreatorRewardBannerEnabled,
  SETTING_KEYS.communityFeaturedAssistantsEnabled,
  SETTING_KEYS.communityFeaturedMcpsEnabled,
  SETTING_KEYS.communityFeaturedSkillsEnabled,
  SETTING_KEYS.communityFeaturedAssistantPageSize,
  SETTING_KEYS.communityFeaturedMcpPageSize,
  SETTING_KEYS.communityFeaturedSkillPageSize,
  SETTING_KEYS.communityFeaturedAssistantTitle,
  SETTING_KEYS.communityFeaturedMcpTitle,
  SETTING_KEYS.communityFeaturedSkillTitle,
  SETTING_KEYS.communityFeaturedSkillCategory,
  SETTING_KEYS.communityFeaturedSkillSort,
  SETTING_KEYS.communityHomeAnnouncementEnabled,
  SETTING_KEYS.communityHomeAnnouncementTitle,
  SETTING_KEYS.communityHomeAnnouncementContent,
  SETTING_KEYS.communityHomeAnnouncementType,
] as const;

const GROWTH_KEYS = [
  SETTING_KEYS.authSignupEnabled,
  SETTING_KEYS.authSignupDisabledMessage,
  SETTING_KEYS.authSignupPhoneEnabled,
  SETTING_KEYS.onboardingInitialCreditsEnabled,
  SETTING_KEYS.onboardingInitialCredits,
  SETTING_KEYS.uploadMaxInputSizeMb,
  SETTING_KEYS.uploadMaxActualSizeMb,
] as const;

const PROFILE_KEYS = [SETTING_KEYS.profileInterestAreas] as const;

const MEMORY_KEYS = [SETTING_KEYS.memoryUserMemoryTriggerMode] as const;

const VECTOR_KEYS = [
  SETTING_KEYS.vectorEmbeddingProvider,
  SETTING_KEYS.vectorEmbeddingModel,
  SETTING_KEYS.vectorRerankerProvider,
  SETTING_KEYS.vectorRerankerModel,
  SETTING_KEYS.vectorQueryMode,
] as const;

const USER_GLOBAL_KEYS = [SETTING_KEYS.userGlobalSettingsDefaults] as const;

const EXPERT_PLAZA_KEYS = [
  SETTING_KEYS.expertPlazaEnabled,
  SETTING_KEYS.expertPlazaName,
  SETTING_KEYS.expertPlazaDescription,
  SETTING_KEYS.expertPlazaCategories,
  SETTING_KEYS.expertPlazaCards,
] as const;

const NOTIFICATION_KEYS = [
  SETTING_KEYS.notificationInboxEnabled,
  SETTING_KEYS.notificationDesktopEnabled,
  SETTING_KEYS.notificationEmailEnabled,
  SETTING_KEYS.notificationRetentionDays,
  SETTING_KEYS.notificationSystemEnabled,
  SETTING_KEYS.notificationSystemTitle,
  SETTING_KEYS.notificationSystemContent,
  SETTING_KEYS.notificationSystemActionUrl,
] as const;

const STORAGE_KEYS = [
  SETTING_KEYS.storageS3AccessKeyId,
  SETTING_KEYS.storageS3SecretAccessKey,
  SETTING_KEYS.storageS3Endpoint,
  SETTING_KEYS.storageS3Bucket,
  SETTING_KEYS.storageS3Region,
  SETTING_KEYS.storageS3PublicDomain,
  SETTING_KEYS.storageS3FilePath,
  SETTING_KEYS.storageS3EnablePathStyle,
  SETTING_KEYS.storageS3SetAcl,
  SETTING_KEYS.storageS3PreviewUrlExpireIn,
] as const;

const MODEL_POLICY_KEYS = [
  SETTING_KEYS.modelPolicyEnabled,
  SETTING_KEYS.modelPolicyMode,
  SETTING_KEYS.modelPolicyAllowlist,
  SETTING_KEYS.modelPolicyBlocklist,
  SETTING_KEYS.modelPolicyDeniedMessage,
  SETTING_KEYS.modelPolicyApplyToEmbeddings,
  SETTING_KEYS.modelPolicyApplyToGenerateObject,
  SETTING_KEYS.modelPolicyDefaultModelFallback,
] as const;

const DESKTOP_UPDATE_KEYS = [
  SETTING_KEYS.desktopUpdateServerUrl,
  SETTING_KEYS.desktopUpdateChannel,
  SETTING_KEYS.desktopUpdateAutoCheck,
  SETTING_KEYS.desktopUpdateCheckInterval,
  SETTING_KEYS.desktopUpdateCurrentVersion,
  SETTING_KEYS.desktopUpdateReleaseNotes,
  SETTING_KEYS.desktopOssBucket,
  SETTING_KEYS.desktopOssEndpoint,
  SETTING_KEYS.desktopOssAccessKeyId,
  SETTING_KEYS.desktopOssAccessKeySecret,
  SETTING_KEYS.desktopOssPath,
] as const;

const readSetting = async (db: any, key: string): Promise<unknown> => {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value ?? null;
};

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

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toBoundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  return Math.max(min, Math.min(max, Math.round(n)));
};

const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const toOptionalUrlString = (value: unknown, key: string) => {
  const text = toString(value);
  if (!text) return '';

  try {
    new URL(text);
    return text;
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `${key} must be a valid URL`,
    });
  }
};

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

type AppSettingDraft = Record<string, unknown>;
type DefaultModelType = 'chat' | 'image' | 'video';

const settingDraftString = (settings: AppSettingDraft, key: string) =>
  typeof settings[key] === 'string' ? (settings[key] as string).trim() : '';

export const validateDefaultAgentModelUsability = async (
  db: LobeChatDatabase,
  settings: AppSettingDraft,
  options: {
    modelKey?: string;
    modelType?: DefaultModelType;
    providerKey?: string;
  } = {},
): Promise<void> => {
  const modelKey = options.modelKey ?? SETTING_KEYS.defaultAgentModel;
  const providerKey = options.providerKey ?? SETTING_KEYS.defaultAgentProvider;
  const modelType = options.modelType ?? 'chat';
  const provider = settingDraftString(settings, providerKey);
  const model = settingDraftString(settings, modelKey);

  if (!provider || !model) return;

  if (provider === 'newapi') {
    const enabledModels = await getAllEnabledModels(db);
    const matchedRoutes = enabledModels.filter((item) => item.id === model);

    if (matchedRoutes.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'DEFAULT_MODEL_NOT_ENABLED',
      });
    }

    const typeMatchedRoutes = matchedRoutes.filter((item) => item.type === modelType);

    if (typeMatchedRoutes.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'DEFAULT_MODEL_TYPE_MISMATCH',
      });
    }

    const freePlan = await db.query.planCatalog.findFirst({
      where: eq(planCatalog.plan, Plans.Free),
    });
    const modelRules = freePlan?.modelRules;

    if (!modelRules) return;

    const isAllowedByAnyEnabledRoute = typeMatchedRoutes.some((item) =>
      isModelAllowedByPlanRules(modelRules, model, modelType, item.groupKey),
    );

    if (!isAllowedByAnyEnabledRoute) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN',
      });
    }

    return;
  }

  const freePlan = await db.query.planCatalog.findFirst({
    where: eq(planCatalog.plan, Plans.Free),
  });
  const modelRules = freePlan?.modelRules;

  if (!modelRules) return;

  if (!isModelAllowedByPlanRules(modelRules, model, modelType)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN',
    });
  }
};

const readPublicRecommendations = async (db: any) => {
  const [
    enabled,
    assistantsEnabled,
    mcpsEnabled,
    skillsEnabled,
    generalSkillsEnabled,
    hotSkillsEnabled,
    selectedTags,
    assistantTags,
    assistantTitle,
    skillCategories,
    skillTitle,
    mcpCategories,
    mcpTitle,
    generalSkillCategories,
    generalSkillTitle,
    hotSkillSort,
    hotSkillTitle,
  ] = await Promise.all([
    readSetting(db, SETTING_KEYS.recommendationSectionEnabled),
    readSetting(db, SETTING_KEYS.recommendationAssistantsEnabled),
    readSetting(db, SETTING_KEYS.recommendationMcpsEnabled),
    readSetting(db, SETTING_KEYS.recommendationSkillsEnabled),
    readSetting(db, SETTING_KEYS.recommendationGeneralSkillsEnabled),
    readSetting(db, SETTING_KEYS.recommendationHotSkillsEnabled),
    readSetting(db, SETTING_KEYS.recommendationSelectedTags),
    readSetting(db, SETTING_KEYS.recommendationAssistantTags),
    readSetting(db, SETTING_KEYS.recommendationAssistantTitle),
    readSetting(db, SETTING_KEYS.recommendationSkillCategories),
    readSetting(db, SETTING_KEYS.recommendationSkillTitle),
    readSetting(db, SETTING_KEYS.recommendationMcpCategories),
    readSetting(db, SETTING_KEYS.recommendationMcpTitle),
    readSetting(db, SETTING_KEYS.recommendationGeneralSkillCategories),
    readSetting(db, SETTING_KEYS.recommendationGeneralSkillTitle),
    readSetting(db, SETTING_KEYS.recommendationHotSkillSort),
    readSetting(db, SETTING_KEYS.recommendationHotSkillTitle),
  ]);

  return {
    assistantTags: toStringList(assistantTags),
    assistantTitle: toString(assistantTitle, '为你推荐的助理'),
    assistantsEnabled: toBoolean(assistantsEnabled, true),
    enabled: toBoolean(enabled, false),
    generalSkillCategories: toStringList(generalSkillCategories),
    generalSkillTitle: toString(generalSkillTitle, '通用推荐技能'),
    generalSkillsEnabled: toBoolean(generalSkillsEnabled, true),
    hotSkillsEnabled: toBoolean(hotSkillsEnabled, true),
    hotSkillSort:
      typeof hotSkillSort === 'string' && hotSkillSort.length > 0 ? hotSkillSort : 'installCount',
    hotSkillTitle: toString(hotSkillTitle, '热门技能'),
    mcpCategories: toStringList(mcpCategories),
    mcpTitle: toString(mcpTitle, '推荐 MCP / 工具'),
    mcpsEnabled: toBoolean(mcpsEnabled, true),
    selectedTags: toStringList(selectedTags),
    skillCategories: toStringList(skillCategories),
    skillTitle: toString(skillTitle, '推荐技能'),
    skillsEnabled: toBoolean(skillsEnabled, true),
  };
};

const readPublicOperations = async (db: any) => {
  const [
    creatorRewardBannerEnabled,
    featuredAssistantsEnabled,
    featuredMcpsEnabled,
    featuredSkillsEnabled,
    featuredAssistantPageSize,
    featuredMcpPageSize,
    featuredSkillPageSize,
    featuredAssistantTitle,
    featuredMcpTitle,
    featuredSkillTitle,
    featuredSkillCategory,
    featuredSkillSort,
    announcementEnabled,
    announcementTitle,
    announcementContent,
    announcementType,
  ] = await Promise.all([
    readSetting(db, SETTING_KEYS.communityCreatorRewardBannerEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedAssistantsEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedMcpsEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillsEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedAssistantPageSize),
    readSetting(db, SETTING_KEYS.communityFeaturedMcpPageSize),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillPageSize),
    readSetting(db, SETTING_KEYS.communityFeaturedAssistantTitle),
    readSetting(db, SETTING_KEYS.communityFeaturedMcpTitle),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillTitle),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillCategory),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillSort),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementEnabled),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementTitle),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementContent),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementType),
  ]);

  return {
    announcement: {
      content: toString(announcementContent),
      enabled: toBoolean(announcementEnabled, false),
      title: toString(announcementTitle),
      type: ['success', 'info', 'warning', 'error'].includes(toString(announcementType))
        ? toString(announcementType)
        : 'info',
    },
    creatorRewardBannerEnabled: toBoolean(creatorRewardBannerEnabled, true),
    featuredAssistants: {
      enabled: toBoolean(featuredAssistantsEnabled, true),
      pageSize: toBoundedInt(featuredAssistantPageSize, 12, 1, 24),
      title: toString(featuredAssistantTitle),
    },
    featuredMcps: {
      enabled: toBoolean(featuredMcpsEnabled, true),
      pageSize: toBoundedInt(featuredMcpPageSize, 12, 1, 24),
      title: toString(featuredMcpTitle),
    },
    featuredSkills: {
      category: toString(featuredSkillCategory),
      enabled: toBoolean(featuredSkillsEnabled, false),
      pageSize: toBoundedInt(featuredSkillPageSize, 8, 1, 24),
      sort: toString(featuredSkillSort, 'installCount') || 'installCount',
      title: toString(featuredSkillTitle),
    },
  };
};

const readPublicGrowth = async (db: any) => {
  const [
    signupEnabled,
    signupDisabledMessage,
    signupPhoneEnabled,
    initialCreditsEnabled,
    initialCredits,
    uploadMaxInputSizeMb,
    uploadMaxActualSizeMb,
  ] = await Promise.all([
    readSetting(db, SETTING_KEYS.authSignupEnabled),
    readSetting(db, SETTING_KEYS.authSignupDisabledMessage),
    readSetting(db, SETTING_KEYS.authSignupPhoneEnabled),
    readSetting(db, SETTING_KEYS.onboardingInitialCreditsEnabled),
    readSetting(db, SETTING_KEYS.onboardingInitialCredits),
    readSetting(db, SETTING_KEYS.uploadMaxInputSizeMb),
    readSetting(db, SETTING_KEYS.uploadMaxActualSizeMb),
  ]);

  return {
    initialCredits: {
      amount: toBoundedInt(initialCredits, 0, 0, 10_000_000_000),
      enabled: toBoolean(initialCreditsEnabled, false),
    },
    signup: {
      disabledMessage: toString(signupDisabledMessage) || 'Registration is temporarily closed.',
      enabled: toBoolean(signupEnabled, true),
      phoneEnabled: toBoolean(signupPhoneEnabled, false),
    },
    upload: {
      maxActualSizeMb: toBoundedInt(uploadMaxActualSizeMb, 0, 0, 10_240),
      maxInputSizeMb: toBoundedInt(uploadMaxInputSizeMb, 0, 0, 10_240),
    },
  };
};

const readPublicExpertPlaza = async (db: any) => {
  const [enabled, name, description, categories, cards] = await Promise.all([
    readSetting(db, SETTING_KEYS.expertPlazaEnabled),
    readSetting(db, SETTING_KEYS.expertPlazaName),
    readSetting(db, SETTING_KEYS.expertPlazaDescription),
    readSetting(db, SETTING_KEYS.expertPlazaCategories),
    readSetting(db, SETTING_KEYS.expertPlazaCards),
  ]);

  return normalizeExpertPlazaConfig({
    cards: normalizeExpertPlazaCards(cards),
    categories: toStringList(categories),
    description: toString(description, DEFAULT_EXPERT_PLAZA_CONFIG.description),
    enabled: toBoolean(enabled, DEFAULT_EXPERT_PLAZA_CONFIG.enabled),
    name: toString(name, DEFAULT_EXPERT_PLAZA_CONFIG.name),
  });
};

export const adminSettingsRouter = router({
  /**
   * Public read of brand-related settings, used by the SPA shell to render the
   * configured brand name / logo / theme color before user is authenticated.
   * Only non-sensitive keys are exposed.
   */
  getPublicBrand: publicDbProcedure.query(async ({ ctx }) => {
    const [
      name,
      logo,
      favicon,
      primary,
      slogan,
      loadingText,
      authTitle,
      copyrightText,
      defaultSkillName,
      homeMessengerEnabled,
      homeMessengerBannerTitle,
      communityForkAndChatLabel,
      sidebarMemberLabel,
      sidebarMemberUrl,
      sidebarGenerationLabel,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.brandName),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandFaviconUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandPrimaryColor),
      readSetting(ctx.serverDB, SETTING_KEYS.brandSlogan),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLoadingText),
      readSetting(ctx.serverDB, SETTING_KEYS.brandAuthTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.brandCopyrightText),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultSkillName),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerBannerTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.communityForkAndChatLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarGenerationLabel),
    ]);
    const brandName = typeof name === 'string' ? name : DEFAULT_RUNTIME_BRAND.name;
    return {
      authTitle:
        typeof authTitle === 'string' && authTitle.trim()
          ? authTitle
          : DEFAULT_RUNTIME_BRAND.authTitle,
      copyrightText:
        typeof copyrightText === 'string' && copyrightText.trim()
          ? copyrightText
          : DEFAULT_RUNTIME_BRAND.copyrightText,
      defaultSkillName:
        typeof defaultSkillName === 'string' && defaultSkillName.trim()
          ? defaultSkillName
          : brandName,
      faviconUrl: typeof favicon === 'string' ? favicon : null,
      homeMessengerEnabled: toBoolean(homeMessengerEnabled, true),
      homeMessengerBannerTitle:
        typeof homeMessengerBannerTitle === 'string' && homeMessengerBannerTitle.trim()
          ? homeMessengerBannerTitle
          : null,
      loadingText:
        typeof loadingText === 'string' && loadingText.trim()
          ? loadingText
          : DEFAULT_RUNTIME_BRAND.loadingText,
      logoUrl: typeof logo === 'string' ? logo : DEFAULT_RUNTIME_BRAND.logoUrl,
      name: brandName,
      primaryColor: typeof primary === 'string' ? primary : DEFAULT_RUNTIME_BRAND.primaryColor,
      communityForkAndChatLabel:
        typeof communityForkAndChatLabel === 'string' && communityForkAndChatLabel.trim()
          ? communityForkAndChatLabel
          : null,
      sidebarGenerationLabel:
        typeof sidebarGenerationLabel === 'string' && sidebarGenerationLabel.trim()
          ? sidebarGenerationLabel
          : '生成',
      sidebarMemberLabel:
        typeof sidebarMemberLabel === 'string' && sidebarMemberLabel.trim()
          ? sidebarMemberLabel
          : '会员',
      sidebarMemberUrl:
        typeof sidebarMemberUrl === 'string' && sidebarMemberUrl.trim()
          ? sidebarMemberUrl
          : '/settings/plans',
      slogan:
        typeof slogan === 'string' && slogan.trim() ? slogan : DEFAULT_RUNTIME_BRAND.authTitle,
    };
  }),

  getPublicRecommendations: publicDbProcedure.query(async ({ ctx }) =>
    readPublicRecommendations(ctx.serverDB),
  ),

  getPublicOperations: publicDbProcedure.query(async ({ ctx }) =>
    readPublicOperations(ctx.serverDB),
  ),

  getPublicGrowth: publicDbProcedure.query(async ({ ctx }) => readPublicGrowth(ctx.serverDB)),

  getPublicExpertPlaza: publicDbProcedure.query(async ({ ctx }) =>
    readPublicExpertPlaza(ctx.serverDB),
  ),

  getPublicProfileOptions: publicDbProcedure.query(async ({ ctx }) => {
    const [interestAreas, avatarPresets] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.profileInterestAreas),
      readSetting(ctx.serverDB, SETTING_KEYS.profileAvatarPresets),
    ]);

    return {
      avatarPresets: normalizeAvatarPresets(avatarPresets),
      interestAreas: normalizeProfileInterestAreas(interestAreas),
    };
  }),

  getPublicNotificationConfig: publicDbProcedure.query(async ({ ctx }) => {
    const [
      inboxEnabled,
      desktopEnabled,
      emailEnabled,
      systemEnabled,
      systemTitle,
      systemContent,
      systemActionUrl,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.notificationInboxEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationDesktopEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationEmailEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemContent),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemActionUrl),
    ]);

    return {
      desktopEnabled: toBoolean(desktopEnabled, true),
      emailEnabled: toBoolean(emailEnabled, false),
      inboxEnabled: toBoolean(inboxEnabled, true),
      system: {
        actionUrl: toString(systemActionUrl) || null,
        content: toString(systemContent),
        enabled: toBoolean(systemEnabled, false),
        title: toString(systemTitle),
      },
    };
  }),

  getPublicHelpMenu: publicDbProcedure.query(async ({ ctx }) => {
    const raw = await readSetting(ctx.serverDB, SETTING_KEYS.helpMenuItems);
    return Array.isArray(raw) ? raw : [];
  }),

  getPublicAboutLinks: publicDbProcedure.query(async ({ ctx }) => {
    const raw = await readSetting(ctx.serverDB, SETTING_KEYS.aboutLinks);
    return normalizeAboutLinksConfig(raw);
  }),

  getPublicDesktopUpdate: publicDbProcedure.query(async ({ ctx }) => {
    const [serverUrl, channel, autoCheck, checkInterval, downloadUrl, downloadLabel] =
      await Promise.all([
        readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateServerUrl),
        readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateChannel),
        readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateAutoCheck),
        readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCheckInterval),
        readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadUrl),
        readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadLabel),
      ]);
    return {
      autoCheck: toBoolean(autoCheck, true),
      channel: toString(channel, 'stable') || 'stable',
      checkIntervalMinutes: toNumber(checkInterval, 60),
      downloadLabel: toString(downloadLabel) || null,
      downloadUrl: toString(downloadUrl) || null,
      serverUrl: toString(serverUrl),
    };
  }),

  getAll: adminProcedure.query(async ({ ctx }) => {
    const [
      referralReward,
      cronSecret,
      auditDays,
      pendingDays,
      brandName,
      brandLogo,
      brandFavicon,
      brandPrimary,
      brandSlogan,
      brandLoadingText,
      brandAuthTitle,
      brandCopyrightText,
      homeMessengerEnabled,
      homeMessengerBannerTitle,
      communityForkAndChatLabel,
      defaultAgentModel,
      defaultAgentName,
      defaultAgentAvatar,
      defaultAgentProvider,
      defaultImageModel,
      defaultImageProvider,
      defaultSkillName,
      defaultVideoModel,
      defaultVideoProvider,
      recommendationConfig,
      pricingCreditMultiplier,
      pricingModelRules,
      ordersManagementEnabled,
      operationsConfig,
      growthConfig,
      modelPolicyConfig,
      desktopUpdateServerUrl,
      desktopUpdateChannel,
      desktopUpdateAutoCheck,
      desktopUpdateCheckInterval,
      desktopUpdateCurrentVersion,
      desktopUpdateReleaseNotes,
      desktopOssBucket,
      desktopOssEndpoint,
      desktopOssAccessKeyId,
      desktopOssAccessKeySecret,
      desktopOssPath,
      desktopDownloadUrl,
      desktopDownloadLabel,
      helpMenuItems,
      aboutLinks,
      profileInterestAreas,
      avatarPresets,
      memoryUserMemoryTriggerMode,
      vectorEmbeddingProvider,
      vectorEmbeddingModel,
      vectorRerankerProvider,
      vectorRerankerModel,
      vectorQueryMode,
      userGlobalSettingsDefaults,
      expertPlazaConfig,
      notificationInboxEnabled,
      notificationDesktopEnabled,
      notificationEmailEnabled,
      notificationRetentionDays,
      notificationSystemEnabled,
      notificationSystemTitle,
      notificationSystemContent,
      notificationSystemActionUrl,
      storageS3AccessKeyId,
      storageS3SecretAccessKey,
      storageS3Endpoint,
      storageS3Bucket,
      storageS3Region,
      storageS3PublicDomain,
      storageS3FilePath,
      storageS3EnablePathStyle,
      storageS3SetAcl,
      storageS3PreviewUrlExpireIn,
      sidebarMemberLabel,
      sidebarMemberUrl,
      sidebarGenerationLabel,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.referralRewardCredits),
      readSetting(ctx.serverDB, SETTING_KEYS.cronSecret),
      readSetting(ctx.serverDB, SETTING_KEYS.cronAuditRetentionDays),
      readSetting(ctx.serverDB, SETTING_KEYS.cronPendingOrderExpiryDays),
      readSetting(ctx.serverDB, SETTING_KEYS.brandName),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandFaviconUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandPrimaryColor),
      readSetting(ctx.serverDB, SETTING_KEYS.brandSlogan),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLoadingText),
      readSetting(ctx.serverDB, SETTING_KEYS.brandAuthTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.brandCopyrightText),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerBannerTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.communityForkAndChatLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentModel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentName),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentAvatar),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultImageModel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultImageProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultSkillName),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultVideoModel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultVideoProvider),
      readPublicRecommendations(ctx.serverDB),
      readSetting(ctx.serverDB, SETTING_KEYS.pricingCreditMultiplier),
      readSetting(ctx.serverDB, SETTING_KEYS.pricingModelRules),
      readSetting(ctx.serverDB, SETTING_KEYS.ordersManagementEnabled),
      readPublicOperations(ctx.serverDB),
      readPublicGrowth(ctx.serverDB),
      getServerModelPolicyConfig(ctx.serverDB),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateServerUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateChannel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateAutoCheck),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCheckInterval),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCurrentVersion),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateReleaseNotes),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssBucket),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssEndpoint),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssAccessKeyId),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssAccessKeySecret),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssPath),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.helpMenuItems),
      readSetting(ctx.serverDB, SETTING_KEYS.aboutLinks),
      readSetting(ctx.serverDB, SETTING_KEYS.profileInterestAreas),
      readSetting(ctx.serverDB, SETTING_KEYS.profileAvatarPresets),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryTriggerMode),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorEmbeddingProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorEmbeddingModel),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorRerankerProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorRerankerModel),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorQueryMode),
      readSetting(ctx.serverDB, SETTING_KEYS.userGlobalSettingsDefaults),
      readPublicExpertPlaza(ctx.serverDB),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationInboxEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationDesktopEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationEmailEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationRetentionDays),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemContent),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemActionUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3AccessKeyId),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3SecretAccessKey),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3Endpoint),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3Bucket),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3Region),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3PublicDomain),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3FilePath),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3EnablePathStyle),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3SetAcl),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3PreviewUrlExpireIn),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarGenerationLabel),
    ]);

    const dbCronSecret = typeof cronSecret === 'string' ? cronSecret : null;
    const dbS3Secret =
      typeof storageS3SecretAccessKey === 'string' ? storageS3SecretAccessKey : null;

    const resolvedDefaultAgentConfig = await getResolvedServerDefaultAgentConfig(ctx.serverDB);
    const currentDefaultModel = ((typeof defaultAgentModel === 'string' &&
      defaultAgentModel.trim()) ||
      resolvedDefaultAgentConfig.model) as string | undefined;
    const currentDefaultProvider = ((typeof defaultAgentProvider === 'string' &&
      defaultAgentProvider.trim()) ||
      resolvedDefaultAgentConfig.provider) as string | undefined;
    const currentDefaultName = ((typeof defaultAgentName === 'string' && defaultAgentName.trim()) ||
      resolvedDefaultAgentConfig.title) as string | undefined;
    const currentDefaultAvatar = ((typeof defaultAgentAvatar === 'string' &&
      defaultAgentAvatar.trim()) ||
      resolvedDefaultAgentConfig.avatar) as string | undefined;
    const defaultModelSuggestions = await getServerDefaultModelSuggestions({
      currentModel: currentDefaultModel,
    });
    const enabledNewapiModels = await getAllEnabledModels(ctx.serverDB);

    return {
      brandFaviconUrl: typeof brandFavicon === 'string' ? brandFavicon : '',
      brandAuthTitle:
        typeof brandAuthTitle === 'string' ? brandAuthTitle : DEFAULT_RUNTIME_BRAND.authTitle,
      brandCopyrightText:
        typeof brandCopyrightText === 'string'
          ? brandCopyrightText
          : DEFAULT_RUNTIME_BRAND.copyrightText,
      communityForkAndChatLabel:
        typeof communityForkAndChatLabel === 'string' ? communityForkAndChatLabel : '',
      brandLogoUrl: typeof brandLogo === 'string' ? brandLogo : DEFAULT_RUNTIME_BRAND.logoUrl,
      brandName: typeof brandName === 'string' ? brandName : DEFAULT_RUNTIME_BRAND.name,
      brandPrimaryColor:
        typeof brandPrimary === 'string' ? brandPrimary : DEFAULT_RUNTIME_BRAND.primaryColor,
      brandSlogan:
        typeof brandSlogan === 'string' && brandSlogan.trim()
          ? brandSlogan
          : DEFAULT_RUNTIME_BRAND.authTitle,
      brandLoadingText:
        typeof brandLoadingText === 'string' && brandLoadingText.trim()
          ? brandLoadingText
          : DEFAULT_RUNTIME_BRAND.loadingText,
      homeMessengerBannerTitle:
        typeof homeMessengerBannerTitle === 'string' ? homeMessengerBannerTitle : '',
      homeMessengerEnabled: toBoolean(homeMessengerEnabled, true),
      sidebarGenerationLabel: toString(sidebarGenerationLabel, '生成') || '生成',
      sidebarMemberLabel: toString(sidebarMemberLabel, '会员') || '会员',
      sidebarMemberUrl: toString(sidebarMemberUrl, '/settings/plans') || '/settings/plans',
      cronAuditRetentionDays: typeof auditDays === 'number' ? auditDays : 365,
      cronPendingOrderExpiryDays: typeof pendingDays === 'number' ? pendingDays : 7,
      cronSecretConfigured: Boolean(dbCronSecret ?? process.env.CRON_SECRET),
      cronSecretMasked: maskApiKey(dbCronSecret ?? process.env.CRON_SECRET),
      defaultAgentAvatar: currentDefaultAvatar || DEFAULT_COMHUB_AGENT_AVATAR,
      defaultAgentModel: currentDefaultModel || '',
      defaultAgentName: currentDefaultName || DEFAULT_COMHUB_AGENT_NAME,
      defaultAgentProvider: currentDefaultProvider || '',
      defaultImageModel: typeof defaultImageModel === 'string' ? defaultImageModel : '',
      defaultImageProvider: typeof defaultImageProvider === 'string' ? defaultImageProvider : '',
      defaultSkillName:
        typeof defaultSkillName === 'string' && defaultSkillName.trim()
          ? defaultSkillName
          : typeof brandName === 'string' && brandName.trim()
            ? brandName
            : DEFAULT_RUNTIME_BRAND.name,
      defaultVideoModel: typeof defaultVideoModel === 'string' ? defaultVideoModel : '',
      defaultVideoProvider: typeof defaultVideoProvider === 'string' ? defaultVideoProvider : '',
      defaultModelSuggestions,
      enabledNewapiModels: enabledNewapiModels.map((item) => ({
        displayName: item.displayName,
        instanceName: item.instanceName ?? item.groupName ?? null,
        modelId: item.id,
        modelType: item.type,
        provider: 'newapi',
      })),
      ordersManagementEnabled: toBoolean(ordersManagementEnabled, true),
      paymentGatewayStatus: {
        configured: false,
        message:
          '支付网关尚未接入，用户自助支付会返回 PAYMENT_GATEWAY_NOT_CONFIGURED。当前可使用后台手动结算订单。',
        provider: null,
      },
      pricingCreditMultiplier: toNumber(pricingCreditMultiplier, 1),
      pricingModelRules: Array.isArray(pricingModelRules) ? pricingModelRules : [],
      operationsConfig,
      growthConfig,
      modelPolicyConfig: {
        ...modelPolicyConfig,
        allowlistText: serializeModelIdList(modelPolicyConfig.allowlist) ?? '',
        blocklistText: serializeModelIdList(modelPolicyConfig.blocklist) ?? '',
      },
      recommendationConfig,
      referralRewardCredits: typeof referralReward === 'number' ? referralReward : 0,
      desktopUpdateConfig: {
        autoCheck: toBoolean(desktopUpdateAutoCheck, true),
        channel: toString(desktopUpdateChannel, 'stable') || 'stable',
        checkInterval: toNumber(desktopUpdateCheckInterval, 60),
        currentVersion: toString(desktopUpdateCurrentVersion),
        releaseNotes: toString(desktopUpdateReleaseNotes),
        serverUrl: toString(desktopUpdateServerUrl),
      },
      desktopOssConfig: {
        accessKeyId: toString(desktopOssAccessKeyId),
        accessKeySecretMasked: maskApiKey(toString(desktopOssAccessKeySecret) || null),
        bucket: toString(desktopOssBucket),
        endpoint: toString(desktopOssEndpoint),
        path: toString(desktopOssPath, 'releases'),
      },
      desktopDownloadLabel: toString(desktopDownloadLabel) || null,
      desktopDownloadUrl: toString(desktopDownloadUrl) || null,
      helpMenuItems: Array.isArray(helpMenuItems) ? helpMenuItems : [],
      aboutLinks: normalizeAboutLinksConfig(aboutLinks),
      profileInterestAreas: normalizeProfileInterestAreas(profileInterestAreas),
      avatarPresets: normalizeAvatarPresets(avatarPresets),
      memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
        memoryUserMemoryTriggerMode,
      ),
      vectorConfig: {
        dimensions: 1024,
        embeddingModel: toString(vectorEmbeddingModel),
        embeddingProvider: toString(vectorEmbeddingProvider),
        queryMode: toString(vectorQueryMode),
        rerankerModel: toString(vectorRerankerModel),
        rerankerProvider: toString(vectorRerankerProvider),
      },
      userGlobalSettingsDefaults:
        userGlobalSettingsDefaults &&
        typeof userGlobalSettingsDefaults === 'object' &&
        !Array.isArray(userGlobalSettingsDefaults)
          ? userGlobalSettingsDefaults
          : {},
      expertPlazaConfig,
      memoryUserMemoryTriggerModeEnv: normalizeOptionalMemoryUserMemoryTriggerMode(
        process.env.MEMORY_USER_MEMORY_TRIGGER_MODE,
      ),
      qstashTokenConfigured: Boolean(process.env.QSTASH_TOKEN),
      notificationInboxEnabled: toBoolean(notificationInboxEnabled, true),
      notificationDesktopEnabled: toBoolean(notificationDesktopEnabled, true),
      notificationEmailEnabled: toBoolean(notificationEmailEnabled, false),
      notificationRetentionDays: toBoundedInt(notificationRetentionDays, 90, 1, 3650),
      notificationSystemEnabled: toBoolean(notificationSystemEnabled, false),
      notificationSystemTitle: toString(notificationSystemTitle),
      notificationSystemContent: toString(notificationSystemContent),
      notificationSystemActionUrl: toString(notificationSystemActionUrl),
      storageS3AccessKeyId:
        toString(storageS3AccessKeyId) || toString(process.env.S3_ACCESS_KEY_ID),
      storageS3Bucket: toString(storageS3Bucket) || toString(process.env.S3_BUCKET),
      storageS3EnablePathStyle: toBoolean(
        storageS3EnablePathStyle,
        process.env.S3_ENABLE_PATH_STYLE === '1',
      ),
      storageS3Endpoint: toString(storageS3Endpoint) || toString(process.env.S3_ENDPOINT),
      storageS3PreviewUrlExpireIn: toBoundedInt(
        storageS3PreviewUrlExpireIn,
        Number.parseInt(process.env.S3_PREVIEW_URL_EXPIRE_IN || '7200') || 7200,
        60,
        604_800,
      ),
      storageS3PublicDomain:
        toString(storageS3PublicDomain) ||
        toString(process.env.S3_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_S3_DOMAIN),
      storageS3FilePath:
        normalizeS3FilePath(storageS3FilePath) ||
        normalizeS3FilePath(process.env.NEXT_PUBLIC_S3_FILE_PATH) ||
        'files',
      storageS3Region: toString(storageS3Region) || toString(process.env.S3_REGION),
      storageS3SecretAccessKeyConfigured: Boolean(dbS3Secret ?? process.env.S3_SECRET_ACCESS_KEY),
      storageS3SecretAccessKeyMasked: maskApiKey(dbS3Secret ?? process.env.S3_SECRET_ACCESS_KEY),
      storageS3SetAcl: toBoolean(storageS3SetAcl, process.env.S3_SET_ACL === '1'),
    };
  }),

  validateDefaultAgentSettings: adminProcedure
    .input(
      z.object({
        model: z.string().optional(),
        modelType: z.enum(['chat', 'image', 'video']).optional(),
        provider: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const modelType = input.modelType ?? 'chat';
      const keys =
        modelType === 'image'
          ? {
              modelKey: SETTING_KEYS.defaultImageModel,
              providerKey: SETTING_KEYS.defaultImageProvider,
            }
          : modelType === 'video'
            ? {
                modelKey: SETTING_KEYS.defaultVideoModel,
                providerKey: SETTING_KEYS.defaultVideoProvider,
              }
            : {
                modelKey: SETTING_KEYS.defaultAgentModel,
                providerKey: SETTING_KEYS.defaultAgentProvider,
              };

      await validateDefaultAgentModelUsability(
        ctx.serverDB,
        {
          [keys.modelKey]: toString(input.model),
          [keys.providerKey]: toString(input.provider),
        },
        { ...keys, modelType },
      );

      return { ok: true };
    }),

  setAppSetting: adminProcedure
    .input(
      z.object({
        key: z.enum([
          SETTING_KEYS.defaultAgentModel,
          SETTING_KEYS.defaultAgentName,
          SETTING_KEYS.defaultAgentAvatar,
          SETTING_KEYS.defaultAgentProvider,
          SETTING_KEYS.defaultImageModel,
          SETTING_KEYS.defaultImageProvider,
          SETTING_KEYS.defaultSkillName,
          SETTING_KEYS.defaultVideoModel,
          SETTING_KEYS.defaultVideoProvider,
          SETTING_KEYS.referralRewardCredits,
          SETTING_KEYS.cronSecret,
          SETTING_KEYS.cronAuditRetentionDays,
          SETTING_KEYS.cronPendingOrderExpiryDays,
          ...RECOMMENDATION_KEYS,
          ...PRICING_KEYS,
          ...OPERATIONS_KEYS,
          ...GROWTH_KEYS,
          ...PROFILE_KEYS,
          SETTING_KEYS.profileAvatarPresets,
          ...MEMORY_KEYS,
          ...VECTOR_KEYS,
          ...USER_GLOBAL_KEYS,
          ...EXPERT_PLAZA_KEYS,
          ...NOTIFICATION_KEYS,
          ...STORAGE_KEYS,
          ...MODEL_POLICY_KEYS,
          ...BRAND_KEYS,
          ...DESKTOP_UPDATE_KEYS,
          SETTING_KEYS.desktopDownloadUrl,
          SETTING_KEYS.desktopDownloadLabel,
          SETTING_KEYS.helpMenuItems,
          SETTING_KEYS.aboutLinks,
        ]),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Coerce numeric keys to bounded integers to keep DB clean.
      let value: unknown = input.value;
      if (input.key === SETTING_KEYS.cronAuditRetentionDays) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('cronAuditRetentionDays must be a number');
        value = Math.max(7, Math.min(3650, Math.round(n)));
      } else if (input.key === SETTING_KEYS.cronPendingOrderExpiryDays) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('cronPendingOrderExpiryDays must be a number');
        value = Math.max(1, Math.min(365, Math.round(n)));
      } else if (input.key === SETTING_KEYS.referralRewardCredits) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('referralRewardCredits must be a number');
        value = Math.max(0, Math.round(n));
      } else if (input.key === SETTING_KEYS.defaultAgentModel) {
        value = typeof value === 'string' ? value.trim() : '';
      } else if (input.key === SETTING_KEYS.defaultAgentName) {
        value = typeof value === 'string' ? value.trim() : '';
      } else if (input.key === SETTING_KEYS.defaultAgentAvatar) {
        value = typeof value === 'string' ? value.trim() : '';
      } else if (input.key === SETTING_KEYS.defaultAgentProvider) {
        value = typeof value === 'string' ? value.trim() : '';
      } else if (
        input.key === SETTING_KEYS.defaultImageModel ||
        input.key === SETTING_KEYS.defaultImageProvider ||
        input.key === SETTING_KEYS.defaultVideoModel ||
        input.key === SETTING_KEYS.defaultVideoProvider
      ) {
        value = typeof value === 'string' ? value.trim() : '';
      } else if (input.key === SETTING_KEYS.defaultSkillName) {
        value = typeof value === 'string' ? value.trim() : '';
      } else if (input.key === SETTING_KEYS.pricingCreditMultiplier) {
        const n = Number(value);
        if (!Number.isFinite(n)) throw new Error('pricingCreditMultiplier must be a number');
        value = Math.max(0, Math.min(100, n));
      } else if (input.key === SETTING_KEYS.pricingModelRules) {
        value = Array.isArray(value) ? value : [];
      } else if (input.key === SETTING_KEYS.ordersManagementEnabled) {
        value = Boolean(value);
      } else if ((OPERATIONS_KEYS as readonly string[]).includes(input.key)) {
        if (
          [
            SETTING_KEYS.communityCreatorRewardBannerEnabled,
            SETTING_KEYS.communityFeaturedAssistantsEnabled,
            SETTING_KEYS.communityFeaturedMcpsEnabled,
            SETTING_KEYS.communityFeaturedSkillsEnabled,
            SETTING_KEYS.communityHomeAnnouncementEnabled,
          ].includes(input.key as any)
        ) {
          value = Boolean(value);
        } else if (
          [
            SETTING_KEYS.communityFeaturedAssistantPageSize,
            SETTING_KEYS.communityFeaturedMcpPageSize,
            SETTING_KEYS.communityFeaturedSkillPageSize,
          ].includes(input.key as any)
        ) {
          value = toBoundedInt(value, 12, 1, 24);
        } else {
          value = toString(value);
        }
      } else if ((GROWTH_KEYS as readonly string[]).includes(input.key)) {
        if (
          [SETTING_KEYS.authSignupEnabled, SETTING_KEYS.onboardingInitialCreditsEnabled].includes(
            input.key as any,
          ) ||
          input.key === SETTING_KEYS.authSignupPhoneEnabled
        ) {
          value = Boolean(value);
        } else if (
          [
            SETTING_KEYS.onboardingInitialCredits,
            SETTING_KEYS.uploadMaxInputSizeMb,
            SETTING_KEYS.uploadMaxActualSizeMb,
          ].includes(input.key as any)
        ) {
          value = toBoundedInt(value, 0, 0, 10_000_000_000);
        } else {
          value = toString(value);
        }
      } else if (input.key === SETTING_KEYS.profileInterestAreas) {
        value = normalizeProfileInterestAreas(value);
      } else if (input.key === SETTING_KEYS.profileAvatarPresets) {
        value = normalizeAvatarPresets(value);
      } else if (input.key === SETTING_KEYS.memoryUserMemoryTriggerMode) {
        value = normalizeMemoryUserMemoryTriggerMode(value);
      } else if ((VECTOR_KEYS as readonly string[]).includes(input.key)) {
        value = toString(value);
      } else if (input.key === SETTING_KEYS.userGlobalSettingsDefaults) {
        value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } else if ((EXPERT_PLAZA_KEYS as readonly string[]).includes(input.key)) {
        if (input.key === SETTING_KEYS.expertPlazaEnabled) {
          value = Boolean(value);
        } else if (input.key === SETTING_KEYS.expertPlazaCards) {
          value = normalizeExpertPlazaCards(value);
        } else if (input.key === SETTING_KEYS.expertPlazaCategories) {
          value = toStringList(value);
        } else {
          value = toString(value);
        }
      } else if ((NOTIFICATION_KEYS as readonly string[]).includes(input.key)) {
        if (
          [
            SETTING_KEYS.notificationInboxEnabled,
            SETTING_KEYS.notificationDesktopEnabled,
            SETTING_KEYS.notificationEmailEnabled,
            SETTING_KEYS.notificationSystemEnabled,
          ].includes(input.key as any)
        ) {
          value = Boolean(value);
        } else if (input.key === SETTING_KEYS.notificationRetentionDays) {
          value = toBoundedInt(value, 90, 1, 3650);
        } else {
          value = toString(value);
        }
      } else if ((STORAGE_KEYS as readonly string[]).includes(input.key)) {
        if (
          [SETTING_KEYS.storageS3EnablePathStyle, SETTING_KEYS.storageS3SetAcl].includes(
            input.key as any,
          )
        ) {
          value = Boolean(value);
        } else if (input.key === SETTING_KEYS.storageS3PreviewUrlExpireIn) {
          value = toBoundedInt(value, 7200, 60, 604_800);
        } else if (input.key === SETTING_KEYS.storageS3FilePath) {
          value = normalizeS3FilePath(value) || '';
        } else if (
          [SETTING_KEYS.storageS3Endpoint, SETTING_KEYS.storageS3PublicDomain].includes(
            input.key as any,
          )
        ) {
          value = toOptionalUrlString(value, input.key);
        } else {
          value = toString(value);
        }
      } else if ((MODEL_POLICY_KEYS as readonly string[]).includes(input.key)) {
        if (
          [
            SETTING_KEYS.modelPolicyEnabled,
            SETTING_KEYS.modelPolicyApplyToEmbeddings,
            SETTING_KEYS.modelPolicyApplyToGenerateObject,
          ].includes(input.key as any)
        ) {
          value = Boolean(value);
        } else if (
          [SETTING_KEYS.modelPolicyAllowlist, SETTING_KEYS.modelPolicyBlocklist].includes(
            input.key as any,
          )
        ) {
          value = toStringList(value);
        } else if (input.key === SETTING_KEYS.modelPolicyMode) {
          value = value === 'allowlist' || value === 'blocklist' ? value : 'blocklist';
        } else {
          value = toString(value);
        }
      } else if ((RECOMMENDATION_KEYS as readonly string[]).includes(input.key)) {
        if (
          [
            SETTING_KEYS.recommendationSectionEnabled,
            SETTING_KEYS.recommendationAssistantsEnabled,
            SETTING_KEYS.recommendationMcpsEnabled,
            SETTING_KEYS.recommendationSkillsEnabled,
            SETTING_KEYS.recommendationGeneralSkillsEnabled,
            SETTING_KEYS.recommendationHotSkillsEnabled,
          ].includes(input.key as any)
        ) {
          value = Boolean(value);
        } else if (input.key === SETTING_KEYS.recommendationHotSkillSort) {
          value = typeof value === 'string' && value.trim() ? value.trim() : 'installCount';
        } else if (
          [
            SETTING_KEYS.recommendationAssistantTitle,
            SETTING_KEYS.recommendationMcpTitle,
            SETTING_KEYS.recommendationSkillTitle,
            SETTING_KEYS.recommendationGeneralSkillTitle,
            SETTING_KEYS.recommendationHotSkillTitle,
          ].includes(input.key as any)
        ) {
          value = toString(value);
        } else {
          value = toStringList(value);
        }
      } else if ((BRAND_KEYS as readonly string[]).includes(input.key)) {
        value = toString(value);
      } else if (input.key === SETTING_KEYS.helpMenuItems) {
        if (!Array.isArray(value)) {
          value = [];
        } else {
          value = value
            .filter(
              (item: any) => item && typeof item === 'object' && typeof item.label === 'string',
            )
            .map((item: any) => ({
              label: String(item.label).trim(),
              ...(typeof item.url === 'string' && item.url.trim() ? { url: item.url.trim() } : {}),
            }));
        }
      } else if (input.key === SETTING_KEYS.aboutLinks) {
        value = normalizeAboutLinksConfig(value);
      } else if (input.key === SETTING_KEYS.desktopDownloadUrl) {
        value = toString(value);
      } else if (input.key === SETTING_KEYS.desktopDownloadLabel) {
        value = toString(value);
      } else if ((DESKTOP_UPDATE_KEYS as readonly string[]).includes(input.key)) {
        if (input.key === SETTING_KEYS.desktopUpdateAutoCheck) {
          value = Boolean(value);
        } else if (input.key === SETTING_KEYS.desktopUpdateCheckInterval) {
          value = toBoundedInt(value, 60, 1, 1440);
        } else if (input.key === SETTING_KEYS.desktopUpdateChannel) {
          value = value === 'canary' ? 'canary' : 'stable';
        } else {
          value = toString(value);
        }
      }

      if (
        input.key === SETTING_KEYS.defaultAgentModel ||
        input.key === SETTING_KEYS.defaultAgentProvider ||
        input.key === SETTING_KEYS.defaultImageModel ||
        input.key === SETTING_KEYS.defaultImageProvider ||
        input.key === SETTING_KEYS.defaultVideoModel ||
        input.key === SETTING_KEYS.defaultVideoProvider
      ) {
        const target =
          input.key === SETTING_KEYS.defaultImageModel ||
          input.key === SETTING_KEYS.defaultImageProvider
            ? {
                modelKey: SETTING_KEYS.defaultImageModel,
                modelType: 'image' as const,
                providerKey: SETTING_KEYS.defaultImageProvider,
              }
            : input.key === SETTING_KEYS.defaultVideoModel ||
                input.key === SETTING_KEYS.defaultVideoProvider
              ? {
                  modelKey: SETTING_KEYS.defaultVideoModel,
                  modelType: 'video' as const,
                  providerKey: SETTING_KEYS.defaultVideoProvider,
                }
              : {
                  modelKey: SETTING_KEYS.defaultAgentModel,
                  modelType: 'chat' as const,
                  providerKey: SETTING_KEYS.defaultAgentProvider,
                };
        const [currentModel, currentProvider] = await Promise.all([
          readSetting(ctx.serverDB, target.modelKey),
          readSetting(ctx.serverDB, target.providerKey),
        ]);

        await validateDefaultAgentModelUsability(
          ctx.serverDB,
          {
            [target.modelKey]: toString(currentModel),
            [target.providerKey]: toString(currentProvider),
            [input.key]: value,
          },
          target,
        );
      }

      await ctx.serverDB
        .insert(appSettings)
        .values({ key: input.key, value: value as any })
        .onConflictDoUpdate({
          set: { updatedAt: new Date(), value: value as any },
          target: appSettings.key,
        });

      const isSensitive = SENSITIVE_KEYS.has(input.key);
      await recordAdminAudit(ctx, {
        action: 'settings.set',
        payload: {
          hasValue: value !== null && value !== undefined && value !== '',
          key: input.key,
          ...(isSensitive ? {} : { value }),
        },
        resourceId: input.key,
        resourceType: 'app_setting',
      });

      // Invalidate the in-memory brand cache so the next SSR pickup picks up
      // the change without waiting for the TTL to expire.
      if ((BRAND_KEYS as readonly string[]).includes(input.key)) {
        invalidateServerBrand();
      }
      if ((STORAGE_KEYS as readonly string[]).includes(input.key)) {
        invalidateFileS3RuntimeCache();
      }

      invalidateServerAppSettings();

      return { ok: true };
    }),

  testS3Storage: adminProcedure.mutation(async ({ ctx }) => {
    const config = await getServerFileS3Config(ctx.serverDB);

    if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint || !config.bucket) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'S3_CONFIG_INCOMPLETE',
      });
    }

    try {
      const s3 = new S3(config.accessKeyId, config.secretAccessKey, config.endpoint, {
        bucket: config.bucket,
        forcePathStyle: config.enablePathStyle,
        previewUrlExpireIn: config.previewUrlExpireIn,
        region: config.region,
        setAcl: config.setAcl,
      });

      if (typeof fetch !== 'function') {
        throw new Error('FETCH_NOT_AVAILABLE');
      }

      const origin = getAppOriginForCorsTest();
      const healthCheckKey = createS3HealthCheckKey(config.filePath);
      let deleted = false;

      try {
        await s3.testConnection();

        const preSignedUrl = await s3.createPreSignedUrl(healthCheckKey);
        const corsPreflight = await fetch(preSignedUrl, {
          headers: {
            'Access-Control-Request-Headers': 'content-type',
            'Access-Control-Request-Method': 'PUT',
            'Origin': origin,
          },
          method: 'OPTIONS',
        });
        await assertHttpOk(corsPreflight, 'S3_CORS_PREFLIGHT_FAILED');

        const presignedUpload = await fetch(preSignedUrl, {
          body: S3_HEALTH_CHECK_CONTENT,
          headers: {
            'Content-Type': 'text/plain',
            'Origin': origin,
          },
          method: 'PUT',
        });
        await assertHttpOk(presignedUpload, 'S3_PRESIGNED_UPLOAD_FAILED');

        const storedContent = await s3.getFileContent(healthCheckKey);
        if (storedContent !== S3_HEALTH_CHECK_CONTENT) {
          throw new Error('S3_OBJECT_READ_MISMATCH');
        }

        await s3.deleteFile(healthCheckKey);
        deleted = true;

        return {
          bucket: config.bucket,
          checks: {
            bucketAccess: { ok: true },
            corsPreflight: {
              allowHeaders: corsPreflight.headers.get('access-control-allow-headers'),
              allowMethods: corsPreflight.headers.get('access-control-allow-methods'),
              allowOrigin: corsPreflight.headers.get('access-control-allow-origin'),
              ok: true,
              status: corsPreflight.status,
            },
            objectDelete: { ok: true },
            objectRead: {
              bytes: new TextEncoder().encode(storedContent).byteLength,
              ok: true,
            },
            presignedUpload: {
              allowOrigin: presignedUpload.headers.get('access-control-allow-origin'),
              ok: true,
              status: presignedUpload.status,
            },
          },
          endpoint: config.endpoint,
          filePath: config.filePath,
          ok: true,
          origin,
          publicDomain: config.publicDomain || null,
        };
      } finally {
        if (!deleted) {
          try {
            await s3.deleteFile(healthCheckKey);
          } catch (cleanupError) {
            console.error('S3 health check cleanup failed:', cleanupError);
          }
        }
      }
    } catch (error) {
      throw new TRPCError({
        cause: error,
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'S3_CONNECTION_FAILED',
      });
    }
  }),

  /**
   * Manually trigger maintenance job (audit pruning + pending order expiry + notification cleanup).
   * Reuses the same DB-driven defaults as the public cron route.
   */
  runMaintenance: adminProcedure
    .input(
      z
        .object({
          auditRetentionDays: z.number().int().min(7).max(3650).optional(),
          notificationRetentionDays: z.number().int().min(1).max(3650).optional(),
          pendingOrderExpiryDays: z.number().int().min(1).max(365).optional(),
          skipAudit: z.boolean().optional(),
          skipNotifications: z.boolean().optional(),
          skipOrders: z.boolean().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const opts = input ?? {};
      const result: {
        auditCutoff?: string;
        auditLogsDeleted?: number;
        freeSnapshotsCreated?: number;
        notificationRetentionCutoff?: string;
        notificationsDeleted?: number;
        pendingOrdersCutoff?: string;
        pendingOrdersExpired?: number;
        subscriptionSnapshotsExpired?: number;
      } = {};

      if (!opts.skipAudit) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.cronAuditRetentionDays);
        const days = Math.max(
          7,
          Math.min(3650, opts.auditRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 365)),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const deleted = await ctx.serverDB
          .delete(adminAuditLogs)
          .where(lt(adminAuditLogs.createdAt, cutoff))
          .returning({ id: adminAuditLogs.id });
        result.auditCutoff = cutoff.toISOString();
        result.auditLogsDeleted = deleted.length;
      }

      if (!opts.skipOrders) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.cronPendingOrderExpiryDays);
        const days = Math.max(
          1,
          Math.min(365, opts.pendingOrderExpiryDays ?? (typeof dbVal === 'number' ? dbVal : 7)),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const expired = await ctx.serverDB
          .update(topUpOrders)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(and(eq(topUpOrders.status, 'pending'), lt(topUpOrders.createdAt, cutoff)))
          .returning({ id: topUpOrders.id });
        result.pendingOrdersCutoff = cutoff.toISOString();
        result.pendingOrdersExpired = expired.length;
      }

      if (!opts.skipNotifications) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.notificationRetentionDays);
        const days = Math.max(
          1,
          Math.min(
            3650,
            opts.notificationRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 90),
          ),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const deleted = await ctx.serverDB
          .delete(notifications)
          .where(and(eq(notifications.isArchived, true), lt(notifications.updatedAt, cutoff)))
          .returning({ id: notifications.id });
        result.notificationRetentionCutoff = cutoff.toISOString();
        result.notificationsDeleted = deleted.length;
      }

      const subscriptionResult = await syncExpiredSubscriptionsToFree(ctx.serverDB);
      result.subscriptionSnapshotsExpired = subscriptionResult.expiredSnapshots;
      result.freeSnapshotsCreated = subscriptionResult.freeSnapshotsCreated;

      await recordAdminAudit(ctx, {
        action: 'maintenance.run',
        payload: result,
        resourceType: 'maintenance',
      });

      return { ok: true, ...result };
    }),
});
