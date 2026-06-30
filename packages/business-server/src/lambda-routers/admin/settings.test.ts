import { Plans } from '@lobechat/types';
import type { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';

import { DEFAULT_COMHUB_AGENT_AVATAR, DEFAULT_COMHUB_AGENT_NAME } from '@/const/defaultAgent';
import { getServerDB } from '@/database/core/db-adaptor';
import { getResolvedServerDefaultAgentConfig } from '@/server/globalConfig';
import { invalidateFileS3RuntimeCache, S3 } from '@/server/modules/S3';
import { APP_SETTING_KEYS } from '@/server/services/appSettings';
import { getAllEnabledModels } from '@/server/services/newapiInstance';

import { syncExpiredSubscriptionsToFree } from '../../subscriptionMaintenance';
import { recordAdminAudit } from './audit';
import {
  adminSettingsRouter,
  buildUserGlobalSettingsSyncValues,
  validateDefaultAgentModelUsability,
} from './settings';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/server/services/newapiInstance', () => ({
  getAllEnabledModels: vi.fn(),
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
}));

vi.mock('../../subscriptionMaintenance', () => ({
  syncExpiredSubscriptionsToFree: vi.fn(),
}));

const createDb = ({
  appSettings = [],
  appSettingsMany = [],
  modelRules = null,
}: {
  appSettings?: Array<{ value: unknown } | null>;
  appSettingsMany?: Array<{ key: string; value: unknown }>;
  modelRules?: any;
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
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
  } as any;
};

describe('admin settings default model validation', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
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
    expect(settings.pricingCreditMultiplier).toBe(DEFAULT_PRICING_CREDIT_MULTIPLIER);
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
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSettingsRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.runMaintenance();

    expect(result.notificationsDeleted).toBe(2);
    expect(result.notificationRetentionCutoff).toBeTruthy();
    expect(deleteMock).toHaveBeenCalledTimes(2);
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
    expect(db.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.storageS3SecretAccessKey,
      value: 'admin-secret-key',
    });
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
    expect(tx.__mocks.values).toHaveBeenCalledWith({
      key: APP_SETTING_KEYS.storageS3SecretAccessKey,
      value: 'admin-secret-key',
    });
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
          syncedFields: ['languageModel', 'systemAgent', 'tool'],
          syncedUsers: 2,
        },
        resourceType: 'user_settings',
      }),
    );
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
      { displayName: 'GPT 5.5 Mini', id: 'gpt-5.5-mini', providerId: 'newapi', type: 'chat' } as any,
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
  });
});
