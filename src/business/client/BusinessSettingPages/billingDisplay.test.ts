import { describe, expect, it } from 'vitest';

import { buildBillingHistoryItems } from './billingDisplay';

describe('billingDisplay', () => {
  it('merges subscription changes and top-up orders into a newest-first billing history', () => {
    const items = buildBillingHistoryItems({
      subscriptionChanges: [
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          cycle: 'monthly',
          fromPlan: 'free',
          id: 'sub-change-1',
          reason: 'upgrade',
          status: 'pending',
          toPlan: 'starter',
        } as any,
      ],
      topUpOrders: [
        {
          amount: 98,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          credits: 100_000_000,
          currency: 'CNY',
          id: 'topup-1',
          source: 'alipay',
          status: 'paid',
        } as any,
        {
          amount: 30,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          credits: 30_000_000,
          currency: 'CNY',
          id: 'topup-2',
          source: 'redemption',
          status: 'pending',
        } as any,
      ],
    });

    expect(items.map((item) => item.rowKey)).toEqual([
      'topup:topup-1',
      'topup:topup-2',
      'subscription:sub-change-1',
    ]);
    expect(items[0]).toMatchObject({
      amount: 98,
      currency: 'CNY',
      kind: 'topup',
      status: 'paid',
      title: '积分包',
    });
    expect(items[2]).toMatchObject({ amount: null, kind: 'subscription', status: 'pending' });
  });

  it('uses the paid time as the billing date when a top-up order is paid', () => {
    const [item] = buildBillingHistoryItems({
      subscriptionChanges: [],
      topUpOrders: [
        {
          amount: 98,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          credits: 100_000_000,
          currency: 'CNY',
          id: 'topup-1',
          paidAt: new Date('2026-01-04T00:00:00.000Z'),
          source: 'alipay',
          status: 'paid',
        } as any,
      ],
    });

    expect(item.createdAt).toEqual(new Date('2026-01-04T00:00:00.000Z'));
  });
});
