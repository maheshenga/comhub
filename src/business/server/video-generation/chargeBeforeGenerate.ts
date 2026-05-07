import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import { CommercialModel } from '@/database/models/commercial';
import type { NewGeneration, NewGenerationBatch } from '@/database/schemas';
import { type LobeChatDatabase } from '@/database/type';
import type { CreateVideoServicePayload } from '@/server/routers/lambda/video';

interface ChargeParams {
  db?: LobeChatDatabase;
  generationTopicId: string;
  model: string;
  params: CreateVideoServicePayload['params'];
  provider: string;
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
  const { model, provider, userId, db } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return {};

  const estimatedCredits = 1;

  const commercialModel = new CommercialModel(db!, userId);
  await commercialModel.preCharge(estimatedCredits, db!);

  return {
    prechargeResult: {
      costDetail: { totalCost: 0, totalCredits: estimatedCredits },
      estimatedCredits,
    },
  };
}
