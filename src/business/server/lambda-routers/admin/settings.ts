import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq, lt } from 'drizzle-orm';
import { z } from 'zod';

import { normalizeAboutLinksConfig } from '@/const/aboutLinks';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { adminAuditLogs, appSettings, planCatalog, topUpOrders } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { adminProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { getResolvedServerDefaultAgentConfig } from '@/server/globalConfig';
import {
  APP_SETTING_KEYS,
  getServerDefaultModelSuggestions,
  getServerModelPolicyConfig,
  invalidateServerAppSettings,
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

const SENSITIVE_KEYS = new Set<string>([
  SETTING_KEYS.cronSecret,
  SETTING_KEYS.desktopOssAccessKeySecret,
  SETTING_KEYS.docmeePptApiKey,
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
    const matchedModel = enabledModels.find((item) => item.id === model);

    if (!matchedModel) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'DEFAULT_MODEL_NOT_ENABLED',
      });
    }

    if (matchedModel.type !== modelType) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'DEFAULT_MODEL_TYPE_MISMATCH',
      });
    }
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
      loadingText:
        typeof loadingText === 'string' && loadingText.trim()
          ? loadingText
          : DEFAULT_RUNTIME_BRAND.loadingText,
      logoUrl: typeof logo === 'string' ? logo : DEFAULT_RUNTIME_BRAND.logoUrl,
      name: brandName,
      primaryColor: typeof primary === 'string' ? primary : DEFAULT_RUNTIME_BRAND.primaryColor,
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
    ]);

    const dbCronSecret = typeof cronSecret === 'string' ? cronSecret : null;

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
      cronAuditRetentionDays: typeof auditDays === 'number' ? auditDays : 365,
      cronPendingOrderExpiryDays: typeof pendingDays === 'number' ? pendingDays : 7,
      cronSecretConfigured: Boolean(dbCronSecret ?? process.env.CRON_SECRET),
      cronSecretMasked: maskApiKey(dbCronSecret ?? process.env.CRON_SECRET),
      defaultAgentAvatar: currentDefaultAvatar || '/images/brand/qingyou-ai-logo.png',
      defaultAgentModel: currentDefaultModel || '',
      defaultAgentName: currentDefaultName || '青柚助手',
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
        instanceName: null,
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

      invalidateServerAppSettings();

      return { ok: true };
    }),

  /**
   * Manually trigger maintenance job (audit pruning + pending order expiry).
   * Reuses the same DB-driven defaults as the public cron route.
   */
  runMaintenance: adminProcedure
    .input(
      z
        .object({
          auditRetentionDays: z.number().int().min(7).max(3650).optional(),
          pendingOrderExpiryDays: z.number().int().min(1).max(365).optional(),
          skipAudit: z.boolean().optional(),
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
