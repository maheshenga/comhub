import {
  type AboutLinksConfig,
  DEFAULT_ABOUT_LINKS,
  normalizeAboutLinksConfig,
} from '@/const/aboutLinks';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';

export const SETTING_KEYS = {
  aboutLinks: 'about.links',
  brandFaviconUrl: 'brand.faviconUrl',
  brandAuthTitle: 'brand.authTitle',
  brandCopyrightText: 'brand.copyrightText',
  brandLogoUrl: 'brand.logoUrl',
  brandName: 'brand.name',
  brandPrimaryColor: 'brand.primaryColor',
  brandSlogan: 'brand.slogan',
  cronAuditRetentionDays: 'cron.auditRetentionDays',
  cronPendingOrderExpiryDays: 'cron.pendingOrderExpiryDays',
  cronSecret: 'cron.secret',
  defaultAgentAvatar: 'defaultAgent.avatar',
  defaultAgentModel: 'defaultAgent.model',
  defaultAgentName: 'defaultAgent.name',
  defaultAgentProvider: 'defaultAgent.provider',
  desktopDownloadLabel: 'desktop.download.label',
  desktopDownloadUrl: 'desktop.download.url',
  helpMenuItems: 'help.menu.items',
  pricingModelRules: 'pricing.modelRules',
  referralRewardCredits: 'referral.rewardCredits',
} as const;

export const ADMIN_SETTINGS_SWR_KEY = ['admin-settings'];
export const RUNTIME_CONFIG_SWR_KEY = 'FETCH_SERVER_CONFIG';
export const USER_STATE_SWR_KEY = 'initUserState';

export type HelpMenuItem = { label: string; url?: string };

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
  brandName?: string | null;
  brandPrimaryColor?: string | null;
  brandSlogan?: string | null;
  aboutLinks?: unknown;
  cronAuditRetentionDays?: number | null;
  cronPendingOrderExpiryDays?: number | null;
  defaultAgentAvatar?: string | null;
  defaultAgentModel?: string | null;
  defaultAgentName?: string | null;
  defaultAgentProvider?: string | null;
  defaultModelSuggestions?: string[] | null;
  desktopDownloadLabel?: string | null;
  desktopDownloadUrl?: string | null;
  enabledNewapiModels?: EnabledNewapiModelOption[] | null;
  helpMenuItems?: unknown;
  paymentGatewayStatus?: {
    configured: boolean;
    message: string;
    provider?: string | null;
  } | null;
  pricingModelRules?: unknown[] | null;
  referralRewardCredits?: number | null;
};

export type AdminSettingsFormValues = {
  brandFaviconUrl: string;
  brandAuthTitle: string;
  brandCopyrightText: string;
  brandLogoUrl: string;
  brandName: string;
  brandPrimaryColor: string;
  brandSlogan: string;
  aboutLinks: AboutLinksConfig;
  cronAuditRetentionDays: number;
  cronPendingOrderExpiryDays: number;
  cronSecret: string;
  defaultAgentAvatar: string;
  defaultAgentModel: string;
  defaultAgentName: string;
  defaultAgentProvider: string;
  desktopDownloadLabel: string;
  desktopDownloadUrl: string;
  helpMenuItems: HelpMenuItem[];
  referralRewardCredits: number;
};

export type SettingUpdate = { key: string; value: unknown };

export const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const buildModelOptions = (data?: {
  defaultModelSuggestions?: string[] | null;
  enabledNewapiModels?: EnabledNewapiModelOption[] | null;
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
    const instanceName = normalizeText(item.instanceName);

    options.push({
      label: `${name}（${provider} / ${modelType}${instanceName ? ` / ${instanceName}` : ''}）`,
      model,
      provider,
      value: key,
    });
  }

  for (const suggestion of data?.defaultModelSuggestions ?? []) {
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
  brandName: data?.brandName ?? DEFAULT_RUNTIME_BRAND.name,
  brandPrimaryColor: data?.brandPrimaryColor ?? DEFAULT_RUNTIME_BRAND.primaryColor,
  brandSlogan: data?.brandSlogan ?? '',
  aboutLinks: normalizeAboutLinksConfig(data?.aboutLinks ?? DEFAULT_ABOUT_LINKS),
  cronAuditRetentionDays: data?.cronAuditRetentionDays ?? 365,
  cronPendingOrderExpiryDays: data?.cronPendingOrderExpiryDays ?? 7,
  cronSecret: '',
  defaultAgentAvatar: data?.defaultAgentAvatar ?? '/images/brand/qingyou-ai-logo.png',
  defaultAgentModel: data?.defaultAgentModel ?? '',
  defaultAgentName: data?.defaultAgentName ?? '青柚助手',
  defaultAgentProvider: data?.defaultAgentProvider ?? '',
  desktopDownloadLabel: data?.desktopDownloadLabel ?? '',
  desktopDownloadUrl: data?.desktopDownloadUrl ?? '',
  helpMenuItems: normalizeHelpMenuItems(data?.helpMenuItems),
  referralRewardCredits: data?.referralRewardCredits ?? 0,
});

export const normalizeFormValues = (
  values: Partial<AdminSettingsFormValues>,
): AdminSettingsFormValues => ({
  brandFaviconUrl: normalizeText(values.brandFaviconUrl),
  brandAuthTitle: normalizeText(values.brandAuthTitle),
  brandCopyrightText: normalizeText(values.brandCopyrightText),
  brandLogoUrl: normalizeText(values.brandLogoUrl),
  brandName: normalizeText(values.brandName),
  brandPrimaryColor: normalizeText(values.brandPrimaryColor),
  brandSlogan: normalizeText(values.brandSlogan),
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
  desktopDownloadLabel: normalizeText(values.desktopDownloadLabel),
  desktopDownloadUrl: normalizeText(values.desktopDownloadUrl),
  helpMenuItems: normalizeHelpMenuItems(values.helpMenuItems),
  referralRewardCredits:
    typeof values.referralRewardCredits === 'number' ? values.referralRewardCredits : 0,
});

export const buildSettingUpdates = (
  currentValues: Partial<AdminSettingsFormValues>,
  initialValues: AdminSettingsFormValues,
): SettingUpdate[] => {
  const current = normalizeFormValues(currentValues);
  const initial = normalizeFormValues(initialValues);
  const updates: SettingUpdate[] = [];

  if (current.cronSecret) updates.push({ key: SETTING_KEYS.cronSecret, value: current.cronSecret });

  const keys: Array<keyof AdminSettingsFormValues> = [
    'defaultAgentModel',
    'defaultAgentProvider',
    'defaultAgentName',
    'defaultAgentAvatar',
    'referralRewardCredits',
    'cronAuditRetentionDays',
    'cronPendingOrderExpiryDays',
    'brandName',
    'brandAuthTitle',
    'brandCopyrightText',
    'brandLogoUrl',
    'brandFaviconUrl',
    'brandPrimaryColor',
    'brandSlogan',
    'desktopDownloadUrl',
    'desktopDownloadLabel',
  ];

  const keyMap: Record<keyof AdminSettingsFormValues, string> = {
    brandFaviconUrl: SETTING_KEYS.brandFaviconUrl,
    aboutLinks: SETTING_KEYS.aboutLinks,
    brandAuthTitle: SETTING_KEYS.brandAuthTitle,
    brandCopyrightText: SETTING_KEYS.brandCopyrightText,
    brandLogoUrl: SETTING_KEYS.brandLogoUrl,
    brandName: SETTING_KEYS.brandName,
    brandPrimaryColor: SETTING_KEYS.brandPrimaryColor,
    brandSlogan: SETTING_KEYS.brandSlogan,
    cronAuditRetentionDays: SETTING_KEYS.cronAuditRetentionDays,
    cronPendingOrderExpiryDays: SETTING_KEYS.cronPendingOrderExpiryDays,
    cronSecret: SETTING_KEYS.cronSecret,
    defaultAgentAvatar: SETTING_KEYS.defaultAgentAvatar,
    defaultAgentModel: SETTING_KEYS.defaultAgentModel,
    defaultAgentName: SETTING_KEYS.defaultAgentName,
    defaultAgentProvider: SETTING_KEYS.defaultAgentProvider,
    desktopDownloadLabel: SETTING_KEYS.desktopDownloadLabel,
    desktopDownloadUrl: SETTING_KEYS.desktopDownloadUrl,
    helpMenuItems: SETTING_KEYS.helpMenuItems,
    referralRewardCredits: SETTING_KEYS.referralRewardCredits,
  };

  for (const key of keys) {
    if (current[key] !== initial[key]) updates.push({ key: keyMap[key], value: current[key] });
  }

  if (JSON.stringify(current.helpMenuItems) !== JSON.stringify(initial.helpMenuItems)) {
    updates.push({ key: SETTING_KEYS.helpMenuItems, value: current.helpMenuItems });
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
  ]);
  const needsRuntimeRefresh = updates.some((update) => runtimeKeys.has(update.key as any));

  return needsRuntimeRefresh ? [RUNTIME_CONFIG_SWR_KEY, USER_STATE_SWR_KEY] : [];
};
