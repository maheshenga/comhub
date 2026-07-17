import { randomUUID } from 'node:crypto';

import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';
import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { normalizeAboutLinksConfig, normalizeAboutPageConfig } from '@/const/aboutLinks';
import { normalizeAvatarPresets } from '@/const/avatarPresets';
import { normalizePlanFaqSettings } from '@/const/billingPresentation';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { DEFAULT_COMHUB_AGENT_AVATAR, DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import {
  DEFAULT_EXPERT_PLAZA_CONFIG,
  normalizeExpertPlazaCards,
  normalizeExpertPlazaConfig,
} from '@/const/expertPlaza';
import { normalizeHelpMenuItems } from '@/const/helpMenu';
import { normalizeNotificationEventDefaults } from '@/const/notificationPreferences';
import {
  adminAuditLogs,
  appSettings,
  notifications,
  planCatalog,
  topUpOrders,
  users,
  userSettings,
} from '@/database/schemas';
import { type LobeChatDatabase, type Transaction } from '@/database/type';
import {
  ADMIN_CAPABILITIES,
  adminCapabilityProcedure,
  publicProcedure,
  router,
} from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { getResolvedServerDefaultAgentConfig } from '@/server/globalConfig';
import { invalidateFileS3RuntimeCache, S3 } from '@/server/modules/S3';
import {
  APP_SETTING_KEYS,
  getServerDefaultModelSuggestions,
  getServerFileS3Config,
  getServerModelPolicyConfig,
  invalidateServerAppSettings,
  normalizeS3FilePath,
  serializeModelIdList,
} from '@/server/services/appSettings';
import {
  buildAppSettingsGovernance,
  isUnknownAppSettingKey,
} from '@/server/services/appSettings/governance';
import {
  decryptAppSettingSecret,
  encryptAppSettingSecret,
  getAppSettingSecretWritePolicy,
  isAppSettingSecretKey,
  maskAppSettingSecret,
} from '@/server/services/appSettings/secrets';
import { invalidateServerBrand } from '@/server/services/brand';
import { ModuleAppPackageLifecycleService } from '@/server/services/moduleAppPackage/lifecycle';
import {
  getAllEnabledModels,
  invalidateNewapiInstancesCache,
} from '@/server/services/newapiInstance';

import {
  APP_SETTING_WRITE_SURFACES,
  GENERIC_WRITABLE_APP_SETTING_KEYS,
  getAppSettingCatalogItem,
  isSensitiveCatalogAppSettingKey,
  normalizeAppSettingValue,
} from '../../appSettings/catalog';
import { isModelAllowedByPlanRules } from '../../planModelRules';
import { syncExpiredSubscriptionsToFree } from '../../subscriptionMaintenance';
import { createAdminCommand } from './adminCommand';
import { recordAdminAudit } from './audit';

const publicDbProcedure = publicProcedure.use(serverDatabase);
const systemReadProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemRead);
const systemWriteProcedure = adminCapabilityProcedure(ADMIN_CAPABILITIES.systemWrite);
const runMaintenanceCommand = createAdminCommand('setting.runMaintenance');
const setAppSettingCommand = createAdminCommand('setting.setAppSetting');

const SETTING_KEYS = APP_SETTING_KEYS;
const S3_HEALTH_CHECK_CONTENT = 'comhub-s3-health-check';
const S3_HEALTH_CHECK_DIR = 'admin-s3-health-check';

const getAppUrlFallback = () => {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;

  return process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT || 3010}`
    : `http://localhost:${process.env.PORT || 3210}`;
};

const getAppOriginForCorsTest = () => {
  try {
    return new URL(getAppUrlFallback()).origin;
  } catch {
    throw new Error('APP_URL must be a valid URL before testing S3 CORS');
  }
};

const createS3HealthCheckKey = (filePath: string | undefined) => {
  const prefix = normalizeS3FilePath(filePath || 'files') || 'files';

  return `${prefix}/${S3_HEALTH_CHECK_DIR}/${Date.now()}-${randomUUID()}.txt`;
};

const readResponseSnippet = async (response: Response) => {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
};

const assertHttpOk = async (response: Response, code: string) => {
  if (response.ok) return;

  const body = await readResponseSnippet(response);
  throw new Error(`${code}: ${response.status}${body ? ` ${body}` : ''}`);
};

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

const readSetting = async (db: any, key: string): Promise<unknown> => {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value ?? null;
};

const toStringList = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(/[\r\n,;，；]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\r\n,;，；]+/)
      : [];

  return Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
};

const toBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const toBoundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  return Math.max(min, Math.min(max, Math.round(n)));
};

const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const normalizeMemoryUserMemoryTriggerMode = (value: unknown) =>
  value === 'direct' || value === 'workflow' || value === 'auto' ? value : 'auto';

const normalizeOptionalMemoryUserMemoryTriggerMode = (value: unknown) =>
  value === 'direct' || value === 'workflow' || value === 'auto' ? value : null;

const normalizeProfileInterestAreas = (value: unknown) => {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: Array<{ key: string; label: string }> = [];

  for (const item of items) {
    const label =
      typeof item === 'string'
        ? item.trim()
        : item && typeof item === 'object'
          ? toString((item as Record<string, unknown>).label)
          : '';
    const key =
      item && typeof item === 'object'
        ? toString((item as Record<string, unknown>).key) || label
        : label;

    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ key, label });
  }

  return normalized;
};

type AppSettingDraft = Record<string, unknown>;
type DefaultModelType = 'chat' | 'embedding' | 'image' | 'video';
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

const settingDraftString = (settings: AppSettingDraft, key: string) =>
  typeof settings[key] === 'string' ? (settings[key] as string).trim() : '';

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

const invalidateAppSettingsCaches = (updates: NormalizedSettingUpdate[]) => {
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

  invalidateServerAppSettings();
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

export const validateDefaultAgentModelUsability = async (
  db: LobeChatDatabase,
  settings: AppSettingDraft,
  options: {
    missingMessage?: string;
    modelKey?: string;
    modelType?: DefaultModelType;
    providerKey?: string;
    typeMismatchMessage?: string;
  } = {},
): Promise<void> => {
  const modelKey = options.modelKey ?? SETTING_KEYS.defaultAgentModel;
  const providerKey = options.providerKey ?? SETTING_KEYS.defaultAgentProvider;
  const modelType = options.modelType ?? 'chat';
  const missingMessage = options.missingMessage ?? 'DEFAULT_MODEL_NOT_ENABLED';
  const typeMismatchMessage = options.typeMismatchMessage ?? 'DEFAULT_MODEL_TYPE_MISMATCH';
  const provider = settingDraftString(settings, providerKey);
  const model = settingDraftString(settings, modelKey);

  if (!provider || !model) return;

  const enabledModels = await getAllEnabledModels(db);
  const providerMatchedRoutes = enabledModels.filter(
    (item) =>
      item.providerId === provider ||
      item.instanceId === provider ||
      item.providerType === provider ||
      (provider === 'newapi' && !item.providerId),
  );

  if (providerMatchedRoutes.length > 0 || provider === 'newapi') {
    const matchedRoutes = providerMatchedRoutes.filter((item) => item.id === model);

    if (matchedRoutes.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: missingMessage,
      });
    }

    const typeMatchedRoutes = matchedRoutes.filter((item) => item.type === modelType);

    if (typeMatchedRoutes.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: typeMismatchMessage,
      });
    }

    const freePlan = await db.query.planCatalog.findFirst({
      where: eq(planCatalog.plan, Plans.Free),
    });
    const modelRules = freePlan?.modelRules;

    if (!modelRules) return;

    const isAllowedByAnyEnabledRoute = typeMatchedRoutes.some((item) =>
      isModelAllowedByPlanRules(modelRules, model, modelType, item.groupKey),
    );

    if (!isAllowedByAnyEnabledRoute) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN',
      });
    }

    return;
  }

  const freePlan = await db.query.planCatalog.findFirst({
    where: eq(planCatalog.plan, Plans.Free),
  });
  const modelRules = freePlan?.modelRules;

  if (!modelRules) return;

  if (!isModelAllowedByPlanRules(modelRules, model, modelType)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN',
    });
  }
};

const readPublicRecommendations = async (db: any) => {
  const [
    enabled,
    assistantsEnabled,
    mcpsEnabled,
    skillsEnabled,
    generalSkillsEnabled,
    hotSkillsEnabled,
    selectedTags,
    assistantTags,
    assistantTitle,
    skillCategories,
    skillTitle,
    mcpCategories,
    mcpTitle,
    generalSkillCategories,
    generalSkillTitle,
    hotSkillSort,
    hotSkillTitle,
  ] = await Promise.all([
    readSetting(db, SETTING_KEYS.recommendationSectionEnabled),
    readSetting(db, SETTING_KEYS.recommendationAssistantsEnabled),
    readSetting(db, SETTING_KEYS.recommendationMcpsEnabled),
    readSetting(db, SETTING_KEYS.recommendationSkillsEnabled),
    readSetting(db, SETTING_KEYS.recommendationGeneralSkillsEnabled),
    readSetting(db, SETTING_KEYS.recommendationHotSkillsEnabled),
    readSetting(db, SETTING_KEYS.recommendationSelectedTags),
    readSetting(db, SETTING_KEYS.recommendationAssistantTags),
    readSetting(db, SETTING_KEYS.recommendationAssistantTitle),
    readSetting(db, SETTING_KEYS.recommendationSkillCategories),
    readSetting(db, SETTING_KEYS.recommendationSkillTitle),
    readSetting(db, SETTING_KEYS.recommendationMcpCategories),
    readSetting(db, SETTING_KEYS.recommendationMcpTitle),
    readSetting(db, SETTING_KEYS.recommendationGeneralSkillCategories),
    readSetting(db, SETTING_KEYS.recommendationGeneralSkillTitle),
    readSetting(db, SETTING_KEYS.recommendationHotSkillSort),
    readSetting(db, SETTING_KEYS.recommendationHotSkillTitle),
  ]);

  return {
    assistantTags: toStringList(assistantTags),
    assistantTitle: toString(assistantTitle, '为你推荐的助理'),
    assistantsEnabled: toBoolean(assistantsEnabled, true),
    enabled: toBoolean(enabled, false),
    generalSkillCategories: toStringList(generalSkillCategories),
    generalSkillTitle: toString(generalSkillTitle, '通用推荐技能'),
    generalSkillsEnabled: toBoolean(generalSkillsEnabled, true),
    hotSkillsEnabled: toBoolean(hotSkillsEnabled, true),
    hotSkillSort:
      typeof hotSkillSort === 'string' && hotSkillSort.length > 0 ? hotSkillSort : 'installCount',
    hotSkillTitle: toString(hotSkillTitle, '热门技能'),
    mcpCategories: toStringList(mcpCategories),
    mcpTitle: toString(mcpTitle, '推荐 MCP / 工具'),
    mcpsEnabled: toBoolean(mcpsEnabled, true),
    selectedTags: toStringList(selectedTags),
    skillCategories: toStringList(skillCategories),
    skillTitle: toString(skillTitle, '推荐技能'),
    skillsEnabled: toBoolean(skillsEnabled, true),
  };
};

const readPublicOperations = async (db: any) => {
  const [
    creatorRewardBannerEnabled,
    featuredAssistantsEnabled,
    featuredMcpsEnabled,
    featuredSkillsEnabled,
    featuredAssistantPageSize,
    featuredMcpPageSize,
    featuredSkillPageSize,
    featuredAssistantTitle,
    featuredMcpTitle,
    featuredSkillTitle,
    featuredSkillCategory,
    featuredSkillSort,
    announcementEnabled,
    announcementTitle,
    announcementContent,
    announcementType,
  ] = await Promise.all([
    readSetting(db, SETTING_KEYS.communityCreatorRewardBannerEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedAssistantsEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedMcpsEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillsEnabled),
    readSetting(db, SETTING_KEYS.communityFeaturedAssistantPageSize),
    readSetting(db, SETTING_KEYS.communityFeaturedMcpPageSize),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillPageSize),
    readSetting(db, SETTING_KEYS.communityFeaturedAssistantTitle),
    readSetting(db, SETTING_KEYS.communityFeaturedMcpTitle),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillTitle),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillCategory),
    readSetting(db, SETTING_KEYS.communityFeaturedSkillSort),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementEnabled),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementTitle),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementContent),
    readSetting(db, SETTING_KEYS.communityHomeAnnouncementType),
  ]);

  return {
    announcement: {
      content: toString(announcementContent),
      enabled: toBoolean(announcementEnabled, false),
      title: toString(announcementTitle),
      type: ['success', 'info', 'warning', 'error'].includes(toString(announcementType))
        ? toString(announcementType)
        : 'info',
    },
    creatorRewardBannerEnabled: toBoolean(creatorRewardBannerEnabled, true),
    featuredAssistants: {
      enabled: toBoolean(featuredAssistantsEnabled, true),
      pageSize: toBoundedInt(featuredAssistantPageSize, 12, 1, 24),
      title: toString(featuredAssistantTitle),
    },
    featuredMcps: {
      enabled: toBoolean(featuredMcpsEnabled, true),
      pageSize: toBoundedInt(featuredMcpPageSize, 12, 1, 24),
      title: toString(featuredMcpTitle),
    },
    featuredSkills: {
      category: toString(featuredSkillCategory),
      enabled: toBoolean(featuredSkillsEnabled, false),
      pageSize: toBoundedInt(featuredSkillPageSize, 8, 1, 24),
      sort: toString(featuredSkillSort, 'installCount') || 'installCount',
      title: toString(featuredSkillTitle),
    },
  };
};

const readPublicGrowth = async (db: any) => {
  const [
    signupEnabled,
    signupDisabledMessage,
    signupPhoneEnabled,
    initialCreditsEnabled,
    initialCredits,
    uploadMaxInputSizeMb,
    uploadMaxActualSizeMb,
  ] = await Promise.all([
    readSetting(db, SETTING_KEYS.authSignupEnabled),
    readSetting(db, SETTING_KEYS.authSignupDisabledMessage),
    readSetting(db, SETTING_KEYS.authSignupPhoneEnabled),
    readSetting(db, SETTING_KEYS.onboardingInitialCreditsEnabled),
    readSetting(db, SETTING_KEYS.onboardingInitialCredits),
    readSetting(db, SETTING_KEYS.uploadMaxInputSizeMb),
    readSetting(db, SETTING_KEYS.uploadMaxActualSizeMb),
  ]);

  return {
    initialCredits: {
      amount: toBoundedInt(initialCredits, 0, 0, 10_000_000_000),
      enabled: toBoolean(initialCreditsEnabled, false),
    },
    signup: {
      disabledMessage: toString(signupDisabledMessage) || 'Registration is temporarily closed.',
      enabled: toBoolean(signupEnabled, true),
      phoneEnabled: toBoolean(signupPhoneEnabled, false),
    },
    upload: {
      maxActualSizeMb: toBoundedInt(uploadMaxActualSizeMb, 0, 0, 10_240),
      maxInputSizeMb: toBoundedInt(uploadMaxInputSizeMb, 0, 0, 10_240),
    },
  };
};

const readPublicExpertPlaza = async (db: any) => {
  const [enabled, name, description, categories, cards] = await Promise.all([
    readSetting(db, SETTING_KEYS.expertPlazaEnabled),
    readSetting(db, SETTING_KEYS.expertPlazaName),
    readSetting(db, SETTING_KEYS.expertPlazaDescription),
    readSetting(db, SETTING_KEYS.expertPlazaCategories),
    readSetting(db, SETTING_KEYS.expertPlazaCards),
  ]);

  return normalizeExpertPlazaConfig({
    cards: normalizeExpertPlazaCards(cards),
    categories: toStringList(categories),
    description: toString(description, DEFAULT_EXPERT_PLAZA_CONFIG.description),
    enabled: toBoolean(enabled, DEFAULT_EXPERT_PLAZA_CONFIG.enabled),
    name: toString(name, DEFAULT_EXPERT_PLAZA_CONFIG.name),
  });
};

export const adminSettingsRouter = router({
  /**
   * Public read of brand-related settings, used by the SPA shell to render the
   * configured brand name / logo / theme color before user is authenticated.
   * Only non-sensitive keys are exposed.
   */
  getPublicBrand: publicDbProcedure.query(async ({ ctx }) => {
    const [
      name,
      logo,
      favicon,
      primary,
      slogan,
      loadingText,
      loadingSvgUrl,
      authTitle,
      copyrightText,
      defaultSkillName,
      homeMessengerEnabled,
      homeMessengerBannerTitle,
      communityForkAndChatLabel,
      sidebarMemberLabel,
      sidebarMemberUrl,
      sidebarGenerationLabel,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.brandName),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandFaviconUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandPrimaryColor),
      readSetting(ctx.serverDB, SETTING_KEYS.brandSlogan),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLoadingText),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLoadingSvgUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandAuthTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.brandCopyrightText),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultSkillName),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerBannerTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.communityForkAndChatLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarGenerationLabel),
    ]);
    const brandName = typeof name === 'string' ? name : DEFAULT_RUNTIME_BRAND.name;
    return {
      authTitle:
        typeof authTitle === 'string' && authTitle.trim()
          ? authTitle
          : DEFAULT_RUNTIME_BRAND.authTitle,
      copyrightText:
        typeof copyrightText === 'string' && copyrightText.trim()
          ? copyrightText
          : DEFAULT_RUNTIME_BRAND.copyrightText,
      defaultSkillName:
        typeof defaultSkillName === 'string' && defaultSkillName.trim()
          ? defaultSkillName
          : brandName,
      faviconUrl: typeof favicon === 'string' ? favicon : null,
      homeMessengerEnabled: toBoolean(homeMessengerEnabled, true),
      homeMessengerBannerTitle:
        typeof homeMessengerBannerTitle === 'string' && homeMessengerBannerTitle.trim()
          ? homeMessengerBannerTitle
          : null,
      loadingText:
        typeof loadingText === 'string' && loadingText.trim()
          ? loadingText
          : DEFAULT_RUNTIME_BRAND.loadingText,
      loadingSvgUrl:
        typeof loadingSvgUrl === 'string' && loadingSvgUrl.trim() ? loadingSvgUrl.trim() : null,
      logoUrl: typeof logo === 'string' ? logo : DEFAULT_RUNTIME_BRAND.logoUrl,
      name: brandName,
      primaryColor: typeof primary === 'string' ? primary : DEFAULT_RUNTIME_BRAND.primaryColor,
      communityForkAndChatLabel:
        typeof communityForkAndChatLabel === 'string' && communityForkAndChatLabel.trim()
          ? communityForkAndChatLabel
          : null,
      sidebarGenerationLabel:
        typeof sidebarGenerationLabel === 'string' && sidebarGenerationLabel.trim()
          ? sidebarGenerationLabel
          : '生成',
      sidebarMemberLabel:
        typeof sidebarMemberLabel === 'string' && sidebarMemberLabel.trim()
          ? sidebarMemberLabel
          : '会员',
      sidebarMemberUrl:
        typeof sidebarMemberUrl === 'string' && sidebarMemberUrl.trim()
          ? sidebarMemberUrl
          : '/settings/plans',
      slogan:
        typeof slogan === 'string' && slogan.trim() ? slogan : DEFAULT_RUNTIME_BRAND.authTitle,
    };
  }),

  getPublicRecommendations: publicDbProcedure.query(async ({ ctx }) =>
    readPublicRecommendations(ctx.serverDB),
  ),

  getPublicOperations: publicDbProcedure.query(async ({ ctx }) =>
    readPublicOperations(ctx.serverDB),
  ),

  getPublicGrowth: publicDbProcedure.query(async ({ ctx }) => readPublicGrowth(ctx.serverDB)),

  getPublicExpertPlaza: publicDbProcedure.query(async ({ ctx }) =>
    readPublicExpertPlaza(ctx.serverDB),
  ),

  getPublicProfileOptions: publicDbProcedure.query(async ({ ctx }) => {
    const [interestAreas, avatarPresets] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.profileInterestAreas),
      readSetting(ctx.serverDB, SETTING_KEYS.profileAvatarPresets),
    ]);

    return {
      avatarPresets: normalizeAvatarPresets(avatarPresets),
      interestAreas: normalizeProfileInterestAreas(interestAreas),
    };
  }),

  getPublicNotificationConfig: publicDbProcedure.query(async ({ ctx }) => {
    const [
      inboxEnabled,
      desktopEnabled,
      emailEnabled,
      pushEnabled,
      eventDefaults,
      systemEnabled,
      systemTitle,
      systemContent,
      systemActionLabel,
      systemActionUrl,
      systemType,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.notificationInboxEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationDesktopEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationEmailEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationPushEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationEventDefaults),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemContent),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemActionLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemActionUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemType),
    ]);

    return {
      desktopEnabled: toBoolean(desktopEnabled, true),
      emailEnabled: toBoolean(emailEnabled, false),
      eventDefaults: normalizeNotificationEventDefaults(eventDefaults),
      inboxEnabled: toBoolean(inboxEnabled, true),
      pushEnabled: toBoolean(pushEnabled, toBoolean(desktopEnabled, true)),
      system: {
        actionLabel: toString(systemActionLabel),
        actionUrl: toString(systemActionUrl) || null,
        content: toString(systemContent),
        enabled: toBoolean(systemEnabled, false),
        title: toString(systemTitle),
        type: ['success', 'info', 'warning', 'error'].includes(toString(systemType))
          ? toString(systemType)
          : 'warning',
      },
    };
  }),

  getPublicHelpMenu: publicDbProcedure.query(async ({ ctx }) => {
    const row = await ctx.serverDB.query.appSettings.findFirst({
      where: eq(appSettings.key, SETTING_KEYS.helpMenuItems),
    });
    return row ? normalizeHelpMenuItems(row.value) : null;
  }),

  getPublicAboutLinks: publicDbProcedure.query(async ({ ctx }) => {
    const [links, logoUrl, brandLogoUrl] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.aboutLinks),
      readSetting(ctx.serverDB, SETTING_KEYS.aboutLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
    ]);

    return {
      links: normalizeAboutLinksConfig(links),
      logoUrl: toString(logoUrl) || toString(brandLogoUrl) || DEFAULT_RUNTIME_BRAND.logoUrl,
    };
  }),

  getPublicAboutPage: publicDbProcedure.query(async ({ ctx }) => {
    const raw = await readSetting(ctx.serverDB, SETTING_KEYS.aboutPage);
    return normalizeAboutPageConfig(raw);
  }),

  getPublicDesktopUpdate: publicDbProcedure.query(async ({ ctx }) => {
    const [
      serverUrl,
      channel,
      autoCheck,
      checkInterval,
      downloadUrl,
      downloadLabel,
      currentVersion,
      releaseNotes,
      loginWindowTitle,
      loginLogoUrl,
      loginTitle,
      loginDescription,
      loginCloudButtonLabel,
      loginFooterText,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateServerUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateChannel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateAutoCheck),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCheckInterval),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCurrentVersion),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateReleaseNotes),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginWindowTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginDescription),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginCloudButtonLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginFooterText),
    ]);
    return {
      autoCheck: toBoolean(autoCheck, true),
      channel: toString(channel, 'stable') || 'stable',
      checkIntervalMinutes: toNumber(checkInterval, 60),
      currentVersion: toString(currentVersion) || null,
      downloadLabel: toString(downloadLabel) || null,
      downloadUrl: toString(downloadUrl) || null,
      loginConfig: {
        cloudButtonLabel: toString(loginCloudButtonLabel) || null,
        description: toString(loginDescription) || null,
        footerText: toString(loginFooterText) || null,
        logoUrl: toString(loginLogoUrl) || null,
        title: toString(loginTitle) || null,
        windowTitle: toString(loginWindowTitle) || null,
      },
      releaseNotes: toString(releaseNotes) || null,
      serverUrl: toString(serverUrl),
    };
  }),

  getGovernance: systemReadProcedure.query(async ({ ctx }) => {
    const rows = await ctx.serverDB.query.appSettings.findMany({
      columns: {
        key: true,
        updatedAt: true,
        value: true,
      },
    });

    return buildAppSettingsGovernance(rows);
  }),

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

      const deleted = await ctx.serverDB
        .delete(appSettings)
        .where(eq(appSettings.key, input.key))
        .returning({ key: appSettings.key });

      await recordAdminAudit(ctx, {
        action: 'settings.deleteUnknown',
        payload: { key: input.key },
        resourceId: input.key,
        resourceType: 'app_setting',
      });

      return { deleted: deleted.length > 0, key: input.key };
    }),

  getAll: systemReadProcedure.query(async ({ ctx }) => {
    const [
      referralReward,
      cronSecret,
      auditDays,
      pendingDays,
      aboutLogo,
      brandName,
      brandLogo,
      brandFavicon,
      brandPrimary,
      brandSlogan,
      brandLoadingText,
      brandLoadingSvgUrl,
      brandAuthTitle,
      brandCopyrightText,
      homeMessengerEnabled,
      homeMessengerBannerTitle,
      communityForkAndChatLabel,
      communitySkillUseButtonLabel,
      defaultAgentModel,
      defaultAgentName,
      defaultAgentAvatar,
      defaultAgentProvider,
      defaultImageModel,
      defaultImageProvider,
      defaultSkillName,
      defaultVideoModel,
      defaultVideoProvider,
      recommendationConfig,
      plansFaqItems,
      pricingCreditMultiplier,
      pricingModelRules,
      operationsConfig,
      growthConfig,
      modelPolicyConfig,
      desktopUpdateServerUrl,
      desktopUpdateChannel,
      desktopUpdateAutoCheck,
      desktopUpdateCheckInterval,
      desktopUpdateCurrentVersion,
      desktopUpdateReleaseNotes,
      desktopOssBucket,
      desktopOssEndpoint,
      desktopOssAccessKeyId,
      desktopOssAccessKeySecret,
      desktopOssPath,
      desktopDownloadUrl,
      desktopDownloadLabel,
      desktopLoginWindowTitle,
      desktopLoginLogoUrl,
      desktopLoginTitle,
      desktopLoginDescription,
      desktopLoginCloudButtonLabel,
      desktopLoginFooterText,
      helpMenuItems,
      aboutLinks,
      composioEnabled,
      composioApiKey,
      composioAuthConfigIds,
      profileInterestAreas,
      aboutPage,
      avatarPresets,
      memoryUserMemoryTriggerMode,
      memoryUserMemoryGatekeeperProvider,
      memoryUserMemoryGatekeeperModel,
      memoryUserMemoryLayerExtractorProvider,
      memoryUserMemoryLayerExtractorModel,
      memoryUserMemoryPersonaWriterProvider,
      memoryUserMemoryPersonaWriterModel,
      memoryUserMemoryEmbeddingProvider,
      memoryUserMemoryEmbeddingModel,
      vectorEmbeddingProvider,
      vectorEmbeddingModel,
      vectorRerankerProvider,
      vectorRerankerModel,
      vectorQueryMode,
      userGlobalSettingsDefaults,
      expertPlazaConfig,
      notificationInboxEnabled,
      notificationDesktopEnabled,
      notificationEmailEnabled,
      notificationPushEnabled,
      notificationEventDefaults,
      notificationRetentionDays,
      notificationSystemEnabled,
      notificationSystemTitle,
      notificationSystemContent,
      notificationSystemActionLabel,
      notificationSystemActionUrl,
      notificationSystemType,
      storageS3AccessKeyId,
      storageS3SecretAccessKey,
      storageS3Endpoint,
      storageS3Bucket,
      storageS3Region,
      storageS3PublicDomain,
      storageS3FilePath,
      storageS3EnablePathStyle,
      storageS3SetAcl,
      storageS3PreviewUrlExpireIn,
      sidebarMemberLabel,
      sidebarMemberUrl,
      sidebarGenerationLabel,
    ] = await Promise.all([
      readSetting(ctx.serverDB, SETTING_KEYS.referralRewardCredits),
      readSetting(ctx.serverDB, SETTING_KEYS.cronSecret),
      readSetting(ctx.serverDB, SETTING_KEYS.cronAuditRetentionDays),
      readSetting(ctx.serverDB, SETTING_KEYS.cronPendingOrderExpiryDays),
      readSetting(ctx.serverDB, SETTING_KEYS.aboutLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandName),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandFaviconUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandPrimaryColor),
      readSetting(ctx.serverDB, SETTING_KEYS.brandSlogan),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLoadingText),
      readSetting(ctx.serverDB, SETTING_KEYS.brandLoadingSvgUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.brandAuthTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.brandCopyrightText),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.homeMessengerBannerTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.communityForkAndChatLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.communitySkillUseButtonLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentModel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentName),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentAvatar),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultAgentProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultImageModel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultImageProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultSkillName),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultVideoModel),
      readSetting(ctx.serverDB, SETTING_KEYS.defaultVideoProvider),
      readPublicRecommendations(ctx.serverDB),
      readSetting(ctx.serverDB, SETTING_KEYS.plansFaqItems),
      readSetting(ctx.serverDB, SETTING_KEYS.pricingCreditMultiplier),
      readSetting(ctx.serverDB, SETTING_KEYS.pricingModelRules),
      readPublicOperations(ctx.serverDB),
      readPublicGrowth(ctx.serverDB),
      getServerModelPolicyConfig(ctx.serverDB),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateServerUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateChannel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateAutoCheck),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCheckInterval),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateCurrentVersion),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopUpdateReleaseNotes),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssBucket),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssEndpoint),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssAccessKeyId),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssAccessKeySecret),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopOssPath),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopDownloadLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginWindowTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginLogoUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginDescription),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginCloudButtonLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.desktopLoginFooterText),
      readSetting(ctx.serverDB, SETTING_KEYS.helpMenuItems),
      readSetting(ctx.serverDB, SETTING_KEYS.aboutLinks),
      readSetting(ctx.serverDB, SETTING_KEYS.composioEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.composioApiKey),
      readSetting(ctx.serverDB, SETTING_KEYS.composioAuthConfigIds),
      readSetting(ctx.serverDB, SETTING_KEYS.profileInterestAreas),
      readSetting(ctx.serverDB, SETTING_KEYS.aboutPage),
      readSetting(ctx.serverDB, SETTING_KEYS.profileAvatarPresets),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryTriggerMode),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryGatekeeperProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryGatekeeperModel),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryLayerExtractorProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryLayerExtractorModel),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryPersonaWriterProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryPersonaWriterModel),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryEmbeddingProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.memoryUserMemoryEmbeddingModel),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorEmbeddingProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorEmbeddingModel),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorRerankerProvider),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorRerankerModel),
      readSetting(ctx.serverDB, SETTING_KEYS.vectorQueryMode),
      readSetting(ctx.serverDB, SETTING_KEYS.userGlobalSettingsDefaults),
      readPublicExpertPlaza(ctx.serverDB),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationInboxEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationDesktopEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationEmailEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationPushEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationEventDefaults),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationRetentionDays),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemEnabled),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemTitle),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemContent),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemActionLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemActionUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.notificationSystemType),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3AccessKeyId),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3SecretAccessKey),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3Endpoint),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3Bucket),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3Region),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3PublicDomain),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3FilePath),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3EnablePathStyle),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3SetAcl),
      readSetting(ctx.serverDB, SETTING_KEYS.storageS3PreviewUrlExpireIn),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberLabel),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarMemberUrl),
      readSetting(ctx.serverDB, SETTING_KEYS.sidebarGenerationLabel),
    ]);

    const [decryptedCronSecret, decryptedComposioApiKey, decryptedS3Secret] = await Promise.all([
      decryptAppSettingSecret(SETTING_KEYS.cronSecret, cronSecret),
      decryptAppSettingSecret(SETTING_KEYS.composioApiKey, composioApiKey),
      decryptAppSettingSecret(SETTING_KEYS.storageS3SecretAccessKey, storageS3SecretAccessKey),
    ]);
    const dbCronSecret = typeof decryptedCronSecret === 'string' ? decryptedCronSecret : null;
    const dbComposioApiKey =
      typeof decryptedComposioApiKey === 'string' ? decryptedComposioApiKey : null;
    const dbS3Secret = typeof decryptedS3Secret === 'string' ? decryptedS3Secret : null;

    const resolvedDefaultAgentConfig = await getResolvedServerDefaultAgentConfig(ctx.serverDB);
    const currentDefaultModel = ((typeof defaultAgentModel === 'string' &&
      defaultAgentModel.trim()) ||
      resolvedDefaultAgentConfig.model) as string | undefined;
    const currentDefaultProvider = ((typeof defaultAgentProvider === 'string' &&
      defaultAgentProvider.trim()) ||
      resolvedDefaultAgentConfig.provider) as string | undefined;
    const currentDefaultName = ((typeof defaultAgentName === 'string' && defaultAgentName.trim()) ||
      resolvedDefaultAgentConfig.title) as string | undefined;
    const currentDefaultAvatar = ((typeof defaultAgentAvatar === 'string' &&
      defaultAgentAvatar.trim()) ||
      resolvedDefaultAgentConfig.avatar) as string | undefined;
    const defaultModelSuggestions = await getServerDefaultModelSuggestions({
      currentModel: currentDefaultModel,
    });
    const enabledNewapiModels = await getAllEnabledModels(ctx.serverDB);

    return {
      aboutLogoUrl: toString(aboutLogo),
      brandFaviconUrl: typeof brandFavicon === 'string' ? brandFavicon : '',
      brandAuthTitle:
        typeof brandAuthTitle === 'string' ? brandAuthTitle : DEFAULT_RUNTIME_BRAND.authTitle,
      brandCopyrightText:
        typeof brandCopyrightText === 'string'
          ? brandCopyrightText
          : DEFAULT_RUNTIME_BRAND.copyrightText,
      communityForkAndChatLabel:
        typeof communityForkAndChatLabel === 'string' ? communityForkAndChatLabel : '',
      communitySkillUseButtonLabel:
        typeof communitySkillUseButtonLabel === 'string' ? communitySkillUseButtonLabel : '',
      brandLogoUrl: typeof brandLogo === 'string' ? brandLogo : DEFAULT_RUNTIME_BRAND.logoUrl,
      brandName: typeof brandName === 'string' ? brandName : DEFAULT_RUNTIME_BRAND.name,
      brandPrimaryColor:
        typeof brandPrimary === 'string' ? brandPrimary : DEFAULT_RUNTIME_BRAND.primaryColor,
      brandSlogan:
        typeof brandSlogan === 'string' && brandSlogan.trim()
          ? brandSlogan
          : DEFAULT_RUNTIME_BRAND.authTitle,
      brandLoadingText:
        typeof brandLoadingText === 'string' && brandLoadingText.trim()
          ? brandLoadingText
          : DEFAULT_RUNTIME_BRAND.loadingText,
      brandLoadingSvgUrl:
        typeof brandLoadingSvgUrl === 'string' && brandLoadingSvgUrl.trim()
          ? brandLoadingSvgUrl.trim()
          : '',
      homeMessengerBannerTitle:
        typeof homeMessengerBannerTitle === 'string' ? homeMessengerBannerTitle : '',
      homeMessengerEnabled: toBoolean(homeMessengerEnabled, true),
      sidebarGenerationLabel: toString(sidebarGenerationLabel, '生成') || '生成',
      sidebarMemberLabel: toString(sidebarMemberLabel, '会员') || '会员',
      sidebarMemberUrl: toString(sidebarMemberUrl, '/settings/plans') || '/settings/plans',
      cronAuditRetentionDays: typeof auditDays === 'number' ? auditDays : 365,
      cronPendingOrderExpiryDays: typeof pendingDays === 'number' ? pendingDays : 7,
      cronSecretConfigured: Boolean(dbCronSecret ?? process.env.CRON_SECRET),
      cronSecretMasked: maskAppSettingSecret(dbCronSecret ?? process.env.CRON_SECRET),
      defaultAgentAvatar: currentDefaultAvatar || DEFAULT_COMHUB_AGENT_AVATAR,
      defaultAgentModel: currentDefaultModel || '',
      defaultAgentName: currentDefaultName || DEFAULT_COMHUB_AGENT_NAME,
      defaultAgentProvider: currentDefaultProvider || '',
      defaultImageModel: typeof defaultImageModel === 'string' ? defaultImageModel : '',
      defaultImageProvider: typeof defaultImageProvider === 'string' ? defaultImageProvider : '',
      defaultSkillName:
        typeof defaultSkillName === 'string' && defaultSkillName.trim()
          ? defaultSkillName
          : typeof brandName === 'string' && brandName.trim()
            ? brandName
            : DEFAULT_RUNTIME_BRAND.name,
      defaultVideoModel: typeof defaultVideoModel === 'string' ? defaultVideoModel : '',
      defaultVideoProvider: typeof defaultVideoProvider === 'string' ? defaultVideoProvider : '',
      defaultModelSuggestions,
      enabledNewapiModels: enabledNewapiModels.map((item) => ({
        displayName: item.displayName,
        instanceName: item.instanceName ?? item.groupName ?? null,
        modelId: item.id,
        modelType: item.type,
        provider: item.providerId ?? item.instanceId ?? item.providerType ?? 'newapi',
        providerType: item.providerType ?? null,
      })),
      ordersManagementEnabled: false,
      plansFaqItems: normalizePlanFaqSettings(plansFaqItems),
      paymentGatewayStatus: {
        configured: false,
        message:
          '支付网关尚未接入，用户自助支付会返回 PAYMENT_GATEWAY_NOT_CONFIGURED。当前可使用后台手动结算订单。',
        provider: null,
      },
      pricingCreditMultiplier: toPositiveNumber(
        pricingCreditMultiplier,
        DEFAULT_PRICING_CREDIT_MULTIPLIER,
      ),
      pricingModelRules: Array.isArray(pricingModelRules) ? pricingModelRules : [],
      operationsConfig,
      growthConfig,
      modelPolicyConfig: {
        ...modelPolicyConfig,
        allowlistText: serializeModelIdList(modelPolicyConfig.allowlist) ?? '',
        blocklistText: serializeModelIdList(modelPolicyConfig.blocklist) ?? '',
      },
      recommendationConfig,
      referralRewardCredits: typeof referralReward === 'number' ? referralReward : 0,
      desktopUpdateConfig: {
        autoCheck: toBoolean(desktopUpdateAutoCheck, true),
        channel: toString(desktopUpdateChannel, 'stable') || 'stable',
        checkInterval: toNumber(desktopUpdateCheckInterval, 60),
        currentVersion: toString(desktopUpdateCurrentVersion),
        releaseNotes: toString(desktopUpdateReleaseNotes),
        serverUrl: toString(desktopUpdateServerUrl),
      },
      desktopOssConfig: {
        accessKeyId: toString(desktopOssAccessKeyId),
        accessKeySecretMasked: maskAppSettingSecret(toString(desktopOssAccessKeySecret) || null),
        bucket: toString(desktopOssBucket),
        endpoint: toString(desktopOssEndpoint),
        path: toString(desktopOssPath, 'releases'),
      },
      desktopDownloadLabel: toString(desktopDownloadLabel) || null,
      desktopDownloadUrl: toString(desktopDownloadUrl) || null,
      desktopLoginConfig: {
        cloudButtonLabel: toString(desktopLoginCloudButtonLabel),
        description: toString(desktopLoginDescription),
        footerText: toString(desktopLoginFooterText),
        logoUrl: toString(desktopLoginLogoUrl),
        title: toString(desktopLoginTitle),
        windowTitle: toString(desktopLoginWindowTitle),
      },
      helpMenuItems: normalizeHelpMenuItems(helpMenuItems),
      aboutLinks: normalizeAboutLinksConfig(aboutLinks),
      aboutPage: normalizeAboutPageConfig(aboutPage),
      composioConfig: {
        apiKeyConfigured: Boolean(dbComposioApiKey ?? process.env.COMPOSIO_API_KEY),
        apiKeyMasked: maskAppSettingSecret(dbComposioApiKey ?? process.env.COMPOSIO_API_KEY),
        authConfigIds:
          toString(composioAuthConfigIds) || toString(process.env.COMPOSIO_AUTH_CONFIG_IDS),
        enabled:
          typeof composioEnabled === 'boolean'
            ? composioEnabled
            : Boolean(dbComposioApiKey ?? process.env.COMPOSIO_API_KEY),
      },
      profileInterestAreas: normalizeProfileInterestAreas(profileInterestAreas),
      avatarPresets: normalizeAvatarPresets(avatarPresets),
      memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
        memoryUserMemoryTriggerMode,
      ),
      memoryExtractionConfig: {
        embeddingModel: toString(memoryUserMemoryEmbeddingModel),
        embeddingProvider: toString(memoryUserMemoryEmbeddingProvider),
        gatekeeperModel: toString(memoryUserMemoryGatekeeperModel),
        gatekeeperProvider: toString(memoryUserMemoryGatekeeperProvider),
        layerExtractorModel: toString(memoryUserMemoryLayerExtractorModel),
        layerExtractorProvider: toString(memoryUserMemoryLayerExtractorProvider),
        personaWriterModel: toString(memoryUserMemoryPersonaWriterModel),
        personaWriterProvider: toString(memoryUserMemoryPersonaWriterProvider),
      },
      vectorConfig: {
        dimensions: 1024,
        embeddingModel: toString(vectorEmbeddingModel),
        embeddingProvider: toString(vectorEmbeddingProvider),
        queryMode: toString(vectorQueryMode),
        rerankerModel: toString(vectorRerankerModel),
        rerankerProvider: toString(vectorRerankerProvider),
      },
      userGlobalSettingsDefaults:
        userGlobalSettingsDefaults &&
        typeof userGlobalSettingsDefaults === 'object' &&
        !Array.isArray(userGlobalSettingsDefaults)
          ? userGlobalSettingsDefaults
          : {},
      expertPlazaConfig,
      memoryUserMemoryTriggerModeEnv: normalizeOptionalMemoryUserMemoryTriggerMode(
        process.env.MEMORY_USER_MEMORY_TRIGGER_MODE,
      ),
      qstashTokenConfigured: Boolean(process.env.QSTASH_TOKEN),
      notificationInboxEnabled: toBoolean(notificationInboxEnabled, true),
      notificationDesktopEnabled: toBoolean(notificationDesktopEnabled, true),
      notificationEmailEnabled: toBoolean(notificationEmailEnabled, false),
      notificationPushEnabled: toBoolean(
        notificationPushEnabled,
        toBoolean(notificationDesktopEnabled, true),
      ),
      notificationEventDefaults: normalizeNotificationEventDefaults(notificationEventDefaults),
      notificationRetentionDays: toBoundedInt(notificationRetentionDays, 90, 1, 3650),
      notificationSystemEnabled: toBoolean(notificationSystemEnabled, false),
      notificationSystemTitle: toString(notificationSystemTitle),
      notificationSystemContent: toString(notificationSystemContent),
      notificationSystemActionLabel: toString(notificationSystemActionLabel),
      notificationSystemActionUrl: toString(notificationSystemActionUrl),
      notificationSystemType: ['success', 'info', 'warning', 'error'].includes(
        toString(notificationSystemType),
      )
        ? toString(notificationSystemType)
        : 'warning',
      storageS3AccessKeyId:
        toString(storageS3AccessKeyId) || toString(process.env.S3_ACCESS_KEY_ID),
      storageS3Bucket: toString(storageS3Bucket) || toString(process.env.S3_BUCKET),
      storageS3EnablePathStyle: toBoolean(
        storageS3EnablePathStyle,
        process.env.S3_ENABLE_PATH_STYLE === '1',
      ),
      storageS3Endpoint: toString(storageS3Endpoint) || toString(process.env.S3_ENDPOINT),
      storageS3PreviewUrlExpireIn: toBoundedInt(
        storageS3PreviewUrlExpireIn,
        Number.parseInt(process.env.S3_PREVIEW_URL_EXPIRE_IN || '7200') || 7200,
        60,
        604_800,
      ),
      storageS3PublicDomain:
        toString(storageS3PublicDomain) ||
        toString(process.env.S3_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_S3_DOMAIN),
      storageS3FilePath:
        normalizeS3FilePath(storageS3FilePath) ||
        normalizeS3FilePath(process.env.NEXT_PUBLIC_S3_FILE_PATH) ||
        'files',
      storageS3Region: toString(storageS3Region) || toString(process.env.S3_REGION),
      storageS3SecretAccessKeyConfigured: Boolean(dbS3Secret ?? process.env.S3_SECRET_ACCESS_KEY),
      storageS3SecretAccessKeyMasked: maskAppSettingSecret(
        dbS3Secret ?? process.env.S3_SECRET_ACCESS_KEY,
      ),
      storageS3SetAcl: toBoolean(storageS3SetAcl, process.env.S3_SET_ACL === '1'),
    };
  }),

  validateDefaultAgentSettings: systemReadProcedure
    .input(
      z.object({
        model: z.string().optional(),
        modelType: z.enum(['chat', 'image', 'video']).optional(),
        provider: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const modelType = input.modelType ?? 'chat';
      const keys =
        modelType === 'image'
          ? {
              modelKey: SETTING_KEYS.defaultImageModel,
              providerKey: SETTING_KEYS.defaultImageProvider,
            }
          : modelType === 'video'
            ? {
                modelKey: SETTING_KEYS.defaultVideoModel,
                providerKey: SETTING_KEYS.defaultVideoProvider,
              }
            : {
                modelKey: SETTING_KEYS.defaultAgentModel,
                providerKey: SETTING_KEYS.defaultAgentProvider,
              };

      await validateDefaultAgentModelUsability(
        ctx.serverDB,
        {
          [keys.modelKey]: toString(input.model),
          [keys.providerKey]: toString(input.provider),
        },
        { ...keys, modelType },
      );

      return { ok: true };
    }),

  setAppSetting: systemWriteProcedure
    .input(appSettingUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const update = await normalizeAppSettingUpdate(ctx.serverDB, input);
      if (!update.shouldWrite) return { ok: true };

      await validateDefaultModelUpdates(ctx.serverDB, [update]);
      await upsertAppSetting(ctx.serverDB, update);

      await recordAdminAudit(ctx, {
        action: setAppSettingCommand.definition.auditAction,
        payload: buildSingleSettingAuditPayload(update),
        resourceId: input.key,
        resourceType: 'app_setting',
      });

      invalidateAppSettingsCaches([update]);

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

      await ctx.serverDB.transaction(async (tx: Transaction) => {
        for (const update of updates) {
          await upsertAppSetting(tx, update);
        }
      });

      await recordAdminAudit(ctx, {
        action: 'settings.batchSet',
        payload: {
          count: updates.length,
          settings: updates.map(buildSettingAuditPayload),
        },
        resourceType: 'app_setting',
      });

      invalidateAppSettingsCaches(updates);

      return { count: input.updates.length, ok: true };
    }),

  syncUserGlobalSettingsDefaultsToUsers: systemWriteProcedure
    .input(syncUserGlobalSettingsDefaultsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const options = { forceDefaultAgentMeta: input?.forceDefaultAgentMeta === true };
      const defaults = await readSetting(ctx.serverDB, SETTING_KEYS.userGlobalSettingsDefaults);
      await validateUserGlobalSettingsDefaults(ctx.serverDB, defaults);
      const result = await syncUserGlobalSettingsDefaultsToUserSettings(
        ctx.serverDB,
        defaults,
        options,
      );
      const forceSyncAuditPayload = options.forceDefaultAgentMeta
        ? { forceDefaultAgentMeta: true }
        : {};
      const scope = {
        forceDefaultAgentMeta: options.forceDefaultAgentMeta,
        target: 'all-users',
      };

      await recordAdminAudit(ctx, {
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
      });

      return { ok: true, ...result, ...forceSyncAuditPayload };
    }),

  refreshRuntimeCaches: systemWriteProcedure.mutation(async ({ ctx }) => {
    invalidateServerAppSettings();
    invalidateNewapiInstancesCache();
    invalidateFileS3RuntimeCache();
    invalidateServerBrand();

    const results = [
      { domain: 'app-settings', status: 'refreshed' },
      { domain: 'newapi-instances', status: 'refreshed' },
      { domain: 's3-runtime', status: 'refreshed' },
      { domain: 'brand', status: 'refreshed' },
    ] as const;
    const refreshed = results.map(({ domain }) => domain);
    await recordAdminAudit(ctx, {
      action: 'settings.refreshRuntimeCaches',
      payload: {
        operation: 'refreshRuntimeCaches',
        refreshed,
        requestedDomains: refreshed,
        results,
        status: 'success',
      },
      resourceType: 'app_setting',
    });

    return { ok: true, refreshed };
  }),

  testS3Storage: systemWriteProcedure.mutation(async ({ ctx }) => {
    const config = await getServerFileS3Config(ctx.serverDB);

    if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint || !config.bucket) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'S3_CONFIG_INCOMPLETE',
      });
    }

    try {
      const s3 = new S3(config.accessKeyId, config.secretAccessKey, config.endpoint, {
        bucket: config.bucket,
        forcePathStyle: config.enablePathStyle,
        previewUrlExpireIn: config.previewUrlExpireIn,
        region: config.region,
        setAcl: config.setAcl,
      });

      if (typeof fetch !== 'function') {
        throw new Error('FETCH_NOT_AVAILABLE');
      }

      const origin = getAppOriginForCorsTest();
      const healthCheckKey = createS3HealthCheckKey(config.filePath);
      let deleted = false;

      try {
        await s3.testConnection();

        const preSignedUrl = await s3.createPreSignedUrl(healthCheckKey);
        const corsPreflight = await fetch(preSignedUrl, {
          headers: {
            'Access-Control-Request-Headers': 'content-type',
            'Access-Control-Request-Method': 'PUT',
            'Origin': origin,
          },
          method: 'OPTIONS',
        });
        await assertHttpOk(corsPreflight, 'S3_CORS_PREFLIGHT_FAILED');

        const presignedUpload = await fetch(preSignedUrl, {
          body: S3_HEALTH_CHECK_CONTENT,
          headers: {
            'Content-Type': 'text/plain',
            'Origin': origin,
          },
          method: 'PUT',
        });
        await assertHttpOk(presignedUpload, 'S3_PRESIGNED_UPLOAD_FAILED');

        const storedContent = await s3.getFileContent(healthCheckKey);
        if (storedContent !== S3_HEALTH_CHECK_CONTENT) {
          throw new Error('S3_OBJECT_READ_MISMATCH');
        }

        await s3.deleteFile(healthCheckKey);
        deleted = true;

        return {
          bucket: config.bucket,
          checks: {
            bucketAccess: { ok: true },
            corsPreflight: {
              allowHeaders: corsPreflight.headers.get('access-control-allow-headers'),
              allowMethods: corsPreflight.headers.get('access-control-allow-methods'),
              allowOrigin: corsPreflight.headers.get('access-control-allow-origin'),
              ok: true,
              status: corsPreflight.status,
            },
            objectDelete: { ok: true },
            objectRead: {
              bytes: new TextEncoder().encode(storedContent).byteLength,
              ok: true,
            },
            presignedUpload: {
              allowOrigin: presignedUpload.headers.get('access-control-allow-origin'),
              ok: true,
              status: presignedUpload.status,
            },
          },
          endpoint: config.endpoint,
          filePath: config.filePath,
          ok: true,
          origin,
          publicDomain: config.publicDomain || null,
        };
      } finally {
        if (!deleted) {
          try {
            await s3.deleteFile(healthCheckKey);
          } catch (cleanupError) {
            console.error('S3 health check cleanup failed:', cleanupError);
          }
        }
      }
    } catch (error) {
      throw new TRPCError({
        cause: error,
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'S3_CONNECTION_FAILED',
      });
    }
  }),

  /**
   * Manually trigger maintenance job (audit pruning + pending order expiry + notification cleanup).
   * Reuses the same DB-driven defaults as the public cron route.
   */
  runMaintenance: systemWriteProcedure
    .input(
      z.object({
        auditRetentionDays: z.number().int().min(7).max(3650).optional(),
        command: runMaintenanceCommand.schema,
        notificationRetentionDays: z.number().int().min(1).max(3650).optional(),
        pendingOrderExpiryDays: z.number().int().min(1).max(365).optional(),
        skipAudit: z.boolean().optional(),
        skipModuleAppUploads: z.boolean().optional(),
        skipNotifications: z.boolean().optional(),
        skipOrders: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const command = runMaintenanceCommand.validate(input.command);
      const { command: _command, ...opts } = input;
      const result: {
        auditCutoff?: string;
        auditLogsDeleted?: number;
        freeSnapshotsCreated?: number;
        moduleAppUploadCleanupFailed?: number;
        moduleAppUploadsExpired?: number;
        notificationRetentionCutoff?: string;
        notificationsDeleted?: number;
        pendingOrdersCutoff?: string;
        pendingOrdersExpired?: number;
        subscriptionSnapshotsExpired?: number;
      } = {};

      if (!opts.skipAudit) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.cronAuditRetentionDays);
        const days = Math.max(
          7,
          Math.min(3650, opts.auditRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 365)),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const deleted = await ctx.serverDB
          .delete(adminAuditLogs)
          .where(lt(adminAuditLogs.createdAt, cutoff))
          .returning({ id: adminAuditLogs.id });
        result.auditCutoff = cutoff.toISOString();
        result.auditLogsDeleted = deleted.length;
      }

      if (!opts.skipOrders) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.cronPendingOrderExpiryDays);
        const days = Math.max(
          1,
          Math.min(365, opts.pendingOrderExpiryDays ?? (typeof dbVal === 'number' ? dbVal : 7)),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const expired = await ctx.serverDB
          .update(topUpOrders)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(and(eq(topUpOrders.status, 'pending'), lt(topUpOrders.createdAt, cutoff)))
          .returning({ id: topUpOrders.id });
        result.pendingOrdersCutoff = cutoff.toISOString();
        result.pendingOrdersExpired = expired.length;
      }

      if (!opts.skipNotifications) {
        const dbVal = await readSetting(ctx.serverDB, SETTING_KEYS.notificationRetentionDays);
        const days = Math.max(
          1,
          Math.min(
            3650,
            opts.notificationRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 90),
          ),
        );
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const deleted = await ctx.serverDB
          .delete(notifications)
          .where(and(eq(notifications.isArchived, true), lt(notifications.updatedAt, cutoff)))
          .returning({ id: notifications.id });
        result.notificationRetentionCutoff = cutoff.toISOString();
        result.notificationsDeleted = deleted.length;
      }

      if (!opts.skipModuleAppUploads) {
        const cleanup = await new ModuleAppPackageLifecycleService({
          db: ctx.serverDB,
        }).cleanupExpiredUploads({ limit: 100 });
        result.moduleAppUploadCleanupFailed = cleanup.failed;
        result.moduleAppUploadsExpired = cleanup.expired;
      }

      const subscriptionResult = await syncExpiredSubscriptionsToFree(ctx.serverDB);
      result.subscriptionSnapshotsExpired = subscriptionResult.expiredSnapshots;
      result.freeSnapshotsCreated = subscriptionResult.freeSnapshotsCreated;

      await recordAdminAudit(ctx, {
        action: command.auditAction,
        payload: result,
        resourceType: 'maintenance',
      });

      return { ok: true, ...result };
    }),
});
