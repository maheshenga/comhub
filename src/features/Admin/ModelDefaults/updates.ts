import type { AiModelReasoningConfig } from 'model-bank/aiModel';

import { APP_SETTING_KEYS } from '@/const/appSettingsRegistry';

import { type ModelDefaultsConfig, modelDefaultsKey } from './shared';

type EntryIdentity = { modelId: string; providerId: string };

const compareIdentity = (a: EntryIdentity, b: EntryIdentity) => {
  if (a.providerId !== b.providerId) return a.providerId < b.providerId ? -1 : 1;
  if (a.modelId !== b.modelId) return a.modelId < b.modelId ? -1 : 1;

  return 0;
};

const hasReasoningValues = (config: AiModelReasoningConfig | null | undefined) =>
  Boolean(config) && Object.values(config!).some((value) => typeof value === 'string' && value);

/** Upsert or delete one model's context-window default. */
export const setContextWindowDefault = (
  config: ModelDefaultsConfig,
  identity: EntryIdentity,
  tokens: null | number,
): ModelDefaultsConfig => {
  const entries = new Map(
    config.contextWindow.map((entry) => [modelDefaultsKey(entry.providerId, entry.modelId), entry]),
  );

  const key = modelDefaultsKey(identity.providerId, identity.modelId);
  if (tokens === null) {
    entries.delete(key);
  } else {
    entries.set(key, { ...identity, tokens });
  }

  return {
    ...config,
    contextWindow: Array.from(entries.values()).sort(compareIdentity),
  };
};

/** Upsert or delete one model's reasoning defaults; empty configs are deleted. */
export const setReasoningDefaults = (
  config: ModelDefaultsConfig,
  identity: EntryIdentity,
  reasoningConfig: AiModelReasoningConfig | null,
): ModelDefaultsConfig => {
  const entries = new Map(
    config.reasoning.map((entry) => [modelDefaultsKey(entry.providerId, entry.modelId), entry]),
  );

  const key = modelDefaultsKey(identity.providerId, identity.modelId);
  if (!hasReasoningValues(reasoningConfig)) {
    entries.delete(key);
  } else {
    entries.set(key, { ...identity, config: reasoningConfig! });
  }

  return {
    ...config,
    reasoning: Array.from(entries.values()).sort(compareIdentity),
  };
};

/** Deterministic payload repair; the server normalizer is still the boundary. */
export const normalizeModelDefaultsDraft = (config: ModelDefaultsConfig): ModelDefaultsConfig => {
  const contextWindow = new Map(
    config.contextWindow.map((entry) => [modelDefaultsKey(entry.providerId, entry.modelId), entry]),
  );
  const reasoning = new Map(
    config.reasoning
      .filter((entry) => hasReasoningValues(entry.config))
      .map((entry) => [modelDefaultsKey(entry.providerId, entry.modelId), entry]),
  );

  return {
    contextWindow: Array.from(contextWindow.values()).sort(compareIdentity),
    reasoning: Array.from(reasoning.values()).sort(compareIdentity),
  };
};

export const buildModelDefaultsUpdates = (config: ModelDefaultsConfig) => ({
  updates: [
    {
      key: APP_SETTING_KEYS.modelDefaults,
      value: normalizeModelDefaultsDraft(config),
    },
  ],
});
