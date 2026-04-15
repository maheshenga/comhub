import { and, eq, gt, lt, sql } from 'drizzle-orm';

import {
  type NewRedeemCodeItem,
  type RedeemCodeItem,
  type RedeemLogItem,
  redeemCodes,
  redeemLogs,
  userCredits,
  userSubscriptions,
} from '../schemas';
import type { LobeChatDatabase } from '../type';

export class RedeemCodeModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  create = async (data: NewRedeemCodeItem): Promise<RedeemCodeItem> => {
    const [result] = await this.db.insert(redeemCodes).values(data).returning();
    return result;
  };

  getByCode = async (code: string): Promise<RedeemCodeItem | undefined> => {
    return this.db.query.redeemCodes.findFirst({
      where: eq(redeemCodes.code, code),
    });
  };

  getAll = async (): Promise<RedeemCodeItem[]> => {
    return this.db.query.redeemCodes.findMany({
      orderBy: (codes, { desc }) => [desc(codes.createdAt)],
    });
  };

  /**
   * Redeem a code for a user.
   * Handles credits grant and/or plan subscription in a transaction.
   * Uses SELECT FOR UPDATE to prevent concurrent redemption races.
   * Returns the redeem log entry, or throws on failure.
   */
  redeem = async (code: string, userId: string): Promise<RedeemLogItem> => {
    return this.db.transaction(async (tx) => {
      // 1. Find and lock the code row (FOR UPDATE prevents concurrent transactions)
      const codeRows = await tx
        .select()
        .from(redeemCodes)
        .where(eq(redeemCodes.code, code))
        .for('update');

      const codeRow = codeRows[0];
      if (!codeRow) throw new Error('REDEEM_CODE_NOT_FOUND');

      // 2. Check if expired
      if (codeRow.expiresAt && codeRow.expiresAt < new Date()) {
        throw new Error('REDEEM_CODE_EXPIRED');
      }

      // 3. Check usage limit
      if (codeRow.usedCount >= codeRow.maxUses) {
        throw new Error('REDEEM_CODE_MAX_USES_REACHED');
      }

      // 4. Check if user already redeemed this code (application-level check)
      const existingLog = await tx.query.redeemLogs.findFirst({
        where: and(
          eq(redeemLogs.codeId, codeRow.id),
          eq(redeemLogs.userId, userId),
        ),
      });
      if (existingLog) throw new Error('REDEEM_CODE_ALREADY_USED');

      // 5. Grant credits if applicable
      if (codeRow.creditsAmount > 0) {
        await tx
          .insert(userCredits)
          .values({
            userId,
            balance: codeRow.creditsAmount,
            totalEarned: codeRow.creditsAmount,
            totalConsumed: 0,
          })
          .onConflictDoUpdate({
            target: userCredits.userId,
            set: {
              balance: sql`${userCredits.balance} + ${codeRow.creditsAmount}`,
              totalEarned: sql`${userCredits.totalEarned} + ${codeRow.creditsAmount}`,
              updatedAt: new Date(),
            },
          });
      }

      // 6. Grant plan subscription if applicable
      if (codeRow.planId && codeRow.planDurationDays) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + codeRow.planDurationDays * 86400000);

        await tx.insert(userSubscriptions).values({
          userId,
          planId: codeRow.planId,
          status: 'active',
          startedAt: now,
          expiresAt,
          paymentChannel: 'redeem',
          externalId: codeRow.id,
        });
      }

      // 7. Increment used count
      await tx
        .update(redeemCodes)
        .set({ usedCount: sql`${redeemCodes.usedCount} + 1` })
        .where(eq(redeemCodes.id, codeRow.id));

      // 8. Create redeem log (UNIQUE constraint on code_id+user_id prevents duplicates)
      const [log] = await tx
        .insert(redeemLogs)
        .values({ codeId: codeRow.id, userId })
        .returning();

      return log;
    });
  };

  delete = async (id: string) => {
    return this.db.delete(redeemCodes).where(eq(redeemCodes.id, id));
  };
}
