import { getAdminModelTypeLabel } from '../adminModelTypeLabels';
import type { AdminModelApiProviderType } from '../adminProviderInstanceForm';

export type ModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export const MODEL_TYPES: ModelType[] = [
  'chat',
  'image',
  'video',
  'embedding',
  'tts',
  'stt',
  'text2music',
  'realtime',
];

export interface InstanceRow {
  apiKey: string | null;
  apiKeyStatus?: 'invalid' | 'ok';
  baseUrl: string;
  description: string | null;
  enabled: boolean;
  fetchOnClient: boolean;
  groupKey: string;
  groupMultiplier: number | null;
  groupName: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  name: string;
  priority: number;
  providerType: AdminModelApiProviderType;
  usageScope: ModelType[] | null;
}

export interface ModelRow {
  displayName: string | null;
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
  modelId: string;
  modelType: ModelType;
  sortOrder: number;
}

export const INSTANCES_KEY = ['admin-provider-instances'];
export const modelsKey = (instanceId: string, modelType?: ModelType) =>
  ['admin-provider-instance-models', instanceId, modelType ?? 'all'] as const;

export const PROVIDER_TYPE_LABELS: Record<AdminModelApiProviderType, string> = {
  'aliyun': '阿里云 DashScope',
  'claude': 'Claude / Anthropic',
  'deepseek': 'DeepSeek',
  'newapi': 'AI 服务商',
  'sub2api': 'Sub2API',
  'openai': 'OpenAI',
  'openai-compatible': '兼容 OpenAI 格式',
  'opencode-go': 'OpenCode Go',
  'siliconflow': 'SiliconFlow',
};

export const splitToList = (text: string): string[] =>
  text
    .split(/[\r\n,;；，]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const modelTypeLabel = (type: ModelType, t: (k: string, d: string) => string) =>
  t(`admin.providers.modelType.${type}`, getAdminModelTypeLabel(type));
