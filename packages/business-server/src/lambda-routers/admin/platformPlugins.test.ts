import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { platformPluginSecrets } from '@/database/schemas';

import { writePlatformPluginAuditLog } from '../../platform-plugins/audit';

import { adminRouter } from './index';

const platformPluginModelMocks = vi.hoisted(() => ({
  setPlanEntitlements: vi.fn(),
  upsertPluginForAdmin: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/platformPlugin', () => ({
  PlatformPluginModel: vi.fn(() => platformPluginModelMocks),
}));

vi.mock('../../platform-plugins/audit', () => ({
  writePlatformPluginAuditLog: vi.fn(),
}));

vi.mock('./audit-router', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminAuditRouter: router({}),
  };
});

vi.mock('./content', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminContentRouter: router({}),
  };
});

vi.mock('./credits', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminCreditsRouter: router({}),
  };
});

vi.mock('./newapiProviders', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminNewapiProvidersRouter: router({}),
  };
});

vi.mock('./orders', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminOrdersRouter: router({}),
  };
});

vi.mock('./plans', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminPlansRouter: router({}),
  };
});

vi.mock('./ppt', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminPptRouter: router({}),
  };
});

vi.mock('./redemption', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminRedemptionRouter: router({}),
  };
});

vi.mock('./referral', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminReferralRouter: router({}),
  };
});

vi.mock('./settings', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminSettingsRouter: router({}),
  };
});

vi.mock('./stats', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminStatsRouter: router({}),
  };
});

vi.mock('./subscriptions', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminSubscriptionsRouter: router({}),
  };
});

vi.mock('./topupPackages', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminTopUpPackagesRouter: router({}),
  };
});

vi.mock('./users', async () => {
  const { router } = await import('@/libs/trpc/lambda');

  return {
    adminUsersRouter: router({}),
  };
});

const pluginId = '00000000-0000-4000-8000-000000000001';

const pluginRow = {
  billing: {},
  category: 'content',
  description: 'Generate a useful artifact.',
  displayName: 'Writer',
  icon: 'FileText',
  id: pluginId,
  metadata: {},
  runtimeType: 'content_generation',
  slug: 'writer',
  sortOrder: 0,
  status: 'draft',
  tags: [],
};

const createDb = ({ role = 'admin' }: { role?: string | null } = {}) => {
  const secrets: Array<Record<string, unknown>> = [];

  const returning = vi.fn().mockResolvedValue([{ id: pluginId, slug: 'writer' }]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
  const values = vi.fn(async (payload: Record<string, unknown>) => {
    if ('secretKey' in payload) {
      secrets.push({
        id: 'secret-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastUsedAt: null,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...payload,
      });
    }
  });
  const insert = vi.fn((table: unknown) => ({
    values: table === platformPluginSecrets ? values : vi.fn().mockResolvedValue(undefined),
  }));

  const db = {
    __mocks: { deleteWhere, returning, secrets, set, values },
    delete: deleteFrom,
    insert,
    query: {
      platformPluginActions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      platformPluginArtifacts: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      platformPluginPlanEntitlements: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      platformPluginRuns: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      platformPluginSecrets: {
        findFirst: vi.fn(async () => secrets[0]),
        findMany: vi.fn(async () => secrets),
      },
      platformPluginVersions: {
        findFirst: vi.fn().mockResolvedValue({ id: 'version-1', version: '1.0.0' }),
      },
      platformPlugins: {
        findFirst: vi.fn().mockResolvedValue(pluginRow),
        findMany: vi.fn().mockResolvedValue([pluginRow]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
      },
    },
    update,
  };

  return db as any;
};

const createAdminCaller = ({ role = 'admin' }: { role?: string | null } = {}) => {
  const db = createDb({ role });
  vi.mocked(getServerDB).mockResolvedValue(db);

  return {
    caller: adminRouter.createCaller({ userId: 'admin-user' } as any),
    db,
  };
};

const createUserCaller = ({ userId = 'user-a' }: { userId?: string } = {}) => {
  const db = createDb({ role: null });
  vi.mocked(getServerDB).mockResolvedValue(db);

  return adminRouter.createCaller({ userId } as any);
};

describe('admin.platformPlugins router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformPluginModelMocks.upsertPluginForAdmin.mockResolvedValue({ id: pluginId, slug: 'writer' });
    platformPluginModelMocks.setPlanEntitlements.mockResolvedValue(undefined);
    process.env.PLATFORM_PLUGIN_SECRET_KEY = '0123456789abcdef0123456789abcdef';
  });

  it('returns masked secret metadata only', async () => {
    const { caller } = createAdminCaller({ role: 'admin' });

    await caller.platformPlugins.upsertSecret({
      key: 'OPENAPI_KEY',
      pluginId,
      value: 'sk_live_123456789',
    });

    const detail = await caller.platformPlugins.get({ pluginIdOrSlug: pluginId });
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain('sk_live_123456789');
    expect(serialized).not.toContain('encryptedValue');
    expect(serialized).toContain('sk_l');
    expect(detail.secrets).toEqual([
      expect.objectContaining({
        configured: true,
        key: 'OPENAPI_KEY',
        maskedValue: 'sk_l**********6789',
      }),
    ]);
  });

  it('rejects non-admin access', async () => {
    const caller = createUserCaller({ userId: 'user-a' });

    await expect(caller.platformPlugins.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('splits metadata, billing, and secret write capabilities', async () => {
    const contentAdmin = createAdminCaller({ role: 'content_admin' }).caller;

    await expect(
      contentAdmin.platformPlugins.upsert({
        billing: {},
        category: 'content',
        description: 'Generate a useful artifact.',
        displayName: 'Writer',
        icon: 'FileText',
        runtimeType: 'content_generation',
        slug: 'writer',
        status: 'draft',
        tags: [],
      }),
    ).resolves.toEqual({ id: pluginId, slug: 'writer' });
    await expect(
      contentAdmin.platformPlugins.upsertBilling({ billing: {}, pluginId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      contentAdmin.platformPlugins.upsertSecret({
        key: 'OPENAPI_KEY',
        pluginId,
        value: 'sk_live_123456789',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const financeAdmin = createAdminCaller({ role: 'finance_admin' }).caller;
    await expect(
      financeAdmin.platformPlugins.upsertBilling({ billing: {}, pluginId }),
    ).resolves.toEqual({ ok: true });
    await expect(
      financeAdmin.platformPlugins.upsert({
        billing: {},
        category: 'content',
        description: 'Generate a useful artifact.',
        displayName: 'Writer',
        icon: 'FileText',
        runtimeType: 'content_generation',
        slug: 'writer',
        status: 'draft',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const systemAdmin = createAdminCaller({ role: 'system_admin' }).caller;
    await expect(
      systemAdmin.platformPlugins.upsertSecret({
        key: 'OPENAPI_KEY',
        pluginId,
        value: 'sk_live_123456789',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        configured: true,
        key: 'OPENAPI_KEY',
        maskedValue: 'sk_l**********6789',
      }),
    );
    await expect(
      systemAdmin.platformPlugins.upsertBilling({ billing: {}, pluginId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('writes platform plugin audit events for mutations', async () => {
    const { caller } = createAdminCaller({ role: 'admin' });

    await caller.platformPlugins.publish({ pluginId });

    expect(writePlatformPluginAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        eventType: 'platform_plugin.published',
        resourceId: pluginId,
        resourceType: 'platformPlugin',
      }),
    );
  });
});
