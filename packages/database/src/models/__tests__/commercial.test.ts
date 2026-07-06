// @vitest-environment node
import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { Plans } from '@lobechat/types';
import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  creditAccounts,
  creditLedgerEntries,
  planCatalog,
  referralProfiles,
  referralRelations,
  subscriptionChangeRequests,
  topUpOrders,
  topUpPackages,
  userPlanSnapshots,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CommercialModel } from '../commercial';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'commercial-model-test-user-id';
const commercialModel = new CommercialModel(serverDB, userId);
const DEFAULT_PLAN_CATALOG = {
  [Plans.Free]: {
    currency: 'USD',
    displayName: 'Free',
    monthlyCredits: 0,
    monthlyPrice: 0,
    sortOrder: 0,
    yearlyPrice: 0,
  },
  [Plans.Hobby]: {
    currency: 'USD',
    displayName: 'Hobby',
    monthlyCredits: 0,
    monthlyPrice: 0,
    sortOrder: 1,
    yearlyPrice: 0,
  },
  [Plans.Starter]: {
    currency: 'USD',
    displayName: 'Starter',
    monthlyCredits: 600 * CREDITS_PER_DOLLAR,
    monthlyPrice: 19.9,
    sortOrder: 2,
    yearlyPrice: 199,
  },
  [Plans.Premium]: {
    currency: 'USD',
    displayName: 'Premium',
    monthlyCredits: 2200 * CREDITS_PER_DOLLAR,
    monthlyPrice: 59,
    sortOrder: 3,
    yearlyPrice: 590,
  },
  [Plans.Ultimate]: {
    currency: 'USD',
    displayName: 'Ultimate',
    monthlyCredits: 7200 * CREDITS_PER_DOLLAR,
    monthlyPrice: 149,
    sortOrder: 4,
    yearlyPrice: 1490,
  },
} as const;

const seedPlanCatalogEntry = async (
  plan: Plans,
  overrides: Partial<(typeof DEFAULT_PLAN_CATALOG)[Plans]> & {
    features?: string[];
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  } = {},
) => {
  const base = DEFAULT_PLAN_CATALOG[plan];

  await serverDB.insert(planCatalog).values({
    ...base,
    features: [],
    isActive: true,
    plan,
    ...overrides,
  });
};

const seedCreditLedger = async (
  entries: Array<{
    amount: number;
    metadata?: Record<string, unknown>;
    title?: string;
    type: 'consume' | 'referral_reward' | 'subscription_grant' | 'topup';
  }>,
) => {
  await commercialModel.ensureCreditAccount();

  let balance = 0;
  let totalCredited = 0;
  let totalDebited = 0;

  for (const entry of entries) {
    balance += entry.amount;
    if (entry.amount > 0) totalCredited += entry.amount;
    if (entry.amount < 0) totalDebited += Math.abs(entry.amount);
  }

  await serverDB
    .update(creditAccounts)
    .set({ balance, totalCredited, totalDebited })
    .where(eq(creditAccounts.userId, userId));

  let runningBalance = 0;

  for (const [index, entry] of entries.entries()) {
    runningBalance += entry.amount;

    await serverDB.insert(creditLedgerEntries).values({
      amount: entry.amount,
      balanceAfter: runningBalance,
      metadata: entry.metadata,
      referenceId: `seed-${index}`,
      referenceType: 'seed',
      title: entry.title ?? `Seed ${entry.type}`,
      type: entry.type,
      userId,
    });
  }
};

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);
});

afterEach(async () => {
  await serverDB
    .delete(subscriptionChangeRequests)
    .where(eq(subscriptionChangeRequests.userId, userId));
  await serverDB.delete(userPlanSnapshots).where(eq(userPlanSnapshots.userId, userId));
  await serverDB.delete(creditLedgerEntries).where(eq(creditLedgerEntries.userId, userId));
  await serverDB.delete(creditAccounts).where(eq(creditAccounts.userId, userId));
  await serverDB.delete(referralRelations).where(eq(referralRelations.inviteeUserId, userId));
  await serverDB.delete(referralProfiles).where(eq(referralProfiles.userId, userId));
  await serverDB.delete(planCatalog);
  await serverDB.delete(topUpPackages);
  await serverDB.delete(users).where(eq(users.id, userId));
});

describe('CommercialModel', () => {
  describe('canStartChatUsage', () => {
    it('should require the requested minimum credits', async () => {
      await commercialModel.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 150_000, totalCredited: 150_000 })
        .where(eq(creditAccounts.userId, userId));

      await expect(commercialModel.canStartChatUsage(150_000)).resolves.toBe(true);
      await expect(commercialModel.canStartChatUsage(150_001)).resolves.toBe(false);
    });
  });

  describe('consumeCreditsForChatUsage', () => {
    it('should debit balance and write a negative consume ledger entry', async () => {
      await commercialModel.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 5 * CREDITS_PER_DOLLAR, totalCredited: 5 * CREDITS_PER_DOLLAR })
        .where(eq(creditAccounts.userId, userId));

      await commercialModel.consumeCreditsForChatUsage({
        messageId: 'assistant-message-1',
        model: 'gpt-4.1',
        operationId: 'operation-1',
        provider: 'lobehub',
        usage: {
          cost: 0.25,
          costSource: 'gateway',
          totalInputTokens: 100,
          totalOutputTokens: 50,
          totalTokens: 150,
        },
      });

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const ledgerEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(account?.balance).toBe(4_750_000);
      expect(account?.totalDebited).toBe(250_000);
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0]).toMatchObject({
        amount: -250_000,
        balanceAfter: 4_750_000,
        metadata: expect.objectContaining({
          costSource: 'gateway',
          model: 'gpt-4.1',
          operationId: 'operation-1',
          provider: 'lobehub',
          usageType: 'chat',
        }),
        referenceId: 'assistant-message-1',
        referenceType: 'assistant_message',
        title: 'AI Chat Usage',
        type: 'consume',
      });
    });

    it('should remain idempotent for the same assistant message', async () => {
      await commercialModel.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 5 * CREDITS_PER_DOLLAR, totalCredited: 5 * CREDITS_PER_DOLLAR })
        .where(eq(creditAccounts.userId, userId));

      await commercialModel.consumeCreditsForChatUsage({
        messageId: 'assistant-message-2',
        model: 'gpt-4.1',
        provider: 'lobehub',
        usage: { cost: 0.2, totalTokens: 100 },
      });

      await commercialModel.consumeCreditsForChatUsage({
        messageId: 'assistant-message-2',
        model: 'gpt-4.1',
        provider: 'lobehub',
        usage: { cost: 0.2, totalTokens: 100 },
      });

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const ledgerEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(account?.balance).toBe(4_800_000);
      expect(account?.totalDebited).toBe(200_000);
      expect(ledgerEntries).toHaveLength(1);
    });

    it('should reject the final charge when the available balance is lower than the actual usage cost', async () => {
      await commercialModel.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 150_000, totalCredited: 150_000 })
        .where(eq(creditAccounts.userId, userId));

      await expect(
        commercialModel.consumeCreditsForAiUsage({
          model: 'gpt-4.1',
          provider: 'lobehub',
          referenceId: 'assistant-message-low-balance',
          referenceType: 'assistant_message',
          title: 'AI Chat Usage',
          usage: { cost: 0.2, totalTokens: 100 },
          usageType: 'chat',
        }),
      ).rejects.toThrow('COMMERCIAL_BALANCE_EXHAUSTED_ON_FINAL_CHARGE');

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const ledgerEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(account?.balance).toBe(150_000);
      expect(account?.totalDebited).toBe(0);
      expect(ledgerEntries).toHaveLength(0);
    });

    it('should debit generic model runtime usage with a dedicated reference type', async () => {
      await commercialModel.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 5 * CREDITS_PER_DOLLAR, totalCredited: 5 * CREDITS_PER_DOLLAR })
        .where(eq(creditAccounts.userId, userId));

      await commercialModel.consumeCreditsForAiUsage({
        model: 'gpt-4.1',
        operationId: 'operation-structured-1',
        provider: 'lobehub',
        referenceId: 'operation-structured-1',
        referenceType: 'model_runtime_generate_object',
        title: 'AI Structured Output Usage',
        usage: { cost: 0.1, costSource: 'gateway', totalTokens: 80 },
        usageType: 'generate_object',
      });

      const ledgerEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0]).toMatchObject({
        amount: -100_000,
        metadata: expect.objectContaining({
          costSource: 'gateway',
          usageType: 'generate_object',
        }),
        referenceId: 'operation-structured-1',
        referenceType: 'model_runtime_generate_object',
        title: 'AI Structured Output Usage',
        type: 'consume',
      });
    });

    it('should apply route group multiplier and persist provider route metadata', async () => {
      await commercialModel.ensureCreditAccount();
      await serverDB
        .update(creditAccounts)
        .set({ balance: 5 * CREDITS_PER_DOLLAR, totalCredited: 5 * CREDITS_PER_DOLLAR })
        .where(eq(creditAccounts.userId, userId));

      await commercialModel.consumeCreditsForAiUsage({
        model: 'gpt-4.1',
        provider: 'newapi',
        referenceId: 'assistant-message-route-multiplier',
        referenceType: 'assistant_message',
        routeMetadata: {
          groupKey: 'pro',
          groupMultiplier: 1.5,
          groupName: 'Pro Group',
          instanceId: 'instance-pro',
          instanceName: 'NewAPI Pro',
          providerType: 'deepseek',
        },
        title: 'AI Chat Usage',
        usage: { cost: 0.2, costSource: 'gateway', totalTokens: 100 },
        usageType: 'chat',
      });

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const ledgerEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(account?.balance).toBe(4_700_000);
      expect(account?.totalDebited).toBe(300_000);
      expect(ledgerEntries[0]).toMatchObject({
        amount: -300_000,
        metadata: expect.objectContaining({
          groupKey: 'pro',
          groupMultiplier: 1.5,
          instanceId: 'instance-pro',
          pricingMultiplier: 1.5,
          provider: 'newapi',
          providerType: 'deepseek',
        }),
      });
    });

    it('should consume subscription credits before referral and top-up credits', async () => {
      await seedCreditLedger([
        { amount: 600_000, title: 'Subscription Credits', type: 'subscription_grant' },
        { amount: 200_000, title: 'Referral Reward', type: 'referral_reward' },
        { amount: 300_000, title: 'Top-up Order', type: 'topup' },
      ]);

      await commercialModel.consumeCreditsForChatUsage({
        messageId: 'assistant-message-3',
        model: 'gpt-4.1',
        provider: 'lobehub',
        usage: { cost: 0.95, totalTokens: 200 },
      });

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const ledgerEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });
      const consumeEntry = ledgerEntries.find(
        (entry) => entry.referenceId === 'assistant-message-3',
      );
      const summary = await commercialModel.getCreditAccountSummary();

      expect(account?.balance).toBe(150_000);
      expect(account?.totalDebited).toBe(950_000);
      expect(consumeEntry?.metadata).toMatchObject({
        allocations: [
          { amount: 600_000, source: 'subscription' },
          { amount: 200_000, source: 'referral' },
          { amount: 150_000, source: 'topup' },
        ],
      });
      expect(summary.breakdown.subscription.available).toBe(0);
      expect(summary.breakdown.referral.available).toBe(0);
      expect(summary.breakdown.topup.available).toBe(150_000);
    });
  });

  describe('subscription credits', () => {
    it('should grant hobby plan credits when activating a subscription change request', async () => {
      await seedPlanCatalogEntry(Plans.Hobby, {
        monthlyCredits: 10 * CREDITS_PER_DOLLAR,
      });

      const request = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'monthly',
        targetPlan: Plans.Hobby,
      });

      await commercialModel.activateSubscriptionChangeRequest(request.id);

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const grantEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(account?.balance).toBe(10 * CREDITS_PER_DOLLAR);
      expect(account?.totalCredited).toBe(10 * CREDITS_PER_DOLLAR);
      expect(grantEntries).toHaveLength(1);
      expect(grantEntries[0]).toMatchObject({
        amount: 10 * CREDITS_PER_DOLLAR,
        referenceType: 'subscription_snapshot_period',
        title: 'Subscription Credits',
        type: 'subscription_grant',
      });
    });

    it('should grant paid-plan credits when activating a subscription change request', async () => {
      await seedPlanCatalogEntry(Plans.Starter);

      const request = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'monthly',
        targetPlan: Plans.Starter,
      });

      await commercialModel.activateSubscriptionChangeRequest(request.id);

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const grantEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(account?.balance).toBe(600 * CREDITS_PER_DOLLAR);
      expect(account?.totalCredited).toBe(600 * CREDITS_PER_DOLLAR);
      expect(grantEntries).toHaveLength(1);
      expect(grantEntries[0]).toMatchObject({
        amount: 600 * CREDITS_PER_DOLLAR,
        referenceType: 'subscription_snapshot_period',
        title: 'Subscription Credits',
        type: 'subscription_grant',
      });
    });

    it('should sync storage and vector quotas from plan metadata when activating a subscription', async () => {
      await seedPlanCatalogEntry(Plans.Starter, {
        metadata: {
          storageQuotaMb: 512,
          vectorQuota: 1200,
        },
      });

      const request = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'monthly',
        targetPlan: Plans.Starter,
      });

      await commercialModel.activateSubscriptionChangeRequest(request.id);

      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });

      expect(Number(account?.storageQuota)).toBe(512 * 1024 * 1024);
      expect(Number(account?.vectorQuota)).toBe(1200);
    });

    it('should backfill active subscription credits only once', async () => {
      await serverDB.insert(userPlanSnapshots).values({
        cycle: 'monthly',
        currency: 'USD',
        monthlyCredits: 600 * CREDITS_PER_DOLLAR,
        monthlyPrice: 19.9,
        plan: Plans.Starter,
        provider: 'manual_preview',
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startedAt: new Date(),
        status: 'active',
        userId,
      });

      const firstAccount = await commercialModel.getCreditAccountSummary();
      const secondAccount = await commercialModel.getCreditAccountSummary();
      const grantEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(firstAccount.balance).toBe(600 * CREDITS_PER_DOLLAR);
      expect(secondAccount.balance).toBe(600 * CREDITS_PER_DOLLAR);
      expect(grantEntries).toHaveLength(1);
      expect(grantEntries[0]?.amount).toBe(600 * CREDITS_PER_DOLLAR);
    });

    it('should atomically grant a plan from a redemption code', async () => {
      await seedPlanCatalogEntry(Plans.Starter);

      await serverDB.transaction(async (tx) => {
        await commercialModel.grantPlanFromRedemptionCode({
          code: 'PLAN-3M',
          cycle: 'monthly',
          durationMonths: 3,
          redemptionCodeId: 'redemption-code-id',
          targetPlan: Plans.Starter,
          tx,
        });
      });

      const snapshot = await commercialModel.getLatestPlanSnapshot();
      const request = await serverDB.query.subscriptionChangeRequests.findFirst({
        where: eq(subscriptionChangeRequests.userId, userId),
      });
      const account = await serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, userId),
      });
      const grantEntries = await serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, userId),
      });

      expect(request?.status).toBe('completed');
      expect(snapshot).toMatchObject({
        cycle: 'monthly',
        monthlyCredits: 600 * CREDITS_PER_DOLLAR,
        plan: Plans.Starter,
        provider: 'redemption_code',
        status: 'active',
      });
      expect(snapshot?.metadata).toMatchObject({
        durationMonths: 3,
        redemptionCode: 'PLAN-3M',
        redemptionCodeId: 'redemption-code-id',
      });
      expect(snapshot?.endsAt?.getTime()).toBeGreaterThan(Date.now() + 80 * 24 * 60 * 60 * 1000);
      expect(account?.balance).toBe(600 * CREDITS_PER_DOLLAR);
      expect(grantEntries).toHaveLength(1);
      expect(grantEntries[0]).toMatchObject({
        amount: 600 * CREDITS_PER_DOLLAR,
        referenceType: 'subscription_snapshot_period',
        type: 'subscription_grant',
      });
    });

    it('should record manual plan grants as admin manual snapshots', async () => {
      await seedPlanCatalogEntry(Plans.Starter);

      await serverDB.transaction(async (tx) => {
        await commercialModel.grantPlanManually({
          assignedByUserId: 'admin-user-id',
          cycle: 'yearly',
          durationMonths: 12,
          manualGrantId: 'manual-grant-id',
          reason: 'manual upgrade',
          targetPlan: Plans.Starter,
          tx,
        });
      });

      const snapshot = await commercialModel.getLatestPlanSnapshot();

      expect(snapshot).toMatchObject({
        cycle: 'yearly',
        externalSubscriptionId: 'manual-grant-id',
        plan: Plans.Starter,
        provider: 'admin_manual',
        status: 'active',
      });
      expect(snapshot?.metadata).toMatchObject({
        adminReason: 'manual upgrade',
        assignedByUserId: 'admin-user-id',
        manualGrantId: 'manual-grant-id',
        source: 'admin_manual',
      });
      expect(snapshot?.metadata).not.toHaveProperty('redemptionCodeId');
    });

    it('should expire elapsed paid-plan snapshots and create an unlimited free snapshot', async () => {
      await serverDB.insert(userPlanSnapshots).values({
        cycle: 'monthly',
        currency: 'USD',
        endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        monthlyCredits: 600 * CREDITS_PER_DOLLAR,
        monthlyPrice: 19.9,
        plan: Plans.Starter,
        provider: 'redemption_code',
        renewsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        startedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        status: 'active',
        userId,
      });

      const summary = await commercialModel.getSubscriptionSummary();
      const snapshots = await serverDB.query.userPlanSnapshots.findMany({
        where: eq(userPlanSnapshots.userId, userId),
        orderBy: asc(userPlanSnapshots.startedAt),
      });
      const repeatedSummary = await commercialModel.getSubscriptionSummary();

      expect(summary.plan).toBe(Plans.Free);
      expect(summary.isFreePlan).toBe(true);
      expect(summary.endsAt).toBeNull();
      expect(summary.renewsAt).toBeNull();
      expect(repeatedSummary.plan).toBe(Plans.Free);
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]).toMatchObject({
        plan: Plans.Starter,
        status: 'expired',
      });
      expect(snapshots[1]).toMatchObject({
        cycle: 'monthly',
        monthlyCredits: 0,
        monthlyPrice: 0,
        plan: Plans.Free,
        provider: 'system_default',
        status: 'active',
      });
      expect(snapshots[1]?.endsAt).toBeNull();
      expect(snapshots[1]?.renewsAt).toBeNull();
    });
  });

  describe('credit account summary', () => {
    it('should reconstruct source balances for legacy consume entries without allocations', async () => {
      await seedCreditLedger([
        { amount: 600_000, title: 'Subscription Credits', type: 'subscription_grant' },
        { amount: 300_000, title: 'Top-up Order', type: 'topup' },
        { amount: -200_000, title: 'Legacy Usage', type: 'consume' },
      ]);

      const summary = await commercialModel.getCreditAccountSummary();

      expect(summary.balance).toBe(700_000);
      expect(summary.breakdown.subscription.available).toBe(400_000);
      expect(summary.breakdown.subscription.consumed).toBe(200_000);
      expect(summary.breakdown.topup.available).toBe(300_000);
      expect(summary.breakdown.referral.available).toBe(0);
      expect(summary.breakdown.other.available).toBe(0);
    });
  });

  describe('listTopUpPackages', () => {
    afterEach(async () => {
      await serverDB.delete(topUpPackages);
    });

    it('returns an empty list when DB is empty', async () => {
      const packages = await commercialModel.listTopUpPackages();
      expect(packages).toEqual([]);
    });

    it('returns an empty list when only inactive DB rows exist', async () => {
      await serverDB.insert(topUpPackages).values({
        amount: 200,
        credits: 2000 * CREDITS_PER_DOLLAR,
        currency: 'USD',
        displayName: 'Inactive',
        id: 'pkg-inactive',
        isActive: false,
        sortOrder: 0,
        validityMonths: 12,
      });

      const packages = await commercialModel.listTopUpPackages();
      expect(packages).toEqual([]);
    });

    it('returns active DB rows ordered by sortOrder', async () => {
      await serverDB.insert(topUpPackages).values([
        {
          amount: 100,
          credits: 1000 * CREDITS_PER_DOLLAR,
          currency: 'USD',
          displayName: 'B',
          id: 'pkg-b',
          isActive: true,
          sortOrder: 2,
          validityMonths: 12,
        },
        {
          amount: 50,
          credits: 500 * CREDITS_PER_DOLLAR,
          currency: 'USD',
          displayName: 'A',
          id: 'pkg-a',
          isActive: true,
          metadata: {
            originalAmount: 70,
            promotionEnabled: true,
            promotionLabel: 'Limited offer',
            promotionNote: 'Valid for 6 months',
          },
          sortOrder: 1,
          validityMonths: 12,
        },
        {
          amount: 200,
          credits: 2000 * CREDITS_PER_DOLLAR,
          currency: 'USD',
          displayName: 'X',
          id: 'pkg-x',
          isActive: false,
          sortOrder: 0,
          validityMonths: 12,
        },
      ]);

      const packages = await commercialModel.listTopUpPackages();
      expect(packages).toHaveLength(2);
      expect(packages[0].id).toBe('pkg-a');
      expect(packages[0]).toMatchObject({
        displayName: 'A',
        metadata: { promotionEnabled: true, promotionLabel: 'Limited offer' },
      });
      expect(packages[1].id).toBe('pkg-b');
    });
  });

  describe('referral profile', () => {
    it('creates a random 7-digit numeric referral code instead of using user identity', async () => {
      await serverDB
        .update(users)
        .set({
          email: 'named-user@example.com',
          fullName: 'Named User',
          username: 'nameduser',
        })
        .where(eq(users.id, userId));

      const profile = await commercialModel.getReferralProfile();

      expect(profile.code).toMatch(/^\d{7}$/);
      expect(profile.code).not.toBe('NAMEDUSE');
    });

    it('requires manually edited and bound referral codes to be 7 digits', async () => {
      await expect(commercialModel.updateReferralCode('ABC123')).rejects.toThrow(
        'INVALID_REFERRAL_CODE_FORMAT',
      );

      await expect(commercialModel.updateReferralCode('1234567')).resolves.toMatchObject({
        code: '1234567',
      });

      await expect(commercialModel.bindReferralCode('ABC123')).rejects.toThrow(
        'INVALID_REFERRAL_CODE_FORMAT',
      );
    });
  });

  describe('createTopUpOrder', () => {
    afterEach(async () => {
      await serverDB.delete(topUpOrders).where(eq(topUpOrders.userId, userId));
      await serverDB.delete(topUpPackages);
    });

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
        userId,
      });
    };

    it('rejects top-up order creation because online payment is disabled', async () => {
      await expect(commercialModel.createTopUpOrder({ packageId: 'starter' })).rejects.toThrow(
        'ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE',
      );
    });

    it('does not create a pending order even for a paid plan and DB-backed package', async () => {
      await seedActiveStarterPlan();
      await serverDB.insert(topUpPackages).values({
        amount: 12,
        credits: 120 * CREDITS_PER_DOLLAR,
        currency: 'USD',
        displayName: 'Mini',
        id: 'mini',
        isActive: true,
        sortOrder: 0,
        validityMonths: 6,
      });

      await expect(commercialModel.createTopUpOrder({ packageId: 'mini' })).rejects.toThrow(
        'ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE',
      );

      const orders = await serverDB.query.topUpOrders.findMany({
        where: eq(topUpOrders.userId, userId),
      });
      expect(orders).toHaveLength(0);
    });

    it('short-circuits unknown package validation while online payment is disabled', async () => {
      await seedActiveStarterPlan();
      await expect(
        commercialModel.createTopUpOrder({ packageId: 'does-not-exist' }),
      ).rejects.toThrow('ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE');
    });

    it('rejects canceling and settling legacy online payment orders', async () => {
      const [order] = await serverDB
        .insert(topUpOrders)
        .values({
          amount: 12,
          credits: 120 * CREDITS_PER_DOLLAR,
          currency: 'USD',
          provider: 'manual_preview',
          status: 'pending',
          userId,
        })
        .returning();

      await expect(commercialModel.cancelTopUpOrder(order.id)).rejects.toThrow(
        'ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE',
      );
      await expect(commercialModel.settleTopUpOrder(order.id)).rejects.toThrow(
        'ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE',
      );

      const unchangedOrder = await serverDB.query.topUpOrders.findFirst({
        where: eq(topUpOrders.id, order.id),
      });
      expect(unchangedOrder?.status).toBe('pending');
      expect(unchangedOrder?.paidAt).toBeNull();
    });
  });

  describe('subscription change request', () => {
    it('creates a pending change request and prevents duplicates', async () => {
      await seedPlanCatalogEntry(Plans.Starter);

      await serverDB.insert(userPlanSnapshots).values({
        currency: 'USD',
        cycle: 'monthly',
        monthlyCredits: 0,
        monthlyPrice: 0,
        plan: Plans.Free,
        provider: 'manual_preview',
        startedAt: new Date(),
        status: 'active',
        userId,
      });

      const first = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'monthly',
        targetPlan: Plans.Starter,
      });
      expect(first.status).toBe('pending');
      expect(first.toPlan).toBe(Plans.Starter);

      const dup = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'monthly',
        targetPlan: Plans.Starter,
      });
      expect(dup.id).toBe(first.id);
    });

    it('requires the target plan to exist in plan_catalog before creating a change request', async () => {
      await expect(
        commercialModel.createSubscriptionChangeRequest({
          cycle: 'monthly',
          targetPlan: Plans.Starter,
        }),
      ).rejects.toThrow('SUBSCRIPTION_PLAN_NOT_FOUND');
    });

    it('uses plan_catalog when activating a change request', async () => {
      await serverDB.insert(planCatalog).values({
        currency: 'USD',
        displayName: 'Premium DB',
        features: [],
        isActive: true,
        monthlyCredits: 3000 * CREDITS_PER_DOLLAR,
        monthlyPrice: 79,
        plan: Plans.Premium as string,
        sortOrder: 3,
        yearlyPrice: 790,
      });

      const request = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'monthly',
        targetPlan: Plans.Premium,
      });
      await commercialModel.activateSubscriptionChangeRequest(request.id);

      const snapshot = await commercialModel.getLatestPlanSnapshot();
      expect(snapshot?.plan).toBe(Plans.Premium);
      expect(Number(snapshot?.monthlyCredits)).toBe(3000 * CREDITS_PER_DOLLAR);
      expect(Number(snapshot?.monthlyPrice)).toBe(79);
    });

    it('uses configured one-time plan price from plan metadata when activating', async () => {
      await seedPlanCatalogEntry(Plans.Premium, {
        metadata: { oneTimePrice: 499 },
        monthlyPrice: 59,
      });

      const request = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'one_time',
        targetPlan: Plans.Premium,
      });
      await commercialModel.activateSubscriptionChangeRequest(request.id);

      const snapshot = await commercialModel.getLatestPlanSnapshot();
      expect(snapshot?.cycle).toBe('one_time');
      expect(Number(snapshot?.monthlyPrice)).toBe(499);
    });

    it('uses configured lifetime plan price from plan metadata when activating', async () => {
      await seedPlanCatalogEntry(Plans.Premium, {
        metadata: { lifetimePrice: 999 },
        monthlyPrice: 59,
      });

      const request = await commercialModel.createSubscriptionChangeRequest({
        cycle: 'lifetime',
        targetPlan: Plans.Premium,
      });
      await commercialModel.activateSubscriptionChangeRequest(request.id);

      const snapshot = await commercialModel.getLatestPlanSnapshot();
      expect(snapshot?.cycle).toBe('lifetime');
      expect(Number(snapshot?.monthlyPrice)).toBe(999);
    });

    it('rejects redemption grants for inactive plan catalog entries', async () => {
      await seedPlanCatalogEntry(Plans.Starter, { isActive: false });

      await expect(
        serverDB.transaction((tx) =>
          commercialModel.grantPlanFromRedemptionCode({
            code: 'PLAN-INACTIVE',
            cycle: 'monthly',
            redemptionCodeId: 'redemption-code-inactive',
            targetPlan: Plans.Starter,
            tx,
          }),
        ),
      ).rejects.toThrow('SUBSCRIPTION_PLAN_INACTIVE');
    });
  });
});
