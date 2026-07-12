import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  normalizeTopUpPackagePromotion,
  serializeTopUpPackagePromotion,
} from '@/const/billingPresentation';
import { redemptionCodes, topUpPackages } from '@/database/schemas';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, adminProcedure, router } from '@/libs/trpc/lambda';

import { recordAdminAudit } from './audit';

const PackageInputSchema = z.object({
  amount: z.number().min(0),
  credits: z.number().min(0),
  currency: z.string().max(16).default('USD'),
  displayName: z.string().min(1).max(200),
  id: z.string().min(1).max(64),
  isActive: z.boolean().default(true),
  originalAmount: z.number().min(0).optional(),
  promotionEnabled: z.boolean().optional(),
  promotionLabel: z.string().max(120).optional(),
  promotionNote: z.string().max(240).optional(),
  recommended: z.boolean().default(false),
  sortOrder: z.number().default(0),
  validityMonths: z.number().min(1).default(12),
});

const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

export const adminTopUpPackagesRouter = router({
  delete: financeWriteProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const referencingCode = await ctx.serverDB.query.redemptionCodes.findFirst({
        columns: { id: true },
        where: eq(redemptionCodes.topupPackageId, input.id),
      });

      if (referencingCode) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'TOPUP_PACKAGE_HAS_REDEMPTION_CODES',
        });
      }

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

  setActive: financeWriteProcedure
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

  upsert: financeWriteProcedure.input(PackageInputSchema).mutation(async ({ ctx, input }) => {
    const { originalAmount, promotionEnabled, promotionLabel, promotionNote, ...packageInput } =
      input;
    const existing = await ctx.serverDB.query.topUpPackages.findFirst({
      where: eq(topUpPackages.id, packageInput.id),
    });
    const previousMetadata =
      existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
    const promotion = normalizeTopUpPackagePromotion({
      originalAmount,
      promotionEnabled,
      promotionLabel,
      promotionNote,
    });
    const metadata = {
      ...previousMetadata,
      ...serializeTopUpPackagePromotion(promotion),
    };

    if (existing) {
      await ctx.serverDB
        .update(topUpPackages)
        .set({ ...packageInput, metadata, updatedAt: new Date() })
        .where(eq(topUpPackages.id, packageInput.id));
    } else {
      await ctx.serverDB.insert(topUpPackages).values({ ...packageInput, metadata });
    }
    await recordAdminAudit(ctx, {
      action: existing ? 'topupPackage.update' : 'topupPackage.create',
      payload: { ...packageInput, metadata },
      resourceId: packageInput.id,
      resourceType: 'topup_package',
    });
    return { ok: true };
  }),
});
