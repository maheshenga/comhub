import { getModelPricing } from '@lobechat/model-runtime';

import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import {
  resolveGenerationPricingMultiplier,
  resolveImageChargeCredits,
} from '@/business/server/generationBilling';
import { CommercialModel } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import { type ModelPerformance, type ModelUsage } from '@/types/index';

interface ChargeParams {
  db?: LobeChatDatabase;
  isError?: boolean;
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  metrics?: ModelPerformance;
  modelUsage?: ModelUsage;
  provider: string;
  userId: string;
}

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const { isError, metadata, provider, userId, db, modelUsage, metrics } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return;

  const commercialModel = new CommercialModel(db!, userId);

  if (isError) {
    return;
  }

  const pricing = await getModelPricing(metadata.modelId, provider);
  const baseCredits = resolveImageChargeCredits({
    modelUsage,
    pricing,
  });
  const multiplier = await resolveGenerationPricingMultiplier({
    db,
    model: metadata.modelId,
    provider,
  });
  const credits = Math.ceil(baseCredits * multiplier);

  if (credits <= 0) return;

  await commercialModel.postCharge({
    credits,
    metadata: {
      asyncTaskId: metadata.asyncTaskId,
      batchId: metadata.generationBatchId,
      ...(metrics?.latency !== undefined ? { latency: metrics.latency } : {}),
      ...(modelUsage ? { modelUsage } : {}),
    },
    model: metadata.modelId,
    provider,
    referenceId: metadata.generationBatchId,
    referenceType: 'image_generation',
    source: 'image',
    title: 'Image Generation',
    userId,
  });
}
