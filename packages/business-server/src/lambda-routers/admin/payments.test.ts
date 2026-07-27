import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { runRequiredAdminAuditExternalEffect } from './audit';
import { adminPaymentsRouter } from './payments';

const {
  createOperationalPaymentConfig,
  createPaymentAdapter,
  getServerPaymentConfig,
  reconcilePayment,
} = vi.hoisted(() => ({
  createOperationalPaymentConfig: vi.fn(),
  createPaymentAdapter: vi.fn(),
  getServerPaymentConfig: vi.fn(),
  reconcilePayment: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: vi.fn() }));
vi.mock('@/server/services/payments/config', () => ({
  createOperationalPaymentConfig,
  getServerPaymentConfig,
}));
vi.mock('@/server/services/payments/factory', () => ({ createPaymentAdapter }));
vi.mock('@/server/services/payments/topUpPayment', () => ({
  TopUpPaymentService: class {
    constructor(
      _db: unknown,
      private readonly resolveAdapter: (provider: string, method: string) => unknown,
    ) {}

    reconcilePayment = async (input: unknown) => {
      await this.resolveAdapter('wechat_pay', 'wechat_pay');
      return reconcilePayment(input);
    };
  },
}));
vi.mock('./audit', () => ({
  runRequiredAdminAuditExternalEffect: vi.fn(async (_ctx, options) => options.effect()),
}));

const orderId = '00000000-0000-4000-8000-000000000001';
const idempotencyKey = '00000000-0000-4000-8000-000000000002';

const createDb = (order?: Record<string, unknown>) => ({
  query: {
    topUpOrders: { findFirst: vi.fn().mockResolvedValue(order) },
    users: { findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }) },
  },
});

describe('adminPaymentsRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerPaymentConfig.mockResolvedValue({ enabled: false, topUpEnabled: false });
    createOperationalPaymentConfig.mockImplementation((config) => ({
      ...config,
      enabled: true,
      topUpEnabled: true,
    }));
    createPaymentAdapter.mockReturnValue({ method: 'wechat_pay', provider: 'wechat_pay' });
    reconcilePayment.mockResolvedValue({
      checkout: null,
      orderId,
      providerStatus: 'pending',
      recoveryRequired: true,
      status: 'pending',
    });
  });

  it('reconciles an online top-up through operational provider configuration', async () => {
    vi.mocked(getServerDB).mockResolvedValue(
      createDb({
        id: orderId,
        idempotencyKey,
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        userId: 'target-user',
      }) as any,
    );
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.reconcileTopUpPayment({ orderId })).resolves.toMatchObject({
      orderId,
      recoveryRequired: true,
    });
    expect(createOperationalPaymentConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, topUpEnabled: false }),
    );
    expect(createPaymentAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, topUpEnabled: true }),
      'wechat_pay',
    );
    expect(reconcilePayment).toHaveBeenCalledWith({
      idempotencyKey,
      userId: 'target-user',
    });
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledOnce();
  });

  it('rejects offline and redemption orders before contacting a provider', async () => {
    vi.mocked(getServerDB).mockResolvedValue(
      createDb({
        id: orderId,
        idempotencyKey: null,
        metadata: { packageId: 'starter' },
        provider: 'redemption',
        userId: 'target-user',
      }) as any,
    );
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.reconcileTopUpPayment({ orderId })).rejects.toMatchObject({
      message: 'TOP_UP_PAYMENT_ORDER_INVALID',
    });
    expect(reconcilePayment).not.toHaveBeenCalled();
  });

  it('reconciles pending online top-ups as one audited finance operation', async () => {
    const db = createDb() as any;
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn().mockResolvedValue([
      {
        externalOrderId: 'provider-order-1',
        id: orderId,
        idempotencyKey,
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        status: 'pending',
        userId: 'target-user',
      },
    ]);
    db.select = vi.fn(() => chain);
    vi.mocked(getServerDB).mockResolvedValue(db);
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.reconcilePendingTopUpPayments({ limit: 10 })).resolves.toMatchObject({
      count: 1,
      failedCount: 0,
      results: [{ ok: true, orderId }],
    });
    expect(reconcilePayment).toHaveBeenCalledWith({ idempotencyKey, userId: 'target-user' });
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledOnce();
  });

  it('returns and audits partial failures without hiding successful reconciliation attempts', async () => {
    const db = createDb() as any;
    const secondOrderId = '00000000-0000-4000-8000-000000000003';
    const secondIdempotencyKey = '00000000-0000-4000-8000-000000000004';
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn().mockResolvedValue([
      {
        externalOrderId: 'provider-order-1',
        id: orderId,
        idempotencyKey,
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        status: 'pending',
        userId: 'target-user',
      },
      {
        externalOrderId: 'provider-order-2',
        id: secondOrderId,
        idempotencyKey: secondIdempotencyKey,
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        status: 'pending',
        userId: 'second-user',
      },
    ]);
    db.select = vi.fn(() => chain);
    vi.mocked(getServerDB).mockResolvedValue(db);
    reconcilePayment.mockRejectedValueOnce(new Error('PROVIDER_TIMEOUT'));
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    const result = await caller.reconcilePendingTopUpPayments({ limit: 10 });

    expect(result).toMatchObject({
      count: 2,
      failedCount: 1,
      results: [
        { error: 'PROVIDER_TIMEOUT', ok: false, orderId },
        { ok: true, orderId: secondOrderId },
      ],
    });
    const auditOptions = vi.mocked(runRequiredAdminAuditExternalEffect).mock.calls[0][1] as any;
    expect(auditOptions.terminalStatus(result)).toBe('failed');
    expect(auditOptions.audit('failed', result)).toMatchObject({
      payload: { count: 2, failedCount: 1, limit: 10, terminalStatus: 'failed' },
    });
  });

  it('returns a validated online provider in top-up payment rows', async () => {
    const db = createDb() as any;
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.offset = vi.fn().mockResolvedValue([
      {
        amount: '19.90',
        createdAt: new Date('2026-07-28T00:00:00.000Z'),
        credits: '199000000',
        currency: 'CNY',
        externalOrderId: 'provider-order-1',
        id: orderId,
        idempotencyKey,
        metadata: { method: 'alipay', packageId: 'starter' },
        paidAt: null,
        provider: 'alipay',
        status: 'pending',
        updatedAt: new Date('2026-07-28T00:00:00.000Z'),
        userEmail: 'user@example.com',
        userId: 'target-user',
        userName: null,
      },
    ]);
    db.select = vi.fn(() => chain);
    vi.mocked(getServerDB).mockResolvedValue(db);
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.listTopUpPayments({ limit: 25 })).resolves.toMatchObject({
      items: [{ method: 'alipay', provider: 'alipay' }],
      nextCursor: null,
    });
  });
});
