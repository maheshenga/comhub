import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { normalizePlanCatalogPresentation } from '@/const/billingPresentation';
import {
  creditAccounts,
  NEWAPI_MODEL_TYPES,
  planCatalog,
  redemptionCodes,
  userPlanSnapshots,
} from '@/database/schemas';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

const ModelTypeEnum = z.enum(NEWAPI_MODEL_TYPES);

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
  badge: z.string().max(80).optional(),
  comparisonNote: z.string().max(240).optional(),
  displayName: z.string().min(1).max(200),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  modelRules: PlanModelRulesSchema,
  lifetimePrice: z.number().min(0).nullable().optional(),
  monthlyCredits: z.number().min(0),
  monthlyPrice: z.number().min(0),
  oneTimePrice: z.number().min(0).nullable().optional(),
  plan: z.nativeEnum(Plans),
  pptCreditCost: z.number().min(0).optional(),
  pptEnabled: z.boolean().optional(),
  pptMonthlyQuota: z.number().min(0).nullable().optional(),
  purchaseUrl: z.string().max(2048).optional(),
  sortOrder: z.number().default(0),
  storageQuotaMb: z.number().min(0).nullable().optional(),
  vectorQuota: z.number().min(0).nullable().optional(),
  yearlyDiscountLabel: z.string().max(80).optional(),
  yearlyPrice: z.number().min(0),
});

const toStorageQuotaBytes = (storageQuotaMb?: null | number) =>
  storageQuotaMb === null || storageQuotaMb === undefined
    ? null
    : Math.floor(storageQuotaMb * 1024 * 1024);

const financeReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeRead);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

type PlanCatalogAuditRow = Partial<typeof planCatalog.$inferSelect>;

const toPlanCatalogAuditSnapshot = (row?: PlanCatalogAuditRow | null) => {
  if (!row) return null;

  return Object.fromEntries(
    Object.entries({
      currency: row.currency,
      displayName: row.displayName,
      features: row.features,
      isActive: row.isActive,
      metadata: row.metadata ?? null,
      modelRules: row.modelRules ?? null,
      monthlyCredits: row.monthlyCredits,
      monthlyPrice: row.monthlyPrice,
      plan: row.plan,
      sortOrder: row.sortOrder,
      yearlyPrice: row.yearlyPrice,
    }).filter(([, value]) => value !== undefined),
  );
};

export const adminPlansRouter = router({
  delete: financeWriteProcedure
    .input(z.object({ plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const activeSnapshot = await ctx.serverDB.query.userPlanSnapshots.findFirst({
        columns: { id: true },
        where: and(
          eq(userPlanSnapshots.plan, input.plan as Plans),
          eq(userPlanSnapshots.status, 'active'),
        ),
      });

      if (activeSnapshot) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'PLAN_HAS_ACTIVE_USERS',
        });
      }

      const referencingCode = await ctx.serverDB.query.redemptionCodes.findFirst({
        columns: { id: true },
        where: and(eq(redemptionCodes.rewardType, 'plan'), eq(redemptionCodes.planKey, input.plan)),
      });

      if (referencingCode) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'PLAN_HAS_REDEMPTION_CODES',
        });
      }

      const existing = await ctx.serverDB.query.planCatalog.findFirst({
        where: eq(planCatalog.plan, input.plan),
      });

      await ctx.serverDB.delete(planCatalog).where(eq(planCatalog.plan, input.plan));
      await recordAdminAudit(ctx, {
        action: 'plan.delete',
        payload: {
          after: null,
          before: toPlanCatalogAuditSnapshot(existing),
        },
        resourceId: input.plan,
        resourceType: 'plan_catalog',
      });
      return { ok: true };
    }),

  list: financeReadProcedure.query(async ({ ctx }) => {
    const items = await ctx.serverDB.query.planCatalog.findMany({
      orderBy: asc(planCatalog.sortOrder),
    });
    return { items };
  }),

  setModelRules: financeWriteProcedure
    .input(z.object({ modelRules: PlanModelRulesSchema, plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB.query.planCatalog.findFirst({
        where: eq(planCatalog.plan, input.plan),
      });

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });

      const nextPlanCatalog = { ...existing, modelRules: input.modelRules ?? null };
      const result = await ctx.serverDB
        .update(planCatalog)
        .set({ modelRules: input.modelRules ?? null, updatedAt: new Date() })
        .where(eq(planCatalog.plan, input.plan))
        .returning({ plan: planCatalog.plan });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });

      await recordAdminAudit(ctx, {
        action: 'plan.setModelRules',
        payload: {
          after: toPlanCatalogAuditSnapshot(nextPlanCatalog),
          before: toPlanCatalogAuditSnapshot(existing),
          modelRules: input.modelRules,
        },
        resourceId: input.plan,
        resourceType: 'plan_catalog',
      });
      return { ok: true };
    }),

  upsert: financeWriteProcedure.input(PlanInputSchema).mutation(async ({ ctx, input }) => {
    const {
      badge,
      comparisonNote,
      lifetimePrice,
      pptCreditCost,
      pptEnabled,
      pptMonthlyQuota,
      oneTimePrice,
      purchaseUrl,
      storageQuotaMb,
      vectorQuota,
      yearlyDiscountLabel,
      ...planInput
    } = input;
    const existing = await ctx.serverDB.query.planCatalog.findFirst({
      where: eq(planCatalog.plan, planInput.plan),
    });
    const normalizedPurchaseUrl = normalizePurchaseUrl(purchaseUrl);
    const previousMetadata =
      existing?.metadata &&
      typeof existing.metadata === 'object' &&
      !Array.isArray(existing.metadata)
        ? existing.metadata
        : {};
    const presentation = normalizePlanCatalogPresentation({
      ...previousMetadata,
      badge,
      comparisonNote,
      pptCreditCost,
      pptEnabled,
      pptMonthlyQuota,
      storageQuotaMb,
      vectorQuota,
      yearlyDiscountLabel,
    });
    const metadata = {
      ...previousMetadata,
      ...presentation,
      ...(lifetimePrice === undefined ? {} : { lifetimePrice }),
      ...(oneTimePrice === undefined ? {} : { oneTimePrice }),
      ...(normalizedPurchaseUrl ? { purchaseUrl: normalizedPurchaseUrl } : {}),
    };
    if (!normalizedPurchaseUrl) delete metadata.purchaseUrl;

    const nextPlanCatalog = { ...planInput, metadata };

    if (existing) {
      await ctx.serverDB
        .update(planCatalog)
        .set({ ...nextPlanCatalog, updatedAt: new Date() })
        .where(eq(planCatalog.plan, planInput.plan));
    } else {
      await ctx.serverDB.insert(planCatalog).values(nextPlanCatalog);
    }

    const activeSnapshots = await ctx.serverDB.query.userPlanSnapshots.findMany({
      columns: { userId: true },
      where: and(
        eq(userPlanSnapshots.plan, planInput.plan),
        eq(userPlanSnapshots.status, 'active'),
      ),
    });
    const activeUserIds = Array.from(
      new Set(activeSnapshots.map((snapshot: { userId: string }) => snapshot.userId)),
    );
    const quotaAudit = {
      storageQuota: toStorageQuotaBytes(storageQuotaMb),
      vectorQuota: vectorQuota ?? null,
    };
    if (activeUserIds.length > 0) {
      const quotaUpdate = {
        ...quotaAudit,
        updatedAt: new Date(),
      };

      await ctx.serverDB
        .insert(creditAccounts)
        .values(
          activeUserIds.map((userId) => ({
            ...quotaUpdate,
            userId,
          })),
        )
        .onConflictDoUpdate({
          set: quotaUpdate,
          target: creditAccounts.userId,
        });
    }

    await recordAdminAudit(ctx, {
      action: existing ? 'plan.update' : 'plan.create',
      payload: {
        ...planInput,
        activeUserCount: activeUserIds.length,
        after: toPlanCatalogAuditSnapshot(nextPlanCatalog),
        before: toPlanCatalogAuditSnapshot(existing),
        ...(lifetimePrice === undefined ? {} : { lifetimePrice }),
        ...(oneTimePrice === undefined ? {} : { oneTimePrice }),
        pptCreditCost: pptCreditCost ?? 0,
        pptEnabled: pptEnabled === true,
        pptMonthlyQuota: pptMonthlyQuota ?? null,
        purchaseUrl: normalizedPurchaseUrl,
        quotaUpdate: quotaAudit,
        storageQuotaMb: storageQuotaMb ?? null,
        vectorQuota: vectorQuota ?? null,
      },
      resourceId: planInput.plan,
      resourceType: 'plan_catalog',
    });
    return { ok: true };
  }),

  setActive: financeWriteProcedure
    .input(z.object({ isActive: z.boolean(), plan: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB.query.planCatalog.findFirst({
        where: eq(planCatalog.plan, input.plan),
      });

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });

      const nextPlanCatalog = { ...existing, isActive: input.isActive };
      const result = await ctx.serverDB
        .update(planCatalog)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(planCatalog.plan, input.plan))
        .returning({ plan: planCatalog.plan });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      await recordAdminAudit(ctx, {
        action: 'plan.setActive',
        payload: {
          after: toPlanCatalogAuditSnapshot(nextPlanCatalog),
          before: toPlanCatalogAuditSnapshot(existing),
          isActive: input.isActive,
        },
        resourceId: input.plan,
        resourceType: 'plan_catalog',
      });
      return { ok: true };
    }),
});
