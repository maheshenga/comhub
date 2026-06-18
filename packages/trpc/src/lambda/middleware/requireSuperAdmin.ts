import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { users } from '@/database/schemas';

import { trpc } from '../init';

export const requireSuperAdmin = trpc.middleware(async (opts) => {
  const { ctx } = opts as any;
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.serverDB) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'serverDatabase middleware required before requireSuperAdmin' });

  const user = await ctx.serverDB.query.users.findFirst({
    columns: { banned: true, role: true },
    where: eq(users.id, ctx.userId),
  });

  if (user?.banned) throw new TRPCError({ code: 'FORBIDDEN', message: 'banned' });
  if (user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'admin role required' });

  return opts.next({ ctx: { ...ctx, isAdmin: true } });
});
