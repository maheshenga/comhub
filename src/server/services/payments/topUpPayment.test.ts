// @vitest-environment node
import type { ModuleAppNormalizedPaymentEvent } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { TopUpPaymentService } from './topUpPayment';

const { getOnlineTopUpOrderByIdempotencyKey, settleOnlineTopUpOrder } = vi.hoisted(() => ({
  getOnlineTopUpOrderByIdempotencyKey: vi.fn(),
  settleOnlineTopUpOrder: vi.fn(),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn(() => ({
    getOnlineTopUpOrderByIdempotencyKey,
    settleOnlineTopUpOrder,
  })),
}));

const paymentEvent = (
  eventType: ModuleAppNormalizedPaymentEvent['eventType'],
): ModuleAppNormalizedPaymentEvent => ({
  currency: 'CNY',
  eventId: 'event-1',
  eventType,
  occurredAt: new Date('2026-07-27T00:00:00.000Z'),
  outTradeNo: 'wechat-order-1',
  paymentReference: 'wechat-transaction-1',
  provider: 'wechat_pay',
  totalAmount: '19.900000',
});

const createDb = (status: 'failed' | 'paid' | 'pending') =>
  ({
    query: {
      topUpOrders: {
        findFirst: vi.fn().mockResolvedValue({
          amount: 19.9,
          currency: 'CNY',
          externalOrderId: 'wechat-order-1',
          id: '00000000-0000-4000-8000-000000000001',
          metadata: { method: 'wechat_pay', paymentReference: 'wechat-transaction-1' },
          provider: 'wechat_pay',
          status,
          userId: 'user-1',
        }),
      },
    },
    update: vi.fn(),
  }) as unknown as LobeChatDatabase;

describe('TopUpPaymentService', () => {
  beforeEach(() => {
    getOnlineTopUpOrderByIdempotencyKey.mockReset();
    settleOnlineTopUpOrder.mockReset();
  });

  it('queries the provider before reporting that a missing checkout still needs recovery', async () => {
    getOnlineTopUpOrderByIdempotencyKey.mockResolvedValue({
      checkout: null,
      externalOrderId: 'wechat-order-1',
      id: '00000000-0000-4000-8000-000000000001',
      metadata: { method: 'wechat_pay' },
      provider: 'wechat_pay',
      status: 'pending',
      userId: 'user-1',
    });
    const adapter = {
      method: 'wechat_pay',
      provider: 'wechat_pay',
      query: vi.fn().mockResolvedValue(null),
    };
    const resolveAdapter = vi.fn().mockResolvedValue(adapter);
    const service = new TopUpPaymentService(createDb('pending'), resolveAdapter as any);

    await expect(
      service.reconcilePayment({
        idempotencyKey: '00000000-0000-4000-8000-000000000002',
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      checkout: null,
      orderId: '00000000-0000-4000-8000-000000000001',
      providerStatus: 'pending',
      recoveryRequired: true,
      status: 'pending',
    });
    expect(adapter.query).toHaveBeenCalledWith({ outTradeNo: 'wechat-order-1' });
  });

  it('settles a late provider success while recovering a locally failed order', async () => {
    getOnlineTopUpOrderByIdempotencyKey
      .mockResolvedValueOnce({
        checkout: null,
        externalOrderId: 'wechat-order-1',
        id: '00000000-0000-4000-8000-000000000001',
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        status: 'failed',
        userId: 'user-1',
      })
      .mockResolvedValueOnce({
        checkout: null,
        externalOrderId: 'wechat-order-1',
        id: '00000000-0000-4000-8000-000000000001',
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        status: 'paid',
        userId: 'user-1',
      });
    settleOnlineTopUpOrder.mockResolvedValue({ status: 'paid' });
    const adapter = {
      method: 'wechat_pay',
      provider: 'wechat_pay',
      query: vi.fn().mockResolvedValue(paymentEvent('payment_succeeded')),
    };
    const service = new TopUpPaymentService(
      createDb('failed'),
      vi.fn().mockResolvedValue(adapter) as any,
    );

    await expect(
      service.reconcilePayment({
        idempotencyKey: '00000000-0000-4000-8000-000000000002',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      providerStatus: 'payment_succeeded',
      recoveryRequired: false,
      status: 'paid',
    });
    expect(settleOnlineTopUpOrder).toHaveBeenCalledOnce();
  });

  it('revalidates successful duplicate callbacks before reporting them as duplicates', async () => {
    settleOnlineTopUpOrder.mockResolvedValue({ status: 'paid' });
    const service = new TopUpPaymentService(createDb('paid'));

    await expect(
      service.handleNormalizedEvent(paymentEvent('payment_succeeded'), 'wechat_pay'),
    ).resolves.toEqual({ duplicate: true, status: 'paid' });
    expect(settleOnlineTopUpOrder).toHaveBeenCalledOnce();
  });

  it('rejects refund events instead of marking a pending top-up as failed', async () => {
    const service = new TopUpPaymentService(createDb('pending'));

    await expect(
      service.handleNormalizedEvent(paymentEvent('refund_succeeded'), 'wechat_pay'),
    ).rejects.toThrow('TOP_UP_PAYMENT_EVENT_UNSUPPORTED');
    expect(settleOnlineTopUpOrder).not.toHaveBeenCalled();
  });

  it('rejects a failed provider event when its amount does not match the order', async () => {
    const service = new TopUpPaymentService(createDb('pending'));

    await expect(
      service.handleNormalizedEvent(
        { ...paymentEvent('payment_failed'), totalAmount: '19.910000' },
        'wechat_pay',
      ),
    ).rejects.toThrow('TOP_UP_PAYMENT_VERIFICATION_FAILED');
  });
});
