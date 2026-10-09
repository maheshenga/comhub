import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAuditStrict, runRequiredAdminAuditExternalEffect } from './audit';
import { adminPaymentsRouter } from './payments';

const {
  createOperationalPaymentConfig,
  createPaymentAdapter,
  getServerPaymentConfig,
  reconcilePayment,
  reconcileSubscriptionPayment,
  recordSettlementFailure,
  refundSubscriptionPayment,
  refundTopUpPayment,
  resolveSubscriptionRefund,
  resolveTopUpRefund,
  resolveSettlementFailure,
  settleCreditReservation,
} = vi.hoisted(() => ({
  createOperationalPaymentConfig: vi.fn(),
  createPaymentAdapter: vi.fn(),
  getServerPaymentConfig: vi.fn(),
  reconcilePayment: vi.fn(),
  reconcileSubscriptionPayment: vi.fn(),
  recordSettlementFailure: vi.fn(),
  refundSubscriptionPayment: vi.fn(),
  refundTopUpPayment: vi.fn(),
  resolveSubscriptionRefund: vi.fn(),
  resolveTopUpRefund: vi.fn(),
  resolveSettlementFailure: vi.fn(),
  settleCreditReservation: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: vi.fn() }));
vi.mock('@/database/models/moduleAppCredit', () => ({
  ModuleAppCreditModel: class {
    recordSettlementFailure = recordSettlementFailure;
    resolveSettlementFailure = resolveSettlementFailure;
    settle = settleCreditReservation;
  },
}));
vi.mock('@/server/services/payments/config', () => ({
  createOperationalPaymentConfig,
  getServerPaymentConfig,
}));
vi.mock('@/server/services/payments/factory', () => ({ createPaymentAdapter }));
vi.mock('@/server/services/payments/subscriptionPayment', () => ({
  SubscriptionPaymentService: class {
    constructor(
      _db: unknown,
      private readonly resolveAdapter: (provider: string, method: string) => unknown,
    ) {}

    reconcilePayment = async (input: unknown) => {
      await this.resolveAdapter('wechat_pay', 'wechat_pay');
      return reconcileSubscriptionPayment(input);
    };

    refundOrder = async (input: unknown) => {
      await this.resolveAdapter('wechat_pay', 'wechat_pay');
      return refundSubscriptionPayment(input);
    };

    resolvePendingRefund = (input: unknown) => resolveSubscriptionRefund(input);
  },
}));
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

    refundOrder = async (input: unknown) => {
      await this.resolveAdapter('wechat_pay', 'wechat_pay');
      return refundTopUpPayment(input);
    };

    resolvePendingRefund = (input: unknown) => resolveTopUpRefund(input);
  },
}));
vi.mock('./audit', () => ({
  recordAdminAuditStrict: vi.fn(async () => ({ ok: true, status: 'succeeded' })),
  runRequiredAdminAuditExternalEffect: vi.fn(async (_ctx, options) => options.effect()),
}));

const orderId = '00000000-0000-4000-8000-000000000001';
const idempotencyKey = '00000000-0000-4000-8000-000000000002';

const createDb = (order?: Record<string, unknown>) => ({
  query: {
    creditSettlementFailures: { findFirst: vi.fn().mockResolvedValue(undefined) },
    subscriptionPaymentOrders: {
      findFirst: vi.fn().mockResolvedValue(order),
      findMany: vi.fn().mockResolvedValue(order ? [order] : []),
    },
    topUpOrders: {
      findFirst: vi.fn().mockResolvedValue(order),
      findMany: vi.fn().mockResolvedValue(order ? [order] : []),
    },
    users: { findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }) },
  },
});

describe('adminPaymentsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    reconcileSubscriptionPayment.mockResolvedValue({
      checkout: null,
      orderId,
      providerStatus: 'pending',
      recoveryRequired: true,
      status: 'pending',
    });
    refundTopUpPayment.mockResolvedValue({ debtAmount: 0, status: 'refunded' });
    refundSubscriptionPayment.mockResolvedValue({ debtAmount: 0, status: 'refunded' });
    resolveSubscriptionRefund.mockResolvedValue({ debtAmount: 0, status: 'refunded' });
    resolveTopUpRefund.mockResolvedValue({ debtAmount: 0, status: 'refunded' });
    settleCreditReservation.mockResolvedValue({ status: 'settled' });
    resolveSettlementFailure.mockResolvedValue(undefined);
  });

  it('lists persisted credit settlement failures for finance operators', async () => {
    const db = createDb() as any;
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.offset = vi.fn().mockResolvedValue([
      {
        actualAmount: 12,
        attempts: 2,
        id: '00000000-0000-4000-8000-000000000020',
        reservationId: '00000000-0000-4000-8000-000000000021',
        status: 'pending',
      },
    ]);
    db.select = vi.fn(() => chain);
    vi.mocked(getServerDB).mockResolvedValue(db);
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(
      caller.listCreditSettlementFailures({ limit: 25, status: 'pending' }),
    ).resolves.toMatchObject({
      items: [{ attempts: 2, status: 'pending' }],
      nextCursor: null,
    });
  });

  it('retries a persisted credit settlement with its frozen payload and required audit', async () => {
    const failureId = '00000000-0000-4000-8000-000000000020';
    const reservationId = '00000000-0000-4000-8000-000000000021';
    const payload = {
      actualAmount: 12,
      ledger: { referenceType: 'ai_usage_reservation', title: 'AI Usage' },
      metadata: { model: 'gpt-test', operationId: 'operation-1' },
      reservationId,
    };
    const db = createDb() as any;
    db.query.creditSettlementFailures.findFirst.mockResolvedValue({
      attempts: 2,
      id: failureId,
      payload,
      reservationId,
      status: 'pending',
    });
    vi.mocked(getServerDB).mockResolvedValue(db);
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.retryCreditSettlementFailure({ failureId })).resolves.toEqual({
      duplicate: false,
      reservationId,
      status: 'resolved',
    });
    expect(settleCreditReservation).toHaveBeenCalledWith(payload);
    expect(resolveSettlementFailure).toHaveBeenCalledWith(reservationId);
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledOnce();
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

  it('refunds an online top-up with a trimmed reason and required audit', async () => {
    vi.mocked(getServerDB).mockResolvedValue(
      createDb({
        id: orderId,
        idempotencyKey,
        metadata: { method: 'wechat_pay' },
        provider: 'wechat_pay',
        status: 'paid',
        userId: 'target-user',
      }) as any,
    );
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(
      caller.refundTopUpPayment({ orderId, reason: '  customer request  ' }),
    ).resolves.toMatchObject({ status: 'refunded' });
    expect(refundTopUpPayment).toHaveBeenCalledWith({
      orderId,
      reason: 'customer request',
      userId: 'target-user',
    });
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledOnce();
  });

  it('rejects an empty refund reason before contacting a payment provider', async () => {
    vi.mocked(getServerDB).mockResolvedValue(createDb() as any);
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.refundTopUpPayment({ orderId, reason: '   ' })).rejects.toBeDefined();
    expect(refundTopUpPayment).not.toHaveBeenCalled();
  });

  it('reconciles and refunds plan payment orders through audited finance operations', async () => {
    vi.mocked(getServerDB).mockResolvedValue(
      createDb({
        id: orderId,
        idempotencyKey,
        method: 'wechat_pay',
        provider: 'wechat_pay',
        status: 'paid',
        userId: 'target-user',
      }) as any,
    );
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(caller.reconcileSubscriptionPayment({ orderId })).resolves.toMatchObject({
      orderId,
    });
    await expect(
      caller.refundSubscriptionPayment({ orderId, reason: 'duplicate purchase' }),
    ).resolves.toMatchObject({ status: 'refunded' });
    expect(reconcileSubscriptionPayment).toHaveBeenCalledWith({
      idempotencyKey,
      userId: 'target-user',
    });
    expect(refundSubscriptionPayment).toHaveBeenCalledWith({
      orderId,
      reason: 'duplicate purchase',
      userId: 'target-user',
    });
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledTimes(2);
  });

  it('manually resolves ZPay refunds through audited finance operations', async () => {
    resolveSubscriptionRefund.mockResolvedValueOnce({ status: 'failed' });
    vi.mocked(getServerDB).mockResolvedValue(
      createDb({
        id: orderId,
        method: 'zpay_alipay',
        provider: 'zpay',
        refundReference: 'zr-request-1',
        refundStatus: 'pending',
        status: 'paid',
        userId: 'target-user',
      }) as any,
    );
    const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

    await expect(
      caller.resolveTopUpPaymentRefund({
        note: '  checked merchant portal  ',
        orderId,
        resolution: 'succeeded',
      }),
    ).resolves.toMatchObject({ status: 'refunded' });
    await expect(
      caller.resolveSubscriptionPaymentRefund({
        note: 'provider has no refund record',
        orderId,
        resolution: 'failed',
      }),
    ).resolves.toMatchObject({ status: 'failed' });
    expect(resolveTopUpRefund).toHaveBeenCalledWith({
      orderId,
      resolution: 'succeeded',
      userId: 'target-user',
    });
    expect(resolveSubscriptionRefund).toHaveBeenCalledWith({
      orderId,
      resolution: 'failed',
      userId: 'target-user',
    });
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledTimes(2);
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

  it('returns frozen plan details in subscription payment rows', async () => {
    const db = createDb() as any;
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.offset = vi.fn().mockResolvedValue([
      {
        amount: '68.00',
        createdAt: new Date('2026-07-28T00:00:00.000Z'),
        currency: 'CNY',
        cycle: 'monthly',
        externalOrderId: 'subscription-order-1',
        id: orderId,
        idempotencyKey,
        method: 'wechat_pay',
        paidAt: null,
        plan: 'starter',
        provider: 'wechat_pay',
        refundReference: null,
        refundStatus: null,
        snapshot: { displayName: 'Starter', monthlyCredits: 5000 },
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

    await expect(caller.listSubscriptionPayments({ limit: 25 })).resolves.toMatchObject({
      items: [
        {
          displayName: 'Starter',
          method: 'wechat_pay',
          monthlyCredits: 5000,
          provider: 'wechat_pay',
        },
      ],
      nextCursor: null,
    });
  });

  describe('bulk refunds (M5 batch paradigm)', () => {
    const secondOrderId = '00000000-0000-4000-8000-000000000003';
    const unknownOrderId = '00000000-0000-4000-8000-000000000004';
    const topUpCommand = {
      actionId: 'payment.bulkRefund',
      confirmationText: 'payment.bulkRefund',
      confirmed: true,
      reason: 'duplicate charge',
    } as const;
    const subscriptionCommand = {
      actionId: 'payment.subscriptionBulkRefund',
      confirmationText: 'payment.subscriptionBulkRefund',
      confirmed: true,
      reason: 'duplicate purchase',
    } as const;

    it('previews a top-up bulk refund in dry-run without effects or audit', async () => {
      const db = createDb() as any;
      db.query.topUpOrders.findMany.mockResolvedValue([
        {
          amount: '19.90',
          currency: 'CNY',
          externalOrderId: 'provider-order-1',
          id: orderId,
          idempotencyKey,
          metadata: { method: 'wechat_pay' },
          provider: 'wechat_pay',
          refundStatus: null,
          status: 'paid',
          userId: 'target-user',
        },
      ]);
      vi.mocked(getServerDB).mockResolvedValue(db);
      const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

      const result = await caller.bulkRefund({
        command: topUpCommand,
        dryRun: true,
        orderIds: [orderId, unknownOrderId],
      });

      expect(result).toMatchObject({
        batchCorrelationId: null,
        dryRun: true,
        matched: 1,
        refundable: 1,
        results: [
          { error: null, ok: true, orderId, preview: { currency: 'CNY', status: 'paid' } },
          { error: 'TOP_UP_ORDER_NOT_FOUND', ok: false, orderId: unknownOrderId, preview: null },
        ],
        unmatchedOrderIds: [unknownOrderId],
      });
      expect(refundTopUpPayment).not.toHaveBeenCalled();
      expect(runRequiredAdminAuditExternalEffect).not.toHaveBeenCalled();
      expect(recordAdminAuditStrict).not.toHaveBeenCalled();
    });

    it('refunds paid online top-ups in bulk and writes a batch-level summary audit', async () => {
      const db = createDb() as any;
      db.query.topUpOrders.findMany.mockResolvedValue([
        {
          amount: '19.90',
          currency: 'CNY',
          externalOrderId: 'provider-order-1',
          id: orderId,
          idempotencyKey,
          metadata: { method: 'wechat_pay' },
          provider: 'wechat_pay',
          refundStatus: null,
          status: 'paid',
          userId: 'target-user',
        },
      ]);
      vi.mocked(getServerDB).mockResolvedValue(db);
      const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

      const result = await caller.bulkRefund({
        command: topUpCommand,
        orderIds: [orderId],
      });

      expect(result).toMatchObject({
        dryRun: false,
        failed: 0,
        results: [{ ok: true, orderId }],
        succeeded: 1,
        total: 1,
      });
      expect(refundTopUpPayment).toHaveBeenCalledWith({
        orderId,
        reason: 'duplicate charge',
        userId: 'target-user',
      });
      expect(recordAdminAuditStrict).toHaveBeenCalledOnce();
      const [, entry, options] = vi.mocked(recordAdminAuditStrict).mock.calls[0];
      expect(entry).toMatchObject({
        action: 'payment.bulkRefund',
        payload: {
          batchCorrelationId: result.batchCorrelationId,
          failed: 0,
          reason: 'duplicate charge',
          succeeded: 1,
          total: 1,
        },
        resourceId: 'top-up-payments-bulk-refund',
        resourceType: 'topUpPayment',
      });
      expect(options?.correlationId).toBe(result.batchCorrelationId);
    });

    it('previews a subscription bulk refund in dry-run without effects or audit', async () => {
      const db = createDb() as any;
      db.query.subscriptionPaymentOrders.findMany.mockResolvedValue([
        {
          externalOrderId: 'subscription-order-1',
          id: orderId,
          refundStatus: null,
          status: 'paid',
          userId: 'target-user',
        },
      ]);
      vi.mocked(getServerDB).mockResolvedValue(db);
      const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

      const result = await caller.subscriptionBulkRefund({
        command: subscriptionCommand,
        dryRun: true,
        orderIds: [orderId, unknownOrderId],
      });

      expect(result).toMatchObject({
        batchCorrelationId: null,
        dryRun: true,
        matched: 1,
        refundable: 1,
        results: [
          { error: null, ok: true, orderId, preview: { refundStatus: null, status: 'paid' } },
          {
            error: 'SUBSCRIPTION_PAYMENT_ORDER_NOT_FOUND',
            ok: false,
            orderId: unknownOrderId,
            preview: null,
          },
        ],
        unmatchedOrderIds: [unknownOrderId],
      });
      expect(refundSubscriptionPayment).not.toHaveBeenCalled();
      expect(runRequiredAdminAuditExternalEffect).not.toHaveBeenCalled();
      expect(recordAdminAuditStrict).not.toHaveBeenCalled();
    });

    it('refunds paid subscription orders in bulk through SubscriptionPaymentService', async () => {
      const db = createDb() as any;
      db.query.subscriptionPaymentOrders.findMany.mockResolvedValue([
        {
          externalOrderId: 'subscription-order-1',
          id: orderId,
          idempotencyKey,
          method: 'wechat_pay',
          provider: 'wechat_pay',
          refundStatus: null,
          status: 'paid',
          userId: 'target-user',
        },
        {
          externalOrderId: 'subscription-order-2',
          id: secondOrderId,
          idempotencyKey,
          method: 'wechat_pay',
          provider: 'wechat_pay',
          refundStatus: null,
          status: 'paid',
          userId: 'second-user',
        },
      ]);
      vi.mocked(getServerDB).mockResolvedValue(db);
      refundSubscriptionPayment.mockImplementation(async (input: any) => {
        if (input?.orderId === secondOrderId) throw new Error('PROVIDER_TIMEOUT');
        return { debtAmount: 0, status: 'refunded' };
      });
      const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

      const result = await caller.subscriptionBulkRefund({
        command: subscriptionCommand,
        orderIds: [orderId, secondOrderId],
      });

      expect(result).toMatchObject({
        dryRun: false,
        failed: 1,
        results: [
          { ok: true, orderId },
          { error: 'PROVIDER_TIMEOUT', ok: false, orderId: secondOrderId },
        ],
        succeeded: 1,
        total: 2,
      });
      expect(refundSubscriptionPayment).toHaveBeenCalledTimes(2);
      expect(refundSubscriptionPayment).toHaveBeenCalledWith({
        orderId,
        reason: 'duplicate purchase',
        userId: 'target-user',
      });
      expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledTimes(2);
      expect(recordAdminAuditStrict).toHaveBeenCalledOnce();
      const [, entry, options] = vi.mocked(recordAdminAuditStrict).mock.calls[0];
      expect(entry).toMatchObject({
        action: 'payment.subscriptionBulkRefund',
        payload: {
          batchCorrelationId: result.batchCorrelationId,
          failed: 1,
          reason: 'duplicate purchase',
          succeeded: 1,
          total: 2,
        },
        resourceId: 'subscription-payments-bulk-refund',
        resourceType: 'subscriptionPayment',
      });
      expect(options?.correlationId).toBe(result.batchCorrelationId);
    });

    it('rejects a subscription bulk refund when any order is missing', async () => {
      const db = createDb() as any;
      db.query.subscriptionPaymentOrders.findMany.mockResolvedValue([]);
      vi.mocked(getServerDB).mockResolvedValue(db);
      const caller = adminPaymentsRouter.createCaller({ userId: 'finance-user' } as any);

      await expect(
        caller.subscriptionBulkRefund({
          command: subscriptionCommand,
          orderIds: [orderId],
        }),
      ).rejects.toMatchObject({
        message: 'SUBSCRIPTION_PAYMENT_ORDER_NOT_FOUND',
      });
      expect(refundSubscriptionPayment).not.toHaveBeenCalled();
      expect(recordAdminAuditStrict).not.toHaveBeenCalled();
    });
  });
});
