import { Plans } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  OFFICIAL_PLAN_BILLING_CYCLES,
  formatPlanCurrencyAmount,
  getPrimaryPaidPlans,
  getPlanYearlyDiscountPercent,
  getVisiblePaidPlans,
  resolvePlanCyclePrice,
} from './plansDisplay';

describe('plans display helpers', () => {
  it('hides the free plan from the public plans page', () => {
    expect(getVisiblePaidPlans([Plans.Free, Plans.Hobby, Plans.Starter, Plans.Premium])).toEqual([
      Plans.Hobby,
      Plans.Starter,
      Plans.Premium,
    ]);
  });

  it('exposes the official three billing cycles on the public plans page', () => {
    expect(OFFICIAL_PLAN_BILLING_CYCLES).toEqual(['yearly', 'monthly', 'one_time']);
  });

  it('prefers the official three paid tiers when all custom tiers are configured', () => {
    expect(
      getPrimaryPaidPlans([
        Plans.Free,
        Plans.Hobby,
        Plans.Starter,
        Plans.Premium,
        Plans.Ultimate,
      ]),
    ).toEqual([Plans.Starter, Plans.Premium, Plans.Ultimate]);
  });

  it('keeps configured paid plans when fewer than three official tiers are available', () => {
    expect(getPrimaryPaidPlans([Plans.Free, Plans.Hobby, Plans.Premium])).toEqual([
      Plans.Hobby,
      Plans.Premium,
    ]);
  });

  it('formats prices with the catalog currency', () => {
    expect(formatPlanCurrencyAmount(29, 'USD')).toContain('29');
    expect(formatPlanCurrencyAmount(29, 'CNY')).toContain('¥');
  });

  it('calculates yearly discounts from monthly and yearly catalog prices', () => {
    expect(getPlanYearlyDiscountPercent(59, 590)).toBe(17);
    expect(getPlanYearlyDiscountPercent(0, 590)).toBe(0);
  });

  it('resolves yearly prices as monthly equivalents with annual secondary labels', () => {
    const price = resolvePlanCyclePrice(
      {
        currency: 'CNY',
        monthlyPrice: 59,
        yearlyPrice: 590,
      },
      'yearly',
    );

    expect(price.amount).toBe(590);
    expect(price.monthlyEquivalent).toBeCloseTo(49.17, 2);
    expect(price.label).toContain('49.17');
    expect(price.unit).toBe('每月 (按年)');
    expect(price.discountPercent).toBe(17);
    expect(price.secondaryLabel).toContain('590');
    expect(price.secondaryLabel).toContain('每年');
  });

  it('resolves one-time prices from monthly catalog prices until dedicated prices exist', () => {
    const price = resolvePlanCyclePrice(
      {
        currency: 'CNY',
        monthlyPrice: 59,
        yearlyPrice: 590,
      },
      'one_time',
    );

    expect(price.amount).toBe(708);
    expect(price.unit).toBe('一次性');
    expect(price.secondaryLabel).toContain('估算');
  });

  it('prefers configured one-time prices over fallback estimates', () => {
    const price = resolvePlanCyclePrice(
      {
        currency: 'CNY',
        monthlyPrice: 59,
        oneTimePrice: 499,
        yearlyPrice: 590,
      },
      'one_time',
    );

    expect(price.amount).toBe(499);
    expect(price.isAvailable).toBe(true);
  });

  it('prefers configured lifetime prices over fallback estimates', () => {
    const price = resolvePlanCyclePrice(
      {
        currency: 'CNY',
        lifetimePrice: 999,
        monthlyPrice: 59,
        yearlyPrice: 590,
      },
      'lifetime',
    );

    expect(price.amount).toBe(999);
    expect(price.isAvailable).toBe(true);
  });
});
