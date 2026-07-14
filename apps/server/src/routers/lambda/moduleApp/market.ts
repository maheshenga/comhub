import {
  moduleAppMarketplaceListInputSchema,
  moduleAppPackageArchiveMetadataSchema,
  moduleAppPackageManifestV1Schema,
  moduleAppPackageSubmissionListInputSchema,
  moduleAppPackageUploadedSubmitSchema,
  moduleAppPackageUploadRequestSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  assertModuleAppEntitlement,
  ModuleAppEntitlementError,
} from '@/business/server/module-apps/entitlement';
import { ModuleAppPackageIngestionService } from '@/server/services/moduleAppPackage/ingestion';

import {
  assertDetailEntitlement,
  assertScopePermission,
  getWorkspaceMembership,
  moduleAppProcedure,
} from './data';

const AppIdInputSchema = z.object({
  appId: z.string().uuid(),
});

const AppIdOrSlugInputSchema = z.object({
  appIdOrSlug: z.string().min(1).max(160),
  workspaceId: z.string().min(1).optional(),
});

const WorkspaceAppInputSchema = AppIdInputSchema.extend({
  workspaceId: z.string().min(1),
});

const assertWorkspaceMembership = async (params: {
  db: Parameters<typeof getWorkspaceMembership>[0];
  userId: string;
  workspaceId: string;
}) => {
  const membership = await getWorkspaceMembership(params.db, params.userId, params.workspaceId);
  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
  }
};

const publicPackageArchiveSchema = moduleAppPackageArchiveMetadataSchema.pick({
  fileName: true,
  sizeBytes: true,
});

const publicPackageManifestSchema = moduleAppPackageManifestV1Schema
  .pick({ app: true, packageVersion: true })
  .extend({
    app: moduleAppPackageManifestV1Schema.shape.app.pick({ displayName: true, slug: true }),
  });

type PublicPackageSubmissionSource = {
  appId: string | null;
  archive: unknown;
  createdAt: Date;
  id: string;
  manifestSnapshot: unknown;
  publishedAt: Date | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  reviewStatus: string;
  updatedAt: Date;
};

const serializePublicPackageSubmission = (item: PublicPackageSubmissionSource) => {
  const archive = publicPackageArchiveSchema.safeParse(item.archive);
  const manifest = publicPackageManifestSchema.safeParse(item.manifestSnapshot);
  if (!archive.success || !manifest.success) return null;

  return {
    appDisplayName: manifest.data.app.displayName,
    appId: item.appId,
    appSlug: manifest.data.app.slug,
    createdAt: item.createdAt,
    fileName: archive.data.fileName,
    id: item.id,
    packageVersion: manifest.data.packageVersion,
    publishedAt: item.publishedAt,
    rejectionReason: item.rejectionReason,
    reviewedAt: item.reviewedAt,
    reviewStatus: item.reviewStatus,
    sizeBytes: archive.data.sizeBytes,
    updatedAt: item.updatedAt,
  };
};

const getPackageErrorIdentifier = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return error instanceof Error ? error.message : 'module_app_package_ingestion_failed';
};

const mapPackageError = (error: unknown) => {
  if (error instanceof TRPCError) return error;

  const identifier = getPackageErrorIdentifier(error);
  if (
    identifier === 'MODULE_APP_PACKAGE_OPEN_UPLOAD_LIMIT' ||
    identifier === 'MODULE_APP_PACKAGE_DAILY_UPLOAD_LIMIT'
  ) {
    return new TRPCError({ cause: error, code: 'TOO_MANY_REQUESTS', message: identifier });
  }
  if (
    identifier === 'MODULE_APP_PACKAGE_STORAGE_QUOTA_EXCEEDED' ||
    identifier === 'MODULE_APP_PACKAGE_UPLOAD_FORBIDDEN' ||
    identifier === 'module_app_package_storage_key_forbidden'
  ) {
    return new TRPCError({ cause: error, code: 'FORBIDDEN', message: identifier });
  }
  if (identifier === 'MODULE_APP_PACKAGE_UPLOAD_CONFLICT') {
    return new TRPCError({ cause: error, code: 'CONFLICT', message: identifier });
  }
  if (
    identifier === 'MODULE_APP_PACKAGE_UPLOAD_EXPIRED' ||
    (identifier.startsWith('module_app_package_') &&
      identifier !== 'module_app_package_ingestion_failed' &&
      identifier !== 'module_app_package_upload_signing_failed')
  ) {
    return new TRPCError({ cause: error, code: 'BAD_REQUEST', message: identifier });
  }

  return new TRPCError({
    cause: error,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'module_app_package_ingestion_failed',
  });
};

export const moduleAppMarketProcedures = {
  createPackageUpload: moduleAppProcedure
    .input(moduleAppPackageUploadRequestSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await new ModuleAppPackageIngestionService({ db: ctx.serverDB }).issueUpload({
          input,
          userId: ctx.userId,
        });
      } catch (error) {
        throw mapPackageError(error);
      }
    }),

  getDetail: moduleAppProcedure.input(AppIdOrSlugInputSchema).query(async ({ ctx, input }) => {
    if (input.workspaceId) {
      await assertWorkspaceMembership({
        db: ctx.serverDB,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
    }

    return ctx.moduleAppModel.getAppDetail({
      appIdOrSlug: input.appIdOrSlug,
      plan: ctx.currentPlan,
      userId: ctx.userId,
      workspaceId: input.workspaceId,
    });
  }),

  getRuntimeManifest: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.getRuntimeManifest({
      ...input,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });
  }),

  installPersonal: moduleAppProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    const detail = await ctx.moduleAppModel.getAppDetail({
      appIdOrSlug: input.appId,
      includeHidden: true,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });

    if (!detail) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });
    }

    await assertDetailEntitlement({
      db: ctx.serverDB,
      detail,
      operation: 'install',
      userId: ctx.userId,
    });

    await ctx.moduleAppModel.installPersonalApp({ appId: detail.id, userId: ctx.userId });

    return { ok: true };
  }),

  installWorkspace: moduleAppProcedure
    .input(WorkspaceAppInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceMembership({
        db: ctx.serverDB,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
      const detail = await ctx.moduleAppModel.getAppDetail({
        appIdOrSlug: input.appId,
        includeHidden: true,
        plan: ctx.currentPlan,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      if (!detail) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });
      }

      await assertDetailEntitlement({
        db: ctx.serverDB,
        detail,
        operation: 'install',
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
      await ctx.moduleAppModel.installWorkspaceApp({
        appId: detail.id,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      return { ok: true };
    }),

  listMarketplace: moduleAppProcedure
    .input(moduleAppMarketplaceListInputSchema)
    .query(async ({ ctx, input }) => {
      const items = await ctx.moduleAppModel.listMarketplaceApps({
        filters: input,
        includeHidden: true,
        plan: ctx.currentPlan,
        userId: ctx.userId,
      });

      return items.filter((item) => {
        try {
          assertModuleAppEntitlement({
            appStatus: item.status,
            operation: 'visibility',
            planIncluded: item.planState.visible,
          });
          return true;
        } catch (error) {
          if (error instanceof ModuleAppEntitlementError) return false;
          throw error;
        }
      });
    }),

  listMyApps: moduleAppProcedure.query(async ({ ctx }) => {
    return ctx.moduleAppModel.listInstalledApps({
      scopeType: 'personal',
      userId: ctx.userId,
    });
  }),

  listMyPackageSubmissions: moduleAppProcedure
    .input(moduleAppPackageSubmissionListInputSchema)
    .query(async ({ ctx, input }) => {
      const result = await ctx.moduleAppModel.listAdminPackageSubmissions({
        cursor: input.cursor,
        limit: input.limit,
        reviewStatus: input.reviewStatus,
        submittedByUserId: ctx.userId,
      });

      return {
        items: result.items.map(serializePublicPackageSubmission).filter((item) => item !== null),
        nextCursor: result.nextCursor,
      };
    }),

  listTeamApps: moduleAppProcedure
    .input(z.object({ workspaceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertScopePermission({
        db: ctx.serverDB,
        operation: 'view',
        scopeType: 'workspace',
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      return ctx.moduleAppModel.listInstalledApps({
        scopeType: 'workspace',
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
    }),

  submitUploadedPackage: moduleAppProcedure
    .input(moduleAppPackageUploadedSubmitSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await new ModuleAppPackageIngestionService({ db: ctx.serverDB }).submitUpload({
          input,
          userId: ctx.userId,
        });
      } catch (error) {
        throw mapPackageError(error);
      }
    }),

  uninstallPersonal: moduleAppProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.moduleAppModel.uninstallPersonalApp({ ...input, userId: ctx.userId });
  }),

  uninstallWorkspace: moduleAppProcedure
    .input(WorkspaceAppInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceMembership({
        db: ctx.serverDB,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      return ctx.moduleAppModel.uninstallWorkspaceApp(input);
    }),
};
