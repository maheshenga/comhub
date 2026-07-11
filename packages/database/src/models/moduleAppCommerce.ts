import { and, desc, eq, isNull } from 'drizzle-orm';

import { moduleAppLicenses, moduleAppOrders, moduleAppPrices, moduleAppProducts, moduleApps } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class ModuleAppCommerceModel {
  constructor(private readonly db: LobeChatDatabase) {}

  createProduct = async (input: {
    appId: string;
    licenseScope: string;
    price: { amount: number; billingPeriod?: string; currency: string; trialDays?: number };
    productKey: string;
    productType: string;
  }) =>
    this.db.transaction(async (tx) => {
      const [product] = await tx.insert(moduleAppProducts).values({
        appId: input.appId,
        licenseScope: input.licenseScope,
        productKey: input.productKey,
        productType: input.productType,
      }).returning();
      if (!product) throw new Error('MODULE_APP_PRODUCT_CREATE_FAILED');
      await tx.insert(moduleAppPrices).values({
        active: true,
        amount: input.price.amount,
        billingPeriod: input.price.billingPeriod,
        currency: input.price.currency,
        productId: product.id,
        trialDays: input.price.trialDays ?? 0,
      });
      return product;
    });

  createOrder = async ({ productId, purchaserUserId }: { productId: string; purchaserUserId: string }) =>
    this.db.transaction(async (tx) => {
      const product = await tx.query.moduleAppProducts.findFirst({ where: and(eq(moduleAppProducts.id, productId), eq(moduleAppProducts.status, 'active')) });
      const price = await tx.query.moduleAppPrices.findFirst({ where: and(eq(moduleAppPrices.productId, productId), eq(moduleAppPrices.active, true)) });
      const app = product ? await tx.query.moduleApps.findFirst({ where: and(eq(moduleApps.id, product.appId), eq(moduleApps.status, 'published')) }) : null;
      if (!product || !price || !app) throw new Error('MODULE_APP_PRODUCT_NOT_PURCHASABLE');
      const [order] = await tx.insert(moduleAppOrders).values({
        appId: product.appId,
        priceId: price.id,
        productId,
        purchaserUserId,
        snapshot: { billingPeriod: price.billingPeriod, currency: price.currency, licenseScope: product.licenseScope, price: price.amount, productType: product.productType },
      }).returning();
      if (!order) throw new Error('MODULE_APP_ORDER_CREATE_FAILED');
      return order;
    });

  cancelOrder = async ({ orderId, purchaserUserId }: { orderId: string; purchaserUserId: string }) =>
    this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(moduleAppOrders).where(and(eq(moduleAppOrders.id, orderId), eq(moduleAppOrders.purchaserUserId, purchaserUserId))).for('update');
      if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
      if (order.status === 'cancelled') return order;
      if (order.status !== 'pending') throw new Error('MODULE_APP_ORDER_NOT_CANCELLABLE');
      const now = new Date();
      const [cancelled] = await tx.update(moduleAppOrders).set({ cancelledAt: now, status: 'cancelled', updatedAt: now }).where(eq(moduleAppOrders.id, order.id)).returning();
      if (!cancelled) throw new Error('MODULE_APP_ORDER_CANCEL_FAILED');
      return cancelled;
    });

  listCatalog = async ({ appId }: { appId?: string } = {}) =>
    this.db.select({
      amount: moduleAppPrices.amount,
      appId: moduleAppProducts.appId,
      billingPeriod: moduleAppPrices.billingPeriod,
      currency: moduleAppPrices.currency,
      licenseScope: moduleAppProducts.licenseScope,
      productId: moduleAppProducts.id,
      productKey: moduleAppProducts.productKey,
      productType: moduleAppProducts.productType,
      promotion: moduleAppPrices.promotion,
      trialDays: moduleAppPrices.trialDays,
    }).from(moduleAppProducts).innerJoin(moduleAppPrices, eq(moduleAppPrices.productId, moduleAppProducts.id)).innerJoin(moduleApps, eq(moduleApps.id, moduleAppProducts.appId)).where(and(eq(moduleApps.status, 'published'), eq(moduleAppProducts.status, 'active'), eq(moduleAppPrices.active, true), appId ? eq(moduleAppProducts.appId, appId) : undefined));

  listOrders = async ({
    limit = 50,
    purchaserUserId,
  }: {
    limit?: number;
    purchaserUserId: string;
  }) =>
    this.db.query.moduleAppOrders.findMany({
      limit: Math.max(1, Math.min(100, Math.floor(limit))),
      orderBy: desc(moduleAppOrders.createdAt),
      where: eq(moduleAppOrders.purchaserUserId, purchaserUserId),
    });

  quoteProduct = async ({ productId }: { productId: string }) => {
    const product = await this.db.query.moduleAppProducts.findFirst({ where: and(eq(moduleAppProducts.id, productId), eq(moduleAppProducts.status, 'active')) });
    const price = await this.db.query.moduleAppPrices.findFirst({ where: and(eq(moduleAppPrices.productId, productId), eq(moduleAppPrices.active, true)) });
    const app = product ? await this.db.query.moduleApps.findFirst({ where: and(eq(moduleApps.id, product.appId), eq(moduleApps.status, 'published')) }) : null;
    if (!product || !price || !app) throw new Error('MODULE_APP_PRODUCT_NOT_PURCHASABLE');
    return {
      billingPeriod: price.billingPeriod,
      currency: price.currency,
      licenseScope: product.licenseScope,
      price: price.amount,
      productType: product.productType,
      promotion: price.promotion,
      trialDays: price.trialDays,
    };
  };

  settleOrder = async ({ orderId, paymentReference }: { orderId: string; paymentReference: string }) =>
    this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(moduleAppOrders).where(eq(moduleAppOrders.id, orderId)).for('update');
      if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
      if (order.status === 'paid') {
        if (order.paymentReference !== paymentReference) throw new Error('MODULE_APP_ORDER_PAYMENT_CONFLICT');
        return order;
      }
      if (order.status !== 'pending') throw new Error('MODULE_APP_ORDER_NOT_SETTLEABLE');
      const now = new Date();
      const [paid] = await tx.update(moduleAppOrders).set({ paidAt: now, paymentReference, status: 'paid', updatedAt: now }).where(eq(moduleAppOrders.id, orderId)).returning();
      if (!paid) throw new Error('MODULE_APP_ORDER_SETTLEMENT_FAILED');
      await tx.insert(moduleAppLicenses).values({ appId: paid.appId, licenseScope: String(paid.snapshot.licenseScope), orderId: paid.id, ownerUserId: paid.purchaserUserId });
      return paid;
    });

  resolveLicense = async ({ appId, userId }: { appId: string; userId: string }) =>
    (await this.db.query.moduleAppLicenses.findFirst({ where: and(eq(moduleAppLicenses.appId, appId), eq(moduleAppLicenses.ownerUserId, userId), eq(moduleAppLicenses.status, 'active'), isNull(moduleAppLicenses.revokedAt), isNull(moduleAppLicenses.endsAt)) })) ?? null;

  refundOrder = async ({ actorUserId, orderId, reason }: { actorUserId: string; orderId: string; reason: string }) =>
    this.db.transaction(async (tx) => {
      if (!actorUserId.trim() || !reason.trim()) throw new Error('MODULE_APP_REFUND_AUDIT_REQUIRED');
      const [existing] = await tx.select().from(moduleAppOrders).where(eq(moduleAppOrders.id, orderId)).for('update');
      if (!existing) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
      if (existing.status === 'refunded') return existing;
      if (existing.status !== 'paid') throw new Error('MODULE_APP_ORDER_NOT_REFUNDABLE');
      const now = new Date();
      const [order] = await tx.update(moduleAppOrders).set({ refundedAt: now, status: 'refunded', updatedAt: now }).where(eq(moduleAppOrders.id, orderId)).returning();
      if (!order) throw new Error('MODULE_APP_ORDER_NOT_FOUND');
      await tx.update(moduleAppLicenses).set({ revokedAt: now, status: 'revoked', updatedAt: now }).where(eq(moduleAppLicenses.orderId, orderId));
      return order;
    });
}
