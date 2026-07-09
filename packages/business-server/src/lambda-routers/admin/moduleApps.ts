import {
  moduleAppAdminUpsertSchema,
  moduleAppBillingConfigSchema,
  moduleAppPackageReviewStatusSchema,
  moduleAppPlanEntitlementSchema,
  moduleAppStatusSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ModuleAppModel } from '@/database/models/moduleApp';
import type { LobeChatDatabase } from '@/database/type';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';

import { writeModuleAppAuditLog } from '../../module-apps/audit';

const auditReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.auditRead);
const contentWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentWrite);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);

const AppIdInputSchema = z.object({ appId: z.string().uuid() });
const PackageIdInputSchema = z.object({ packageId: z.string().uuid() });
const ListInputSchema = z
  .object({
    category: z.string().min(1).max(80).optional(),
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(200).default(50),
    status: moduleAppStatusSchema.optional(),
  })
  .optional()
  .default({});
const ListByAppInputSchema = AppIdInputSchema.extend({
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(50),
});
const ListPackagesInputSchema = z
  .object({
    appId: z.string().uuid().optional(),
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(200).default(50),
    reviewStatus: moduleAppPackageReviewStatusSchema.optional(),
    submittedByUserId: z.string().min(1).max(255).optional(),
  })
  .optional()
  .default({});
const RejectPackageInputSchema = PackageIdInputSchema.extend({
  reason: z.string().min(1).max(1000).optional(),
});

const PagesInputSchema = z.object({
  appId: z.string().uuid(),
  pages: moduleAppAdminUpsertSchema.shape.pages,
});

const ActionsInputSchema = z.object({
  actions: moduleAppAdminUpsertSchema.shape.actions,
  appId: z.string().uuid(),
});

const BillingInputSchema = z.object({
  appId: z.string().uuid(),
  billing: moduleAppBillingConfigSchema,
});

const EntitlementsInputSchema = z.object({
  appId: z.string().uuid(),
  entitlements: z.array(moduleAppPlanEntitlementSchema).max(100),
});

const writeAudit = async (
  ctx: { serverDB: LobeChatDatabase; userId: string },
  input: {
    eventType: string;
    metadata?: null | Record<string, unknown>;
    resourceId: string;
    resourceType?: string;
  },
) => {
  await writeModuleAppAuditLog({
    actorUserId: ctx.userId,
    db: ctx.serverDB,
    eventType: input.eventType,
    metadata: input.metadata,
    resourceId: input.resourceId,
    resourceType: input.resourceType ?? 'moduleApp',
  });
};

const requireAdminApp = async (db: LobeChatDatabase, appId: string) => {
  const app = await new ModuleAppModel(db).getAdminApp({ appId });

  if (!app) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });
  }

  return app;
};

export const adminModuleAppsRouter = router({
  get: auditReadProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return requireAdminApp(ctx.serverDB, input.appId);
  }),

  list: auditReadProcedure.input(ListInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminApps(input);
  }),

  getPackage: auditReadProcedure.input(PackageIdInputSchema).query(async ({ ctx, input }) => {
    const submission = await new ModuleAppModel(ctx.serverDB).getAdminPackageSubmission(input);

    if (!submission) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_package_not_found' });
    }

    return submission;
  }),

  listArtifacts: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppModel(ctx.serverDB).listAdminArtifacts(input);
  }),

  listAuditEvents: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppModel(ctx.serverDB).listAdminAuditEvents(input);
  }),

  listPackages: auditReadProcedure.input(ListPackagesInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppModel(ctx.serverDB).listAdminPackageSubmissions(input);
  }),

  listInstalls: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppModel(ctx.serverDB).listAdminInstalls(input);
  }),

  listRecords: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppModel(ctx.serverDB).listAdminRecords(input);
  }),

  listRuns: auditReadProcedure.input(ListByAppInputSchema).query(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    return new ModuleAppModel(ctx.serverDB).listAdminRuns(input);
  }),

  publish: contentWriteProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    await new ModuleAppModel(ctx.serverDB).setStatus({ appId: input.appId, status: 'published' });
    await writeAudit(ctx, { eventType: 'module_app.published', resourceId: input.appId });

    return { ok: true };
  }),

  approvePackage: contentWriteProcedure
    .input(PackageIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppModel(ctx.serverDB).approvePackageSubmissionForAdmin({
        ...input,
        reviewedByUserId: ctx.userId,
      });

      await writeAudit(ctx, {
        eventType: 'module_app.package_approved',
        metadata: { packageId: input.packageId, slug: result.slug, versionId: result.versionId },
        resourceId: result.appId,
      });

      return result;
    }),

  rejectPackage: contentWriteProcedure
    .input(RejectPackageInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await new ModuleAppModel(ctx.serverDB).rejectPackageSubmissionForAdmin({
        ...input,
        reviewedByUserId: ctx.userId,
      });

      await writeAudit(ctx, {
        eventType: 'module_app.package_rejected',
        metadata: { reason: input.reason },
        resourceId: input.packageId,
        resourceType: 'moduleAppPackage',
      });

      return result;
    }),

  unpublish: contentWriteProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    await new ModuleAppModel(ctx.serverDB).setStatus({ appId: input.appId, status: 'unpublished' });
    await writeAudit(ctx, { eventType: 'module_app.unpublished', resourceId: input.appId });

    return { ok: true };
  }),

  upsert: contentWriteProcedure.input(moduleAppAdminUpsertSchema).mutation(async ({ ctx, input }) => {
    const result = await new ModuleAppModel(ctx.serverDB).upsertAppForAdmin(input);

    await writeAudit(ctx, {
      eventType: 'module_app.upserted',
      metadata: { slug: input.slug, status: input.status },
      resourceId: result.id,
    });

    return result;
  }),

  upsertActions: contentWriteProcedure.input(ActionsInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    const result = await new ModuleAppModel(ctx.serverDB).upsertActionsForAdmin(input);
    await writeAudit(ctx, {
      eventType: 'module_app.actions_upserted',
      metadata: { count: input.actions.length },
      resourceId: input.appId,
    });

    return result;
  }),

  upsertBilling: financeWriteProcedure.input(BillingInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    const result = await new ModuleAppModel(ctx.serverDB).upsertBillingForAdmin(input);
    await writeAudit(ctx, {
      eventType: 'module_app.billing_upserted',
      metadata: { chargeMode: input.billing.chargeMode },
      resourceId: input.appId,
    });

    return result;
  }),

  upsertEntitlements: financeWriteProcedure
    .input(EntitlementsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireAdminApp(ctx.serverDB, input.appId);

      const result = await new ModuleAppModel(ctx.serverDB).upsertEntitlementsForAdmin(input);
      await writeAudit(ctx, {
        eventType: 'module_app.entitlements_upserted',
        metadata: { count: input.entitlements.length },
        resourceId: input.appId,
      });

      return result;
    }),

  upsertPages: contentWriteProcedure.input(PagesInputSchema).mutation(async ({ ctx, input }) => {
    await requireAdminApp(ctx.serverDB, input.appId);

    const result = await new ModuleAppModel(ctx.serverDB).upsertPagesForAdmin(input);
    await writeAudit(ctx, {
      eventType: 'module_app.pages_upserted',
      metadata: { count: input.pages.length },
      resourceId: input.appId,
    });

    return result;
  }),
});
