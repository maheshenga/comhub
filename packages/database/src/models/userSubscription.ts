import { and, eq, gt, lte, or, sql } from 'drizzle-orm';

import { plans, userSubscriptions } from '../schemas';
import type { LobeChatDatabase } from '../type';

/**
 * UserSubscriptionModel — checks user subscription/VIP status.
 */
export class UserSubscriptionModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * Check if a user has an active (non-expired) subscription.
   */
  hasActiveSubscription = async (userId: string): Promise<boolean> => {
    const now = new Date();
    const row = await this.db.query.userSubscriptions.findFirst({
      where: and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, 'active'),
        or(
          // No expiry set (unlimited)
          eq(userSubscriptions.expiresAt, null as any),
          // Not yet expired
          gt(userSubscriptions.expiresAt, now),
        ),
      ),
    });
    return !!row;
  };

  /**
   * Get the active subscription for a user (if any).
   */
  getActiveSubscription = async (userId: string) => {
    const now = new Date();
    return this.db.query.userSubscriptions.findFirst({
      where: and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, 'active'),
        or(
          eq(userSubscriptions.expiresAt, null as any),
          gt(userSubscriptions.expiresAt, now),
        ),
      ),
      with: {
        plan: true,
      },
    });
  };

  /**
   * Mark all overdue active subscriptions as expired.
   * Returns the number of rows updated.
   */
  expireOverdue = async (): Promise<number> => {
    const now = new Date();
    const rows = await this.db
      .update(userSubscriptions)
      .set({ status: 'expired' as const })
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          lte(userSubscriptions.expiresAt, now),
        ),
      )
      .returning();
    return rows.length;
  };

  /**
   * Get all active subscriptions expiring within a given number of days.
   * Used for sending expiration reminders.
   */
  getExpiringSoon = async (withinDays: number) => {
    const now = new Date();
    const deadline = new Date(now.getTime() + withinDays * 86400000);
    return this.db.query.userSubscriptions.findMany({
      where: and(
        eq(userSubscriptions.status, 'active'),
        gt(userSubscriptions.expiresAt, now),
        lte(userSubscriptions.expiresAt, deadline),
      ),
      with: {
        plan: true,
      },
    });
  };

  /**
   * Get all active subscriptions with their plan info.
   * Used for monthly credit grants.
   */
  getAllActiveWithPlan = async () => {
    const now = new Date();
    return this.db.query.userSubscriptions.findMany({
      where: and(
        eq(userSubscriptions.status, 'active'),
        or(
          eq(userSubscriptions.expiresAt, null as any),
          gt(userSubscriptions.expiresAt, now),
        ),
      ),
      with: {
        plan: true,
      },
    });
  };
}
