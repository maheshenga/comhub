import {
  type AiModelReasoningConfig,
  type AiProviderModelListItem,
  type EnabledAiModel,
  type LobeDefaultAiModelListItem,
} from 'model-bank';

export interface AIModelsState {
  aiModelLoadingIds: string[];
  aiProviderModelList: AiProviderModelListItem[];
  builtinAiModelList: LobeDefaultAiModelListItem[];
  isAiModelListInit?: boolean;
  /**
   * The user's per-model-instance reasoning defaults, keyed by
   * `${providerId}/${modelId}` (personal scope, cross-workspace).
   */
  modelReasoningConfigMap: Record<string, AiModelReasoningConfig | undefined>;
  /**
   * `${providerId}/${modelId}` keys with an in-flight reasoning-config save.
   */
  modelReasoningConfigUpdatingKeys: string[];
  /**
   * The platform (admin) reasoning defaults from the runtime-state response,
   * keyed by `${providerId}/${modelId}`. Only models with an explicit default
   * are present; a user-level saved config wins over any entry here.
   */
  modelReasoningDefaultMap: Record<string, AiModelReasoningConfig | undefined>;
  modelSearchKeyword: string;
}

export const initialAIModelState: AIModelsState = {
  aiModelLoadingIds: [],
  aiProviderModelList: [],
  builtinAiModelList: [],
  modelReasoningConfigMap: {},
  modelReasoningConfigUpdatingKeys: [],
  modelReasoningDefaultMap: {},
  modelSearchKeyword: '',
};

export const modelReasoningConfigKey = (provider: string, model: string) => `${provider}/${model}`;

/**
 * Merges a complete server snapshot of saved reasoning configs into the map.
 * Every listed model gets an entry (`undefined` = nothing saved), which turns
 * later `ensureModelReasoningConfig` calls into no-ops, so the model list does
 * not fetch one config per row. Keys with an in-flight save keep their
 * optimistic value.
 */
export const seedModelReasoningConfigMap = (
  current: AIModelsState['modelReasoningConfigMap'],
  configs: Record<string, AiModelReasoningConfig>,
  models: Pick<EnabledAiModel, 'id' | 'providerId'>[],
  updatingKeys: string[],
): AIModelsState['modelReasoningConfigMap'] => {
  const next = { ...current };
  const keys = new Set([
    ...models.map((model) => modelReasoningConfigKey(model.providerId, model.id)),
    ...Object.keys(configs),
  ]);

  for (const key of keys) {
    if (updatingKeys.includes(key)) continue;
    next[key] = configs[key];
  }

  return next;
};
