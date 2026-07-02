export type PlanCatalogPresentation = {
  badge: string;
  comparisonNote: string;
  pptCreditCost: number;
  pptEnabled: boolean;
  pptMonthlyQuota: null | number;
  storageQuotaMb: null | number;
  vectorQuota: null | number;
  yearlyDiscountLabel: string;
};

export type TopUpPackagePromotion = {
  enabled: boolean;
  label: string;
  note: string;
  originalAmount?: number;
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeNonNegativeNumber = (value: unknown, fallback = 0) => {
  const numeric = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const normalizeNullableNonNegativeNumber = (value: unknown): null | number => {
  if (value === null || value === undefined || value === '') return null;

  const numeric = normalizeNonNegativeNumber(value, Number.NaN);

  return Number.isFinite(numeric) ? numeric : null;
};

export const normalizePlanCatalogPresentation = (metadata: unknown): PlanCatalogPresentation => {
  const source = normalizeObject(metadata);

  return {
    badge: normalizeText(source.badge),
    comparisonNote: normalizeText(source.comparisonNote),
    pptCreditCost: normalizeNonNegativeNumber(source.pptCreditCost),
    pptEnabled: source.pptEnabled === true,
    pptMonthlyQuota: normalizeNullableNonNegativeNumber(source.pptMonthlyQuota),
    storageQuotaMb: normalizeNullableNonNegativeNumber(source.storageQuotaMb),
    vectorQuota: normalizeNullableNonNegativeNumber(source.vectorQuota),
    yearlyDiscountLabel: normalizeText(source.yearlyDiscountLabel),
  };
};

export const normalizeTopUpPackagePromotion = (metadata: unknown): TopUpPackagePromotion => {
  const source = normalizeObject(metadata);
  const originalAmount = normalizeNullableNonNegativeNumber(source.originalAmount);

  return {
    enabled: source.promotionEnabled === true,
    label: normalizeText(source.promotionLabel),
    note: normalizeText(source.promotionNote),
    ...(typeof originalAmount === 'number' ? { originalAmount } : {}),
  };
};

export const serializeTopUpPackagePromotion = (promotion: TopUpPackagePromotion) => ({
  originalAmount: promotion.originalAmount,
  promotionEnabled: promotion.enabled,
  promotionLabel: promotion.label,
  promotionNote: promotion.note,
});
