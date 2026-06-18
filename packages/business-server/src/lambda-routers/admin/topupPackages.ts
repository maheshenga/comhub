import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { topUpPackages } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

const PackageInputSchema = z.object({
  amount: z.number().min(0),
  credits: z.number().min(0),
  currency: z.string().max(16).default('USD'),
  displayName: z.string().min(1).max(200),
  id: z.string().min(1).max(64),
  isActive: z.boolean().default(true),
  recommended: z.boolean().default(false),
  sortOrder: z.number().default(0),
  validityMonths: z.number().min(1).default(12),
});

export const adminTopUpPackagesRouter = router({
  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(topUpPackages).where(eq(topUpPackages.id, input.id));
      await recordAdminAudit(ctx, {
        action: 'topupPackage.delete',
        resourceId: input.id,
        resourceType: 'topup_package',
      });
      return { ok: true };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const items = await ctx.serverDB.query.topUpPackages.findMany({
      orderBy: asc(topUpPackages.sortOrder),
    });
    return { items };
  }),

  setActive: adminProcedure
    .input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.serverDB
        .update(topUpPackages)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(topUpPackages.id, input.id))
        .returning({ id: topUpPackages.id });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
      await recordAdminAudit(ctx, {
        action: 'topupPackage.setActive',
        payload: { isActive: input.isActive },
        resourceId: input.id,
        resourceType: 'topup_package',
      });
      return { ok: true };
    }),

  upsert: adminProcedure.input(PackageInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.serverDB.query.topUpPackages.findFirst({
      where: eq(topUpPackages.id, input.id),
    });

    if (existing) {
      await ctx.serverDB
        .update(topUpPackages)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(topUpPackages.id, input.id));
    } else {
      await ctx.serverDB.insert(topUpPackages).values(input);
    }
    await recordAdminAudit(ctx, {
      action: existing ? 'topupPackage.update' : 'topupPackage.create',
      payload: input,
      resourceId: input.id,
      resourceType: 'topup_package',
    });
    return { ok: true };
  }),
});
