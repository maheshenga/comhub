// @vitest-environment node
import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { Plans } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  creditAccounts,
  topUpOrders,
  topUpPackages,
  userPlanSnapshots,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CommercialModel } from '../commercial';

const testUserId = 'topup-test-user';
const serverDB: LobeChatDatabase = await getTestDB();

const seedActiveStarterPlan = async () => {
  await serverDB.insert(userPlanSnapshots).values({
    currency: 'USD',
    cycle: 'monthly',
    monthlyCredits: 600 * CREDITS_PER_DOLLAR,
    monthlyPrice: 19.9,
    plan: Plans.Starter,
    provider: 'manual_preview',
    renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    startedAt: new Date(),
    status: 'active',
    userId: testUserId,
  });
};

describe('CommercialModel topUpOrders', () => {
  beforeEach(async () => {
    await serverDB.delete(topUpOrders);
    await serverDB.delete(creditAccounts);
    await serverDB.delete(userPlanSnapshots).where(eq(userPlanSnapshots.userId, testUserId));
    await serverDB.delete(topUpPackages);
    await serverDB.delete(users).where(eq(users.id, testUserId));
    await serverDB.insert(users).values({ id: testUserId, email: 'topup@test.com' });
    // Insert a test package so createTopUpOrder with packageId can work
    await serverDB.insert(topUpPackages).values({
      amount: 5,
      credits: 500000000,
      currency: 'USD',
      displayName: 'Test Package',
      id: 'topup-test-pkg',
      isActive: true,
      sortOrder: 0,
      validityMonths: 12,
    });
    // Seed a paid plan so the online-payment guard is proven independent of subscription status.
    await seedActiveStarterPlan();
  });

  afterEach(async () => {
    await serverDB.delete(topUpOrders);
    await serverDB.delete(creditAccounts);
  });

  describe('createTopUpOrder', () => {
    it('should create order with source=redemption without ONLINE_PAYMENT_ENABLED gate', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({
        packageId: 'topup-test-pkg',
        redemptionCodeId: 'code-123',
        source: 'redemption',
      });

      expect(order).toBeDefined();
      expect(order.status).toBe('pending');
      expect(order.source).toBe('redemption');
      expect(order.redemptionCodeId).toBe('code-123');
    });

    it('should reject online payment sources even for paid users', async () => {
      const model = new CommercialModel(serverDB, testUserId);

      await expect(
        model.createTopUpOrder({
          packageId: 'topup-test-pkg',
          source: 'alipay',
        }),
      ).rejects.toThrow('ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE');

      const orders = await serverDB.query.topUpOrders.findMany({
        where: (order, { eq }) => eq(order.userId, testUserId),
      });

      expect(orders).toHaveLength(0);
    });
  });

  describe('settleTopUpOrder', () => {
    it('should settle a pending order and credit the account', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({
        packageId: 'topup-test-pkg',
        source: 'redemption',
      });

      const settled = await model.settleTopUpOrder(order.id);

      expect(settled.status).toBe('paid');
      expect(settled.paidAt).toBeDefined();

      const account = await serverDB.query.creditAccounts.findFirst({
        where: (a, { eq }) => eq(a.userId, testUserId),
      });
      expect(account?.balance).toBe(500000000);
    });
  });

  describe('cancelTopUpOrder', () => {
    it('should cancel a pending order', async () => {
      const model = new CommercialModel(serverDB, testUserId);
      const order = await model.createTopUpOrder({
        packageId: 'topup-test-pkg',
        source: 'redemption',
      });

      const canceled = await model.cancelTopUpOrder(order.id);

      expect(canceled.status).toBe('canceled');
    });
  });
});
