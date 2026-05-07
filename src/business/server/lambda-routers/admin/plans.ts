import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { planCatalog } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

const ModelTypeEnum = z.enum([
  'chat',
  'embedding',
  'tts',
  'stt',
  'image',
  'video',
  'text2music',
  'realtime',
]);

const PlanModelRuleSchema = z.object({
  allowlist: z.array(z.string()).optional(),
  blocklist: z.array(z.string()).optional(),
  mode: z.enum(['allowlist', 'blocklist']),
});

const PlanModelRulesSchema = z.record(ModelTypeEnum, PlanModelRuleSchema).optional();

const normalizePurchaseUrl = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  try {
    const url = new URL(raw);

    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
};

const PlanInputSchema = z.object({
  currency: z.string().max(16).default('USD'),
  displayName: z.string().min(1).max(200),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  modelRules: PlanModelRulesSchema,
  monthlyCredits: z.number().min(0),
  monthlyPrice: z.number().min(0),
  plan: z.nativeEnum(Plans),
  purchaseUrl: z.string().max(2048).optional(),
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

  setModelRules: adminProcedure
    .input(z.object({ modelRules: PlanModelRulesSchema, plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.serverDB
        .update(planCatalog)
        .set({ modelRules: input.modelRules ?? null, updatedAt: new Date() })
        .where(eq(planCatalog.plan, input.plan))
        .returning({ plan: planCatalog.plan });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });

      await recordAdminAudit(ctx, {
        action: 'plan.setModelRules',
        payload: { modelRules: input.modelRules },
        resourceId: input.plan,
        resourceType: 'plan_catalog',
      });
      return { ok: true };
    }),

  upsert: adminProcedure.input(PlanInputSchema).mutation(async ({ ctx, input }) => {
    const { purchaseUrl, ...planInput } = input;
    const existing = await ctx.serverDB.query.planCatalog.findFirst({
      where: eq(planCatalog.plan, planInput.plan),
    });
    const normalizedPurchaseUrl = normalizePurchaseUrl(purchaseUrl);
    const previousMetadata =
      existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
    const metadata = {
      ...previousMetadata,
      ...(normalizedPurchaseUrl ? { purchaseUrl: normalizedPurchaseUrl } : {}),
    };
    if (!normalizedPurchaseUrl) delete metadata.purchaseUrl;

    if (existing) {
      await ctx.serverDB
        .update(planCatalog)
        .set({ ...planInput, metadata, updatedAt: new Date() })
        .where(eq(planCatalog.plan, planInput.plan));
    } else {
      await ctx.serverDB.insert(planCatalog).values({ ...planInput, metadata });
    }
    await recordAdminAudit(ctx, {
      action: existing ? 'plan.update' : 'plan.create',
      payload: { ...planInput, purchaseUrl: normalizedPurchaseUrl },
      resourceId: planInput.plan,
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
