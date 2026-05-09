type NewapiModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export type NewapiInstanceFormValues = {
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
  usageScope?: NewapiModelType[];
};

const cleanText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const buildNewapiInstancePayload = (
  values: NewapiInstanceFormValues,
  options: { isEdit?: boolean } = {},
) => {
  const apiKey = cleanText(values.apiKey);
  const groupMultiplier = Number(values.groupMultiplier);
  const payload: Record<string, unknown> = {
    baseUrl: values.baseUrl,
    description: cleanText(values.description),
    enabled: !!values.enabled,
    fetchOnClient: !!values.fetchOnClient,
    groupKey: cleanText(values.groupKey) ?? 'default',
    groupName: cleanText(values.groupName),
    name: values.name,
    priority: Number(values.priority || 0),
    usageScope: values.usageScope ?? [],
  };

  if (Number.isFinite(groupMultiplier)) {
    payload.groupMultiplier = groupMultiplier;
  }

  if (apiKey && (!options.isEdit || !apiKey.includes('****'))) {
    payload.apiKey = apiKey;
  }

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
};
