import { type AvatarPreset, DEFAULT_AVATAR_PRESETS } from '@/const/avatarPresets';
import { type ConfiguredInterestArea } from '@/features/ProfileInterests/interestAreas';

export type AdminDefaultSettingsScope = 'ai-runtime-defaults' | 'integrations' | 'user-defaults';

export type FormValues = {
  avatarPresets: AvatarPreset[];
  composioApiKey?: string;
  composioAuthConfigIds?: string;
  composioClearApiKey?: boolean;
  composioEnabled?: boolean;
  disabledBuiltinToolsText: string;
  languageModelDefaultsJson: string;
  memoryEmbeddingModel: string;
  memoryEmbeddingProvider: string;
  memoryGatekeeperModel: string;
  memoryGatekeeperProvider: string;
  memoryLayerExtractorModel: string;
  memoryLayerExtractorProvider: string;
  memoryPersonaWriterModel: string;
  memoryPersonaWriterProvider: string;
  profileInterestAreas: ConfiguredInterestArea[];
  serviceModelAgentMeta: string;
  serviceModelDefaultAgent: string;
  serviceModelFollowUpAction: string;
  serviceModelFollowUpActionEnabled: boolean;
  serviceModelGenerationTopic: string;
  serviceModelHistoryCompress: string;
  serviceModelInputCompletion: string;
  serviceModelInputCompletionEnabled: boolean;
  serviceModelPromptRewrite: string;
  serviceModelPromptRewriteEnabled: boolean;
  serviceModelThread: string;
  serviceModelTopic: string;
  serviceModelTranslation: string;
  userGlobalSettingsJson: string;
  vectorEmbeddingModel: string;
  vectorEmbeddingProvider: string;
  vectorQueryMode: string;
  vectorRerankerModel: string;
  vectorRerankerProvider: string;
};

export type DefaultSettingsData = {
  avatarPresets?: AvatarPreset[];
  composioConfig?: {
    apiKeyConfigured?: boolean;
    apiKeyMasked?: string;
    authConfigIds?: string;
    enabled?: boolean;
  };
  memoryExtractionConfig?: Record<string, string | undefined>;
  profileInterestAreas?: unknown;
  sharedHealth?: { enabledNewapiModels?: unknown[] };
  userGlobalSettingsDefaults?: Record<string, any>;
  vectorConfig?: Record<string, string | undefined>;
};

export type SettingUpdate = { key: string; value: unknown };

export const jsonStringify = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export const RUNTIME_SAVE_ERROR_MESSAGES: Record<string, string> = {
  DEFAULT_MODEL_DENIED_BY_FREE_PLAN: '该模型不在免费套餐允许范围内，请更换模型。',
  DEFAULT_MODEL_NOT_ENABLED: '该模型当前未启用，请先在模型目录中启用。',
  DEFAULT_MODEL_TYPE_MISMATCH: '所选模型类型与此运行时用途不匹配。',
};

export const splitTextList = (value?: string) =>
  Array.from(
    new Set(
      (value ?? '')
        .split(/[\r\n,;，；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export const parseJsonObject = (value: string) => {
  const parsed = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('USER_GLOBAL_SETTINGS_MUST_BE_OBJECT');
  }

  return parsed as Record<string, any>;
};

export const parseModelValue = (value?: string) => {
  if (!value) return null;
  const [provider, ...modelParts] = value.split(':');
  const model = modelParts.join(':');

  return provider && model ? { model, provider } : null;
};

export const applyModelValue = (target: Record<string, any>, key: string, value?: string) => {
  const current =
    target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
      ? { ...target[key] }
      : {};
  delete current.model;
  delete current.provider;

  const modelConfig = parseModelValue(value);
  if (!modelConfig) {
    if (Object.keys(current).length > 0) target[key] = current;
    else delete target[key];
    return;
  }

  target[key] = { ...current, ...modelConfig };
};

export const userModelFields: { extra: string; field: keyof FormValues; label: string }[] = [
  {
    extra: '用户打开“服务模型”页时会先看到此默认值，之后仍可保存自己的选择。',
    field: 'serviceModelDefaultAgent',
    label: '默认助手模型',
  },
  { extra: '用于自动生成会话标题。', field: 'serviceModelTopic', label: '话题命名模型' },
  {
    extra: '用于图像、视频和 PPT 等生成主题的自动命名。',
    field: 'serviceModelGenerationTopic',
    label: '生成主题命名模型',
  },
  { extra: '用于消息翻译。', field: 'serviceModelTranslation', label: '消息翻译模型' },
  { extra: '用于压缩长对话历史。', field: 'serviceModelHistoryCompress', label: '历史压缩模型' },
  {
    extra: '用于生成助手资料、描述和元信息。',
    field: 'serviceModelAgentMeta',
    label: '助手资料生成模型',
  },
  { extra: '用于子话题命名。', field: 'serviceModelThread', label: '子话题命名模型' },
];

export const DEFAULTS_INITIAL_VALUES = {
  avatarPresets: DEFAULT_AVATAR_PRESETS,
  disabledBuiltinToolsText: '',
  languageModelDefaultsJson: '{}',
  profileInterestAreas: [],
  serviceModelFollowUpActionEnabled: false,
  serviceModelInputCompletionEnabled: false,
  serviceModelPromptRewriteEnabled: true,
  userGlobalSettingsJson: '{}',
};

export const scopeCopy: Record<
  AdminDefaultSettingsScope,
  { description: string; descriptionKey: string; title: string; titleKey: string }
> = {
  'ai-runtime-defaults': {
    description:
      '配置向量检索和记忆抽取的运行时模型。可单独保存，或将可映射的记忆模型同步到所有用户设置。',
    descriptionKey: 'admin.defaultSettings.aiRuntime.description',
    title: 'AI 运行时默认值',
    titleKey: 'admin.defaultSettings.aiRuntime.title',
  },
  'integrations': {
    description: '配置可选的 Composio 工具集成。保存不会修改 AI 运行时或用户默认设置。',
    descriptionKey: 'admin.defaultSettings.integrations.description',
    title: '外部集成',
    titleKey: 'admin.defaultSettings.integrations.title',
  },
  'user-defaults': {
    description: '配置新用户继承的模型、工具、头像和兴趣领域默认值。',
    descriptionKey: 'admin.defaultSettings.userDefaults.description',
    title: '用户默认值',
    titleKey: 'admin.defaultSettings.userDefaults.title',
  },
};
