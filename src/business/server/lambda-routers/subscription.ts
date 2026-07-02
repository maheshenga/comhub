import { asc, desc, eq } from 'drizzle-orm';

import { normalizePlanCatalogPresentation } from '@/const/billingPresentation';
import { CommercialModel } from '@/database/models/commercial';
import { planCatalog, userPlanSnapshots } from '@/database/schemas';
import { type PlanModelRules } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  type CommercialOverview,
  type QueryCommercialListParams,
  QueryCommercialListSchema,
  type SubscriptionChangeRequestItem,
  type SubscriptionSummary,
} from '@/types/business';

import { resolvePlanModelRules } from '../planModelRules';

const getPlanPurchaseUrl = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).purchaseUrl;
  const purchaseUrl = typeof raw === 'string' ? raw.trim() : '';
  if (!purchaseUrl) return null;

  try {
    const url = new URL(purchaseUrl);

    return url.protocol === 'http:' || url.protocol === 'https:' ? purchaseUrl : null;
  } catch {
    return null;
  }
};

const commercialProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      commercialModel: new CommercialModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const subscriptionRouter = router({
  getOverview: commercialProcedure.query(async ({ ctx }): Promise<CommercialOverview> => {
    return ctx.commercialModel.getCommercialOverview();
  }),

  getSummary: commercialProcedure.query(async ({ ctx }): Promise<SubscriptionSummary> => {
    return ctx.commercialModel.getSubscriptionSummary();
  }),

  getPendingChangeRequest: commercialProcedure.query(
    async ({ ctx }): Promise<SubscriptionChangeRequestItem | null> => {
      return ctx.commercialModel.getPendingSubscriptionChangeRequest();
    },
  ),

  listChangeRequests: commercialProcedure
    .input(QueryCommercialListSchema.default({}))
    .query(async ({ ctx, input }): Promise<SubscriptionChangeRequestItem[]> => {
      return ctx.commercialModel.listSubscriptionChangeRequests(
        input satisfies QueryCommercialListParams,
      );
    }),

  listPlanCatalog: authedProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const rows = await ctx.serverDB.query.planCatalog.findMany({
      orderBy: asc(planCatalog.sortOrder),
      where: eq(planCatalog.isActive, true),
    });

    return rows.map((r) => ({
      currency: r.currency,
      displayName: r.displayName,
      features: (r.features ?? []) as string[],
      modelRules: r.modelRules as PlanModelRules | null,
      monthlyCredits: Number(r.monthlyCredits),
      monthlyPrice: Number(r.monthlyPrice),
      plan: r.plan,
      purchaseUrl: getPlanPurchaseUrl(r.metadata),
      ...normalizePlanCatalogPresentation(r.metadata),
      sortOrder: Number(r.sortOrder),
      yearlyPrice: Number(r.yearlyPrice),
    }));
  }),

  getCurrentPlanModelRules: authedProcedure
    .use(serverDatabase)
    .query(async ({ ctx }): Promise<{ modelRules: PlanModelRules | null; plan: string | null }> => {
      const snapshot = await ctx.serverDB.query.userPlanSnapshots.findFirst({
        orderBy: desc(userPlanSnapshots.createdAt),
        where: eq(userPlanSnapshots.userId, ctx.userId),
      });
      const modelRules = await resolvePlanModelRules({ db: ctx.serverDB, userId: ctx.userId });
      return {
        modelRules,
        plan: snapshot?.plan ?? null,
      };
    }),
});
