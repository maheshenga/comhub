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
import { getSubscriptionPlan } from '@/business/server/user';
import { PlatformPluginModel } from '@/database/models/platformPlugin';
import {
  platformPluginAgentBindings,
  platformPluginInstallations,
  platformPluginVersions,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

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

    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'platform_plugin_runtime_not_ready' });
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
