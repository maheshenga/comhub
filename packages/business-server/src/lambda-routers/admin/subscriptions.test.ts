import { ADMIN_COMMANDS } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { CommercialModel } from '@/database/models/commercial';

import { recordAdminAudit } from './audit';
import { adminSubscriptionsRouter } from './subscriptions';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createDb = () => {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  return {
    __mocks: { updateWhere },
    query: {
      subscriptionChangeRequests: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          status: 'pending',
          userId: 'target-user',
        }),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: updateWhere })),
    })),
  } as any;
};

describe('adminSubscriptionsRouter bulk commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('keeps bulk approval behavior behind a valid shared command envelope', async () => {
    const activateSubscriptionChangeRequest = vi.fn().mockResolvedValue(undefined);
    vi.mocked(CommercialModel).mockImplementation(
      () => ({ activateSubscriptionChangeRequest }) as any,
    );
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSubscriptionsRouter.createCaller({ userId: 'finance-user' } as any);
    await expect(
      caller.bulkApproveChangeRequests({
        command: {
          actionId: 'subscription.changeRequest.bulkApprove',
          confirmed: true,
        },
        requestIds: ['request-1'],
      }),
    ).resolves.toEqual({ results: [{ ok: true, requestId: 'request-1' }] });

    expect(activateSubscriptionChangeRequest).toHaveBeenCalledWith('request-1');
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['subscription.changeRequest.bulkApprove'].auditAction,
      }),
    );
  });

  it('uses the sanitized optional command reason for bulk rejection audit', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSubscriptionsRouter.createCaller({ userId: 'finance-user' } as any);
    await expect(
      caller.bulkRejectChangeRequests({
        command: {
          actionId: 'subscription.changeRequest.bulkReject',
          confirmed: true,
          reason: '  insufficient evidence  ',
        },
        reason: 'legacy reason',
        requestIds: ['request-1'],
      }),
    ).resolves.toEqual({ results: [{ ok: true, requestId: 'request-1' }] });

    expect(db.__mocks.updateWhere).toHaveBeenCalled();
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['subscription.changeRequest.bulkReject'].auditAction,
        payload: expect.objectContaining({ reason: 'insufficient evidence' }),
      }),
    );
  });
});
