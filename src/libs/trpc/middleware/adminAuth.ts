import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import { users } from '@/database/schemas';

import { trpc } from '../lambda/init';

/**
 * Middleware that checks the authenticated user has the 'admin' role.
 * Must be chained AFTER `userAuth` (i.e. use on `authedProcedure`).
 */
export const adminAuth = trpc.middleware(async (opts) => {
  const { ctx } = opts;
  const userId = ctx.userId as string; // guaranteed non-null after userAuth

  const db = await getServerDB();
  const user = await db.query.users.findFirst({
    columns: { role: true },
    where: eq(users.id, userId),
  });

  if (!user || user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }

  return opts.next({ ctx: { ...ctx, isAdmin: true } });
});
