import {
  moduleAppNormalizedPaymentEventSchema,
  moduleAppOrderSnapshotSchema,
} from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { ModuleAppPaymentModel } from '@/database/models/moduleAppPayment';
import { moduleAppOrders } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { ModuleAppOrderRevenueService } from '../revenue';
import type { ModuleAppPaymentAdapter } from './contracts';

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
  ) {
    this.model = new ModuleAppPaymentModel(db);
  }

  createPayment = async (input: {
    notifyUrl: string;
    orderId: string;
    returnUrl: string;
    subject: string;
  }) => {
    const order = await this.db.query.moduleAppOrders.findFirst({
      where: eq(moduleAppOrders.id, input.orderId),
    });
    if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
    if (order.status !== 'pending') throw new Error('MODULE_APP_ORDER_NOT_PAYABLE');
    const snapshot = moduleAppOrderSnapshotSchema.parse(order.snapshot);
    const totalAmount = formatAmount(snapshot.price);
    const notifyUrl = assertPaymentUrl(input.notifyUrl);
    const returnUrl = assertPaymentUrl(input.returnUrl);
    const created = await this.adapter.create({
      notifyUrl,
      orderId: order.id,
      returnUrl,
      subject: input.subject.trim().slice(0, 240),
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
      subject: input.subject.trim().slice(0, 240),
      totalAmount,
    });
    return created;
  };

  handleNotification = async (input: { body: string; headers: Record<string, string> }) => {
    const verified = await this.adapter.verifyNotification(input);
    const parsed = moduleAppNormalizedPaymentEventSchema.safeParse(verified);
    if (!parsed.success) throw new Error('MODULE_APP_PAYMENT_NOTIFICATION_INVALID');
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
    if (recorded.duplicate) return { duplicate: true, status: order.status };
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
      return { duplicate: false, status: order.status };
    }
    const paymentReference =
      event.paymentReference ?? event.providerTransactionId ?? event.outTradeNo;
    let settled: Awaited<ReturnType<ModuleAppOrderRevenueService['settleOrder']>>;
    try {
      settled = await new ModuleAppOrderRevenueService(this.db).settleOrder({
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
    return { duplicate: false, status: settled.status };
  };

  refundOrder = async (input: { orderId: string; reason: string }) => {
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
    return new ModuleAppOrderRevenueService(this.db).refundOrder({
      actorUserId: order.purchaserUserId,
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
    kind:
      | 'amount_mismatch'
      | 'currency_mismatch'
      | 'provider_mismatch'
      | 'settlement_failed';
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
