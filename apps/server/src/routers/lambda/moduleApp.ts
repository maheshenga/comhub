import {
  moduleAppMarketplaceListInputSchema,
  moduleAppRecordInputSchema,
  moduleAppRunInputSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  assertModuleAppRecordPermission,
  type ModuleAppRecordOperation,
  type ModuleAppWorkspaceMembership,
} from '@/business/server/module-apps/permission';
import { runModuleAppAction } from '@/business/server/module-apps/runModuleAppAction';
import { getSubscriptionPlan } from '@/business/server/user';
import { ModuleAppModel } from '@/database/models/moduleApp';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import type { ModuleAppRecordItem } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const AppIdInputSchema = z.object({
  appId: z.string().uuid(),
});

const AppIdOrSlugInputSchema = z.object({
  appIdOrSlug: z.string().min(1).max(160),
});

const RecordIdInputSchema = z.object({
  appId: z.string().uuid(),
  recordId: z.string().uuid(),
  workspaceId: z.string().optional(),
});

const moduleAppProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const currentPlan = await getSubscriptionPlan(opts.ctx.serverDB, opts.ctx.userId);

  return opts.next({
    ctx: {
      currentPlan,
      moduleAppModel: new ModuleAppModel(opts.ctx.serverDB),
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

const assertRunnableApp = async (params: {
  appId: string;
  currentPlan: string;
  model: ModuleAppModel;
  userId: string;
}) => {
  const detail = await params.model.getAppDetail({
    appIdOrSlug: params.appId,
    plan: params.currentPlan,
    userId: params.userId,
  });

  if (!detail) throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });

  if (!detail.planState.runnable) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'plan_run_denied' });
  }

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
        model: ctx.moduleAppModel,
        userId: ctx.userId,
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

  installPersonal: moduleAppProcedure.input(AppIdInputSchema).mutation(async ({ ctx, input }) => {
    const detail = await ctx.moduleAppModel.getAppDetail({
      appIdOrSlug: input.appId,
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });

    if (!detail) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'module_app_not_found' });
    }

    if (!detail.planState.installable) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'plan_install_denied' });
    }

    await ctx.moduleAppModel.installPersonalApp({ appId: detail.id, userId: ctx.userId });

    return { ok: true };
  }),

  listArtifacts: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listArtifacts({ ...input, userId: ctx.userId });
  }),

  listMarketplace: moduleAppProcedure
    .input(moduleAppMarketplaceListInputSchema)
    .query(async ({ ctx, input }) => {
      return ctx.moduleAppModel.listMarketplaceApps({
        filters: input,
        plan: ctx.currentPlan,
        userId: ctx.userId,
      });
    }),

  listMyApps: moduleAppProcedure.query(async ({ ctx }) => {
    return ctx.moduleAppModel.listInstalledApps({
      scopeType: 'personal',
      userId: ctx.userId,
    });
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

  listRuns: moduleAppProcedure.input(AppIdInputSchema).query(async ({ ctx, input }) => {
    return ctx.moduleAppModel.listRuns({ ...input, userId: ctx.userId });
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
      model: ctx.moduleAppModel,
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
      input: input.input,
      model: ctx.moduleAppModel,
      recordId: input.recordId,
      scopeType: input.scopeType,
      userId: ctx.userId,
      workspaceId: input.workspaceId,
    });
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
        model: ctx.moduleAppModel,
        userId: ctx.userId,
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
