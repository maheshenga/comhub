import { TRPCError } from '@trpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  type AdminNewapiInstanceItem,
  adminNewapiInstanceModels,
  adminNewapiInstances,
  NEWAPI_MODEL_TYPES,
} from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';
import { invalidateNewapiInstancesCache } from '@/server/services/newapiInstance';
import {
  fetchNewapiModels,
  fetchNewapiPricing,
  normalizeNewapiSyncRows,
} from '@/server/services/newapiInstance/catalog';

import { recordAdminAudit } from './audit';

const maskApiKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
};

const NewapiModelTypeSchema = z.enum(NEWAPI_MODEL_TYPES);

const ProviderTypeSchema = z
  .enum(['newapi', 'openai-compatible', 'openai', 'deepseek', 'aliyun'])
  .default('newapi');

const InstanceInputSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  fetchOnClient: z.boolean().default(false),
  groupKey: z.string().min(1).max(64).default('default'),
  groupMultiplier: z.number().positive().optional(),
  groupName: z.string().max(128).optional(),
  name: z.string().min(1).max(128),
  priority: z.number().int().min(0).default(0),
  providerType: ProviderTypeSchema,
  usageScope: z.array(NewapiModelTypeSchema).optional(),
});

const ModelInputSchema = z.object({
  displayName: z.string().optional(),
  enabled: z.boolean().default(true),
  modelId: z.string().min(1).max(128),
  modelType: NewapiModelTypeSchema,
  sortOrder: z.number().int().default(0),
});

export const adminNewapiProvidersRouter = router({
  // ─── Instance CRUD ─────────────────────────────────────────────────────────

  createInstance: adminProcedure.input(InstanceInputSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.serverDB
      .insert(adminNewapiInstances)
      .values(input)
      .returning({ id: adminNewapiInstances.id });

    await recordAdminAudit(ctx, {
      action: 'newapiInstance.create',
      payload: { name: input.name },
      resourceId: row.id,
      resourceType: 'admin_newapi_instances',
    });
    invalidateNewapiInstancesCache();
    return { id: row.id };
  }),

  deleteInstance: adminProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const reason = input.reason?.trim();
      const result = await ctx.serverDB
        .delete(adminNewapiInstances)
        .where(eq(adminNewapiInstances.id, input.id))
        .returning({ id: adminNewapiInstances.id });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

      await recordAdminAudit(ctx, {
        action: 'newapiInstance.delete',
        payload: reason ? { reason } : undefined,
        resourceId: input.id,
        resourceType: 'admin_newapi_instances',
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  getInstance: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
        where: eq(adminNewapiInstances.id, input.id),
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

      return {
        ...instance,
        apiKey: maskApiKey(instance.apiKey),
      };
    }),

  listInstances: adminProcedure.query(async ({ ctx }) => {
    const items = await ctx.serverDB.query.adminNewapiInstances.findMany({
      orderBy: asc(adminNewapiInstances.priority),
    });
    return {
      items: items.map((i: AdminNewapiInstanceItem) => ({
        ...i,
        apiKey: maskApiKey(i.apiKey),
      })),
    };
  }),

  updateInstance: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: InstanceInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.serverDB
        .update(adminNewapiInstances)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(adminNewapiInstances.id, input.id))
        .returning({ id: adminNewapiInstances.id });

      if (result.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

      await recordAdminAudit(ctx, {
        action: 'newapiInstance.update',
        payload: { ...input.data, apiKey: input.data.apiKey ? '***' : undefined },
        resourceId: input.id,
        resourceType: 'admin_newapi_instances',
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  toggleInstanceEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(adminNewapiInstances)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(eq(adminNewapiInstances.id, input.id));

      await recordAdminAudit(ctx, {
        action: 'newapiInstance.toggle',
        payload: { enabled: input.enabled },
        resourceId: input.id,
        resourceType: 'admin_newapi_instances',
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  // ─── Instance Models CRUD ──────────────────────────────────────────────────

  syncInstanceModels: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
        where: eq(adminNewapiInstances.id, input.id),
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

      const [models, pricing, existingRows] = await Promise.all([
        fetchNewapiModels({ apiKey: instance.apiKey, baseUrl: instance.baseUrl }),
        fetchNewapiPricing({
          apiKey: instance.apiKey,
          baseUrl: instance.baseUrl,
          providerType: instance.providerType,
        }),
        ctx.serverDB
          .select({
            enabled: adminNewapiInstanceModels.enabled,
            modelId: adminNewapiInstanceModels.modelId,
            modelType: adminNewapiInstanceModels.modelType,
          })
          .from(adminNewapiInstanceModels)
          .where(eq(adminNewapiInstanceModels.instanceId, input.id)),
      ]);

      const rows = normalizeNewapiSyncRows({ existingRows, models, pricing }).map((row) => ({
        ...row,
        instanceId: input.id,
      }));

      if (rows.length > 0) {
        await ctx.serverDB
          .insert(adminNewapiInstanceModels)
          .values(rows)
          .onConflictDoUpdate({
            set: {
              displayName: sql`excluded.display_name`,
              metadata: sql`excluded.metadata`,
              sortOrder: sql`excluded.sort_order`,
              updatedAt: new Date(),
            },
            target: [
              adminNewapiInstanceModels.instanceId,
              adminNewapiInstanceModels.modelId,
              adminNewapiInstanceModels.modelType,
            ],
          });
      }

      await recordAdminAudit(ctx, {
        action: 'newapiInstanceModels.sync',
        payload: { count: rows.length },
        resourceId: input.id,
        resourceType: 'admin_newapi_instance_models',
      });
      invalidateNewapiInstancesCache();

      return {
        importedCount: rows.length,
        modelsCount: models.length,
        ok: true,
        pricingCount: pricing.length,
        warnings: pricing.length === 0 ? ['Pricing endpoint unavailable or empty'] : [],
      };
    }),

  testInstanceConnection: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
        where: eq(adminNewapiInstances.id, input.id),
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });

      try {
        const models = await fetchNewapiModels({
          apiKey: instance.apiKey,
          baseUrl: instance.baseUrl,
        });
        const pricing = await fetchNewapiPricing({
          apiKey: instance.apiKey,
          baseUrl: instance.baseUrl,
          providerType: instance.providerType,
        });

        return {
          modelsCount: models.length,
          ok: true,
          pricingCount: pricing.length,
          warnings: pricing.length === 0 ? ['Pricing endpoint unavailable or empty'] : [],
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
          modelsCount: 0,
          ok: false,
          pricingCount: 0,
          warnings: [],
        };
      }
    }),

  addModels: adminProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        models: z.array(ModelInputSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = input.models.map((m) => ({
        ...m,
        instanceId: input.instanceId,
      }));

      await ctx.serverDB
        .insert(adminNewapiInstanceModels)
        .values(rows)
        .onConflictDoUpdate({
          set: {
            displayName: sql`excluded.display_name`,
            enabled: sql`excluded.enabled`,
            sortOrder: sql`excluded.sort_order`,
            updatedAt: new Date(),
          },
          target: [
            adminNewapiInstanceModels.instanceId,
            adminNewapiInstanceModels.modelId,
            adminNewapiInstanceModels.modelType,
          ],
        });

      await recordAdminAudit(ctx, {
        action: 'newapiInstanceModels.add',
        payload: { count: input.models.length },
        resourceId: input.instanceId,
        resourceType: 'admin_newapi_instance_models',
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  listModels: adminProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        modelType: z
          .enum(NEWAPI_MODEL_TYPES)
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(adminNewapiInstanceModels.instanceId, input.instanceId)];
      if (input.modelType) {
        conditions.push(eq(adminNewapiInstanceModels.modelType, input.modelType));
      }

      const items = await ctx.serverDB
        .select()
        .from(adminNewapiInstanceModels)
        .where(and(...conditions))
        .orderBy(
          asc(adminNewapiInstanceModels.modelType),
          asc(adminNewapiInstanceModels.sortOrder),
        );

      return { items };
    }),

  removeModel: adminProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        modelId: z.string().min(1),
        modelType: z.enum(NEWAPI_MODEL_TYPES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .delete(adminNewapiInstanceModels)
        .where(
          and(
            eq(adminNewapiInstanceModels.instanceId, input.instanceId),
            eq(adminNewapiInstanceModels.modelId, input.modelId),
            eq(adminNewapiInstanceModels.modelType, input.modelType),
          ),
        );

      await recordAdminAudit(ctx, {
        action: 'newapiInstanceModels.remove',
        payload: { modelId: input.modelId, modelType: input.modelType },
        resourceId: input.instanceId,
        resourceType: 'admin_newapi_instance_models',
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  updateModel: adminProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        modelId: z.string().min(1),
        modelType: z.enum(NEWAPI_MODEL_TYPES),
        data: z.object({
          displayName: z.string().optional(),
          enabled: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(adminNewapiInstanceModels)
        .set({ ...input.data, updatedAt: new Date() })
        .where(
          and(
            eq(adminNewapiInstanceModels.instanceId, input.instanceId),
            eq(adminNewapiInstanceModels.modelId, input.modelId),
            eq(adminNewapiInstanceModels.modelType, input.modelType),
          ),
        );
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  // ─── Aggregated view for runtime usage ─────────────────────────────────────

  getAllEnabledModels: adminProcedure
    .input(
      z
        .object({
          modelType: z
            .enum(NEWAPI_MODEL_TYPES)
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(adminNewapiInstances.enabled, true),
        eq(adminNewapiInstanceModels.enabled, true),
      ];
      if (input?.modelType) {
        conditions.push(eq(adminNewapiInstanceModels.modelType, input.modelType));
      }

      const rows = await ctx.serverDB
        .select({
          baseUrl: adminNewapiInstances.baseUrl,
          displayName: adminNewapiInstanceModels.displayName,
          groupKey: adminNewapiInstances.groupKey,
          groupName: adminNewapiInstances.groupName,
          instanceId: adminNewapiInstances.id,
          instanceName: adminNewapiInstances.name,
          modelId: adminNewapiInstanceModels.modelId,
          modelType: adminNewapiInstanceModels.modelType,
          priority: adminNewapiInstances.priority,
          providerType: adminNewapiInstances.providerType,
        })
        .from(adminNewapiInstanceModels)
        .innerJoin(
          adminNewapiInstances,
          eq(adminNewapiInstanceModels.instanceId, adminNewapiInstances.id),
        )
        .where(and(...conditions))
        .orderBy(asc(adminNewapiInstances.priority), asc(adminNewapiInstanceModels.sortOrder));

      return { items: rows };
    }),
});
