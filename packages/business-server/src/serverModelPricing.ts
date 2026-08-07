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
  modelBankFallbackEnabled?: boolean;
  modelBankProvider?: string;
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
  if (adminModelCard) {
    return {
      adminManaged: true,
      modelBankFallbackEnabled: adminModelCard.modelBankFallbackEnabled,
      modelBankProvider: adminModelCard.modelBankProvider,
      modelCard: adminModelCard.modelCard,
    };
  }

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
  const { adminManaged, modelBankFallbackEnabled, modelBankProvider, modelCard } =
    await resolveServerModelCard(params);
  if (modelCard?.pricing) {
    return {
      modelCard,
      pricing: modelCard.pricing,
      source: 'database',
    };
  }

  if (adminManaged) {
    if (modelBankFallbackEnabled) {
      const staticPricing = await getModelPricing(params.model, modelBankProvider);
      if (staticPricing) {
        return {
          modelCard,
          pricing: staticPricing,
          source: 'model-bank',
        };
      }
    }

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
