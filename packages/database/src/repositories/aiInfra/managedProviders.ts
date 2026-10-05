import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import type { AiProviderListItem, ProviderConfig } from '@lobechat/types';
import { DEFAULT_MODEL_PROVIDER_LIST } from 'model-bank/modelProviders';

import { mergeArrayById } from '@/utils/merge';

/**
 * ComHub admin-managed provider list assembly.
 *
 * Business mode is admin-managed: user toggles must not resurrect built-in
 * providers that are not enabled in backend AI service settings, and every
 * enabled `parentProviderId` config (NewAPI instances) becomes a virtual
 * builtin provider. The upstream-shaped getAiProviderList delegates the
 * merge here and keeps only ordering.
 */

export type ServerManagedProviderConfig = ProviderConfig & {
  logo?: string;
  name?: string;
  parentProviderId?: string;
};

export const isProviderEnabledByServer = (
  providerConfigs: Record<string, ServerManagedProviderConfig>,
  id: string,
) => Boolean(providerConfigs[id]?.enabled);

export const isServerManagedProvider = (
  providerConfigs: Record<string, ServerManagedProviderConfig>,
  id: string,
) => Boolean(providerConfigs[id]?.parentProviderId);

export const resolveManagedProviderList = ({
  providerConfigs,
  userProviders,
}: {
  providerConfigs: Record<string, ServerManagedProviderConfig>;
  userProviders: AiProviderListItem[];
}): AiProviderListItem[] => {
  // 1. First create a mapping based on DEFAULT_MODEL_PROVIDER_LIST id order
  const orderMap = new Map(DEFAULT_MODEL_PROVIDER_LIST.map((item, index) => [item.id, index]));

  const builtinProviders = DEFAULT_MODEL_PROVIDER_LIST.map((item) => ({
    description: item.description,
    enabled:
      isProviderEnabledByServer(providerConfigs, item.id) ||
      (!ENABLE_BUSINESS_FEATURES &&
        userProviders.some((provider) => provider.id === item.id && provider.enabled)),
    id: item.id,
    name: item.name,
    source: 'builtin',
  })) as AiProviderListItem[];

  const normalizedUserProviders = ENABLE_BUSINESS_FEATURES
    ? userProviders.map((provider) =>
        provider.source === 'builtin' ||
        orderMap.has(provider.id) ||
        isServerManagedProvider(providerConfigs, provider.id)
          ? {
              ...provider,
              enabled: isProviderEnabledByServer(providerConfigs, provider.id),
              name: providerConfigs[provider.id]?.name ?? provider.name,
            }
          : { ...provider, enabled: false },
      )
    : userProviders;

  const knownProviderIds = new Set([
    ...builtinProviders.map((provider) => provider.id),
    ...normalizedUserProviders.map((provider) => provider.id),
  ]);
  const serverManagedProviders = Object.entries(providerConfigs)
    .filter(
      ([id, config]) => config.enabled && config.parentProviderId && !knownProviderIds.has(id),
    )
    .map(([id, config]): AiProviderListItem => ({
      enabled: true,
      id,
      logo: config.logo,
      name: config.name || id,
      source: 'builtin',
    }));

  return [...mergeArrayById(builtinProviders, normalizedUserProviders), ...serverManagedProviders];
};
