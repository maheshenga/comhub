import {
  platformPluginAdminUpsertSchema,
  platformPluginBillingConfigSchema,
  platformPluginPlanEntitlementSchema,
  platformPluginStatusSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { PlatformPluginModel } from '@/database/models/platformPlugin';
import {
  platformPluginActions,
  platformPluginArtifacts,
  platformPluginPlanEntitlements,
  platformPluginRuns,
  platformPluginSecrets,
  platformPlugins,
  platformPluginVersions,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';

import { writePlatformPluginAuditLog } from '../../platform-plugins/audit';
import {
  encryptPlatformPluginSecret,
  maskPlatformPluginSecret,
} from '../../platform-plugins/secrets';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const auditReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.auditRead);
const contentWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.contentWrite);
const financeWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.financeWrite);
const systemWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemWrite);

const SecretKeySchema = z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_:-]*$/);
const SecretScopeSchema = z.string().min(1).max(80).regex(/^[a-z][a-z0-9_-]*$/).default('global');

const ListInputSchema = z
  .object({
    category: z.string().min(1).max(80).optional(),
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(200).default(50),
    status: platformPluginStatusSchema.optional(),
  })
  .optional();

const PluginIdInputSchema = z.object({
  pluginId: z.string().uuid(),
});

const PluginIdOrSlugInputSchema = z.object({
  pluginIdOrSlug: z.string().min(1).max(160),
});

const EntitlementsInputSchema = z.object({
  entitlements: z.array(platformPluginPlanEntitlementSchema).max(100),
  pluginSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const BillingInputSchema = z.object({
  billing: platformPluginBillingConfigSchema,
  pluginId: z.string().uuid(),
});

const SecretInputSchema = z.object({
  key: SecretKeySchema,
  pluginId: z.string().uuid(),
  scope: SecretScopeSchema,
  value: z.string().min(1).max(20_000),
});

const DeleteSecretInputSchema = SecretInputSchema.omit({ value: true });

const ListByPluginInputSchema = z.object({
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(50),
  pluginId: z.string().uuid(),
});

type PlatformPluginRow = typeof platformPlugins.$inferSelect;
type PlatformPluginSecretRow = typeof platformPluginSecrets.$inferSelect;

const findPluginByIdOrSlug = async (
  db: LobeChatDatabase,
  pluginIdOrSlug: string,
): Promise<PlatformPluginRow | undefined> => {
  return db.query.platformPlugins.findFirst({
    where: UUID_PATTERN.test(pluginIdOrSlug)
      ? eq(platformPlugins.id, pluginIdOrSlug)
      : eq(platformPlugins.slug, pluginIdOrSlug),
  });
};

const findPluginForAdminUpsert = async (
  db: LobeChatDatabase,
  input: z.infer<typeof platformPluginAdminUpsertSchema>,
): Promise<PlatformPluginRow | undefined> => {
  if (input.id) {
    const byId = await db.query.platformPlugins.findFirst({
      where: eq(platformPlugins.id, input.id),
    });

    if (byId) return byId;
  }

  return db.query.platformPlugins.findFirst({
    where: eq(platformPlugins.slug, input.slug),
  });
};

const requirePluginById = async (db: LobeChatDatabase, pluginId: string) => {
  const plugin = await db.query.platformPlugins.findFirst({
    where: eq(platformPlugins.id, pluginId),
  });

  if (!plugin) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform plugin not found' });
  }

  return plugin;
};

const toSecretMetadata = (secret: PlatformPluginSecretRow) => ({
  configured: true,
  createdAt: secret.createdAt,
  id: secret.id,
  key: secret.secretKey,
  lastUsedAt: secret.lastUsedAt,
  maskedValue: secret.maskedValue,
  scope: secret.scope,
  updatedAt: secret.updatedAt,
});

const writeAudit = async (
  ctx: { serverDB: LobeChatDatabase; userId: string },
  input: {
    eventType: string;
    metadata?: Record<string, unknown> | null;
    resourceId: string;
  },
) => {
  await writePlatformPluginAuditLog({
    actorUserId: ctx.userId,
    db: ctx.serverDB,
    eventType: input.eventType,
    metadata: input.metadata,
    resourceId: input.resourceId,
    resourceType: 'platformPlugin',
  });
};

export const adminPlatformPluginsRouter = router({
  deleteSecret: systemWriteProcedure.input(DeleteSecretInputSchema).mutation(async ({ ctx, input }) => {
    await requirePluginById(ctx.serverDB, input.pluginId);
    await ctx.serverDB
      .delete(platformPluginSecrets)
      .where(
        and(
          eq(platformPluginSecrets.pluginId, input.pluginId),
          eq(platformPluginSecrets.scope, input.scope),
          eq(platformPluginSecrets.secretKey, input.key),
        ),
      );

    await writeAudit(ctx, {
      eventType: 'platform_plugin.secret_deleted',
      metadata: { key: input.key, scope: input.scope },
      resourceId: input.pluginId,
    });

    return { ok: true };
  }),

  get: auditReadProcedure.input(PluginIdOrSlugInputSchema).query(async ({ ctx, input }) => {
    const plugin = await findPluginByIdOrSlug(ctx.serverDB, input.pluginIdOrSlug);

    if (!plugin) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform plugin not found' });
    }

    const [version, actions, entitlements, secrets] = await Promise.all([
      ctx.serverDB.query.platformPluginVersions.findFirst({
        orderBy: [desc(platformPluginVersions.createdAt)],
        where: eq(platformPluginVersions.pluginId, plugin.id),
      }),
      ctx.serverDB.query.platformPluginActions.findMany({
        orderBy: [asc(platformPluginActions.createdAt)],
        where: eq(platformPluginActions.pluginId, plugin.id),
      }),
      ctx.serverDB.query.platformPluginPlanEntitlements.findMany({
        orderBy: [asc(platformPluginPlanEntitlements.plan)],
        where: eq(platformPluginPlanEntitlements.pluginId, plugin.id),
      }),
      ctx.serverDB.query.platformPluginSecrets.findMany({
        orderBy: [asc(platformPluginSecrets.scope), asc(platformPluginSecrets.secretKey)],
        where: eq(platformPluginSecrets.pluginId, plugin.id),
      }),
    ]);

    return {
      ...plugin,
      actions,
      entitlements,
      secrets: secrets.map(toSecretMetadata),
      version: version?.version ?? null,
    };
  }),

  list: auditReadProcedure.input(ListInputSchema).query(async ({ ctx, input }) => {
    const params = input ?? { cursor: 0, limit: 50 };
    const conditions = [
      ...(params.status ? [eq(platformPlugins.status, params.status)] : []),
      ...(params.category ? [eq(platformPlugins.category, params.category)] : []),
    ];
    const items = await ctx.serverDB.query.platformPlugins.findMany({
      limit: params.limit,
      offset: params.cursor,
      orderBy: [asc(platformPlugins.sortOrder), asc(platformPlugins.displayName)],
      where: conditions.length > 0 ? and(...conditions) : undefined,
    });

    return {
      items,
      nextCursor: items.length === params.limit ? params.cursor + params.limit : null,
    };
  }),

  listArtifacts: auditReadProcedure.input(ListByPluginInputSchema).query(async ({ ctx, input }) => {
    await requirePluginById(ctx.serverDB, input.pluginId);
    const items = await ctx.serverDB.query.platformPluginArtifacts.findMany({
      limit: input.limit,
      offset: input.cursor,
      orderBy: [desc(platformPluginArtifacts.createdAt)],
      where: eq(platformPluginArtifacts.pluginId, input.pluginId),
    });

    return {
      items,
      nextCursor: items.length === input.limit ? input.cursor + input.limit : null,
    };
  }),

  listRuns: auditReadProcedure.input(ListByPluginInputSchema).query(async ({ ctx, input }) => {
    await requirePluginById(ctx.serverDB, input.pluginId);
    const items = await ctx.serverDB.query.platformPluginRuns.findMany({
      limit: input.limit,
      offset: input.cursor,
      orderBy: [desc(platformPluginRuns.createdAt)],
      where: eq(platformPluginRuns.pluginId, input.pluginId),
    });

    return {
      items,
      nextCursor: items.length === input.limit ? input.cursor + input.limit : null,
    };
  }),

  publish: contentWriteProcedure.input(PluginIdInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.serverDB
      .update(platformPlugins)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(platformPlugins.id, input.pluginId))
      .returning({ id: platformPlugins.id });

    if (result.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform plugin not found' });
    }

    await writeAudit(ctx, {
      eventType: 'platform_plugin.published',
      metadata: { status: 'published' },
      resourceId: input.pluginId,
    });

    return { ok: true };
  }),

  unpublish: contentWriteProcedure.input(PluginIdInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.serverDB
      .update(platformPlugins)
      .set({ status: 'unpublished', updatedAt: new Date() })
      .where(eq(platformPlugins.id, input.pluginId))
      .returning({ id: platformPlugins.id });

    if (result.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform plugin not found' });
    }

    await writeAudit(ctx, {
      eventType: 'platform_plugin.unpublished',
      metadata: { status: 'unpublished' },
      resourceId: input.pluginId,
    });

    return { ok: true };
  }),

  upsert: contentWriteProcedure.input(platformPluginAdminUpsertSchema).mutation(async ({ ctx, input }) => {
    const existing = await findPluginForAdminUpsert(ctx.serverDB, input);
    const result = await new PlatformPluginModel(ctx.serverDB).upsertPluginForAdmin(input);

    await writeAudit(ctx, {
      eventType: existing ? 'platform_plugin.updated' : 'platform_plugin.created',
      metadata: {
        category: input.category,
        runtimeType: input.runtimeType,
        slug: input.slug,
        status: input.status,
      },
      resourceId: result.id,
    });

    return result;
  }),

  upsertBilling: financeWriteProcedure.input(BillingInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.serverDB
      .update(platformPlugins)
      .set({ billing: input.billing, updatedAt: new Date() })
      .where(eq(platformPlugins.id, input.pluginId))
      .returning({ id: platformPlugins.id });

    if (result.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform plugin not found' });
    }

    await writeAudit(ctx, {
      eventType: 'platform_plugin.billing_updated',
      metadata: { billing: input.billing },
      resourceId: input.pluginId,
    });

    return { ok: true };
  }),

  upsertEntitlements: financeWriteProcedure.input(EntitlementsInputSchema).mutation(async ({ ctx, input }) => {
    const plugin = await ctx.serverDB.query.platformPlugins.findFirst({
      where: eq(platformPlugins.slug, input.pluginSlug),
    });

    if (!plugin) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform plugin not found' });
    }

    await new PlatformPluginModel(ctx.serverDB).setPlanEntitlements(
      input.pluginSlug,
      input.entitlements,
    );

    await writeAudit(ctx, {
      eventType: 'platform_plugin.entitlements_updated',
      metadata: { entitlements: input.entitlements },
      resourceId: plugin.id,
    });

    return { ok: true };
  }),

  upsertSecret: systemWriteProcedure.input(SecretInputSchema).mutation(async ({ ctx, input }) => {
    await requirePluginById(ctx.serverDB, input.pluginId);

    const encryptedValue = encryptPlatformPluginSecret(input.value);
    const maskedValue = maskPlatformPluginSecret(input.value);
    const existing = await ctx.serverDB.query.platformPluginSecrets.findFirst({
      where: and(
        eq(platformPluginSecrets.pluginId, input.pluginId),
        eq(platformPluginSecrets.scope, input.scope),
        eq(platformPluginSecrets.secretKey, input.key),
      ),
    });

    if (existing) {
      await ctx.serverDB
        .update(platformPluginSecrets)
        .set({
          encryptedValue,
          maskedValue,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(platformPluginSecrets.id, existing.id));
    } else {
      await ctx.serverDB.insert(platformPluginSecrets).values({
        createdBy: ctx.userId,
        encryptedValue,
        maskedValue,
        pluginId: input.pluginId,
        scope: input.scope,
        secretKey: input.key,
        updatedBy: ctx.userId,
      });
    }

    await writeAudit(ctx, {
      eventType: 'platform_plugin.secret_upserted',
      metadata: {
        configured: true,
        key: input.key,
        maskedValue,
        scope: input.scope,
      },
      resourceId: input.pluginId,
    });

    return {
      configured: true,
      key: input.key,
      maskedValue,
      scope: input.scope,
    };
  }),
});
