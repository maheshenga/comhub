import { shouldChargeCommercialUsage } from '@/business/server/commercialBilling';
import {
  resolveGenerationPricingMultiplier,
  resolveVideoChargeCreditResult,
} from '@/business/server/generationBilling';
import { getServerModelPricing } from '@/business/server/serverModelPricing';
import { type AiUsageRouteMetadata, CommercialModel } from '@/database/models/commercial';
import { getServerDB } from '@/database/server';
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
    routeMetadata?: AiUsageRouteMetadata;
    topicId?: string;
  };
  model: string;
  prechargeResult?: Record<string, unknown>;
  provider: string;
  usage?: { completionTokens: number; totalTokens: number };
  userId: string;
}

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const { computePriceParams, isError, metadata, model, prechargeResult, provider, usage, userId } =
    params;

  if (!prechargeResult || Object.keys(prechargeResult).length === 0) return;

  if (isError) {
    return;
  }

  const db = params.db ?? (await getServerDB());
  const shouldCharge = await shouldChargeCommercialUsage({ db, provider, userId });
  if (!shouldCharge) return;

  const resolvedModel = model ?? metadata.modelId;
  const pricing = await getServerModelPricing({
    db,
    model: resolvedModel,
    provider,
    type: 'video',
    userId,
  });
  const chargeResult = resolveVideoChargeCreditResult({
    computePriceParams,
    prechargeResult,
    pricing,
    usage,
  });
  const multiplier = await resolveGenerationPricingMultiplier({
    db,
    model: resolvedModel,
    provider,
    routeMetadata: metadata.routeMetadata,
  });
  const effectiveCredits =
    chargeResult.source === 'precharge'
      ? chargeResult.credits
      : Math.ceil(chargeResult.credits * multiplier);

  if (effectiveCredits <= 0) return;

  const commercialModel = new CommercialModel(db, userId);

  await commercialModel.postCharge({
    credits: effectiveCredits,
    metadata: {
      asyncTaskId: metadata.asyncTaskId,
      batchId: metadata.generationBatchId,
      computePriceParams: params.computePriceParams,
      latency: params.latency,
      ...(metadata.routeMetadata ? { routeMetadata: metadata.routeMetadata } : {}),
      usage: params.usage,
    },
    model: resolvedModel,
    provider,
    referenceId: metadata.asyncTaskId,
    referenceType: 'video_generation',
    source: 'video',
    title: 'Video Generation',
    userId,
  });
}
