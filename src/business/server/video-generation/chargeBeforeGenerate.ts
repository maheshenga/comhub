import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import {
  estimateVideoCharge,
  resolveGenerationPricingMultiplier,
} from '@/business/server/generationBilling';
import { getServerModelPricing } from '@/business/server/serverModelPricing';
import { type AiUsageRouteMetadata, CommercialModel } from '@/database/models/commercial';
import type { NewGeneration, NewGenerationBatch } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import type { CreateVideoServicePayload } from '@/server/routers/lambda/video';

interface ChargeParams {
  db?: LobeChatDatabase;
  generationTopicId: string;
  model: string;
  params: CreateVideoServicePayload['params'];
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  userId: string;
}

interface ErrorBatch {
  data: {
    batch: NewGenerationBatch;
    generations: NewGeneration[];
  };
  success: true;
}

interface ChargeBeforeResult {
  errorBatch?: ErrorBatch;
  prechargeResult?: { costDetail?: any; estimatedCredits: number };
}

export async function chargeBeforeGenerate(params: ChargeParams): Promise<ChargeBeforeResult> {
  const { provider, userId, db, model, params: generationParams, routeMetadata } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return {};

  const pricing = await getServerModelPricing({ db, model, provider, type: 'video', userId });
  const { estimatedCredits, totalCost } = estimateVideoCharge(pricing, generationParams);
  const multiplier = await resolveGenerationPricingMultiplier({
    db,
    model,
    provider,
    routeMetadata,
  });
  const adjustedCredits = Math.ceil(estimatedCredits * multiplier);

  const commercialModel = new CommercialModel(db!, userId);
  await commercialModel.preCharge(adjustedCredits, db!);

  return {
    prechargeResult: {
      costDetail: { totalCost, totalCredits: adjustedCredits },
      estimatedCredits: adjustedCredits,
    },
  };
}
