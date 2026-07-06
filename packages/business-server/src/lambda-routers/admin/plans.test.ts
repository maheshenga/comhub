import { Plans } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAudit } from './audit';
import { adminPlansRouter } from './plans';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createDb = ({
  activePlanSnapshot = undefined,
  planCatalogRow = { plan: Plans.Premium },
  planRedemptionCode = undefined,
  role = 'admin',
}: {
  activePlanSnapshot?: { id: string };
  planCatalogRow?: Record<string, unknown> | null;
  planRedemptionCode?: { id: string };
  role?: string | null;
} = {}) => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn((payload: unknown) =>
    Array.isArray(payload) ? { onConflictDoUpdate } : Promise.resolve(undefined),
  );
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn(() => ({ where }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));

  return {
    __mocks: {
      onConflictDoUpdate,
      set,
      values,
    },
    delete: deleteFrom,
    insert,
    query: {
      planCatalog: {
        findFirst: vi.fn().mockResolvedValue(planCatalogRow),
      },
      redemptionCodes: {
        findFirst: vi.fn().mockResolvedValue(planRedemptionCode),
      },
      userPlanSnapshots: {
        findFirst: vi.fn().mockResolvedValue(activePlanSnapshot),
        findMany: vi
          .fn()
          .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-1' }]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
      },
    },
    update,
  } as any;
};

describe('adminPlansRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('blocks deleting a plan with active user snapshots', async () => {
    const db = createDb({ activePlanSnapshot: { id: 'snapshot-1' } });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminPlansRouter.createCaller({ userId: 'admin-user' } as any).delete({
        plan: Plans.Premium,
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    expect(db.delete).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it('deletes a plan without active user snapshots', async () => {
    const db = createDb({ activePlanSnapshot: undefined });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminPlansRouter.createCaller({ userId: 'admin-user' } as any).delete({
        plan: Plans.Premium,
      }),
    ).resolves.toEqual({ ok: true });

    expect(db.delete).toHaveBeenCalled();
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'plan.delete',
        payload: expect.objectContaining({
          after: null,
          before: expect.objectContaining({ plan: Plans.Premium }),
        }),
        resourceId: Plans.Premium,
      }),
    );
  });

  it('blocks deleting a plan referenced by redemption codes', async () => {
    const db = createDb({ planRedemptionCode: { id: 'code-1' } });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminPlansRouter.createCaller({ userId: 'admin-user' } as any).delete({
        plan: Plans.Premium,
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    expect(db.delete).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it('syncs resource quotas to active users when a plan is saved', async () => {
    const existingPlan = {
      currency: 'CNY',
      displayName: 'Old Premium',
      features: ['old feature'],
      isActive: true,
      metadata: { storageQuotaMb: 256, vectorQuota: 600 },
      modelRules: null,
      monthlyCredits: 1000,
      monthlyPrice: 100,
      plan: Plans.Premium,
      sortOrder: 2,
      yearlyPrice: 1000,
    };
    const db = createDb({ planCatalogRow: existingPlan });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await adminPlansRouter.createCaller({ userId: 'admin-user' } as any).upsert({
      currency: 'CNY',
      displayName: 'Premium',
      features: [],
      isActive: true,
      lifetimePrice: 9800,
      monthlyCredits: 5000,
      monthlyPrice: 500,
      oneTimePrice: 4680,
      plan: Plans.Premium,
      badge: 'Popular',
      sortOrder: 3,
      storageQuotaMb: 512,
      vectorQuota: 1200,
      yearlyDiscountLabel: '优惠 20%',
      comparisonNote: '包含高阶模型',
      yearlyPrice: 5000,
    } as any);

    expect(db.__mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          badge: 'Popular',
          comparisonNote: '包含高阶模型',
          storageQuotaMb: 512,
          vectorQuota: 1200,
          yearlyDiscountLabel: '优惠 20%',
        }),
      }),
    );

    const quotaPayload = db.__mocks.values.mock.calls.find(([payload]: [unknown]) =>
      Array.isArray(payload),
    )?.[0] as Array<Record<string, unknown>>;

    expect(quotaPayload).toEqual([
      expect.objectContaining({
        storageQuota: 512 * 1024 * 1024,
        userId: 'user-1',
        vectorQuota: 1200,
      }),
      expect.objectContaining({
        storageQuota: 512 * 1024 * 1024,
        userId: 'user-2',
        vectorQuota: 1200,
      }),
    ]);
    expect(db.__mocks.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          storageQuota: 512 * 1024 * 1024,
          vectorQuota: 1200,
        }),
      }),
    );
    expect(db.__mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          lifetimePrice: 9800,
          oneTimePrice: 4680,
          storageQuotaMb: 512,
          vectorQuota: 1200,
        }),
      }),
    );
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'plan.update',
        payload: expect.objectContaining({
          activeUserCount: 2,
          after: expect.objectContaining({
            displayName: 'Premium',
            metadata: expect.objectContaining({
              badge: 'Popular',
              comparisonNote: expect.any(String),
              storageQuotaMb: 512,
              vectorQuota: 1200,
              yearlyDiscountLabel: expect.any(String),
            }),
            monthlyCredits: 5000,
            plan: Plans.Premium,
          }),
          before: expect.objectContaining({
            displayName: 'Old Premium',
            metadata: { storageQuotaMb: 256, vectorQuota: 600 },
            plan: Plans.Premium,
          }),
          quotaUpdate: expect.objectContaining({
            storageQuota: 512 * 1024 * 1024,
            vectorQuota: 1200,
          }),
        }),
        resourceId: Plans.Premium,
      }),
    );
  });

  it('allows a scoped finance admin to save plans', async () => {
    const db = createDb({ role: 'finance_admin' });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminPlansRouter.createCaller({ userId: 'finance-user' } as any).upsert({
        currency: 'CNY',
        displayName: 'Premium',
        features: [],
        isActive: true,
        monthlyCredits: 5000,
        monthlyPrice: 500,
        plan: Plans.Premium,
        sortOrder: 3,
        yearlyPrice: 5000,
      } as any),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects model ops admins from saving plans', async () => {
    const db = createDb({ role: 'model_ops' });
    vi.mocked(getServerDB).mockResolvedValue(db);

    await expect(
      adminPlansRouter.createCaller({ userId: 'model-ops-user' } as any).upsert({
        currency: 'CNY',
        displayName: 'Premium',
        features: [],
        isActive: true,
        monthlyCredits: 5000,
        monthlyPrice: 500,
        plan: Plans.Premium,
        sortOrder: 3,
        yearlyPrice: 5000,
      } as any),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
