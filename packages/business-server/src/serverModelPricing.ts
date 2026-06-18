import { getModelPricing } from '@lobechat/model-runtime';
import type { AiProviderModelListItem, Pricing } from 'model-bank';

import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { LobeChatDatabase } from '@/database/type';
import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ProviderConfig } from '@/types/user/settings';

type ServerModelType = AiProviderModelListItem['type'];

export const getServerModelCard = async ({
  db,
  model,
  provider,
  type,
  userId,
}: {
  db?: LobeChatDatabase;
  model: string;
  provider: string;
  type?: ServerModelType;
  userId?: string;
}): Promise<AiProviderModelListItem | undefined> => {
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

export const getServerModelPricing = async ({
  db,
  model,
  provider,
  type,
  userId,
}: {
  db?: LobeChatDatabase;
  model: string;
  provider: string;
  type?: ServerModelType;
  userId?: string;
}): Promise<Pricing | undefined> => {
  const modelCard = await getServerModelCard({ db, model, provider, type, userId });
  if (modelCard?.pricing) return modelCard.pricing;

  return getModelPricing(model, provider);
};
