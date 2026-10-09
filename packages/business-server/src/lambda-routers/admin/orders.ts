import { TRPCError } from '@trpc/server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { z } from 'zod';

import { CommercialModel } from '@/database/models/commercial';
import { redemptionCodes, topUpOrders, users } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';

import { createAdminCommand } from './adminCommand';
import { recordAdminAudit, recordAdminAuditStrict, runRequiredAdminAuditMutation } from './audit';

const OrderStatusSchema = z.enum(['pending', 'paid', 'canceled', 'expired', 'failed', 'refunded']);
const financeReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeRead);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);
const cancelCommand = createAdminCommand('order.cancel');
const expireCommand = createAdminCommand('order.expire');
const settleCommand = createAdminCommand('order.settle');
const bulkCancelCommand = createAdminCommand('order.bulkCancel');
const bulkExpireCommand = createAdminCommand('order.bulkExpire');
const redemptionOrderCondition = or(
  eq(topUpOrders.source, 'redemption'),
  eq(topUpOrders.provider, 'redemption'),
  isNotNull(topUpOrders.redemptionCodeId),
);

type BulkOrderResult = { error?: string; ok: boolean; orderId: string };

type BulkOrderDryRunResult = {
  batchCorrelationId: null;
  dryRun: true;
  matched: number;
  results: Array<{
    error: null | string;
    ok: boolean;
    orderId: string;
    preview: null | {
      amount: number;
      currency: string;
      userEmail: null | string;
      userId: string;
    };
    requiresReconciliation: boolean;
  }>;
  total: number;
  unmatchedOrderIds: string[];
};

type AdminMutationContext = { clientIp?: null | string; userId: string };

const recordBulkOrderItemAudit = async ({
  action,
  batchCorrelationId,
  ctx,
  error,
  order,
  orderId,
  tx,
}: {
  action: 'cancel' | 'expire';
  batchCorrelationId: string;
  ctx: AdminMutationContext;
  error?: string;
  order?: typeof topUpOrders.$inferSelect;
  orderId: string;
  tx: Transaction;
}) =>
  recordAdminAuditStrict(
    { ...ctx, serverDB: tx },
    {
      action: `order.bulk${action === 'cancel' ? 'Cancel' : 'Expire'}.item`,
      payload: {
        ...(order ? { provider: order.provider, source: order.source } : {}),
        error: error ?? null,
        batchCorrelationId,
        result: error ? 'failed' : 'succeeded',
      },
      resourceId: orderId,
      resourceType: 'top_up_order',
      targetUserId: order?.userId,
    },
    { correlationId: batchCorrelationId, status: error ? 'failed' : 'succeeded' },
  );

/**
 * Load pending redemption orders for a bulk cancel/expire batch (bulkApprove
 * template, subscriptions.ts): row-locked read, per-id failure results, max
 * 50 enforced at the input schema.
 */
const loadPendingRedemptionOrdersForBulk = async (
  tx: Transaction,
  orderIds: string[],
): Promise<Map<string, typeof topUpOrders.$inferSelect>> => {
  const orders = await tx
    .select()
    .from(topUpOrders)
    .where(inArray(topUpOrders.id, orderIds))
    .for('update');
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  for (const orderId of orderIds) {
    const order = ordersById.get(orderId);
    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'ORDER_NOT_FOUND' });
    }
    if (order.status !== 'pending') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'ORDER_NOT_PENDING' });
    }
    if (
      order.source !== 'redemption' &&
      order.provider !== 'redemption' &&
      !order.redemptionCodeId
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'ONLINE_PAYMENT_ORDER_REQUIRES_RECONCILIATION',
      });
    }
  }

  return ordersById;
};

const buildBulkOrderMutation = (action: 'cancel' | 'expire') => {
  const bulkCommand = action === 'cancel' ? bulkCancelCommand : bulkExpireCommand;
  return { bulkCommand };
};

const previewBulkOrders = async (
  db: LobeChatDatabase,
  orderIds: string[],
): Promise<BulkOrderDryRunResult> => {
  const orders: Array<{
    amount: number | string;
    currency: string;
    id: string;
    provider: null | string;
    redemptionCodeId: string | null;
    source: null | string;
    status: string;
    userEmail: null | string;
    userId: string;
  }> = await db
    .select({
      amount: topUpOrders.amount,
      currency: topUpOrders.currency,
      id: topUpOrders.id,
      provider: topUpOrders.provider,
      redemptionCodeId: topUpOrders.redemptionCodeId,
      source: topUpOrders.source,
      status: topUpOrders.status,
      userEmail: users.email,
      userId: topUpOrders.userId,
    })
    .from(topUpOrders)
    .leftJoin(users, eq(users.id, topUpOrders.userId))
    .where(inArray(topUpOrders.id, orderIds));

  const matchedIds = new Set(orders.map((order) => order.id));
  const ONLINE_PROVIDERS = new Set(['alipay', 'wechat_pay', 'zpay']);
  return {
    batchCorrelationId: null,
    dryRun: true,
    results: orderIds.map((orderId) => {
      const order = orders.find((item) => item.id === orderId);
      const eligible = Boolean(order && order.status === 'pending');
      const onlinePayment =
        !!order &&
        order.status === 'pending' &&
        order.source !== 'redemption' &&
        !order.redemptionCodeId &&
        ONLINE_PROVIDERS.has(order.provider ?? '');
      return {
        error: (order ? (eligible ? null : 'ORDER_NOT_PENDING') : 'ORDER_NOT_FOUND') as
          | string
          | null,
        ok: eligible,
        orderId,
        preview: order
          ? {
              amount: Number(order.amount),
              currency: order.currency,
              userEmail: order.userEmail,
              userId: order.userId,
            }
          : null,
        requiresReconciliation: eligible && onlinePayment,
      };
    }),
    total: orderIds.length,
    matched: orders.length,
    unmatchedOrderIds: orderIds.filter((id) => !matchedIds.has(id)),
  };
};

/** Per-item status flip inside the batch transaction; failures become item results. */
const applyBulkOrderStatusChange = async ({
  action,
  batchCorrelationId,
  ctx,
  nextStatus,
  orderIds,
  tx,
}: {
  action: 'cancel' | 'expire';
  batchCorrelationId: string;
  ctx: AdminMutationContext;
  nextStatus: 'canceled' | 'expired';
  orderIds: string[];
  tx: Transaction;
}): Promise<BulkOrderResult[]> => {
  const uniqueOrderIds = [...new Set(orderIds)];
  if (uniqueOrderIds.length !== orderIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'DUPLICATE_ORDER_IDS' });
  }
  const ordersById = await loadPendingRedemptionOrdersForBulk(tx, uniqueOrderIds);

  const results: BulkOrderResult[] = [];
  for (const orderId of uniqueOrderIds) {
    const order = ordersById.get(orderId)!;
    try {
      const [updated] = await tx
        .update(topUpOrders)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(and(eq(topUpOrders.id, orderId), eq(topUpOrders.status, 'pending')))
        .returning({ id: topUpOrders.id, userId: topUpOrders.userId });
      if (!updated) throw new Error('ORDER_NOT_PENDING');
      await recordBulkOrderItemAudit({ action, batchCorrelationId, ctx, order, orderId, tx });
      results.push({ ok: true, orderId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      await recordBulkOrderItemAudit({
        action,
        batchCorrelationId,
        ctx,
        error: message,
        order,
        orderId,
        tx,
      });
      results.push({ error: message, ok: false, orderId });
    }
  }
  return results;
};

const buildBulkOrderDryRunResult = (input: { dryRun?: boolean; orderIds: string[] }) => input;

const bulkOrderIdsSchema = z.array(z.string().min(1)).min(1).max(50);

const getPendingRedemptionOrder = async (
  tx: Transaction,
  orderId: string,
  unavailableMessage: 'ORDER_NOT_CANCELABLE' | 'ORDER_NOT_EXPIRABLE',
) => {
  const [order] = await tx
    .select({
      id: topUpOrders.id,
      provider: topUpOrders.provider,
      redemptionCodeId: topUpOrders.redemptionCodeId,
      source: topUpOrders.source,
      status: topUpOrders.status,
      userId: topUpOrders.userId,
    })
    .from(topUpOrders)
    .where(eq(topUpOrders.id, orderId))
    .limit(1);

  if (!order || order.status !== 'pending') throw new Error(unavailableMessage);
  if (order.source !== 'redemption' && order.provider !== 'redemption' && !order.redemptionCodeId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'ONLINE_PAYMENT_ORDER_REQUIRES_RECONCILIATION',
    });
  }

  return order;
};

export const adminOrdersRouter = router({
  bulkCancel: financeWriteProcedure
    .input(
      z.object({
        command: bulkCancelCommand.schema,
        dryRun: z.boolean().optional(),
        orderIds: bulkOrderIdsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const command = bulkCancelCommand.validate(input.command);
      const batchCorrelationId = randomUUID();

      // dryRun: read-only impact preview — no writes, no batch audit rows
      // (blueprint §5.2: dry-run 预检在确认弹窗展示命中清单).
      if (input.dryRun) {
        buildBulkOrderDryRunResult(input);
        return previewBulkOrders(ctx.serverDB, input.orderIds);
      }

      const results = await runRequiredAdminAuditMutation<BulkOrderResult[]>(ctx, {
        audit: (results) => ({
          action: command.auditAction,
          payload: {
            failed: results.filter((result) => !result.ok).length,
            succeeded: results.filter((result) => result.ok).length,
            total: results.length,
          },
          resourceType: 'top_up_order',
        }),
        mutation: (tx) =>
          applyBulkOrderStatusChange({
            action: 'cancel',
            batchCorrelationId,
            ctx,
            nextStatus: 'canceled',
            orderIds: input.orderIds,
            tx,
          }),
        correlationId: batchCorrelationId,
      });
      return { batchCorrelationId, dryRun: false, results };
    }),

  bulkExpire: financeWriteProcedure
    .input(
      z.object({
        command: bulkExpireCommand.schema,
        dryRun: z.boolean().optional(),
        orderIds: bulkOrderIdsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const command = bulkExpireCommand.validate(input.command);
      const batchCorrelationId = randomUUID();

      if (input.dryRun) {
        buildBulkOrderDryRunResult(input);
        return previewBulkOrders(ctx.serverDB, input.orderIds);
      }

      const results = await runRequiredAdminAuditMutation<BulkOrderResult[]>(ctx, {
        audit: (results) => ({
          action: command.auditAction,
          payload: {
            failed: results.filter((result) => !result.ok).length,
            succeeded: results.filter((result) => result.ok).length,
            total: results.length,
          },
          resourceType: 'top_up_order',
        }),
        mutation: (tx) =>
          applyBulkOrderStatusChange({
            action: 'expire',
            batchCorrelationId,
            ctx,
            nextStatus: 'expired',
            orderIds: input.orderIds,
            tx,
          }),
        correlationId: batchCorrelationId,
      });
      return { batchCorrelationId, dryRun: false, results };
    }),

  cancel: financeWriteProcedure
    .input(z.object({ command: cancelCommand.schema, orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const command = cancelCommand.validate(input.command);
      await runRequiredAdminAuditMutation<{ id: string; userId: string }>(ctx, {
        audit: (order) => ({
          action: command.auditAction,
          resourceId: input.orderId,
          resourceType: 'top_up_order',
          targetUserId: order.userId,
        }),
        mutation: async (tx) => {
          await getPendingRedemptionOrder(tx, input.orderId, 'ORDER_NOT_CANCELABLE');
          const [order] = await tx
            .update(topUpOrders)
            .set({ status: 'canceled', updatedAt: new Date() })
            .where(
              and(
                eq(topUpOrders.id, input.orderId),
                eq(topUpOrders.status, 'pending'),
                redemptionOrderCondition,
              ),
            )
            .returning({ id: topUpOrders.id, userId: topUpOrders.userId });

          if (!order) throw new Error('ORDER_NOT_CANCELABLE');
          return order;
        },
      });

      return { ok: true };
    }),

  expire: financeWriteProcedure
    .input(z.object({ command: expireCommand.schema, orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const command = expireCommand.validate(input.command);
      await runRequiredAdminAuditMutation<{ id: string; userId: string }>(ctx, {
        audit: (order) => ({
          action: command.auditAction,
          resourceId: input.orderId,
          resourceType: 'top_up_order',
          targetUserId: order.userId,
        }),
        mutation: async (tx) => {
          await getPendingRedemptionOrder(tx, input.orderId, 'ORDER_NOT_EXPIRABLE');
          const [order] = await tx
            .update(topUpOrders)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(
              and(
                eq(topUpOrders.id, input.orderId),
                eq(topUpOrders.status, 'pending'),
                redemptionOrderCondition,
              ),
            )
            .returning({ id: topUpOrders.id, userId: topUpOrders.userId });

          if (!order) throw new Error('ORDER_NOT_EXPIRABLE');
          return order;
        },
      });

      return { ok: true };
    }),

  getDetail: financeReadProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = ctx.serverDB;

      const [order] = await db
        .select({
          amount: topUpOrders.amount,
          createdAt: topUpOrders.createdAt,
          credits: topUpOrders.credits,
          currency: topUpOrders.currency,
          externalOrderId: topUpOrders.externalOrderId,
          id: topUpOrders.id,
          paidAt: topUpOrders.paidAt,
          provider: topUpOrders.provider,
          redemptionCodeId: topUpOrders.redemptionCodeId,
          source: topUpOrders.source,
          status: topUpOrders.status,
          updatedAt: topUpOrders.updatedAt,
          userEmail: users.email,
          userId: topUpOrders.userId,
          userFullName: users.fullName,
          userName: users.username,
        })
        .from(topUpOrders)
        .leftJoin(users, eq(topUpOrders.userId, users.id))
        .where(eq(topUpOrders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ORDER_NOT_FOUND' });
      }

      let redemptionCode = null;
      if (order.redemptionCodeId) {
        const [code] = await db
          .select()
          .from(redemptionCodes)
          .where(eq(redemptionCodes.id, order.redemptionCodeId))
          .limit(1);
        redemptionCode = code ?? null;
      }

      await recordAdminAudit(ctx, {
        action: 'order.getDetail',
        resourceId: input.orderId,
        resourceType: 'top_up_order',
      });

      return { ...order, redemptionCode };
    }),

  settle: financeWriteProcedure
    .input(
      z.object({
        command: settleCommand.schema,
        orderId: z.string().min(1),
        reason: z.string().trim().min(1).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const command = settleCommand.validate(input.command, input.reason);
      const [order] = await ctx.serverDB
        .select({
          amount: topUpOrders.amount,
          credits: topUpOrders.credits,
          currency: topUpOrders.currency,
          provider: topUpOrders.provider,
          redemptionCodeId: topUpOrders.redemptionCodeId,
          source: topUpOrders.source,
          userId: topUpOrders.userId,
        })
        .from(topUpOrders)
        .where(eq(topUpOrders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ORDER_NOT_FOUND' });
      }
      if (
        order.source !== 'redemption' &&
        order.provider !== 'redemption' &&
        !order.redemptionCodeId
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ONLINE_PAYMENT_ORDER_REQUIRES_RECONCILIATION',
        });
      }

      return runRequiredAdminAuditMutation<{ status: string }>(ctx, {
        audit: (result) => ({
          action: command.auditAction,
          payload: {
            amount: Number(order.amount),
            credits: Number(order.credits),
            currency: order.currency,
            provider: order.provider,
            reason: command.reason,
            source: order.source,
            status: result.status,
          },
          resourceId: input.orderId,
          resourceType: 'top_up_order',
          targetUserId: order.userId,
        }),
        mutation: async (tx) => {
          const commercial = new CommercialModel(tx, order.userId);
          return commercial.settleTopUpOrder(input.orderId);
        },
      });
    }),

  list: financeReadProcedure
    .input(
      z.object({
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
        status: OrderStatusSchema.optional(),
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
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
          paidAt: topUpOrders.paidAt,
          provider: topUpOrders.provider,
          redemptionCodeId: topUpOrders.redemptionCodeId,
          source: topUpOrders.source,
          status: topUpOrders.status,
          updatedAt: topUpOrders.updatedAt,
          userEmail: users.email,
          userId: topUpOrders.userId,
          userName: users.username,
        })
        .from(topUpOrders)
        .leftJoin(users, eq(users.id, topUpOrders.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(topUpOrders.createdAt), desc(topUpOrders.id))
        .limit(input.limit + 1)
        .offset(input.cursor);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;

      return {
        items,
        nextCursor: hasMore ? input.cursor + input.limit : null,
      };
    }),
});
