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

const createDb = () => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn((payload: unknown) =>
    Array.isArray(payload) ? { onConflictDoUpdate } : Promise.resolve(undefined),
  );
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));

  return {
    __mocks: {
      onConflictDoUpdate,
      set,
      values,
    },
    insert,
    query: {
      planCatalog: {
        findFirst: vi.fn().mockResolvedValue({ plan: Plans.Premium }),
      },
      userPlanSnapshots: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-1' }]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
    update,
  } as any;
};

describe('adminPlansRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('syncs resource quotas to active users when a plan is saved', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    await adminPlansRouter.createCaller({ userId: 'admin-user' } as any).upsert({
      currency: 'CNY',
      displayName: '专业版',
      features: [],
      isActive: true,
      lifetimePrice: 9800,
      monthlyCredits: 5000,
      monthlyPrice: 500,
      oneTimePrice: 4680,
      plan: Plans.Premium,
      sortOrder: 3,
      storageQuotaMb: 512,
      vectorQuota: 1200,
      yearlyPrice: 5000,
    });

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
      expect.objectContaining({ action: 'plan.update', resourceId: Plans.Premium }),
    );
  });
});
