import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAudit } from './audit';
import { adminNewapiProvidersRouter } from './newapiProviders';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const instanceId = '00000000-0000-4000-8000-000000000001';

const createDbMock = ({
  existingRows = [],
  providerType = 'newapi',
}: {
  existingRows?: Array<{ enabled: boolean; modelId: string; modelType: string }>;
  providerType?: string;
} = {}) => {
  const inserted = { rows: [] as any[], value: undefined as any };

  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((rows: any[] | Record<string, any>) => {
        inserted.value = rows;
        inserted.rows = Array.isArray(rows) ? rows : [rows];

        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([{ id: instanceId }]),
        };
      }),
    })),
    query: {
      adminNewapiInstances: {
        findFirst: vi.fn().mockResolvedValue({
          apiKey: 'sk-test',
          baseUrl: 'https://newapi.example.com',
          groupKey: 'default',
          groupName: 'Default',
          groupMultiplier: null,
          id: instanceId,
          name: 'Default',
          providerType,
          usageScope: null,
        }),
        findMany: vi.fn().mockResolvedValue([
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
        ]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(existingRows),
      })),
    })),
  };

  return { db, inserted };
};

describe('adminNewapiProvidersRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates and lists instances with group routing fields while masking api key', async () => {
    const { db, inserted } = createDbMock();
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

    expect(inserted.value).toEqual(
      expect.objectContaining({
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
    const { db, inserted } = createDbMock();
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);

    await caller.createInstance({
      apiKey: 'sk-test-key',
      baseUrl: 'https://newapi.example.com',
      name: 'Legacy NewAPI',
    } as any);

    expect(inserted.value).toEqual(
      expect.objectContaining({
        providerType: 'newapi',
      }),
    );
  });

  it('syncs fetched models as disabled by default', async () => {
    const { db, inserted } = createDbMock();
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
    expect(inserted.rows).toEqual([
      expect.objectContaining({
        enabled: false,
        instanceId,
        modelId: 'sora-2',
        modelType: 'video',
      }),
    ]);
  });

  it('preserves enabled state when synced model already exists', async () => {
    const { db, inserted } = createDbMock({
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

    expect(inserted.rows[0]).toEqual(
      expect.objectContaining({
        enabled: true,
        modelId: 'flux-pro',
        modelType: 'image',
      }),
    );
  });

  it('does not warn about pricing when the service provider format has no pricing sync', async () => {
    const { db } = createDbMock({ providerType: 'openai-compatible' });
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
        warnings: [],
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
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminNewapiProvidersRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.deleteInstance({
      id: instanceId,
      reason: 'provider retired after outage',
    } as any);

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'newapiInstance.delete',
        payload: { reason: 'provider retired after outage' },
        resourceId: instanceId,
      }),
    );
  });
});
