import type {
  PlatformPluginDetail,
  PlatformPluginListItem,
  PlatformPluginPlanEntitlement,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import {
  type PlatformPluginPermissionReason,
  resolvePlatformPluginPermission,
} from '@/business/server/platform-plugins/permission';
import { runPlatformPlugin } from '@/business/server/platform-plugins/runPlatformPlugin';
import { decryptPlatformPluginSecret } from '@/business/server/platform-plugins/secrets';
import { getSubscriptionPlan } from '@/business/server/user';
import { CommercialModel } from '@/database/models/commercial';
import { PlatformPluginModel } from '@/database/models/platformPlugin';
import {
  platformPluginActions,
  platformPluginAgentBindings,
  platformPluginInstallations,
  platformPluginSecrets,
  platformPluginVersions,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { FileService } from '@/server/services/file';

const PluginIdInputSchema = z.object({
  pluginId: z.string().uuid(),
});

const PluginIdOrSlugInputSchema = z.object({
  pluginIdOrSlug: z.string().min(1).max(160),
});

const AgentBindingInputSchema = z.object({
  agentId: z.string().min(1).max(160),
  enabled: z.boolean(),
  pluginId: z.string().uuid(),
});

const RunInputSchema = z.object({
  actionId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  agentId: z.string().min(1).max(160),
  input: z.record(z.string(), z.unknown()).default({}),
  pluginId: z.string().uuid(),
});

const platformPluginProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const currentPlan = await getSubscriptionPlan(ctx.serverDB, ctx.userId);

  return opts.next({
    ctx: {
      currentPlan,
      platformPluginModel: new PlatformPluginModel(ctx.serverDB),
    },
  });
});

const toListItem = (detail: PlatformPluginDetail): PlatformPluginListItem => ({
  billing: detail.billing,
  category: detail.category,
  displayName: detail.displayName,
  icon: detail.icon,
  id: detail.id,
  installed: detail.installed,
  planState: detail.planState,
  runtimeType: detail.runtimeType,
  slug: detail.slug,
  status: detail.status,
  tags: detail.tags,
});

const findPlanEntitlement = (
  detail: PlatformPluginDetail,
  plan: string,
): PlatformPluginPlanEntitlement | null =>
  detail.entitlements.find((entitlement) => entitlement.plan === plan) ?? null;

const throwPermissionDenied = (reason: PlatformPluginPermissionReason): never => {
  throw new TRPCError({ code: 'FORBIDDEN', message: reason });
};

const requirePluginDetail = async (params: {
  model: PlatformPluginModel;
  plan: string;
  pluginIdOrSlug: string;
  userId: string;
}) => {
  const detail = await params.model.getPluginDetail({
    plan: params.plan,
    pluginIdOrSlug: params.pluginIdOrSlug,
    userId: params.userId,
  });

  if (!detail) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'platform_plugin_not_found' });
  }

  return detail;
};

const findLatestVersionId = async (db: LobeChatDatabase, pluginId: string) => {
  const version = await db.query.platformPluginVersions.findFirst({
    orderBy: [desc(platformPluginVersions.createdAt)],
    where: eq(platformPluginVersions.pluginId, pluginId),
  });

  if (!version) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'platform_plugin_version_not_found' });
  }

  return version.id;
};

const findRuntimeActionRow = async (
  db: LobeChatDatabase,
  params: { actionKey: string; pluginId: string },
) => {
  const versionId = await findLatestVersionId(db, params.pluginId);
  const action = await db.query.platformPluginActions.findFirst({
    where: and(
      eq(platformPluginActions.pluginId, params.pluginId),
      eq(platformPluginActions.versionId, versionId),
      eq(platformPluginActions.actionKey, params.actionKey),
    ),
  });

  if (!action) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'platform_plugin_action_not_found' });
  }

  return { actionDbId: action.id, versionId };
};

const isPluginInstalled = async (db: LobeChatDatabase, params: { pluginId: string; userId: string }) => {
  const installation = await db.query.platformPluginInstallations.findFirst({
    where: and(
      eq(platformPluginInstallations.pluginId, params.pluginId),
      eq(platformPluginInstallations.userId, params.userId),
      eq(platformPluginInstallations.status, 'installed'),
      isNull(platformPluginInstallations.uninstalledAt),
    ),
  });

  return !!installation;
};

const isAgentBound = async (
  db: LobeChatDatabase,
  params: { agentId: string; pluginId: string; userId: string },
) => {
  const binding = await db.query.platformPluginAgentBindings.findFirst({
    where: and(
      eq(platformPluginAgentBindings.pluginId, params.pluginId),
      eq(platformPluginAgentBindings.userId, params.userId),
      eq(platformPluginAgentBindings.agentId, params.agentId),
      eq(platformPluginAgentBindings.enabled, true),
    ),
  });

  return !!binding;
};

const resolvePluginSecrets = async (db: LobeChatDatabase, pluginId: string) => {
  const rows = await db.query.platformPluginSecrets.findMany({
    where: eq(platformPluginSecrets.pluginId, pluginId),
  });
  const secrets: Record<string, string> = {};

  for (const row of rows) {
    const value = decryptPlatformPluginSecret(row.encryptedValue);
    secrets[row.secretKey] = value;
    secrets[`${row.scope}:${row.secretKey}`] = value;
  }

  return secrets;
};

const extractTextFromRuntimeResponse = async (response: unknown): Promise<string> => {
  if (response && typeof response === 'object' && 'text' in response) {
    const text = await (response as { text: () => Promise<string> }).text();

    try {
      const json = JSON.parse(text) as Record<string, any>;
      const choiceText = json.choices?.[0]?.message?.content ?? json.output_text ?? json.content;

      if (typeof choiceText === 'string') return choiceText;
    } catch {
      const dataLines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter((line) => line && line !== '[DONE]');

      if (dataLines.length > 0) return dataLines.join('\n');
    }

    return text;
  }

  return typeof response === 'string' ? response : JSON.stringify(response ?? '');
};

const createTextGenerator = (db: LobeChatDatabase, userId: string) => async ({
  model,
  prompt,
  provider,
}: {
  model?: string;
  prompt: string;
  provider?: string;
}) => {
  if (!provider || !model) {
    throw new Error('PLATFORM_PLUGIN_TEXT_GENERATOR_PROVIDER_MODEL_REQUIRED');
  }

  const runtime = await initModelRuntimeFromDB(db, userId, provider, { model });
  const response = await runtime.chat({
    messages: [{ content: prompt, role: 'user' }],
    model,
    stream: false,
  } as any);

  return {
    aiActualCredits: 0,
    text: await extractTextFromRuntimeResponse(response),
  };
};

export const platformPluginRouter = router({
  getDetail: platformPluginProcedure
    .input(PluginIdOrSlugInputSchema)
    .query(async ({ ctx, input }) => {
      return requirePluginDetail({
        model: ctx.platformPluginModel,
        plan: ctx.currentPlan,
        pluginIdOrSlug: input.pluginIdOrSlug,
        userId: ctx.userId,
      });
    }),

  install: platformPluginProcedure.input(PluginIdInputSchema).mutation(async ({ ctx, input }) => {
    const detail = await requirePluginDetail({
      model: ctx.platformPluginModel,
      plan: ctx.currentPlan,
      pluginIdOrSlug: input.pluginId,
      userId: ctx.userId,
    });
    const entitlement = findPlanEntitlement(detail, ctx.currentPlan);
    const decision = resolvePlatformPluginPermission({
      agentBound: false,
      entitlement,
      installed: detail.installed,
      pluginStatus: detail.status,
    });

    if (!decision.installable.allowed) {
      throwPermissionDenied(decision.installable.reason ?? 'plan_install_denied');
    }

    const versionId = await findLatestVersionId(ctx.serverDB, detail.id);
    await ctx.platformPluginModel.installPlugin({
      pluginId: detail.id,
      userId: ctx.userId,
      versionId,
    });

    return { ok: true };
  }),

  listInstalled: platformPluginProcedure.query(async ({ ctx }) => {
    const installed = await ctx.platformPluginModel.listInstalledPlugins({ userId: ctx.userId });
    const details = await Promise.all(
      installed.map((item) =>
        ctx.platformPluginModel.getPluginDetail({
          plan: ctx.currentPlan,
          pluginIdOrSlug: item.id,
          userId: ctx.userId,
        }),
      ),
    );

    return details.filter((detail): detail is PlatformPluginDetail => !!detail).map(toListItem);
  }),

  listMarketplace: platformPluginProcedure.query(async ({ ctx }) => {
    return ctx.platformPluginModel.listMarketplacePlugins({
      plan: ctx.currentPlan,
      userId: ctx.userId,
    });
  }),

  run: platformPluginProcedure.input(RunInputSchema).mutation(async ({ ctx, input }) => {
    const detail = await requirePluginDetail({
      model: ctx.platformPluginModel,
      plan: ctx.currentPlan,
      pluginIdOrSlug: input.pluginId,
      userId: ctx.userId,
    });
    const action = detail.actions.find((item) => item.id === input.actionId);

    if (!action) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'platform_plugin_action_not_found' });
    }

    const [agentBound, installed] = await Promise.all([
      isAgentBound(ctx.serverDB, {
        agentId: input.agentId,
        pluginId: detail.id,
        userId: ctx.userId,
      }),
      isPluginInstalled(ctx.serverDB, { pluginId: detail.id, userId: ctx.userId }),
    ]);
    const entitlement = findPlanEntitlement(detail, ctx.currentPlan);
    const decision = resolvePlatformPluginPermission({
      agentBound,
      entitlement,
      installed,
      pluginStatus: detail.status,
    });

    if (!decision.runnable.allowed) {
      throwPermissionDenied(decision.runnable.reason ?? 'plan_run_denied');
    }

    const runtimeAction = await findRuntimeActionRow(ctx.serverDB, {
      actionKey: action.id,
      pluginId: detail.id,
    });

    return runPlatformPlugin({
      action,
      actionDbId: runtimeAction.actionDbId,
      agentBound,
      agentId: input.agentId,
      artifactStorage: new FileService(ctx.serverDB, ctx.userId),
      commercialModel: new CommercialModel(ctx.serverDB, ctx.userId),
      currentPlan: ctx.currentPlan,
      db: ctx.serverDB,
      detail,
      input: input.input,
      installed,
      pluginId: detail.id,
      resolvedSecrets: await resolvePluginSecrets(ctx.serverDB, detail.id),
      textGenerator: createTextGenerator(ctx.serverDB, ctx.userId),
      userId: ctx.userId,
      versionId: runtimeAction.versionId,
    });
  }),

  setAgentBinding: platformPluginProcedure
    .input(AgentBindingInputSchema)
    .mutation(async ({ ctx, input }) => {
      const detail = await requirePluginDetail({
        model: ctx.platformPluginModel,
        plan: ctx.currentPlan,
        pluginIdOrSlug: input.pluginId,
        userId: ctx.userId,
      });

      if (input.enabled) {
        const installed = await isPluginInstalled(ctx.serverDB, {
          pluginId: detail.id,
          userId: ctx.userId,
        });
        const entitlement = findPlanEntitlement(detail, ctx.currentPlan);
        const decision = resolvePlatformPluginPermission({
          agentBound: true,
          entitlement,
          installed,
          pluginStatus: detail.status,
        });

        if (!decision.runnable.allowed) {
          throwPermissionDenied(decision.runnable.reason ?? 'plan_run_denied');
        }
      }

      await ctx.platformPluginModel.setAgentBinding({
        agentId: input.agentId,
        enabled: input.enabled,
        pluginId: detail.id,
        userId: ctx.userId,
      });

      return { ok: true };
    }),

  uninstall: platformPluginProcedure
    .input(PluginIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.platformPluginModel.uninstallPlugin({
        pluginId: input.pluginId,
        userId: ctx.userId,
      });

      return { ok: true };
    }),
});

export type PlatformPluginRouter = typeof platformPluginRouter;
