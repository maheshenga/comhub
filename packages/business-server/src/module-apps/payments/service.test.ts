// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { ModuleAppCommerceModel } from '@/database/models/moduleAppCommerce';
import {
  moduleAppAuditLogs,
  moduleAppLicenses,
  moduleAppOrders,
  moduleAppPaymentAttempts,
  moduleAppPaymentDiscrepancies,
  moduleAppPaymentEvents,
  moduleAppPaymentRefunds,
  moduleAppPrices,
  moduleAppProducts,
  moduleAppRevenueEntries,
  moduleApps,
  moduleAppSubscriptions,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import type { ModuleAppPaymentAdapter } from './contracts';
import { ModuleAppPaymentService } from './service';

const APP_ID = '20000000-0000-4000-8000-000000000001';
const USER_ID = 'module-app-payment-user';
const serverDB: LobeChatDatabase = await getTestDB();

const createAdapter = (): ModuleAppPaymentAdapter => ({
  create: vi.fn(async ({ orderId }) => ({
    body: `<form data-order="${orderId}"></form>`,
    outTradeNo: `out-${orderId}`,
  })),
  query: vi.fn(),
  refund: vi.fn(async () => ({ providerRefundId: 'refund-1', status: 'succeeded' })),
  verifyNotification: vi.fn(),
});

beforeEach(async () => {
  await serverDB.delete(moduleAppPaymentDiscrepancies);
  await serverDB.delete(moduleAppPaymentRefunds);
  await serverDB.delete(moduleAppPaymentEvents);
  await serverDB.delete(moduleAppPaymentAttempts);
  await serverDB.delete(moduleAppSubscriptions);
  await serverDB.delete(moduleAppLicenses);
  await serverDB.delete(moduleAppRevenueEntries);
  await serverDB.delete(moduleAppAuditLogs);
  await serverDB.delete(moduleAppOrders);
  await serverDB.delete(moduleAppPrices);
  await serverDB.delete(moduleAppProducts);
  await serverDB.delete(moduleApps);
  await serverDB.delete(users);
  await serverDB.insert(users).values({ id: USER_ID });
  await serverDB.insert(moduleApps).values({
    appType: 'standard_app',
    category: 'commerce',
    description: 'Payment test app',
    displayName: 'Payment test app',
    icon: 'CreditCard',
    id: APP_ID,
    slug: `payment-test-${crypto.randomUUID()}`,
    status: 'published',
  });
});

const createPendingOrder = async () => {
  const commerce = new ModuleAppCommerceModel(serverDB);
  const product = await commerce.createProduct({
    appId: APP_ID,
    licenseScope: 'personal',
    price: { amount: 1234, currency: 'CNY' },
    productKey: `payment-${crypto.randomUUID()}`,
    productType: 'one_time',
  });
  return commerce.createOrder({ productId: product.id, purchaserUserId: USER_ID });
};

describe('ModuleAppPaymentService', () => {
  it('uses the server order snapshot and settles a verified event once', async () => {
    const adapter = createAdapter();
    const service = new ModuleAppPaymentService(serverDB, adapter);
    const order = await createPendingOrder();
    const payment = await service.createPayment({
      notifyUrl: 'https://app.example.com/notify',
      orderId: order.id,
      returnUrl: 'https://app.example.com/return',
      subject: 'Payment test',
    });
    expect(adapter.create).toHaveBeenCalledWith(expect.objectContaining({
      orderId: order.id,
      totalAmount: '1234.000000',
    }));

    (adapter.verifyNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
      currency: 'CNY',
      eventId: 'notify-1',
      eventType: 'payment_succeeded',
      occurredAt: new Date(),
      outTradeNo: payment.outTradeNo,
      provider: 'alipay',
      providerTransactionId: 'trade-1',
      totalAmount: '1234.000000',
    });
    await expect(service.handleNotification({ body: 'signed', headers: {} })).resolves.toMatchObject({ duplicate: false, status: 'paid' });
    await expect(service.handleNotification({ body: 'signed', headers: {} })).resolves.toMatchObject({ duplicate: true, status: 'paid' });
  });

  it('records an amount discrepancy without settling the order', async () => {
    const adapter = createAdapter();
    const service = new ModuleAppPaymentService(serverDB, adapter);
    const order = await createPendingOrder();
    const payment = await service.createPayment({
      notifyUrl: 'https://app.example.com/notify',
      orderId: order.id,
      returnUrl: 'https://app.example.com/return',
      subject: 'Payment test',
    });
    (adapter.verifyNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
      currency: 'CNY',
      eventId: 'notify-mismatch',
      eventType: 'payment_succeeded',
      occurredAt: new Date(),
      outTradeNo: payment.outTradeNo,
      provider: 'alipay',
      totalAmount: '99.000000',
    });

    await expect(service.handleNotification({ body: 'signed', headers: {} })).rejects.toThrow('MODULE_APP_PAYMENT_AMOUNT_MISMATCH');
    await expect(serverDB.query.moduleAppPaymentDiscrepancies.findMany()).resolves.toHaveLength(1);
    await expect(serverDB.query.moduleAppOrders.findFirst()).resolves.toMatchObject({ status: 'pending' });
  });

  it('rejects a provider order id that does not match the server attempt', async () => {
    const adapter = createAdapter();
    const service = new ModuleAppPaymentService(serverDB, adapter);
    const order = await createPendingOrder();
    const payment = await service.createPayment({
      notifyUrl: 'https://app.example.com/notify',
      orderId: order.id,
      returnUrl: 'https://app.example.com/return',
      subject: 'Payment test',
    });
    (adapter.verifyNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
      currency: 'CNY',
      eventId: 'notify-provider-mismatch',
      eventType: 'payment_succeeded',
      occurredAt: new Date(),
      orderId: '40000000-0000-4000-8000-000000000001',
      outTradeNo: payment.outTradeNo,
      provider: 'alipay',
      totalAmount: '1234.000000',
    });

    await expect(service.handleNotification({ body: 'signed', headers: {} })).rejects.toThrow(
      'MODULE_APP_PAYMENT_PROVIDER_MISMATCH',
    );
    await expect(serverDB.query.moduleAppPaymentDiscrepancies.findMany()).resolves.toHaveLength(1);
  });

  it('settles concurrent verified notifications into one license', async () => {
    const adapter = createAdapter();
    const service = new ModuleAppPaymentService(serverDB, adapter);
    const order = await createPendingOrder();
    const payment = await service.createPayment({
      notifyUrl: 'https://app.example.com/notify',
      orderId: order.id,
      returnUrl: 'https://app.example.com/return',
      subject: 'Payment test',
    });
    const event = {
      currency: 'CNY',
      eventType: 'payment_succeeded' as const,
      occurredAt: new Date(),
      outTradeNo: payment.outTradeNo,
      provider: 'alipay' as const,
      providerTransactionId: 'trade-concurrent',
      totalAmount: '1234.000000',
    };
    (adapter.verifyNotification as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...event, eventId: 'notify-concurrent-1' })
      .mockResolvedValueOnce({ ...event, eventId: 'notify-concurrent-2' });

    await expect(Promise.all([
      service.handleNotification({ body: 'signed-1', headers: {} }),
      service.handleNotification({ body: 'signed-2', headers: {} }),
    ])).resolves.toHaveLength(2);
    await expect(serverDB.query.moduleAppLicenses.findMany()).resolves.toHaveLength(1);
  });

  it('does not call the provider twice for a replayed refund', async () => {
    const adapter = createAdapter();
    const service = new ModuleAppPaymentService(serverDB, adapter);
    const order = await createPendingOrder();
    const payment = await service.createPayment({
      notifyUrl: 'https://app.example.com/notify',
      orderId: order.id,
      returnUrl: 'https://app.example.com/return',
      subject: 'Payment test',
    });
    (adapter.verifyNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
      currency: 'CNY',
      eventId: 'notify-refund',
      eventType: 'payment_succeeded',
      occurredAt: new Date(),
      outTradeNo: payment.outTradeNo,
      provider: 'alipay',
      providerTransactionId: 'trade-refund',
      totalAmount: '1234.000000',
    });
    await service.handleNotification({ body: 'signed', headers: {} });
    await expect(service.refundOrder({ orderId: order.id, reason: 'customer request' })).resolves.toMatchObject({ status: 'refunded' });
    await expect(service.refundOrder({ orderId: order.id, reason: 'customer request' })).resolves.toMatchObject({ status: 'refunded' });
    expect(adapter.refund).toHaveBeenCalledOnce();
  });
});
