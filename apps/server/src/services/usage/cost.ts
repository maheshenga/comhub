import { USD_TO_CNY } from '@lobechat/const';
import {
  getCachedTextInputUnitRate,
  getTextInputUnitRate,
  getTextOutputUnitRate,
  getWriteCacheInputUnitRate,
} from '@lobechat/utils';
import { LOBE_DEFAULT_MODEL_LIST, type Pricing } from 'model-bank';

import { type ModelUsage } from '@/types/message';

const PER_MILLION = 1_000_000;

const pricingByKey = new Map<string, Pricing | undefined>();

for (const model of LOBE_DEFAULT_MODEL_LIST) {
  pricingByKey.set(`${model.providerId}/${model.id}`, model.pricing);
  if (!pricingByKey.has(model.id)) pricingByKey.set(model.id, model.pricing);
}

const lookupPricing = (provider?: string | null, model?: string | null): Pricing | undefined => {
  if (!model) return undefined;
  if (provider && pricingByKey.has(`${provider}/${model}`)) {
    return pricingByKey.get(`${provider}/${model}`);
  }

  return pricingByKey.get(model);
};

const toUsdRate = (rate: number | undefined, currency?: string): number | undefined =>
  rate === undefined ? undefined : currency === 'CNY' ? rate / USD_TO_CNY : rate;

export interface MessageCostSplit {
  cacheMissTokens: number;
  cacheReadTokens: number;
  cacheSavings: number;
  cacheWriteCost: number;
  cacheWriteTokens: number;
  inputCost: number;
  inputTokens: number;
  outputCost: number;
  outputTokens: number;
  totalCost: number;
  totalTokens: number;
}

export const computeMessageCostSplit = (
  usage: ModelUsage | undefined,
  provider?: string | null,
  model?: string | null,
  storedCost = 0,
): MessageCostSplit => {
  const pricing = lookupPricing(provider, model);
  return computeMessageCostSplitWithPricing(usage, pricing, storedCost);
};

export const computeMessageCostSplitWithPricing = (
  usage: ModelUsage | undefined,
  pricing?: Pricing,
  storedCost = 0,
): MessageCostSplit => {
  const currency = pricing?.currency;

  const inputRate = toUsdRate(getTextInputUnitRate(pricing), currency);
  const cachedRate = toUsdRate(getCachedTextInputUnitRate(pricing), currency) ?? inputRate;
  const writeRate = toUsdRate(getWriteCacheInputUnitRate(pricing), currency) ?? inputRate;
  const outputRate = toUsdRate(getTextOutputUnitRate(pricing), currency);

  const cacheReadTokens = usage?.inputCachedTokens ?? 0;
  const totalInputTokens = usage?.totalInputTokens ?? 0;
  const cacheMissTokens =
    usage?.inputCacheMissTokens ?? Math.max(0, totalInputTokens - cacheReadTokens);
  const toolTokens = usage?.inputToolTokens ?? 0;
  const cacheWriteTokens = usage?.inputWriteCacheTokens ?? 0;
  const outputTokens = usage?.totalOutputTokens ?? 0;

  let freshInputCost =
    inputRate === undefined ? 0 : ((cacheMissTokens + toolTokens) * inputRate) / PER_MILLION;
  let cacheReadCost = cachedRate === undefined ? 0 : (cacheReadTokens * cachedRate) / PER_MILLION;
  let cacheWriteCost = writeRate === undefined ? 0 : (cacheWriteTokens * writeRate) / PER_MILLION;
  let outputCost = outputRate === undefined ? 0 : (outputTokens * outputRate) / PER_MILLION;
  let computedTotal = freshInputCost + cacheReadCost + cacheWriteCost + outputCost;

  if (storedCost > 0) {
    if (computedTotal > 0) {
      const scale = storedCost / computedTotal;
      freshInputCost *= scale;
      cacheReadCost *= scale;
      cacheWriteCost *= scale;
      outputCost *= scale;
    } else {
      freshInputCost = storedCost;
    }
    computedTotal = storedCost;
  }

  const cacheSavings =
    inputRate !== undefined && cachedRate !== undefined
      ? Math.max(0, (cacheReadTokens * (inputRate - cachedRate)) / PER_MILLION)
      : 0;

  return {
    cacheMissTokens,
    cacheReadTokens,
    cacheSavings,
    cacheWriteCost,
    cacheWriteTokens,
    inputCost: freshInputCost + cacheReadCost,
    inputTokens: totalInputTokens,
    outputCost,
    outputTokens,
    totalCost: computedTotal,
    totalTokens: usage?.totalTokens ?? totalInputTokens + outputTokens,
  };
};
