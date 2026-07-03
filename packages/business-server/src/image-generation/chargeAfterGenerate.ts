import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import {
  resolveGenerationPricingMultiplier,
  resolveImageChargeCredits,
} from '@/business/server/generationBilling';
import { getServerModelPricing } from '@/business/server/serverModelPricing';
import { type AiUsageRouteMetadata, CommercialModel } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import { type ModelPerformance, type ModelUsage } from '@/types/index';

interface ChargeParams {
  db?: LobeChatDatabase;
  isError?: boolean;
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    routeMetadata?: AiUsageRouteMetadata;
    topicId?: string;
  };
  metrics?: ModelPerformance;
  modelUsage?: ModelUsage;
  provider: string;
  userId: string;
  workspaceId?: string;
}

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const { isError, metadata, provider, userId, db, modelUsage, metrics } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return;

  const commercialModel = new CommercialModel(db!, userId);

  if (isError) {
    return;
  }

  const pricing = await getServerModelPricing({
    db,
    model: metadata.modelId,
    provider,
    type: 'image',
    userId,
  });
  const baseCredits = resolveImageChargeCredits({
    modelUsage,
    pricing,
  });
  const multiplier = await resolveGenerationPricingMultiplier({
    db,
    model: metadata.modelId,
    provider,
    routeMetadata: metadata.routeMetadata,
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
      ...(metadata.routeMetadata ? { routeMetadata: metadata.routeMetadata } : {}),
    },
    model: metadata.modelId,
    provider,
    referenceId: metadata.asyncTaskId,
    referenceType: 'image_generation',
    source: 'image',
    title: 'Image Generation',
    userId,
  });
}
