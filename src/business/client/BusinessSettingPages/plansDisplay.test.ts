import { Plans } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { formatPlanCurrencyAmount, getVisiblePaidPlans } from './plansDisplay';

describe('plans display helpers', () => {
  it('hides the free plan from the public plans page', () => {
    expect(getVisiblePaidPlans([Plans.Free, Plans.Hobby, Plans.Starter, Plans.Premium])).toEqual([
      Plans.Hobby,
      Plans.Starter,
      Plans.Premium,
    ]);
  });

  it('formats prices with Chinese yuan regardless of catalog currency', () => {
    expect(formatPlanCurrencyAmount(29, 'USD')).toContain('¥');
    expect(formatPlanCurrencyAmount(29, 'USD')).toContain('29');
  });
});
