import type { AiModelReasoningConfig } from 'model-bank/aiModel';

import type { ModelDefaultsConfig } from '@/business/server/modelDefaults/normalize';

export type { ModelDefaultsConfig };

export const EMPTY_MODEL_DEFAULTS_CONFIG: ModelDefaultsConfig = {
  contextWindow: [],
  reasoning: [],
};

/** Model list item exposed by the admin read model's sharedHealth. */
export type ModelDefaultsEnabledModel = {
  displayName?: null | string;
  extendParams?: string[];
  instanceName?: null | string;
  modelId: string;
  modelType: string;
  provider: string;
  providerType?: null | string;
};

export type ModelDefaultsRow = {
  contextTokens?: number;
  displayName: string;
  extendParams?: string[];
  instanceLabel: string;
  key: string;
  modelId: string;
  modelType: string;
  providerId: string;
  providerType?: null | string;
  reasoningConfig?: AiModelReasoningConfig;
};

export const modelDefaultsKey = (providerId: string, modelId: string) => `${providerId}/${modelId}`;

/** Only catalog models with an editable reasoning/context surface are listed. */
const EDITABLE_MODEL_TYPES = new Set(['chat', 'embedding']);

export const buildModelDefaultsRows = (
  models: readonly ModelDefaultsEnabledModel[],
  config: ModelDefaultsConfig,
): ModelDefaultsRow[] => {
  const contextByKey = new Map(
    config.contextWindow.map((entry) => [
      modelDefaultsKey(entry.providerId, entry.modelId),
      entry.tokens,
    ]),
  );
  const reasoningByKey = new Map(
    config.reasoning.map((entry) => [
      modelDefaultsKey(entry.providerId, entry.modelId),
      entry.config,
    ]),
  );

  const seen = new Set<string>();
  const rows: ModelDefaultsRow[] = [];

  for (const model of models) {
    if (!EDITABLE_MODEL_TYPES.has(model.modelType)) continue;
    if (!model.provider || !model.modelId) continue;

    const key = modelDefaultsKey(model.provider, model.modelId);
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      contextTokens: contextByKey.get(key),
      displayName: model.displayName || model.modelId,
      ...(model.extendParams ? { extendParams: model.extendParams } : {}),
      instanceLabel: model.instanceName || model.provider,
      key,
      modelId: model.modelId,
      modelType: model.modelType,
      providerId: model.provider,
      providerType: model.providerType ?? null,
      reasoningConfig: reasoningByKey.get(key),
    });
  }

  return rows;
};

/** 0 is the slider's ∞ position, matching the persisted contract. */
export const formatContextTokens = (tokens?: number) => {
  if (tokens === undefined) return '未设置';
  if (tokens === 0) return '不限制';

  if (tokens >= 1024 * 1024 && tokens % (1024 * 1024) === 0) {
    return `${tokens / (1024 * 1024)}M`;
  }
  if (tokens % 1024 === 0) return `${tokens / 1024}K`;

  return String(tokens);
};

export const formatReasoningSummary = (
  config: AiModelReasoningConfig | undefined,
  paramKeys: readonly string[],
) => {
  if (paramKeys.length === 0) return '不适用';

  const entries = paramKeys.flatMap((key) => {
    const value = config?.[key as keyof AiModelReasoningConfig];
    return value ? [`${key}: ${value}`] : [];
  });

  return entries.length > 0 ? entries.join('、') : '未设置';
};
