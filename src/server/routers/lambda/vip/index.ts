import { z } from 'zod';

import { AuditLogModel } from '@/database/models/auditLog';
import { CreditTransactionModel } from '@/database/models/creditTransaction';
import { PlanModel } from '@/database/models/plan';
import { RedeemCodeModel } from '@/database/models/redeemCode';
import { UserCreditsModel } from '@/database/models/userCredits';
import { UserSubscriptionModel } from '@/database/models/userSubscription';
import { VipStatsModel } from '@/database/models/vipStats';
import { userSubscriptions } from '@/database/schemas';
import { adminProcedure, authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { checkRateLimit } from '@/server/modules/RateLimit';
import { getCachedEnabledPlans, invalidatePlansCache } from '@/server/modules/VipCache/planCache';

export const vipRouter = router({
  // ============ Public: get enabled plans (cached) ============
  getPlans: publicProcedure.use(serverDatabase).query(async ({ ctx }) => {
    return getCachedEnabledPlans(ctx.serverDB);
  }),

  // ============ User: get own subscription status ============
  getMySubscription: authedProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new UserSubscriptionModel(ctx.serverDB);
    return model.getActiveSubscription(ctx.userId);
  }),

  // ============ User: get own credits ============
  getMyCredits: authedProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new UserCreditsModel(ctx.serverDB);
    return model.getOrCreate(ctx.userId);
  }),

  // ============ User: get own transaction history ============
  getMyTransactions: authedProcedure
    .use(serverDatabase)
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const model = new CreditTransactionModel(ctx.serverDB);
      return model.getByUser(ctx.userId, input?.limit ?? 50, input?.offset ?? 0);
    }),

  // ============ User: get daily usage stats (U3) ============
  getMyDailyUsage: authedProcedure
    .use(serverDatabase)
    .input(
      z.object({ days: z.number().min(1).max(90).default(30) }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const model = new VipStatsModel(ctx.serverDB);
      return model.getDailyUsage(input?.days ?? 30, ctx.userId);
    }),

  // ============ User: get model breakdown stats (U3) ============
  getMyModelBreakdown: authedProcedure
    .use(serverDatabase)
    .input(
      z.object({ days: z.number().min(1).max(90).default(30) }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const model = new VipStatsModel(ctx.serverDB);
      return model.getModelBreakdown(ctx.userId, input?.days ?? 30);
    }),

  // ============ User: redeem a code (S1: rate limited) ============
  redeem: authedProcedure
    .use(serverDatabase)
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      // S1: Rate limit — 10 attempts per minute per user
      const { limited } = checkRateLimit(`redeem:${ctx.userId}`, 10, 60_000);
      if (limited) throw new Error('RATE_LIMITED');

      const model = new RedeemCodeModel(ctx.serverDB);
      return model.redeem(input.code, ctx.userId);
    }),

  // ============ Admin: get stats overview (O1) ============
  adminGetStats: adminProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new VipStatsModel(ctx.serverDB);
    return model.getStats();
  }),

  // ============ Admin: get all plans (including disabled) ============
  adminGetAllPlans: adminProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new PlanModel(ctx.serverDB);
    return model.getAll();
  }),

  // ============ Admin: create plan (S2: audited) ============
  adminCreatePlan: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1),
        description: z.string().optional(),
        priceMonthly: z.number().int().min(0).default(0),
        priceYearly: z.number().int().min(0).default(0),
        creditsPerMonth: z.number().int().min(0).default(0),
        features: z.record(z.any()).default({}),
        sort: z.number().int().default(0),
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const model = new PlanModel(ctx.serverDB);
      const result = await model.create(input);
      invalidatePlansCache();

      // S2: Audit log
      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'plan.create',
        targetType: 'plan',
        targetId: input.id,
        details: input,
      });

      return result;
    }),

  // ============ Admin: update plan (S2: audited) ============
  adminUpdatePlan: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        priceMonthly: z.number().int().min(0).optional(),
        priceYearly: z.number().int().min(0).optional(),
        creditsPerMonth: z.number().int().min(0).optional(),
        features: z.record(z.any()).optional(),
        sort: z.number().int().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const model = new PlanModel(ctx.serverDB);
      const result = await model.update(id, data);
      invalidatePlansCache();

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'plan.update',
        targetType: 'plan',
        targetId: id,
        details: data,
      });

      return result;
    }),

  // ============ Admin: delete plan (S2: audited) ============
  adminDeletePlan: adminProcedure
    .use(serverDatabase)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const model = new PlanModel(ctx.serverDB);
      await model.delete(input.id);
      invalidatePlansCache();

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'plan.delete',
        targetType: 'plan',
        targetId: input.id,
      });

      return { success: true };
    }),

  // ============ Admin: get all redeem codes ============
  adminGetRedeemCodes: adminProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const model = new RedeemCodeModel(ctx.serverDB);
    return model.getAll();
  }),

  // ============ Admin: create redeem code (S2: audited) ============
  adminCreateRedeemCode: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        code: z.string().min(4).max(32),
        creditsAmount: z.number().int().min(0).default(0),
        planId: z.string().nullable().optional(),
        planDurationDays: z.number().int().min(1).nullable().optional(),
        maxUses: z.number().int().min(1).default(1),
        expiresAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const model = new RedeemCodeModel(ctx.serverDB);
      const result = await model.create({ ...input, createdBy: ctx.userId });

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'redeemCode.create',
        targetType: 'redeemCode',
        targetId: result.id,
        details: input,
      });

      return result;
    }),

  // ============ Admin: delete redeem code (S2: audited) ============
  adminDeleteRedeemCode: adminProcedure
    .use(serverDatabase)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const model = new RedeemCodeModel(ctx.serverDB);
      await model.delete(input.id);

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'redeemCode.delete',
        targetType: 'redeemCode',
        targetId: input.id,
      });

      return { success: true };
    }),

  // ============ Admin: adjust user credits (S2: audited) ============
  adminAdjustCredits: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        userId: z.string().min(1),
        amount: z.number().int(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const creditsModel = new UserCreditsModel(ctx.serverDB);
      const txModel = new CreditTransactionModel(ctx.serverDB);

      if (input.amount > 0) {
        await creditsModel.addCredits(input.userId, input.amount);
      } else if (input.amount < 0) {
        const result = await creditsModel.deductCredits(input.userId, Math.abs(input.amount));
        if (!result) throw new Error('INSUFFICIENT_CREDITS');
      }

      await txModel.create({
        userId: input.userId,
        amount: input.amount,
        type: 'admin_adjust',
        description: input.description || `Admin adjustment by ${ctx.userId}`,
      });

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'credits.adjust',
        targetType: 'userCredits',
        targetId: input.userId,
        details: { amount: input.amount, description: input.description },
      });

      return creditsModel.getOrCreate(input.userId);
    }),

  // ============ Admin: grant subscription to user (S2: audited) ============
  adminGrantSubscription: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        userId: z.string().min(1),
        planId: z.string().min(1),
        durationDays: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + input.durationDays * 86400000);

      const [result] = await ctx.serverDB
        .insert(userSubscriptions)
        .values({
          userId: input.userId,
          planId: input.planId,
          status: 'active' as const,
          startedAt: now,
          expiresAt,
          paymentChannel: 'admin',
          externalId: `admin-grant-${ctx.userId}`,
        })
        .returning();

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'subscription.grant',
        targetType: 'userSubscription',
        targetId: result.id,
        details: input,
      });

      return result;
    }),

  // ============ Admin: bulk adjust credits (O2) ============
  adminBulkAdjustCredits: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        userIds: z.array(z.string().min(1)).min(1).max(100),
        amount: z.number().int(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const creditsModel = new UserCreditsModel(ctx.serverDB);
      const txModel = new CreditTransactionModel(ctx.serverDB);
      let successCount = 0;

      for (const userId of input.userIds) {
        try {
          if (input.amount > 0) {
            await creditsModel.addCredits(userId, input.amount);
          } else if (input.amount < 0) {
            const result = await creditsModel.deductCredits(userId, Math.abs(input.amount));
            if (!result) continue;
          }

          await txModel.create({
            userId,
            amount: input.amount,
            type: 'admin_adjust',
            description: input.description || `Bulk adjustment by ${ctx.userId}`,
          });

          successCount++;
        } catch {
          // skip failed users
        }
      }

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'credits.bulkAdjust',
        targetType: 'userCredits',
        details: { userIds: input.userIds, amount: input.amount, successCount },
      });

      return { successCount, totalRequested: input.userIds.length };
    }),

  // ============ Admin: bulk grant subscriptions (O2) ============
  adminBulkGrantSubscription: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        userIds: z.array(z.string().min(1)).min(1).max(100),
        planId: z.string().min(1),
        durationDays: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + input.durationDays * 86400000);
      let successCount = 0;

      for (const userId of input.userIds) {
        try {
          await ctx.serverDB
            .insert(userSubscriptions)
            .values({
              userId,
              planId: input.planId,
              status: 'active' as const,
              startedAt: now,
              expiresAt,
              paymentChannel: 'admin',
              externalId: `bulk-grant-${ctx.userId}`,
            });
          successCount++;
        } catch {
          // skip failed users
        }
      }

      const audit = new AuditLogModel(ctx.serverDB);
      await audit.create({
        actorId: ctx.userId,
        action: 'subscription.bulkGrant',
        targetType: 'userSubscription',
        details: { userIds: input.userIds, planId: input.planId, durationDays: input.durationDays, successCount },
      });

      return { successCount, totalRequested: input.userIds.length };
    }),

  // ============ Admin: export transactions CSV (O3) ============
  adminExportTransactions: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        userId: z.string().optional(),
        type: z.enum(['subscription_grant', 'usage_deduct', 'redeem', 'admin_adjust', 'referral']).optional(),
        limit: z.number().min(1).max(10000).default(5000),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const txModel = new CreditTransactionModel(ctx.serverDB);
      let transactions;

      if (input?.userId && input?.type) {
        transactions = await txModel.getByUserAndType(input.userId, input.type);
      } else if (input?.userId) {
        transactions = await txModel.getByUser(input.userId, input?.limit ?? 5000);
      } else {
        transactions = await txModel.getRecent(input?.limit ?? 5000);
      }

      // Return data in a format the frontend can convert to CSV
      return transactions;
    }),

  // ============ Admin: get audit logs ============
  adminGetAuditLogs: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const model = new AuditLogModel(ctx.serverDB);
      return model.getRecent(input?.limit ?? 100, input?.offset ?? 0);
    }),

  // ============ Admin: get daily usage stats for dashboard (O1) ============
  adminGetDailyUsage: adminProcedure
    .use(serverDatabase)
    .input(
      z.object({ days: z.number().min(1).max(90).default(30) }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const model = new VipStatsModel(ctx.serverDB);
      return model.getDailyUsage(input?.days ?? 30);
    }),
});
