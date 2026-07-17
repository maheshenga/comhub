import { randomUUID } from 'node:crypto';

import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { normalizeAboutLinksConfig, normalizeAboutPageConfig } from '@/const/aboutLinks';
import { APP_SETTINGS_SECTIONS } from '@/const/appSettingsRegistry';
import { normalizeAvatarPresets } from '@/const/avatarPresets';
import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { normalizeHelpMenuItems } from '@/const/helpMenu';
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
import { getServerDefaultAgentConfig } from '@/server/globalConfig';
import { invalidateFileS3RuntimeCache, S3 } from '@/server/modules/S3';
import {
  APP_SETTING_KEYS,
  getServerFileS3Config,
  invalidateServerAppSettings,
  normalizeS3FilePath,
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
  buildAdminSettingsReadModel,
  buildAdminSettingsSectionReadModel,
  buildDesktopSettings,
  buildExpertPlazaSettings,
  buildGrowthSettings,
  buildNotificationSettings,
  buildOperationsSettings,
  buildRecommendationSettings,
} from '../../appSettings/adminReadModel';
import {
  APP_SETTING_WRITE_SURFACES,
  GENERIC_WRITABLE_APP_SETTING_KEYS,
  getAppSettingCatalogItem,
  isSensitiveCatalogAppSettingKey,
  normalizeAppSettingValue,
} from '../../appSettings/catalog';
import {
  loadAllAppSettingsSnapshot,
  loadAppSettingsSectionSnapshot,
  loadAppSettingsSnapshot,
} from '../../appSettings/loader';
import { isModelAllowedByPlanRules } from '../../planModelRules';
import { syncExpiredSubscriptionsToFree } from '../../subscriptionMaintenance';
import { createAdminCommand } from './adminCommand';
import {
  recordAdminAudit,
  runRequiredAdminAuditExternalEffect,
  runRequiredAdminAuditMutation,
} from './audit';

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

const toBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

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

export const adminSettingsRouter = router({
  /**
   * Public read of brand-related settings, used by the SPA shell to render the
   * configured brand name / logo / theme color before user is authenticated.
   * Only non-sensitive keys are exposed.
   */
  getPublicBrand: publicDbProcedure.query(async ({ ctx }) => {
    const snapshot = await loadAppSettingsSnapshot(ctx.serverDB, [
      SETTING_KEYS.brandName,
      SETTING_KEYS.brandLogoUrl,
      SETTING_KEYS.brandFaviconUrl,
      SETTING_KEYS.brandPrimaryColor,
      SETTING_KEYS.brandSlogan,
      SETTING_KEYS.brandLoadingText,
      SETTING_KEYS.brandLoadingSvgUrl,
      SETTING_KEYS.brandAuthTitle,
      SETTING_KEYS.brandCopyrightText,
      SETTING_KEYS.defaultSkillName,
      SETTING_KEYS.homeMessengerEnabled,
      SETTING_KEYS.homeMessengerBannerTitle,
      SETTING_KEYS.communityForkAndChatLabel,
      SETTING_KEYS.sidebarMemberLabel,
      SETTING_KEYS.sidebarMemberUrl,
      SETTING_KEYS.sidebarGenerationLabel,
    ]);
    const name = snapshot.get(SETTING_KEYS.brandName);
    const brandName = typeof name === 'string' ? name : DEFAULT_RUNTIME_BRAND.name;
    const favicon = snapshot.get(SETTING_KEYS.brandFaviconUrl);
    const logo = snapshot.get(SETTING_KEYS.brandLogoUrl);
    const primary = snapshot.get(SETTING_KEYS.brandPrimaryColor);
    const loadingText = snapshot.get(SETTING_KEYS.brandLoadingText);
    const loadingSvgUrl = snapshot.get(SETTING_KEYS.brandLoadingSvgUrl);
    const authTitle = snapshot.get(SETTING_KEYS.brandAuthTitle);
    const copyrightText = snapshot.get(SETTING_KEYS.brandCopyrightText);
    const defaultSkillName = snapshot.get(SETTING_KEYS.defaultSkillName);
    const homeMessengerBannerTitle = snapshot.get(SETTING_KEYS.homeMessengerBannerTitle);
    const communityForkAndChatLabel = snapshot.get(SETTING_KEYS.communityForkAndChatLabel);
    const sidebarGenerationLabel = snapshot.get(SETTING_KEYS.sidebarGenerationLabel);
    const sidebarMemberLabel = snapshot.get(SETTING_KEYS.sidebarMemberLabel);
    const sidebarMemberUrl = snapshot.get(SETTING_KEYS.sidebarMemberUrl);
    const slogan = snapshot.get(SETTING_KEYS.brandSlogan);

    return {
      authTitle:
        typeof authTitle === 'string' && authTitle.trim()
          ? authTitle
          : DEFAULT_RUNTIME_BRAND.authTitle,
      communityForkAndChatLabel:
        typeof communityForkAndChatLabel === 'string' && communityForkAndChatLabel.trim()
          ? communityForkAndChatLabel
          : null,
      copyrightText:
        typeof copyrightText === 'string' && copyrightText.trim()
          ? copyrightText
          : DEFAULT_RUNTIME_BRAND.copyrightText,
      defaultSkillName:
        typeof defaultSkillName === 'string' && defaultSkillName.trim()
          ? defaultSkillName
          : brandName,
      faviconUrl: typeof favicon === 'string' ? favicon : null,
      homeMessengerBannerTitle:
        typeof homeMessengerBannerTitle === 'string' && homeMessengerBannerTitle.trim()
          ? homeMessengerBannerTitle
          : null,
      homeMessengerEnabled: toBoolean(snapshot.get(SETTING_KEYS.homeMessengerEnabled), true),
      loadingSvgUrl:
        typeof loadingSvgUrl === 'string' && loadingSvgUrl.trim() ? loadingSvgUrl.trim() : null,
      loadingText:
        typeof loadingText === 'string' && loadingText.trim()
          ? loadingText
          : DEFAULT_RUNTIME_BRAND.loadingText,
      logoUrl: typeof logo === 'string' ? logo : DEFAULT_RUNTIME_BRAND.logoUrl,
      name: brandName,
      primaryColor: typeof primary === 'string' ? primary : DEFAULT_RUNTIME_BRAND.primaryColor,
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
    buildRecommendationSettings(
      await loadAppSettingsSectionSnapshot(ctx.serverDB, 'recommendations'),
    ),
  ),

  getPublicOperations: publicDbProcedure.query(async ({ ctx }) =>
    buildOperationsSettings(await loadAppSettingsSectionSnapshot(ctx.serverDB, 'operations')),
  ),

  getPublicGrowth: publicDbProcedure.query(async ({ ctx }) =>
    buildGrowthSettings(await loadAppSettingsSectionSnapshot(ctx.serverDB, 'growth')),
  ),

  getPublicExpertPlaza: publicDbProcedure.query(async ({ ctx }) =>
    buildExpertPlazaSettings(await loadAppSettingsSectionSnapshot(ctx.serverDB, 'expert-plaza')),
  ),

  getPublicProfileOptions: publicDbProcedure.query(async ({ ctx }) => {
    const snapshot = await loadAppSettingsSnapshot(ctx.serverDB, [
      SETTING_KEYS.profileInterestAreas,
      SETTING_KEYS.profileAvatarPresets,
    ]);

    return {
      avatarPresets: normalizeAvatarPresets(snapshot.get(SETTING_KEYS.profileAvatarPresets)),
      interestAreas: normalizeProfileInterestAreas(snapshot.get(SETTING_KEYS.profileInterestAreas)),
    };
  }),

  getPublicNotificationConfig: publicDbProcedure.query(async ({ ctx }) => {
    const settings = buildNotificationSettings(
      await loadAppSettingsSectionSnapshot(ctx.serverDB, 'notifications'),
    );

    return {
      desktopEnabled: settings.notificationDesktopEnabled,
      emailEnabled: settings.notificationEmailEnabled,
      eventDefaults: settings.notificationEventDefaults,
      inboxEnabled: settings.notificationInboxEnabled,
      pushEnabled: settings.notificationPushEnabled,
      system: {
        actionLabel: settings.notificationSystemActionLabel,
        actionUrl: settings.notificationSystemActionUrl || null,
        content: settings.notificationSystemContent,
        enabled: settings.notificationSystemEnabled,
        title: settings.notificationSystemTitle,
        type: settings.notificationSystemType,
      },
    };
  }),

  getPublicHelpMenu: publicDbProcedure.query(async ({ ctx }) => {
    const snapshot = await loadAppSettingsSnapshot(ctx.serverDB, [SETTING_KEYS.helpMenuItems]);
    return snapshot.has(SETTING_KEYS.helpMenuItems)
      ? normalizeHelpMenuItems(snapshot.get(SETTING_KEYS.helpMenuItems))
      : null;
  }),

  getPublicAboutLinks: publicDbProcedure.query(async ({ ctx }) => {
    const snapshot = await loadAppSettingsSnapshot(ctx.serverDB, [
      SETTING_KEYS.aboutLinks,
      SETTING_KEYS.aboutLogoUrl,
      SETTING_KEYS.brandLogoUrl,
    ]);

    return {
      links: normalizeAboutLinksConfig(snapshot.get(SETTING_KEYS.aboutLinks)),
      logoUrl:
        toString(snapshot.get(SETTING_KEYS.aboutLogoUrl)) ||
        toString(snapshot.get(SETTING_KEYS.brandLogoUrl)) ||
        DEFAULT_RUNTIME_BRAND.logoUrl,
    };
  }),

  getPublicAboutPage: publicDbProcedure.query(async ({ ctx }) => {
    const snapshot = await loadAppSettingsSnapshot(ctx.serverDB, [SETTING_KEYS.aboutPage]);
    return normalizeAboutPageConfig(snapshot.get(SETTING_KEYS.aboutPage));
  }),

  getPublicDesktopUpdate: publicDbProcedure.query(async ({ ctx }) => {
    const settings = buildDesktopSettings(
      await loadAppSettingsSectionSnapshot(ctx.serverDB, 'desktop-update'),
    );

    return {
      autoCheck: settings.desktopUpdateConfig.autoCheck,
      channel: settings.desktopUpdateConfig.channel,
      checkIntervalMinutes: settings.desktopUpdateConfig.checkInterval,
      currentVersion: settings.desktopUpdateConfig.currentVersion || null,
      downloadLabel: settings.desktopDownloadLabel,
      downloadUrl: settings.desktopDownloadUrl,
      loginConfig: {
        cloudButtonLabel: settings.desktopLoginConfig.cloudButtonLabel || null,
        description: settings.desktopLoginConfig.description || null,
        footerText: settings.desktopLoginConfig.footerText || null,
        logoUrl: settings.desktopLoginConfig.logoUrl || null,
        title: settings.desktopLoginConfig.title || null,
        windowTitle: settings.desktopLoginConfig.windowTitle || null,
      },
      releaseNotes: settings.desktopUpdateConfig.releaseNotes || null,
      serverUrl: settings.desktopUpdateConfig.serverUrl,
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

  getSection: systemReadProcedure
    .input(z.object({ section: z.enum(APP_SETTINGS_SECTIONS) }))
    .query(async ({ ctx, input }) => {
      const needsEnabledModels =
        input.section === 'model-policy' || input.section === 'system-defaults';
      const [snapshot, enabledModels] = await Promise.all([
        loadAppSettingsSectionSnapshot(ctx.serverDB, input.section),
        needsEnabledModels ? getAllEnabledModels(ctx.serverDB) : Promise.resolve([]),
      ]);

      return buildAdminSettingsSectionReadModel(input.section, snapshot, {
        defaultAgentConfig: getServerDefaultAgentConfig(),
        enabledModels,
      });
    }),

  getAll: systemReadProcedure.query(async ({ ctx }) => {
    const [snapshot, enabledModels] = await Promise.all([
      loadAllAppSettingsSnapshot(ctx.serverDB),
      getAllEnabledModels(ctx.serverDB),
    ]);

    return buildAdminSettingsReadModel(snapshot, {
      defaultAgentConfig: getServerDefaultAgentConfig(),
      enabledModels,
    });
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
      await runRequiredAdminAuditMutation(ctx, {
        audit: () => ({
          action: setAppSettingCommand.definition.auditAction,
          payload: buildSingleSettingAuditPayload(update),
          resourceId: input.key,
          resourceType: 'app_setting',
        }),
        mutation: async (tx) => upsertAppSetting(tx, update),
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

      invalidateAppSettingsCaches(updates);

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

    return runRequiredAdminAuditExternalEffect(ctx, {
      audit: (status) => ({
        action: 'settings.testS3Storage',
        payload: { operation: 's3_storage_health_check', terminalStatus: status },
        resourceType: 's3_storage',
      }),
      effect: async () => {
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
              } catch {
                console.error('[admin-s3] health check cleanup failed');
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
      },
    });
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
      const correlationId = randomUUID();
      const result = await runRequiredAdminAuditExternalEffect<any>(ctx, {
        audit: (status, result) => ({
          action: command.auditAction,
          payload:
            status === 'started'
              ? { phase: 'started' }
              : { ...result, phase: 'external', terminalStatus: status },
          resourceType: 'maintenance',
        }),
        correlationId,
        effect: async () => {
          const databaseResult = await runRequiredAdminAuditMutation<any>(ctx, {
            audit: (result) => ({
              action: command.auditAction,
              payload: { ...result, phase: 'database' },
              resourceType: 'maintenance',
            }),
            correlationId,
            mutation: async (tx) => {
              const databaseResult: {
                auditCutoff?: string;
                auditLogsDeleted?: number;
                freeSnapshotsCreated?: number;
                notificationRetentionCutoff?: string;
                notificationsDeleted?: number;
                pendingOrdersCutoff?: string;
                pendingOrdersExpired?: number;
                subscriptionSnapshotsExpired?: number;
              } = {};

              if (!opts.skipAudit) {
                const dbVal = await readSetting(tx, SETTING_KEYS.cronAuditRetentionDays);
                const days = Math.max(
                  7,
                  Math.min(
                    3650,
                    opts.auditRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 365),
                  ),
                );
                const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                const deleted = await tx
                  .delete(adminAuditLogs)
                  .where(lt(adminAuditLogs.createdAt, cutoff))
                  .returning({ id: adminAuditLogs.id });
                databaseResult.auditCutoff = cutoff.toISOString();
                databaseResult.auditLogsDeleted = deleted.length;
              }

              if (!opts.skipOrders) {
                const dbVal = await readSetting(tx, SETTING_KEYS.cronPendingOrderExpiryDays);
                const days = Math.max(
                  1,
                  Math.min(
                    365,
                    opts.pendingOrderExpiryDays ?? (typeof dbVal === 'number' ? dbVal : 7),
                  ),
                );
                const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                const expired = await tx
                  .update(topUpOrders)
                  .set({ status: 'expired', updatedAt: new Date() })
                  .where(and(eq(topUpOrders.status, 'pending'), lt(topUpOrders.createdAt, cutoff)))
                  .returning({ id: topUpOrders.id });
                databaseResult.pendingOrdersCutoff = cutoff.toISOString();
                databaseResult.pendingOrdersExpired = expired.length;
              }

              if (!opts.skipNotifications) {
                const dbVal = await readSetting(tx, SETTING_KEYS.notificationRetentionDays);
                const days = Math.max(
                  1,
                  Math.min(
                    3650,
                    opts.notificationRetentionDays ?? (typeof dbVal === 'number' ? dbVal : 90),
                  ),
                );
                const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                const deleted = await tx
                  .delete(notifications)
                  .where(
                    and(eq(notifications.isArchived, true), lt(notifications.updatedAt, cutoff)),
                  )
                  .returning({ id: notifications.id });
                databaseResult.notificationRetentionCutoff = cutoff.toISOString();
                databaseResult.notificationsDeleted = deleted.length;
              }

              const subscriptionResult = await syncExpiredSubscriptionsToFree(tx);
              databaseResult.subscriptionSnapshotsExpired = subscriptionResult.expiredSnapshots;
              databaseResult.freeSnapshotsCreated = subscriptionResult.freeSnapshotsCreated;

              return databaseResult;
            },
          });

          if (opts.skipModuleAppUploads) return databaseResult;

          // Storage deletion cannot roll back. The durable started and database-result audits
          // above remain available if this lifecycle reports a recovery-required terminal failure.
          const cleanup = await new ModuleAppPackageLifecycleService({
            db: ctx.serverDB,
          }).cleanupExpiredUploads({ limit: 100 });

          return {
            ...databaseResult,
            moduleAppUploadCleanupFailed: cleanup.failed,
            moduleAppUploadsExpired: cleanup.expired,
          };
        },
        terminalStatus: (result) =>
          result.moduleAppUploadCleanupFailed > 0 ? 'failed' : 'succeeded',
      });

      return { ok: true, ...result };
    }),
});
