import { ADMIN_COMMANDS } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAudit } from './audit';
import { adminNewapiProvidersRouter } from './newapiProviders';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
  runRequiredAdminAuditMutation: vi.fn(async (ctx, options) => {
    const result = ctx.serverDB.transaction
      ? await ctx.serverDB.transaction((tx: unknown) => options.mutation(tx))
      : await options.mutation(ctx.serverDB);
    await recordAdminAudit(ctx, await options.audit(result));
    return result;
  }),
}));

vi.mock('model-bank', async (importOriginal) => ({
  ...(await importOriginal()),
  LOBE_DEFAULT_MODEL_LIST: [
    {
      id: 'deepseek-v4-pro',
      pricing: {
        units: [{ name: 'textInput', rate: 3, strategy: 'fixed', unit: 'millionTokens' }],
      },
      providerId: 'deepseek',
    },
    {
      id: 'deepseek-v4-pro',
      pricing: {
        units: [{ name: 'textInput', rate: 99, strategy: 'fixed', unit: 'millionTokens' }],
      },
      providerId: 'other-provider',
    },
  ],
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn().mockResolvedValue({
      decrypt: vi.fn(async (value: string) => ({
        plaintext: value === 'bad-cipher' ? '' : value.replace(/^enc:/, ''),
        wasAuthentic: value !== 'bad-cipher',
      })),
      encrypt: vi.fn(async (value: string) => `enc:${value}`),
    }),
  },
}));

const instanceId = '00000000-0000-4000-8000-000000000001';

const createDbMock = ({
  allEnabledModelRows = [],
  existingRows = [],
  findFirstRow,
  findManyRows,
  providerType = 'newapi',
  role = 'admin',
}: {
  allEnabledModelRows?: Array<Record<string, any>>;
  existingRows?: Array<{ enabled: boolean; modelId: string; modelType: string }>;
  findFirstRow?: Record<string, any>;
  findManyRows?: Array<Record<string, any>>;
  providerType?: string;
  role?: string | null;
} = {}) => {
  const writes = {
    conflictConfig: undefined as any,
    insertRows: [] as any[],
    insertValue: undefined as any,
    updateValue: undefined as any,
  };
  const updateWhere = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([{ id: instanceId }]),
  }));
  const updateSet = vi.fn((value: Record<string, any>) => {
    writes.updateValue = value;

    return {
      where: updateWhere,
    };
  });

  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((rows: any[] | Record<string, any>) => {
        writes.insertValue = rows;
        writes.insertRows = Array.isArray(rows) ? rows : [rows];

        return {
          onConflictDoUpdate: vi.fn((config) => {
            writes.conflictConfig = config;
            return Promise.resolve(undefined);
          }),
          returning: vi.fn().mockResolvedValue([{ id: instanceId }]),
        };
      }),
    })),
    query: {
      adminNewapiInstances: {
        findFirst: vi.fn().mockResolvedValue(
          findFirstRow ?? {
            apiKey: 'kv:enc:sk-test',
            baseUrl: 'https://newapi.example.com',
            groupKey: 'default',
            groupName: 'Default',
            groupMultiplier: null,
            id: instanceId,
            name: 'Default',
            providerType,
            usageScope: null,
          },
        ),
        findMany: vi.fn().mockResolvedValue(
          findManyRows ?? [
            {
              apiKey: 'sk-test-key',
              baseUrl: 'https://newapi.example.com',
              groupKey: 'pro',
              groupName: 'Pro Group',
              groupMultiplier: 1.25,
              id: instanceId,
              name: 'NewAPI Pro',
              providerType: 'deepseek',
              usageScope: ['chat', 'image'],
            },
          ],
        ),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(allEnabledModelRows),
          })),
        })),
        where: vi.fn().mockResolvedValue(existingRows),
      })),
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
  };

  return { db, updateSet, updateWhere, writes };
};

describe('adminNewapiProvidersRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and lists instances with group routing fields while masking api key', async () => {
    const { db, writes } = createDbMock();
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.createInstance({
      apiKey: 'sk-test-key',
      baseUrl: 'https://newapi.example.com',
      groupKey: 'pro',
      groupName: 'Pro Group',
      groupMultiplier: 1.25,
      name: 'NewAPI Pro',
      priority: 10,
      providerType: 'deepseek',
      usageScope: ['chat', 'image'],
    } as any);

    expect(writes.insertValue).toEqual(
      expect.objectContaining({
        apiKey: 'kv:enc:sk-test-key',
        groupKey: 'pro',
        groupName: 'Pro Group',
        groupMultiplier: 1.25,
        providerType: 'deepseek',
        usageScope: ['chat', 'image'],
      }),
    );

    const result = await caller.listInstances();

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        apiKey: 'sk-t****-key',
        groupKey: 'pro',
        groupName: 'Pro Group',
        groupMultiplier: 1.25,
        providerType: 'deepseek',
        usageScope: ['chat', 'image'],
      }),
    );
  });

  it('defaults legacy create payloads to the newapi provider type', async () => {
    const { db, writes } = createDbMock();
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.createInstance({
      apiKey: 'sk-test-key',
      baseUrl: 'https://newapi.example.com',
      name: 'Legacy NewAPI',
    } as any);

    expect(writes.insertValue).toEqual(
      expect.objectContaining({
        providerType: 'newapi',
      }),
    );
  });

  it('allows model ops admins to refresh the AI provider runtime cache', async () => {
    const { db } = createDbMock({ role: 'model_ops' });
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    await expect(
      adminNewapiProvidersRouter
        .createCaller({ userId: 'model-ops-user' } as any)
        .refreshRuntimeCache(),
    ).resolves.toEqual(expect.objectContaining({ refreshedAt: expect.any(String) }));
  });

  it('rejects finance admins from mutating AI provider instances', async () => {
    const { db } = createDbMock({ role: 'finance_admin' });
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    await expect(
      adminNewapiProvidersRouter.createCaller({ userId: 'finance-user' } as any).createInstance({
        apiKey: 'sk-test-key',
        baseUrl: 'https://newapi.example.com',
        name: 'Denied Provider',
      } as any),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('forces direct create and update payloads to server-side fetching', async () => {
    const { db, writes } = createDbMock();
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.createInstance({
      apiKey: 'sk-test-key',
      baseUrl: 'https://newapi.example.com',
      fetchOnClient: true,
      name: 'Server-side only',
    } as any);

    expect(writes.insertValue).toEqual(expect.objectContaining({ fetchOnClient: false }));

    await caller.updateInstance({
      data: { fetchOnClient: true },
      id: instanceId,
    } as any);

    expect(writes.updateValue).toEqual(expect.objectContaining({ fetchOnClient: false }));
  });

  it('marks invalid encrypted api keys without breaking the instance list', async () => {
    const { db } = createDbMock({
      findManyRows: [
        {
          apiKey: 'kv:bad-cipher',
          baseUrl: 'https://bad.example.com',
          groupKey: 'default',
          id: 'bad-instance',
          name: 'Bad Instance',
          providerType: 'newapi',
        },
        {
          apiKey: 'kv:enc:sk-good-key',
          baseUrl: 'https://good.example.com',
          groupKey: 'default',
          id: 'good-instance',
          name: 'Good Instance',
          providerType: 'newapi',
        },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.listInstances();

    expect(result.items).toEqual([
      expect.objectContaining({
        apiKey: null,
        apiKeyStatus: 'invalid',
        id: 'bad-instance',
      }),
      expect.objectContaining({
        apiKey: 'sk-g****-key',
        apiKeyStatus: 'ok',
        id: 'good-instance',
      }),
    ]);
  });

  it('backfills legacy plaintext api keys when instances are read', async () => {
    const { db, updateSet } = createDbMock({
      findManyRows: [
        {
          apiKey: 'sk-legacy-key',
          baseUrl: 'https://legacy.example.com',
          groupKey: 'default',
          id: instanceId,
          name: 'Legacy Instance',
          providerType: 'newapi',
        },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.listInstances();

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'kv:enc:sk-legacy-key' }),
    );
  });

  it('decrypts encrypted instance api keys before syncing models', async () => {
    const { db, writes } = createDbMock();
    vi.mocked(getServerDB).mockResolvedValue(db as any);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [{ id: 'gpt-4o-mini', object: 'model' }] }),
        ok: true,
      })
      .mockResolvedValueOnce({
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], success: true }),
        ok: true,
      });
    vi.stubGlobal('fetch', fetchMock);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.syncInstanceModels({ id: instanceId });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://newapi.example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
    expect(writes.insertRows[0]).toEqual(expect.objectContaining({ modelId: 'gpt-4o-mini' }));
  });

  it('returns a readable connection test failure for invalid encrypted api keys', async () => {
    const { db } = createDbMock({
      findFirstRow: {
        apiKey: 'kv:bad-cipher',
        baseUrl: 'https://bad.example.com',
        id: instanceId,
        name: 'Bad Instance',
        providerType: 'newapi',
      },
    });
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(caller.testInstanceConnection({ id: instanceId })).resolves.toEqual(
      expect.objectContaining({
        error: 'Instance API key is invalid. Please reset it before retrying.',
        ok: false,
      }),
    );
  });

  it('syncs fetched models as disabled by default', async () => {
    const { db, writes } = createDbMock();
    vi.mocked(getServerDB).mockResolvedValue(db as any);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ data: [{ id: 'sora-2', object: 'model' }] }),
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ data: [], success: true }),
          ok: true,
        }),
    );

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.syncInstanceModels({ id: instanceId });

    expect(result).toEqual(
      expect.objectContaining({
        importedCount: 1,
        modelsCount: 1,
        ok: true,
      }),
    );
    expect(writes.insertRows).toEqual([
      expect.objectContaining({
        enabled: false,
        instanceId,
        modelId: 'sora-2',
        modelType: 'video',
      }),
    ]);
  });

  it('preserves enabled state when synced model already exists', async () => {
    const { db, writes } = createDbMock({
      existingRows: [{ enabled: true, modelId: 'flux-pro', modelType: 'image' }],
    });
    vi.mocked(getServerDB).mockResolvedValue(db as any);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ data: [{ id: 'flux-pro', object: 'model' }] }),
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ data: [], success: true }),
          ok: true,
        }),
    );

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.syncInstanceModels({ id: instanceId });

    expect(writes.insertRows[0]).toEqual(
      expect.objectContaining({
        enabled: true,
        modelId: 'flux-pro',
        modelType: 'image',
      }),
    );
  });

  it('disables stale synchronized models while retaining manual metadata', async () => {
    const { db, writes } = createDbMock({
      existingRows: [
        {
          displayName: 'Legacy Model',
          enabled: true,
          metadata: { manualAbilities: { vision: true }, syncSource: 'newapi' },
          modelId: 'legacy-model',
          modelType: 'chat',
          sortOrder: 3,
        } as any,
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db as any);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: [] }),
          ok: true,
        })
        .mockResolvedValueOnce({
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: [], success: true }),
          ok: true,
        }),
    );

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.syncInstanceModels({ id: instanceId });

    expect(result).toEqual(expect.objectContaining({ importedCount: 0, staleCount: 1 }));
    expect(writes.insertRows[0]).toEqual(
      expect.objectContaining({
        enabled: false,
        metadata: expect.objectContaining({
          manualAbilities: { vision: true },
          syncStatus: 'stale',
        }),
        modelId: 'legacy-model',
      }),
    );
    expect(writes.conflictConfig.set).toHaveProperty('enabled');
  });

  it('returns pricing source metadata for enabled models', async () => {
    const { db } = createDbMock({
      allEnabledModelRows: [
        {
          baseUrl: 'https://newapi.example.com',
          displayName: 'Priced Chat',
          groupKey: 'default',
          groupName: 'Default',
          instanceId,
          instanceName: 'NewAPI Gateway',
          metadata: { modelRatio: 1, pricingAvailable: true },
          modelId: 'priced-chat',
          modelType: 'chat',
          priority: 0,
          providerType: 'newapi',
        },
        {
          baseUrl: 'https://newapi.example.com',
          displayName: 'Missing Chat',
          groupKey: 'default',
          groupName: 'Default',
          instanceId,
          instanceName: 'NewAPI Gateway',
          metadata: {},
          modelId: 'missing-chat',
          modelType: 'chat',
          priority: 1,
          providerType: 'newapi',
        },
        {
          baseUrl: 'https://deepseek.example.com',
          displayName: 'DeepSeek V4 Pro',
          groupKey: 'default',
          groupName: 'Default',
          instanceId,
          instanceName: 'DeepSeek',
          metadata: {},
          modelId: 'deepseek-v4-pro',
          modelType: 'chat',
          priority: 2,
          providerType: 'deepseek',
        },
        {
          baseUrl: 'https://compatible.example.com',
          displayName: 'Compatible DeepSeek',
          groupKey: 'default',
          groupName: 'Default',
          instanceId,
          instanceName: 'Compatible Gateway',
          metadata: {},
          modelId: 'deepseek-v4-pro',
          modelType: 'chat',
          priority: 3,
          providerType: 'openai-compatible',
        },
      ],
    });
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.getAllEnabledModels();

    expect(result.items).toEqual([
      expect.objectContaining({
        hasModelPricing: true,
        modelId: 'priced-chat',
        pricingSource: 'database',
      }),
      expect.objectContaining({
        hasModelPricing: false,
        modelId: 'missing-chat',
        pricingSource: 'missing',
      }),
      expect.objectContaining({
        hasModelPricing: false,
        modelId: 'deepseek-v4-pro',
        pricingSource: 'model-bank',
        providerType: 'deepseek',
      }),
      expect.objectContaining({
        hasModelPricing: false,
        modelId: 'deepseek-v4-pro',
        pricingSource: 'missing',
        providerType: 'openai-compatible',
      }),
    ]);
  });

  it('warns about manual pricing when the service provider format has no pricing sync', async () => {
    const { db } = createDbMock({ providerType: 'siliconflow' });
    vi.mocked(getServerDB).mockResolvedValue(db as any);
    const fetchMock = vi.fn().mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [{ id: 'gpt-4o-mini', object: 'model' }] }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    const result = await caller.syncInstanceModels({ id: instanceId });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pricingCount: 0,
        warnings: [
          'Pricing sync is not supported for provider type siliconflow. Configure manual pricing in the model billing matrix.',
        ],
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('records the admin supplied reason when deleting an instance', async () => {
    const deleteWhere = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: instanceId }]),
    }));
    const db = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.deleteInstance({
      command: {
        actionId: 'newapiProvider.deleteInstance',
        confirmationText: 'newapiProvider.deleteInstance',
        confirmed: true,
        reason: 'provider retired after outage',
      },
      id: instanceId,
      reason: 'provider retired after outage',
    } as any);

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['newapiProvider.deleteInstance'].auditAction,
        payload: { reason: 'provider retired after outage' },
        resourceId: instanceId,
      }),
    );
  });

  it('rejects conflicting legacy and envelope reasons before deleting an instance', async () => {
    const deleteWhere = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: instanceId }]),
    }));
    const db = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.deleteInstance({
        command: {
          actionId: 'newapiProvider.deleteInstance',
          confirmationText: 'newapiProvider.deleteInstance',
          confirmed: true,
          reason: 'provider evidence A',
        },
        id: instanceId,
        reason: 'provider evidence B',
      } as any),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ADMIN_COMMAND_REASON_MISMATCH',
    });
    expect(db.delete).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });
});
