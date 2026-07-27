import type { PaymentMethodId, PaymentProvider } from '@lobechat/types';
import { and, eq } from 'drizzle-orm';

import { ModuleAppPaymentService } from '@/business/server/module-apps/payments/service';
import { moduleAppPaymentAttempts, topUpOrders } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { createOperationalPaymentConfig, getServerPaymentConfig } from './config';
import { createPaymentAdapter } from './factory';
import { TopUpPaymentService } from './topUpPayment';

const resolveNotificationMethod = (provider: PaymentProvider, body: string): PaymentMethodId => {
  if (provider === 'alipay') return 'alipay';
  if (provider === 'wechat_pay') return 'wechat_pay';
  const type = new URLSearchParams(body).get('type');
  if (type === 'alipay') return 'zpay_alipay';
  if (type === 'wxpay') return 'zpay_wechat';
  throw new Error('ZPAY_NOTIFICATION_METHOD_INVALID');
};

export const handlePaymentWebhook = async (input: {
  body: string;
  db: LobeChatDatabase;
  headers: Record<string, string>;
  provider: PaymentProvider;
}) => {
  const config = await getServerPaymentConfig(input.db);
  const method = resolveNotificationMethod(input.provider, input.body);
  const operationalConfig = createOperationalPaymentConfig(config);
  const adapter = createPaymentAdapter(operationalConfig, method);
  const event = await adapter.verifyNotification({ body: input.body, headers: input.headers });
  if (!event) throw new Error('PAYMENT_NOTIFICATION_INVALID');
  if (event.provider !== input.provider) throw new Error('PAYMENT_PROVIDER_MISMATCH');

  const [moduleAttempt, topUpOrder] = await Promise.all([
    input.db.query.moduleAppPaymentAttempts.findFirst({
      columns: { id: true, method: true },
      where: and(
        eq(moduleAppPaymentAttempts.provider, event.provider),
        eq(moduleAppPaymentAttempts.outTradeNo, event.outTradeNo),
      ),
    }),
    input.db.query.topUpOrders.findFirst({
      columns: { id: true },
      where: and(
        eq(topUpOrders.provider, event.provider),
        eq(topUpOrders.externalOrderId, event.outTradeNo),
      ),
    }),
  ]);
  if (moduleAttempt) {
    if (moduleAttempt.method !== method) throw new Error('PAYMENT_METHOD_MISMATCH');
    return new ModuleAppPaymentService(input.db, adapter).handleNormalizedEvent(event);
  }
  if (topUpOrder) {
    return new TopUpPaymentService(input.db).handleNormalizedEvent(event, method);
  }
  throw new Error('PAYMENT_ORDER_NOT_FOUND');
};
