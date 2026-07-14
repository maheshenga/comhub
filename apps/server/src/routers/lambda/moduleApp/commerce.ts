import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ModuleAppPaymentService } from '@/business/server/module-apps/payments/service';
import { ModuleAppCommerceModel } from '@/database/models/moduleAppCommerce';
import { appEnv } from '@/envs/app';
import { createConfiguredModuleAppAlipayClient } from '@/server/services/moduleAppPayments/alipay/client';

import { getWorkspaceMembership, moduleAppProcedure } from './data';

const AppIdInputSchema = z.object({
  appId: z.string().uuid(),
});
const ModuleAppOrderListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});
const ProductIdInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  productId: z.string().uuid(),
  workspaceId: z.string().min(1).optional(),
});
const ProductQuoteInputSchema = ProductIdInputSchema.omit({ idempotencyKey: true });
const OrderIdInputSchema = z.object({ orderId: z.string().uuid() });
const ModuleAppPaymentInputSchema = OrderIdInputSchema.extend({
  subject: z.string().trim().min(1).max(240),
});
const ModuleAppCatalogInputSchema = z.object({ appId: z.string().uuid().optional() });
const ModuleAppLaunchInputSchema = AppIdInputSchema.extend({
  workspaceId: z.string().min(1).optional(),
});

export const moduleAppCommerceProcedures = {
  cancelOrder: moduleAppProcedure.input(OrderIdInputSchema).mutation(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).cancelOrder({
      orderId: input.orderId,
      purchaserUserId: ctx.userId,
    });
  }),

  createOrder: moduleAppProcedure.input(ProductIdInputSchema).mutation(async ({ ctx, input }) => {
    if (input.workspaceId) {
      const membership = await getWorkspaceMembership(ctx.serverDB, ctx.userId, input.workspaceId);
      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
      }
    }
    return new ModuleAppCommerceModel(ctx.serverDB).createOrder({
      idempotencyKey: input.idempotencyKey,
      productId: input.productId,
      purchaserUserId: ctx.userId,
      workspaceId: input.workspaceId,
    });
  }),

  createPayment: moduleAppProcedure
    .input(ModuleAppPaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!appEnv.MODULE_APP_ALIPAY_ENABLED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_alipay_disabled',
        });
      }
      if (!appEnv.MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_alipay_payment_creation_disabled',
        });
      }
      if (!appEnv.MODULE_APP_ALIPAY_NOTIFY_URL || !appEnv.MODULE_APP_ALIPAY_RETURN_URL) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_alipay_url_required',
        });
      }
      return new ModuleAppPaymentService(
        ctx.serverDB,
        createConfiguredModuleAppAlipayClient(),
      ).createPayment({
        notifyUrl: appEnv.MODULE_APP_ALIPAY_NOTIFY_URL,
        orderId: input.orderId,
        purchaserUserId: ctx.userId,
        returnUrl: appEnv.MODULE_APP_ALIPAY_RETURN_URL,
        rollout: {
          appIds: appEnv.MODULE_APP_RUNTIME_APP_ALLOWLIST,
          publisherIds: appEnv.MODULE_APP_PUBLISHER_ALLOWLIST,
        },
        subject: input.subject,
      });
    }),

  getLicense: moduleAppProcedure.input(ModuleAppLaunchInputSchema).query(async ({ ctx, input }) => {
    if (input.workspaceId) {
      const membership = await getWorkspaceMembership(ctx.serverDB, ctx.userId, input.workspaceId);
      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
      }
    }
    return new ModuleAppCommerceModel(ctx.serverDB).resolveLicense(
      input.workspaceId
        ? { appId: input.appId, workspaceId: input.workspaceId }
        : { appId: input.appId, userId: ctx.userId },
    );
  }),

  listCatalog: moduleAppProcedure
    .input(ModuleAppCatalogInputSchema)
    .query(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).listCatalog(input);
  }),

  listOrders: moduleAppProcedure
    .input(ModuleAppOrderListInputSchema)
    .query(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).listOrders({
      limit: input.limit,
      purchaserUserId: ctx.userId,
    });
  }),

  quoteProduct: moduleAppProcedure.input(ProductQuoteInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).quoteProduct(input);
  }),
};
