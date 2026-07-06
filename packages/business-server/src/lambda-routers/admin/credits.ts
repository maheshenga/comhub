import { asc, desc, eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { creditAccounts, creditLedgerEntries } from '@/database/schemas';
import type { Transaction } from '@/database/type';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, adminProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

const creditAccountAuditSnapshot = {
  balance: creditAccounts.balance,
  totalCredited: creditAccounts.totalCredited,
  totalDebited: creditAccounts.totalDebited,
};

export const adminCreditsRouter = router({
  adjust: financeWriteProcedure
    .input(
      z.object({
        amount: z.number().int(),
        reason: z.string().min(1).max(500),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, reason, userId } = input;

      const snapshots = await ctx.serverDB.transaction(async (tx: Transaction) => {
        await tx
          .insert(creditAccounts)
          .values({ balance: 0, totalCredited: 0, totalDebited: 0, userId })
          .onConflictDoNothing({ target: creditAccounts.userId });

        const [before] = await tx
          .select(creditAccountAuditSnapshot)
          .from(creditAccounts)
          .where(eq(creditAccounts.userId, userId));

        if (amount > 0) {
          await tx
            .update(creditAccounts)
            .set({
              balance: sql`${creditAccounts.balance} + ${amount}`,
              totalCredited: sql`${creditAccounts.totalCredited} + ${amount}`,
              updatedAt: new Date(),
            })
            .where(eq(creditAccounts.userId, userId));
        } else {
          // Pre-check: ensure sufficient balance for negative adjustment
          if (before && Number(before.balance) + amount < 0) {
            throw new Error(
              `Insufficient balance: current ${before.balance}, adjustment ${amount}`,
            );
          }

          await tx
            .update(creditAccounts)
            .set({
              balance: sql`${creditAccounts.balance} + ${amount}`,
              totalDebited: sql`${creditAccounts.totalDebited} + ${Math.abs(amount)}`,
              updatedAt: new Date(),
            })
            .where(eq(creditAccounts.userId, userId));
        }

        const [after] = await tx
          .select(creditAccountAuditSnapshot)
          .from(creditAccounts)
          .where(eq(creditAccounts.userId, userId));

        if (!after) {
          throw new Error(`Credit account not found after adjustment: ${userId}`);
        }

        await tx.insert(creditLedgerEntries).values({
          amount,
          balanceAfter: after.balance,
          description: reason,
          referenceType: 'admin_adjustment',
          title: 'Admin Adjustment',
          type: 'adjustment',
          userId,
        });

        return { after, before: before ?? null };
      });

      await recordAdminAudit(ctx, {
        action: 'credits.adjust',
        payload: { amount, reason, ...snapshots },
        resourceType: 'credit_account',
        targetUserId: userId,
      });

      return { ok: true };
    }),

  getBalance: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.serverDB.query.creditAccounts.findFirst({
        where: eq(creditAccounts.userId, input.userId),
      });

      return { balance: row?.balance ?? 0, currency: row?.currency ?? 'credits' };
    }),

  ledger: adminProcedure
    .input(
      z.object({
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
        userId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, userId } = input;

      const items = await ctx.serverDB.query.creditLedgerEntries.findMany({
        limit,
        offset: cursor,
        orderBy: desc(creditLedgerEntries.createdAt),
        where: eq(creditLedgerEntries.userId, userId),
      });

      return {
        items,
        nextCursor: items.length === limit ? cursor + limit : null,
      };
    }),

  /**
   * Global credit-account list, ordered by selected metric. Supports a
   * `negativeOnly` filter to surface anomalous accounts.
   */
  listAccounts: adminProcedure
    .input(
      z.object({
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
        negativeOnly: z.boolean().optional(),
        order: z.enum(['asc', 'desc']).default('desc'),
        sort: z.enum(['balance', 'totalCredited', 'totalDebited', 'updatedAt']).default('balance'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const col =
        input.sort === 'totalCredited'
          ? creditAccounts.totalCredited
          : input.sort === 'totalDebited'
            ? creditAccounts.totalDebited
            : input.sort === 'updatedAt'
              ? creditAccounts.updatedAt
              : creditAccounts.balance;
      const orderBy = input.order === 'asc' ? asc(col) : desc(col);
      const where = input.negativeOnly ? lt(creditAccounts.balance, 0) : undefined;

      const items = await ctx.serverDB.query.creditAccounts.findMany({
        limit: input.limit,
        offset: input.cursor,
        orderBy,
        where,
      });

      return {
        items,
        nextCursor: items.length === input.limit ? input.cursor + input.limit : null,
      };
    }),
});
