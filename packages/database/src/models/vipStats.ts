import { and, count, eq, gt, lte, or, sql, sum } from 'drizzle-orm';

import {
  creditTransactions,
  userCredits,
  userSubscriptions,
} from '../schemas';
import type { LobeChatDatabase } from '../type';

export interface VipStats {
  activeSubscriptions: number;
  expiringSoon7d: number;
  totalCreditsBalance: number;
  monthlyCreditsGranted: number;
  monthlyCreditsConsumed: number;
}

export class VipStatsModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getStats = async (): Promise<VipStats> => {
    const now = new Date();
    const deadline7d = new Date(now.getTime() + 7 * 86400000);

    // Current month boundaries
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Active subscriptions count
    const [activeResult] = await this.db
      .select({ count: count() })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          or(
            sql`${userSubscriptions.expiresAt} IS NULL`,
            gt(userSubscriptions.expiresAt, now),
          ),
        ),
      );

    // Expiring within 7 days
    const [expiringResult] = await this.db
      .select({ count: count() })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          gt(userSubscriptions.expiresAt, now),
          lte(userSubscriptions.expiresAt, deadline7d),
        ),
      );

    // Total credits balance across all users
    const [balanceResult] = await this.db
      .select({ total: sum(userCredits.balance) })
      .from(userCredits);

    // Monthly credits granted (subscription_grant transactions this month)
    const [grantedResult] = await this.db
      .select({ total: sum(creditTransactions.amount) })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.type, 'subscription_grant'),
          gt(creditTransactions.createdAt, monthStart),
          lte(creditTransactions.createdAt, monthEnd),
        ),
      );

    // Monthly credits consumed (usage_deduct transactions this month, amounts are negative)
    const [consumedResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)` })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.type, 'usage_deduct'),
          gt(creditTransactions.createdAt, monthStart),
          lte(creditTransactions.createdAt, monthEnd),
        ),
      );

    return {
      activeSubscriptions: activeResult?.count ?? 0,
      expiringSoon7d: expiringResult?.count ?? 0,
      totalCreditsBalance: Number(balanceResult?.total ?? 0),
      monthlyCreditsGranted: Number(grantedResult?.total ?? 0),
      monthlyCreditsConsumed: Number(consumedResult?.total ?? 0),
    };
  };

  /**
   * Get daily credit usage for the past N days.
   * Used for usage trend charts (U3).
   */
  getDailyUsage = async (days: number = 30, userId?: string) => {
    const since = new Date(Date.now() - days * 86400000);

    const conditions = [
      eq(creditTransactions.type, 'usage_deduct'),
      gt(creditTransactions.createdAt, since),
    ];

    if (userId) {
      conditions.push(eq(creditTransactions.userId, userId));
    }

    const rows = await this.db
      .select({
        date: sql<string>`DATE(${creditTransactions.createdAt})`,
        total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
        count: count(),
      })
      .from(creditTransactions)
      .where(and(...conditions))
      .groupBy(sql`DATE(${creditTransactions.createdAt})`)
      .orderBy(sql`DATE(${creditTransactions.createdAt})`);

    return rows;
  };

  /**
   * Get credit usage breakdown by model for a user.
   * Used for model consumption pie chart (U3).
   */
  getModelBreakdown = async (userId: string, days: number = 30) => {
    const since = new Date(Date.now() - days * 86400000);

    const rows = await this.db
      .select({
        model: creditTransactions.model,
        total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
        count: count(),
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.type, 'usage_deduct'),
          gt(creditTransactions.createdAt, since),
          sql`${creditTransactions.model} IS NOT NULL`,
        ),
      )
      .groupBy(creditTransactions.model)
      .orderBy(sql`COALESCE(SUM(ABS(${creditTransactions.amount})), 0) DESC`);

    return rows;
  };
}
