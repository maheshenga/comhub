import type { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { CommercialModel } from '@/database/models/commercial';
import { subscriptionChangeRequests, userPlanSnapshots } from '@/database/schemas';
import type { Transaction } from '@/database/type';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';

import { syncExpiredSubscriptionsToFree } from '../../subscriptionMaintenance';
import { recordAdminAudit } from './audit';

const CHANGE_REQUEST_STATUSES = ['pending', 'completed', 'canceled', 'rejected'] as const;
const SUBSCRIPTION_CYCLES = ['monthly', 'yearly', 'one_time', 'lifetime'] as const;
const financeReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeRead);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

export const adminSubscriptionsRouter = router({
  assignPlan: financeWriteProcedure
    .input(
      z.object({
        cycle: z.enum(SUBSCRIPTION_CYCLES),
        durationMonths: z.number().int().min(1).max(120),
        plan: z.string().min(1),
        reason: z.string().min(1).max(500),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const model = new CommercialModel(ctx.serverDB, input.userId);
      const assignedAt = Date.now();
      const adminSubscriptionId = `admin-${ctx.userId}-${assignedAt}`;
      const request = await ctx.serverDB.transaction((tx: Transaction) =>
        model.grantPlanManually({
          assignedByUserId: ctx.userId,
          cycle: input.cycle,
          durationMonths: input.durationMonths,
          manualGrantId: adminSubscriptionId,
          reason: input.reason,
          targetPlan: input.plan as Plans,
          tx,
        }),
      );

      await recordAdminAudit(ctx, {
        action: 'subscription.assignPlan',
        payload: {
          cycle: input.cycle,
          durationMonths: input.durationMonths,
          plan: input.plan,
          reason: input.reason,
          requestId: request.id,
        },
        resourceType: 'subscription',
        targetUserId: input.userId,
      });

      return { ok: true, requestId: request.id };
    }),

  forceChange: financeWriteProcedure
    .input(
      z.object({
        cycle: z.enum(SUBSCRIPTION_CYCLES),
        plan: z.string().min(1),
        reason: z.string().max(500),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const model = new CommercialModel(ctx.serverDB, input.userId);
      const request = await model.createSubscriptionChangeRequest({
        cycle: input.cycle,
        targetPlan: input.plan as Plans,
      });
      await model.activateSubscriptionChangeRequest(request.id);
      await recordAdminAudit(ctx, {
        action: 'subscription.forceChange',
        payload: { cycle: input.cycle, plan: input.plan, reason: input.reason },
        resourceType: 'subscription',
        targetUserId: input.userId,
      });
      return { ok: true };
    }),

  getUserSubscription: financeReadProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await syncExpiredSubscriptionsToFree(ctx.serverDB);

      const snapshot = await ctx.serverDB.query.userPlanSnapshots.findFirst({
        orderBy: desc(userPlanSnapshots.createdAt),
        where: eq(userPlanSnapshots.userId, input.userId),
      });
      return snapshot ?? null;
    }),

  list: financeReadProcedure
    .input(
      z.object({
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(20),
        plan: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await syncExpiredSubscriptionsToFree(ctx.serverDB);

      const { cursor, limit, plan } = input;
      const where = plan ? eq(userPlanSnapshots.plan, plan as Plans) : undefined;

      const [items, [{ value: total }]] = await Promise.all([
        ctx.serverDB.query.userPlanSnapshots.findMany({
          limit,
          offset: cursor,
          orderBy: desc(userPlanSnapshots.createdAt),
          where,
        }),
        where
          ? ctx.serverDB.select({ value: count() }).from(userPlanSnapshots).where(where)
          : ctx.serverDB.select({ value: count() }).from(userPlanSnapshots),
      ]);

      const nextCursor = items.length === limit ? cursor + limit : null;
      return { items, nextCursor, total };
    }),

  // ---- Subscription Change Requests ----
  listChangeRequests: financeReadProcedure
    .input(
      z.object({
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
        status: z.enum(CHANGE_REQUEST_STATUSES).optional(),
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, status, userId } = input;
      const conds = [
        status ? eq(subscriptionChangeRequests.status, status) : undefined,
        userId ? eq(subscriptionChangeRequests.userId, userId) : undefined,
      ].filter(Boolean) as Array<Exclude<ReturnType<typeof eq>, undefined>>;
      const where = conds.length > 0 ? and(...conds) : undefined;

      const [items, [{ value: total }]] = await Promise.all([
        ctx.serverDB.query.subscriptionChangeRequests.findMany({
          limit,
          offset: cursor,
          orderBy: desc(subscriptionChangeRequests.createdAt),
          where,
        }),
        ctx.serverDB.select({ value: count() }).from(subscriptionChangeRequests).where(where),
      ]);

      return {
        items,
        nextCursor: items.length === limit ? cursor + limit : null,
        total,
      };
    }),

  approveChangeRequest: financeWriteProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.serverDB.query.subscriptionChangeRequests.findFirst({
        where: eq(subscriptionChangeRequests.id, input.requestId),
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' });
      if (request.status !== 'pending')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Request is not pending' });

      const model = new CommercialModel(ctx.serverDB, request.userId);
      await model.activateSubscriptionChangeRequest(request.id);

      await recordAdminAudit(ctx, {
        action: 'subscription.changeRequest.approve',
        payload: { cycle: request.cycle, fromPlan: request.fromPlan, toPlan: request.toPlan },
        resourceId: request.id,
        resourceType: 'subscription_change_request',
        targetUserId: request.userId,
      });
      return { ok: true };
    }),

  rejectChangeRequest: financeWriteProcedure
    .input(
      z.object({
        reason: z.string().max(500).optional(),
        requestId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.serverDB.query.subscriptionChangeRequests.findFirst({
        where: eq(subscriptionChangeRequests.id, input.requestId),
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' });
      if (request.status !== 'pending')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Request is not pending' });

      await ctx.serverDB
        .update(subscriptionChangeRequests)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(subscriptionChangeRequests.id, request.id));

      await recordAdminAudit(ctx, {
        action: 'subscription.changeRequest.reject',
        payload: { cycle: request.cycle, reason: input.reason, toPlan: request.toPlan },
        resourceId: request.id,
        resourceType: 'subscription_change_request',
        targetUserId: request.userId,
      });
      return { ok: true };
    }),

  bulkApproveChangeRequests: financeWriteProcedure
    .input(z.object({ requestIds: z.array(z.string().min(1)).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const results: { error?: string; ok: boolean; requestId: string }[] = [];
      for (const requestId of input.requestIds) {
        try {
          const request = await ctx.serverDB.query.subscriptionChangeRequests.findFirst({
            where: eq(subscriptionChangeRequests.id, requestId),
          });
          if (!request) throw new Error('NOT_FOUND');
          if (request.status !== 'pending') throw new Error('NOT_PENDING');
          const model = new CommercialModel(ctx.serverDB, request.userId);
          await model.activateSubscriptionChangeRequest(request.id);
          results.push({ ok: true, requestId });
        } catch (err) {
          results.push({ error: (err as Error).message, ok: false, requestId });
        }
      }
      await recordAdminAudit(ctx, {
        action: 'subscription.changeRequest.bulkApprove',
        payload: {
          failed: results.filter((r) => !r.ok).length,
          succeeded: results.filter((r) => r.ok).length,
          total: results.length,
        },
        resourceType: 'subscription_change_request',
      });
      return { results };
    }),

  bulkRejectChangeRequests: financeWriteProcedure
    .input(
      z.object({
        reason: z.string().max(500).optional(),
        requestIds: z.array(z.string().min(1)).min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { error?: string; ok: boolean; requestId: string }[] = [];
      for (const requestId of input.requestIds) {
        try {
          const request = await ctx.serverDB.query.subscriptionChangeRequests.findFirst({
            where: eq(subscriptionChangeRequests.id, requestId),
          });
          if (!request) throw new Error('NOT_FOUND');
          if (request.status !== 'pending') throw new Error('NOT_PENDING');
          await ctx.serverDB
            .update(subscriptionChangeRequests)
            .set({ status: 'rejected', updatedAt: new Date() })
            .where(eq(subscriptionChangeRequests.id, request.id));
          results.push({ ok: true, requestId });
        } catch (err) {
          results.push({ error: (err as Error).message, ok: false, requestId });
        }
      }
      await recordAdminAudit(ctx, {
        action: 'subscription.changeRequest.bulkReject',
        payload: {
          failed: results.filter((r) => !r.ok).length,
          reason: input.reason,
          succeeded: results.filter((r) => r.ok).length,
          total: results.length,
        },
        resourceType: 'subscription_change_request',
      });
      return { results };
    }),
});
