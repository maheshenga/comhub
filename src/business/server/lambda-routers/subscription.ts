import { asc, eq } from 'drizzle-orm';

import { CommercialModel } from '@/database/models/commercial';
import { planCatalog } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  type CommercialOverview,
  type QueryCommercialListParams,
  QueryCommercialListSchema,
  type SubscriptionChangeRequestItem,
  type SubscriptionSummary,
} from '@/types/business';

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
      monthlyCredits: Number(r.monthlyCredits),
      monthlyPrice: Number(r.monthlyPrice),
      plan: r.plan,
      sortOrder: Number(r.sortOrder),
      yearlyPrice: Number(r.yearlyPrice),
    }));
  }),
});
