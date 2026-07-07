import { describe, expect, it } from 'vitest';

import { calculatePlatformPluginCharge } from './billing';

describe('calculatePlatformPluginCharge', () => {
  it('applies AI cost, multipliers, fixed fee, external cost, discount, and free quota', () => {
    const result = calculatePlatformPluginCharge({
      aiActualCredits: 100,
      billing: {
        defaultMultiplier: 1.35,
        externalApiCostCredits: 5,
        failureFixedFeePolicy: 'do_not_charge',
        fixedServiceFeeCredits: 10,
      },
      discountPercent: 20,
      freeQuotaCreditsRemaining: 15,
      moduleMultiplier: 2,
      runSucceeded: true,
    });

    expect(result.rawCredits).toBe(285);
    expect(result.discountCredits).toBe(57);
    expect(result.freeQuotaCreditsApplied).toBe(15);
    expect(result.chargeCredits).toBe(213);
    expect(result.fixedServiceFeeCharged).toBe(true);
  });

  it('does not charge fixed service fee on failed runs', () => {
    const result = calculatePlatformPluginCharge({
      aiActualCredits: 100,
      billing: {
        defaultMultiplier: 1,
        externalApiCostCredits: 0,
        failureFixedFeePolicy: 'do_not_charge',
        fixedServiceFeeCredits: 10,
      },
      discountPercent: 0,
      freeQuotaCreditsRemaining: 0,
      moduleMultiplier: 1,
      runSucceeded: false,
    });

    expect(result.chargeCredits).toBe(100);
    expect(result.fixedServiceFeeCharged).toBe(false);
  });

  it('defaults missing failed-run fixed fee policy to no fixed fee charge', () => {
    const result = calculatePlatformPluginCharge({
      aiActualCredits: 25,
      billing: {
        defaultMultiplier: 1,
        externalApiCostCredits: 0,
        fixedServiceFeeCredits: 10,
      } as any,
      discountPercent: 0,
      freeQuotaCreditsRemaining: 0,
      moduleMultiplier: 1,
      runSucceeded: false,
    });

    expect(result.chargeCredits).toBe(25);
    expect(result.fixedServiceFeeCharged).toBe(false);
  });

  it('ceilings only the final charge and clamps free quota overage to zero', () => {
    const result = calculatePlatformPluginCharge({
      aiActualCredits: 1,
      billing: {
        defaultMultiplier: 1.25,
        externalApiCostCredits: 0,
        failureFixedFeePolicy: 'do_not_charge',
        fixedServiceFeeCredits: 0,
      },
      discountPercent: 10,
      freeQuotaCreditsRemaining: 10,
      moduleMultiplier: 1,
      runSucceeded: true,
    });

    expect(result.rawCredits).toBe(1.25);
    expect(result.discountCredits).toBe(0.125);
    expect(result.freeQuotaCreditsApplied).toBe(1.125);
    expect(result.chargeCredits).toBe(0);
  });
});
