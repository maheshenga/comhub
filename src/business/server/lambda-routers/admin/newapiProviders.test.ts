import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

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
}: {
  existingRows?: Array<{ enabled: boolean; modelId: string; modelType: string }>;
} = {}) => {
  const inserted = { rows: [] as any[] };

  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((rows: any[]) => {
        inserted.rows = rows;

        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
    query: {
      adminNewapiInstances: {
        findFirst: vi.fn().mockResolvedValue({
          apiKey: 'sk-test',
          baseUrl: 'https://newapi.example.com',
          id: instanceId,
          name: 'Default',
        }),
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
});
