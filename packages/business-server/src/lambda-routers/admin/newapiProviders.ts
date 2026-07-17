import { TRPCError } from '@trpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import { z } from 'zod';

import {
  type AdminNewapiInstanceItem,
  type AdminNewapiInstanceModelItem,
  adminNewapiInstanceModels,
  adminNewapiInstances,
  NEWAPI_MODEL_TYPES,
} from '@/database/schemas';
import { ADMIN_CAPABILITIES, adminCapabilityProcedure, router } from '@/libs/trpc/lambda';
import { getModelCatalogDiagnostics } from '@/server/services/modelCatalog/diagnostics';
import { invalidateNewapiInstancesCache } from '@/server/services/newapiInstance';
import {
  buildNewapiPricingSyncWarnings,
  fetchNewapiModels,
  fetchNewapiPricing,
  normalizeNewapiSyncRows,
} from '@/server/services/newapiInstance/catalog';
import {
  encryptAdminProviderApiKey,
  maybeBackfillPlaintextAdminProviderApiKey,
  tryDecryptAdminProviderApiKey,
} from '@/server/services/newapiInstance/credentials';

import { createAdminCommand } from './adminCommand';
import { recordAdminAudit, runRequiredAdminAuditMutation } from './audit';

const maskApiKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
};

const NewapiModelTypeSchema = z.enum(NEWAPI_MODEL_TYPES);

const ProviderTypeSchema = z
  .enum([
    'newapi',
    'openai-compatible',
    'openai',
    'claude',
    'deepseek',
    'aliyun',
    'opencode-go',
    'siliconflow',
  ])
  .default('newapi');

type AdminProviderType = z.infer<typeof ProviderTypeSchema>;

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

const ModelMetadataSchema = z
  .object({
    manualPricing: z
      .object({
        imageRate: z.number().positive().optional(),
        inputCostRate: z.number().positive().optional(),
        inputRate: z.number().positive().optional(),
        marginMultiplier: z.number().positive().optional(),
        outputCostRate: z.number().positive().optional(),
        outputRate: z.number().positive().optional(),
        source: z.string().optional(),
        videoRate: z.number().positive().optional(),
      })
      .optional(),
  })
  .passthrough();

const INVALID_API_KEY_MESSAGE = 'Instance API key is invalid. Please reset it before retrying.';
const modelOpsReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.modelOpsRead);
const modelOpsWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.modelOpsWrite);
const deleteInstanceCommand = createAdminCommand('newapiProvider.deleteInstance');

const normalizeInstanceInput = async <T extends { apiKey?: string; fetchOnClient?: boolean }>(
  input: T,
) => {
  const data = { ...input, fetchOnClient: false };
  if (!data.apiKey) return data;

  return {
    ...data,
    apiKey: await encryptAdminProviderApiKey(data.apiKey),
  };
};

const decryptInstance = async <T extends { apiKey: string | null; id: string }>(
  db: any,
  instance: T,
) => {
  const result = await tryDecryptAdminProviderApiKey(instance.apiKey);
  if (!result.ok) {
    return {
      ...instance,
      apiKey: '',
      apiKeyStatus: 'invalid' as const,
    };
  }

  await maybeBackfillPlaintextAdminProviderApiKey(db, {
    apiKey: instance.apiKey ?? '',
    instanceId: instance.id,
  });

  return {
    ...instance,
    apiKey: result.apiKey,
    apiKeyStatus: 'ok' as const,
  };
};

const assertInstanceApiKeyReady = <T extends { apiKeyStatus?: 'invalid' | 'ok' }>(instance: T) => {
  if (instance.apiKeyStatus === 'invalid') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: INVALID_API_KEY_MESSAGE,
    });
  }
};

const MODEL_PRICING_KEYS = [
  'inputCostRate',
  'inputRate',
  'outputCostRate',
  'outputRate',
  'imageRate',
  'videoRate',
];

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasPositiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
};

const resolveModelPricingCompleteness = (metadata: Record<string, unknown> | null | undefined) => {
  if (!isPlainRecord(metadata)) return false;
  if (metadata.pricingAvailable === true) return true;
  if (hasPositiveNumber(metadata.modelPrice) || hasPositiveNumber(metadata.modelRatio)) return true;

  const manualPricing = metadata.manualPricing;
  if (!isPlainRecord(manualPricing)) return false;

  return MODEL_PRICING_KEYS.some((key) => hasPositiveNumber(manualPricing[key]));
};

const MODEL_BANK_PROVIDER_BY_ADMIN_PROVIDER_TYPE: Partial<Record<AdminProviderType, string>> = {
  claude: 'anthropic',
  deepseek: 'deepseek',
  openai: 'openai',
  siliconflow: 'siliconcloud',
};

const hasExactModelBankPricing = ({
  modelId,
  providerType,
}: {
  modelId: string;
  providerType: string | null | undefined;
}) => {
  const modelBankProviderId =
    MODEL_BANK_PROVIDER_BY_ADMIN_PROVIDER_TYPE[providerType as AdminProviderType];
  if (!modelBankProviderId) return false;

  return LOBE_DEFAULT_MODEL_LIST.some(
    (item) =>
      item.providerId === modelBankProviderId && item.id === modelId && Boolean(item.pricing),
  );
};

type AdminEnabledProviderModelRow = {
  baseUrl: AdminNewapiInstanceItem['baseUrl'];
  displayName: AdminNewapiInstanceModelItem['displayName'];
  groupKey: AdminNewapiInstanceItem['groupKey'];
  groupName: AdminNewapiInstanceItem['groupName'];
  instanceId: AdminNewapiInstanceItem['id'];
  instanceName: AdminNewapiInstanceItem['name'];
  metadata: AdminNewapiInstanceModelItem['metadata'];
  modelId: AdminNewapiInstanceModelItem['modelId'];
  modelType: AdminNewapiInstanceModelItem['modelType'];
  priority: AdminNewapiInstanceItem['priority'];
  providerType: AdminNewapiInstanceItem['providerType'];
};

const resolveModelPricingSource = ({
  metadata,
  modelId,
  providerType,
}: {
  metadata: Record<string, unknown> | null | undefined;
  modelId: string;
  providerType: string | null | undefined;
}) => {
  if (resolveModelPricingCompleteness(metadata)) return 'database';

  return hasExactModelBankPricing({ modelId, providerType }) ? 'model-bank' : 'missing';
};

const resolveModelAbilityCompleteness = (metadata: Record<string, unknown> | null | undefined) => {
  if (!isPlainRecord(metadata)) return false;

  const manualAbilities = metadata.manualAbilities;
  if (!isPlainRecord(manualAbilities)) return false;

  return Object.values(manualAbilities).some((value) => typeof value === 'boolean');
};

export const adminNewapiProvidersRouter = router({
  // ─── Instance CRUD ─────────────────────────────────────────────────────────

  createInstance: modelOpsWriteProcedure
    .input(InstanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const data = await normalizeInstanceInput(input);
      const [row] = await ctx.serverDB
        .insert(adminNewapiInstances)
        .values(data)
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

  deleteInstance: modelOpsWriteProcedure
    .input(
      z.object({
        command: deleteInstanceCommand.schema,
        id: z.string().uuid(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const command = deleteInstanceCommand.validate(input.command, input.reason);
      const reason = command.reason;
      await runRequiredAdminAuditMutation(ctx, {
        audit: () => ({
          action: command.auditAction,
          payload: reason ? { reason } : undefined,
          resourceId: input.id,
          resourceType: 'admin_newapi_instances',
        }),
        mutation: async (tx) => {
          const result = await tx
            .delete(adminNewapiInstances)
            .where(eq(adminNewapiInstances.id, input.id))
            .returning({ id: adminNewapiInstances.id });

          if (result.length === 0)
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });
        },
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  getInstance: modelOpsReadProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
        where: eq(adminNewapiInstances.id, input.id),
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });
      const decrypted = await decryptInstance(ctx.serverDB, instance);

      return {
        ...instance,
        apiKey: decrypted.apiKeyStatus === 'invalid' ? null : maskApiKey(decrypted.apiKey),
        apiKeyStatus: decrypted.apiKeyStatus,
      };
    }),

  listInstances: modelOpsReadProcedure.query(async ({ ctx }) => {
    const items = await ctx.serverDB.query.adminNewapiInstances.findMany({
      orderBy: asc(adminNewapiInstances.priority),
    });
    const decryptedItems = await Promise.all(
      items.map((i: AdminNewapiInstanceItem) => decryptInstance(ctx.serverDB, i)),
    );
    return {
      items: decryptedItems.map((i) => ({
        ...i,
        apiKey: i.apiKeyStatus === 'invalid' ? null : maskApiKey(i.apiKey),
      })),
    };
  }),

  updateInstance: modelOpsWriteProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: InstanceInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = await normalizeInstanceInput(input.data);
      const result = await ctx.serverDB
        .update(adminNewapiInstances)
        .set({ ...data, updatedAt: new Date() })
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

  toggleInstanceEnabled: modelOpsWriteProcedure
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

  syncInstanceModels: modelOpsWriteProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
        where: eq(adminNewapiInstances.id, input.id),
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });
      const decryptedInstance = await decryptInstance(ctx.serverDB, instance);
      assertInstanceApiKeyReady(decryptedInstance);

      const [models, pricingResult, existingRows] = await Promise.all([
        fetchNewapiModels({
          apiKey: decryptedInstance.apiKey,
          baseUrl: instance.baseUrl,
          providerType: instance.providerType,
        }),
        fetchNewapiPricing({
          apiKey: decryptedInstance.apiKey,
          baseUrl: instance.baseUrl,
          providerType: instance.providerType,
        }),
        ctx.serverDB
          .select({
            displayName: adminNewapiInstanceModels.displayName,
            enabled: adminNewapiInstanceModels.enabled,
            metadata: adminNewapiInstanceModels.metadata,
            modelId: adminNewapiInstanceModels.modelId,
            modelType: adminNewapiInstanceModels.modelType,
            sortOrder: adminNewapiInstanceModels.sortOrder,
          })
          .from(adminNewapiInstanceModels)
          .where(eq(adminNewapiInstanceModels.instanceId, input.id)),
      ]);

      const normalizedRows = normalizeNewapiSyncRows({
        existingRows,
        models,
        pricing: pricingResult.items,
        pricingStatus: pricingResult.status,
      });
      const rows = normalizedRows.map((row) => ({ ...row, instanceId: input.id }));
      const staleCount = normalizedRows.filter((row) => row.metadata.syncStatus === 'stale').length;
      const importedCount = normalizedRows.length - staleCount;

      if (rows.length > 0) {
        await ctx.serverDB
          .insert(adminNewapiInstanceModels)
          .values(rows)
          .onConflictDoUpdate({
            set: {
              displayName: sql`excluded.display_name`,
              enabled: sql`excluded.enabled`,
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
        payload: { count: importedCount, staleCount },
        resourceId: input.id,
        resourceType: 'admin_newapi_instance_models',
      });
      invalidateNewapiInstancesCache();

      return {
        importedCount,
        modelsCount: importedCount,
        ok: true,
        pricingCount: pricingResult.items.length,
        staleCount,
        warnings: buildNewapiPricingSyncWarnings(
          instance.providerType,
          pricingResult.items.length,
          pricingResult.status,
        ),
      };
    }),

  testInstanceConnection: modelOpsWriteProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.serverDB.query.adminNewapiInstances.findFirst({
        where: eq(adminNewapiInstances.id, input.id),
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });
      const decryptedInstance = await decryptInstance(ctx.serverDB, instance);

      if (decryptedInstance.apiKeyStatus === 'invalid') {
        return {
          error: INVALID_API_KEY_MESSAGE,
          modelsCount: 0,
          ok: false,
          pricingCount: 0,
          warnings: [],
        };
      }

      try {
        const models = await fetchNewapiModels({
          apiKey: decryptedInstance.apiKey,
          baseUrl: instance.baseUrl,
          providerType: instance.providerType,
        });
        const pricingResult = await fetchNewapiPricing({
          apiKey: decryptedInstance.apiKey,
          baseUrl: instance.baseUrl,
          providerType: instance.providerType,
        });

        return {
          modelsCount: models.length,
          ok: true,
          pricingCount: pricingResult.items.length,
          warnings: buildNewapiPricingSyncWarnings(
            instance.providerType,
            pricingResult.items.length,
            pricingResult.status,
          ),
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

  getModelCatalogDiagnostics: modelOpsReadProcedure.query(async ({ ctx }) => {
    const { AiInfraRepos } = await import('@/database/repositories/aiInfra');
    const { getServerGlobalConfig } = await import('@/server/globalConfig');
    const { resolvePlanModelRules } = await import('@/business/server/planModelRules');
    const { KeyVaultsGateKeeper } = await import('@/server/modules/KeyVaultsEncrypt');

    const { aiProvider } = await getServerGlobalConfig(ctx.serverDB);
    const aiInfraRepos = new AiInfraRepos(ctx.serverDB, ctx.userId, aiProvider as any);
    const [state, planRules] = await Promise.all([
      aiInfraRepos.getAiProviderRuntimeState(KeyVaultsGateKeeper.getUserKeyVaults),
      resolvePlanModelRules({ db: ctx.serverDB, userId: ctx.userId }),
    ]);

    return getModelCatalogDiagnostics({ planRules, state });
  }),

  refreshRuntimeCache: modelOpsWriteProcedure.mutation(async ({ ctx }) => {
    invalidateNewapiInstancesCache();

    await recordAdminAudit(ctx, {
      action: 'newapiInstanceModels.refreshRuntimeCache',
      payload: { source: 'admin' },
      resourceType: 'admin_newapi_instance_models',
    });

    return { refreshedAt: new Date().toISOString() };
  }),

  addModels: modelOpsWriteProcedure
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

  listModels: modelOpsReadProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        modelType: z.enum(NEWAPI_MODEL_TYPES).optional(),
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

  removeModel: modelOpsWriteProcedure
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

  updateModel: modelOpsWriteProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        modelId: z.string().min(1),
        modelType: z.enum(NEWAPI_MODEL_TYPES),
        data: z.object({
          displayName: z.string().optional(),
          enabled: z.boolean().optional(),
          metadata: ModelMetadataSchema.nullish(),
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

      await recordAdminAudit(ctx, {
        action: 'newapiInstanceModels.update',
        payload: {
          fields: Object.keys(input.data),
          modelId: input.modelId,
          modelType: input.modelType,
        },
        resourceId: input.instanceId,
        resourceType: 'admin_newapi_instance_models',
      });
      invalidateNewapiInstancesCache();
      return { ok: true };
    }),

  // ─── Aggregated view for runtime usage ─────────────────────────────────────

  getAllEnabledModels: modelOpsReadProcedure
    .input(
      z
        .object({
          modelType: z.enum(NEWAPI_MODEL_TYPES).optional(),
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
          metadata: adminNewapiInstanceModels.metadata,
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

      const items = rows.map((row: AdminEnabledProviderModelRow) => {
        const { metadata, ...item } = row;

        return {
          ...item,
          hasModelAbilities: resolveModelAbilityCompleteness(metadata),
          hasModelPricing: resolveModelPricingCompleteness(metadata),
          pricingSource: resolveModelPricingSource({
            metadata,
            modelId: item.modelId,
            providerType: item.providerType,
          }),
        };
      });

      return {
        items,
      };
    }),
});
