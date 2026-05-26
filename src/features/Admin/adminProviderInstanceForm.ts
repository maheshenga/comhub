type ProviderModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export type ProviderInstanceFormValues = {
  apiKey?: string;
  baseUrl: string;
  description?: string;
  enabled?: boolean;
  fetchOnClient?: boolean;
  groupKey?: string;
  groupMultiplier?: number;
  groupName?: string;
  name: string;
  priority?: number;
  providerType?: AdminModelApiProviderType;
  usageScope?: ProviderModelType[];
};

export type AdminModelApiProviderType =
  | 'newapi'
  | 'openai-compatible'
  | 'openai'
  | 'deepseek'
  | 'aliyun';

export const ADMIN_MODEL_API_PROVIDER_TYPES: AdminModelApiProviderType[] = [
  'newapi',
  'openai-compatible',
  'openai',
  'deepseek',
  'aliyun',
];

const DEFAULT_BASE_URL_BY_PROVIDER_TYPE: Partial<Record<AdminModelApiProviderType, string>> = {
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
};

export const getDefaultBaseUrlForAdminProviderType = (providerType?: AdminModelApiProviderType) =>
  providerType ? DEFAULT_BASE_URL_BY_PROVIDER_TYPE[providerType] : undefined;

const cleanText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const buildProviderInstancePayload = (
  values: ProviderInstanceFormValues,
  options: { isEdit?: boolean } = {},
) => {
  const apiKey = cleanText(values.apiKey);
  const groupMultiplier =
    values.groupMultiplier === null || values.groupMultiplier === undefined
      ? undefined
      : Number(values.groupMultiplier);
  const payload: Record<string, unknown> = {
    baseUrl: values.baseUrl,
    description: cleanText(values.description),
    enabled: !!values.enabled,
    fetchOnClient: !!values.fetchOnClient,
    groupKey: cleanText(values.groupKey) ?? 'default',
    groupName: cleanText(values.groupName),
    name: values.name,
    priority: Number(values.priority || 0),
    providerType: values.providerType ?? 'newapi',
    usageScope: values.usageScope ?? [],
  };

  if (Number.isFinite(groupMultiplier) && Number(groupMultiplier) > 0) {
    payload.groupMultiplier = groupMultiplier;
  }

  if (apiKey && (!options.isEdit || !apiKey.includes('****'))) {
    payload.apiKey = apiKey;
  }

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
};
