import { and, eq } from 'drizzle-orm';

import {
  moduleAppPaymentAttempts,
  moduleAppPaymentDiscrepancies,
  moduleAppPaymentEvents,
  moduleAppPaymentRefunds,
} from '../schemas';
import type { LobeChatDatabase } from '../type';

export class ModuleAppPaymentModel {
  constructor(private readonly db: LobeChatDatabase) {}

  createPaymentAttempt = async (input: {
    currency: string;
    notifyUrl: string;
    orderId: string;
    outTradeNo: string;
    returnUrl: string;
    subject: string;
    totalAmount: string;
  }) => {
    const [attempt] = await this.db
      .insert(moduleAppPaymentAttempts)
      .values({ ...input, provider: 'alipay' })
      .onConflictDoNothing({
        target: [moduleAppPaymentAttempts.provider, moduleAppPaymentAttempts.outTradeNo],
      })
      .returning();
    if (attempt) return attempt;
    const existing = await this.getPaymentAttemptByOutTradeNo(input.outTradeNo);
    if (!existing) throw new Error('MODULE_APP_PAYMENT_ATTEMPT_CREATE_FAILED');
    if (
      existing.currency !== input.currency ||
      existing.notifyUrl !== input.notifyUrl ||
      existing.orderId !== input.orderId ||
      existing.returnUrl !== input.returnUrl ||
      existing.subject !== input.subject ||
      existing.totalAmount !== Number(input.totalAmount).toFixed(6)
    ) {
      throw new Error('MODULE_APP_PAYMENT_ATTEMPT_CONFLICT');
    }
    return existing;
  };

  getPaymentAttemptByOrderId = (orderId: string) =>
    this.db.query.moduleAppPaymentAttempts.findFirst({
      orderBy: (attempts, { desc }) => [desc(attempts.createdAt)],
      where: eq(moduleAppPaymentAttempts.orderId, orderId),
    });

  getPaymentAttemptByOutTradeNo = (outTradeNo: string) =>
    this.db.query.moduleAppPaymentAttempts.findFirst({
      where: and(
        eq(moduleAppPaymentAttempts.provider, 'alipay'),
        eq(moduleAppPaymentAttempts.outTradeNo, outTradeNo),
      ),
    });

  updatePaymentAttempt = async (input: {
    outTradeNo: string;
    paidAt?: Date;
    providerTransactionId?: string;
    status: 'created' | 'pending' | 'paid' | 'failed' | 'refunded';
  }) => {
    const [attempt] = await this.db
      .update(moduleAppPaymentAttempts)
      .set({
        ...(input.paidAt ? { paidAt: input.paidAt } : {}),
        ...(input.providerTransactionId
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
        status: input.status,
      })
      .where(
        and(
          eq(moduleAppPaymentAttempts.provider, 'alipay'),
          eq(moduleAppPaymentAttempts.outTradeNo, input.outTradeNo),
        ),
      )
      .returning();
    if (!attempt) throw new Error('MODULE_APP_PAYMENT_ATTEMPT_NOT_FOUND');
    return attempt;
  };

  recordPaymentEvent = async (input: {
    currency: string;
    eventId: string;
    eventType: 'payment_succeeded' | 'payment_failed' | 'refund_succeeded';
    occurredAt?: Date;
    orderId?: string;
    outTradeNo: string;
    paymentReference?: string;
    provider: 'alipay';
    providerTransactionId?: string;
    totalAmount: string;
  }) => {
    const [event] = await this.db
      .insert(moduleAppPaymentEvents)
      .values({
        currency: input.currency,
        eventType: input.eventType,
        occurredAt: input.occurredAt ?? new Date(),
        orderId: input.orderId,
        outTradeNo: input.outTradeNo,
        paymentReference: input.paymentReference,
        provider: input.provider,
        providerEventId: input.eventId,
        providerTransactionId: input.providerTransactionId,
        totalAmount: input.totalAmount,
      })
      .onConflictDoNothing({
        target: [moduleAppPaymentEvents.provider, moduleAppPaymentEvents.providerEventId],
      })
      .returning();
    if (event) return { duplicate: false, event };
    const existing = await this.db.query.moduleAppPaymentEvents.findFirst({
      where: and(
        eq(moduleAppPaymentEvents.provider, input.provider),
        eq(moduleAppPaymentEvents.providerEventId, input.eventId),
      ),
    });
    if (!existing) throw new Error('MODULE_APP_PAYMENT_EVENT_NOT_FOUND');
    const normalizedAmount = Number(input.totalAmount).toFixed(6);
    if (
      existing.currency !== input.currency ||
      existing.eventType !== input.eventType ||
      existing.outTradeNo !== input.outTradeNo ||
      existing.paymentReference !== (input.paymentReference ?? null) ||
      existing.providerTransactionId !== (input.providerTransactionId ?? null) ||
      existing.totalAmount !== normalizedAmount
    ) {
      throw new Error('MODULE_APP_PAYMENT_EVENT_CONFLICT');
    }
    return { duplicate: true, event: existing };
  };

  updatePaymentEvent = async (input: {
    errorCode?: string;
    eventId: string;
    eventStatus: 'received' | 'processed' | 'ignored' | 'rejected';
    orderId?: string;
    processedAt?: Date;
    provider: 'alipay';
  }) => {
    const [event] = await this.db
      .update(moduleAppPaymentEvents)
      .set({
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
        eventStatus: input.eventStatus,
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.processedAt ? { processedAt: input.processedAt } : {}),
      })
      .where(
        and(
          eq(moduleAppPaymentEvents.provider, input.provider),
          eq(moduleAppPaymentEvents.providerEventId, input.eventId),
        ),
      )
      .returning();
    if (!event) throw new Error('MODULE_APP_PAYMENT_EVENT_NOT_FOUND');
    return event;
  };

  createRefund = async (input: {
    currency: string;
    orderId: string;
    provider: 'alipay';
    providerRefundId: string;
    reason: string;
    refundAmount: string;
    status: 'requested' | 'succeeded' | 'failed';
  }) => {
    const [refund] = await this.db
      .insert(moduleAppPaymentRefunds)
      .values(input)
      .onConflictDoNothing({
        target: [moduleAppPaymentRefunds.provider, moduleAppPaymentRefunds.providerRefundId],
      })
      .returning();
    if (refund) return { duplicate: false, refund };
    const existing = await this.db.query.moduleAppPaymentRefunds.findFirst({
      where: and(
        eq(moduleAppPaymentRefunds.provider, input.provider),
        eq(moduleAppPaymentRefunds.providerRefundId, input.providerRefundId),
      ),
    });
    if (!existing) throw new Error('MODULE_APP_PAYMENT_REFUND_NOT_FOUND');
    return { duplicate: true, refund: existing };
  };

  getRefundByOrderId = (orderId: string) =>
    this.db.query.moduleAppPaymentRefunds.findFirst({
      orderBy: (refunds, { desc }) => [desc(refunds.createdAt)],
      where: eq(moduleAppPaymentRefunds.orderId, orderId),
    });

  createDiscrepancy = async (input: {
    actualAmount?: string;
    actualCurrency?: string;
    details?: Record<string, unknown>;
    discrepancyKey: string;
    expectedAmount?: string;
    expectedCurrency?: string;
    kind:
      | 'amount_mismatch'
      | 'currency_mismatch'
      | 'order_not_found'
      | 'provider_mismatch'
      | 'settlement_failed';
    orderId?: string;
    outTradeNo: string;
    provider: 'alipay';
  }) => {
    const [discrepancy] = await this.db
      .insert(moduleAppPaymentDiscrepancies)
      .values(input)
      .onConflictDoNothing({
        target: [
          moduleAppPaymentDiscrepancies.provider,
          moduleAppPaymentDiscrepancies.discrepancyKey,
        ],
      })
      .returning();
    if (discrepancy) return discrepancy;
    const existing = await this.db.query.moduleAppPaymentDiscrepancies.findFirst({
      where: and(
        eq(moduleAppPaymentDiscrepancies.provider, input.provider),
        eq(moduleAppPaymentDiscrepancies.discrepancyKey, input.discrepancyKey),
      ),
    });
    if (!existing) throw new Error('MODULE_APP_PAYMENT_DISCREPANCY_NOT_FOUND');
    return existing;
  };
}
