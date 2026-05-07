import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import { CommercialModel } from '@/database/models/commercial';
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
  const { imageNum, model, provider, userId, db } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return undefined;

  const estimatedCredits = imageNum * 1;

  const commercialModel = new CommercialModel(db!, userId);
  await commercialModel.preCharge(estimatedCredits, db!);

  return undefined;
}
