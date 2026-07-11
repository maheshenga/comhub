import { randomUUID } from 'node:crypto';

import {
  moduleAppBuildConfigSchema,
  moduleAppExecutableRuntimeSchema,
  moduleAppMarketplaceListInputSchema,
  moduleAppPackageArchiveMetadataSchema,
  moduleAppPackageManifestV1Schema,
  moduleAppPackageSubmissionListInputSchema,
  moduleAppPackageUploadedSubmitSchema,
  moduleAppPackageUploadRequestSchema,
  moduleAppRecordInputSchema,
  moduleAppRunInputSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  assertModuleAppEntitlement,
  ModuleAppEntitlementError,
} from '@/business/server/module-apps/entitlement';
import {
  assertModuleAppRecordPermission,
  type ModuleAppRecordOperation,
  type ModuleAppWorkspaceMembership,
} from '@/business/server/module-apps/permission';
import { runModuleAppAction } from '@/business/server/module-apps/runModuleAppAction';
import { getSubscriptionPlan } from '@/business/server/user';
import { ModuleAppModel } from '@/database/models/moduleApp';
import { ModuleAppCommerceModel } from '@/database/models/moduleAppCommerce';
import { ModuleAppWorkflowModel } from '@/database/models/moduleAppWorkflow';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import type { ModuleAppPackageItem, ModuleAppRecordItem } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { appEnv } from '@/envs/app';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { createModuleAppTextGenerator } from '@/server/services/moduleAppAi';
import { ModuleAppPackageIngestionService } from '@/server/services/moduleAppPackage/ingestion';
import {
  signModuleAppCapability,
  verifyModuleAppCapability,
} from '@/server/services/moduleAppRuntime/capability';
import { createModuleAppCapabilityGateway } from '@/server/services/moduleAppRuntime/gateway';

const AppIdInputSchema = z.object({
  appId: z.string().uuid(),
});

const ModuleAppOrderListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});
const ProductIdInputSchema = z.object({
  productId: z.string().uuid(),
  workspaceId: z.string().min(1).optional(),
});
const OrderIdInputSchema = z.object({ orderId: z.string().uuid() });
const ModuleAppCatalogInputSchema = z.object({ appId: z.string().uuid().optional() });

const ModuleAppLaunchInputSchema = AppIdInputSchema.extend({
  workspaceId: z.string().min(1).optional(),
});

const ModuleAppHistoryInputSchema = z.object({
  cursor: z.string().max(512).optional(),
  installationId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
  workspaceId: z.string().min(1).optional(),
});

const ModuleAppWorkflowRunInputSchema = ModuleAppHistoryInputSchema.pick({
  installationId: true,
  workspaceId: true,
}).extend({
  runId: z.string().uuid(),
});

const ModuleAppLaunchRuntimeManifestSchema = z
  .object({
    build: moduleAppBuildConfigSchema,
    manifestVersion: z.literal(2),
    runtime: moduleAppExecutableRuntimeSchema,
  })
  .strict();

const AppIdOrSlugInputSchema = z.object({
  appIdOrSlug: z.string().min(1).max(160),
});

const RecordIdInputSchema = z.object({
  appId: z.string().uuid(),
  recordId: z.string().uuid(),
  workspaceId: z.string().optional(),
});

const ModuleAppGatewayCallInputSchema = z.object({
  capability: z.string().min(1).max(8192),
  input: z.unknown().optional(),
  method: z.enum([
    'context.get',
    'data.archive',
    'data.get',
    'data.insert',
    'data.list',
    'data.transaction',
    'data.update',
    'files.createDownload',
    'files.createUpload',
    'http.fetch',
    'notifications.create',
    'secrets.get',
    'tasks.cancel',
    'tasks.getRun',
  ]),
  requestId: z.string().min(1).max(160).optional(),
});

const publicPackageArchiveSchema = moduleAppPackageArchiveMetadataSchema.pick({
  fileName: true,
  sizeBytes: true,
});

const publicPackageManifestSchema = moduleAppPackageManifestV1Schema
  .pick({ app: true, packageVersion: true })
  .extend({
    app: moduleAppPackageManifestV1Schema.shape.app.pick({ displayName: true, slug: true }),
  });

type PublicPackageSubmissionSource = Pick<
  ModuleAppPackageItem,
  | 'appId'
  | 'createdAt'
  | 'id'
  | 'publishedAt'
  | 'rejectionReason'
  | 'reviewedAt'
  | 'reviewStatus'
  | 'updatedAt'
> & {
  archive: unknown;
  manifestSnapshot: unknown;
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

const mapGatewayError = (error: unknown) => {
  if (error instanceof TRPCError) return error;
  const identifier = getPackageErrorIdentifier(error);

  if (identifier === 'MODULE_APP_CAPABILITY_REPLAYED') {
    return new TRPCError({ cause: error, code: 'CONFLICT', message: identifier });
  }
  if (identifier === 'MODULE_APP_NOTIFICATION_RATE_LIMITED') {
    return new TRPCError({ cause: error, code: 'TOO_MANY_REQUESTS', message: identifier });
  }
  if (
    identifier === 'MODULE_APP_CAPABILITY_DENIED' ||
    identifier === 'MODULE_APP_CAPABILITY_SCOPE_MISMATCH' ||
    identifier === 'MODULE_APP_FILE_SCOPE_DENIED' ||
    identifier === 'MODULE_APP_HTTP_HOST_DENIED' ||
    identifier === 'MODULE_APP_UNSAFE_API_URL'
  ) {
    return new TRPCError({ cause: error, code: 'FORBIDDEN', message: identifier });
  }
  if (
    identifier.startsWith('MODULE_APP_FILE_') ||
    identifier.startsWith('MODULE_APP_DATA_') ||
    identifier.startsWith('MODULE_APP_HTTP_') ||
    identifier.startsWith('MODULE_APP_NOTIFICATION_') ||
    identifier.startsWith('MODULE_APP_SECRET_') ||
    identifier.startsWith('MODULE_APP_TASK_') ||
    identifier === 'MODULE_APP_CAPABILITY_REQUEST_ID_REQUIRED'
  ) {
    return new TRPCError({ cause: error, code: 'BAD_REQUEST', message: identifier });
  }

  return new TRPCError({ cause: error, code: 'INTERNAL_SERVER_ERROR', message: 'module_app_gateway_failed' });
};

const moduleAppProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const currentPlan = await getSubscriptionPlan(opts.ctx.serverDB, opts.ctx.userId);

  return opts.next({
    ctx: {
      currentPlan,
      moduleAppModel: new ModuleAppModel(opts.ctx.serverDB),
      moduleAppWorkflowModel: new ModuleAppWorkflowModel(opts.ctx.serverDB),
    },
  });
});

const getWorkspaceMembership = async (
  db: LobeChatDatabase,
  userId: string,
  workspaceId?: null | string,
): Promise<ModuleAppWorkspaceMembership> => {
  if (!workspaceId) return null;

  const member = await new WorkspaceMemberModel(db, userId).getMember(workspaceId, userId);
  if (!member) return null;

  return {
    role: member.role === 'owner' ? 'owner' : 'member',
    workspaceId: member.workspaceId,
  };
};

const assertScopePermission = async (params: {
  db: LobeChatDatabase;
  operation: ModuleAppRecordOperation;
  scopeType: 'personal' | 'workspace';
  userId: string;
  workspaceId?: null | string;
}) => {
  try {
    assertModuleAppRecordPermission({
      actorUserId: params.userId,
      createdBy: params.userId,
      operation: params.operation,
      ownerUserId: params.scopeType === 'personal' ? params.userId : null,
      scopeType: params.scopeType,
      workspaceId: params.workspaceId,
      workspaceMembership:
        params.scopeType === 'workspace'
          ? await getWorkspaceMembership(params.db, params.userId, params.workspaceId)
          : null,
    });
  } catch (error) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: error instanceof Error ? error.message : 'module_app_permission_denied',
    });
  }
};

const assertInstallationAccess = async (params: {
  db: LobeChatDatabase;
  installationId: string;
  model: ModuleAppModel;
  userId: string;
  workspaceId?: string;
}) => {
  if (params.workspaceId) {
    const membership = await getWorkspaceMembership(params.db, params.userId, params.workspaceId);
    if (!membership) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
    }
  }

  try {
    await params.model.assertInstallationAccess({
      installationId: params.installationId,
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
  } catch (error) {
    throw new TRPCError({
      cause: error,
      code: 'FORBIDDEN',
      message: 'module_app_installation_access_denied',
    });
  }
};

const assertWorkflowRunAccess = async (params: {
  db: LobeChatDatabase;
  installationId: string;
  model: ModuleAppModel;
  runId: string;
  userId: string;
  workflowModel: ModuleAppWorkflowModel;
  workspaceId?: string;
}) => {
  await assertInstallationAccess(params);
  const run = await params.workflowModel.getRun({
    installationId: params.installationId,
    runId: params.runId,
  });
  if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_workflow_run_not_found' });
  return run;
};

const assertDetailEntitlement = async (params: {
  db: LobeChatDatabase;
  detail: NonNullable<Awaited<ReturnType<ModuleAppModel['getAppDetail']>>>;
  operation: 'install' | 'job' | 'launch' | 'run' | 'schedule' | 'webhook';
  userId: string;
  workspaceId?: string;
}) => {
  const membership = params.workspaceId
    ? await getWorkspaceMembership(params.db, params.userId, params.workspaceId)
    : undefined;
  const planIncluded =
    params.operation === 'install'
      ? params.detail.planState.installable
      : params.detail.planState.runnable;

  try {
    return assertModuleAppEntitlement({
      appStatus: params.detail.status,
      installation:
        typeof params.detail.installed === 'boolean'
          ? { active: params.detail.installed }
          : undefined,
      operation: params.operation,
      planIncluded,
      teamMembership: params.workspaceId ? { active: Boolean(membership) } : undefined,
      workspaceScoped: Boolean(params.workspaceId),
    });
  } catch (error) {
    if (!(error instanceof ModuleAppEntitlementError)) throw error;

    if (error.reason === 'hidden') {
      throw new TRPCError({ cause: error, code: 'NOT_FOUND', message: 'module_app_not_found' });
    }
    if (error.reason === 'purchase_required') {
      throw new TRPCError({ cause: error, code: 'FORBIDDEN', message: 'module_app_purchase_required' });
    }
    if (error.reason === 'license_expired') {
      throw new TRPCError({ cause: error, code: 'FORBIDDEN', message: 'module_app_license_expired' });
    }
    if (error.reason === 'suspended') {
      throw new TRPCError({ cause: error, code: 'FORBIDDEN', message: 'module_app_suspended' });
    }

    const message =
      params.operation === 'install'
        ? 'plan_install_denied'
        : planIncluded && params.detail.installed === false
          ? 'module_app_installation_required'
          : 'plan_run_denied';
    throw new TRPCError({ cause: error, code: 'FORBIDDEN', message });
  }
};

const assertRunnableApp = async (params: {
  appId: string;
  currentPlan: string;
  model: ModuleAppModel;
  db: LobeChatDatabase;
  operation?: 'launch' | 'run';
  userId: string;
  workspaceId?: string;
}) => {
  const detail = await params.model.getAppDetail({
    appIdOrSlug: params.appId,
    includeHidden: true,
    plan: params.currentPlan,
    userId: params.userId,
    workspaceId: params.workspaceId,
  });

  if (!detail) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });

  await assertDetailEntitlement({
    db: params.db,
    detail,
    operation: params.operation ?? 'run',
    userId: params.userId,
    workspaceId: params.workspaceId,
  });

  return detail;
};

const assertRecordPermission = async (params: {
  db: LobeChatDatabase;
  operation: ModuleAppRecordOperation;
  record: ModuleAppRecordItem;
  userId: string;
}) => {
  try {
    assertModuleAppRecordPermission({
      actorUserId: params.userId,
      createdBy: params.record.createdBy,
      operation: params.operation,
      ownerUserId: params.record.ownerUserId,
      scopeType: params.record.scopeType,
      workspaceId: params.record.workspaceId,
      workspaceMembership:
        params.record.scopeType === 'workspace'
          ? await getWorkspaceMembership(params.db, params.userId, params.record.workspaceId)
          : null,
    });
  } catch (error) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: error instanceof Error ? error.message : 'module_app_permission_denied',
    });
  }
};

export const moduleAppRouter = router({
  cancelOrder: moduleAppProcedure.input(OrderIdInputSchema).mutation(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).cancelOrder({
      orderId: input.orderId,
      purchaserUserId: ctx.userId,
    });
  }),

  createOrder: moduleAppProcedure.input(ProductIdInputSchema).mutation(async ({ ctx, input }) => {
    if (input.workspaceId) {
      const membership = await getWorkspaceMembership(ctx.serverDB, ctx.userId, input.workspaceId);
      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
      }
    }
    return new ModuleAppCommerceModel(ctx.serverDB).createOrder({
      productId: input.productId,
      purchaserUserId: ctx.userId,
      workspaceId: input.workspaceId,
    });
  }),
  cancelWorkflowRun: moduleAppProcedure
    .input(ModuleAppWorkflowRunInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertWorkflowRunAccess({
        db: ctx.serverDB,
        ...input,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        workflowModel: ctx.moduleAppWorkflowModel,
      });
      try {
        return await ctx.moduleAppWorkflowModel.cancelRun({
          installationId: input.installationId,
          runId: input.runId,
        });
      } catch (error) {
        const identifier = getPackageErrorIdentifier(error);
        throw new TRPCError({
          cause: error,
          code:
            identifier === 'MODULE_APP_WORKFLOW_RUN_NOT_CANCELLABLE'
              ? 'CONFLICT'
              : 'INTERNAL_SERVER_ERROR',
          message:
            identifier === 'MODULE_APP_WORKFLOW_RUN_NOT_CANCELLABLE'
              ? 'module_app_workflow_run_not_cancellable'
              : 'module_app_workflow_cancel_failed',
        });
      }
    }),

  callSdk: moduleAppProcedure
    .input(ModuleAppGatewayCallInputSchema)
    .mutation(async ({ ctx, input }) => {
      let capability;
      try {
        capability = await verifyModuleAppCapability(input.capability, { userId: ctx.userId });
      } catch (error) {
        throw new TRPCError({ cause: error, code: 'UNAUTHORIZED', message: 'MODULE_APP_CAPABILITY_INVALID' });
      }
      if (capability.surface !== 'browser') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'MODULE_APP_CAPABILITY_SURFACE_DENIED' });
      }
      await assertRunnableApp({
        appId: capability.appId,
        currentPlan: ctx.currentPlan,
        db: ctx.serverDB,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        workspaceId: capability.workspaceId,
      });

      try {
        return await createModuleAppCapabilityGateway({
          capability,
          db: ctx.serverDB,
        }).call({
          capability,
          input: input.input,
          method: input.method,
          requestId: input.requestId,
        });
      } catch (error) {
        throw mapGatewayError(error);
      }
    }),

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

  archiveRecord: moduleAppProcedure
    .input(RecordIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.moduleAppModel.getRecord({ ...input, userId: ctx.userId });
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_record_not_found' });

      await assertRecordPermission({
        db: ctx.serverDB,
        operation: 'archive',
        record,
        userId: ctx.userId,
      });

      return ctx.moduleAppModel.archiveRecord({ ...input, userId: ctx.userId });
    }),

  createRecord: moduleAppProcedure
    .input(moduleAppRecordInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertRunnableApp({
        appId: input.appId,
        currentPlan: ctx.currentPlan,
        db: ctx.serverDB,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      await assertScopePermission({
        db: ctx.serverDB,
        operation: 'create',
        scopeType: input.scopeType,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      return ctx.moduleAppModel.createRecord({ ...input, userId: ctx.userId });
    }),

  getDetail: moduleAppProcedure.input(AppIdOrSlugInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.getAppDetail({
      appIdOrSlug: input.appIdOrSlug,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });
  }),

  getLicense: moduleAppProcedure.input(ModuleAppLaunchInputSchema).query(async ({ ctx, input }) => {
    if (input.workspaceId) {
      const membership = await getWorkspaceMembership(ctx.serverDB, ctx.userId, input.workspaceId);
      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
      }
    }
    return new ModuleAppCommerceModel(ctx.serverDB).resolveLicense(
      input.workspaceId
        ? { appId: input.appId, workspaceId: input.workspaceId }
        : { appId: input.appId, userId: ctx.userId },
    );
  }),

  getLaunchContext: moduleAppProcedure
    .input(ModuleAppLaunchInputSchema)
    .query(async ({ ctx, input }) => {
      if (
        !appEnv.MODULE_APP_EXECUTION_ENABLED ||
        !appEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN
      ) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_runtime_unavailable',
        });
      }

      if (input.workspaceId) {
        const membership = await getWorkspaceMembership(
          ctx.serverDB,
          ctx.userId,
          input.workspaceId,
        );
        if (!membership) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'module_app_workspace_denied',
          });
        }
      }

      await assertRunnableApp({
        appId: input.appId,
        currentPlan: ctx.currentPlan,
        db: ctx.serverDB,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        operation: 'launch',
        workspaceId: input.workspaceId,
      });
      const installation = await ctx.moduleAppModel.getLaunchInstallationContext({
        ...input,
        userId: ctx.userId,
      });
      if (!installation) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'module_app_installation_required',
        });
      }

      const manifest = ModuleAppLaunchRuntimeManifestSchema.safeParse(
        installation.runtimeManifest,
      );
      const artifactReady =
        installation.buildStatus === 'ready' &&
        Boolean(installation.artifactKey) &&
        Boolean(installation.artifactSha256) &&
        installation.artifactKey === installation.buildArtifactKey &&
        installation.artifactSha256 === installation.buildArtifactSha256;
      if (!artifactReady || !manifest.success) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_build_not_ready',
        });
      }

      const now = new Date();
      const nonce = randomUUID();
      const runtimeOrigin = new URL(appEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN).origin;
      const output = manifest.data.build.frontend.output.replace(/\/+$/, '');
      const entry = output.endsWith('.html') ? output : `${output}/index.html`;
      const iframeUrl = new URL(
        `/artifacts/${installation.artifactSha256}/${entry}`,
        `${runtimeOrigin}/`,
      );
      iframeUrl.searchParams.set('nonce', nonce);
      const capability = await signModuleAppCapability(
        {
          appId: input.appId,
          installationId: installation.installationId,
          permissions: manifest.data.runtime.permissions,
          surface: 'browser',
          userId: ctx.userId,
          versionId: installation.versionId,
          workspaceId: installation.workspaceId ?? undefined,
        },
        { expiresInSeconds: 300, nonce, now: () => now },
      );

      return {
        capability,
        displayName: installation.displayName,
        expiresAt: new Date(now.getTime() + 300_000).toISOString(),
        iframeUrl: iframeUrl.toString(),
        installationId: installation.installationId,
        nonce,
        runtimeOrigin,
      };
    }),

  getRecord: moduleAppProcedure.input(RecordIdInputSchema).query(async ({ ctx, input }) => {
    const record = await ctx.moduleAppModel.getRecord({ ...input, userId: ctx.userId });
    if (!record) return null;

    await assertRecordPermission({
      db: ctx.serverDB,
      operation: 'view',
      record,
      userId: ctx.userId,
    });

    return record;
  }),

  getRuntimeManifest: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.getRuntimeManifest({
      ...input,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });
  }),

  getWorkflowRun: moduleAppProcedure
    .input(ModuleAppWorkflowRunInputSchema)
    .query(async ({ ctx, input }) => {
      return assertWorkflowRunAccess({
        db: ctx.serverDB,
        ...input,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        workflowModel: ctx.moduleAppWorkflowModel,
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

  listArtifacts: moduleAppProcedure
    .input(ModuleAppHistoryInputSchema)
    .query(async ({ ctx, input }) => {
      await assertInstallationAccess({
        db: ctx.serverDB,
        ...input,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
      });
      return ctx.moduleAppModel.listArtifacts({ ...input, userId: ctx.userId });
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

  listCatalog: moduleAppProcedure.input(ModuleAppCatalogInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).listCatalog(input);
  }),

  listOrders: moduleAppProcedure.input(ModuleAppOrderListInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).listOrders({
      limit: input.limit,
      purchaserUserId: ctx.userId,
    });
  }),

  quoteProduct: moduleAppProcedure.input(ProductIdInputSchema).query(async ({ ctx, input }) => {
    return new ModuleAppCommerceModel(ctx.serverDB).quoteProduct(input);
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
        items: result.items
          .map(serializePublicPackageSubmission)
          .filter((item) => item !== null),
        nextCursor: result.nextCursor,
      };
    }),

  listRecords: moduleAppProcedure
    .input(
      moduleAppRecordInputSchema.pick({
        appId: true,
        collectionKey: true,
        scopeType: true,
        workspaceId: true,
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertScopePermission({
        db: ctx.serverDB,
        operation: 'view',
        scopeType: input.scopeType,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      return ctx.moduleAppModel.listRecords({ ...input, userId: ctx.userId });
    }),

  listRuns: moduleAppProcedure.input(ModuleAppHistoryInputSchema).query(async ({ ctx, input }) => {
    await assertInstallationAccess({
      db: ctx.serverDB,
      ...input,
      model: ctx.moduleAppModel,
      userId: ctx.userId,
    });
    return ctx.moduleAppModel.listRuns({ ...input, userId: ctx.userId });
  }),

  listWorkflowNodes: moduleAppProcedure
    .input(ModuleAppWorkflowRunInputSchema)
    .query(async ({ ctx, input }) => {
      await assertWorkflowRunAccess({
        db: ctx.serverDB,
        ...input,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        workflowModel: ctx.moduleAppWorkflowModel,
      });
      return ctx.moduleAppWorkflowModel.listNodes({
        installationId: input.installationId,
        runId: input.runId,
      });
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

  runAction: moduleAppProcedure.input(moduleAppRunInputSchema).mutation(async ({ ctx, input }) => {
    const detail = await assertRunnableApp({
      appId: input.appId,
      currentPlan: ctx.currentPlan,
      db: ctx.serverDB,
      model: ctx.moduleAppModel,
      workspaceId: input.workspaceId,
      userId: ctx.userId,
    });

    const action = detail.actions.find((item) => item.id === input.actionId);
    if (!action) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_action_not_found' });

    if (action.runtimeType === 'record_update' || action.runtimeType === 'record_archive') {
      if (!input.recordId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'module_app_record_id_required' });
      }

      const record = await ctx.moduleAppModel.getRecord({
        appId: input.appId,
        recordId: input.recordId,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_record_not_found' });

      await assertRecordPermission({
        db: ctx.serverDB,
        operation: action.runtimeType === 'record_archive' ? 'archive' : 'update',
        record,
        userId: ctx.userId,
      });
    } else {
      await assertScopePermission({
        db: ctx.serverDB,
        operation: 'create',
        scopeType: input.scopeType,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
    }

    return runModuleAppAction({
      action,
      appId: input.appId,
      assertEntitlement: () =>
        assertRunnableApp({
          appId: input.appId,
          currentPlan: ctx.currentPlan,
          db: ctx.serverDB,
          model: ctx.moduleAppModel,
          userId: ctx.userId,
          workspaceId: input.workspaceId,
        }),
      input: input.input,
      model: ctx.moduleAppModel,
      recordId: input.recordId,
      scopeType: input.scopeType,
      textGenerator: createModuleAppTextGenerator({
        db: ctx.serverDB,
        workspaceId: input.workspaceId,
      }),
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

  updateRecord: moduleAppProcedure
    .input(moduleAppRecordInputSchema.required({ recordId: true }))
    .mutation(async ({ ctx, input }) => {
      await assertRunnableApp({
        appId: input.appId,
        currentPlan: ctx.currentPlan,
        db: ctx.serverDB,
        model: ctx.moduleAppModel,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });

      const record = await ctx.moduleAppModel.getRecord({
        appId: input.appId,
        recordId: input.recordId,
        userId: ctx.userId,
        workspaceId: input.workspaceId,
      });
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_record_not_found' });

      await assertRecordPermission({
        db: ctx.serverDB,
        operation: 'update',
        record,
        userId: ctx.userId,
      });

      return ctx.moduleAppModel.updateRecord({ ...input, userId: ctx.userId });
    }),
});

export type ModuleAppRouter = typeof moduleAppRouter;
