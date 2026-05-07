import { describe, expect, it } from 'vitest';

import { buildPricingSettingUpdates,PRICING_SETTING_KEYS } from './adminPricingSettings';

describe('adminPricingSettings', () => {
  it('builds updates for global billing settings only', () => {
    expect(buildPricingSettingUpdates({ ordersEnabled: false, pricingMultiplier: 1.25 })).toEqual([
      { key: PRICING_SETTING_KEYS.pricingMultiplier, value: 1.25 },
      { key: PRICING_SETTING_KEYS.ordersEnabled, value: false },
    ]);
  });

  it('does not expose model pricing rules from the global pricing page', () => {
    expect(Object.values(PRICING_SETTING_KEYS)).not.toContain('pricing.modelRules');
  });
});
