export type PlanPurchaseLike = {
  purchaseUrl?: string | null;
};

export const getPlanPurchaseUrl = (plan?: PlanPurchaseLike | null) => {
  const raw = typeof plan?.purchaseUrl === 'string' ? plan.purchaseUrl.trim() : '';
  if (!raw) return null;

  try {
    const url = new URL(raw);

    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
};
