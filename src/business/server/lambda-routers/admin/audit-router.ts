import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { adminAuditLogs } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

export const adminAuditRouter = router({
  list: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        actorUserId: z.string().optional(),
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
        targetUserId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { action, actorUserId, cursor, limit, targetUserId } = input;
      const conditions = [
        action ? eq(adminAuditLogs.action, action) : undefined,
        actorUserId ? eq(adminAuditLogs.actorUserId, actorUserId) : undefined,
        targetUserId ? eq(adminAuditLogs.targetUserId, targetUserId) : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ value: total }]] = await Promise.all([
        ctx.serverDB.query.adminAuditLogs.findMany({
          limit,
          offset: cursor,
          orderBy: desc(adminAuditLogs.createdAt),
          where,
        }),
        ctx.serverDB.select({ value: count() }).from(adminAuditLogs).where(where),
      ]);

      return {
        items,
        nextCursor: items.length === limit ? cursor + limit : null,
        total,
      };
    }),

  exportAll: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        actorUserId: z.string().optional(),
        limit: z.number().int().min(1).max(10_000).default(5000),
        targetUserId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { action, actorUserId, limit, targetUserId } = input;
      const conditions = [
        action ? eq(adminAuditLogs.action, action) : undefined,
        actorUserId ? eq(adminAuditLogs.actorUserId, actorUserId) : undefined,
        targetUserId ? eq(adminAuditLogs.targetUserId, targetUserId) : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await ctx.serverDB.query.adminAuditLogs.findMany({
        limit,
        orderBy: desc(adminAuditLogs.createdAt),
        where,
      });

      return { items };
    }),
});
