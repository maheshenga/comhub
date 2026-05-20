import { getModelPricing } from '@lobechat/model-runtime';

import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import {
  estimateImageCharge,
  resolveGenerationPricingMultiplier,
} from '@/business/server/generationBilling';
import { type AiUsageRouteMetadata, CommercialModel } from '@/database/models/commercial';
import { type NewGeneration, type NewGenerationBatch } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import { type CreateImageServicePayload } from '@/server/routers/lambda/image';

interface ChargeParams {
  clientIp?: string | null;
  configForDatabase: CreateImageServicePayload['params'];
  db?: LobeChatDatabase;
  generationParams: CreateImageServicePayload['params'];
  generationTopicId: string;
  imageNum: number;
  model: string;
  provider: string;
  routeMetadata?: AiUsageRouteMetadata;
  userId: string;
}

type ChargeResult =
  | undefined
  | {
      data: {
        batch: NewGenerationBatch;
        generations: NewGeneration[];
      };
      success: true;
    };

export async function chargeBeforeGenerate(params: ChargeParams): Promise<ChargeResult> {
  const { imageNum, provider, userId, db, model, generationParams, routeMetadata } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return undefined;

  const pricing = await getModelPricing(model, provider);
  const { estimatedCredits } = estimateImageCharge(pricing, generationParams, imageNum);
  const multiplier = await resolveGenerationPricingMultiplier({
    db,
    model,
    provider,
    routeMetadata,
  });
  const adjustedCredits = Math.ceil(estimatedCredits * multiplier);

  const commercialModel = new CommercialModel(db!, userId);
  await commercialModel.preCharge(adjustedCredits, db!);

  return undefined;
}
