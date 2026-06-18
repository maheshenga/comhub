import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const paymentProcedure = authedProcedure.use(serverDatabase);

export const paymentRouter = router({
  createPaymentOrder: paymentProcedure
    .input(
      z.object({
        credits: z.number().int().optional(),
        packageId: z.string().optional(),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      });
    }),

  handlePaymentCallback: paymentProcedure
    .input(
      z.object({
        orderId: z.string(),
        provider: z.enum(['alipay', 'wechat_pay']),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      });
    }),
});
