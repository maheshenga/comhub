// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  creditAccounts,
  creditLedgerEntries,
  creditReservations,
  users,
  workspaceCreditAccounts,
  workspaceCreditLedgerEntries,
  workspaces,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppCreditModel } from '../moduleAppCredit';

const USER_ID = 'module-app-credit-user';
const WORKSPACE_ID = 'module-app-credit-workspace';
const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  await serverDB.delete(creditReservations);
  await serverDB.delete(workspaceCreditLedgerEntries);
  await serverDB.delete(workspaceCreditAccounts);
  await serverDB.delete(creditLedgerEntries);
  await serverDB.delete(creditAccounts);
  await serverDB.delete(workspaces);
  await serverDB.delete(users);
  await serverDB.insert(users).values({ id: USER_ID });
  await serverDB.insert(workspaces).values({
    id: WORKSPACE_ID,
    name: 'Module App Credit',
    primaryOwnerId: USER_ID,
    slug: WORKSPACE_ID,
  });
  await serverDB.insert(creditAccounts).values({
    balance: 100,
    totalCredited: 100,
    userId: USER_ID,
  });
});

describe('ModuleAppCreditModel', () => {
  it('creates idempotent user reservations without debiting the account', async () => {
    const model = new ModuleAppCreditModel(serverDB);
    const input = {
      amount: 60,
      idempotencyKey: 'install:run:node',
      payer: { scopeType: 'personal' as const, userId: USER_ID },
    };

    const first = await model.reserve(input);
    const second = await model.reserve(input);

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ amount: 60, status: 'active' });
    await expect(
      serverDB.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, USER_ID) }),
    ).resolves.toMatchObject({ balance: 100, totalDebited: 0 });
    await expect(
      serverDB.query.creditLedgerEntries.findMany({
        where: eq(creditLedgerEntries.userId, USER_ID),
      }),
    ).resolves.toHaveLength(0);
  });

  it('prevents active reservations from exceeding available user balance', async () => {
    const model = new ModuleAppCreditModel(serverDB);
    const results = await Promise.allSettled([
      model.reserve({
        amount: 70,
        idempotencyKey: 'reserve-a',
        payer: { scopeType: 'personal', userId: USER_ID },
      }),
      model.reserve({
        amount: 70,
        idempotencyKey: 'reserve-b',
        payer: { scopeType: 'personal', userId: USER_ID },
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      await serverDB.query.creditReservations.findMany({
        where: and(
          eq(creditReservations.payerScopeType, 'personal'),
          eq(creditReservations.payerUserId, USER_ID),
          eq(creditReservations.status, 'active'),
        ),
      }),
    ).toHaveLength(1);
  });

  it('rejects reservations that exceed the available balance', async () => {
    const model = new ModuleAppCreditModel(serverDB);

    await expect(
      model.reserve({
        amount: 101,
        idempotencyKey: 'insufficient-balance',
        payer: { scopeType: 'personal', userId: USER_ID },
      }),
    ).rejects.toThrow('MODULE_APP_CREDIT_INSUFFICIENT_AVAILABLE_BALANCE');
    await expect(
      serverDB.query.creditReservations.findMany({
        where: eq(creditReservations.payerUserId, USER_ID),
      }),
    ).resolves.toHaveLength(0);
  });

  it('expires stale reservations before checking newly available balance', async () => {
    let now = new Date('2026-07-11T00:00:00.000Z');
    const model = new ModuleAppCreditModel(serverDB, {
      now: () => now,
      reservationTtlMs: 1_000,
    });
    const stale = await model.reserve({
      amount: 80,
      idempotencyKey: 'stale-reservation',
      payer: { scopeType: 'personal', userId: USER_ID },
    });

    now = new Date(now.getTime() + 1_001);
    await expect(
      model.reserve({
        amount: 100,
        idempotencyKey: 'replacement-reservation',
        payer: { scopeType: 'personal', userId: USER_ID },
      }),
    ).resolves.toMatchObject({ amount: 100, status: 'active' });
    await expect(
      serverDB.query.creditReservations.findFirst({
        where: eq(creditReservations.id, stale.id),
      }),
    ).resolves.toMatchObject({ status: 'expired' });
  });

  it('settles once, releases unused credit, and writes one immutable consume entry', async () => {
    const model = new ModuleAppCreditModel(serverDB);
    const reservation = await model.reserve({
      amount: 80,
      idempotencyKey: 'settle-once',
      payer: { scopeType: 'personal', userId: USER_ID },
    });

    const [first, second] = await Promise.all([
      model.settle({ actualAmount: 65, metadata: { runId: 'run-1' }, reservationId: reservation.id }),
      model.settle({ actualAmount: 65, metadata: { runId: 'run-1' }, reservationId: reservation.id }),
    ]);

    expect(second.ledgerEntryId).toBe(first.ledgerEntryId);
    expect(first).toMatchObject({ actualAmount: 65, releasedAmount: 15, status: 'settled' });
    await expect(
      serverDB.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, USER_ID) }),
    ).resolves.toMatchObject({ balance: 35, totalDebited: 65 });
    expect(
      await serverDB.query.creditLedgerEntries.findMany({
        where: and(
          eq(creditLedgerEntries.userId, USER_ID),
          eq(creditLedgerEntries.referenceType, 'module_app_credit_reservation'),
          eq(creditLedgerEntries.referenceId, reservation.id),
          eq(creditLedgerEntries.type, 'consume'),
        ),
      }),
    ).toHaveLength(1);
  });

  it('releases a reservation without debiting the payer', async () => {
    const model = new ModuleAppCreditModel(serverDB);
    const reservation = await model.reserve({
      amount: 80,
      idempotencyKey: 'release-only',
      payer: { scopeType: 'personal', userId: USER_ID },
    });

    await expect(
      model.release({ reason: 'provider_not_started', reservationId: reservation.id }),
    ).resolves.toMatchObject({ releaseReason: 'provider_not_started', status: 'released' });
    await expect(
      serverDB.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, USER_ID) }),
    ).resolves.toMatchObject({ balance: 100, totalDebited: 0 });
  });

  it('funds and settles an authorized workspace account with immutable ledgers', async () => {
    const model = new ModuleAppCreditModel(serverDB);
    await model.transferToWorkspace({
      actorUserId: USER_ID,
      amount: 80,
      idempotencyKey: 'workspace-funding-1',
      workspaceId: WORKSPACE_ID,
    });
    const reservation = await model.reserve({
      amount: 50,
      idempotencyKey: 'workspace-run-1',
      payer: { scopeType: 'workspace', workspaceId: WORKSPACE_ID },
    });
    await model.settle({ actualAmount: 45, metadata: {}, reservationId: reservation.id });

    await expect(
      serverDB.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, USER_ID) }),
    ).resolves.toMatchObject({ balance: 20, totalDebited: 80 });
    await expect(
      serverDB.query.workspaceCreditAccounts.findFirst({
        where: eq(workspaceCreditAccounts.workspaceId, WORKSPACE_ID),
      }),
    ).resolves.toMatchObject({ balance: 35, totalCredited: 80, totalDebited: 45 });
    expect(
      await serverDB.query.workspaceCreditLedgerEntries.findMany({
        where: eq(workspaceCreditLedgerEntries.workspaceId, WORKSPACE_ID),
      }),
    ).toHaveLength(2);
  });
});
