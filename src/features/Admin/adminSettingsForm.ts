import {
  type AboutLinksConfig,
  DEFAULT_ABOUT_LINKS,
  normalizeAboutLinksConfig,
} from '@/const/aboutLinks';
import {
  BRAND_CONFIG_SWR_KEY,
  PROFILE_INTEREST_AREAS_SWR_KEY,
  RUNTIME_CONFIG_SWR_KEY,
  USER_STATE_SWR_KEY,
} from '@/const/adminCacheKeys';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import {
  type ConfiguredInterestArea,
  normalizeConfiguredInterestAreas,
} from '@/features/ProfileInterests/interestAreas';

export {
  ADMIN_SETTINGS_SWR_KEY,
  BRAND_CONFIG_SWR_KEY,
  PROFILE_INTEREST_AREAS_SWR_KEY,
  PROFILE_OPTIONS_SWR_KEY,
  PUBLIC_EXPERT_PLAZA_SWR_KEY,
  RUNTIME_CONFIG_SWR_KEY,
  USER_STATE_SWR_KEY,
} from '@/const/adminCacheKeys';

export const SETTING_KEYS = {
  aboutLinks: 'about.links',
  brandFaviconUrl: 'brand.faviconUrl',
  brandAuthTitle: 'brand.authTitle',
  brandCopyrightText: 'brand.copyrightText',
  brandLoadingText: 'brand.loadingText',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  communityForkAndChatLabel: 'community.forkAndChat.label',
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
  helpMenuItems: 'help.menu.items',
  homeMessengerEnabled: 'home.messenger.enabled',
  homeMessengerBannerTitle: 'home.messengerBanner.title',
  memoryUserMemoryTriggerMode: 'memory.userMemory.triggerMode',
  notificationDesktopEnabled: 'notification.desktop.enabled',
  notificationEmailEnabled: 'notification.email.enabled',
  notificationInboxEnabled: 'notification.inbox.enabled',
  notificationRetentionDays: 'notification.retentionDays',
  notificationSystemActionUrl: 'notification.system.actionUrl',
  notificationSystemContent: 'notification.system.content',
  notificationSystemEnabled: 'notification.system.enabled',
  notificationSystemTitle: 'notification.system.title',
  profileInterestAreas: 'profile.interestAreas',
  ordersManagementEnabled: 'orders.management.enabled',
  pricingCreditMultiplier: 'pricing.creditMultiplier',
  pricingModelRules: 'pricing.modelRules',
  referralRewardCredits: 'referral.rewardCredits',
  sidebarGenerationLabel: 'sidebar.generation.label',
  sidebarMemberLabel: 'sidebar.member.label',
  sidebarMemberUrl: 'sidebar.member.url',
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
} as const;

export type HelpMenuItem = { label: string; url?: string };

export type MemoryUserMemoryTriggerMode = 'auto' | 'direct' | 'workflow';

export type EnabledNewapiModelOption = {
  displayName?: string | null;
  instanceName?: string | null;
  modelId: string;
  modelType: string;
  provider?: string | null;
};

export type DefaultModelOption = {
  label: string;
  model: string;
  provider: string;
  value: string;
};

export type AdminSettingsData = {
  brandFaviconUrl?: string | null;
  brandAuthTitle?: string | null;
  brandCopyrightText?: string | null;
  brandLogoUrl?: string | null;
  brandLoadingText?: string | null;
  brandName?: string | null;
  brandPrimaryColor?: string | null;
  brandSlogan?: string | null;
  communityForkAndChatLabel?: string | null;
  aboutLinks?: unknown;
  cronAuditRetentionDays?: number | null;
  cronPendingOrderExpiryDays?: number | null;
  defaultAgentAvatar?: string | null;
  defaultAgentModel?: string | null;
  defaultAgentName?: string | null;
  defaultAgentProvider?: string | null;
  defaultImageModel?: string | null;
  defaultImageProvider?: string | null;
  defaultSkillName?: string | null;
  defaultVideoModel?: string | null;
  defaultVideoProvider?: string | null;
  defaultModelSuggestions?: string[] | null;
  desktopDownloadLabel?: string | null;
  desktopDownloadUrl?: string | null;
  enabledNewapiModels?: EnabledNewapiModelOption[] | null;
  helpMenuItems?: unknown;
  homeMessengerBannerTitle?: string | null;
  homeMessengerEnabled?: boolean | null;
  memoryUserMemoryTriggerMode?: MemoryUserMemoryTriggerMode | string | null;
  memoryUserMemoryTriggerModeEnv?: string | null;
  qstashTokenConfigured?: boolean | null;
  notificationDesktopEnabled?: boolean | null;
  notificationEmailEnabled?: boolean | null;
  notificationInboxEnabled?: boolean | null;
  notificationRetentionDays?: number | null;
  notificationSystemActionUrl?: string | null;
  notificationSystemContent?: string | null;
  notificationSystemEnabled?: boolean | null;
  notificationSystemTitle?: string | null;
  ordersManagementEnabled?: boolean | null;
  paymentGatewayStatus?: {
    configured: boolean;
    message: string;
    provider?: string | null;
  } | null;
  pricingCreditMultiplier?: number | null;
  pricingModelRules?: unknown[] | null;
  profileInterestAreas?: unknown;
  referralRewardCredits?: number | null;
  sidebarGenerationLabel?: string | null;
  sidebarMemberLabel?: string | null;
  sidebarMemberUrl?: string | null;
  storageS3AccessKeyId?: string | null;
  storageS3Bucket?: string | null;
  storageS3EnablePathStyle?: boolean | null;
  storageS3Endpoint?: string | null;
  storageS3FilePath?: string | null;
  storageS3PreviewUrlExpireIn?: number | null;
  storageS3PublicDomain?: string | null;
  storageS3Region?: string | null;
  storageS3SecretAccessKeyConfigured?: boolean | null;
  storageS3SecretAccessKeyMasked?: string | null;
  storageS3SetAcl?: boolean | null;
};

export type AdminSettingsFormValues = {
  brandFaviconUrl: string;
  brandAuthTitle: string;
  brandCopyrightText: string;
  brandLogoUrl: string;
  brandLoadingText: string;
  brandName: string;
  brandPrimaryColor: string;
  brandSlogan: string;
  communityForkAndChatLabel: string;
  aboutLinks: AboutLinksConfig;
  cronAuditRetentionDays: number;
  cronPendingOrderExpiryDays: number;
  cronSecret: string;
  defaultAgentAvatar: string;
  defaultAgentModel: string;
  defaultAgentName: string;
  defaultAgentProvider: string;
  defaultImageModel: string;
  defaultImageProvider: string;
  defaultSkillName: string;
  defaultVideoModel: string;
  defaultVideoProvider: string;
  desktopDownloadLabel: string;
  desktopDownloadUrl: string;
  helpMenuItems: HelpMenuItem[];
  homeMessengerBannerTitle: string;
  homeMessengerEnabled: boolean;
  memoryUserMemoryTriggerMode: MemoryUserMemoryTriggerMode;
  profileInterestAreas: ConfiguredInterestArea[];
  ordersEnabled: boolean;
  pricingMultiplier: number;
  referralRewardCredits: number;
  sidebarGenerationLabel: string;
  sidebarMemberLabel: string;
  sidebarMemberUrl: string;
  storageS3AccessKeyId: string;
  storageS3Bucket: string;
  storageS3EnablePathStyle: boolean;
  storageS3Endpoint: string;
  storageS3FilePath: string;
  storageS3PreviewUrlExpireIn: number;
  storageS3PublicDomain: string;
  storageS3Region: string;
  storageS3SecretAccessKey: string;
  storageS3SecretAccessKeyConfigured: boolean;
  storageS3SetAcl: boolean;
};

export type SettingUpdate = { key: string; value: unknown };

export const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const normalizeMemoryUserMemoryTriggerMode = (
  value: unknown,
): MemoryUserMemoryTriggerMode =>
  value === 'direct' || value === 'workflow' || value === 'auto' ? value : 'auto';

export const buildModelOptions = (data?: {
  defaultModelSuggestions?: string[] | null;
  enabledNewapiModels?: EnabledNewapiModelOption[] | null;
  modelType?: string;
}): DefaultModelOption[] => {
  const seen = new Set<string>();
  const options: DefaultModelOption[] = [];

  for (const item of data?.enabledNewapiModels ?? []) {
    const model = normalizeText(item.modelId);
    if (!model) continue;

    const provider = normalizeText(item.provider) || 'newapi';
    const key = `${provider}:${model}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = normalizeText(item.displayName) || model;
    const modelType = normalizeText(item.modelType) || 'chat';
    if (data?.modelType && modelType !== data.modelType) continue;
    const instanceName = normalizeText(item.instanceName);

    options.push({
      label: `${name}（${provider} / ${modelType}${instanceName ? ` / ${instanceName}` : ''}）`,
      model,
      provider,
      value: key,
    });
  }

  for (const suggestion of data?.modelType && data.modelType !== 'chat'
    ? []
    : (data?.defaultModelSuggestions ?? [])) {
    const model = normalizeText(suggestion);
    if (!model) continue;

    const provider = 'newapi';
    const key = `${provider}:${model}`;
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({
      label: `${model}（${provider} / 建议）`,
      model,
      provider,
      value: key,
    });
  }

  return options;
};

const normalizeHelpMenuItems = (items: unknown): HelpMenuItem[] =>
  Array.isArray(items)
    ? items
        .filter((item): item is HelpMenuItem => Boolean(item) && typeof item === 'object')
        .map((item: HelpMenuItem) => ({
          label: normalizeText(item.label),
          ...(normalizeText(item.url) ? { url: normalizeText(item.url) } : {}),
        }))
        .filter((item) => item.label)
    : [];

export const buildFormValues = (data?: AdminSettingsData): AdminSettingsFormValues => ({
  brandFaviconUrl: data?.brandFaviconUrl ?? '',
  brandAuthTitle: data?.brandAuthTitle ?? DEFAULT_RUNTIME_BRAND.authTitle,
  brandCopyrightText: data?.brandCopyrightText ?? DEFAULT_RUNTIME_BRAND.copyrightText,
  brandLogoUrl: data?.brandLogoUrl ?? DEFAULT_RUNTIME_BRAND.logoUrl,
  brandLoadingText: data?.brandLoadingText ?? DEFAULT_RUNTIME_BRAND.loadingText,
  brandName: data?.brandName ?? DEFAULT_RUNTIME_BRAND.name,
  brandPrimaryColor: data?.brandPrimaryColor ?? DEFAULT_RUNTIME_BRAND.primaryColor,
  brandSlogan: data?.brandSlogan ?? DEFAULT_RUNTIME_BRAND.authTitle,
  communityForkAndChatLabel: data?.communityForkAndChatLabel ?? '',
  aboutLinks: normalizeAboutLinksConfig(data?.aboutLinks ?? DEFAULT_ABOUT_LINKS),
  cronAuditRetentionDays: data?.cronAuditRetentionDays ?? 365,
  cronPendingOrderExpiryDays: data?.cronPendingOrderExpiryDays ?? 7,
  cronSecret: '',
  defaultAgentAvatar: data?.defaultAgentAvatar ?? '/images/brand/qingyou-ai-logo.png',
  defaultAgentModel: data?.defaultAgentModel ?? '',
  defaultAgentName: data?.defaultAgentName ?? '青柚助手',
  defaultAgentProvider: data?.defaultAgentProvider ?? '',
  defaultImageModel: data?.defaultImageModel ?? '',
  defaultImageProvider: data?.defaultImageProvider ?? '',
  defaultSkillName: data?.defaultSkillName ?? data?.brandName ?? DEFAULT_RUNTIME_BRAND.name,
  defaultVideoModel: data?.defaultVideoModel ?? '',
  defaultVideoProvider: data?.defaultVideoProvider ?? '',
  desktopDownloadLabel: data?.desktopDownloadLabel ?? '',
  desktopDownloadUrl: data?.desktopDownloadUrl ?? '',
  helpMenuItems: normalizeHelpMenuItems(data?.helpMenuItems),
  homeMessengerBannerTitle: data?.homeMessengerBannerTitle ?? '',
  homeMessengerEnabled: data?.homeMessengerEnabled ?? true,
  memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
    data?.memoryUserMemoryTriggerMode,
  ),
  profileInterestAreas: normalizeConfiguredInterestAreas(data?.profileInterestAreas),
  ordersEnabled: data?.ordersManagementEnabled ?? true,
  pricingMultiplier: data?.pricingCreditMultiplier ?? 1,
  referralRewardCredits: data?.referralRewardCredits ?? 0,
  sidebarGenerationLabel: data?.sidebarGenerationLabel ?? '生成',
  sidebarMemberLabel: data?.sidebarMemberLabel ?? '会员',
  sidebarMemberUrl: data?.sidebarMemberUrl ?? '/settings/plans',
  storageS3AccessKeyId: data?.storageS3AccessKeyId ?? '',
  storageS3Bucket: data?.storageS3Bucket ?? '',
  storageS3EnablePathStyle: data?.storageS3EnablePathStyle ?? false,
  storageS3Endpoint: data?.storageS3Endpoint ?? '',
  storageS3FilePath: data?.storageS3FilePath ?? 'files',
  storageS3PreviewUrlExpireIn: data?.storageS3PreviewUrlExpireIn ?? 7200,
  storageS3PublicDomain: data?.storageS3PublicDomain ?? '',
  storageS3Region: data?.storageS3Region ?? '',
  storageS3SecretAccessKey: '',
  storageS3SecretAccessKeyConfigured: data?.storageS3SecretAccessKeyConfigured ?? false,
  storageS3SetAcl: data?.storageS3SetAcl ?? false,
});

export const normalizeFormValues = (
  values: Partial<AdminSettingsFormValues>,
): AdminSettingsFormValues => ({
  brandFaviconUrl: normalizeText(values.brandFaviconUrl),
  brandAuthTitle: normalizeText(values.brandAuthTitle),
  brandCopyrightText: normalizeText(values.brandCopyrightText),
  brandLogoUrl: normalizeText(values.brandLogoUrl),
  brandLoadingText: normalizeText(values.brandLoadingText),
  brandName: normalizeText(values.brandName),
  brandPrimaryColor: normalizeText(values.brandPrimaryColor),
  brandSlogan: normalizeText(values.brandSlogan),
  communityForkAndChatLabel: normalizeText(values.communityForkAndChatLabel),
  aboutLinks: normalizeAboutLinksConfig(values.aboutLinks),
  cronAuditRetentionDays:
    typeof values.cronAuditRetentionDays === 'number' ? values.cronAuditRetentionDays : 365,
  cronPendingOrderExpiryDays:
    typeof values.cronPendingOrderExpiryDays === 'number' ? values.cronPendingOrderExpiryDays : 7,
  cronSecret: normalizeText(values.cronSecret),
  defaultAgentAvatar: normalizeText(values.defaultAgentAvatar),
  defaultAgentModel: normalizeText(values.defaultAgentModel),
  defaultAgentName: normalizeText(values.defaultAgentName),
  defaultAgentProvider: normalizeText(values.defaultAgentProvider),
  defaultImageModel: normalizeText(values.defaultImageModel),
  defaultImageProvider: normalizeText(values.defaultImageProvider),
  defaultSkillName: normalizeText(values.defaultSkillName),
  defaultVideoModel: normalizeText(values.defaultVideoModel),
  defaultVideoProvider: normalizeText(values.defaultVideoProvider),
  desktopDownloadLabel: normalizeText(values.desktopDownloadLabel),
  desktopDownloadUrl: normalizeText(values.desktopDownloadUrl),
  helpMenuItems: normalizeHelpMenuItems(values.helpMenuItems),
  homeMessengerBannerTitle: normalizeText(values.homeMessengerBannerTitle),
  homeMessengerEnabled:
    typeof values.homeMessengerEnabled === 'boolean' ? values.homeMessengerEnabled : true,
  memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
    values.memoryUserMemoryTriggerMode,
  ),
  profileInterestAreas: normalizeConfiguredInterestAreas(values.profileInterestAreas),
  ordersEnabled: typeof values.ordersEnabled === 'boolean' ? values.ordersEnabled : true,
  pricingMultiplier: typeof values.pricingMultiplier === 'number' ? values.pricingMultiplier : 1,
  referralRewardCredits:
    typeof values.referralRewardCredits === 'number' ? values.referralRewardCredits : 0,
  sidebarGenerationLabel: normalizeText(values.sidebarGenerationLabel) || '生成',
  sidebarMemberLabel: normalizeText(values.sidebarMemberLabel) || '会员',
  sidebarMemberUrl: normalizeText(values.sidebarMemberUrl) || '/settings/plans',
  storageS3AccessKeyId: normalizeText(values.storageS3AccessKeyId),
  storageS3Bucket: normalizeText(values.storageS3Bucket),
  storageS3EnablePathStyle:
    typeof values.storageS3EnablePathStyle === 'boolean' ? values.storageS3EnablePathStyle : false,
  storageS3Endpoint: normalizeText(values.storageS3Endpoint),
  storageS3FilePath:
    normalizeText(values.storageS3FilePath)
      .replaceAll('\\', '/')
      .replaceAll(/^\/+|\/+$/g, '') || 'files',
  storageS3PreviewUrlExpireIn:
    typeof values.storageS3PreviewUrlExpireIn === 'number'
      ? values.storageS3PreviewUrlExpireIn
      : 7200,
  storageS3PublicDomain: normalizeText(values.storageS3PublicDomain),
  storageS3Region: normalizeText(values.storageS3Region),
  storageS3SecretAccessKey: normalizeText(values.storageS3SecretAccessKey),
  storageS3SecretAccessKeyConfigured:
    typeof values.storageS3SecretAccessKeyConfigured === 'boolean'
      ? values.storageS3SecretAccessKeyConfigured
      : false,
  storageS3SetAcl: typeof values.storageS3SetAcl === 'boolean' ? values.storageS3SetAcl : false,
});

export const buildSettingUpdates = (
  currentValues: Partial<AdminSettingsFormValues>,
  initialValues: AdminSettingsFormValues,
): SettingUpdate[] => {
  const current = normalizeFormValues(currentValues);
  const initial = normalizeFormValues(initialValues);
  const updates: SettingUpdate[] = [];

  if (current.cronSecret) updates.push({ key: SETTING_KEYS.cronSecret, value: current.cronSecret });
  const storageS3SecretUpdate = current.storageS3SecretAccessKey
    ? { key: SETTING_KEYS.storageS3SecretAccessKey, value: current.storageS3SecretAccessKey }
    : undefined;

  const keys: Array<keyof AdminSettingsFormValues> = [
    'defaultAgentModel',
    'defaultAgentProvider',
    'defaultAgentName',
    'defaultAgentAvatar',
    'defaultImageModel',
    'defaultImageProvider',
    'defaultVideoModel',
    'defaultVideoProvider',
    'defaultSkillName',
    'referralRewardCredits',
    'cronAuditRetentionDays',
    'cronPendingOrderExpiryDays',
    'brandName',
    'brandLoadingText',
    'brandAuthTitle',
    'brandCopyrightText',
    'brandLogoUrl',
    'brandFaviconUrl',
    'brandPrimaryColor',
    'brandSlogan',
    'homeMessengerBannerTitle',
    'homeMessengerEnabled',
    'communityForkAndChatLabel',
    'sidebarMemberLabel',
    'sidebarMemberUrl',
    'sidebarGenerationLabel',
    'desktopDownloadUrl',
    'desktopDownloadLabel',
    'memoryUserMemoryTriggerMode',
    'pricingMultiplier',
    'ordersEnabled',
    'storageS3AccessKeyId',
    'storageS3Endpoint',
    'storageS3FilePath',
    'storageS3Bucket',
    'storageS3Region',
    'storageS3PublicDomain',
    'storageS3EnablePathStyle',
    'storageS3SetAcl',
    'storageS3PreviewUrlExpireIn',
  ];

  const keyMap: Record<keyof AdminSettingsFormValues, string> = {
    brandFaviconUrl: SETTING_KEYS.brandFaviconUrl,
    aboutLinks: SETTING_KEYS.aboutLinks,
    brandAuthTitle: SETTING_KEYS.brandAuthTitle,
    brandCopyrightText: SETTING_KEYS.brandCopyrightText,
    brandLogoUrl: SETTING_KEYS.brandLogoUrl,
    brandLoadingText: SETTING_KEYS.brandLoadingText,
    brandName: SETTING_KEYS.brandName,
    brandPrimaryColor: SETTING_KEYS.brandPrimaryColor,
    brandSlogan: SETTING_KEYS.brandSlogan,
    communityForkAndChatLabel: SETTING_KEYS.communityForkAndChatLabel,
    cronAuditRetentionDays: SETTING_KEYS.cronAuditRetentionDays,
    cronPendingOrderExpiryDays: SETTING_KEYS.cronPendingOrderExpiryDays,
    cronSecret: SETTING_KEYS.cronSecret,
    defaultAgentAvatar: SETTING_KEYS.defaultAgentAvatar,
    defaultAgentModel: SETTING_KEYS.defaultAgentModel,
    defaultAgentName: SETTING_KEYS.defaultAgentName,
    defaultAgentProvider: SETTING_KEYS.defaultAgentProvider,
    defaultImageModel: SETTING_KEYS.defaultImageModel,
    defaultImageProvider: SETTING_KEYS.defaultImageProvider,
    defaultSkillName: SETTING_KEYS.defaultSkillName,
    defaultVideoModel: SETTING_KEYS.defaultVideoModel,
    defaultVideoProvider: SETTING_KEYS.defaultVideoProvider,
    desktopDownloadLabel: SETTING_KEYS.desktopDownloadLabel,
    desktopDownloadUrl: SETTING_KEYS.desktopDownloadUrl,
    helpMenuItems: SETTING_KEYS.helpMenuItems,
    homeMessengerEnabled: SETTING_KEYS.homeMessengerEnabled,
    homeMessengerBannerTitle: SETTING_KEYS.homeMessengerBannerTitle,
    memoryUserMemoryTriggerMode: SETTING_KEYS.memoryUserMemoryTriggerMode,
    profileInterestAreas: SETTING_KEYS.profileInterestAreas,
    ordersEnabled: SETTING_KEYS.ordersManagementEnabled,
    pricingMultiplier: SETTING_KEYS.pricingCreditMultiplier,
    referralRewardCredits: SETTING_KEYS.referralRewardCredits,
    sidebarGenerationLabel: SETTING_KEYS.sidebarGenerationLabel,
    sidebarMemberLabel: SETTING_KEYS.sidebarMemberLabel,
    sidebarMemberUrl: SETTING_KEYS.sidebarMemberUrl,
    storageS3AccessKeyId: SETTING_KEYS.storageS3AccessKeyId,
    storageS3Bucket: SETTING_KEYS.storageS3Bucket,
    storageS3EnablePathStyle: SETTING_KEYS.storageS3EnablePathStyle,
    storageS3Endpoint: SETTING_KEYS.storageS3Endpoint,
    storageS3FilePath: SETTING_KEYS.storageS3FilePath,
    storageS3PreviewUrlExpireIn: SETTING_KEYS.storageS3PreviewUrlExpireIn,
    storageS3PublicDomain: SETTING_KEYS.storageS3PublicDomain,
    storageS3Region: SETTING_KEYS.storageS3Region,
    storageS3SecretAccessKey: SETTING_KEYS.storageS3SecretAccessKey,
    storageS3SecretAccessKeyConfigured: SETTING_KEYS.storageS3SecretAccessKey,
    storageS3SetAcl: SETTING_KEYS.storageS3SetAcl,
  };

  for (const key of keys) {
    if (current[key] !== initial[key]) updates.push({ key: keyMap[key], value: current[key] });
    if (key === 'storageS3AccessKeyId' && storageS3SecretUpdate) {
      updates.push(storageS3SecretUpdate);
    }
  }

  if (JSON.stringify(current.helpMenuItems) !== JSON.stringify(initial.helpMenuItems)) {
    updates.push({ key: SETTING_KEYS.helpMenuItems, value: current.helpMenuItems });
  }

  if (
    JSON.stringify(current.profileInterestAreas) !== JSON.stringify(initial.profileInterestAreas)
  ) {
    updates.push({ key: SETTING_KEYS.profileInterestAreas, value: current.profileInterestAreas });
  }

  if (JSON.stringify(current.aboutLinks) !== JSON.stringify(initial.aboutLinks)) {
    updates.push({ key: SETTING_KEYS.aboutLinks, value: current.aboutLinks });
  }

  return updates;
};

export const getAdminSettingsRefreshKeys = (updates: SettingUpdate[]) => {
  const runtimeKeys = new Set([
    SETTING_KEYS.defaultAgentAvatar,
    SETTING_KEYS.defaultAgentModel,
    SETTING_KEYS.defaultAgentName,
    SETTING_KEYS.defaultAgentProvider,
    SETTING_KEYS.defaultImageModel,
    SETTING_KEYS.defaultImageProvider,
    SETTING_KEYS.defaultVideoModel,
    SETTING_KEYS.defaultVideoProvider,
  ]);
  const needsRuntimeRefresh = updates.some((update) => runtimeKeys.has(update.key as any));
  const brandKeys = new Set([
    SETTING_KEYS.brandAuthTitle,
    SETTING_KEYS.brandCopyrightText,
    SETTING_KEYS.brandFaviconUrl,
    SETTING_KEYS.brandLogoUrl,
    SETTING_KEYS.brandLoadingText,
    SETTING_KEYS.brandName,
    SETTING_KEYS.brandPrimaryColor,
    SETTING_KEYS.brandSlogan,
    SETTING_KEYS.homeMessengerBannerTitle,
    SETTING_KEYS.homeMessengerEnabled,
    SETTING_KEYS.communityForkAndChatLabel,
    SETTING_KEYS.sidebarGenerationLabel,
    SETTING_KEYS.sidebarMemberLabel,
    SETTING_KEYS.sidebarMemberUrl,
    SETTING_KEYS.defaultSkillName,
  ]);
  const needsBrandRefresh = updates.some((update) => brandKeys.has(update.key as any));
  const needsProfileInterestRefresh = updates.some(
    (update) => update.key === SETTING_KEYS.profileInterestAreas,
  );

  return [
    ...(needsRuntimeRefresh ? [RUNTIME_CONFIG_SWR_KEY, USER_STATE_SWR_KEY] : []),
    ...(needsBrandRefresh ? [BRAND_CONFIG_SWR_KEY] : []),
    ...(needsProfileInterestRefresh ? [PROFILE_INTEREST_AREAS_SWR_KEY] : []),
  ];
};
