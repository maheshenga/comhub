import { CommercialModel } from '@/database/models/commercial';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  type CreditAccountSummary,
  type CreditLedgerListResult,
  QueryCreditLedgerSchema,
} from '@/types/business';

const commercialProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      commercialModel: new CommercialModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const spendRouter = router({
  getAccountSummary: commercialProcedure.query(async ({ ctx }): Promise<CreditAccountSummary> => {
    return ctx.commercialModel.getCreditAccountSummary();
  }),

  listLedger: commercialProcedure
    .input(QueryCreditLedgerSchema)
    .query(async ({ ctx, input }): Promise<CreditLedgerListResult> => {
      return ctx.commercialModel.listCreditLedger(input);
    }),
});
