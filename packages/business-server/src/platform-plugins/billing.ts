import type { PlatformPluginBillingConfig } from '@lobechat/types';

export type PlatformPluginChargeSnapshot = {
  aiActualCredits: number;
  chargeCredits: number;
  discountCredits: number;
  externalApiCostCredits: number;
  fixedServiceFeeCharged: boolean;
  fixedServiceFeeCredits: number;
  freeQuotaCreditsApplied: number;
  moduleMultiplier: number;
  pluginMultiplier: number;
  rawCredits: number;
};

export interface CalculatePlatformPluginChargeInput {
  aiActualCredits: number;
  billing: PlatformPluginBillingConfig;
  discountPercent: number;
  freeQuotaCreditsRemaining: number;
  moduleMultiplier: number;
  runSucceeded: boolean;
}

const nonNegativeFinite = (value: number | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

  return Math.max(0, value);
};

const clampPercent = (value: number) => Math.min(100, nonNegativeFinite(value, 0));

export const calculatePlatformPluginCharge = ({
  aiActualCredits,
  billing,
  discountPercent,
  freeQuotaCreditsRemaining,
  moduleMultiplier,
  runSucceeded,
}: CalculatePlatformPluginChargeInput): PlatformPluginChargeSnapshot => {
  const normalizedAiActualCredits = nonNegativeFinite(aiActualCredits, 0);
  const pluginMultiplier = nonNegativeFinite(billing.defaultMultiplier, 1);
  const normalizedModuleMultiplier = nonNegativeFinite(moduleMultiplier, 1);
  const externalApiCostCredits = nonNegativeFinite(billing.externalApiCostCredits, 0);
  const fixedServiceFeeCredits = nonNegativeFinite(billing.fixedServiceFeeCredits, 0);
  const failureFixedFeePolicy = billing.failureFixedFeePolicy ?? 'do_not_charge';
  const fixedServiceFeeCharged = runSucceeded || failureFixedFeePolicy !== 'do_not_charge';
  const fixedServiceFee = fixedServiceFeeCharged ? fixedServiceFeeCredits : 0;

  const meteredAiCredits =
    normalizedAiActualCredits * pluginMultiplier * normalizedModuleMultiplier;
  const rawCredits = meteredAiCredits + fixedServiceFee + externalApiCostCredits;
  const discountCredits = rawCredits * (clampPercent(discountPercent) / 100);
  const discountedCredits = Math.max(0, rawCredits - discountCredits);
  const freeQuotaCreditsApplied = Math.min(
    discountedCredits,
    nonNegativeFinite(freeQuotaCreditsRemaining, 0),
  );
  const chargeCredits = Math.ceil(Math.max(0, discountedCredits - freeQuotaCreditsApplied));

  return {
    aiActualCredits: normalizedAiActualCredits,
    chargeCredits,
    discountCredits,
    externalApiCostCredits,
    fixedServiceFeeCharged,
    fixedServiceFeeCredits,
    freeQuotaCreditsApplied,
    moduleMultiplier: normalizedModuleMultiplier,
    pluginMultiplier,
    rawCredits,
  };
};
