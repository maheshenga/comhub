import { ADMIN_COMMANDS } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { CommercialModel } from '@/database/models/commercial';

import { recordAdminAudit, recordAdminAuditStrict } from './audit';
import { adminSubscriptionsRouter } from './subscriptions';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
  recordAdminAuditStrict: vi.fn(),
  runRequiredAdminAuditMutation: vi.fn(async (ctx, options) => {
    const result = await ctx.serverDB.transaction((tx: unknown) => options.mutation(tx));
    await recordAdminAudit(ctx, await options.audit(result));
    return result;
  }),
}));

const createDb = () => {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const db = {
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
  db.transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db));

  return db;
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
    expect(recordAdminAuditStrict).toHaveBeenCalledWith(
      expect.objectContaining({ serverDB: db, userId: 'finance-user' }),
      expect.objectContaining({
        action: 'subscription.changeRequest.bulkApprove.item',
        payload: expect.objectContaining({ result: 'succeeded' }),
        resourceId: 'request-1',
      }),
      expect.objectContaining({ correlationId: expect.any(String), status: 'succeeded' }),
    );
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
        reason: ' insufficient evidence ',
        requestIds: ['request-1'],
      }),
    ).resolves.toEqual({ results: [{ ok: true, requestId: 'request-1' }] });

    expect(db.__mocks.updateWhere).toHaveBeenCalled();
    expect(recordAdminAuditStrict).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'subscription.changeRequest.bulkReject.item',
        payload: expect.objectContaining({ result: 'succeeded' }),
      }),
      expect.objectContaining({ correlationId: expect.any(String), status: 'succeeded' }),
    );
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['subscription.changeRequest.bulkReject'].auditAction,
        payload: expect.objectContaining({ reason: 'insufficient evidence' }),
      }),
    );
  });

  it('writes a failed per-target audit while retaining the aggregate bulk result', async () => {
    const activateSubscriptionChangeRequest = vi.fn().mockResolvedValue(undefined);
    vi.mocked(CommercialModel).mockImplementation(
      () => ({ activateSubscriptionChangeRequest }) as any,
    );
    const db = createDb();
    db.query.subscriptionChangeRequests.findFirst
      .mockResolvedValueOnce({ id: 'request-1', status: 'pending', userId: 'target-user' })
      .mockResolvedValueOnce(undefined);
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSubscriptionsRouter.createCaller({ userId: 'finance-user' } as any);
    await expect(
      caller.bulkApproveChangeRequests({
        command: {
          actionId: 'subscription.changeRequest.bulkApprove',
          confirmed: true,
        },
        requestIds: ['request-1', 'missing-request'],
      }),
    ).resolves.toEqual({
      results: [
        { ok: true, requestId: 'request-1' },
        { error: 'NOT_FOUND', ok: false, requestId: 'missing-request' },
      ],
    });

    expect(recordAdminAuditStrict).toHaveBeenCalledTimes(2);
    expect(recordAdminAuditStrict).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ error: 'NOT_FOUND', result: 'failed' }),
        resourceId: 'missing-request',
      }),
      expect.objectContaining({ correlationId: expect.any(String), status: 'failed' }),
    );
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ failed: 1, succeeded: 1, total: 2 }),
      }),
    );
  });

  it('rejects conflicting legacy and envelope reasons before bulk rejection', async () => {
    const db = createDb();
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminSubscriptionsRouter.createCaller({ userId: 'finance-user' } as any);
    await expect(
      caller.bulkRejectChangeRequests({
        command: {
          actionId: 'subscription.changeRequest.bulkReject',
          confirmed: true,
          reason: 'request evidence A',
        },
        reason: 'request evidence B',
        requestIds: ['request-1'],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ADMIN_COMMAND_REASON_MISMATCH',
    });

    expect(db.__mocks.updateWhere).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });
});
