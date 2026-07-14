// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppInstallations,
  moduleAppLicenses,
  moduleAppOrders,
  moduleAppPrices,
  moduleAppProducts,
  moduleApps,
  moduleAppSubscriptions,
  moduleAppVersions,
  users,
  workspaces,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppCommerceModel } from '../moduleAppCommerce';

const APP_ID = '10000000-0000-4000-8000-000000000001';
const USER_ID = 'module-app-commerce-user';
const OTHER_USER_ID = 'module-app-commerce-other-user';
const WORKSPACE_ID = 'module-app-commerce-workspace';
const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  await serverDB.delete(moduleAppSubscriptions);
  await serverDB.delete(moduleAppInstallations);
  await serverDB.delete(moduleAppLicenses);
  await serverDB.delete(moduleAppOrders);
  await serverDB.delete(moduleAppPrices);
  await serverDB.delete(moduleAppProducts);
  await serverDB.delete(moduleApps);
  await serverDB.delete(workspaces);
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: USER_ID }, { id: OTHER_USER_ID }]);
  await serverDB.insert(workspaces).values({
    id: WORKSPACE_ID,
    name: 'Commerce workspace',
    primaryOwnerId: USER_ID,
    slug: WORKSPACE_ID,
  });
  await serverDB.insert(moduleApps).values({
    appType: 'standard_app',
    category: 'productivity',
    description: 'Commerce test app',
    displayName: 'Commerce test app',
    icon: '📦',
    id: APP_ID,
    slug: 'commerce-test-app',
    status: 'published',
  });
  await serverDB.insert(moduleAppVersions).values({
    appId: APP_ID,
    publishedAt: new Date('2026-07-14T00:00:00.000Z'),
    version: '1.0.0',
  });
});

describe('ModuleAppCommerceModel', () => {
  it('creates a pending order, settles it once, and revokes its license on refund', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'pro-lifetime',
      productType: 'one_time',
    });

    const order = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });
    expect(order.status).toBe('pending');
    expect(order.snapshot).toMatchObject({ currency: 'CNY', price: 120, productType: 'one_time' });

    const paid = await model.settleOrder({
      orderId: order.id,
      paymentReference: 'manual:admin:1',
    });
    const replay = await model.settleOrder({
      orderId: order.id,
      paymentReference: 'manual:admin:1',
    });
    expect(replay.id).toBe(paid.id);
    expect(await model.resolveLicense({ appId: APP_ID, userId: USER_ID })).toMatchObject({
      orderId: paid.id,
      status: 'active',
    });
    await expect(
      serverDB.query.moduleAppInstallations.findFirst({
        where: eq(moduleAppInstallations.appId, APP_ID),
      }),
    ).resolves.toMatchObject({
      scopeType: 'personal',
      status: 'installed',
      userId: USER_ID,
    });
    await expect(
      model.resolveEntitlementContext({ appId: APP_ID, userId: USER_ID }),
    ).resolves.toMatchObject({
      license: { orderId: paid.id, source: 'purchase', status: 'active' },
      productType: 'one_time',
    });

    await model.refundOrder({ actorUserId: 'admin-1', orderId: order.id, reason: 'requested' });
    await expect(model.resolveLicense({ appId: APP_ID, userId: USER_ID })).resolves.toBeNull();
  });

  it('lists only the purchaser orders and resolves only the matching owner license', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'personal-isolation',
      productType: 'one_time',
    });
    const ownOrder = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });
    await model.createOrder({ productId: product.id, purchaserUserId: OTHER_USER_ID });
    await model.settleOrder({ orderId: ownOrder.id, paymentReference: 'manual:isolation:1' });

    await expect(model.listOrders({ purchaserUserId: USER_ID })).resolves.toEqual([
      expect.objectContaining({ id: ownOrder.id, purchaserUserId: USER_ID }),
    ]);
    await expect(
      model.resolveLicense({ appId: APP_ID, userId: OTHER_USER_ID }),
    ).resolves.toBeNull();
  });

  it('creates one license when the same payment settlement races', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'concurrent-settlement',
      productType: 'one_time',
    });
    const order = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });

    await Promise.all([
      model.settleOrder({ orderId: order.id, paymentReference: 'manual:race:1' }),
      model.settleOrder({ orderId: order.id, paymentReference: 'manual:race:1' }),
    ]);

    await expect(
      serverDB.query.moduleAppLicenses.findMany({
        where: eq(moduleAppLicenses.orderId, order.id),
      }),
    ).resolves.toHaveLength(1);
  });

  it('settles different concurrent orders without racing installation creation', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'concurrent-orders',
      productType: 'one_time',
    });
    const first = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });
    const second = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });

    await Promise.all([
      model.settleOrder({ orderId: first.id, paymentReference: 'manual:orders:1' }),
      model.settleOrder({ orderId: second.id, paymentReference: 'manual:orders:2' }),
    ]);

    await expect(
      serverDB.query.moduleAppLicenses.findMany({
        where: eq(moduleAppLicenses.appId, APP_ID),
      }),
    ).resolves.toHaveLength(2);
    await expect(
      serverDB.query.moduleAppInstallations.findMany({
        where: eq(moduleAppInstallations.appId, APP_ID),
      }),
    ).resolves.toHaveLength(1);
  });

  it('keeps payment settlement replay idempotent for an active installation', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'idempotent-installation',
      productType: 'one_time',
    });
    const order = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });
    await model.settleOrder({ orderId: order.id, paymentReference: 'manual:idempotent:1' });
    const installed = await serverDB.query.moduleAppInstallations.findFirst({
      where: eq(moduleAppInstallations.appId, APP_ID),
    });
    const [newVersion] = await serverDB
      .insert(moduleAppVersions)
      .values({ appId: APP_ID, version: '2.0.0' })
      .returning();

    await model.settleOrder({ orderId: order.id, paymentReference: 'manual:idempotent:1' });

    await expect(
      serverDB.query.moduleAppInstallations.findFirst({
        where: eq(moduleAppInstallations.appId, APP_ID),
      }),
    ).resolves.toMatchObject({ installedAt: installed?.installedAt, versionId: installed?.versionId });
    expect(installed?.versionId).not.toBe(newVersion.id);
  });

  it('prefers an older active license over a newer expired license', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const activeProduct = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'active-entitlement',
      productType: 'one_time',
    });
    const expiredProduct = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 10, billingPeriod: 'monthly', currency: 'CNY' },
      productKey: 'expired-entitlement',
      productType: 'subscription',
    });
    const activeOrder = await model.createOrder({
      productId: activeProduct.id,
      purchaserUserId: USER_ID,
    });
    const expiredOrder = await model.createOrder({
      productId: expiredProduct.id,
      purchaserUserId: USER_ID,
    });
    await model.settleOrder({ orderId: activeOrder.id, paymentReference: 'manual:active:1' });
    await model.settleOrder({ orderId: expiredOrder.id, paymentReference: 'manual:expired:1' });
    await serverDB
      .update(moduleAppLicenses)
      .set({
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        endsAt: new Date('2020-01-01T00:00:00.000Z'),
        status: 'expired',
      })
      .where(eq(moduleAppLicenses.orderId, expiredOrder.id));

    await expect(
      model.resolveEntitlementContext({ appId: APP_ID, userId: USER_ID }),
    ).resolves.toMatchObject({
      license: { orderId: activeOrder.id, status: 'active' },
      productType: 'one_time',
    });
  });

  it('rejects refunds for pending orders', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY' },
      productKey: 'pending-refund',
      productType: 'one_time',
    });
    const order = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });

    await expect(
      model.refundOrder({ actorUserId: 'admin-1', orderId: order.id, reason: 'invalid' }),
    ).rejects.toThrow('MODULE_APP_ORDER_NOT_REFUNDABLE');
  });

  it('quotes active server catalog prices without accepting a client amount', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 88, currency: 'CNY' },
      productKey: 'catalog-quote',
      productType: 'one_time',
    });

    await expect(model.listCatalog({ appId: APP_ID })).resolves.toEqual([
      expect.objectContaining({ amount: 88, currency: 'CNY', productId: product.id }),
    ]);
    await expect(model.quoteProduct({ productId: product.id })).resolves.toMatchObject({
      currency: 'CNY',
      price: 88,
      productType: 'one_time',
    });
  });

  it('updates product metadata and replaces the active price without rewriting history', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 88, currency: 'CNY' },
      productKey: 'managed-price',
      productType: 'one_time',
    });

    await model.updateProduct({
      licenseScope: 'personal',
      price: { amount: 120, currency: 'CNY', promotion: { title: 'Launch' } },
      productId: product.id,
      productType: 'one_time',
      status: 'active',
    });

    await expect(model.listProducts({ appId: APP_ID })).resolves.toEqual([
      expect.objectContaining({
        amount: 120,
        currency: 'CNY',
        productId: product.id,
        promotion: { title: 'Launch' },
      }),
    ]);
    const prices = await serverDB.query.moduleAppPrices.findMany({
      where: eq(moduleAppPrices.productId, product.id),
    });
    expect(prices).toHaveLength(2);
    expect(prices.filter((price) => price.active)).toHaveLength(1);
    expect(prices.find((price) => !price.active)?.amount).toBe(88);
  });

  it('allows only the purchaser to cancel a pending order', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 88, currency: 'CNY' },
      productKey: 'cancel-pending',
      productType: 'one_time',
    });
    const order = await model.createOrder({ productId: product.id, purchaserUserId: USER_ID });

    await expect(
      model.cancelOrder({ orderId: order.id, purchaserUserId: OTHER_USER_ID }),
    ).rejects.toThrow('MODULE_APP_ORDER_NOT_FOUND');
    await expect(
      model.cancelOrder({ orderId: order.id, purchaserUserId: USER_ID }),
    ).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('does not sell an active product after its application is unpublished', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'personal',
      price: { amount: 88, currency: 'CNY' },
      productKey: 'unpublished-product',
      productType: 'one_time',
    });
    await serverDB.update(moduleApps).set({ status: 'unpublished' }).where(eq(moduleApps.id, APP_ID));

    await expect(model.listCatalog({ appId: APP_ID })).resolves.toEqual([]);
    await expect(model.quoteProduct({ productId: product.id })).rejects.toThrow(
      'MODULE_APP_PRODUCT_NOT_PURCHASABLE',
    );
    await expect(
      model.createOrder({ productId: product.id, purchaserUserId: USER_ID }),
    ).rejects.toThrow('MODULE_APP_PRODUCT_NOT_PURCHASABLE');
  });

  it('settles a yearly workspace subscription into a workspace license and period', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'workspace',
      price: { amount: 1200, billingPeriod: 'yearly', currency: 'CNY', trialDays: 7 },
      productKey: 'workspace-yearly',
      productType: 'subscription',
    });
    await expect(
      model.createOrder({ productId: product.id, purchaserUserId: USER_ID }),
    ).rejects.toThrow('MODULE_APP_WORKSPACE_REQUIRED');

    const order = await model.createOrder({
      productId: product.id,
      purchaserUserId: USER_ID,
      workspaceId: WORKSPACE_ID,
    });
    await model.settleOrder({ orderId: order.id, paymentReference: 'manual:workspace:1' });

    await expect(
      model.resolveLicense({ appId: APP_ID, workspaceId: WORKSPACE_ID }),
    ).resolves.toMatchObject({ ownerUserId: null, status: 'active', workspaceId: WORKSPACE_ID });
    await expect(
      serverDB.query.moduleAppInstallations.findFirst({
        where: eq(moduleAppInstallations.appId, APP_ID),
      }),
    ).resolves.toMatchObject({
      scopeType: 'workspace',
      status: 'installed',
      workspaceId: WORKSPACE_ID,
    });
    await expect(serverDB.query.moduleAppSubscriptions.findFirst()).resolves.toMatchObject({
      cancelAtPeriodEnd: false,
      status: 'trialing',
    });
  });

  it('freezes promotion, seats, multipliers, revenue share, and terms in the order snapshot', async () => {
    const model = new ModuleAppCommerceModel(serverDB);
    const product = await model.createProduct({
      appId: APP_ID,
      licenseScope: 'workspace_seat',
      moduleMultiplier: '1.3500',
      price: {
        amount: 999,
        billingPeriod: 'yearly',
        currency: 'CNY',
        promotion: { discountAmount: 100, discountPercent: 10, title: 'Launch' },
      },
      productKey: 'immutable-snapshot',
      productType: 'subscription',
      revenueShareRate: '0.2000',
      seatCount: 12,
      termsVersion: '2026-07',
    });
    const order = await model.createOrder({
      productId: product.id,
      purchaserUserId: USER_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(order.snapshot).toMatchObject({
      moduleMultiplier: '1.3500',
      promotion: { discountAmount: 100, discountPercent: 10, title: 'Launch' },
      revenueShareRate: '0.2000',
      seatCount: 12,
      termsVersion: '2026-07',
    });
  });
});
