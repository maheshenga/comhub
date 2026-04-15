import { and, eq, sql } from 'drizzle-orm';

import { type UserCreditsItem, userCredits } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class UserCreditsModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  get = async (userId: string): Promise<UserCreditsItem | undefined> => {
    return this.db.query.userCredits.findFirst({
      where: eq(userCredits.userId, userId),
    });
  };

  /**
   * Get or create a credits record for the user.
   */
  getOrCreate = async (userId: string): Promise<UserCreditsItem> => {
    const existing = await this.get(userId);
    if (existing) return existing;

    const [result] = await this.db
      .insert(userCredits)
      .values({ userId, balance: 0, totalEarned: 0, totalConsumed: 0 })
      .onConflictDoNothing()
      .returning();

    // In case of race condition, fetch again
    return result || (await this.get(userId))!;
  };

  /**
   * Add credits to user balance (for grants, redeems, admin adjustments).
   */
  addCredits = async (userId: string, amount: number): Promise<UserCreditsItem> => {
    await this.getOrCreate(userId);
    const [result] = await this.db
      .update(userCredits)
      .set({
        balance: sql`${userCredits.balance} + ${amount}`,
        totalEarned: sql`${userCredits.totalEarned} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId))
      .returning();
    return result;
  };

  /**
   * Deduct credits from user balance atomically.
   * Uses WHERE balance >= amount to prevent overdraw under concurrent requests.
   * Returns the updated record, or null if insufficient balance.
   */
  deductCredits = async (userId: string, amount: number): Promise<UserCreditsItem | null> => {
    await this.getOrCreate(userId);

    const rows = await this.db
      .update(userCredits)
      .set({
        balance: sql`${userCredits.balance} - ${amount}`,
        totalConsumed: sql`${userCredits.totalConsumed} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userCredits.userId, userId), sql`${userCredits.balance} >= ${amount}`))
      .returning();

    return rows[0] || null;
  };

  /**
   * Admin: set balance directly.
   */
  setBalance = async (userId: string, balance: number): Promise<UserCreditsItem> => {
    await this.getOrCreate(userId);
    const [result] = await this.db
      .update(userCredits)
      .set({ balance, updatedAt: new Date() })
      .where(eq(userCredits.userId, userId))
      .returning();
    return result;
  };
}
