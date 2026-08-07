import { getModelPricing } from '@lobechat/model-runtime';
import type { AiProviderModelListItem, Pricing } from 'model-bank';

import type { AiUsageRouteMetadata } from '@/database/models/commercial';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { LobeChatDatabase } from '@/database/type';
import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ProviderConfig } from '@/types/user/settings';

import { getAdminNewapiModelCard } from './adminNewapiPricing';

type ServerModelType = AiProviderModelListItem['type'];

export type ServerModelPricingParams = {
  db?: LobeChatDatabase;
  model: string;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  type?: ServerModelType;
  userId?: string;
};

export type ServerModelPricingSource = 'database' | 'missing' | 'model-bank';

export interface ServerModelPricingSnapshot {
  modelCard?: AiProviderModelListItem;
  pricing?: Pricing;
  source: ServerModelPricingSource;
}

type ResolvedServerModelCard = {
  adminManaged: boolean;
  modelCard?: AiProviderModelListItem;
};

const resolveServerModelCard = async ({
  db,
  model,
  provider,
  routeMetadata,
  type,
  userId,
}: ServerModelPricingParams): Promise<ResolvedServerModelCard> => {
  const adminModelCard = await getAdminNewapiModelCard({
    db,
    model,
    provider,
    routeMetadata,
    type,
  });
  if (adminModelCard) return { adminManaged: true, modelCard: adminModelCard };

  if (!db || !userId) return { adminManaged: false };

  try {
    const { aiProvider } = await getServerGlobalConfig(db);
    const aiInfraRepos = new AiInfraRepos(db, userId, aiProvider as Record<string, ProviderConfig>);
    const models = await aiInfraRepos.getAiProviderModelList(provider, type ? { type } : undefined);

    return { adminManaged: false, modelCard: models.find((item) => item.id === model) };
  } catch {
    return { adminManaged: false };
  }
};

export const getServerModelCard = async (
  params: ServerModelPricingParams,
): Promise<AiProviderModelListItem | undefined> => (await resolveServerModelCard(params)).modelCard;

export const getServerModelPricingSnapshot = async (
  params: ServerModelPricingParams,
): Promise<ServerModelPricingSnapshot> => {
  const { adminManaged, modelCard } = await resolveServerModelCard(params);
  if (modelCard?.pricing) {
    return {
      modelCard,
      pricing: modelCard.pricing,
      source: 'database',
    };
  }

  // An enabled admin-managed row is the authoritative route-specific record.
  // Do not silently borrow model-bank pricing for the same model id: the
  // upstream gateway may use different rates, and billing must stay blocked
  // until this exact instance has a configured price.
  if (adminManaged) {
    return {
      modelCard,
      pricing: undefined,
      source: 'missing',
    };
  }

  const staticPricing = await getModelPricing(params.model, params.provider);
  if (staticPricing) {
    return {
      modelCard,
      pricing: staticPricing,
      source: 'model-bank',
    };
  }

  return {
    modelCard,
    pricing: undefined,
    source: 'missing',
  };
};

export const getServerModelPricing = async (
  params: ServerModelPricingParams,
): Promise<Pricing | undefined> => (await getServerModelPricingSnapshot(params)).pricing;
