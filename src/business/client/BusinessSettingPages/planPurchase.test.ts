import { describe, expect, it } from 'vitest';

import { getPlanPurchaseUrl } from './planPurchase';

describe('getPlanPurchaseUrl', () => {
  it('returns trimmed http purchase links', () => {
    expect(getPlanPurchaseUrl({ purchaseUrl: ' https://pay.example.com/plan ' })).toBe(
      'https://pay.example.com/plan',
    );
  });

  it('ignores non-http links', () => {
    expect(getPlanPurchaseUrl({ purchaseUrl: 'javascript:alert(1)' })).toBeNull();
    expect(getPlanPurchaseUrl({ purchaseUrl: '/checkout' })).toBeNull();
  });
});
