import {
  type PaymentMethodId,
  paymentMethodIdSchema,
  type PaymentProvider,
  paymentProviderSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { topUpOrders, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import {
  createOperationalPaymentConfig,
  getServerPaymentConfig,
} from '@/server/services/payments/config';
import { createPaymentAdapter } from '@/server/services/payments/factory';
import { TopUpPaymentService } from '@/server/services/payments/topUpPayment';

import { runRequiredAdminAuditExternalEffect } from './audit';

const ONLINE_PAYMENT_PROVIDERS = ['alipay', 'wechat_pay', 'zpay'] as const;
const TopUpPaymentStatusSchema = z.enum([
  'pending',
  'paid',
  'canceled',
  'expired',
  'failed',
  'refunded',
]);
const financeReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeRead);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

const ListTopUpPaymentsInputSchema = z
  .object({
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(200).default(50),
    orderId: z.string().uuid().optional(),
    provider: paymentProviderSchema.optional(),
    status: TopUpPaymentStatusSchema.optional(),
    userId: z.string().trim().min(1).max(255).optional(),
  })
  .optional()
  .default({ cursor: 0, limit: 50 });

const ReconcileTopUpPaymentInputSchema = z.object({ orderId: z.string().uuid() });
const ReconcilePendingTopUpPaymentsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
});

type OnlineTopUpOrder = {
  externalOrderId: null | string;
  id: string;
  idempotencyKey: null | string;
  metadata: null | Record<string, unknown>;
  provider: null | string;
  status: string;
  userId: string;
};

type TopUpPaymentListRow = {
  amount: string;
  createdAt: Date;
  credits: string;
  currency: string;
  externalOrderId: null | string;
  id: string;
  idempotencyKey: null | string;
  metadata: null | Record<string, unknown>;
  paidAt: Date | null;
  provider: null | string;
  status: z.infer<typeof TopUpPaymentStatusSchema>;
  updatedAt: Date;
  userEmail: null | string;
  userId: string;
  userName: null | string;
};

const parseOnlineTopUpOrder = (order: OnlineTopUpOrder) => {
  const provider = paymentProviderSchema.safeParse(order.provider);
  const method = paymentMethodIdSchema.safeParse(order.metadata?.method);
  const providerMatchesMethod =
    provider.success &&
    method.success &&
    ((provider.data === 'alipay' && method.data === 'alipay') ||
      (provider.data === 'wechat_pay' && method.data === 'wechat_pay') ||
      (provider.data === 'zpay' &&
        (method.data === 'zpay_alipay' || method.data === 'zpay_wechat')));

  if (!providerMatchesMethod || !order.idempotencyKey?.trim()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOP_UP_PAYMENT_ORDER_INVALID' });
  }

  return {
    idempotencyKey: order.idempotencyKey,
    method: method.data,
    provider: provider.data,
    userId: order.userId,
  };
};

const createTopUpPaymentService = async (db: LobeChatDatabase) => {
  const config = createOperationalPaymentConfig(await getServerPaymentConfig(db));

  return new TopUpPaymentService(db, (provider: PaymentProvider, method: PaymentMethodId) => {
    const adapter = createPaymentAdapter(config, method);
    if (adapter.provider !== provider) throw new Error('TOP_UP_PAYMENT_ADAPTER_MISMATCH');
    return adapter;
  });
};

const reconcileOrder = async (service: TopUpPaymentService, order: OnlineTopUpOrder) => {
  const validated = parseOnlineTopUpOrder(order);
  return service.reconcilePayment({
    idempotencyKey: validated.idempotencyKey,
    userId: validated.userId,
  });
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'TOP_UP_PAYMENT_RECONCILIATION_FAILED';

export const adminPaymentsRouter = router({
  listTopUpPayments: financeReadProcedure
    .input(ListTopUpPaymentsInputSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [
        inArray(topUpOrders.provider, [...ONLINE_PAYMENT_PROVIDERS]),
        input.orderId ? eq(topUpOrders.id, input.orderId) : undefined,
        input.provider ? eq(topUpOrders.provider, input.provider) : undefined,
        input.status ? eq(topUpOrders.status, input.status) : undefined,
        input.userId ? eq(topUpOrders.userId, input.userId) : undefined,
      ].filter(Boolean);

      const rows = await ctx.serverDB
        .select({
          amount: topUpOrders.amount,
          createdAt: topUpOrders.createdAt,
          credits: topUpOrders.credits,
          currency: topUpOrders.currency,
          externalOrderId: topUpOrders.externalOrderId,
          id: topUpOrders.id,
          idempotencyKey: topUpOrders.idempotencyKey,
          metadata: topUpOrders.metadata,
          paidAt: topUpOrders.paidAt,
          provider: topUpOrders.provider,
          status: topUpOrders.status,
          updatedAt: topUpOrders.updatedAt,
          userEmail: users.email,
          userId: topUpOrders.userId,
          userName: users.username,
        })
        .from(topUpOrders)
        .leftJoin(users, eq(users.id, topUpOrders.userId))
        .where(and(...conditions))
        .orderBy(desc(topUpOrders.createdAt), desc(topUpOrders.id))
        .limit(input.limit + 1)
        .offset(input.cursor);

      const hasMore = rows.length > input.limit;
      const pageRows = (hasMore ? rows.slice(0, input.limit) : rows) as TopUpPaymentListRow[];
      const items = pageRows.map(({ metadata, provider: rawProvider, ...row }) => {
        const method = paymentMethodIdSchema.safeParse(metadata?.method);
        const provider = paymentProviderSchema.parse(rawProvider);
        return {
          ...row,
          method: method.success ? method.data : null,
          packageId: typeof metadata?.packageId === 'string' ? metadata.packageId : null,
          paymentReference:
            typeof metadata?.paymentReference === 'string' ? metadata.paymentReference : null,
          provider,
        };
      });

      return { items, nextCursor: hasMore ? input.cursor + input.limit : null };
    }),

  reconcilePendingTopUpPayments: financeWriteProcedure
    .input(ReconcilePendingTopUpPaymentsInputSchema)
    .mutation(async ({ ctx, input }) => {
      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: (status, result) => ({
          action: 'top_up.pending_payments_reconciled',
          payload: {
            count: result?.count ?? 0,
            failedCount: result?.failedCount ?? 0,
            limit: input.limit,
            terminalStatus: status,
          },
          resourceId: 'pending-top-up-payments',
          resourceType: 'topUpPaymentReconciliation',
        }),
        effect: async () => {
          const orders = await ctx.serverDB
            .select({
              externalOrderId: topUpOrders.externalOrderId,
              id: topUpOrders.id,
              idempotencyKey: topUpOrders.idempotencyKey,
              metadata: topUpOrders.metadata,
              provider: topUpOrders.provider,
              status: topUpOrders.status,
              userId: topUpOrders.userId,
            })
            .from(topUpOrders)
            .where(
              and(
                eq(topUpOrders.status, 'pending'),
                inArray(topUpOrders.provider, [...ONLINE_PAYMENT_PROVIDERS]),
              ),
            )
            .orderBy(asc(topUpOrders.createdAt), asc(topUpOrders.id))
            .limit(input.limit);
          if (orders.length === 0) return { count: 0, failedCount: 0, results: [] };

          const service = await createTopUpPaymentService(ctx.serverDB);
          const results = [];
          for (const order of orders) {
            try {
              results.push({
                ok: true as const,
                orderId: order.id,
                result: await reconcileOrder(service, order),
              });
            } catch (error) {
              results.push({ error: errorMessage(error), ok: false as const, orderId: order.id });
            }
          }

          const failedCount = results.filter((item) => !item.ok).length;
          return { count: results.length, failedCount, results };
        },
        terminalStatus: (result) => (result.failedCount > 0 ? 'failed' : 'succeeded'),
      });
    }),

  reconcileTopUpPayment: financeWriteProcedure
    .input(ReconcileTopUpPaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.serverDB.query.topUpOrders.findFirst({
        where: eq(topUpOrders.id, input.orderId),
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'TOP_UP_ORDER_NOT_FOUND' });

      const validated = parseOnlineTopUpOrder(order);
      return runRequiredAdminAuditExternalEffect(ctx, {
        audit: (status, result) => ({
          action: 'top_up.payment_reconciled',
          payload: {
            provider: validated.provider,
            providerStatus: result?.providerStatus ?? null,
            status: result?.status ?? order.status,
            terminalStatus: status,
          },
          resourceId: order.id,
          resourceType: 'topUpPayment',
          targetUserId: order.userId,
        }),
        effect: async () => reconcileOrder(await createTopUpPaymentService(ctx.serverDB), order),
      });
    }),
});
