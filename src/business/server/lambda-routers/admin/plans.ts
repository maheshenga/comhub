import { TRPCError } from '@trpc/server';
import { Plans } from '@lobechat/types';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { planCatalog } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

const PlanInputSchema = z.object({
  currency: z.string().max(16).default('USD'),
  displayName: z.string().min(1).max(200),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  monthlyCredits: z.number().min(0),
  monthlyPrice: z.number().min(0),
  plan: z.nativeEnum(Plans),
  sortOrder: z.number().default(0),
  yearlyPrice: z.number().min(0),
});

export const adminPlansRouter = router({
  delete: adminProcedure
    .input(z.object({ plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(planCatalog).where(eq(planCatalog.plan, input.plan));
      await recordAdminAudit(ctx, {
        action: 'plan.delete',
        resourceId: input.plan,
        resourceType: 'plan_catalog',
      });
      return { ok: true };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const items = await ctx.serverDB.query.planCatalog.findMany({
      orderBy: asc(planCatalog.sortOrder),
    });
    return { items };
  }),

  upsert: adminProcedure.input(PlanInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.serverDB.query.planCatalog.findFirst({
      where: eq(planCatalog.plan, input.plan),
    });

    if (existing) {
      await ctx.serverDB
        .update(planCatalog)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(planCatalog.plan, input.plan));
    } else {
      await ctx.serverDB.insert(planCatalog).values(input);
    }
    await recordAdminAudit(ctx, {
      action: existing ? 'plan.update' : 'plan.create',
      payload: input,
      resourceId: input.plan,
      resourceType: 'plan_catalog',
    });
    return { ok: true };
  }),

  setActive: adminProcedure
    .input(z.object({ isActive: z.boolean(), plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.serverDB
        .update(planCatalog)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(planCatalog.plan, input.plan))
        .returning({ plan: planCatalog.plan });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      await recordAdminAudit(ctx, {
        action: 'plan.setActive',
        payload: { isActive: input.isActive },
        resourceId: input.plan,
        resourceType: 'plan_catalog',
      });
      return { ok: true };
    }),
});
