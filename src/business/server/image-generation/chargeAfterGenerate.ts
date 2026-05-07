import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import { CommercialModel } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import { type ModelPerformance, type ModelUsage } from '@/types/index';

interface ChargeParams {
  db?: LobeChatDatabase;
  estimatedCredits?: number;
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
  const { isError, metadata, provider, userId, estimatedCredits, db } = params;

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return;

  const commercialModel = new CommercialModel(db!, userId);

  const credits = estimatedCredits ?? 1;

  if (isError) {
    await commercialModel.postCharge({
      credits,
      metadata: {
        asyncTaskId: metadata.asyncTaskId,
        batchId: metadata.generationBatchId,
        reason: 'generation_failed',
      },
      model: metadata.modelId,
      provider,
      referenceId: metadata.generationBatchId,
      referenceType: 'image_generation',
      source: 'image_refund',
      title: 'Image Generation Refund',
      userId,
    });
    return;
  }

  await commercialModel.postCharge({
    credits,
    metadata: {
      asyncTaskId: metadata.asyncTaskId,
      batchId: metadata.generationBatchId,
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
