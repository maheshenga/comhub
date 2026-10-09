export const hasSyncedOrManualPricing = (metadata?: Record<string, unknown> | null) => {
  if (metadata?.pricingAvailable === true) return true;

  const manualPricing =
    metadata?.manualPricing && typeof metadata.manualPricing === 'object'
      ? (metadata.manualPricing as Record<string, unknown>)
      : undefined;

  return Boolean(
    manualPricing &&
      [
        manualPricing.inputCostRate,
        manualPricing.inputRate,
        manualPricing.outputCostRate,
        manualPricing.outputRate,
        manualPricing.imageRate,
        manualPricing.videoRate,
      ].some((value) => Number.isFinite(Number(value)) && Number(value) > 0),
  );
};
