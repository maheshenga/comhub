import { Plans } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  formatPlanCurrencyAmount,
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

  it('formats prices with the catalog currency', () => {
    expect(formatPlanCurrencyAmount(29, 'USD')).toContain('29');
    expect(formatPlanCurrencyAmount(29, 'CNY')).toContain('¥');
  });

  it('calculates yearly discounts from monthly and yearly catalog prices', () => {
    expect(getPlanYearlyDiscountPercent(59, 590)).toBe(17);
    expect(getPlanYearlyDiscountPercent(0, 590)).toBe(0);
  });

  it('resolves yearly prices as cycle totals with monthly equivalents', () => {
    const price = resolvePlanCyclePrice(
      {
        currency: 'CNY',
        monthlyPrice: 59,
        yearlyPrice: 590,
      },
      'yearly',
    );

    expect(price.amount).toBe(590);
    expect(price.unit).toBe('年');
    expect(price.discountPercent).toBe(17);
    expect(price.secondaryLabel).toContain('按年支付');
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
