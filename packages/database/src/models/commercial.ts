import type {
  AutoTopUpSetting,
  CommercialOverview,
  CreateSubscriptionChangeRequestParams,
  CreateTopUpOrderParams,
  CreditAccountSummary,
  CreditConsumeAllocation,
  CreditLedgerListResult,
  CreditSourceSummary,
  CreditSourceType,
  QueryCommercialListParams,
  QueryCreditLedgerParams,
  ReferralHistoryItem,
  SubscriptionChangeRequestItem,
  SubscriptionChangeRequestReasonType,
  SubscriptionCycleType,
  ReferralOverview,
  SubscriptionSummary,
  TopUpPackageItem,
  TopUpOrderHistoryItem,
} from '@lobechat/types';
import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { Plans } from '@lobechat/types';
import { and, asc, desc, eq, gte, lt, or, sql } from 'drizzle-orm';

import {
  autoTopUpSettings,
  creditAccounts,
  creditLedgerEntries,
  defaultAutoTopUpSetting,
  planCatalog,
  referralProfiles,
  referralRelations,
  referralRewards,
  subscriptionChangeRequests,
  topUpOrders,
  topUpPackages,
  userPlanSnapshots,
  users,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

const FREE_SUBSCRIPTION_SUMMARY: SubscriptionSummary = {
  currency: 'USD',
  cycle: 'monthly',
  endsAt: null,
  externalSubscriptionId: null,
  isFreePlan: true,
  monthlyCredits: 0,
  monthlyPrice: 0,
  plan: Plans.Free,
  provider: null,
  renewsAt: null,
  startedAt: null,
  status: 'active',
};

const REFERRAL_BACKFILL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const DISPLAY_CREDITS_UNIT = CREDITS_PER_DOLLAR;
const REFERRAL_PREVIEW_REWARD_CREDITS = 100 * DISPLAY_CREDITS_UNIT;
const MIN_CUSTOM_TOP_UP_DISPLAY_CREDITS = 50;
const MAX_CUSTOM_TOP_UP_DISPLAY_CREDITS = 5000;
const MAX_TOP_UP_AMOUNT = 500;
const CUSTOM_TOP_UP_UNIT_PRICE = 0.1;
const TOP_UP_CURRENCY = 'USD';
const TOP_UP_VALIDITY_MONTHS = 12;
const ONLINE_PAYMENT_ENABLED = false;
const ONLINE_PAYMENT_DISABLED_ERROR = 'ONLINE_PAYMENT_DISABLED_USE_REDEMPTION_CODE';
const CREDIT_SOURCE_PRIORITY: CreditSourceType[] = ['subscription', 'referral', 'topup', 'other'];

const DEFAULT_TOP_UP_PACKAGES: TopUpPackageItem[] = [
  {
    amount: 9.9,
    credits: 100 * DISPLAY_CREDITS_UNIT,
    currency: TOP_UP_CURRENCY,
    id: 'starter',
    validityMonths: TOP_UP_VALIDITY_MONTHS,
  },
  {
    amount: 27,
    credits: 300 * DISPLAY_CREDITS_UNIT,
    currency: TOP_UP_CURRENCY,
    id: 'growth',
    recommended: true,
    validityMonths: TOP_UP_VALIDITY_MONTHS,
  },
  {
    amount: 68,
    credits: 800 * DISPLAY_CREDITS_UNIT,
    currency: TOP_UP_CURRENCY,
    id: 'scale',
    validityMonths: TOP_UP_VALIDITY_MONTHS,
  },
];

const SUBSCRIPTION_PLAN_ORDER = [
  Plans.Free,
  Plans.Hobby,
  Plans.Starter,
  Plans.Premium,
  Plans.Ultimate,
];

const topUpOrderHistoryColumns = {
  amount: topUpOrders.amount,
  createdAt: topUpOrders.createdAt,
  credits: topUpOrders.credits,
  currency: topUpOrders.currency,
  externalOrderId: topUpOrders.externalOrderId,
  id: topUpOrders.id,
  paidAt: topUpOrders.paidAt,
  provider: topUpOrders.provider,
  status: topUpOrders.status,
};

const normalizeReferralCodeValue = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_]/g, '')
    .toUpperCase()
    .slice(0, 8);

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);

  return next;
};

const addYears = (date: Date, years: number) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);

  return next;
};

const extractReferralCodeValue = (value: string) => {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('ref');
    if (fromQuery) return normalizeReferralCodeValue(fromQuery);
  } catch {
    /* empty */
  }

  return normalizeReferralCodeValue(trimmed);
};

const isUniqueViolationError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505';

type CreditBreakdown = Record<CreditSourceType, CreditSourceSummary>;

type CreditLedgerReplayEntry = Pick<
  typeof creditLedgerEntries.$inferSelect,
  'amount' | 'id' | 'metadata' | 'type'
>;

const createEmptyCreditSourceSummary = (): CreditSourceSummary => ({
  available: 0,
  consumed: 0,
  credited: 0,
});

const createEmptyCreditBreakdown = (): CreditBreakdown => ({
  other: createEmptyCreditSourceSummary(),
  referral: createEmptyCreditSourceSummary(),
  subscription: createEmptyCreditSourceSummary(),
  topup: createEmptyCreditSourceSummary(),
});

const isCreditSourceType = (value: unknown): value is CreditSourceType =>
  typeof value === 'string' && CREDIT_SOURCE_PRIORITY.includes(value as CreditSourceType);

export class CommercialModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  ensureCreditAccount = async (db: LobeChatDatabase | Transaction = this.db) => {
    return db.insert(creditAccounts).values({ userId: this.userId }).onConflictDoNothing();
  };

  private ensureCreditAccountForUser = async (
    userId: string,
    db: LobeChatDatabase | Transaction = this.db,
  ) => {
    return db.insert(creditAccounts).values({ userId }).onConflictDoNothing();
  };

  private grantCreditsToUser = async ({
    amount,
    description,
    metadata,
    referenceId,
    referenceType,
    title,
    tx,
    type,
    userId,
  }: {
    amount: number;
    description?: string;
    metadata?: Record<string, unknown>;
    referenceId?: string;
    referenceType?: string;
    title: string;
    tx: Transaction;
    type: 'referral_reward' | 'subscription_grant' | 'topup';
    userId: string;
  }) => {
    await this.ensureCreditAccountForUser(userId, tx);

    const grantedAt = new Date();
    const [account] = await tx
      .update(creditAccounts)
      .set({
        balance: sql`${creditAccounts.balance} + ${amount}`,
        totalCredited: sql`${creditAccounts.totalCredited} + ${amount}`,
        updatedAt: grantedAt,
      })
      .where(eq(creditAccounts.userId, userId))
      .returning({
        balance: creditAccounts.balance,
      });

    if (!account) {
      throw new Error('CREDIT_ACCOUNT_UPDATE_FAILED');
    }

    const [ledgerEntry] = await tx
      .insert(creditLedgerEntries)
      .values({
        amount,
        balanceAfter: account.balance,
        description,
        metadata,
        referenceId,
        referenceType,
        title,
        type,
        userId,
      })
      .returning({ id: creditLedgerEntries.id });

    if (!ledgerEntry) {
      throw new Error('CREDIT_LEDGER_ENTRY_CREATE_FAILED');
    }

    return ledgerEntry.id;
  };

  private assertPaidPlanForTopUp = async () => {
    const currentPlan = await this.getCurrentPlan();
    const isPaidPlan = currentPlan !== Plans.Free && currentPlan !== Plans.Hobby;

    if (!isPaidPlan) {
      throw new Error('TOP_UP_REQUIRES_PAID_PLAN');
    }
  };

  private createCustomTopUpPackage = (credits: number): TopUpPackageItem => {
    const displayCredits = credits / DISPLAY_CREDITS_UNIT;
    const amount = Number((displayCredits * CUSTOM_TOP_UP_UNIT_PRICE).toFixed(2));

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('TOP_UP_INVALID_CREDITS');
    }

    if (
      credits < MIN_CUSTOM_TOP_UP_DISPLAY_CREDITS * DISPLAY_CREDITS_UNIT ||
      credits > MAX_CUSTOM_TOP_UP_DISPLAY_CREDITS * DISPLAY_CREDITS_UNIT
    ) {
      throw new Error('TOP_UP_INVALID_CREDITS');
    }

    if (amount > MAX_TOP_UP_AMOUNT) {
      throw new Error('TOP_UP_AMOUNT_EXCEEDS_MAX');
    }

    return {
      amount,
      credits,
      currency: TOP_UP_CURRENCY,
      id: `custom-${credits}`,
      validityMonths: TOP_UP_VALIDITY_MONTHS,
    };
  };

  private getChatUsageCreditAmount = (usdCost: number) => {
    if (!Number.isFinite(usdCost) || usdCost <= 0) return 0;

    return Math.ceil(usdCost * CREDITS_PER_DOLLAR);
  };

  private assertSupportedPlan = (plan: string): plan is Plans => {
    if (Object.values(Plans).includes(plan as Plans)) return true;

    throw new Error('SUBSCRIPTION_PLAN_NOT_FOUND');
  };

  private getDefaultPlanDurationMonths = (cycle: SubscriptionCycleType) => {
    switch (cycle) {
      case 'yearly':
      case 'one_time':
        return 12;
      case 'lifetime':
        return null;
      case 'monthly':
      default:
        return 1;
    }
  };

  private resolveRedeemedPlanExpiry = ({
    baseDate,
    cycle,
    durationMonths,
  }: {
    baseDate: Date;
    cycle: SubscriptionCycleType;
    durationMonths?: number | null;
  }) => {
    if (cycle === 'lifetime') return { endsAt: null, renewsAt: null };

    const months =
      durationMonths && durationMonths > 0
        ? durationMonths
        : this.getDefaultPlanDurationMonths(cycle);
    if (!months) return { endsAt: null, renewsAt: null };

    const expiresAt = addMonths(baseDate, months);
    return { endsAt: expiresAt, renewsAt: expiresAt };
  };

  private resolveCreditSourceForGrant = (type?: string): CreditSourceType => {
    switch (type) {
      case 'subscription_grant':
        return 'subscription';
      case 'referral_reward':
        return 'referral';
      case 'topup':
        return 'topup';
      default:
        return 'other';
    }
  };

  private cloneCreditBreakdown = (breakdown: CreditBreakdown): CreditBreakdown => ({
    other: { ...breakdown.other },
    referral: { ...breakdown.referral },
    subscription: { ...breakdown.subscription },
    topup: { ...breakdown.topup },
  });

  private sumCreditBreakdownAvailable = (breakdown: CreditBreakdown) =>
    CREDIT_SOURCE_PRIORITY.reduce(
      (total, source) => total + (breakdown[source]?.available ?? 0),
      0,
    );

  private normalizeConsumeAllocations = (value: unknown): CreditConsumeAllocation[] => {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];

      const amount = (item as { amount?: unknown }).amount;
      const source = (item as { source?: unknown }).source;

      if (!Number.isFinite(amount) || Number(amount) <= 0 || !isCreditSourceType(source)) return [];

      return [{ amount: Number(amount), source }];
    });
  };

  private applyConsumeAllocations = ({
    allocations,
    breakdown,
  }: {
    allocations: CreditConsumeAllocation[];
    breakdown: CreditBreakdown;
  }) => {
    for (const allocation of allocations) {
      const summary = breakdown[allocation.source] ?? createEmptyCreditSourceSummary();

      breakdown[allocation.source] = {
        available: summary.available - allocation.amount,
        consumed: summary.consumed + allocation.amount,
        credited: summary.credited,
      };
    }
  };

  private allocateConsumeCredits = ({
    amount,
    breakdown,
  }: {
    amount: number;
    breakdown: CreditBreakdown;
  }): CreditConsumeAllocation[] => {
    const working = this.cloneCreditBreakdown(breakdown);
    const allocations: CreditConsumeAllocation[] = [];
    let remaining = amount;

    for (const source of CREDIT_SOURCE_PRIORITY) {
      if (remaining <= 0) break;

      const available = Math.max(working[source].available, 0);
      if (available <= 0) continue;

      const allocatedAmount = Math.min(available, remaining);
      allocations.push({ amount: allocatedAmount, source });
      working[source].available -= allocatedAmount;
      remaining -= allocatedAmount;
    }

    if (remaining > 0) {
      allocations.push({ amount: remaining, source: 'other' });
    }

    return allocations;
  };

  private reconcileCreditBreakdown = ({
    balance,
    breakdown,
  }: {
    balance: number;
    breakdown: CreditBreakdown;
  }): CreditBreakdown => {
    const reconciled = this.cloneCreditBreakdown(breakdown);
    const diff = balance - this.sumCreditBreakdownAvailable(reconciled);

    if (diff === 0) return reconciled;

    if (diff > 0) {
      reconciled.other.available += diff;
      reconciled.other.credited += diff;
    } else {
      reconciled.other.available += diff;
      reconciled.other.consumed += Math.abs(diff);
    }

    return reconciled;
  };

  private buildCreditBreakdownFromLedger = ({
    accountBalance,
    ledgerEntries,
  }: {
    accountBalance: number;
    ledgerEntries: CreditLedgerReplayEntry[];
  }): CreditBreakdown => {
    const breakdown = createEmptyCreditBreakdown();

    for (const entry of ledgerEntries) {
      const entryAmount = Number(entry.amount ?? 0);
      if (!Number.isFinite(entryAmount) || entryAmount === 0) continue;

      if (entryAmount > 0) {
        const source = this.resolveCreditSourceForGrant(entry.type);
        const summary = breakdown[source];

        breakdown[source] = {
          available: summary.available + entryAmount,
          consumed: summary.consumed,
          credited: summary.credited + entryAmount,
        };
        continue;
      }

      const consumeAmount = Math.abs(entryAmount);
      const existingAllocations = this.normalizeConsumeAllocations(entry.metadata?.allocations);
      const allocatedAmount = existingAllocations.reduce(
        (total, allocation) => total + allocation.amount,
        0,
      );
      const allocations = [...existingAllocations];
      const previewBreakdown = this.cloneCreditBreakdown(breakdown);

      if (existingAllocations.length > 0) {
        this.applyConsumeAllocations({
          allocations: existingAllocations,
          breakdown: previewBreakdown,
        });
      }

      if (allocatedAmount < consumeAmount) {
        allocations.push(
          ...this.allocateConsumeCredits({
            amount: consumeAmount - allocatedAmount,
            breakdown: previewBreakdown,
          }),
        );
      }

      this.applyConsumeAllocations({ allocations, breakdown });
    }

    return this.reconcileCreditBreakdown({ balance: accountBalance, breakdown });
  };

  private listCreditLedgerReplayEntries = async (
    db: LobeChatDatabase | Transaction = this.db,
  ): Promise<CreditLedgerReplayEntry[]> => {
    return db
      .select({
        amount: creditLedgerEntries.amount,
        id: creditLedgerEntries.id,
        metadata: creditLedgerEntries.metadata,
        type: creditLedgerEntries.type,
      })
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, this.userId))
      .orderBy(asc(creditLedgerEntries.createdAt), asc(creditLedgerEntries.id));
  };

  private listDueSubscriptionGrantPeriods = (
    snapshot?: Pick<
      typeof userPlanSnapshots.$inferSelect,
      'cycle' | 'endsAt' | 'id' | 'monthlyCredits' | 'plan' | 'startedAt' | 'status'
    > | null,
  ) => {
    if (!snapshot) return [];
    if (snapshot.status !== 'active') return [];
    if (snapshot.plan === Plans.Free || snapshot.plan === Plans.Hobby) return [];
    if (!snapshot.monthlyCredits || snapshot.monthlyCredits <= 0) return [];

    const now = new Date();
    const cutoff = snapshot.endsAt && snapshot.endsAt < now ? snapshot.endsAt : now;
    if (snapshot.startedAt > cutoff) return [];

    const periods: Array<{ index: number; periodStart: Date; referenceId: string }> = [];

    for (let index = 0; index < 120; index += 1) {
      const periodStart = addMonths(snapshot.startedAt, index);
      if (periodStart > cutoff) break;

      periods.push({
        index,
        periodStart,
        referenceId: `${snapshot.id}:${index}`,
      });
    }

    return periods;
  };

  private syncSubscriptionCreditsForSnapshot = async ({
    snapshot,
    tx,
  }: {
    snapshot?: Pick<
      typeof userPlanSnapshots.$inferSelect,
      'cycle' | 'endsAt' | 'id' | 'monthlyCredits' | 'plan' | 'startedAt' | 'status'
    > | null;
    tx: Transaction;
  }) => {
    const duePeriods = this.listDueSubscriptionGrantPeriods(snapshot);
    if (!snapshot || duePeriods.length === 0) return 0;

    let granted = 0;

    for (const period of duePeriods) {
      const existed = await tx.query.creditLedgerEntries.findFirst({
        where: and(
          eq(creditLedgerEntries.userId, this.userId),
          eq(creditLedgerEntries.type, 'subscription_grant'),
          eq(creditLedgerEntries.referenceType, 'subscription_snapshot_period'),
          eq(creditLedgerEntries.referenceId, period.referenceId),
        ),
      });

      if (existed) continue;

      await this.grantCreditsToUser({
        amount: snapshot.monthlyCredits,
        description: `Granted ${snapshot.plan} subscription credits for period #${period.index + 1}`,
        metadata: {
          cycle: snapshot.cycle,
          periodIndex: period.index,
          periodStart: period.periodStart.toISOString(),
          plan: snapshot.plan,
          previewMode: true,
          snapshotId: snapshot.id,
        },
        referenceId: period.referenceId,
        referenceType: 'subscription_snapshot_period',
        title: 'Subscription Credits',
        tx,
        type: 'subscription_grant',
        userId: this.userId,
      });

      granted += 1;
    }

    return granted;
  };

  private syncExpiredPlanSnapshots = async (db: LobeChatDatabase | Transaction = this.db) => {
    const now = new Date();

    return db
      .update(userPlanSnapshots)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          eq(userPlanSnapshots.userId, this.userId),
          eq(userPlanSnapshots.status, 'active'),
          lt(userPlanSnapshots.endsAt, now),
        ),
      );
  };

  private syncLatestSubscriptionCredits = async () => {
    return this.db.transaction(async (tx) => {
      await this.syncExpiredPlanSnapshots(tx);

      const snapshot = await tx.query.userPlanSnapshots.findFirst({
        orderBy: [desc(userPlanSnapshots.startedAt), desc(userPlanSnapshots.createdAt)],
        where: and(eq(userPlanSnapshots.userId, this.userId), eq(userPlanSnapshots.status, 'active')),
      });

      return this.syncSubscriptionCreditsForSnapshot({ snapshot, tx });
    });
  };

  canStartChatUsage = async (requiredCredits: number = 1) => {
    await this.syncLatestSubscriptionCredits();
    await this.ensureCreditAccount();

    const account = await this.db.query.creditAccounts.findFirst({
      columns: { balance: true },
      where: eq(creditAccounts.userId, this.userId),
    });

    return (account?.balance ?? 0) >= Math.max(1, Math.ceil(requiredCredits));
  };

  consumeCreditsForChatUsage = async ({
    messageId,
    model,
    operationId,
    provider,
    usage,
  }: {
    messageId: string;
    model: string;
    operationId?: string;
    provider: string;
    usage?: {
      cost?: number;
      costSource?: string;
      totalInputTokens?: number;
      totalOutputTokens?: number;
      totalTokens?: number;
    };
  }) => {
    return this.consumeCreditsForAiUsage({
      model,
      operationId,
      provider,
      referenceId: messageId,
      referenceType: 'assistant_message',
      title: 'AI Chat Usage',
      usage,
      usageType: 'chat',
    });
  };

  consumeCreditsForAiUsage = async ({
    model,
    operationId,
    provider,
    referenceId,
    referenceType,
    title = 'AI Usage',
    usage,
    usageType,
  }: {
    model: string;
    operationId?: string;
    provider: string;
    referenceId: string;
    referenceType: string;
    title?: string;
    usage?: {
      cost?: number;
      costSource?: string;
      totalInputTokens?: number;
      totalOutputTokens?: number;
      totalTokens?: number;
    };
    usageType: 'chat' | 'embeddings' | 'generate_object';
  }) => {
    const usdCost = usage?.cost ?? 0;
    const amount = this.getChatUsageCreditAmount(usdCost);

    if (amount <= 0) return null;

    await this.syncLatestSubscriptionCredits();

    return this.db.transaction(async (tx) => {
      const existed = await tx.query.creditLedgerEntries.findFirst({
        where: and(
          eq(creditLedgerEntries.userId, this.userId),
          eq(creditLedgerEntries.referenceType, referenceType),
          eq(creditLedgerEntries.referenceId, referenceId),
          eq(creditLedgerEntries.type, 'consume'),
        ),
      });

      if (existed) return existed;

      await this.ensureCreditAccount(tx);
      const accountBefore = await tx.query.creditAccounts.findFirst({
        columns: { balance: true },
        where: eq(creditAccounts.userId, this.userId),
      });
      const breakdown = this.buildCreditBreakdownFromLedger({
        accountBalance: accountBefore?.balance ?? 0,
        ledgerEntries: await this.listCreditLedgerReplayEntries(tx),
      });
      const allocations = this.allocateConsumeCredits({ amount, breakdown });

      const consumedAt = new Date();
      const [account] = await tx
        .update(creditAccounts)
        .set({
          balance: sql`${creditAccounts.balance} - ${amount}`,
          totalDebited: sql`${creditAccounts.totalDebited} + ${amount}`,
          updatedAt: consumedAt,
        })
        .where(and(eq(creditAccounts.userId, this.userId), gte(creditAccounts.balance, amount)))
        .returning({
          balance: creditAccounts.balance,
        });

      if (!account) {
        throw new Error('COMMERCIAL_BALANCE_EXHAUSTED_ON_FINAL_CHARGE');
      }

      const [ledgerEntry] = await tx
        .insert(creditLedgerEntries)
        .values({
          amount: -amount,
          balanceAfter: account.balance,
          description: `Consumed on ${provider}/${model}`,
          metadata: {
            allocations,
            billingMode: 'official_raw_credits',
            chargedCredits: amount,
            ...(usage?.costSource ? { costSource: usage.costSource } : {}),
            model,
            operationId,
            provider,
            totalInputTokens: usage?.totalInputTokens ?? 0,
            totalOutputTokens: usage?.totalOutputTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0,
            usdCost,
            usageType,
          },
          referenceId,
          referenceType,
          title,
          type: 'consume',
          userId: this.userId,
        })
        .returning();

      if (!ledgerEntry) {
        throw new Error('CHAT_USAGE_LEDGER_ENTRY_CREATE_FAILED');
      }

      return ledgerEntry;
    });
  };

  getAutoTopUpSetting = async (): Promise<AutoTopUpSetting> => {
    const setting = await this.db.query.autoTopUpSettings.findFirst({
      where: eq(autoTopUpSettings.userId, this.userId),
    });

    if (!setting) return defaultAutoTopUpSetting;

    return {
      enabled: setting.enabled,
      monthlyLimit: setting.monthlyLimit,
      monthlyTopUpAmount: setting.monthlyTopUpAmount ?? 0,
      targetBalance: setting.targetBalance ?? defaultAutoTopUpSetting.targetBalance,
      threshold: setting.threshold ?? defaultAutoTopUpSetting.threshold,
      updatedAt: setting.updatedAt,
    };
  };

  listTopUpPackages = async (): Promise<TopUpPackageItem[]> => {
    const rows = await this.db.query.topUpPackages.findMany({
      orderBy: asc(topUpPackages.sortOrder),
      where: eq(topUpPackages.isActive, true),
    });

    if (rows.length === 0) return DEFAULT_TOP_UP_PACKAGES;

    return rows.map((r) => ({
      amount: Number(r.amount),
      credits: Number(r.credits),
      currency: r.currency,
      id: r.id,
      recommended: r.recommended || undefined,
      validityMonths: Number(r.validityMonths),
    }));
  };

  private getReferralCodeCandidates = async () => {
    const user = await this.db.query.users.findFirst({
      columns: { email: true, fullName: true, username: true },
      where: eq(users.id, this.userId),
    });

    const candidates = [user?.username, user?.fullName, user?.email, this.userId, 'COMHUB']
      .map((item) => normalizeReferralCodeValue(item || ''))
      .filter((item, index, array) => item.length >= 2 && array.indexOf(item) === index);

    return candidates.length > 0 ? candidates : ['COMHUB'];
  };

  private buildReferralCodeAttempt = (base: string, attempt: number) => {
    if (attempt === 0) return base;

    const suffix = String(attempt);
    return `${base.slice(0, Math.max(0, 8 - suffix.length))}${suffix}`;
  };

  private assertReferralBackfillWindow = async () => {
    const user = await this.db.query.users.findFirst({
      columns: { createdAt: true },
      where: eq(users.id, this.userId),
    });

    if (!user?.createdAt) return;

    if (user.createdAt.getTime() + REFERRAL_BACKFILL_WINDOW_MS < Date.now()) {
      throw new Error('REFERRAL_BACKFILL_EXPIRED');
    }
  };

  getReferralProfile = async () => {
    const existing = await this.db.query.referralProfiles.findFirst({
      where: eq(referralProfiles.userId, this.userId),
    });

    if (existing) return existing;

    const candidates = await this.getReferralCodeCandidates();

    for (const base of candidates) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const nextCode = this.buildReferralCodeAttempt(base, attempt);

        try {
          const [created] = await this.db
            .insert(referralProfiles)
            .values({ code: nextCode, userId: this.userId })
            .returning();

          if (created) return created;
        } catch (error) {
          if (isUniqueViolationError(error)) {
            const profile = await this.db.query.referralProfiles.findFirst({
              where: eq(referralProfiles.userId, this.userId),
            });

            if (profile) return profile;
            continue;
          }

          throw error;
        }
      }
    }

    throw new Error('REFERRAL_PROFILE_CREATE_FAILED');
  };

  getCreditAccountSummary = async (): Promise<CreditAccountSummary> => {
    await this.syncLatestSubscriptionCredits();
    await this.ensureCreditAccount();

    const account = await this.db.query.creditAccounts.findFirst({
      where: eq(creditAccounts.userId, this.userId),
    });

    if (!account) {
      return {
        balance: 0,
        breakdown: createEmptyCreditBreakdown(),
        currency: 'CREDITS',
        totalCredited: 0,
        totalDebited: 0,
        updatedAt: null,
      };
    }

    const breakdown = this.buildCreditBreakdownFromLedger({
      accountBalance: account.balance ?? 0,
      ledgerEntries: await this.listCreditLedgerReplayEntries(),
    });

    return {
      balance: account.balance ?? 0,
      breakdown,
      currency: account.currency,
      totalCredited: account.totalCredited ?? 0,
      totalDebited: account.totalDebited ?? 0,
      updatedAt: account.updatedAt,
    };
  };

  listCreditLedger = async (
    params: QueryCreditLedgerParams = {},
  ): Promise<CreditLedgerListResult> => {
    const { cursor, limit = 20 } = params;
    const conditions = [eq(creditLedgerEntries.userId, this.userId)];

    if (cursor) {
      const cursorRow = await this.db
        .select({
          createdAt: creditLedgerEntries.createdAt,
          id: creditLedgerEntries.id,
        })
        .from(creditLedgerEntries)
        .where(and(eq(creditLedgerEntries.id, cursor), eq(creditLedgerEntries.userId, this.userId)))
        .limit(1);

      if (cursorRow[0]) {
        const { createdAt, id } = cursorRow[0];
        conditions.push(
          or(
            lt(creditLedgerEntries.createdAt, createdAt),
            and(eq(creditLedgerEntries.createdAt, createdAt), lt(creditLedgerEntries.id, id)),
          )!,
        );
      }
    }

    const rows = await this.db
      .select({
        amount: creditLedgerEntries.amount,
        balanceAfter: creditLedgerEntries.balanceAfter,
        createdAt: creditLedgerEntries.createdAt,
        description: creditLedgerEntries.description,
        id: creditLedgerEntries.id,
        metadata: creditLedgerEntries.metadata,
        referenceId: creditLedgerEntries.referenceId,
        referenceType: creditLedgerEntries.referenceType,
        title: creditLedgerEntries.title,
        type: creditLedgerEntries.type,
      })
      .from(creditLedgerEntries)
      .where(and(...conditions))
      .orderBy(desc(creditLedgerEntries.createdAt), desc(creditLedgerEntries.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor: hasMore ? items.at(-1)?.id : undefined,
    };
  };

  getLatestPlanSnapshot = async (db: LobeChatDatabase | Transaction = this.db) => {
    await this.syncExpiredPlanSnapshots(db);

    return db.query.userPlanSnapshots.findFirst({
      orderBy: [desc(userPlanSnapshots.startedAt), desc(userPlanSnapshots.createdAt)],
      where: and(eq(userPlanSnapshots.userId, this.userId), eq(userPlanSnapshots.status, 'active')),
    });
  };

  getSubscriptionSummary = async (): Promise<SubscriptionSummary> => {
    const snapshot = await this.getLatestPlanSnapshot();

    if (!snapshot) return FREE_SUBSCRIPTION_SUMMARY;

    return {
      currency: snapshot.currency,
      cycle: snapshot.cycle,
      endsAt: snapshot.endsAt,
      externalSubscriptionId: snapshot.externalSubscriptionId,
      isFreePlan: snapshot.plan === Plans.Free,
      monthlyCredits: snapshot.monthlyCredits ?? 0,
      monthlyPrice: snapshot.monthlyPrice ?? 0,
      plan: snapshot.plan,
      provider: snapshot.provider,
      renewsAt: snapshot.renewsAt,
      startedAt: snapshot.startedAt,
      status: snapshot.status,
    };
  };

  getCommercialOverview = async (): Promise<CommercialOverview> => {
    const [account, subscription] = await Promise.all([
      this.getCreditAccountSummary(),
      this.getSubscriptionSummary(),
    ]);

    return { account, subscription };
  };

  getCurrentPlan = async (): Promise<Plans> => {
    const summary = await this.getSubscriptionSummary();
    return summary.plan;
  };

  updateAutoTopUpSetting = async (
    input: Pick<AutoTopUpSetting, 'enabled' | 'monthlyLimit' | 'targetBalance' | 'threshold'>,
  ): Promise<AutoTopUpSetting> => {
    if (input.targetBalance <= input.threshold) {
      throw new Error('AUTO_TOP_UP_TARGET_NOT_EXCEED_THRESHOLD');
    }

    const currentPlan = await this.getCurrentPlan();
    const isPaidPlan = currentPlan !== Plans.Free && currentPlan !== Plans.Hobby;

    if (input.enabled && !isPaidPlan) {
      throw new Error('AUTO_TOP_UP_REQUIRES_PAID_PLAN');
    }

    await this.db
      .insert(autoTopUpSettings)
      .values({
        enabled: input.enabled,
        monthlyLimit: input.monthlyLimit ?? null,
        targetBalance: input.targetBalance,
        threshold: input.threshold,
        userId: this.userId,
      })
      .onConflictDoUpdate({
        set: {
          enabled: input.enabled,
          monthlyLimit: input.monthlyLimit ?? null,
          targetBalance: input.targetBalance,
          threshold: input.threshold,
          updatedAt: new Date(),
        },
        target: autoTopUpSettings.userId,
      });

    return this.getAutoTopUpSetting();
  };

  getPendingSubscriptionChangeRequest = async (): Promise<SubscriptionChangeRequestItem | null> => {
    const request = await this.db.query.subscriptionChangeRequests.findFirst({
      orderBy: [desc(subscriptionChangeRequests.createdAt)],
      where: and(
        eq(subscriptionChangeRequests.userId, this.userId),
        eq(subscriptionChangeRequests.status, 'pending'),
      ),
    });

    return request || null;
  };

  private resolveSubscriptionChangeReason = (
    currentPlan: Plans,
    targetPlan: Plans,
  ): SubscriptionChangeRequestReasonType => {
    const currentIndex = SUBSCRIPTION_PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = SUBSCRIPTION_PLAN_ORDER.indexOf(targetPlan);

    if (targetIndex > currentIndex) return 'upgrade';
    if (targetIndex < currentIndex) return 'downgrade';

    return 'cycle_change';
  };

  private getRequiredPlanCatalogEntry = async (
    plan: Plans,
    db: LobeChatDatabase | Transaction = this.db,
  ) => {
    this.assertSupportedPlan(plan);

    const dbRow = await db.query.planCatalog.findFirst({
      where: eq(planCatalog.plan, plan as string),
    });

    if (!dbRow) {
      throw new Error('SUBSCRIPTION_PLAN_NOT_FOUND');
    }

    if (!dbRow.isActive) {
      throw new Error('SUBSCRIPTION_PLAN_INACTIVE');
    }

    return dbRow;
  };

  private buildSubscriptionPreviewSnapshot = async (
    plan: Plans,
    cycle: SubscriptionCycleType,
    startedAt: Date,
    db: LobeChatDatabase | Transaction = this.db,
  ) => {
    const dbRow = await this.getRequiredPlanCatalogEntry(plan, db);
    const preset = {
      currency: dbRow.currency,
      monthlyCredits: Number(dbRow.monthlyCredits),
      monthlyPrice: Number(dbRow.monthlyPrice),
      yearlyPrice: Number(dbRow.yearlyPrice),
    };

    switch (cycle) {
      case 'yearly':
        return {
          currency: preset.currency,
          endsAt: null,
          monthlyCredits: preset.monthlyCredits,
          monthlyPrice: Number(preset.yearlyPrice.toFixed(2)),
          renewsAt: addYears(startedAt, 1),
        };
      case 'one_time':
        return {
          currency: preset.currency,
          endsAt: addYears(startedAt, 1),
          monthlyCredits: preset.monthlyCredits,
          monthlyPrice: Number((preset.monthlyPrice * 12).toFixed(2)),
          renewsAt: null,
        };
      case 'lifetime':
        return {
          currency: preset.currency,
          endsAt: null,
          monthlyCredits: preset.monthlyCredits,
          monthlyPrice: Number((preset.monthlyPrice * 24).toFixed(2)),
          renewsAt: null,
        };
      case 'monthly':
      default:
        return {
          currency: preset.currency,
          endsAt: null,
          monthlyCredits: preset.monthlyCredits,
          monthlyPrice: preset.monthlyPrice,
          renewsAt: addMonths(startedAt, 1),
        };
    }
  };

  createSubscriptionChangeRequest = async (
    input: CreateSubscriptionChangeRequestParams,
  ): Promise<SubscriptionChangeRequestItem> => {
    await this.getRequiredPlanCatalogEntry(input.targetPlan);

    const [summary, existingPending] = await Promise.all([
      this.getSubscriptionSummary(),
      this.getPendingSubscriptionChangeRequest(),
    ]);

    if (summary.plan === input.targetPlan && summary.cycle === input.cycle) {
      throw new Error('SUBSCRIPTION_PLAN_UNCHANGED');
    }

    if (
      existingPending &&
      existingPending.toPlan === input.targetPlan &&
      existingPending.cycle === input.cycle
    ) {
      return existingPending;
    }

    if (existingPending) {
      await this.db
        .update(subscriptionChangeRequests)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(subscriptionChangeRequests.id, existingPending.id));
    }

    const [request] = await this.db
      .insert(subscriptionChangeRequests)
      .values({
        cycle: input.cycle,
        fromPlan: summary.plan,
        reason: this.resolveSubscriptionChangeReason(summary.plan, input.targetPlan),
        status: 'pending',
        toPlan: input.targetPlan,
        userId: this.userId,
      })
      .returning();

    return request;
  };

  cancelSubscriptionChangeRequest = async (): Promise<SubscriptionChangeRequestItem | null> => {
    const existingPending = await this.getPendingSubscriptionChangeRequest();

    if (!existingPending) return null;

    const [request] = await this.db
      .update(subscriptionChangeRequests)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptionChangeRequests.id, existingPending.id))
      .returning();

    return request || null;
  };

  activateSubscriptionChangeRequest = async (
    requestId: string,
    options?: {
      /**
       * Override the auto-computed end/renew date for this activation. Used by
       * redemption codes that grant a custom-length subscription (e.g. a 3-month
       * gift code on a monthly plan).
       *
       * - For `monthly`/`yearly` cycles the value replaces `renewsAt` so that
       *   the next billing/expiry is the override date.
       * - For `one_time`/`lifetime` cycles the value replaces `endsAt`.
       */
      endsAtOverride?: Date | null;
    },
  ): Promise<SubscriptionChangeRequestItem> => {
    return this.db.transaction(async (tx) => {
      await this.syncExpiredPlanSnapshots(tx);

      const request = await tx.query.subscriptionChangeRequests.findFirst({
        where: and(
          eq(subscriptionChangeRequests.id, requestId),
          eq(subscriptionChangeRequests.userId, this.userId),
        ),
      });

      if (!request) {
        throw new Error('SUBSCRIPTION_CHANGE_REQUEST_NOT_FOUND');
      }

      if (request.status !== 'pending') {
        throw new Error('SUBSCRIPTION_CHANGE_REQUEST_NOT_ACTIVATABLE');
      }

      const activatedAt = new Date();
      const currentSnapshot = await tx.query.userPlanSnapshots.findFirst({
        orderBy: [desc(userPlanSnapshots.startedAt), desc(userPlanSnapshots.createdAt)],
        where: and(eq(userPlanSnapshots.userId, this.userId), eq(userPlanSnapshots.status, 'active')),
      });

      if (currentSnapshot) {
        await tx
          .update(userPlanSnapshots)
          .set({
            endsAt: activatedAt,
            renewsAt: activatedAt,
            status: 'canceled',
            updatedAt: activatedAt,
          })
          .where(eq(userPlanSnapshots.id, currentSnapshot.id));
      }

      const previewSnapshot = await this.buildSubscriptionPreviewSnapshot(
        request.toPlan,
        request.cycle,
        activatedAt,
        tx,
      );

      // Apply optional duration override (used by redemption codes).
      const finalEndsAt =
        options?.endsAtOverride !== undefined && options.endsAtOverride !== null
          ? request.cycle === 'one_time' || request.cycle === 'lifetime'
            ? options.endsAtOverride
            : previewSnapshot.endsAt
          : previewSnapshot.endsAt;
      const finalRenewsAt =
        options?.endsAtOverride !== undefined && options.endsAtOverride !== null
          ? request.cycle === 'monthly' || request.cycle === 'yearly'
            ? options.endsAtOverride
            : previewSnapshot.renewsAt
          : previewSnapshot.renewsAt;

      const [createdSnapshot] = await tx
        .insert(userPlanSnapshots)
        .values({
          currency: previewSnapshot.currency,
          cycle: request.cycle,
          endsAt: finalEndsAt,
          externalSubscriptionId: `preview-${request.id}`,
          metadata: {
            activatedFromChangeRequestId: request.id,
            ...(options?.endsAtOverride
              ? { endsAtOverride: options.endsAtOverride.toISOString() }
              : {}),
            previewMode: true,
          },
          monthlyCredits: previewSnapshot.monthlyCredits,
          monthlyPrice: previewSnapshot.monthlyPrice,
          plan: request.toPlan,
          provider: 'manual_preview',
          renewsAt: finalRenewsAt,
          startedAt: activatedAt,
          status: 'active',
          userId: this.userId,
        })
        .returning();

      await this.syncSubscriptionCreditsForSnapshot({
        snapshot: createdSnapshot,
        tx,
      });

      const [updatedRequest] = await tx
        .update(subscriptionChangeRequests)
        .set({ status: 'completed', updatedAt: activatedAt })
        .where(
          and(
            eq(subscriptionChangeRequests.id, request.id),
            eq(subscriptionChangeRequests.userId, this.userId),
            eq(subscriptionChangeRequests.status, 'pending'),
          ),
        )
        .returning();

      if (!updatedRequest) {
        throw new Error('SUBSCRIPTION_CHANGE_REQUEST_NOT_ACTIVATABLE');
      }

      return updatedRequest;
    });
  };

  grantPlanFromRedemptionCode = async ({
    code,
    cycle,
    durationMonths,
    redemptionCodeId,
    targetPlan,
    tx,
  }: {
    code: string;
    cycle: SubscriptionCycleType;
    durationMonths?: number | null;
    redemptionCodeId: string;
    targetPlan: Plans;
    tx: Transaction;
  }): Promise<SubscriptionChangeRequestItem> => {
    this.assertSupportedPlan(targetPlan);
    await this.syncExpiredPlanSnapshots(tx);

    const activatedAt = new Date();
    const currentSnapshot = await tx.query.userPlanSnapshots.findFirst({
      orderBy: [desc(userPlanSnapshots.startedAt), desc(userPlanSnapshots.createdAt)],
      where: and(eq(userPlanSnapshots.userId, this.userId), eq(userPlanSnapshots.status, 'active')),
    });
    const fromPlan = currentSnapshot?.plan ?? Plans.Free;

    await tx
      .update(subscriptionChangeRequests)
      .set({ status: 'canceled', updatedAt: activatedAt })
      .where(
        and(
          eq(subscriptionChangeRequests.userId, this.userId),
          eq(subscriptionChangeRequests.status, 'pending'),
        ),
      );

    const [request] = await tx
      .insert(subscriptionChangeRequests)
      .values({
        cycle,
        fromPlan,
        reason: this.resolveSubscriptionChangeReason(fromPlan, targetPlan),
        status: 'pending',
        toPlan: targetPlan,
        userId: this.userId,
      })
      .returning();

    if (!request) {
      throw new Error('SUBSCRIPTION_CHANGE_REQUEST_CREATE_FAILED');
    }

    if (currentSnapshot) {
      await tx
        .update(userPlanSnapshots)
        .set({
          endsAt: activatedAt,
          renewsAt: activatedAt,
          status: 'canceled',
          updatedAt: activatedAt,
        })
        .where(eq(userPlanSnapshots.id, currentSnapshot.id));
    }

    const previewSnapshot = await this.buildSubscriptionPreviewSnapshot(
      targetPlan,
      cycle,
      activatedAt,
      tx,
    );

    const extensionBase =
      currentSnapshot &&
      currentSnapshot.plan === targetPlan &&
      currentSnapshot.cycle === cycle &&
      (currentSnapshot.endsAt || currentSnapshot.renewsAt)
        ? new Date(
            Math.max(
              activatedAt.getTime(),
              (currentSnapshot.endsAt ?? currentSnapshot.renewsAt)!.getTime(),
            ),
          )
        : activatedAt;

    const { endsAt, renewsAt } = this.resolveRedeemedPlanExpiry({
      baseDate: extensionBase,
      cycle,
      durationMonths,
    });

    const [createdSnapshot] = await tx
      .insert(userPlanSnapshots)
      .values({
        currency: previewSnapshot.currency,
        cycle,
        endsAt,
        externalSubscriptionId: `redemption-${redemptionCodeId}`,
        metadata: {
          activatedFromChangeRequestId: request.id,
          durationMonths: durationMonths ?? this.getDefaultPlanDurationMonths(cycle),
          previewMode: true,
          redemptionCode: code,
          redemptionCodeId,
        },
        monthlyCredits: previewSnapshot.monthlyCredits,
        monthlyPrice: previewSnapshot.monthlyPrice,
        plan: targetPlan,
        provider: 'redemption_code',
        renewsAt,
        startedAt: activatedAt,
        status: 'active',
        userId: this.userId,
      })
      .returning();

    if (!createdSnapshot) {
      throw new Error('SUBSCRIPTION_SNAPSHOT_CREATE_FAILED');
    }

    await this.syncSubscriptionCreditsForSnapshot({
      snapshot: createdSnapshot,
      tx,
    });

    const [updatedRequest] = await tx
      .update(subscriptionChangeRequests)
      .set({ status: 'completed', updatedAt: activatedAt })
      .where(
        and(
          eq(subscriptionChangeRequests.id, request.id),
          eq(subscriptionChangeRequests.userId, this.userId),
          eq(subscriptionChangeRequests.status, 'pending'),
        ),
      )
      .returning();

    if (!updatedRequest) {
      throw new Error('SUBSCRIPTION_CHANGE_REQUEST_NOT_ACTIVATABLE');
    }

    return updatedRequest;
  };

  listSubscriptionChangeRequests = async (
    params: QueryCommercialListParams = {},
  ): Promise<SubscriptionChangeRequestItem[]> => {
    const { limit = 20 } = params;

    return this.db
      .select({
        createdAt: subscriptionChangeRequests.createdAt,
        cycle: subscriptionChangeRequests.cycle,
        fromPlan: subscriptionChangeRequests.fromPlan,
        id: subscriptionChangeRequests.id,
        reason: subscriptionChangeRequests.reason,
        status: subscriptionChangeRequests.status,
        toPlan: subscriptionChangeRequests.toPlan,
        updatedAt: subscriptionChangeRequests.updatedAt,
      })
      .from(subscriptionChangeRequests)
      .where(eq(subscriptionChangeRequests.userId, this.userId))
      .orderBy(desc(subscriptionChangeRequests.createdAt), desc(subscriptionChangeRequests.id))
      .limit(limit);
  };

  createTopUpOrder = async (input: CreateTopUpOrderParams): Promise<TopUpOrderHistoryItem> => {
    if (!ONLINE_PAYMENT_ENABLED) {
      throw new Error(ONLINE_PAYMENT_DISABLED_ERROR);
    }

    await this.assertPaidPlanForTopUp();

    let packageItem: TopUpPackageItem | undefined;
    if (input.packageId) {
      const dbRow = await this.db.query.topUpPackages.findFirst({
        where: and(eq(topUpPackages.id, input.packageId), eq(topUpPackages.isActive, true)),
      });
      packageItem = dbRow
        ? {
            amount: Number(dbRow.amount),
            credits: Number(dbRow.credits),
            currency: dbRow.currency,
            id: dbRow.id,
            recommended: dbRow.recommended || undefined,
            validityMonths: Number(dbRow.validityMonths),
          }
        : DEFAULT_TOP_UP_PACKAGES.find((item) => item.id === input.packageId);
    } else if (input.credits) {
      packageItem = this.createCustomTopUpPackage(input.credits);
    }

    if (!packageItem) {
      throw new Error('TOP_UP_PACKAGE_NOT_FOUND');
    }

    if (packageItem.amount > MAX_TOP_UP_AMOUNT) {
      throw new Error('TOP_UP_AMOUNT_EXCEEDS_MAX');
    }

    const [order] = await this.db
      .insert(topUpOrders)
      .values({
        amount: packageItem.amount,
        credits: packageItem.credits,
        currency: packageItem.currency,
        metadata: {
          packageId: packageItem.id,
          validityMonths: packageItem.validityMonths,
        },
        provider: 'manual_preview',
        status: 'pending',
        userId: this.userId,
      })
      .returning(topUpOrderHistoryColumns);

    return order;
  };

  cancelTopUpOrder = async (orderId: string): Promise<TopUpOrderHistoryItem> => {
    if (!ONLINE_PAYMENT_ENABLED) {
      throw new Error(ONLINE_PAYMENT_DISABLED_ERROR);
    }

    const order = await this.db.query.topUpOrders.findFirst({
      where: and(eq(topUpOrders.id, orderId), eq(topUpOrders.userId, this.userId)),
    });

    if (!order) {
      throw new Error('TOP_UP_ORDER_NOT_FOUND');
    }

    if (order.status !== 'pending') {
      throw new Error('TOP_UP_ORDER_NOT_CANCELABLE');
    }

    const [updated] = await this.db
      .update(topUpOrders)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(and(eq(topUpOrders.id, orderId), eq(topUpOrders.userId, this.userId)))
      .returning(topUpOrderHistoryColumns);

    if (!updated) {
      throw new Error('TOP_UP_ORDER_NOT_FOUND');
    }

    return updated;
  };

  settleTopUpOrder = async (orderId: string): Promise<TopUpOrderHistoryItem> => {
    if (!ONLINE_PAYMENT_ENABLED) {
      throw new Error(ONLINE_PAYMENT_DISABLED_ERROR);
    }

    return this.db.transaction(async (tx) => {
      const order = await tx.query.topUpOrders.findFirst({
        where: and(eq(topUpOrders.id, orderId), eq(topUpOrders.userId, this.userId)),
      });

      if (!order) {
        throw new Error('TOP_UP_ORDER_NOT_FOUND');
      }

      if (order.status !== 'pending') {
        throw new Error('TOP_UP_ORDER_NOT_SETTLEABLE');
      }

      await this.ensureCreditAccount(tx);

      const settledAt = new Date();
      const [updatedOrder] = await tx
        .update(topUpOrders)
        .set({ paidAt: settledAt, status: 'paid', updatedAt: settledAt })
        .where(
          and(
            eq(topUpOrders.id, orderId),
            eq(topUpOrders.userId, this.userId),
            eq(topUpOrders.status, 'pending'),
          ),
        )
        .returning(topUpOrderHistoryColumns);

      if (!updatedOrder) {
        throw new Error('TOP_UP_ORDER_NOT_SETTLEABLE');
      }

      const [account] = await tx
        .update(creditAccounts)
        .set({
          balance: sql`${creditAccounts.balance} + ${order.credits}`,
          totalCredited: sql`${creditAccounts.totalCredited} + ${order.credits}`,
          updatedAt: settledAt,
        })
        .where(eq(creditAccounts.userId, this.userId))
        .returning({
          balance: creditAccounts.balance,
        });

      if (!account) {
        throw new Error('TOP_UP_ACCOUNT_UPDATE_FAILED');
      }

      await tx.insert(creditLedgerEntries).values({
        amount: order.credits,
        balanceAfter: account.balance,
        description: `Activated ${order.credits} credits from order ${order.id.slice(0, 8).toUpperCase()}`,
        metadata: {
          amount: order.amount,
          currency: order.currency,
          orderId: order.id,
          provider: order.provider,
        },
        referenceId: order.id,
        referenceType: 'top_up_order',
        title: 'Top-up Order',
        type: 'topup',
        userId: this.userId,
      });

      return updatedOrder;
    });
  };

  getReferralStatus = async () => {
    const relation = await this.db.query.referralRelations.findFirst({
      columns: { status: true },
      orderBy: [desc(referralRelations.createdAt)],
      where: eq(referralRelations.inviteeUserId, this.userId),
    });

    return relation?.status;
  };

  getReferralOverview = async (): Promise<ReferralOverview> => {
    const [aggregate, currentReferralStatus, referralProfile] = await Promise.all([
      this.db
        .select({
          totalInvites: sql<number>`COUNT(*)::int`,
          totalRewarded: sql<number>`COUNT(*) FILTER (WHERE ${referralRelations.status} = 'rewarded')::int`,
          totalRewardedAmount: sql<number>`COALESCE(SUM(CASE WHEN ${referralRelations.status} = 'rewarded' THEN ${referralRelations.rewardCredits} ELSE 0 END), 0)::float8`,
        })
        .from(referralRelations)
        .where(eq(referralRelations.inviterUserId, this.userId))
        .limit(1),
      this.getReferralStatus(),
      this.getReferralProfile(),
    ]);

    return {
      currentReferralStatus,
      referralCode: referralProfile.code,
      rewardCreditsPerInvite: REFERRAL_PREVIEW_REWARD_CREDITS,
      totalInvites: aggregate[0]?.totalInvites ?? 0,
      totalRewarded: aggregate[0]?.totalRewarded ?? 0,
      totalRewardedAmount: aggregate[0]?.totalRewardedAmount ?? 0,
    };
  };

  activateReferralReward = async () => {
    return this.db.transaction(async (tx) => {
      const relation = await tx.query.referralRelations.findFirst({
        where: eq(referralRelations.inviteeUserId, this.userId),
      });

      if (!relation) {
        throw new Error('REFERRAL_REWARD_NOT_FOUND');
      }

      if (relation.status !== 'registered' && relation.status !== 'pending_reward') {
        throw new Error('REFERRAL_REWARD_NOT_ACTIVATABLE');
      }

      const rewardedAt = new Date();
      const rewardCredits = relation.rewardCredits || REFERRAL_PREVIEW_REWARD_CREDITS;

      const [updatedRelation] = await tx
        .update(referralRelations)
        .set({
          rewardCredits,
          rewardedAt,
          status: 'rewarded',
          updatedAt: rewardedAt,
        })
        .where(
          and(
            eq(referralRelations.id, relation.id),
            eq(referralRelations.inviteeUserId, this.userId),
            or(
              eq(referralRelations.status, 'registered'),
              eq(referralRelations.status, 'pending_reward'),
            ),
          ),
        )
        .returning();

      if (!updatedRelation) {
        throw new Error('REFERRAL_REWARD_NOT_ACTIVATABLE');
      }

      const inviterLedgerEntryId = await this.grantCreditsToUser({
        amount: rewardCredits,
        description: `Referral reward for inviting ${this.userId.slice(0, 8).toUpperCase()}`,
        metadata: {
          previewMode: true,
          relationId: relation.id,
          role: 'inviter',
        },
        referenceId: relation.id,
        referenceType: 'referral_relation',
        title: 'Referral Reward',
        tx,
        type: 'referral_reward',
        userId: relation.inviterUserId,
      });

      const inviteeLedgerEntryId = await this.grantCreditsToUser({
        amount: rewardCredits,
        description: `Referral reward activated for code ${relation.code || 'REFERRAL'}`,
        metadata: {
          previewMode: true,
          relationId: relation.id,
          role: 'invitee',
        },
        referenceId: relation.id,
        referenceType: 'referral_relation',
        title: 'Referral Reward',
        tx,
        type: 'referral_reward',
        userId: this.userId,
      });

      await tx.insert(referralRewards).values([
        {
          amount: rewardCredits,
          ledgerEntryId: inviterLedgerEntryId,
          metadata: { previewMode: true },
          relationId: relation.id,
          rewardUserId: relation.inviterUserId,
          role: 'inviter',
        },
        {
          amount: rewardCredits,
          ledgerEntryId: inviteeLedgerEntryId,
          metadata: { previewMode: true },
          relationId: relation.id,
          rewardUserId: this.userId,
          role: 'invitee',
        },
      ]);

      return updatedRelation;
    });
  };

  listReferralHistory = async (
    params: QueryCommercialListParams = {},
  ): Promise<ReferralHistoryItem[]> => {
    const { limit = 20 } = params;

    return this.db
      .select({
        createdAt: referralRelations.createdAt,
        id: referralRelations.id,
        inviteeEmail: users.email,
        inviterRewardAmount: referralRelations.rewardCredits,
        rewardedAt: referralRelations.rewardedAt,
        status: referralRelations.status,
      })
      .from(referralRelations)
      .leftJoin(users, eq(users.id, referralRelations.inviteeUserId))
      .where(eq(referralRelations.inviterUserId, this.userId))
      .orderBy(desc(referralRelations.createdAt), desc(referralRelations.id))
      .limit(limit);
  };

  listTopUpOrders = async (
    params: QueryCommercialListParams = {},
  ): Promise<TopUpOrderHistoryItem[]> => {
    const { limit = 20 } = params;

    return this.db
      .select({
        ...topUpOrderHistoryColumns,
      })
      .from(topUpOrders)
      .where(eq(topUpOrders.userId, this.userId))
      .orderBy(desc(topUpOrders.createdAt), desc(topUpOrders.id))
      .limit(limit);
  };

  updateReferralCode = async (input: string) => {
    const code = normalizeReferralCodeValue(input.trim());
    if (code.length < 2) throw new Error('INVALID_REFERRAL_CODE_FORMAT');

    const profile = await this.getReferralProfile();
    if (profile.code === code) return profile;

    const existed = await this.db.query.referralProfiles.findFirst({
      where: eq(referralProfiles.code, code),
    });

    if (existed && existed.userId !== this.userId) {
      throw new Error('REFERRAL_CODE_TAKEN');
    }

    let updated;

    try {
      [updated] = await this.db
        .update(referralProfiles)
        .set({ code, updatedAt: new Date() })
        .where(eq(referralProfiles.userId, this.userId))
        .returning();
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new Error('REFERRAL_CODE_TAKEN');
      }

      throw error;
    }

    return updated || profile;
  };

  bindReferralCode = async (input: string) => {
    const code = extractReferralCodeValue(input);
    if (code.length < 2) throw new Error('INVALID_REFERRAL_CODE_FORMAT');

    const [currentProfile, existingRelation] = await Promise.all([
      this.getReferralProfile(),
      this.db.query.referralRelations.findFirst({
        where: eq(referralRelations.inviteeUserId, this.userId),
      }),
    ]);

    if (existingRelation) throw new Error('REFERRAL_ALREADY_BOUND');
    await this.assertReferralBackfillWindow();
    if (currentProfile.code === code) throw new Error('SELF_REFERRAL');

    const inviterProfile = await this.db.query.referralProfiles.findFirst({
      where: eq(referralProfiles.code, code),
    });

    if (!inviterProfile) throw new Error('REFERRAL_CODE_NOT_FOUND');
    if (inviterProfile.userId === this.userId) throw new Error('SELF_REFERRAL');

    let relation;

    try {
      [relation] = await this.db
        .insert(referralRelations)
        .values({
          code,
          inviteeUserId: this.userId,
          inviterUserId: inviterProfile.userId,
          rewardCredits: 0,
          status: 'registered',
        })
        .returning();
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new Error('REFERRAL_ALREADY_BOUND');
      }

      throw error;
    }

    return relation;
  };
}
