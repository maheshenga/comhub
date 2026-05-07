import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, like, or } from 'drizzle-orm';
import { z } from 'zod';

import {
  adminAuditLogs,
  creditAccounts,
  creditLedgerEntries,
  topUpOrders,
  userPlanSnapshots,
  users,
} from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

export const adminUsersRouter = router({
  ban: adminProcedure
    .input(
      z.object({
        banReason: z.string().max(500).optional(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({ banReason: input.banReason ?? null, banned: true })
        .where(eq(users.id, input.userId));
      await recordAdminAudit(ctx, {
        action: 'user.ban',
        payload: { banReason: input.banReason ?? null },
        resourceType: 'user',
        targetUserId: input.userId,
      });
      return { ok: true };
    }),

  detail: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const u = await ctx.serverDB.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!u) throw new TRPCError({ code: 'NOT_FOUND' });
      return u;
    }),

  fullDetail: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;
      const [user, creditAccount, latestSnapshot, recentLedger, recentOrders, recentAudit] =
        await Promise.all([
          ctx.serverDB.query.users.findFirst({ where: eq(users.id, userId) }),
          ctx.serverDB.query.creditAccounts.findFirst({
            where: eq(creditAccounts.userId, userId),
          }),
          ctx.serverDB.query.userPlanSnapshots.findFirst({
            orderBy: desc(userPlanSnapshots.createdAt),
            where: eq(userPlanSnapshots.userId, userId),
          }),
          ctx.serverDB.query.creditLedgerEntries.findMany({
            limit: 20,
            orderBy: desc(creditLedgerEntries.createdAt),
            where: eq(creditLedgerEntries.userId, userId),
          }),
          ctx.serverDB.query.topUpOrders.findMany({
            limit: 20,
            orderBy: desc(topUpOrders.createdAt),
            where: eq(topUpOrders.userId, userId),
          }),
          ctx.serverDB.query.adminAuditLogs.findMany({
            limit: 20,
            orderBy: desc(adminAuditLogs.createdAt),
            where: eq(adminAuditLogs.targetUserId, userId),
          }),
        ]);

      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      return {
        creditAccount: creditAccount ?? null,
        recentAudit,
        recentLedger,
        recentOrders,
        subscription: latestSnapshot ?? null,
        user,
      };
    }),

  list: adminProcedure
    .input(
      z.object({
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(20),
        query: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const escapeLike = (s: string) => s.replaceAll(/[%_\\]/g, '\\$&');
      const where = input.query
        ? or(
            like(users.email, `%${escapeLike(input.query)}%`),
            like(users.username, `%${escapeLike(input.query)}%`),
            like(users.fullName, `%${escapeLike(input.query)}%`),
            like(users.phone, `%${escapeLike(input.query)}%`),
          )
        : undefined;

      const [items, totalRow] = await Promise.all([
        ctx.serverDB.query.users.findMany({
          columns: {
            avatar: true,
            banned: true,
            createdAt: true,
            email: true,
            fullName: true,
            id: true,
            lastActiveAt: true,
            phone: true,
            role: true,
          },
          limit: input.limit,
          offset: input.cursor,
          orderBy: desc(users.createdAt),
          where,
        }),
        ctx.serverDB.select({ value: count() }).from(users).where(where),
      ]);

      return {
        items,
        nextCursor: items.length === input.limit ? input.cursor + input.limit : null,
        total: totalRow[0]?.value ?? 0,
      };
    }),

  setRole: adminProcedure
    .input(
      z.object({
        role: z.enum(['admin', 'user']).nullable(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot change your own role' });
      }

      await ctx.serverDB.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      await recordAdminAudit(ctx, {
        action: 'user.setRole',
        payload: { role: input.role },
        resourceType: 'user',
        targetUserId: input.userId,
      });
      return { ok: true };
    }),

  unban: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({ banExpires: null, banReason: null, banned: false })
        .where(eq(users.id, input.userId));
      await recordAdminAudit(ctx, {
        action: 'user.unban',
        resourceType: 'user',
        targetUserId: input.userId,
      });
      return { ok: true };
    }),

  exportAll: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50_000).default(10_000),
        query: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const escapeLike = (s: string) => s.replaceAll(/[%_\\]/g, '\\$&');
      const where = input.query
        ? or(
            like(users.email, `%${escapeLike(input.query)}%`),
            like(users.username, `%${escapeLike(input.query)}%`),
            like(users.fullName, `%${escapeLike(input.query)}%`),
            like(users.phone, `%${escapeLike(input.query)}%`),
          )
        : undefined;
      const items = await ctx.serverDB.query.users.findMany({
        columns: {
          banned: true,
          createdAt: true,
          email: true,
          fullName: true,
          id: true,
          lastActiveAt: true,
          phone: true,
          role: true,
          username: true,
        },
        limit: input.limit,
        orderBy: desc(users.createdAt),
        where,
      });
      return { items };
    }),
});

// avoid lint: unused imports retained for future bulk ops
void and;
