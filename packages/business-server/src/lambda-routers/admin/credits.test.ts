import { ADMIN_COMMANDS } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';

import { recordAdminAudit } from './audit';
import { adminCreditsRouter } from './credits';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createSelectChain = (rows: unknown[]) => ({
  from: vi.fn(() => ({
    where: vi.fn().mockResolvedValue(rows),
  })),
});

describe('adminCreditsRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects wrong typed confirmation before opening a credit transaction', async () => {
    const transaction = vi.fn();
    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
        },
      },
      transaction,
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminCreditsRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.adjust({
        amount: 100,
        command: {
          actionId: 'credits.adjust',
          confirmationText: 'wrong',
          confirmed: true,
          reason: 'manual correction',
        },
        reason: 'manual correction',
        userId: 'target-user',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ADMIN_COMMAND_CONFIRMATION_TEXT_MISMATCH',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it('rejects conflicting legacy and envelope reasons before opening a credit transaction', async () => {
    const transaction = vi.fn();
    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
        },
      },
      transaction,
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminCreditsRouter.createCaller({ userId: 'admin-user' } as any);
    await expect(
      caller.adjust({
        amount: 100,
        command: {
          actionId: 'credits.adjust',
          confirmationText: 'credits.adjust',
          confirmed: true,
          reason: 'finance evidence A',
        },
        reason: 'finance evidence B',
        userId: 'target-user',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ADMIN_COMMAND_REASON_MISMATCH',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it('accepts an envelope-only reason and records before and after credit snapshots', async () => {
    const before = { balance: 200, totalCredited: 500, totalDebited: 300 };
    const after = { balance: 300, totalCredited: 600, totalDebited: 300 };
    const insertLedgerValues = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const insert = vi
      .fn()
      .mockReturnValueOnce({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      })
      .mockReturnValueOnce({
        values: insertLedgerValues,
      });
    const tx = {
      insert,
      select: vi
        .fn()
        .mockReturnValueOnce(createSelectChain([before]))
        .mockReturnValueOnce(createSelectChain([after])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: updateWhere })),
      })),
    } as any;
    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
        },
      },
      transaction: vi.fn(async (handler: (transaction: typeof tx) => Promise<void>) => handler(tx)),
    } as any;
    vi.mocked(getServerDB).mockResolvedValue(db);

    const caller = adminCreditsRouter.createCaller({ userId: 'admin-user' } as any);

    await expect(
      caller.adjust({
        amount: 100,
        command: {
          actionId: 'credits.adjust',
          confirmationText: 'credits.adjust',
          confirmed: true,
          reason: 'manual correction',
        },
        userId: 'target-user',
      }),
    ).resolves.toEqual({ ok: true });

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: ADMIN_COMMANDS['credits.adjust'].auditAction,
        payload: {
          after,
          amount: 100,
          before,
          reason: 'manual correction',
        },
        resourceType: 'credit_account',
        targetUserId: 'target-user',
      }),
    );
  });
});
