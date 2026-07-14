import {
  recordModuleAppOperationalAge,
  recordModuleAppPaymentVerificationFailure,
} from '@lobechat/observability-otel/modules/module-app';
import {
  moduleAppNormalizedPaymentEventSchema,
  moduleAppOrderSnapshotSchema,
} from '@lobechat/types';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { ModuleAppPaymentModel } from '@/database/models/moduleAppPayment';
import {
  moduleAppOrders,
  moduleAppPaymentDiscrepancies,
  moduleAppPaymentRefunds,
  moduleApps,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { assertModuleAppRolloutAllowed } from '../productionControls';
import { ModuleAppOrderRevenueService } from '../revenue';
import type { ModuleAppPaymentAdapter } from './contracts';

type ModuleAppPaymentMetrics = {
  recordOperationalAge: (kind: 'discrepancy' | 'refund', ageMs: number) => void;
  recordVerificationFailure: (reason: string) => void;
};

const getVerificationFailureReason = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('SIGNATURE')) return 'signature_invalid';
  if (message.includes('AMOUNT')) return 'amount_mismatch';
  if (message.includes('CURRENCY')) return 'currency_mismatch';
  if (message.includes('PROVIDER')) return 'provider_mismatch';
  if (message.includes('ORDER_NOT_FOUND')) return 'order_not_found';
  if (message.includes('SETTLEMENT')) return 'settlement_failed';
  if (message.includes('NOTIFICATION')) return 'invalid_notification';
  return 'other';
};

const formatAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('MODULE_APP_PAYMENT_AMOUNT_INVALID');
  }
  return amount.toFixed(6);
};

const assertPaymentUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('MODULE_APP_PAYMENT_URL_INVALID');
  return url.toString();
};

export class ModuleAppPaymentService {
  private readonly model: ModuleAppPaymentModel;

  constructor(
    private readonly db: LobeChatDatabase,
    private readonly adapter: ModuleAppPaymentAdapter,
    private readonly metrics: ModuleAppPaymentMetrics = {
      recordOperationalAge: recordModuleAppOperationalAge,
      recordVerificationFailure: recordModuleAppPaymentVerificationFailure,
    },
    private readonly orderRevenueService: Pick<
      ModuleAppOrderRevenueService,
      'refundOrder' | 'settleOrder'
    > = new ModuleAppOrderRevenueService(db),
  ) {
    this.model = new ModuleAppPaymentModel(db);
  }

  createPayment = async (input: {
    notifyUrl: string;
    orderId: string;
    purchaserUserId?: string;
    returnUrl: string;
    rollout?: { appIds: string[]; publisherIds: string[] };
    subject: string;
  }) => {
    const order = await this.db.query.moduleAppOrders.findFirst({
      where: and(
        eq(moduleAppOrders.id, input.orderId),
        input.purchaserUserId
          ? eq(moduleAppOrders.purchaserUserId, input.purchaserUserId)
          : undefined,
      ),
    });
    if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
    if (order.status !== 'pending') throw new Error('MODULE_APP_ORDER_NOT_PAYABLE');
    if (input.rollout) {
      const app = await this.db.query.moduleApps.findFirst({
        where: eq(moduleApps.id, order.appId),
      });
      assertModuleAppRolloutAllowed(
        { appId: order.appId, publisherId: app?.publisherId },
        input.rollout,
      );
    }
    const snapshot = moduleAppOrderSnapshotSchema.parse(order.snapshot);
    const totalAmount = formatAmount(snapshot.price);
    if (Number(totalAmount) <= 0) throw new Error('MODULE_APP_ORDER_NOT_PAYABLE');
    const subject = input.subject.trim().slice(0, 240);
    if (!subject) throw new Error('MODULE_APP_PAYMENT_SUBJECT_REQUIRED');
    const notifyUrl = assertPaymentUrl(input.notifyUrl);
    const returnUrl = assertPaymentUrl(input.returnUrl);
    const created = await this.adapter.create({
      notifyUrl,
      orderId: order.id,
      returnUrl,
      subject,
      totalAmount,
    });
    if (!created.body || !created.outTradeNo) {
      throw new Error('MODULE_APP_PAYMENT_CREATE_INVALID');
    }
    await this.model.createPaymentAttempt({
      currency: snapshot.currency,
      notifyUrl,
      orderId: order.id,
      outTradeNo: created.outTradeNo,
      returnUrl,
      subject,
      totalAmount,
    });
    return created;
  };

  handleNotification = async (input: { body: string; headers: Record<string, string> }) => {
    let verified: unknown;
    try {
      verified = await this.adapter.verifyNotification(input);
    } catch (error) {
      this.metrics.recordVerificationFailure(getVerificationFailureReason(error));
      throw error;
    }
    return this.handleNormalizedEvent(verified);
  };

  handleNormalizedEvent = async (input: unknown) => {
    const parsed = moduleAppNormalizedPaymentEventSchema.safeParse(input);
    if (!parsed.success) {
      this.metrics.recordVerificationFailure('invalid_notification');
      throw new Error('MODULE_APP_PAYMENT_NOTIFICATION_INVALID');
    }
    const event = parsed.data;
    const recorded = await this.model.recordPaymentEvent({
      currency: event.currency,
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      outTradeNo: event.outTradeNo,
      paymentReference: event.paymentReference,
      provider: event.provider,
      providerTransactionId: event.providerTransactionId,
      totalAmount: event.totalAmount,
    });
    const attempt = await this.model.getPaymentAttemptByOutTradeNo(event.outTradeNo);
    if (!attempt) {
      await this.model.createDiscrepancy({
        actualAmount: event.totalAmount,
        actualCurrency: event.currency,
        discrepancyKey: event.eventId,
        kind: 'order_not_found',
        outTradeNo: event.outTradeNo,
        provider: event.provider,
      });
      await this.model.updatePaymentEvent({
        errorCode: 'MODULE_APP_PAYMENT_ORDER_NOT_FOUND',
        eventId: event.eventId,
        eventStatus: 'rejected',
        processedAt: new Date(),
        provider: event.provider,
      });
      throw new Error('MODULE_APP_PAYMENT_ORDER_NOT_FOUND');
    }
    const order = await this.db.query.moduleAppOrders.findFirst({
      where: eq(moduleAppOrders.id, attempt.orderId),
    });
    if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
    if (recorded.duplicate && order.status !== 'pending') {
      return { duplicate: true, status: order.status };
    }
    if (event.orderId && event.orderId !== order.id) {
      await this.rejectEvent({
        eventId: event.eventId,
        errorCode: 'MODULE_APP_PAYMENT_PROVIDER_MISMATCH',
        kind: 'provider_mismatch',
        orderId: order.id,
        outTradeNo: event.outTradeNo,
        provider: event.provider,
      });
      throw new Error('MODULE_APP_PAYMENT_PROVIDER_MISMATCH');
    }
    const snapshot = moduleAppOrderSnapshotSchema.parse(order.snapshot);
    const expectedAmount = formatAmount(snapshot.price);
    if (formatAmount(event.totalAmount) !== expectedAmount) {
      await this.rejectEvent({
        actualAmount: event.totalAmount,
        errorCode: 'MODULE_APP_PAYMENT_AMOUNT_MISMATCH',
        eventId: event.eventId,
        expectedAmount,
        kind: 'amount_mismatch',
        orderId: order.id,
        outTradeNo: event.outTradeNo,
        provider: event.provider,
      });
      throw new Error('MODULE_APP_PAYMENT_AMOUNT_MISMATCH');
    }
    if (event.currency !== snapshot.currency) {
      await this.rejectEvent({
        actualCurrency: event.currency,
        errorCode: 'MODULE_APP_PAYMENT_CURRENCY_MISMATCH',
        eventId: event.eventId,
        expectedCurrency: snapshot.currency,
        kind: 'currency_mismatch',
        orderId: order.id,
        outTradeNo: event.outTradeNo,
        provider: event.provider,
      });
      throw new Error('MODULE_APP_PAYMENT_CURRENCY_MISMATCH');
    }
    if (event.eventType !== 'payment_succeeded') {
      await this.model.updatePaymentEvent({
        eventId: event.eventId,
        eventStatus: 'ignored',
        orderId: order.id,
        processedAt: new Date(),
        provider: event.provider,
      });
      return { duplicate: recorded.duplicate, status: order.status };
    }
    const paymentReference =
      event.paymentReference ?? event.providerTransactionId ?? event.outTradeNo;
    let settled: Awaited<ReturnType<ModuleAppOrderRevenueService['settleOrder']>>;
    try {
      settled = await this.orderRevenueService.settleOrder({
        actorUserId: order.purchaserUserId,
        orderId: order.id,
        paymentReference,
      });
    } catch (error) {
      await this.rejectEvent({
        errorCode: 'MODULE_APP_PAYMENT_SETTLEMENT_FAILED',
        eventId: event.eventId,
        kind: 'settlement_failed',
        orderId: order.id,
        outTradeNo: event.outTradeNo,
        provider: event.provider,
      });
      throw error;
    }
    await this.model.updatePaymentAttempt({
      outTradeNo: event.outTradeNo,
      paidAt: event.occurredAt,
      providerTransactionId: event.providerTransactionId,
      status: 'paid',
    });
    await this.model.updatePaymentEvent({
      eventId: event.eventId,
      eventStatus: 'processed',
      orderId: order.id,
      processedAt: new Date(),
      provider: event.provider,
    });
    return { duplicate: recorded.duplicate, status: settled.status };
  };

  reconcilePayment = async (input: { outTradeNo: string }) => {
    const attempt = await this.model.getPaymentAttemptByOutTradeNo(input.outTradeNo);
    if (!attempt) throw new Error('MODULE_APP_PAYMENT_ATTEMPT_NOT_FOUND');
    const order = await this.db.query.moduleAppOrders.findFirst({
      where: eq(moduleAppOrders.id, attempt.orderId),
    });
    if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
    const event = await this.adapter.query({ outTradeNo: input.outTradeNo });
    if (!event) {
      if (order.status === 'paid') {
        await this.model.createDiscrepancy({
          discrepancyKey: `local-paid:${input.outTradeNo}`,
          kind: 'local_paid_provider_unpaid',
          orderId: order.id,
          outTradeNo: input.outTradeNo,
          provider: 'alipay',
        });
      }
      return { localStatus: order.status, providerStatus: 'pending' as const };
    }
    if (event.eventType === 'payment_succeeded' && order.status === 'pending') {
      await this.model.createDiscrepancy({
        actualAmount: event.totalAmount,
        actualCurrency: event.currency,
        discrepancyKey: `provider-paid:${event.eventId}`,
        kind: 'local_unpaid_provider_paid',
        orderId: order.id,
        outTradeNo: input.outTradeNo,
        provider: 'alipay',
      });
    } else if (event.eventType === 'payment_failed' && order.status === 'paid') {
      await this.model.createDiscrepancy({
        discrepancyKey: `provider-unpaid:${event.eventId}`,
        kind: 'local_paid_provider_unpaid',
        orderId: order.id,
        outTradeNo: input.outTradeNo,
        provider: 'alipay',
      });
    }
    const result = await this.handleNormalizedEvent(event);
    return { ...result, providerStatus: event.eventType };
  };

  reconcilePendingPayments = async (input: { limit?: number } = {}) => {
    await this.recordOperationalAges();
    const attempts = await this.model.listPendingPaymentAttempts(input.limit ?? 100);
    const results = [];
    for (const attempt of attempts) {
      try {
        results.push({
          outTradeNo: attempt.outTradeNo,
          result: await this.reconcilePayment({ outTradeNo: attempt.outTradeNo }),
        });
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : 'MODULE_APP_PAYMENT_RECONCILE_FAILED',
          outTradeNo: attempt.outTradeNo,
        });
      }
    }
    return { count: attempts.length, results };
  };

  recordOperationalAges = async (now = new Date()) => {
    const [discrepancy, refund] = await Promise.all([
      this.db.query.moduleAppPaymentDiscrepancies.findFirst({
        orderBy: [asc(moduleAppPaymentDiscrepancies.createdAt)],
        where: eq(moduleAppPaymentDiscrepancies.status, 'open'),
      }),
      this.db.query.moduleAppPaymentRefunds.findFirst({
        orderBy: [asc(moduleAppPaymentRefunds.createdAt)],
        where: inArray(moduleAppPaymentRefunds.status, ['requested', 'failed']),
      }),
    ]);
    if (discrepancy) {
      this.metrics.recordOperationalAge(
        'discrepancy',
        Math.max(0, now.getTime() - discrepancy.createdAt.getTime()),
      );
    }
    if (refund) {
      this.metrics.recordOperationalAge(
        'refund',
        Math.max(0, now.getTime() - refund.createdAt.getTime()),
      );
    }
  };

  reconcileRefund = async (input: { actorUserId: string; orderId: string }) => {
    if (!this.adapter.queryRefund) throw new Error('MODULE_APP_PAYMENT_REFUND_QUERY_UNSUPPORTED');
    const [attempt, refund, order] = await Promise.all([
      this.model.getPaymentAttemptByOrderId(input.orderId),
      this.model.getRefundByOrderId(input.orderId),
      this.db.query.moduleAppOrders.findFirst({ where: eq(moduleAppOrders.id, input.orderId) }),
    ]);
    if (!attempt || !refund || !order) throw new Error('MODULE_APP_PAYMENT_REFUND_NOT_FOUND');
    const result = await this.adapter.queryRefund({
      outRequestNo: refund.providerRefundId,
      outTradeNo: attempt.outTradeNo,
    });
    if (result.status !== 'succeeded') {
      await this.model.createDiscrepancy({
        discrepancyKey: `refund:${refund.providerRefundId}:${result.status}`,
        kind: 'refund_mismatch',
        orderId: order.id,
        outTradeNo: attempt.outTradeNo,
        provider: 'alipay',
      });
      return result;
    }
    await this.model.updateRefundStatus({ orderId: order.id, status: 'succeeded' });
    if (order.status !== 'refunded') {
      await this.orderRevenueService.refundOrder({
        actorUserId: input.actorUserId,
        orderId: order.id,
        reason: refund.reason,
      });
    }
    return result;
  };

  refundOrder = async (input: { actorUserId?: string; orderId: string; reason: string }) => {
    const order = await this.db.query.moduleAppOrders.findFirst({
      where: eq(moduleAppOrders.id, input.orderId),
    });
    if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
    const existing = await this.model.getRefundByOrderId(order.id);
    if (existing && existing.status !== 'succeeded') {
      throw new Error('MODULE_APP_PAYMENT_REFUND_FAILED');
    }
    if (!existing) {
      const attempt = await this.model.getPaymentAttemptByOrderId(order.id);
      if (!attempt) throw new Error('MODULE_APP_PAYMENT_ATTEMPT_NOT_FOUND');
      const snapshot = moduleAppOrderSnapshotSchema.parse(order.snapshot);
      const result = await this.adapter.refund({
        outTradeNo: attempt.outTradeNo,
        reason: input.reason,
        refundAmount: formatAmount(snapshot.price),
      });
      await this.model.createRefund({
        currency: snapshot.currency,
        orderId: order.id,
        provider: 'alipay',
        providerRefundId: result.providerRefundId,
        reason: input.reason,
        refundAmount: formatAmount(snapshot.price),
        status: result.status === 'succeeded' ? 'succeeded' : 'failed',
      });
      await this.model.updatePaymentAttempt({
        outTradeNo: attempt.outTradeNo,
        status: result.status === 'succeeded' ? 'refunded' : 'failed',
      });
      if (result.status !== 'succeeded') throw new Error('MODULE_APP_PAYMENT_REFUND_FAILED');
    }
    return this.orderRevenueService.refundOrder({
      actorUserId: input.actorUserId ?? order.purchaserUserId,
      orderId: order.id,
      reason: input.reason,
    });
  };

  private rejectEvent = async (input: {
    actualAmount?: string;
    actualCurrency?: string;
    errorCode: string;
    eventId: string;
    expectedAmount?: string;
    expectedCurrency?: string;
    kind: 'amount_mismatch' | 'currency_mismatch' | 'provider_mismatch' | 'settlement_failed';
    orderId: string;
    outTradeNo: string;
    provider: 'alipay';
  }) => {
    await this.model.createDiscrepancy({
      actualAmount: input.actualAmount,
      actualCurrency: input.actualCurrency,
      discrepancyKey: input.eventId,
      expectedAmount: input.expectedAmount,
      expectedCurrency: input.expectedCurrency,
      kind: input.kind,
      orderId: input.orderId,
      outTradeNo: input.outTradeNo,
      provider: input.provider,
    });
    await this.model.updatePaymentEvent({
      errorCode: input.errorCode,
      eventId: input.eventId,
      eventStatus: 'rejected',
      orderId: input.orderId,
      processedAt: new Date(),
      provider: input.provider,
    });
  };
}
