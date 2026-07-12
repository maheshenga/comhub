import { getModelPricing } from '@lobechat/model-runtime';
import type { AiProviderModelListItem, Pricing } from 'model-bank';

import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { LobeChatDatabase } from '@/database/type';
import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ProviderConfig } from '@/types/user/settings';

type ServerModelType = AiProviderModelListItem['type'];

export type ServerModelPricingParams = {
  db?: LobeChatDatabase;
  model: string;
  provider: string;
  type?: ServerModelType;
  userId?: string;
};

export type ServerModelPricingSource = 'database' | 'missing' | 'model-bank';

export interface ServerModelPricingSnapshot {
  modelCard?: AiProviderModelListItem;
  pricing?: Pricing;
  source: ServerModelPricingSource;
}

export const getServerModelCard = async ({
  db,
  model,
  provider,
  type,
  userId,
}: ServerModelPricingParams): Promise<AiProviderModelListItem | undefined> => {
  if (!db || !userId) return undefined;

  try {
    const { aiProvider } = await getServerGlobalConfig(db);
    const aiInfraRepos = new AiInfraRepos(db, userId, aiProvider as Record<string, ProviderConfig>);
    const models = await aiInfraRepos.getAiProviderModelList(provider, type ? { type } : undefined);

    return models.find((item) => item.id === model);
  } catch {
    return undefined;
  }
};

export const getServerModelPricingSnapshot = async (
  params: ServerModelPricingParams,
): Promise<ServerModelPricingSnapshot> => {
  const modelCard = await getServerModelCard(params);
  if (modelCard?.pricing) {
    return {
      modelCard,
      pricing: modelCard.pricing,
      source: 'database',
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
