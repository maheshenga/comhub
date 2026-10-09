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
  recordAdminAuditStrict: vi.fn(async (ctx, entry) => {
    await recordAdminAudit(ctx, entry);
    return { correlationId: entry.payload?.batchCorrelationId, ok: true, status: 'succeeded' };
  }),
  runRequiredAdminAuditMutation: vi.fn(async (ctx, options) => {
    const result = await ctx.serverDB.transaction((tx: unknown) => options.mutation(tx));
    await recordAdminAudit(ctx, await options.audit(result));
    return result;
  }),
}));

describe('adminOrdersRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupSettleCaller = (
    role: string | null = 'admin',
    orderOverrides: Record<string, unknown> = {},
  ) => {
    const settleTopUpOrder = vi.fn().mockResolvedValue({ status: 'paid' });
    vi.mocked(CommercialModel).mockImplementation(function () {
      return { settleTopUpOrder } as any;
    });

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
                provider: 'redemption',
                redemptionCodeId: 'redemption-code-1',
                source: 'redemption',
                userId: 'target-user',
                ...orderOverrides,
              },
            ]),
          })),
        })),
      })),
    };
    (db as any).transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(db),
    );
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    const caller = adminOrdersRouter.createCaller({ userId: `${role}-user` } as any);

    return { caller, settleTopUpOrder };
  };

  const setupStatusMutationCaller = () => {
    const update = vi.fn();
    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'online-order',
                provider: 'alipay',
                redemptionCodeId: null,
                source: 'alipay',
                status: 'pending',
                userId: 'target-user',
              },
            ]),
          })),
        })),
      })),
      update,
    };
    (db as any).transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(db),
    );
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    return {
      caller: adminOrdersRouter.createCaller({ userId: 'finance-user' } as any),
      update,
    };
  };

  it('accepts and records an envelope-only reason when manually settling an order', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller();

    await caller.settle({
      command: {
        actionId: 'order.settle',
        confirmationText: 'order.settle',
        confirmed: true,
        reason: 'manual transfer confirmed by finance',
      },
      orderId: 'order-1',
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
          provider: 'redemption',
          reason: 'manual transfer confirmed by finance',
          source: 'redemption',
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

  it('accepts a normalized legacy reason when the envelope omits it', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller();

    await expect(
      caller.settle({
        command: {
          actionId: 'order.settle',
          confirmationText: 'order.settle',
          confirmed: true,
        },
        orderId: 'order-1',
        reason: '  legacy top-level reason  ',
      } as any),
    ).resolves.toMatchObject({ status: 'paid' });
    expect(settleTopUpOrder).toHaveBeenCalledWith('order-1');
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ reason: 'legacy top-level reason' }),
      }),
    );
  });

  it('rejects conflicting legacy and envelope reasons before settling an order', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller();

    await expect(
      caller.settle({
        command: {
          actionId: 'order.settle',
          confirmationText: 'order.settle',
          confirmed: true,
          reason: 'finance evidence A',
        },
        orderId: 'order-1',
        reason: 'finance evidence B',
      } as any),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ADMIN_COMMAND_REASON_MISMATCH',
    });
    expect(settleTopUpOrder).not.toHaveBeenCalled();
  });

  it('rejects online orders and directs them to provider reconciliation', async () => {
    const { caller, settleTopUpOrder } = setupSettleCaller('finance_admin', {
      provider: 'alipay',
      redemptionCodeId: null,
      source: 'alipay',
    });

    await expect(
      caller.settle({
        command: {
          actionId: 'order.settle',
          confirmationText: 'order.settle',
          confirmed: true,
          reason: 'provider says paid',
        },
        orderId: 'order-1',
      } as any),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ONLINE_PAYMENT_ORDER_REQUIRES_RECONCILIATION',
    });
    expect(settleTopUpOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['cancel', 'order.cancel'],
    ['expire', 'order.expire'],
  ] as const)('rejects online orders before attempting to %s them', async (procedure, actionId) => {
    const { caller, update } = setupStatusMutationCaller();

    await expect(
      caller[procedure]({
        command: { actionId, confirmed: true },
        orderId: 'online-order',
      } as any),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'ONLINE_PAYMENT_ORDER_REQUIRES_RECONCILIATION',
    });
    expect(update).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  // M5 §5.2 批量范式（bulkApprove 模板）：dry-run 只读预检、同事务逐条
  // 处理 + item 审计（batchCorrelationId 贯通）、批级汇总审计。
  const setupBulkCaller = (orderRows: Array<Record<string, unknown>>) => {
    const update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'order-1', userId: 'target-user' }]),
        })),
      })),
    }));
    const selectResult = orderRows;
    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(selectResult),
          })),
          where: vi.fn(() => ({
            for: vi.fn().mockResolvedValue(selectResult),
          })),
        })),
      })),
      update,
    };
    (db as any).transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(db),
    );
    vi.mocked(getServerDB).mockResolvedValue(db as any);

    return {
      caller: adminOrdersRouter.createCaller({
        serverDB: db,
        userId: 'finance-user',
      } as any),
      update,
    };
  };

  describe('bulkCancel / bulkExpire (M5 batch paradigm)', () => {
    const redemptionOrderRow = {
      amount: '19.9',
      currency: 'CNY',
      id: 'order-1',
      provider: 'redemption',
      redemptionCodeId: 'rc-1',
      source: 'redemption',
      status: 'pending',
      userEmail: 'user@example.com',
      userId: 'target-user',
    };

    it('returns a read-only dry-run preview without any writes or audits', async () => {
      const { caller, update } = setupBulkCaller([redemptionOrderRow, { ...redemptionOrderRow, id: 'order-2' }]);

      const result: any = await caller.bulkExpire({
        command: { actionId: 'order.bulkExpire', confirmed: true },
        dryRun: true,
        orderIds: ['order-1', 'order-2', 'missing-order'],
      } as any);

      expect(result.dryRun).toBe(true);
      expect(result.batchCorrelationId).toBeNull();
      expect(result.matched).toBe(2);
      expect(result.unmatchedOrderIds).toEqual(['missing-order']);
      expect(result.results.find((r: any) => r.orderId === 'order-1')).toMatchObject({
        ok: true,
      });
      expect(result.results.find((r: any) => r.orderId === 'missing-order')).toMatchObject({
        error: 'ORDER_NOT_FOUND',
        ok: false,
      });
      expect(update).not.toHaveBeenCalled();
      expect(recordAdminAudit).not.toHaveBeenCalled();
    });

    it('expires a batch in one transaction with per-item audits under one batchCorrelationId', async () => {
      const { caller, update } = setupBulkCaller([
        redemptionOrderRow,
        { ...redemptionOrderRow, id: 'order-2' },
      ]);

      const result = await caller.bulkExpire({
        command: { actionId: 'order.bulkExpire', confirmed: true },
        orderIds: ['order-1', 'order-2'],
      } as any);

      expect(result.dryRun).toBe(false);
      expect(result.batchCorrelationId).toEqual(expect.any(String));
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r: any) => r.ok)).toBe(true);
      expect(update).toHaveBeenCalledTimes(2);
      // 批级汇总审计 + 每单一条 item 审计，均带 batchCorrelationId。
      const auditCalls = vi.mocked(recordAdminAudit).mock.calls;
      const itemAudits = auditCalls.filter(
        ([, entry]: any[]) => entry.action === 'order.bulkExpire.item',
      );
      expect(itemAudits).toHaveLength(2);
      for (const [, entry] of itemAudits as any[]) {
        expect(entry.payload.batchCorrelationId).toBe(result.batchCorrelationId);
        expect(entry.payload.result).toBe('succeeded');
      }
    });

    it('rejects duplicate order ids before mutating anything', async () => {
      const { caller, update } = setupBulkCaller([redemptionOrderRow]);

      await expect(
        caller.bulkExpire({
          command: { actionId: 'order.bulkExpire', confirmed: true },
          orderIds: ['order-1', 'order-1'],
        } as any),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'DUPLICATE_ORDER_IDS' });
      expect(update).not.toHaveBeenCalled();
    });

    it('requires an unconfirmed envelope to be rejected', async () => {
      const { caller } = setupBulkCaller([redemptionOrderRow]);

      await expect(
        caller.bulkExpire({
          command: { actionId: 'order.bulkExpire', confirmed: false },
          orderIds: ['order-1'],
        } as any),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'ADMIN_COMMAND_CONFIRMATION_REQUIRED' });
    });

    it('cancels a batch through bulkCancel with the matching audit action', async () => {
      const { caller } = setupBulkCaller([redemptionOrderRow]);

      const result = await caller.bulkCancel({
        command: { actionId: 'order.bulkCancel', confirmed: true },
        orderIds: ['order-1'],
      } as any);

      expect(result.results[0]).toMatchObject({ ok: true, orderId: 'order-1' });
      const batchAudit = vi
        .mocked(recordAdminAudit)
        .mock.calls.find(([, entry]: any[]) => entry.action === 'order.bulkCancel');
      expect(batchAudit?.[1]).toMatchObject({
        payload: { failed: 0, succeeded: 1, total: 1 },
        resourceType: 'top_up_order',
      });
    });
  });
});
