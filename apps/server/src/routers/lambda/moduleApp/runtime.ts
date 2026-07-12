import { randomUUID } from 'node:crypto';

import {
  moduleAppBuildConfigSchema,
  moduleAppExecutableRuntimeSchema,
  moduleAppRunInputSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { assertModuleAppRolloutAllowed } from '@/business/server/module-apps/productionControls';
import { runModuleAppAction } from '@/business/server/module-apps/runModuleAppAction';
import { runModuleAppExecutableAction } from '@/business/server/module-apps/runners/executableActionRunner';
import { appEnv } from '@/envs/app';
import { createModuleAppTextGenerator } from '@/server/services/moduleAppAi';
import {
  signModuleAppCapability,
  verifyModuleAppCapability,
} from '@/server/services/moduleAppRuntime/capability';
import { ModuleAppRuntimeClient } from '@/server/services/moduleAppRuntime/client';
import { createModuleAppCapabilityGateway } from '@/server/services/moduleAppRuntime/gateway';

import {
  assertRecordPermission,
  assertRunnableApp,
  assertScopePermission,
  getWorkspaceMembership,
  moduleAppProcedure,
} from './data';

const AppIdInputSchema = z.object({ appId: z.string().uuid() });
const ModuleAppLaunchInputSchema = AppIdInputSchema.extend({
  workspaceId: z.string().min(1).optional(),
});
const ModuleAppLaunchRuntimeManifestSchema = z
  .object({
    build: moduleAppBuildConfigSchema,
    manifestVersion: z.literal(2),
    runtime: moduleAppExecutableRuntimeSchema,
  })
  .strict();
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

const getErrorIdentifier = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return error instanceof Error ? error.message : 'module_app_runtime_failed';
};

const mapGatewayError = (error: unknown) => {
  if (error instanceof TRPCError) return error;
  const identifier = getErrorIdentifier(error);

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

const assertRuntimeRolloutAllowed = (identity: {
  appId?: null | string;
  publisherId?: null | string;
}) => {
  try {
    assertModuleAppRolloutAllowed(identity, {
      appIds: appEnv.MODULE_APP_RUNTIME_APP_ALLOWLIST,
      publisherIds: appEnv.MODULE_APP_PUBLISHER_ALLOWLIST,
    });
  } catch (error) {
    throw new TRPCError({
      cause: error,
      code: 'FORBIDDEN',
      message: 'module_app_rollout_not_allowed',
    });
  }
};

export const moduleAppRuntimeProcedures = {
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

  getLaunchContext: moduleAppProcedure
    .input(ModuleAppLaunchInputSchema)
    .query(async ({ ctx, input }) => {
      if (!appEnv.MODULE_APP_EXECUTION_ENABLED || !appEnv.MODULE_APP_RUNTIME_PUBLIC_ORIGIN) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_runtime_unavailable',
        });
      }
      if (!appEnv.MODULE_APP_PUBLIC_EXECUTION_ENABLED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_public_execution_disabled',
        });
      }

      if (input.workspaceId) {
        const membership = await getWorkspaceMembership(ctx.serverDB, ctx.userId, input.workspaceId);
        if (!membership) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_workspace_denied' });
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
      assertRuntimeRolloutAllowed({ appId: input.appId, publisherId: installation.publisherId });

      const manifest = ModuleAppLaunchRuntimeManifestSchema.safeParse(installation.runtimeManifest);
      const artifactReady =
        installation.buildStatus === 'ready' &&
        Boolean(installation.artifactKey) &&
        Boolean(installation.artifactSha256) &&
        installation.artifactKey === installation.buildArtifactKey &&
        installation.artifactSha256 === installation.buildArtifactSha256;
      if (!artifactReady || !manifest.success) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'module_app_build_not_ready' });
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

  runAction: moduleAppProcedure.input(moduleAppRunInputSchema).mutation(async ({ ctx, input }) => {
    await assertRunnableApp({
      appId: input.appId,
      currentPlan: ctx.currentPlan,
      db: ctx.serverDB,
      model: ctx.moduleAppModel,
      workspaceId: input.workspaceId,
      userId: ctx.userId,
    });

    const installation = await ctx.moduleAppModel.getLaunchInstallationContext({
      appId: input.appId,
      userId: ctx.userId,
      workspaceId: input.workspaceId,
    });
    if (!installation) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'module_app_installation_required' });
    }

    const action = installation.actions.find((item) => item.id === input.actionId);
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

    let executableRunner;
    let installationId: string | undefined;
    if (action.runtimeType === 'executable_action') {
      if (!appEnv.MODULE_APP_EXECUTION_ENABLED) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'module_app_runtime_unavailable' });
      }
      if (!appEnv.MODULE_APP_RUNTIME_INVOCATION_ENABLED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_runtime_invocation_disabled',
        });
      }
      assertRuntimeRolloutAllowed({ appId: input.appId, publisherId: installation.publisherId });
      const manifest = ModuleAppLaunchRuntimeManifestSchema.safeParse(installation.runtimeManifest);
      const artifactReady =
        installation.buildStatus === 'ready' &&
        Boolean(installation.artifactKey) &&
        Boolean(installation.artifactSha256) &&
        installation.artifactKey === installation.buildArtifactKey &&
        installation.artifactSha256 === installation.buildArtifactSha256;
      if (!artifactReady || !manifest.success || !installation.artifactSha256) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'module_app_build_not_ready' });
      }
      const functionKey = action.runtimeConfig.functionKey;
      const runtimeFunction = manifest.data.runtime.functions.find((item) => item.key === functionKey);
      if (!runtimeFunction) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_executable_function_not_found',
        });
      }
      const configuredTimeout = action.runtimeConfig.timeoutMs;
      const timeoutMs = configuredTimeout === undefined ? 60_000 : Number(configuredTimeout);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'module_app_executable_timeout_invalid',
        });
      }
      const capability = await signModuleAppCapability(
        {
          appId: input.appId,
          artifactSha256: installation.artifactSha256,
          installationId: installation.installationId,
          permissions: manifest.data.runtime.permissions,
          surface: 'runtime',
          userId: ctx.userId,
          versionId: installation.versionId,
          workspaceId: installation.workspaceId ?? undefined,
        },
        { expiresInSeconds: 300 },
      );
      const runtimeClient = new ModuleAppRuntimeClient();
      const invocationId = randomUUID();
      installationId = installation.installationId;
      executableRunner = () =>
        runModuleAppExecutableAction({
          action,
          artifactSha256: installation.artifactSha256!,
          input: input.input,
          invocationId,
          invoke: ({ artifactSha256, input: runtimeInput, invocationId: runtimeInvocationId }) =>
            runtimeClient.invoke({
              artifactSha256,
              capability,
              entry: runtimeFunction.entry,
              input: runtimeInput,
              invocationId: runtimeInvocationId,
              runtime: runtimeFunction.runtime,
              timeoutMs,
            }),
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
      installationId,
      model: ctx.moduleAppModel,
      recordId: input.recordId,
      runner: executableRunner,
      scopeType: input.scopeType,
      textGenerator: createModuleAppTextGenerator({ db: ctx.serverDB, workspaceId: input.workspaceId }),
      userId: ctx.userId,
      workspaceId: input.workspaceId,
    });
  }),
};
