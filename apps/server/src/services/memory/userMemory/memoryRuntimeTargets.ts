import type { AiProviderRuntimeState } from '@lobechat/types';
import type { LobeChatDatabase } from '@lobechat/database';
import type { ModelRuntime, ModelRuntimeHooks } from '@lobechat/model-runtime';

import { getBusinessModelRuntimeHooks } from '@/business/server/model-runtime';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { MemoryAgentConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

export type MemoryRuntimeModelType = 'chat' | 'embedding';

export interface MemoryRuntimeTargets {
  keyVaults: ProviderKeyVaultMap;
  providers: {
    embedding: string;
    gatekeeper: string;
    layerExtractor: string;
  };
}

export const ADMIN_MANAGED_AI_PROVIDER = 'newapi';

export type ProviderKeyVaultMap = Record<
  string,
  AiProviderRuntimeState['runtimeConfig'][string]['keyVaults'] | undefined
>;

interface RuntimeTargetsInput {
  agents: {
    embedding: MemoryAgentConfig;
    gatekeeper: MemoryAgentConfig;
    layerExtractor: MemoryAgentConfig;
  };
  modelConfig: {
    embeddingsModel: string;
    gateModel: string;
    layerModels: Partial<Record<string, string | undefined>>;
  };
  overrides: {
    embedding: { model: boolean; provider: boolean };
    gatekeeper: { model: boolean; provider: boolean };
    layerExtractor: { model: boolean; provider: boolean };
  };
}

interface RuntimeTargetsPreferences {
  embeddingPreferredModels?: string[];
  embeddingPreferredProviders?: string[];
  gatekeeperPreferredModels?: string[];
  gatekeeperPreferredProviders?: string[];
  layerPreferredModels?: string[];
  layerPreferredProviders?: string[];
}

export const normalizeMemoryProvider = (provider: string) => provider.toLowerCase();

export const resolveMemoryRuntimeTargets = async (
  runtimeState: AiProviderRuntimeState,
  memoryServiceConfig: RuntimeTargetsInput,
  preferences: RuntimeTargetsPreferences,
): Promise<MemoryRuntimeTargets> => {
  const normalizedRuntimeConfig = Object.fromEntries(
    Object.entries(runtimeState.runtimeConfig || {}).map(([providerId, config]) => [
      normalizeMemoryProvider(providerId),
      config,
    ]),
  );

  const keyVaults: ProviderKeyVaultMap = {};
  const appendKeyVaults = (providerId: string) => {
    const runtime = normalizedRuntimeConfig[providerId];
    if (runtime?.keyVaults) {
      keyVaults[providerId] = runtime.keyVaults;
    }
  };

  const gatekeeperProvider = await AiInfraRepos.tryMatchingProviderFrom(runtimeState, {
    fallbackProvider: memoryServiceConfig.agents.gatekeeper.provider,
    label: 'gatekeeper',
    modelId: memoryServiceConfig.modelConfig.gateModel,
    preferredModels: memoryServiceConfig.overrides.gatekeeper.model
      ? undefined
      : preferences.gatekeeperPreferredModels,
    preferredProviders: memoryServiceConfig.overrides.gatekeeper.provider
      ? undefined
      : preferences.gatekeeperPreferredProviders,
  });
  appendKeyVaults(gatekeeperProvider);

  const embeddingProvider = await AiInfraRepos.tryMatchingProviderFrom(runtimeState, {
    fallbackProvider: memoryServiceConfig.agents.embedding.provider,
    label: 'embedding',
    modelId: memoryServiceConfig.modelConfig.embeddingsModel,
    preferredModels: memoryServiceConfig.overrides.embedding.model
      ? undefined
      : preferences.embeddingPreferredModels,
    preferredProviders: memoryServiceConfig.overrides.embedding.provider
      ? undefined
      : preferences.embeddingPreferredProviders,
  });
  appendKeyVaults(embeddingProvider);

  const layerProviders: string[] = [];
  for (const model of Object.values(memoryServiceConfig.modelConfig.layerModels)) {
    if (!model) continue;
    const providerId = await AiInfraRepos.tryMatchingProviderFrom(runtimeState, {
      fallbackProvider: memoryServiceConfig.agents.layerExtractor.provider,
      label: 'layer extractor',
      modelId: model,
      preferredModels: memoryServiceConfig.overrides.layerExtractor.model
        ? undefined
        : preferences.layerPreferredModels,
      preferredProviders: memoryServiceConfig.overrides.layerExtractor.provider
        ? undefined
        : preferences.layerPreferredProviders,
    });
    layerProviders.push(providerId);
    appendKeyVaults(providerId);
  }

  const layerExtractorProvider =
    layerProviders[0] ||
    normalizeMemoryProvider(memoryServiceConfig.agents.layerExtractor.provider || 'openai');

  return {
    keyVaults,
    providers: {
      embedding: embeddingProvider,
      gatekeeper: gatekeeperProvider,
      layerExtractor: layerExtractorProvider,
    },
  };
};

export const initMemoryRuntimeFromTarget = async ({
  agent,
  dbPromise,
  keyVaults,
  model,
  modelType,
  preferredProviders,
  resolveRuntimeAgentConfig,
  targetProvider,
  userId,
}: {
  agent: MemoryAgentConfig;
  dbPromise: Promise<LobeChatDatabase>;
  keyVaults: ProviderKeyVaultMap;
  model: string;
  modelType: MemoryRuntimeModelType;
  preferredProviders?: string[];
  resolveRuntimeAgentConfig: (
    agent: MemoryAgentConfig,
    keyVaults?: ProviderKeyVaultMap,
    options?: {
      fallback?: { apiKey?: string; baseURL?: string };
      preferred?: { providerIds?: string[] };
      userId?: string;
    },
    hooks?: ModelRuntimeHooks,
  ) => Promise<ModelRuntime> | ModelRuntime;
  targetProvider: string;
  userId: string;
}) => {
  const provider = normalizeMemoryProvider(targetProvider || agent.provider || 'openai');

  if (provider === ADMIN_MANAGED_AI_PROVIDER) {
    const db = await dbPromise;

    return initModelRuntimeFromDB(db, userId, provider, { model, modelType });
  }

  const preferredProviderIds = Array.from(new Set([provider, ...(preferredProviders || [])]));
  const hooks = getBusinessModelRuntimeHooks(userId, provider);

  return resolveRuntimeAgentConfig(
    { ...agent, provider },
    keyVaults,
    {
      fallback: {
        apiKey: agent.apiKey,
        baseURL: agent.baseURL,
      },
      preferred: { providerIds: preferredProviderIds },
      userId,
    },
    hooks,
  );
};

export const getMemoryRuntimeCacheKey = (
  userId: string,
  memoryServiceConfig: RuntimeTargetsInput,
  targets: MemoryRuntimeTargets,
) =>
  [
    userId,
    targets.providers.embedding,
    targets.providers.gatekeeper,
    targets.providers.layerExtractor,
    memoryServiceConfig.modelConfig.embeddingsModel,
    memoryServiceConfig.modelConfig.gateModel,
    ...Object.values(memoryServiceConfig.modelConfig.layerModels).filter(Boolean),
  ].join(':');
