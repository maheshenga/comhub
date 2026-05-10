import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import {
  computeImageCost,
  computeVideoCost,
  type ImageGenerationParams,
  resolveImageSinglePrice,
  resolveVideoSinglePrice,
  type VideoGenerationParams,
} from '@lobechat/model-runtime';
import type { ModelUsage } from '@lobechat/types';
import type { Pricing } from 'model-bank';

import { resolveAiUsagePricing } from '@/database/models/commercial';
import { type LobeChatDatabase } from '@/database/type';
import { APP_SETTING_KEYS, getAppSettingValue } from '@/server/services/appSettings';

export interface GenerationChargeEstimate {
  estimatedCredits: number;
  totalCost: number;
}

type GenerationPricingRule = {
  creditsPerDollar?: number;
  group?: string;
  instanceId?: string;
  model?: string;
  multiplier?: number;
  provider?: string;
  providerType?: string;
};

const usdToCredits = (usd: number) => {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.ceil(usd * CREDITS_PER_DOLLAR);
};

export const resolveGenerationPricingMultiplier = async ({
  db,
  model,
  provider,
}: {
  db?: LobeChatDatabase;
  model: string;
  provider: string;
}) => {
  if (!db) return 1;

  const [globalMultiplierValue, modelRulesValue] = await Promise.all([
    getAppSettingValue(APP_SETTING_KEYS.pricingCreditMultiplier, db),
    getAppSettingValue(APP_SETTING_KEYS.pricingModelRules, db),
  ]);

  const globalMultiplier = Number(globalMultiplierValue);
  const rules = Array.isArray(modelRulesValue) ? (modelRulesValue as GenerationPricingRule[]) : [];

  return (
    resolveAiUsagePricing({
      globalMultiplier:
        Number.isFinite(globalMultiplier) && globalMultiplier > 0 ? globalMultiplier : 1,
      model,
      provider,
      rules,
    }).multiplier ?? 1
  );
};

const resolveSingleImagePrice = (pricing?: Pricing) => {
  const singlePrice = resolveImageSinglePrice(pricing);
  return singlePrice.price ?? singlePrice.approximatePrice;
};

export const estimateImageCharge = (
  pricing: Pricing | undefined,
  params: ImageGenerationParams,
  imageNum: number,
): GenerationChargeEstimate => {
  const exactCost = pricing ? computeImageCost(pricing, params, imageNum) : undefined;
  if (exactCost) {
    return {
      estimatedCredits: exactCost.totalCredits,
      totalCost: exactCost.totalCost,
    };
  }

  const pricePerImage = resolveSingleImagePrice(pricing);
  if (typeof pricePerImage === 'number') {
    const totalCost = pricePerImage * imageNum;

    return {
      estimatedCredits: usdToCredits(totalCost),
      totalCost,
    };
  }

  return {
    estimatedCredits: imageNum * CREDITS_PER_DOLLAR,
    totalCost: imageNum,
  };
};

export const resolveImageChargeCredits = ({
  modelUsage,
  pricing,
}: {
  modelUsage?: ModelUsage;
  pricing?: Pricing;
}): number => {
  const usageCost = modelUsage?.cost;
  if (typeof usageCost === 'number' && Number.isFinite(usageCost)) {
    return usdToCredits(usageCost);
  }

  const pricePerImage = resolveSingleImagePrice(pricing);
  if (typeof pricePerImage === 'number') {
    return usdToCredits(pricePerImage);
  }

  return CREDITS_PER_DOLLAR;
};

export const estimateVideoCharge = (
  pricing: Pricing | undefined,
  _params: VideoGenerationParams,
): GenerationChargeEstimate => {
  const pricePerVideo = resolveVideoSinglePrice(pricing).approximatePrice;
  if (typeof pricePerVideo === 'number') {
    return {
      estimatedCredits: usdToCredits(pricePerVideo),
      totalCost: pricePerVideo,
    };
  }

  return {
    estimatedCredits: CREDITS_PER_DOLLAR,
    totalCost: 1,
  };
};

export const resolveVideoChargeCredits = ({
  computePriceParams,
  prechargeResult,
  pricing,
  usage,
}: {
  computePriceParams?: VideoGenerationParams;
  prechargeResult?: Record<string, unknown>;
  pricing?: Pricing;
  usage?: { completionTokens: number; totalTokens: number };
}): number => {
  if (pricing && usage?.completionTokens !== undefined) {
    const exactCost = computeVideoCost(pricing, usage.completionTokens, computePriceParams ?? {});
    if (exactCost) {
      return exactCost.totalCredits;
    }
  }

  const prechargeCredits = (prechargeResult as any)?.costDetail?.totalCredits;
  if (Number.isFinite(prechargeCredits)) {
    return Number(prechargeCredits);
  }

  if (Number.isFinite((prechargeResult as any)?.estimatedCredits)) {
    return Number((prechargeResult as any).estimatedCredits);
  }

  const estimated = estimateVideoCharge(pricing, computePriceParams ?? {});
  return estimated.estimatedCredits;
};
