import { ADMIN_COMMANDS } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { CommercialModel } from '@/database/models/commercial';

import { recordAdminAudit } from './audit';
import { adminOrdersRouter } from './orders';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/commercial', () => ({
  CommercialModel: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

describe('adminOrdersRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupSettleCaller = (role: string | null = 'admin') => {
    const settleTopUpOrder = vi.fn().mockResolvedValue({ status: 'paid' });
    vi.mocked(CommercialModel).mockImplementation(
      () =>
        ({
          settleTopUpOrder,
        }) as any,
    );

    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                amount: 19.9,
                credits: 199_000_000,
                currency: 'CNY',
                provider: 'manual-bank-transfer',
                source: 'manual',
                userId: 'target-user',
              },
            ]),
          })),
        })),
      })),
    };
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminOrdersRouter.createCaller({ userId: `${role}-user` } as any);

    return { caller, settleTopUpOrder };
  };

  it('records the admin supplied reason when manually settling an order', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller();

    await caller.settle({
      command: {
        actionId: 'order.settle',
        confirmationText: 'order.settle',
        confirmed: true,
        reason: 'manual transfer confirmed by finance',
      },
      orderId: 'order-1',
      reason: 'manual transfer confirmed by finance',
    } as any);

    expect(settleTopUpOrder).toHaveBeenCalledWith('order-1');
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['order.settle'].auditAction,
        payload: {
          amount: 19.9,
          credits: 199_000_000,
          currency: 'CNY',
          provider: 'manual-bank-transfer',
          reason: 'manual transfer confirmed by finance',
          source: 'manual',
          status: 'paid',
        },
        resourceId: 'order-1',
        targetUserId: 'target-user',
      }),
    );
  });

  it('allows a scoped finance admin to manually settle an order', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller('finance_admin');

    await expect(
      caller.settle({
        command: {
          actionId: 'order.settle',
          confirmationText: 'order.settle',
          confirmed: true,
          reason: 'manual transfer confirmed by finance',
        },
        orderId: 'order-1',
        reason: 'manual transfer confirmed by finance',
      } as any),
    ).resolves.toMatchObject({ status: 'paid' });

    expect(settleTopUpOrder).toHaveBeenCalledWith('order-1');
  });

  it('rejects scoped admins without finance write when manually settling an order', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller('content_admin');

    await expect(
      caller.settle({
        command: {
          actionId: 'order.settle',
          confirmationText: 'order.settle',
          confirmed: true,
          reason: 'manual transfer confirmed by finance',
        },
        orderId: 'order-1',
        reason: 'manual transfer confirmed by finance',
      } as any),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(settleTopUpOrder).not.toHaveBeenCalled();
  });

  it('requires a reason when manually settling an order', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller();

    await expect(
      caller.settle({
        command: {
          actionId: 'order.settle',
          confirmationText: 'order.settle',
          confirmed: true,
        },
        orderId: 'order-1',
        reason: 'legacy top-level reason',
      } as any),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ADMIN_COMMAND_REASON_REQUIRED',
    });
    expect(settleTopUpOrder).not.toHaveBeenCalled();
  });
});
