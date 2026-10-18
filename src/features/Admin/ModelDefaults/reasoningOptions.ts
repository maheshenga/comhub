import type { AiModelReasoningConfig } from 'model-bank/aiModel';
import { MODEL_REASONING_EXTEND_PARAMS, MODEL_REASONING_PARAM_LEVELS } from 'model-bank/aiModel';

export type ReasoningParamKey = keyof AiModelReasoningConfig;

/** Sentinel value for the leading "未设置" option; never persisted. */
export const UNSET_REASONING_LEVEL = '__unset__';

/**
 * A model only exposes the reasoning params its model card declares. Models
 * without card extendParams (e.g. embedding models) get no reasoning fields.
 */
export const getModelReasoningParams = (extendParams?: readonly string[]): ReasoningParamKey[] => {
  if (!extendParams || extendParams.length === 0) return [];

  const declared = new Set(extendParams);
  return MODEL_REASONING_EXTEND_PARAMS.filter((key) => declared.has(key));
};

export const getReasoningLevelOptions = (key: ReasoningParamKey) => [
  { label: '未设置', value: UNSET_REASONING_LEVEL },
  ...MODEL_REASONING_PARAM_LEVELS[key].map((level) => ({ label: level, value: level })),
];

export const toReasoningDraft = (
  config: AiModelReasoningConfig | undefined,
  keys: readonly ReasoningParamKey[],
) => {
  const draft: Record<string, string> = {};

  for (const key of keys) {
    const value = config?.[key];
    if (value) draft[key] = value;
  }

  return draft;
};

export const fromReasoningDraft = (
  draft: Record<string, string>,
  keys: readonly ReasoningParamKey[],
): AiModelReasoningConfig => {
  const config: Record<string, string> = {};

  for (const key of keys) {
    const value = draft[key];
    if (value && value !== UNSET_REASONING_LEVEL) config[key] = value;
  }

  return config as AiModelReasoningConfig;
};
