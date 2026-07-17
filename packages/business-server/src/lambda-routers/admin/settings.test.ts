// @vitest-environment node
import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';
import { ADMIN_COMMANDS, Plans } from '@lobechat/types';
import type { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_COMHUB_AGENT_AVATAR, DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import { getServerDB } from '@/database/core/db-adaptor';
import { getResolvedServerDefaultAgentConfig } from '@/server/globalConfig';
import { invalidateFileS3RuntimeCache, S3 } from '@/server/modules/S3';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';
import {
  APP_SETTING_SECRET_PREFIX,
  decryptAppSettingSecret,
  encryptAppSettingSecret,
} from '@/server/services/appSettings/secrets';
import { invalidateServerBrand } from '@/server/services/brand';
import { ModuleAppPackageLifecycleService } from '@/server/services/moduleAppPackage/lifecycle';
import {
  getAllEnabledModels,
  invalidateNewapiInstancesCache,
} from '@/server/services/newapiInstance';

import { syncExpiredSubscriptionsToFree } from '../../subscriptionMaintenance';
import {
  recordAdminAudit,
  runRequiredAdminAuditExternalEffect,
  runRequiredAdminAuditMutation,
} from './audit';
import {
  adminSettingsRouter,
  buildUserGlobalSettingsSyncValues,
  syncUserGlobalSettingsDefaultsToUserSettings,
  validateDefaultAgentModelUsability,
} from './settings';

const TEST_KEY_VAULTS_SECRET = Buffer.alloc(32, 9).toString('base64');

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/server/services/newapiInstance', () => ({
  getAllEnabledModels: vi.fn(),
  invalidateNewapiInstancesCache: vi.fn(),
}));

vi.mock('@/server/services/brand', () => ({
  invalidateServerBrand: vi.fn(),
}));

vi.mock('@/server/services/moduleAppPackage/lifecycle', () => ({
  ModuleAppPackageLifecycleService: vi.fn(),
}));

vi.mock('@/server/modules/S3', () => ({
  invalidateFileS3RuntimeCache: vi.fn(),
  S3: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/server/globalConfig', () => ({
  getResolvedServerDefaultAgentConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
  runRequiredAdminAuditExternalEffect: vi.fn(async (ctx, options) => {
    await recordAdminAudit(ctx, await options.audit('started'), {
      correlationId: options.correlationId,
      status: 'started',
    });
    try {
      const result = await options.effect();
      const status = options.terminalStatus?.(result) ?? 'succeeded';
      await recordAdminAudit(ctx, await options.audit(status, result), {
        correlationId: options.correlationId,
        status,
      });
      return result;
    } catch (error) {
      await recordAdminAudit(ctx, await options.audit('failed'), {
        correlationId: options.correlationId,
        status: 'failed',
      });
      throw error;
    }
  }),
  runRequiredAdminAuditMutation: vi.fn(async (ctx, options) => {
    const result = ctx.serverDB.transaction
      ? await ctx.serverDB.transaction((tx: unknown) => options.mutation(tx))
      : await options.mutation(ctx.serverDB);
    await recordAdminAudit(ctx, await options.audit(result));
    return result;
  }),
}));

vi.mock('../../subscriptionMaintenance', () => ({
  syncExpiredSubscriptionsToFree: vi.fn(),
}));

const createDb = ({
  appSettings = [],
  appSettingsMany = [],
  modelRules = null,
  role = 'admin',
}: {
  appSettings?: Array<{ value: unknown } | null>;
  appSettingsMany?: Array<{ key: string; value: unknown }>;
  modelRules?: any;
  role?: string | null;
} = {}) => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({
    onConflictDoUpdate,
  }));
  const insert = vi.fn(() => ({
    values,
  }));

  return {
    __mocks: {
      onConflictDoUpdate,
      values,
    },
    insert,
    query: {
      appSettings: {
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(appSettings.shift() ?? null)),
        findMany: vi.fn().mockResolvedValue(appSettingsMany),
      },
      planCatalog: {
        findFirst: vi.fn().mockResolvedValue({
          modelRules,
          plan: Plans.Free,
        }),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
      },
    },
  } as any;
};

describe('admin settings default model validation', () => {
  beforeEach(() => {
    process.env.KEY_VAULTS_SECRET = TEST_KEY_VAULTS_SECRET;
    vi.resetAllMocks();
    vi.mocked(getResolvedServerDefaultAgentConfig).mockResolvedValue({});
    vi.mocked(S3).mockImplementation(
      () =>
        ({
          testConnection: vi.fn().mockResolvedValue(undefined),
        }) as any,
    );
    vi.mocked(syncExpiredSubscriptionsToFree).mockResolvedValue({
      expiredSnapshots: 0,
      freeSnapshotsCreated: 0,
    });
    vi.mocked(ModuleAppPackageLifecycleService).mockImplementation(
      () =>
        ({
          cleanupExpiredUploads: vi.fn().mockResolvedValue({ expired: 3, failed: 0 }),
        }) as any,
    );
  });

  afterEach(() => {
    delete process.env.KEY_VAULTS_SECRET;
    vi.unstubAllGlobals();
  });

  it('rejects a NewAPI default chat model that is not enabled in the managed model catalog', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'DeepSeek Chat', id: 'deepseek-chat', type: 'chat' },
    ]);

    await expect(
      validateDefaultAgentModelUsability(createDb(), {
        [APP_SETTING_KEYS.defaultAgentModel]: 'missing-chat',
        [APP_SETTING_KEYS.defaultAgentProvider]: 'newapi',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_NOT_ENABLED',
    } satisfies Partial<TRPCError>);
  });

  it('rejects a default chat model that is not allowed by the Free plan allowlist', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'DeepSeek Chat', id: 'deepseek-chat', type: 'chat' },
    ]);

    await expect(
      validateDefaultAgentModelUsability(
        createDb({
          modelRules: {
            chat: {
              allowlist: ['gpt-*'],
              mode: 'allowlist',
            },
          },
        }),
        {
          [APP_SETTING_KEYS.defaultAgentModel]: 'deepseek-chat',
          [APP_SETTING_KEYS.defaultAgentProvider]: 'newapi',
        },
      ),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN',
    } satisfies Partial<TRPCError>);
  });

  it('allows an enabled NewAPI default chat model when the Free plan allows it', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'DeepSeek Chat', id: 'deepseek-chat', type: 'chat' },
    ]);

    await expect(
      validateDefaultAgentModelUsability(
        createDb({
          modelRules: {
            chat: {
              allowlist: ['deepseek-*'],
              mode: 'allowlist',
            },
          },
        }),
        {
          [APP_SETTING_KEYS.defaultAgentModel]: 'deepseek-chat',
          [APP_SETTING_KEYS.defaultAgentProvider]: 'newapi',
        },
      ),
    ).resolves.toBeUndefined();
  });

  it('uses the enabled route with the requested model type when duplicate model ids exist', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'Shared Model Video', id: 'shared-model', type: 'video' },
      {
        displayName: 'Shared Model Chat',
        groupKey: 'default',
        id: 'shared-model',
        type: 'chat',
      } as any,
    ]);

    await expect(
      validateDefaultAgentModelUsability(
        createDb({
          modelRules: {
            chat: {
              allowlist: ['default:shared-model'],
              mode: 'allowlist',
            },
          },
        }),
        {
          [APP_SETTING_KEYS.defaultAgentModel]: 'shared-model',
          [APP_SETTING_KEYS.defaultAgentProvider]: 'newapi',
        },
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a default NewAPI model when the Free plan only allows a different group route', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'GPT-4', groupKey: 'pro', id: 'gpt-4', type: 'chat' } as any,
    ]);

    await expect(
      validateDefaultAgentModelUsability(
        createDb({
          modelRules: {
            chat: {
              allowlist: ['default:gpt-4'],
              mode: 'allowlist',
            },
          },
        }),
        {
          [APP_SETTING_KEYS.defaultAgentModel]: 'gpt-4',
          [APP_SETTING_KEYS.defaultAgentProvider]: 'newapi',
        },
      ),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN',
    } satisfies Partial<TRPCError>);
  });

  it('rejects a default image model when the enabled NewAPI model has the wrong type', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'Sora', id: 'sora-2', type: 'video' },
    ]);

    await expect(
      validateDefaultAgentModelUsability(
        createDb({
          modelRules: {
            image: {
              allowlist: ['sora-*'],
              mode: 'allowlist',
            },
          },
        }),
        {
          [APP_SETTING_KEYS.defaultImageModel]: 'sora-2',
          [APP_SETTING_KEYS.defaultImageProvider]: 'newapi',
        },
        {
          modelKey: APP_SETTING_KEYS.defaultImageModel,
          modelType: 'image',
          providerKey: APP_SETTING_KEYS.defaultImageProvider,
        },
      ),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_TYPE_MISMATCH',
    } satisfies Partial<TRPCError>);
  });

  it('rejects saving a default model when the current provider is NewAPI but the model is not enabled', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'DeepSeek Chat', id: 'deepseek-chat', type: 'chat' },
    ]);

    const db = createDb({
      appSettings: [null, { value: 'newapi' }],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSetting({
        key: APP_SETTING_KEYS.defaultAgentModel,
        value: 'missing-chat',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_NOT_ENABLED',
    } satisfies Partial<TRPCError>);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns ComHub assistant defaults when no default assistant setting exists', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([]);
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const settings = await caller.getAll();

    expect(settings.defaultAgentAvatar).toBe(DEFAULT_COMHUB_AGENT_AVATAR);
    expect(settings.defaultAgentName).toBe(DEFAULT_COMHUB_AGENT_NAME);
    expect(settings.ordersManagementEnabled).toBe(false);
    expect(settings.pricingCreditMultiplier).toBe(DEFAULT_PRICING_CREDIT_MULTIPLIER);
  });

  it('persists home messenger enabled as a boolean brand setting', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.setAppSetting({
      key: APP_SETTING_KEYS.homeMessengerEnabled,
      value: false,
    });

    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.homeMessengerEnabled,
      value: false,
    });
  });

  it('returns enabled managed models with their runtime provider ids', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      {
        displayName: 'ToAPI Chat',
        id: 'gpt-5.4-mini',
        instanceId: 'toapi',
        instanceName: 'toapi',
        providerId: 'toapi',
        providerType: 'newapi',
        type: 'chat',
      } as any,
    ]);
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const settings = await caller.getAll();

    expect(settings.enabledNewapiModels).toContainEqual(
      expect.objectContaining({
        modelId: 'gpt-5.4-mini',
        provider: 'toapi',
      }),
    );
  });

  it('distinguishes missing and explicitly empty public help menu settings', async () => {
    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    vi.mocked(getServerDB).mockResolvedValue(createDb());
    await expect(caller.getPublicHelpMenu()).resolves.toBeNull();

    vi.mocked(getServerDB).mockResolvedValue(createDb({ appSettings: [{ value: [] }] }));
    await expect(caller.getPublicHelpMenu()).resolves.toEqual([]);
  });

  it('returns app settings governance without exposing persisted values', async () => {
    const db = createDb({
      appSettingsMany: [
        { key: APP_SETTING_KEYS.brandName, value: 'ComHub' },
        { key: APP_SETTING_KEYS.storageS3SecretAccessKey, value: 'admin-secret-key' },
        { key: 'legacy.unknown.key', value: 'legacy-value' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.getGovernance();

    expect(result.summary.unknownCount).toBe(1);
    expect(result.summary.sensitiveConfiguredCount).toBe(1);
    expect(result.unknownKeys).toEqual([{ key: 'legacy.unknown.key' }]);
    expect(result.sensitiveConfiguredKeys).toEqual([
      expect.objectContaining({ key: APP_SETTING_KEYS.storageS3SecretAccessKey }),
    ]);
    expect(JSON.stringify(result)).not.toContain('admin-secret-key');
    expect(JSON.stringify(result)).not.toContain('legacy-value');
  });

  it('deletes unknown app setting keys with exact confirmation and audit log', async () => {
    const where = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ key: 'legacy.unknown.key' }]),
    }));
    const db = {
      delete: vi.fn(() => ({ where })),
      query: {
        users: { findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'system_admin' }) },
      },
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter
        .createCaller({ userId: 'system-admin-user' } as any)
        .deleteUnknownSetting({
          confirmKey: 'legacy.unknown.key',
          key: 'legacy.unknown.key',
        }),
    ).resolves.toEqual({ deleted: true, key: 'legacy.unknown.key' });

    expect(db.delete).toHaveBeenCalled();
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'settings.deleteUnknown',
        resourceId: 'legacy.unknown.key',
        resourceType: 'app_setting',
      }),
    );
  });

  it('rejects deleting registered app setting keys', async () => {
    const db = createDb({ role: 'system_admin' });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter
        .createCaller({ userId: 'system-admin-user' } as any)
        .deleteUnknownSetting({
          confirmKey: APP_SETTING_KEYS.brandName,
          key: APP_SETTING_KEYS.brandName,
        }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('rejects unknown setting cleanup when confirmation does not match', async () => {
    const db = createDb({ role: 'system_admin' });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter
        .createCaller({ userId: 'system-admin-user' } as any)
        .deleteUnknownSetting({
          confirmKey: 'wrong',
          key: 'legacy.unknown.key',
        }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns public desktop update display fields for client download entries', async () => {
    const db = createDb({
      appSettings: [
        { value: 'https://comhubs.oss-cn-shanghai.aliyuncs.com' },
        { value: 'canary' },
        { value: true },
        { value: 30 },
        { value: 'https://comhubs.oss-cn-shanghai.aliyuncs.com/canary/0.1.0-canary.6/LobeHub.exe' },
        { value: 'Download Qingyou Desktop' },
        { value: '0.1.0-canary.6' },
        { value: '- Fix auto update' },
        { value: 'XUANGUO' },
        { value: '/images/brand/xuanguo.png' },
        { value: '登录玄果客户端' },
        { value: '同步玄果代理、群组、设置和上下文。' },
        { value: '登录 XUANGUO Cloud' },
        { value: '© 2026 XUANGUO. All rights reserved.' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const settings = await caller.getPublicDesktopUpdate();

    expect(settings).toMatchObject({
      autoCheck: true,
      channel: 'canary',
      checkIntervalMinutes: 30,
      currentVersion: '0.1.0-canary.6',
      downloadLabel: 'Download Qingyou Desktop',
      downloadUrl: 'https://comhubs.oss-cn-shanghai.aliyuncs.com/canary/0.1.0-canary.6/LobeHub.exe',
      loginConfig: {
        cloudButtonLabel: '登录 XUANGUO Cloud',
        description: '同步玄果代理、群组、设置和上下文。',
        footerText: '© 2026 XUANGUO. All rights reserved.',
        logoUrl: '/images/brand/xuanguo.png',
        title: '登录玄果客户端',
        windowTitle: 'XUANGUO',
      },
      releaseNotes: '- Fix auto update',
      serverUrl: 'https://comhubs.oss-cn-shanghai.aliyuncs.com',
    });
    expect(Object.keys(settings).sort()).toEqual([
      'autoCheck',
      'channel',
      'checkIntervalMinutes',
      'currentVersion',
      'downloadLabel',
      'downloadUrl',
      'loginConfig',
      'releaseNotes',
      'serverUrl',
    ]);
    expect(Object.keys(settings.loginConfig).sort()).toEqual([
      'cloudButtonLabel',
      'description',
      'footerText',
      'logoUrl',
      'title',
      'windowTitle',
    ]);
  });

  it('does not expose sensitive desktop OSS settings through public desktop config', async () => {
    const db = createDb({
      appSettings: [
        { value: 'https://updates.example.com' },
        { value: 'stable' },
        { value: true },
        { value: 60 },
        { value: 'https://downloads.example.com/app.exe' },
        { value: 'Download Desktop' },
        { value: '1.0.0' },
        { value: 'Release notes' },
        { value: 'Desktop' },
        { value: '/logo.png' },
        { value: 'Sign in' },
        { value: 'Connect your account.' },
        { value: 'Sign in to Cloud' },
        { value: 'Copyright' },
      ],
      appSettingsMany: [
        { key: APP_SETTING_KEYS.desktopOssAccessKeyId, value: 'desktop-oss-access-key' },
        { key: APP_SETTING_KEYS.desktopOssAccessKeySecret, value: 'desktop-oss-secret-key' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const settings = await caller.getPublicDesktopUpdate();
    const serialized = JSON.stringify(settings);

    expect(settings).toMatchObject({
      downloadUrl: 'https://downloads.example.com/app.exe',
      serverUrl: 'https://updates.example.com',
    });
    expect(serialized).not.toContain('desktop-oss-access-key');
    expect(serialized).not.toContain('desktop-oss-secret-key');
  });

  it.each([
    APP_SETTING_KEYS.desktopOssAccessKeyId,
    APP_SETTING_KEYS.desktopOssAccessKeySecret,
    APP_SETTING_KEYS.desktopOssBucket,
    APP_SETTING_KEYS.desktopOssEndpoint,
    APP_SETTING_KEYS.desktopOssPath,
  ])('rejects externally owned desktop OSS key %s in batch writes', async (key) => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSettingsBatch({ updates: [{ key, value: 'external-value' }] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('encrypts cron.secret while preserving boundary whitespace in the plaintext', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.setAppSetting({ key: APP_SETTING_KEYS.cronSecret, value: '  test-secret  ' });

    const stored = db.__mocks.values.mock.calls.find(
      ([value]: any[]) => value.key === APP_SETTING_KEYS.cronSecret,
    )?.[0].value;
    expect(stored).toMatch(`${APP_SETTING_SECRET_PREFIX}${APP_SETTING_KEYS.cronSecret}:`);
    await expect(decryptAppSettingSecret(APP_SETTING_KEYS.cronSecret, stored)).resolves.toBe(
      '  test-secret  ',
    );
  });

  it.each([
    ['number', 42],
    ['object', { nested: ['value'] }],
  ])('rejects a new non-string cron.secret %s write', async (_, value) => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.setAppSetting({ key: APP_SETTING_KEYS.cronSecret, value }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('does not overwrite a secret with its unchanged masked placeholder', async () => {
    const existing = await encryptAppSettingSecret(
      APP_SETTING_KEYS.composioApiKey,
      'existing-secret',
    );
    const db = createDb({ appSettings: [{ value: existing }] });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.setAppSetting({
        key: APP_SETTING_KEYS.composioApiKey,
        value: '****cret',
      }),
    ).resolves.toEqual({ ok: true });

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('clears the stored Composio API key when its explicit clear control writes blank', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.setAppSetting({
        key: APP_SETTING_KEYS.composioApiKey,
        value: '',
      }),
    ).resolves.toEqual({ ok: true });

    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.composioApiKey,
      value: '',
    });
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['setting.setAppSetting'].auditAction,
        payload: {
          hasValue: false,
          key: APP_SETTING_KEYS.composioApiKey,
        },
      }),
    );
  });

  it.each([APP_SETTING_KEYS.cronSecret, APP_SETTING_KEYS.storageS3SecretAccessKey])(
    'keeps a blank generic password write for %s as a no-op',
    async (key) => {
      const db = createDb();
      vi.mocked(getServerDB).mockResolvedValue(db);

      const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
      await expect(caller.setAppSetting({ key, value: '' })).resolves.toEqual({ ok: true });

      expect(db.insert).not.toHaveBeenCalled();
      expect(recordAdminAudit).not.toHaveBeenCalled();
    },
  );

  it('decrypts cron.secret only for masking and never returns plaintext', async () => {
    const encrypted = await encryptAppSettingSecret(
      APP_SETTING_KEYS.cronSecret,
      'admin-cron-secret',
    );
    const settingRows = Array.from({ length: 100 }, () => null as { value: unknown } | null);
    settingRows[1] = { value: encrypted };
    const db = createDb({ appSettings: settingRows });
    vi.mocked(getServerDB).mockResolvedValue(db);
    vi.mocked(getAllEnabledModels).mockResolvedValue([]);

    const result = await adminSettingsRouter.createCaller({ userId: 'admin-user' } as any).getAll();

    expect(result.cronSecretMasked).toBe('****cret');
    expect(JSON.stringify(result)).not.toContain('admin-cron-secret');
  });

  it('rejects secret writes when encryption is unavailable without persisting plaintext', async () => {
    delete process.env.KEY_VAULTS_SECRET;
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.setAppSetting({
        key: APP_SETTING_KEYS.composioApiKey,
        value: 'must-not-persist',
      }),
    ).rejects.toThrow('KEY_VAULTS_SECRET');

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects the deprecated order-management setting in generic writes', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSettingsBatch({
        updates: [{ key: APP_SETTING_KEYS.ordersManagementEnabled, value: true }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects non-positive global pricing multipliers', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSetting({
        key: APP_SETTING_KEYS.pricingCreditMultiplier,
        value: 0,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'pricingCreditMultiplier must be greater than 0',
    } satisfies Partial<TRPCError>);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refreshes runtime caches on admin request', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.refreshRuntimeCaches();

    expect(result).toEqual({
      ok: true,
      refreshed: ['app-settings', 'newapi-instances', 's3-runtime', 'brand'],
    });
    expect(invalidateFileS3RuntimeCache).toHaveBeenCalledTimes(1);
    expect(invalidateNewapiInstancesCache).toHaveBeenCalledTimes(1);
    expect(invalidateServerBrand).toHaveBeenCalledTimes(1);
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'settings.refreshRuntimeCaches',
        payload: {
          operation: 'refreshRuntimeCaches',
          refreshed: ['app-settings', 'newapi-instances', 's3-runtime', 'brand'],
          requestedDomains: ['app-settings', 'newapi-instances', 's3-runtime', 'brand'],
          results: [
            { domain: 'app-settings', status: 'refreshed' },
            { domain: 'newapi-instances', status: 'refreshed' },
            { domain: 's3-runtime', status: 'refreshed' },
            { domain: 'brand', status: 'refreshed' },
          ],
          status: 'success',
        },
        resourceType: 'app_setting',
      }),
    );
  });

  it('allows scoped system admins to refresh runtime caches', async () => {
    const db = createDb({ role: 'system_admin' });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter
        .createCaller({ userId: 'system-admin-user' } as any)
        .refreshRuntimeCaches(),
    ).resolves.toEqual({
      ok: true,
      refreshed: ['app-settings', 'newapi-instances', 's3-runtime', 'brand'],
    });
  });

  it('rejects finance admins from refreshing runtime caches', async () => {
    const db = createDb({ role: 'finance_admin' });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter.createCaller({ userId: 'finance-user' } as any).refreshRuntimeCaches(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('cleans archived notifications during maintenance using the configured retention days', async () => {
    const appSettings = [{ value: 365 }, { value: 7 }, { value: 14 }];
    const deleteMock = vi
      .fn()
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: 'notification-1' }, { id: 'notification-2' }]),
        })),
      });
    const updateMock = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    }));
    const db = {
      delete: deleteMock,
      query: {
        appSettings: {
          findFirst: vi.fn().mockImplementation(() => Promise.resolve(appSettings.shift() ?? null)),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
      update: updateMock,
    } as any;
    db.transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db));
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.runMaintenance({
      command: { actionId: 'setting.runMaintenance', confirmed: true },
    });

    expect(result.notificationsDeleted).toBe(2);
    expect(result.notificationRetentionCutoff).toBeTruthy();
    expect(result.moduleAppUploadsExpired).toBe(3);
    expect(result.moduleAppUploadCleanupFailed).toBe(0);
    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        audit: expect.any(Function),
        effect: expect.any(Function),
      }),
    );
    expect(runRequiredAdminAuditMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        audit: expect.any(Function),
        mutation: expect.any(Function),
      }),
    );
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['setting.runMaintenance'].auditAction,
        payload: expect.objectContaining({ phase: 'database' }),
      }),
    );
  });

  it('records a failed maintenance lifecycle when upload cleanup reports partial failures', async () => {
    vi.mocked(ModuleAppPackageLifecycleService).mockImplementation(
      () =>
        ({
          cleanupExpiredUploads: vi.fn().mockResolvedValue({ expired: 2, failed: 1 }),
        }) as any,
    );
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter.createCaller({ userId: 'admin-user' } as any).runMaintenance({
        command: { actionId: 'setting.runMaintenance', confirmed: true },
        skipAudit: true,
        skipNotifications: true,
        skipOrders: true,
      }),
    ).resolves.toMatchObject({
      moduleAppUploadCleanupFailed: 1,
      moduleAppUploadsExpired: 2,
      ok: true,
    });

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: ADMIN_COMMANDS['setting.runMaintenance'].auditAction }),
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('can skip module app upload cleanup during manual maintenance', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const result = await adminSettingsRouter
      .createCaller({ userId: 'admin-user' } as any)
      .runMaintenance({
        command: { actionId: 'setting.runMaintenance', confirmed: true },
        skipAudit: true,
        skipModuleAppUploads: true,
        skipNotifications: true,
        skipOrders: true,
      });

    expect(result).not.toHaveProperty('moduleAppUploadsExpired');
    expect(ModuleAppPackageLifecycleService).not.toHaveBeenCalled();
  });

  it('returns public notification config with channel defaults and system action metadata', async () => {
    const db = createDb({
      appSettings: [
        { value: true },
        { value: false },
        { value: true },
        { value: true },
        {
          value: {
            email: { lowCredits: false },
            push: { videoGenerationCompleted: false },
            sms: { lowCredits: false },
          },
        },
        { value: true },
        { value: '系统维护通知' },
        { value: '今晚 23:00 进行服务升级。' },
        { value: '查看状态' },
        { value: 'https://chat.qingyouai.com/status' },
        { value: 'info' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.getPublicNotificationConfig();

    expect(result).toMatchObject({
      desktopEnabled: false,
      emailEnabled: true,
      eventDefaults: {
        email: { lowCredits: false },
        inbox: { workspaceInvitation: true },
        push: { videoGenerationCompleted: false },
      },
      inboxEnabled: true,
      pushEnabled: true,
      system: {
        actionLabel: '查看状态',
        actionUrl: 'https://chat.qingyouai.com/status',
        content: '今晚 23:00 进行服务升级。',
        enabled: true,
        title: '系统维护通知',
        type: 'info',
      },
    });
  });

  it('returns public brand config with the configured loading SVG URL', async () => {
    const db = createDb({
      appSettings: [
        { value: 'ComHub' },
        { value: 'https://cdn.example.com/logo.svg' },
        { value: 'https://cdn.example.com/favicon.ico' },
        { value: '#12b981' },
        { value: 'Slogan' },
        { value: 'Loading ComHub' },
        { value: '/branding/loading.svg' },
        { value: 'Auth title' },
        { value: 'Copyright' },
        { value: 'ComHub Skill' },
        { value: true },
        { value: 'Messenger banner' },
        { value: 'Fork and chat' },
        { value: 'Plans' },
        { value: '/settings/plans' },
        { value: 'Generate' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.getPublicBrand();

    expect(result).toMatchObject({
      loadingSvgUrl: '/branding/loading.svg',
      loadingText: 'Loading ComHub',
      logoUrl: 'https://cdn.example.com/logo.svg',
      name: 'ComHub',
    });
  });

  it('normalizes notification event defaults and announcement type before saving', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.setAppSetting({
      key: APP_SETTING_KEYS.notificationEventDefaults,
      value: {
        email: { lowCredits: false, unknown: false },
        push: { videoGenerationCompleted: false },
        sms: { lowCredits: false },
      },
    });
    await caller.setAppSetting({
      key: APP_SETTING_KEYS.notificationSystemType,
      value: 'critical',
    });

    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.notificationEventDefaults,
      value: expect.objectContaining({
        email: expect.objectContaining({ imageGenerationCompleted: true, lowCredits: false }),
        inbox: expect.objectContaining({ workspaceInvitation: true }),
        push: expect.objectContaining({
          imageGenerationCompleted: true,
          videoGenerationCompleted: false,
        }),
      }),
    });
    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.notificationSystemType,
      value: 'warning',
    });
  });

  it('allows admins to save S3 storage settings while keeping the secret out of audit payloads', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.setAppSetting({
      key: APP_SETTING_KEYS.storageS3Endpoint,
      value: 'https://s3.example.com',
    });
    await caller.setAppSetting({
      key: APP_SETTING_KEYS.storageS3SecretAccessKey,
      value: 'admin-secret-key',
    });

    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.storageS3Endpoint,
      value: 'https://s3.example.com',
    });
    const storedSecret = db.__mocks.values.mock.calls.find(
      ([value]: any[]) => value.key === APP_SETTING_KEYS.storageS3SecretAccessKey,
    )?.[0].value;
    expect(storedSecret).not.toBe('admin-secret-key');
    await expect(
      decryptAppSettingSecret(APP_SETTING_KEYS.storageS3SecretAccessKey, storedSecret),
    ).resolves.toBe('admin-secret-key');
    expect(invalidateFileS3RuntimeCache).toHaveBeenCalledTimes(2);
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: {
          hasValue: true,
          key: APP_SETTING_KEYS.storageS3SecretAccessKey,
        },
      }),
    );
  });

  it('saves multiple app settings in one transaction with one redacted audit entry', async () => {
    const tx = createDb();
    const db = {
      ...createDb(),
      transaction: vi.fn(async (handler: (transaction: unknown) => Promise<unknown>) =>
        handler(tx),
      ),
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.setAppSettingsBatch({
      updates: [
        {
          key: APP_SETTING_KEYS.storageS3Endpoint,
          value: 'https://s3.example.com',
        },
        {
          key: APP_SETTING_KEYS.storageS3SecretAccessKey,
          value: 'admin-secret-key',
        },
      ],
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.storageS3Endpoint,
      value: 'https://s3.example.com',
    });
    const storedSecret = tx.__mocks.values.mock.calls.find(
      ([value]: any[]) => value.key === APP_SETTING_KEYS.storageS3SecretAccessKey,
    )?.[0].value;
    expect(storedSecret).not.toBe('admin-secret-key');
    await expect(
      decryptAppSettingSecret(APP_SETTING_KEYS.storageS3SecretAccessKey, storedSecret),
    ).resolves.toBe('admin-secret-key');
    expect(invalidateFileS3RuntimeCache).toHaveBeenCalledTimes(1);
    expect(recordAdminAudit).toHaveBeenCalledTimes(1);

    const auditEntry = vi.mocked(recordAdminAudit).mock.calls[0]?.[1] as any;
    expect(auditEntry).toMatchObject({
      action: 'settings.batchSet',
      payload: {
        count: 2,
        settings: expect.arrayContaining([
          {
            hasValue: true,
            key: APP_SETTING_KEYS.storageS3Endpoint,
            value: 'https://s3.example.com',
          },
          {
            hasValue: true,
            key: APP_SETTING_KEYS.storageS3SecretAccessKey,
            sensitive: true,
          },
        ]),
      },
      resourceType: 'app_setting',
    });
    expect(JSON.stringify(auditEntry.payload)).not.toContain('admin-secret-key');
  });

  it('saves memory analysis model settings in a batch', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'GPT 5.5', id: 'gpt-5.5', type: 'chat' },
      { displayName: 'GPT 5.5 Mini', id: 'gpt-5.5-mini', type: 'chat' },
    ]);
    const tx = createDb();
    const db = {
      ...createDb(),
      transaction: vi.fn(async (handler: (transaction: unknown) => Promise<unknown>) =>
        handler(tx),
      ),
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.setAppSettingsBatch({
      updates: [
        {
          key: APP_SETTING_KEYS.memoryUserMemoryGatekeeperProvider,
          value: 'newapi',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryGatekeeperModel,
          value: 'gpt-5.5',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryLayerExtractorProvider,
          value: 'newapi',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryLayerExtractorModel,
          value: 'gpt-5.5-mini',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryPersonaWriterProvider,
          value: 'opencodego',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryPersonaWriterModel,
          value: 'claude-sonnet-4',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryEmbeddingProvider,
          value: 'siliconflow',
        },
        {
          key: APP_SETTING_KEYS.memoryUserMemoryEmbeddingModel,
          value: 'BAAI/bge-m3',
        },
      ],
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.memoryUserMemoryGatekeeperProvider,
      value: 'newapi',
    });
    expect(tx.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.memoryUserMemoryEmbeddingModel,
      value: 'BAAI/bge-m3',
    });
    expect(recordAdminAudit).toHaveBeenCalledTimes(1);
  });

  it('builds a safe user settings sync payload from global defaults', () => {
    expect(
      buildUserGlobalSettingsSyncValues({
        defaultAgent: { config: { model: 'gpt-5.5', provider: 'newapi' } },
        general: { language: 'zh-CN' },
        keyVaults: { openai: { apiKey: 'must-not-sync' } },
        languageModel: { newapi: { enabled: true } },
        systemAgent: {
          inputCompletion: {
            enabled: true,
            model: 'gpt-5.5-mini',
            provider: 'newapi',
          },
        },
      }),
    ).toEqual({
      defaultAgent: { config: { model: 'gpt-5.5', provider: 'newapi' } },
      general: { language: 'zh-CN' },
      languageModel: { newapi: { enabled: true } },
      systemAgent: {
        inputCompletion: {
          enabled: true,
          model: 'gpt-5.5-mini',
          provider: 'newapi',
        },
      },
    });
  });

  it('rejects enabled input completion defaults when the model is not enabled for its provider', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      {
        displayName: 'GPT 5.5 Mini',
        id: 'gpt-5.5-mini',
        providerId: 'newapi',
        type: 'chat',
      } as any,
    ]);
    const tx = createDb();
    const db = {
      ...createDb(),
      transaction: vi.fn(async (handler: (transaction: unknown) => Promise<unknown>) =>
        handler(tx),
      ),
    };
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSettingsBatch({
        updates: [
          {
            key: APP_SETTING_KEYS.userGlobalSettingsDefaults,
            value: {
              systemAgent: {
                inputCompletion: {
                  enabled: true,
                  model: 'gpt-5.4',
                  provider: 'newapi',
                },
              },
            },
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'INPUT_COMPLETION_MODEL_NOT_ENABLED',
    } satisfies Partial<TRPCError>);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('syncs saved user global defaults into all user settings rows', async () => {
    const defaults = {
      languageModel: { newapi: { enabled: true } },
      systemAgent: {
        inputCompletion: {
          enabled: true,
          model: 'gpt-5.5-mini',
          provider: 'newapi',
        },
      },
      tool: { uninstalledBuiltinTools: ['web-browsing'] },
    };
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      {
        displayName: 'GPT 5.5 Mini',
        id: 'gpt-5.5-mini',
        providerId: 'newapi',
        type: 'chat',
      } as any,
    ]);
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const db = {
      insert,
      query: {
        appSettings: {
          findFirst: vi.fn().mockResolvedValue({ value: defaults }),
        },
        planCatalog: {
          findFirst: vi.fn().mockResolvedValue({ modelRules: null, plan: Plans.Free }),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
      })),
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.syncUserGlobalSettingsDefaultsToUsers();

    expect(result).toEqual({
      ok: true,
      syncedFields: ['languageModel', 'systemAgent', 'tool'],
      syncedUsers: 2,
    });
    expect(values).toHaveBeenCalledWith([
      { id: 'user-1', ...defaults },
      { id: 'user-2', ...defaults },
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      set: defaults,
      target: expect.anything(),
    });
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'settings.syncUserDefaults',
        payload: {
          operation: 'syncUserGlobalSettingsDefaultsToUsers',
          scope: { forceDefaultAgentMeta: false, target: 'all-users' },
          status: 'success',
          syncedFields: ['languageModel', 'systemAgent', 'tool'],
          syncedUsers: 2,
        },
        resourceType: 'user_settings',
      }),
    );
  });

  it('records explicit force-sync when admin overwrites user default assistant meta', async () => {
    const defaults = {
      defaultAgent: {
        config: { model: 'gpt-5.5', provider: 'newapi' },
        meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
      },
    };
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const selectUsersFrom = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
    const selectSettingsWhere = vi.fn().mockResolvedValue([
      {
        defaultAgent: {
          config: { model: 'old-model', provider: 'old-provider' },
          meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
        },
        id: 'user-1',
      },
    ]);
    const selectSettingsFrom = vi.fn(() => ({ where: selectSettingsWhere }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: selectUsersFrom })
      .mockReturnValueOnce({ from: selectSettingsFrom });
    const db = {
      insert,
      query: {
        appSettings: {
          findFirst: vi.fn().mockResolvedValue({ value: defaults }),
        },
        planCatalog: {
          findFirst: vi.fn().mockResolvedValue({ modelRules: null, plan: Plans.Free }),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
      select,
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.syncUserGlobalSettingsDefaultsToUsers({
      forceDefaultAgentMeta: true,
    });

    expect(result).toEqual({
      forceDefaultAgentMeta: true,
      ok: true,
      syncedFields: ['defaultAgent'],
      syncedUsers: 1,
    });
    expect(values).toHaveBeenCalledWith([
      {
        defaultAgent: {
          config: { model: 'gpt-5.5', provider: 'newapi' },
          meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
        },
        id: 'user-1',
      },
    ]);
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'settings.syncUserDefaults',
        payload: {
          forceDefaultAgentMeta: true,
          operation: 'syncUserGlobalSettingsDefaultsToUsers',
          scope: { forceDefaultAgentMeta: true, target: 'all-users' },
          status: 'success',
          syncedFields: ['defaultAgent'],
          syncedUsers: 1,
        },
        resourceType: 'user_settings',
      }),
    );
  });

  it('preserves user-customized default assistant meta when syncing default agent config', async () => {
    const defaults = {
      defaultAgent: { config: { model: 'gpt-5.5', provider: 'newapi' } },
    };
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const selectUsersFrom = vi.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
    const selectSettingsWhere = vi.fn().mockResolvedValue([
      {
        defaultAgent: {
          config: { model: 'old-model', provider: 'old-provider' },
          meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
        },
        id: 'user-1',
      },
    ]);
    const selectSettingsFrom = vi.fn(() => ({ where: selectSettingsWhere }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: selectUsersFrom })
      .mockReturnValueOnce({ from: selectSettingsFrom });
    const db = { insert, select } as any;

    await expect(syncUserGlobalSettingsDefaultsToUserSettings(db, defaults)).resolves.toEqual({
      syncedFields: ['defaultAgent'],
      syncedUsers: 2,
    });

    expect(values).toHaveBeenCalledWith([
      {
        defaultAgent: {
          config: { model: 'gpt-5.5', provider: 'newapi' },
          meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
        },
        id: 'user-1',
      },
      {
        defaultAgent: { config: { model: 'gpt-5.5', provider: 'newapi' } },
        id: 'user-2',
      },
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      set: {
        defaultAgent: expect.anything(),
      },
      target: expect.anything(),
    });
  });

  it('preserves user default assistant meta when default agent meta sync is not forced', async () => {
    const defaults = {
      defaultAgent: {
        config: { model: 'gpt-5.5', provider: 'newapi' },
        meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
      },
    };
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const selectUsersFrom = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
    const selectSettingsWhere = vi.fn().mockResolvedValue([
      {
        defaultAgent: {
          config: { model: 'old-model', provider: 'old-provider' },
          meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
        },
        id: 'user-1',
      },
    ]);
    const selectSettingsFrom = vi.fn(() => ({ where: selectSettingsWhere }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: selectUsersFrom })
      .mockReturnValueOnce({ from: selectSettingsFrom });
    const db = { insert, select } as any;

    await syncUserGlobalSettingsDefaultsToUserSettings(db, defaults);

    expect(values).toHaveBeenCalledWith([
      {
        defaultAgent: {
          config: { model: 'gpt-5.5', provider: 'newapi' },
          meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
        },
        id: 'user-1',
      },
    ]);
  });

  it('overwrites user default assistant meta when admin sync explicitly forces meta', async () => {
    const defaults = {
      defaultAgent: {
        config: { model: 'gpt-5.5', provider: 'newapi' },
        meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
      },
    };
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const selectUsersFrom = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
    const selectSettingsWhere = vi.fn().mockResolvedValue([
      {
        defaultAgent: {
          config: { model: 'old-model', provider: 'old-provider' },
          meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
        },
        id: 'user-1',
      },
    ]);
    const selectSettingsFrom = vi.fn(() => ({ where: selectSettingsWhere }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: selectUsersFrom })
      .mockReturnValueOnce({ from: selectSettingsFrom });
    const db = { insert, select } as any;

    await syncUserGlobalSettingsDefaultsToUserSettings(db, defaults, {
      forceDefaultAgentMeta: true,
    });

    expect(values).toHaveBeenCalledWith([
      {
        defaultAgent: {
          config: { model: 'gpt-5.5', provider: 'newapi' },
          meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
        },
        id: 'user-1',
      },
    ]);
  });

  it('rejects syncing saved user defaults when enabled input completion model is unavailable', async () => {
    const defaults = {
      systemAgent: {
        inputCompletion: {
          enabled: true,
          model: 'gpt-5.4',
          provider: 'newapi',
        },
      },
    };
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      {
        displayName: 'GPT 5.5 Mini',
        id: 'gpt-5.5-mini',
        providerId: 'newapi',
        type: 'chat',
      } as any,
    ]);
    const insert = vi.fn();
    const db = {
      insert,
      query: {
        appSettings: {
          findFirst: vi.fn().mockResolvedValue({ value: defaults }),
        },
        planCatalog: {
          findFirst: vi.fn().mockResolvedValue({ modelRules: null, plan: Plans.Free }),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
      })),
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(caller.syncUserGlobalSettingsDefaultsToUsers()).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'INPUT_COMPLETION_MODEL_NOT_ENABLED',
    } satisfies Partial<TRPCError>);

    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a NewAPI memory embedding model when the enabled route is not embedding type', async () => {
    vi.mocked(getAllEnabledModels).mockResolvedValue([
      { displayName: 'GPT Chat', id: 'gpt-5.5', type: 'chat' },
    ]);
    const db = createDb({
      appSettings: [null, null],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSettingsBatch({
        updates: [
          {
            key: APP_SETTING_KEYS.memoryUserMemoryEmbeddingProvider,
            value: 'newapi',
          },
          {
            key: APP_SETTING_KEYS.memoryUserMemoryEmbeddingModel,
            value: 'gpt-5.5',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DEFAULT_MODEL_TYPE_MISMATCH',
    } satisfies Partial<TRPCError>);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects invalid S3 endpoint URLs before saving', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.setAppSetting({
        key: APP_SETTING_KEYS.storageS3Endpoint,
        value: 'not-a-url',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: `${APP_SETTING_KEYS.storageS3Endpoint} must be a valid URL`,
    } satisfies Partial<TRPCError>);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('does not contact S3 when the required started audit fails', async () => {
    const startedFailure = new Error('started audit failed');
    vi.mocked(runRequiredAdminAuditExternalEffect).mockRejectedValueOnce(startedFailure);
    const db = createDb({
      appSettingsMany: [
        { key: APP_SETTING_KEYS.storageS3AccessKeyId, value: 'admin-access-key' },
        { key: APP_SETTING_KEYS.storageS3SecretAccessKey, value: 'admin-secret-key' },
        { key: APP_SETTING_KEYS.storageS3Endpoint, value: 'https://s3.example.com' },
        { key: APP_SETTING_KEYS.storageS3Bucket, value: 'admin-bucket' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminSettingsRouter.createCaller({ userId: 'admin-user' } as any).testS3Storage(),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: startedFailure.message });

    expect(S3).not.toHaveBeenCalled();
  });

  it('tests saved S3 storage with CORS, presigned upload, read, and delete checks', async () => {
    const s3Mock = {
      createPreSignedUrl: vi.fn().mockResolvedValue('https://admin-bucket.s3.example.com/upload'),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      getFileContent: vi.fn().mockResolvedValue('comhub-s3-health-check'),
      testConnection: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(S3).mockImplementation(() => s3Mock as any);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            'access-control-allow-headers': 'content-type',
            'access-control-allow-methods': 'GET, PUT, POST, DELETE, HEAD',
            'access-control-allow-origin': 'http://localhost:3210',
          },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            'access-control-allow-origin': 'http://localhost:3210',
          },
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const db = createDb({
      appSettingsMany: [
        { key: APP_SETTING_KEYS.storageS3AccessKeyId, value: 'admin-access-key' },
        { key: APP_SETTING_KEYS.storageS3SecretAccessKey, value: 'admin-secret-key' },
        { key: APP_SETTING_KEYS.storageS3Endpoint, value: 'https://s3.example.com' },
        { key: APP_SETTING_KEYS.storageS3Bucket, value: 'admin-bucket' },
        { key: APP_SETTING_KEYS.storageS3Region, value: 'ap-southeast-1' },
        { key: APP_SETTING_KEYS.storageS3FilePath, value: 'admin-files' },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.testS3Storage();

    expect(result).toMatchObject({
      bucket: 'admin-bucket',
      checks: {
        bucketAccess: { ok: true },
        corsPreflight: {
          allowHeaders: 'content-type',
          allowMethods: 'GET, PUT, POST, DELETE, HEAD',
          allowOrigin: 'http://localhost:3210',
          ok: true,
          status: 200,
        },
        objectDelete: { ok: true },
        objectRead: {
          bytes: 22,
          ok: true,
        },
        presignedUpload: {
          ok: true,
          status: 200,
        },
      },
      endpoint: 'https://s3.example.com',
      filePath: 'admin-files',
      ok: true,
      origin: 'http://localhost:3210',
    });
    expect(S3).toHaveBeenCalledWith(
      'admin-access-key',
      'admin-secret-key',
      'https://s3.example.com',
      {
        bucket: 'admin-bucket',
        forcePathStyle: false,
        previewUrlExpireIn: 7200,
        region: 'ap-southeast-1',
        setAcl: false,
      },
    );
    expect(s3Mock.testConnection).toHaveBeenCalledTimes(1);
    expect(s3Mock.createPreSignedUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^admin-files\/admin-s3-health-check\/.+\.txt$/),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://admin-bucket.s3.example.com/upload',
      expect.objectContaining({
        headers: {
          'Access-Control-Request-Headers': 'content-type',
          'Access-Control-Request-Method': 'PUT',
          'Origin': 'http://localhost:3210',
        },
        method: 'OPTIONS',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://admin-bucket.s3.example.com/upload',
      expect.objectContaining({
        body: 'comhub-s3-health-check',
        headers: {
          'Content-Type': 'text/plain',
          'Origin': 'http://localhost:3210',
        },
        method: 'PUT',
      }),
    );
    expect(s3Mock.getFileContent).toHaveBeenCalledWith(
      expect.stringMatching(/^admin-files\/admin-s3-health-check\/.+\.txt$/),
    );
    expect(s3Mock.deleteFile).toHaveBeenCalledWith(
      expect.stringMatching(/^admin-files\/admin-s3-health-check\/.+\.txt$/),
    );
    expect(runRequiredAdminAuditExternalEffect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ audit: expect.any(Function), effect: expect.any(Function) }),
    );
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'settings.testS3Storage' }),
      expect.objectContaining({ status: 'succeeded' }),
    );
    expect(JSON.stringify(vi.mocked(recordAdminAudit).mock.calls)).not.toContain(
      'admin-secret-key',
    );
  });
});
