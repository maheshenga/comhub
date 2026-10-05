import { type ProviderConfig } from '@lobechat/types';
import { type AiFullModelCard } from 'model-bank';
import { gptImage1Schema, seedance15ProParams } from 'model-bank/lobehub';

import { toAiModelType, type EnabledModelEntry } from '@/server/services/newapiInstance';

import { ADMIN_MANAGED_AI_PROVIDER } from './providerSpecificConfig';

export type AdminManagedServerModelCard = AiFullModelCard & {
  groupKey?: string | null;
  groupName?: string | null;
  instanceId?: string | null;
  instanceName?: string | null;
  providerId?: string | null;
  providerType?: string | null;
};

export type AdminManagedProviderConfig = ProviderConfig & {
  logo?: string;
  name?: string;
  parentProviderId?: string;
};

const getGenericNewapiParameters = (type: string) => {
  if (type === 'image') return gptImage1Schema;
  if (type === 'video') return seedance15ProParams;
  return undefined;
};

const uniqueModelIds = (models: AdminManagedServerModelCard[]) =>
  Array.from(new Set(models.map((m) => m.id)));

/**
 * ComHub business mode: backend admin provider settings are authoritative.
 * Upstream/env built-in providers may still exist in generated config, but
 * users must not see or call them unless ComHub explicitly opts them in.
 * Admin-managed instance models are injected as the newapi provider plus one
 * virtual provider per instance that registered models.
 */
export const applyAdminManagedProviders = (
  aiProvider: Record<string, AdminManagedProviderConfig>,
  instanceModels: EnabledModelEntry[],
): Record<string, AdminManagedProviderConfig> => {
  for (const [providerId, providerConfig] of Object.entries(aiProvider)) {
    if (providerId !== ADMIN_MANAGED_AI_PROVIDER) {
      aiProvider[providerId] = { ...providerConfig, enabled: false };
    }
  }

  const managedNewApiModelIds = Array.from(new Set(instanceModels.map((m) => m.id)));
  if (managedNewApiModelIds.length === 0) return aiProvider;

  const serverModelLists: AdminManagedServerModelCard[] = instanceModels.map((m) => {
    const modelType = toAiModelType(m.type);
    const parameters = getGenericNewapiParameters(modelType);

    return {
      ...(m.abilities ? { abilities: m.abilities } : {}),
      displayName: m.displayName || m.id,
      enabled: true,
      groupKey: m.groupKey,
      groupName: m.groupName,
      id: m.id,
      instanceId: m.instanceId,
      instanceName: m.instanceName,
      ...(parameters ? { parameters } : {}),
      ...(m.pricing ? { pricing: m.pricing } : {}),
      providerId: m.providerId,
      providerType: m.providerType,
      type: modelType,
    };
  });

  const groupedProviderModels = new Map<string, AdminManagedServerModelCard[]>();
  for (const model of serverModelLists) {
    const providerId = model.providerId || ADMIN_MANAGED_AI_PROVIDER;
    groupedProviderModels.set(providerId, [
      ...(groupedProviderModels.get(providerId) ?? []),
      model,
    ]);
  }
  const virtualProviderIds = Array.from(groupedProviderModels.keys()).filter(
    (providerId) => providerId !== ADMIN_MANAGED_AI_PROVIDER,
  );

  aiProvider[ADMIN_MANAGED_AI_PROVIDER] = {
    ...aiProvider[ADMIN_MANAGED_AI_PROVIDER],
    enabled: virtualProviderIds.length > 0 ? false : aiProvider[ADMIN_MANAGED_AI_PROVIDER]?.enabled,
    enabledModels: managedNewApiModelIds,
    serverModelLists,
  };

  for (const providerId of virtualProviderIds) {
    const models = groupedProviderModels.get(providerId) ?? [];
    const first = models[0];

    aiProvider[providerId] = {
      enabled: true,
      enabledModels: uniqueModelIds(models),
      name: first?.instanceName || first?.groupName || providerId,
      parentProviderId: ADMIN_MANAGED_AI_PROVIDER,
      serverModelLists: models,
    };
  }

  return aiProvider;
};
