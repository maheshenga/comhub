import { describe, expect, it } from 'vitest';

import {
  normalizePlanCatalogPresentation,
  normalizeTopUpPackagePromotion,
} from './billingPresentation';

describe('billingPresentation', () => {
  it('normalizes plan catalog metadata for user-facing pricing displays', () => {
    expect(
      normalizePlanCatalogPresentation({
        badge: ' Popular ',
        comparisonNote: ' Includes priority access ',
        pptCreditCost: 15,
        pptEnabled: true,
        pptMonthlyQuota: 20,
        storageQuotaMb: 1024,
        vectorQuota: 5000,
        yearlyDiscountLabel: ' Save 20% ',
      }),
    ).toEqual({
      badge: 'Popular',
      comparisonNote: 'Includes priority access',
      pptCreditCost: 15,
      pptEnabled: true,
      pptMonthlyQuota: 20,
      storageQuotaMb: 1024,
      vectorQuota: 5000,
      yearlyDiscountLabel: 'Save 20%',
    });
  });

  it('keeps nullable quotas and rejects invalid numeric plan metadata', () => {
    expect(
      normalizePlanCatalogPresentation({
        pptCreditCost: -1,
        pptMonthlyQuota: '',
        storageQuotaMb: null,
        vectorQuota: 'bad',
      }),
    ).toEqual({
      badge: '',
      comparisonNote: '',
      pptCreditCost: 0,
      pptEnabled: false,
      pptMonthlyQuota: null,
      storageQuotaMb: null,
      vectorQuota: null,
      yearlyDiscountLabel: '',
    });
  });

  it('normalizes top-up promotion metadata', () => {
    expect(
      normalizeTopUpPackagePromotion({
        originalAmount: 30,
        promotionEnabled: true,
        promotionLabel: ' Limited offer ',
        promotionNote: ' Valid for 6 months ',
      }),
    ).toEqual({
      enabled: true,
      label: 'Limited offer',
      note: 'Valid for 6 months',
      originalAmount: 30,
    });
  });
});
