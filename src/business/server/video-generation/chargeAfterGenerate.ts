import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';

import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import { CommercialModel } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';

interface ChargeParams {
  computePriceParams?: { generateAudio?: boolean; resolution?: string };
  db?: LobeChatDatabase;
  isError?: boolean;
  latency?: number;
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  model: string;
  prechargeResult?: Record<string, unknown>;
  provider: string;
  usage?: { completionTokens: number; totalTokens: number };
  userId: string;
}

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const { isError, metadata, model, prechargeResult, provider, userId, db } = params;

  if (!prechargeResult || Object.keys(prechargeResult).length === 0) return;

  const commercialModel = new CommercialModel(db!, userId);

  const estimatedCredits =
    (prechargeResult as any).estimatedCredits ??
    (prechargeResult as any).costDetail?.totalCredits ??
    CREDITS_PER_DOLLAR;

  if (isError) {
    return;
  }

  const shouldCharge = await shouldChargeCommercialUsage({ db: db!, provider, userId });
  if (!shouldCharge) return;

  const effectiveCredits = (prechargeResult as any).costDetail?.totalCredits ?? estimatedCredits;

  await commercialModel.postCharge({
    credits: effectiveCredits,
    metadata: {
      asyncTaskId: metadata.asyncTaskId,
      batchId: metadata.generationBatchId,
      computePriceParams: params.computePriceParams,
      latency: params.latency,
      usage: params.usage,
    },
    model: model ?? metadata.modelId,
    provider,
    referenceId: metadata.generationBatchId,
    referenceType: 'video_generation',
    source: 'video',
    title: 'Video Generation',
    userId,
  });
}
