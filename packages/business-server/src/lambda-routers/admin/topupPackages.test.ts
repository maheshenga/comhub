import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAudit } from './audit';
import { adminTopUpPackagesRouter } from './topupPackages';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createDb = () => {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));

  return {
    __mocks: { set, values },
    insert,
    query: {
      topUpPackages: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'growth',
          metadata: { keep: 'yes' },
        }),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
      },
    },
    update,
  } as any;
};

describe('adminTopUpPackagesRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('saves promotion metadata when a top-up package is saved', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    await adminTopUpPackagesRouter.createCaller({ userId: 'admin-user' } as any).upsert({
      amount: 20,
      credits: 1_000_000,
      currency: 'USD',
      displayName: 'Growth',
      id: 'growth',
      isActive: true,
      originalAmount: 30,
      promotionEnabled: true,
      promotionLabel: 'Limited offer',
      promotionNote: 'Valid for 6 months',
      recommended: true,
      sortOrder: 1,
      validityMonths: 6,
    } as any);

    expect(db.__mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          keep: 'yes',
          originalAmount: 30,
          promotionEnabled: true,
          promotionLabel: 'Limited offer',
          promotionNote: 'Valid for 6 months',
        }),
      }),
    );
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'topupPackage.update', resourceId: 'growth' }),
    );
  });
});
