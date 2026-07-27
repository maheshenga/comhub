import { TRPCError } from '@trpc/server';
import { eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { appSettings, users, userSettings } from '@/database/schemas';
import { type LobeChatDatabase, type Transaction } from '@/database/type';
import { invalidateFileS3RuntimeCache } from '@/server/modules/S3';
import { invalidateServerAppSettings } from '@/server/services/appSettings';
import { isUnknownAppSettingKey } from '@/server/services/appSettings/governance';
import {
  decryptAppSettingSecret,
  encryptAppSettingSecret,
  getAppSettingSecretWritePolicy,
  isAppSettingSecretKey,
  maskAppSettingSecret,
} from '@/server/services/appSettings/secrets';
import { invalidateServerBrand } from '@/server/services/brand';

import { createAdminCommand } from '../../lambda-routers/admin/adminCommand';
import { runRequiredAdminAuditMutation } from '../../lambda-routers/admin/audit';
import {
  APP_SETTING_WRITE_SURFACES,
  GENERIC_WRITABLE_APP_SETTING_KEYS,
  getAppSettingCatalogItem,
  isSensitiveCatalogAppSettingKey,
  normalizeAppSettingValue,
} from '../catalog';
import type { AppSettingDraft, DefaultModelType } from '../procedureShared';
import {
  readSetting,
  SETTING_KEYS,
  systemWriteProcedure,
  toString,
  validateDefaultAgentModelUsability,
} from '../procedureShared';

const setAppSettingCommand = createAdminCommand('setting.setAppSetting');
const USER_SETTINGS_SYNC_BATCH_SIZE = 500;
const USER_SETTINGS_SYNC_KEYS = [
  'defaultAgent',
  'general',
  'hotkey',
  'image',
  'languageModel',
  'market',
  'memory',
  'notification',
  'systemAgent',
  'tool',
  'tts',
] as const;
type ModelValidationTarget = {
  modelKey: string;
  modelType: DefaultModelType;
  providerKey: string;
};
type SettingUpdateInput = { key: string; value?: unknown };
type NormalizedSettingUpdate = SettingUpdateInput & {
  hasValue: boolean;
  isSensitive: boolean;
  shouldWrite: boolean;
};
type UserSettingsSyncValues = Partial<typeof userSettings.$inferInsert>;
type UserSettingsSyncOptions = {
  forceDefaultAgentMeta?: boolean;
};
const appSettingUpdateInputSchema = z.object({
  key: z.enum(GENERIC_WRITABLE_APP_SETTING_KEYS as [string, ...string[]]),
  value: z.unknown(),
});
const syncUserGlobalSettingsDefaultsInputSchema = z
  .object({
    forceDefaultAgentMeta: z.boolean().optional(),
  })
  .optional();
const getRecordValue = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const getNestedRecordValue = (
  source: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined => getRecordValue(source?.[key]);
export const buildUserGlobalSettingsSyncValues = (defaults: unknown): UserSettingsSyncValues => {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return {};

  const source = defaults as Record<string, unknown>;
  const values: UserSettingsSyncValues = {};

  // Do not sync keyVaults: those are per-user encrypted secrets, not platform defaults.
  for (const key of USER_SETTINGS_SYNC_KEYS) {
    if (Object.hasOwn(source, key) && source[key] !== undefined) {
      values[key] = source[key] as never;
    }
  }

  return values;
};
const mergeDefaultAgentSyncValue = (
  existing: unknown,
  incoming: unknown,
  options: UserSettingsSyncOptions = {},
) => {
  const incomingDefaultAgent = getRecordValue(incoming);
  if (!incomingDefaultAgent) return incoming;

  const existingDefaultAgent = getRecordValue(existing) ?? {};
  const incomingConfig = getRecordValue(incomingDefaultAgent.config);
  const incomingMeta = getRecordValue(incomingDefaultAgent.meta);
  const existingMeta = getNestedRecordValue(existingDefaultAgent, 'meta');
  const shouldPreserveExistingMeta =
    incomingMeta &&
    existingMeta &&
    Object.keys(existingMeta).length > 0 &&
    !options.forceDefaultAgentMeta;

  if (!incomingConfig) {
    return {
      ...existingDefaultAgent,
      ...incomingDefaultAgent,
      ...(shouldPreserveExistingMeta ? { meta: existingMeta } : {}),
    };
  }

  const existingConfig = getNestedRecordValue(existingDefaultAgent, 'config') ?? {};

  return {
    ...existingDefaultAgent,
    ...incomingDefaultAgent,
    config: {
      ...existingConfig,
      ...incomingConfig,
    },
    ...(shouldPreserveExistingMeta ? { meta: existingMeta } : {}),
  };
};
const getDefaultModelValidationTarget = (key: string): ModelValidationTarget | undefined => {
  if (key === SETTING_KEYS.defaultImageModel || key === SETTING_KEYS.defaultImageProvider) {
    return {
      modelKey: SETTING_KEYS.defaultImageModel,
      modelType: 'image' as const,
      providerKey: SETTING_KEYS.defaultImageProvider,
    };
  }

  if (key === SETTING_KEYS.defaultVideoModel || key === SETTING_KEYS.defaultVideoProvider) {
    return {
      modelKey: SETTING_KEYS.defaultVideoModel,
      modelType: 'video' as const,
      providerKey: SETTING_KEYS.defaultVideoProvider,
    };
  }

  if (key === SETTING_KEYS.defaultAgentModel || key === SETTING_KEYS.defaultAgentProvider) {
    return {
      modelKey: SETTING_KEYS.defaultAgentModel,
      modelType: 'chat' as const,
      providerKey: SETTING_KEYS.defaultAgentProvider,
    };
  }
};
const getMemoryExtractionModelValidationTarget = (
  key: string,
): ModelValidationTarget | undefined => {
  if (
    key === SETTING_KEYS.memoryUserMemoryGatekeeperModel ||
    key === SETTING_KEYS.memoryUserMemoryGatekeeperProvider
  ) {
    return {
      modelKey: SETTING_KEYS.memoryUserMemoryGatekeeperModel,
      modelType: 'chat' as const,
      providerKey: SETTING_KEYS.memoryUserMemoryGatekeeperProvider,
    };
  }

  if (
    key === SETTING_KEYS.memoryUserMemoryLayerExtractorModel ||
    key === SETTING_KEYS.memoryUserMemoryLayerExtractorProvider
  ) {
    return {
      modelKey: SETTING_KEYS.memoryUserMemoryLayerExtractorModel,
      modelType: 'chat' as const,
      providerKey: SETTING_KEYS.memoryUserMemoryLayerExtractorProvider,
    };
  }

  if (
    key === SETTING_KEYS.memoryUserMemoryPersonaWriterModel ||
    key === SETTING_KEYS.memoryUserMemoryPersonaWriterProvider
  ) {
    return {
      modelKey: SETTING_KEYS.memoryUserMemoryPersonaWriterModel,
      modelType: 'chat' as const,
      providerKey: SETTING_KEYS.memoryUserMemoryPersonaWriterProvider,
    };
  }

  if (
    key === SETTING_KEYS.memoryUserMemoryEmbeddingModel ||
    key === SETTING_KEYS.memoryUserMemoryEmbeddingProvider
  ) {
    return {
      modelKey: SETTING_KEYS.memoryUserMemoryEmbeddingModel,
      modelType: 'embedding' as const,
      providerKey: SETTING_KEYS.memoryUserMemoryEmbeddingProvider,
    };
  }
};
const readInputCompletionDefault = (
  defaults: unknown,
): { enabled: boolean; model: string; provider: string } | undefined => {
  const userDefaults = getRecordValue(defaults);
  const systemAgent = getNestedRecordValue(userDefaults, 'systemAgent');
  const inputCompletion = getNestedRecordValue(systemAgent, 'inputCompletion');
  if (!inputCompletion) return;

  return {
    enabled: inputCompletion.enabled === true,
    model: toString(inputCompletion.model),
    provider: toString(inputCompletion.provider),
  };
};
const normalizeAppSettingUpdate = async (
  db: LobeChatDatabase,
  input: SettingUpdateInput,
): Promise<NormalizedSettingUpdate> => {
  if (isAppSettingSecretKey(input.key) && typeof input.value !== 'string') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `${input.key} must be a string`,
    });
  }

  let value = normalizeAppSettingValue(
    input.key,
    input.value,
    APP_SETTING_WRITE_SURFACES.genericAdmin,
  );
  let shouldWrite = true;

  if (isAppSettingSecretKey(input.key)) {
    if (typeof value !== 'string') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${input.key} must be a string`,
      });
    }
    let secretValue = value;

    if (!secretValue.trim()) {
      shouldWrite = getAppSettingSecretWritePolicy(input.key) === 'blank-clears';
      secretValue = '';
    } else if (secretValue.startsWith('****')) {
      const existingValue = await readSetting(db, input.key);
      const existingPlaintext = await decryptAppSettingSecret(input.key, existingValue);
      shouldWrite =
        typeof existingPlaintext !== 'string' ||
        maskAppSettingSecret(existingPlaintext) !== secretValue;
    }

    value =
      shouldWrite && secretValue
        ? await encryptAppSettingSecret(input.key, secretValue)
        : secretValue;
  }

  return {
    hasValue: shouldWrite && value !== null && value !== undefined && value !== '',
    isSensitive: isSensitiveCatalogAppSettingKey(input.key),
    key: input.key,
    shouldWrite,
    value,
  };
};
const upsertAppSetting = async (
  db: LobeChatDatabase | Transaction,
  update: NormalizedSettingUpdate,
) => {
  await db
    .insert(appSettings)
    .values({ key: update.key, value: update.value as any })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: update.value as any },
      target: appSettings.key,
    });
};
export const syncUserGlobalSettingsDefaultsToUserSettings = async (
  db: LobeChatDatabase,
  defaults: unknown,
  options: UserSettingsSyncOptions = {},
) => {
  const syncValues = buildUserGlobalSettingsSyncValues(defaults);
  const syncedFields = Object.keys(syncValues).filter((key) => key !== 'id');

  if (syncedFields.length === 0) return { syncedFields, syncedUsers: 0 };

  const userRows = await db.select({ id: users.id }).from(users);
  let syncedUsers = 0;

  for (let index = 0; index < userRows.length; index += USER_SETTINGS_SYNC_BATCH_SIZE) {
    const batch = userRows.slice(index, index + USER_SETTINGS_SYNC_BATCH_SIZE);
    if (batch.length === 0) continue;

    const defaultAgentSyncValue = syncValues.defaultAgent;
    const shouldMergeDefaultAgent = defaultAgentSyncValue !== undefined;
    let rows = batch.map((user) => ({ id: user.id, ...syncValues }));
    let conflictSet = syncValues;

    if (shouldMergeDefaultAgent) {
      const existingRows = await db
        .select({ defaultAgent: userSettings.defaultAgent, id: userSettings.id })
        .from(userSettings)
        .where(
          inArray(
            userSettings.id,
            batch.map((user) => user.id),
          ),
        );
      const existingDefaultAgentByUser = new Map(
        existingRows.map((row) => [row.id, row.defaultAgent]),
      );

      rows = batch.map((user) => ({
        id: user.id,
        ...syncValues,
        defaultAgent: mergeDefaultAgentSyncValue(
          existingDefaultAgentByUser.get(user.id),
          defaultAgentSyncValue,
          options,
        ),
      }));
      conflictSet = {
        ...syncValues,
        defaultAgent: sql`excluded.default_agent` as never,
      };
    }

    await db.insert(userSettings).values(rows).onConflictDoUpdate({
      set: conflictSet,
      target: userSettings.id,
    });
    syncedUsers += batch.length;
  }

  return { syncedFields, syncedUsers };
};
const validateDefaultModelUpdates = async (
  db: LobeChatDatabase,
  updates: NormalizedSettingUpdate[],
) => {
  const targets = new Map<string, ModelValidationTarget>();

  for (const update of updates) {
    const target =
      getDefaultModelValidationTarget(update.key) ??
      getMemoryExtractionModelValidationTarget(update.key);
    if (target) targets.set(`${target.providerKey}:${target.modelKey}`, target);
  }

  for (const target of targets.values()) {
    const [currentModel, currentProvider] = await Promise.all([
      readSetting(db, target.modelKey),
      readSetting(db, target.providerKey),
    ]);
    const draft: AppSettingDraft = {
      [target.modelKey]: toString(currentModel),
      [target.providerKey]: toString(currentProvider),
    };

    for (const update of updates) {
      if (update.key === target.modelKey || update.key === target.providerKey) {
        draft[update.key] = update.value;
      }
    }

    await validateDefaultAgentModelUsability(db, draft, target);
  }

  const userGlobalSettingsUpdate = updates.find(
    (update) => update.key === SETTING_KEYS.userGlobalSettingsDefaults,
  );
  if (userGlobalSettingsUpdate) {
    await validateUserGlobalSettingsDefaults(db, userGlobalSettingsUpdate.value);
  }
};
const validateUserGlobalSettingsDefaults = async (db: LobeChatDatabase, defaults: unknown) => {
  const inputCompletion = readInputCompletionDefault(defaults);
  if (!inputCompletion?.enabled) return;

  if (!inputCompletion.provider || !inputCompletion.model) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'INPUT_COMPLETION_MODEL_REQUIRED',
    });
  }

  await validateDefaultAgentModelUsability(
    db,
    {
      inputCompletionModel: inputCompletion.model,
      inputCompletionProvider: inputCompletion.provider,
    },
    {
      missingMessage: 'INPUT_COMPLETION_MODEL_NOT_ENABLED',
      modelKey: 'inputCompletionModel',
      modelType: 'chat',
      providerKey: 'inputCompletionProvider',
      typeMismatchMessage: 'INPUT_COMPLETION_MODEL_TYPE_MISMATCH',
    },
  );
};
const invalidateAppSettingsCaches = async (updates: NormalizedSettingUpdate[]) => {
  if (
    updates.some((update) => getAppSettingCatalogItem(update.key)?.runtimeEffects.includes('brand'))
  ) {
    invalidateServerBrand();
  }
  if (
    updates.some((update) => getAppSettingCatalogItem(update.key)?.runtimeEffects.includes('s3'))
  ) {
    invalidateFileS3RuntimeCache();
  }

  await invalidateServerAppSettings();
};
const buildSettingAuditPayload = (update: NormalizedSettingUpdate) => ({
  hasValue: update.hasValue,
  key: update.key,
  ...(update.isSensitive ? { sensitive: true } : { value: update.value }),
});
const buildSingleSettingAuditPayload = (update: NormalizedSettingUpdate) => ({
  hasValue: update.hasValue,
  key: update.key,
  ...(update.isSensitive ? {} : { value: update.value }),
});

export const adminSettingsWriteProcedures = {
  deleteUnknownSetting: systemWriteProcedure
    .input(
      z.object({
        confirmKey: z.string().min(1),
        key: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmKey !== input.key) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'CONFIRMATION_KEY_MISMATCH',
        });
      }

      if (!isUnknownAppSettingKey(input.key)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'REGISTERED_SETTING_DELETE_BLOCKED',
        });
      }

      const deleted = await runRequiredAdminAuditMutation(ctx, {
        audit: () => ({
          action: 'settings.deleteUnknown',
          payload: { key: input.key },
          resourceId: input.key,
          resourceType: 'app_setting',
        }),
        mutation: async (tx) =>
          tx
            .delete(appSettings)
            .where(eq(appSettings.key, input.key))
            .returning({ key: appSettings.key }),
      });

      return { deleted: deleted.length > 0, key: input.key };
    }),
  setAppSetting: systemWriteProcedure
    .input(appSettingUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const update = await normalizeAppSettingUpdate(ctx.serverDB, input);
      if (!update.shouldWrite) return { ok: true };

      await validateDefaultModelUpdates(ctx.serverDB, [update]);
      await runRequiredAdminAuditMutation(ctx, {
        audit: () => ({
          action: setAppSettingCommand.definition.auditAction,
          payload: buildSingleSettingAuditPayload(update),
          resourceId: input.key,
          resourceType: 'app_setting',
        }),
        mutation: async (tx) => upsertAppSetting(tx, update),
      });

      await invalidateAppSettingsCaches([update]);

      return { ok: true };
    }),
  setAppSettingsBatch: systemWriteProcedure
    .input(
      z.object({
        updates: z.array(appSettingUpdateInputSchema).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedUpdates = await Promise.all(
        input.updates.map((update) => normalizeAppSettingUpdate(ctx.serverDB, update)),
      );
      const updates = normalizedUpdates.filter((update) => update.shouldWrite);
      if (updates.length === 0) return { count: input.updates.length, ok: true };

      await validateDefaultModelUpdates(ctx.serverDB, updates);
      await runRequiredAdminAuditMutation(ctx, {
        audit: () => ({
          action: 'settings.batchSet',
          payload: {
            count: updates.length,
            settings: updates.map(buildSettingAuditPayload),
          },
          resourceType: 'app_setting',
        }),
        mutation: async (tx) => {
          for (const update of updates) {
            await upsertAppSetting(tx, update);
          }
        },
      });

      await invalidateAppSettingsCaches(updates);

      return { count: input.updates.length, ok: true };
    }),
  syncUserGlobalSettingsDefaultsToUsers: systemWriteProcedure
    .input(syncUserGlobalSettingsDefaultsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const options = { forceDefaultAgentMeta: input?.forceDefaultAgentMeta === true };
      const defaults = await readSetting(ctx.serverDB, SETTING_KEYS.userGlobalSettingsDefaults);
      await validateUserGlobalSettingsDefaults(ctx.serverDB, defaults);
      const forceSyncAuditPayload = options.forceDefaultAgentMeta
        ? { forceDefaultAgentMeta: true }
        : {};
      const scope = {
        forceDefaultAgentMeta: options.forceDefaultAgentMeta,
        target: 'all-users',
      };
      const result = await runRequiredAdminAuditMutation<any>(ctx, {
        audit: (result) => ({
          action: 'settings.syncUserDefaults',
          payload: {
            operation: 'syncUserGlobalSettingsDefaultsToUsers',
            scope,
            status: 'success',
            ...result,
            ...forceSyncAuditPayload,
          },
          resourceId: SETTING_KEYS.userGlobalSettingsDefaults,
          resourceType: 'user_settings',
        }),
        mutation: (tx) => syncUserGlobalSettingsDefaultsToUserSettings(tx, defaults, options),
      });

      return { ok: true, ...result, ...forceSyncAuditPayload };
    }),
} as const;
