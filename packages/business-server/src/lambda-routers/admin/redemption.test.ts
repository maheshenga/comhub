import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAudit } from './audit';
import { adminRedemptionRouter } from './redemption';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

describe('adminRedemptionRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('records the admin supplied reason when bulk deleting redemption codes', async () => {
    const db = {
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'code-1' }]),
        })),
      })),
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'admin' }),
        },
      },
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminRedemptionRouter.createCaller({ userId: 'admin-user' } as any);
    await caller.bulkDelete({
      ids: ['code-1', 'code-2'],
      reason: 'compromised promotional batch',
    } as any);

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'redemption.bulkDelete',
        payload: {
          deleted: 1,
          reason: 'compromised promotional batch',
          requested: 2,
        },
        resourceType: 'redemption_code',
      }),
    );
  });
});
