import {
  moduleAppNormalizedPaymentEventSchema,
  type PaymentMethodId,
  paymentMethodIdSchema,
  type PaymentProvider,
  paymentProviderSchema,
} from '@lobechat/types';
import { and, eq } from 'drizzle-orm';

import type { ModuleAppPaymentAdapter } from '@/business/server/module-apps/payments/contracts';
import { CommercialModel } from '@/database/models/commercial';
import { topUpOrders } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export class TopUpPaymentService {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly adapterResolver?: (
      provider: PaymentProvider,
      method: PaymentMethodId,
    ) => ModuleAppPaymentAdapter | Promise<ModuleAppPaymentAdapter>,
  ) {}

  private resolveAdapter = async (provider: PaymentProvider, method: PaymentMethodId) => {
    if (!this.adapterResolver) throw new Error('TOP_UP_PAYMENT_ADAPTER_RESOLVER_REQUIRED');
    const adapter = await this.adapterResolver(provider, method);
    if (adapter.provider !== provider || adapter.method !== method) {
      throw new Error('TOP_UP_PAYMENT_ADAPTER_MISMATCH');
    }
    return adapter;
  };

  reconcilePayment = async (input: { idempotencyKey: string; userId: string }) => {
    const commercial = new CommercialModel(this.db, input.userId);
    const order = await commercial.getOnlineTopUpOrderByIdempotencyKey(input.idempotencyKey);
    if (!order) throw new Error('TOP_UP_PAYMENT_ORDER_NOT_FOUND');

    const method = paymentMethodIdSchema.safeParse(order.metadata?.method);
    const provider = paymentProviderSchema.safeParse(order.provider);
    if (!method.success || !provider.success || !order.externalOrderId) {
      throw new Error('TOP_UP_PAYMENT_ORDER_INVALID');
    }

    const adapter = await this.resolveAdapter(provider.data, method.data);
    const event = await adapter.query({ outTradeNo: order.externalOrderId });
    if (event) await this.handleNormalizedEvent(event, method.data);

    const current = event
      ? await commercial.getOnlineTopUpOrderByIdempotencyKey(input.idempotencyKey)
      : order;
    if (!current) throw new Error('TOP_UP_PAYMENT_ORDER_NOT_FOUND');

    return {
      checkout: current.checkout ?? null,
      orderId: current.id,
      providerStatus: event?.eventType ?? ('pending' as const),
      recoveryRequired: current.status === 'pending' && !current.checkout,
      status: current.status,
    };
  };

  handleNormalizedEvent = async (input: unknown, method: PaymentMethodId) => {
    const event = moduleAppNormalizedPaymentEventSchema.parse(input);
    const order = await this.db.query.topUpOrders.findFirst({
      where: and(
        eq(topUpOrders.provider, event.provider),
        eq(topUpOrders.externalOrderId, event.outTradeNo),
      ),
    });
    if (!order) throw new Error('TOP_UP_PAYMENT_ORDER_NOT_FOUND');
    if (order.metadata?.method !== method) throw new Error('TOP_UP_PAYMENT_METHOD_MISMATCH');
    if (event.eventType === 'refund_succeeded') {
      throw new Error('TOP_UP_PAYMENT_EVENT_UNSUPPORTED');
    }
    if (
      order.currency !== event.currency ||
      Number(order.amount).toFixed(6) !== Number(event.totalAmount).toFixed(6)
    ) {
      throw new Error('TOP_UP_PAYMENT_VERIFICATION_FAILED');
    }
    if (event.eventType === 'payment_failed') {
      if (order.status === 'paid') return { duplicate: true, status: order.status };
      const [updated] = await this.db
        .update(topUpOrders)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(and(eq(topUpOrders.id, order.id), eq(topUpOrders.status, 'pending')))
        .returning({ status: topUpOrders.status });
      return { duplicate: !updated, status: updated?.status ?? order.status };
    }
    const settled = await new CommercialModel(this.db, order.userId).settleOnlineTopUpOrder({
      amount: event.totalAmount,
      currency: event.currency,
      externalOrderId: event.outTradeNo,
      method,
      orderId: order.id,
      paymentReference: event.paymentReference ?? event.providerTransactionId,
      provider: event.provider,
    });
    return { duplicate: order.status === 'paid', status: settled.status };
  };
}
