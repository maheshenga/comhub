// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppLicenses,
  moduleAppOrders,
  moduleAppPrices,
  moduleAppProducts,
  moduleApps,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppCommerceModel } from '../moduleAppCommerce';

const APP_ID = '10000000-0000-4000-8000-000000000001';
const USER_ID = 'module-app-commerce-user';
const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  await serverDB.delete(moduleAppLicenses);
  await serverDB.delete(moduleAppOrders);
  await serverDB.delete(moduleAppPrices);
  await serverDB.delete(moduleAppProducts);
  await serverDB.delete(moduleApps);
  await serverDB.delete(users);
  await serverDB.insert(users).values({ id: USER_ID });
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

    await model.refundOrder({ actorUserId: 'admin-1', orderId: order.id, reason: 'requested' });
    await expect(model.resolveLicense({ appId: APP_ID, userId: USER_ID })).resolves.toBeNull();
  });
});
