import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';

export const SETTING_KEYS = {
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
  desktopDownloadLabel: 'desktop.download.label',
  desktopDownloadUrl: 'desktop.download.url',
  helpMenuItems: 'help.menu.items',
  newapiApiKey: 'newapi.apiKey',
  newapiEnabledModels: 'newapi.enabledModels',
  newapiProxyUrl: 'newapi.proxyUrl',
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
  brandLogoUrl?: string | null;
  brandName?: string | null;
  brandPrimaryColor?: string | null;
  brandSlogan?: string | null;
  cronAuditRetentionDays?: number | null;
  cronPendingOrderExpiryDays?: number | null;
  defaultAgentModel?: string | null;
  defaultAgentProvider?: string | null;
  defaultModelSuggestions?: string[] | null;
  desktopDownloadLabel?: string | null;
  desktopDownloadUrl?: string | null;
  enabledNewapiModels?: EnabledNewapiModelOption[] | null;
  helpMenuItems?: unknown;
  newapiEnabledModels?: string | null;
  newapiProxyUrl?: string | null;
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
  brandLogoUrl: string;
  brandName: string;
  brandPrimaryColor: string;
  brandSlogan: string;
  cronAuditRetentionDays: number;
  cronPendingOrderExpiryDays: number;
  cronSecret: string;
  defaultAgentModel: string;
  defaultAgentProvider: string;
  desktopDownloadLabel: string;
  desktopDownloadUrl: string;
  helpMenuItems: HelpMenuItem[];
  newapiApiKey: string;
  newapiEnabledModels: string;
  newapiProxyUrl: string;
  referralRewardCredits: number;
};

export type SettingUpdate = { key: string; value: unknown };

const LIST_SPLIT_REGEX = /[\r\n,;，；]+/;

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
      label: `${model}（${provider} / legacy）`,
      model,
      provider,
      value: key,
    });
  }

  return options;
};

const normalizeUniqueList = (value: unknown, transform?: (value: string) => string) => {
  const raw = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(LIST_SPLIT_REGEX) : []))
    : typeof value === 'string'
      ? value.split(LIST_SPLIT_REGEX)
      : [];

  return Array.from(
    new Set(raw.map((item) => (transform ? transform(item.trim()) : item.trim())).filter(Boolean)),
  );
};

export const normalizeModelIds = (value: unknown) => normalizeUniqueList(value).join('\n');

export const normalizeGatewayUrls = (value: unknown) =>
  normalizeUniqueList(value, (item) => item.replace(/\/+$/, '')).join('\n');

export const getGatewayUrlSummary = (value: unknown) => {
  const urls = normalizeGatewayUrls(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const rawCount =
    typeof value === 'string'
      ? value.split(LIST_SPLIT_REGEX).filter((item) => item.trim()).length
      : urls.length;
  const invalidUrls = urls.filter((item) => {
    try {
      const url = new URL(item);

      return url.protocol !== 'http:' && url.protocol !== 'https:';
    } catch {
      return true;
    }
  });

  return { invalidUrls, rawCount, urls };
};

export const getModelIdSummary = (value: unknown) => {
  const models = normalizeModelIds(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const rawCount =
    typeof value === 'string'
      ? value.split(LIST_SPLIT_REGEX).filter((item) => item.trim()).length
      : models.length;

  return { models, rawCount };
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
  brandLogoUrl: data?.brandLogoUrl ?? DEFAULT_RUNTIME_BRAND.logoUrl,
  brandName: data?.brandName ?? DEFAULT_RUNTIME_BRAND.name,
  brandPrimaryColor: data?.brandPrimaryColor ?? DEFAULT_RUNTIME_BRAND.primaryColor,
  brandSlogan: data?.brandSlogan ?? '',
  cronAuditRetentionDays: data?.cronAuditRetentionDays ?? 365,
  cronPendingOrderExpiryDays: data?.cronPendingOrderExpiryDays ?? 7,
  cronSecret: '',
  defaultAgentModel: data?.defaultAgentModel ?? '',
  defaultAgentProvider: data?.defaultAgentProvider ?? '',
  desktopDownloadLabel: data?.desktopDownloadLabel ?? '',
  desktopDownloadUrl: data?.desktopDownloadUrl ?? '',
  helpMenuItems: normalizeHelpMenuItems(data?.helpMenuItems),
  newapiApiKey: '',
  newapiEnabledModels: data?.newapiEnabledModels ?? '',
  newapiProxyUrl: data?.newapiProxyUrl ?? '',
  referralRewardCredits: data?.referralRewardCredits ?? 0,
});

export const normalizeFormValues = (
  values: Partial<AdminSettingsFormValues>,
): AdminSettingsFormValues => ({
  brandFaviconUrl: normalizeText(values.brandFaviconUrl),
  brandLogoUrl: normalizeText(values.brandLogoUrl),
  brandName: normalizeText(values.brandName),
  brandPrimaryColor: normalizeText(values.brandPrimaryColor),
  brandSlogan: normalizeText(values.brandSlogan),
  cronAuditRetentionDays:
    typeof values.cronAuditRetentionDays === 'number' ? values.cronAuditRetentionDays : 365,
  cronPendingOrderExpiryDays:
    typeof values.cronPendingOrderExpiryDays === 'number' ? values.cronPendingOrderExpiryDays : 7,
  cronSecret: normalizeText(values.cronSecret),
  defaultAgentModel: normalizeText(values.defaultAgentModel),
  defaultAgentProvider: normalizeText(values.defaultAgentProvider),
  desktopDownloadLabel: normalizeText(values.desktopDownloadLabel),
  desktopDownloadUrl: normalizeText(values.desktopDownloadUrl),
  helpMenuItems: normalizeHelpMenuItems(values.helpMenuItems),
  newapiApiKey: normalizeText(values.newapiApiKey),
  newapiEnabledModels: normalizeModelIds(values.newapiEnabledModels),
  newapiProxyUrl: normalizeGatewayUrls(values.newapiProxyUrl),
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

  if (current.newapiApiKey)
    updates.push({ key: SETTING_KEYS.newapiApiKey, value: current.newapiApiKey });
  if (current.cronSecret) updates.push({ key: SETTING_KEYS.cronSecret, value: current.cronSecret });

  const keys: Array<keyof AdminSettingsFormValues> = [
    'newapiProxyUrl',
    'newapiEnabledModels',
    'defaultAgentModel',
    'defaultAgentProvider',
    'referralRewardCredits',
    'cronAuditRetentionDays',
    'cronPendingOrderExpiryDays',
    'brandName',
    'brandLogoUrl',
    'brandFaviconUrl',
    'brandPrimaryColor',
    'brandSlogan',
    'desktopDownloadUrl',
    'desktopDownloadLabel',
  ];

  const keyMap: Record<string, string> = {
    brandFaviconUrl: SETTING_KEYS.brandFaviconUrl,
    brandLogoUrl: SETTING_KEYS.brandLogoUrl,
    brandName: SETTING_KEYS.brandName,
    brandPrimaryColor: SETTING_KEYS.brandPrimaryColor,
    brandSlogan: SETTING_KEYS.brandSlogan,
    cronAuditRetentionDays: SETTING_KEYS.cronAuditRetentionDays,
    cronPendingOrderExpiryDays: SETTING_KEYS.cronPendingOrderExpiryDays,
    defaultAgentModel: SETTING_KEYS.defaultAgentModel,
    defaultAgentProvider: SETTING_KEYS.defaultAgentProvider,
    desktopDownloadLabel: SETTING_KEYS.desktopDownloadLabel,
    desktopDownloadUrl: SETTING_KEYS.desktopDownloadUrl,
    newapiEnabledModels: SETTING_KEYS.newapiEnabledModels,
    newapiProxyUrl: SETTING_KEYS.newapiProxyUrl,
    referralRewardCredits: SETTING_KEYS.referralRewardCredits,
  };

  for (const key of keys) {
    if (current[key] !== initial[key]) updates.push({ key: keyMap[key], value: current[key] });
  }

  if (JSON.stringify(current.helpMenuItems) !== JSON.stringify(initial.helpMenuItems)) {
    updates.push({ key: SETTING_KEYS.helpMenuItems, value: current.helpMenuItems });
  }

  return updates;
};

export const getAdminSettingsRefreshKeys = (updates: SettingUpdate[]) => {
  const runtimeKeys = new Set([SETTING_KEYS.defaultAgentModel, SETTING_KEYS.defaultAgentProvider]);
  const needsRuntimeRefresh = updates.some((update) => runtimeKeys.has(update.key as any));

  return needsRuntimeRefresh ? [RUNTIME_CONFIG_SWR_KEY, USER_STATE_SWR_KEY] : [];
};
