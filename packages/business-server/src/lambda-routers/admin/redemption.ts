import type { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { CommercialModel } from '@/database/models/commercial';
import {
  creditAccounts,
  creditLedgerEntries,
  planCatalog,
  redemptionCodes,
  topUpPackages,
} from '@/database/schemas';
import type { Transaction } from '@/database/type';
import { adminProcedure, authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

import { recordAdminAudit } from './audit';

const userDbProcedure = authedProcedure.use(serverDatabase);

/** Friendly base32 alphabet without ambiguous chars (no I/L/O/0/1). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const generateCode = (length = 16, group = 4): string => {
  const buf = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  // Insert dashes every `group` chars: ABCD-EFGH-IJKL-MNOP
  if (group <= 0 || group >= length) return s;
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += group) parts.push(s.slice(i, i + group));
  return parts.join('-');
};

const RewardSchema = z.discriminatedUnion('rewardType', [
  z.object({
    rewardType: z.literal('plan'),
    planCycle: z.enum(['monthly', 'yearly']),
    planDurationMonths: z.number().int().min(1).max(60).optional(),
    planKey: z.string().min(1),
  }),
  z.object({
    creditsAmount: z.number().int().min(1),
    rewardType: z.literal('credits'),
  }),
  z.object({
    rewardType: z.literal('topup_package'),
    topupPackageId: z.string().min(1),
  }),
]);

const assertPlanRewardIsRedeemable = async (db: any, planKey: string) => {
  const catalogRow = await db.query.planCatalog.findFirst({
    where: eq(planCatalog.plan, planKey),
  });

  if (!catalogRow) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'PLAN_NOT_FOUND' });
  }

  if (!catalogRow.isActive) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'PLAN_INACTIVE' });
  }
};

const assertTopUpPackageRewardIsRedeemable = async (db: any, packageId: string) => {
  const pkg = await db.query.topUpPackages.findFirst({
    where: eq(topUpPackages.id, packageId),
  });

  if (!pkg) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOPUP_PACKAGE_MISSING' });
  }

  if (!pkg.isActive) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOPUP_PACKAGE_INACTIVE' });
  }
};

export const adminRedemptionRouter = router({
  generate: adminProcedure
    .input(
      z.intersection(
        RewardSchema,
        z.object({
          batchId: z.string().min(1).max(64).optional(),
          codeLength: z.number().int().min(8).max(32).default(16),
          count: z.number().int().min(1).max(1000).default(1),
          expiresAt: z.string().datetime().optional(),
          note: z.string().max(500).optional(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const ctxUserId = ctx.userId;
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      const batchId = input.batchId ?? `batch_${new Date().toISOString().replaceAll(/[:.]/g, '-')}`;

      if (input.rewardType === 'plan') {
        await assertPlanRewardIsRedeemable(ctx.serverDB, input.planKey);
      } else if (input.rewardType === 'topup_package') {
        await assertTopUpPackageRewardIsRedeemable(ctx.serverDB, input.topupPackageId);
      }

      // Generate unique codes; collisions extremely unlikely but loop guard.
      const created: string[] = [];
      const reward =
        input.rewardType === 'plan'
          ? {
              planCycle: input.planCycle,
              planDurationMonths: input.planDurationMonths ?? null,
              planKey: input.planKey,
            }
          : input.rewardType === 'credits'
            ? { creditsAmount: input.creditsAmount }
            : { topupPackageId: input.topupPackageId };

      for (let i = 0; i < input.count; i++) {
        let attempt = 0;
        while (attempt < 5) {
          const code = generateCode(input.codeLength);
          try {
            await ctx.serverDB.insert(redemptionCodes).values({
              batchId,
              code,
              createdByUserId: ctxUserId ?? null,
              expiresAt,
              note: input.note ?? null,
              rewardType: input.rewardType,
              status: 'active',
              ...reward,
            } as any);
            created.push(code);
            break;
          } catch (err) {
            const msg = (err as Error).message ?? '';
            if (!msg.includes('redemption_codes_code_unique')) throw err;
            attempt++;
          }
        }
      }

      await recordAdminAudit(ctx, {
        action: 'redemption.generate',
        payload: { batchId, count: created.length, rewardType: input.rewardType },
        resourceType: 'redemption_code',
      });

      return { batchId, codes: created };
    }),

  list: adminProcedure
    .input(
      z.object({
        batchId: z.string().optional(),
        codeQuery: z.string().max(64).optional(),
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
        rewardType: z.enum(['plan', 'credits', 'topup_package']).optional(),
        status: z.enum(['active', 'redeemed', 'disabled', 'expired']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds = [
        input.status ? eq(redemptionCodes.status, input.status) : undefined,
        input.rewardType ? eq(redemptionCodes.rewardType, input.rewardType) : undefined,
        input.batchId ? eq(redemptionCodes.batchId, input.batchId) : undefined,
        input.codeQuery
          ? ilike(redemptionCodes.code, `%${input.codeQuery.trim().toUpperCase()}%`)
          : undefined,
      ].filter(Boolean) as Array<Exclude<ReturnType<typeof eq>, undefined>>;
      const where = conds.length > 0 ? and(...conds) : undefined;

      const [items, [{ value: total }]] = await Promise.all([
        ctx.serverDB.query.redemptionCodes.findMany({
          limit: input.limit,
          offset: input.cursor,
          orderBy: desc(redemptionCodes.createdAt),
          where,
        }),
        where
          ? ctx.serverDB.select({ value: count() }).from(redemptionCodes).where(where)
          : ctx.serverDB.select({ value: count() }).from(redemptionCodes),
      ]);

      return {
        items,
        nextCursor: items.length === input.limit ? input.cursor + input.limit : null,
        total,
      };
    }),

  disable: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.serverDB.query.redemptionCodes.findFirst({
        where: eq(redemptionCodes.id, input.id),
      });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      if (row.status === 'redeemed')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already redeemed' });

      await ctx.serverDB
        .update(redemptionCodes)
        .set({ status: 'disabled', updatedAt: new Date() })
        .where(eq(redemptionCodes.id, input.id));

      await recordAdminAudit(ctx, {
        action: 'redemption.disable',
        payload: { code: row.code },
        resourceId: row.id,
        resourceType: 'redemption_code',
      });
      return { ok: true };
    }),

  enable: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.serverDB.query.redemptionCodes.findFirst({
        where: eq(redemptionCodes.id, input.id),
      });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      if (row.status === 'redeemed')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already redeemed' });

      await ctx.serverDB
        .update(redemptionCodes)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(redemptionCodes.id, input.id));

      await recordAdminAudit(ctx, {
        action: 'redemption.enable',
        payload: { code: row.code },
        resourceId: row.id,
        resourceType: 'redemption_code',
      });
      return { ok: true };
    }),

  /** Mark all expired codes whose expiresAt has passed and status='active' as 'expired'. */
  expireOverdue: adminProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const updated = await ctx.serverDB
      .update(redemptionCodes)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          eq(redemptionCodes.status, 'active'),
          isNotNull(redemptionCodes.expiresAt),
          lt(redemptionCodes.expiresAt, now),
        ),
      )
      .returning({ id: redemptionCodes.id });

    await recordAdminAudit(ctx, {
      action: 'redemption.expireOverdue',
      payload: { expired: updated.length },
      resourceType: 'redemption_code',
    });
    return { expired: updated.length };
  }),

  /**
   * Disable many codes at once. Already-redeemed rows are silently skipped so
   * partial batches don't leak ledger inconsistencies.
   */
  bulkDisable: adminProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.serverDB
        .update(redemptionCodes)
        .set({ status: 'disabled', updatedAt: new Date() })
        .where(and(inArray(redemptionCodes.id, input.ids), eq(redemptionCodes.status, 'active')))
        .returning({ id: redemptionCodes.id });

      await recordAdminAudit(ctx, {
        action: 'redemption.bulkDisable',
        payload: { disabled: updated.length, requested: input.ids.length },
        resourceType: 'redemption_code',
      });
      return { disabled: updated.length, requested: input.ids.length };
    }),

  /**
   * Delete unredeemed codes permanently. Redeemed codes are kept to preserve
   * the ledger trail.
   */
  bulkDelete: adminProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)).min(1).max(500),
        reason: z.string().trim().min(1).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.serverDB
        .delete(redemptionCodes)
        .where(and(inArray(redemptionCodes.id, input.ids), eq(redemptionCodes.status, 'active')))
        .returning({ id: redemptionCodes.id });

      await recordAdminAudit(ctx, {
        action: 'redemption.bulkDelete',
        payload: { deleted: deleted.length, reason: input.reason, requested: input.ids.length },
        resourceType: 'redemption_code',
      });
      return { deleted: deleted.length, requested: input.ids.length };
    }),
});

/**
 * User-side redemption router. Authenticated users can redeem an active code.
 */
export const redemptionRouter = router({
  /** Look up a code without committing — for UI preview before clicking redeem. */
  preview: userDbProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const code = input.code.trim().toUpperCase();
      const row = await ctx.serverDB.query.redemptionCodes.findFirst({
        where: eq(redemptionCodes.code, code),
      });
      if (!row) return { found: false as const };

      const isExpired =
        row.status === 'expired' ||
        (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now());
      const status: 'active' | 'redeemed' | 'disabled' | 'expired' = isExpired
        ? 'expired'
        : (row.status as any);

      return {
        creditsAmount: row.creditsAmount,
        expiresAt: row.expiresAt,
        found: true as const,
        planCycle: row.planCycle,
        planDurationMonths: row.planDurationMonths,
        planKey: row.planKey,
        rewardType: row.rewardType,
        status,
        topupPackageId: row.topupPackageId,
      };
    }),

  redeem: userDbProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.code.trim().toUpperCase();
      const userId = ctx.userId!;
      let appliedKind: 'plan' | 'credits' | 'topup_package' = 'credits';
      let summary: Record<string, unknown> = {};

      await ctx.serverDB.transaction(async (tx: Transaction) => {
        const row = await tx.query.redemptionCodes.findFirst({
          where: eq(redemptionCodes.code, code),
        });
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'CODE_NOT_FOUND' });
        if (row.status === 'redeemed')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'CODE_ALREADY_REDEEMED' });
        if (row.status === 'disabled')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'CODE_DISABLED' });
        if (
          row.status === 'expired' ||
          (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now())
        )
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'CODE_EXPIRED' });

        // Atomic claim: only succeed if status is still 'active'.
        const claim = await tx
          .update(redemptionCodes)
          .set({
            redeemedAt: new Date(),
            redeemedByUserId: userId,
            status: 'redeemed',
            updatedAt: new Date(),
          })
          .where(and(eq(redemptionCodes.id, row.id), eq(redemptionCodes.status, 'active')))
          .returning({ id: redemptionCodes.id });
        if (claim.length === 0) throw new TRPCError({ code: 'CONFLICT', message: 'CODE_RACE' });

        if (row.rewardType === 'credits') {
          appliedKind = 'credits';
          const amount = row.creditsAmount ?? 0;
          await tx
            .insert(creditAccounts)
            .values({ balance: 0, totalCredited: 0, totalDebited: 0, userId })
            .onConflictDoNothing({ target: creditAccounts.userId });
          await tx
            .update(creditAccounts)
            .set({
              balance: sql`${creditAccounts.balance} + ${amount}`,
              totalCredited: sql`${creditAccounts.totalCredited} + ${amount}`,
              updatedAt: new Date(),
            })
            .where(eq(creditAccounts.userId, userId));
          const [account] = await tx
            .select({ balance: creditAccounts.balance })
            .from(creditAccounts)
            .where(eq(creditAccounts.userId, userId));
          await tx.insert(creditLedgerEntries).values({
            amount,
            balanceAfter: account.balance,
            description: `Redemption code ${code}`,
            referenceId: row.id,
            referenceType: 'redemption_code',
            title: 'Redemption',
            type: 'topup',
            userId,
          });
          summary = { credits: amount };
        } else if (row.rewardType === 'topup_package') {
          appliedKind = 'topup_package';
          const pkg = await tx.query.topUpPackages.findFirst({
            where: eq(topUpPackages.id, row.topupPackageId!),
          });
          if (!pkg) throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOPUP_PACKAGE_MISSING' });
          if (!pkg.isActive)
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOPUP_PACKAGE_INACTIVE' });

          const commercial = new CommercialModel(ctx.serverDB, userId);
          const order = await commercial.createTopUpOrder({
            credits: Number(pkg.credits),
            redemptionCodeId: row.id,
            source: 'redemption',
          });
          await commercial.settleTopUpOrder(order.id);

          summary = { credits: Number(pkg.credits), packageId: pkg.id };
        } else {
          appliedKind = 'plan';
          if (!row.planKey || !row.planCycle) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'PLAN_REWARD_INVALID' });
          }

          await assertPlanRewardIsRedeemable(tx, row.planKey);

          const model = new CommercialModel(tx, userId);
          await model.grantPlanFromRedemptionCode({
            code,
            cycle: row.planCycle,
            durationMonths: row.planDurationMonths,
            redemptionCodeId: row.id,
            targetPlan: row.planKey as Plans,
            tx,
          });

          summary = {
            cycle: row.planCycle,
            durationMonths: row.planDurationMonths,
            plan: row.planKey,
          };
        }
      });

      return { ok: true, reward: appliedKind, summary };
    }),
});

// quiet unused-import linter (kept for future filters)
void or;
