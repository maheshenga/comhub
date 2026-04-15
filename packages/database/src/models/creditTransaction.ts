import { and, desc, eq } from 'drizzle-orm';

import {
  type CreditTransactionItem,
  type NewCreditTransactionItem,
  creditTransactions,
} from '../schemas';
import type { LobeChatDatabase } from '../type';

export class CreditTransactionModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  create = async (data: NewCreditTransactionItem): Promise<CreditTransactionItem> => {
    const [result] = await this.db.insert(creditTransactions).values(data).returning();
    return result;
  };

  /**
   * Get recent transactions across all users (admin).
   */
  getRecent = async (
    limit: number = 5000,
    offset: number = 0,
  ): Promise<CreditTransactionItem[]> => {
    return this.db.query.creditTransactions.findMany({
      orderBy: [desc(creditTransactions.createdAt)],
      limit,
      offset,
    });
  };

  /**
   * Get recent transactions for a user.
   */
  getByUser = async (
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<CreditTransactionItem[]> => {
    return this.db.query.creditTransactions.findMany({
      where: eq(creditTransactions.userId, userId),
      orderBy: [desc(creditTransactions.createdAt)],
      limit,
      offset,
    });
  };

  /**
   * Get transactions of a specific type for a user.
   */
  getByUserAndType = async (
    userId: string,
    type: CreditTransactionItem['type'],
  ): Promise<CreditTransactionItem[]> => {
    return this.db.query.creditTransactions.findMany({
      where: and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, type),
      ),
      orderBy: [desc(creditTransactions.createdAt)],
    });
  };

  /**
   * Check if a transaction with the given referenceId exists for a user.
   * Used for idempotent monthly credit grants.
   */
  findByReferenceId = async (
    userId: string,
    referenceId: string,
  ): Promise<CreditTransactionItem | undefined> => {
    return this.db.query.creditTransactions.findFirst({
      where: and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.referenceId, referenceId),
      ),
    });
  };
}
