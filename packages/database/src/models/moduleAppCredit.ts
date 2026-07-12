import type { ModuleAppBillingPayer } from '@lobechat/types';
import { moduleAppBillingPayerSchema } from '@lobechat/types';
import { and, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';

import {
  creditAccounts,
  creditLedgerEntries,
  creditReservations,
  workspaceCreditAccounts,
  workspaceCreditLedgerEntries,
  workspaceMembers,
  workspaces,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1000;
const MAX_CREDIT_AMOUNT = 1_000_000_000_000;

type ModuleAppCreditModelOptions = {
  now?: () => Date;
  reservationTtlMs?: number;
};

const assertAmount = (amount: number, allowZero = false) => {
  if (
    !Number.isFinite(amount) ||
    amount < (allowZero ? 0 : 0.000001) ||
    amount > MAX_CREDIT_AMOUNT
  ) {
    throw new Error('MODULE_APP_CREDIT_AMOUNT_INVALID');
  }
};

const payerWhere = (payer: ModuleAppBillingPayer) =>
  payer.scopeType === 'personal'
    ? and(
        eq(creditReservations.payerScopeType, 'personal'),
        eq(creditReservations.payerUserId, payer.userId),
        isNull(creditReservations.payerWorkspaceId),
      )
    : and(
        eq(creditReservations.payerScopeType, 'workspace'),
        eq(creditReservations.payerWorkspaceId, payer.workspaceId),
        isNull(creditReservations.payerUserId),
      );

export class ModuleAppCreditModel {
  private readonly now: () => Date;
  private readonly reservationTtlMs: number;

  constructor(
    private readonly db: LobeChatDatabase,
    options: ModuleAppCreditModelOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.reservationTtlMs = options.reservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS;
    if (this.reservationTtlMs < 1_000 || this.reservationTtlMs > 24 * 60 * 60 * 1000) {
      throw new Error('MODULE_APP_CREDIT_RESERVATION_TTL_INVALID');
    }
  }

  private assertReservationIdentity = (
    reservation: typeof creditReservations.$inferSelect,
    input: { amount: number; payer: ModuleAppBillingPayer },
  ) => {
    const samePayer =
      input.payer.scopeType === 'personal'
        ? reservation.payerScopeType === 'personal' &&
          reservation.payerUserId === input.payer.userId &&
          reservation.payerWorkspaceId === null
        : reservation.payerScopeType === 'workspace' &&
          reservation.payerWorkspaceId === input.payer.workspaceId &&
          reservation.payerUserId === null;
    if (!samePayer || reservation.amount !== input.amount) {
      throw new Error('MODULE_APP_CREDIT_IDEMPOTENCY_CONFLICT');
    }
  };

  private expireReservations = async (
    tx: Transaction,
    payer: ModuleAppBillingPayer,
    now: Date,
  ) => {
    await tx
      .update(creditReservations)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          payerWhere(payer),
          eq(creditReservations.status, 'active'),
          sql`${creditReservations.expiresAt} <= ${now}`,
        ),
      );
  };

  private getActiveReservedAmount = async (
    tx: Transaction,
    payer: ModuleAppBillingPayer,
    now: Date,
    excludedReservationId?: string,
  ) => {
    const [row] = await tx
      .select({ amount: sql<number>`COALESCE(SUM(${creditReservations.amount}), 0)` })
      .from(creditReservations)
      .where(
        and(
          payerWhere(payer),
          eq(creditReservations.status, 'active'),
          gt(creditReservations.expiresAt, now),
          excludedReservationId
            ? sql`${creditReservations.id} <> ${excludedReservationId}`
            : undefined,
        ),
      );
    return Number(row?.amount ?? 0);
  };

  private lockPayerAccount = async (tx: Transaction, payer: ModuleAppBillingPayer) => {
    if (payer.scopeType === 'personal') {
      await tx.insert(creditAccounts).values({ userId: payer.userId }).onConflictDoNothing();
      const [account] = await tx
        .select({ balance: creditAccounts.balance })
        .from(creditAccounts)
        .where(eq(creditAccounts.userId, payer.userId))
        .for('update');
      if (!account) throw new Error('MODULE_APP_CREDIT_ACCOUNT_NOT_FOUND');
      return account;
    }

    const [account] = await tx
      .select({ balance: workspaceCreditAccounts.balance })
      .from(workspaceCreditAccounts)
      .where(eq(workspaceCreditAccounts.workspaceId, payer.workspaceId))
      .for('update');
    if (!account) throw new Error('MODULE_APP_WORKSPACE_CREDIT_ACCOUNT_NOT_FUNDED');
    return account;
  };

  reserve = async (input: {
    amount: number;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    payer: ModuleAppBillingPayer;
  }) => {
    assertAmount(input.amount);
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 240) {
      throw new Error('MODULE_APP_CREDIT_IDEMPOTENCY_KEY_INVALID');
    }
    const payer = moduleAppBillingPayerSchema.parse(input.payer);

    return this.db.transaction(async (tx) => {
      const existingBeforeLock = await tx.query.creditReservations.findFirst({
        where: eq(creditReservations.idempotencyKey, input.idempotencyKey),
      });
      if (existingBeforeLock) {
        this.assertReservationIdentity(existingBeforeLock, { amount: input.amount, payer });
        return existingBeforeLock;
      }

      const account = await this.lockPayerAccount(tx, payer);
      const existing = await tx.query.creditReservations.findFirst({
        where: eq(creditReservations.idempotencyKey, input.idempotencyKey),
      });
      if (existing) {
        this.assertReservationIdentity(existing, { amount: input.amount, payer });
        return existing;
      }

      const now = this.now();
      await this.expireReservations(tx, payer, now);
      const reservedAmount = await this.getActiveReservedAmount(tx, payer, now);
      if (account.balance - reservedAmount < input.amount) {
        throw new Error('MODULE_APP_CREDIT_INSUFFICIENT_AVAILABLE_BALANCE');
      }

      const [reservation] = await tx
        .insert(creditReservations)
        .values({
          amount: input.amount,
          expiresAt: new Date(now.getTime() + this.reservationTtlMs),
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata ?? {},
          payerScopeType: payer.scopeType,
          payerUserId: payer.scopeType === 'personal' ? payer.userId : null,
          payerWorkspaceId: payer.scopeType === 'workspace' ? payer.workspaceId : null,
        })
        .returning();
      if (!reservation) throw new Error('MODULE_APP_CREDIT_RESERVATION_CREATE_FAILED');
      return reservation;
    });
  };

  settle = async (input: {
    actualAmount: number;
    metadata: Record<string, unknown>;
    reservationId: string;
  }) => {
    assertAmount(input.actualAmount, true);

    return this.db.transaction(async (tx) => {
      const initial = await tx.query.creditReservations.findFirst({
        where: eq(creditReservations.id, input.reservationId),
      });
      if (!initial) throw new Error('MODULE_APP_CREDIT_RESERVATION_NOT_FOUND');
      const payer = moduleAppBillingPayerSchema.parse(
        initial.payerScopeType === 'personal'
          ? { scopeType: 'personal', userId: initial.payerUserId }
          : { scopeType: 'workspace', workspaceId: initial.payerWorkspaceId },
      );
      const account = await this.lockPayerAccount(tx, payer);
      const [reservation] = await tx
        .select()
        .from(creditReservations)
        .where(eq(creditReservations.id, input.reservationId))
        .for('update');
      if (!reservation) throw new Error('MODULE_APP_CREDIT_RESERVATION_NOT_FOUND');
      if (reservation.status === 'settled') {
        return {
          ...reservation,
          ledgerEntryId: reservation.settlementLedgerEntryId!,
        };
      }
      if (reservation.status !== 'active') {
        throw new Error('MODULE_APP_CREDIT_RESERVATION_NOT_SETTLEABLE');
      }

      const now = this.now();
      if (reservation.expiresAt <= now) {
        await tx
          .update(creditReservations)
          .set({ status: 'expired', updatedAt: now })
          .where(eq(creditReservations.id, reservation.id));
        throw new Error('MODULE_APP_CREDIT_RESERVATION_EXPIRED');
      }
      const reservedByOthers = await this.getActiveReservedAmount(
        tx,
        payer,
        now,
        reservation.id,
      );
      if (account.balance - reservedByOthers < input.actualAmount) {
        throw new Error('MODULE_APP_CREDIT_INSUFFICIENT_AVAILABLE_BALANCE');
      }

      let ledgerEntryId: string;
      let balanceAfter: number;
      if (payer.scopeType === 'personal') {
        const [updatedAccount] = await tx
          .update(creditAccounts)
          .set({
            balance: sql`${creditAccounts.balance} - ${input.actualAmount}`,
            totalDebited: sql`${creditAccounts.totalDebited} + ${input.actualAmount}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(creditAccounts.userId, payer.userId),
              gte(creditAccounts.balance, input.actualAmount),
            ),
          )
          .returning({ balance: creditAccounts.balance });
        if (!updatedAccount) throw new Error('MODULE_APP_CREDIT_SETTLEMENT_FAILED');
        balanceAfter = updatedAccount.balance;
        const [ledger] = await tx
          .insert(creditLedgerEntries)
          .values({
            amount: -input.actualAmount,
            balanceAfter,
            description: 'Module App reserved usage settlement',
            metadata: { ...reservation.metadata, ...input.metadata, reservedAmount: reservation.amount },
            referenceId: reservation.id,
            referenceType: 'module_app_credit_reservation',
            title: 'Module App Usage',
            type: 'consume',
            userId: payer.userId,
          })
          .returning({ id: creditLedgerEntries.id });
        if (!ledger) throw new Error('MODULE_APP_CREDIT_LEDGER_CREATE_FAILED');
        ledgerEntryId = ledger.id;
      } else {
        const [updatedAccount] = await tx
          .update(workspaceCreditAccounts)
          .set({
            balance: sql`${workspaceCreditAccounts.balance} - ${input.actualAmount}`,
            totalDebited: sql`${workspaceCreditAccounts.totalDebited} + ${input.actualAmount}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(workspaceCreditAccounts.workspaceId, payer.workspaceId),
              gte(workspaceCreditAccounts.balance, input.actualAmount),
            ),
          )
          .returning({ balance: workspaceCreditAccounts.balance });
        if (!updatedAccount) throw new Error('MODULE_APP_CREDIT_SETTLEMENT_FAILED');
        balanceAfter = updatedAccount.balance;
        const [ledger] = await tx
          .insert(workspaceCreditLedgerEntries)
          .values({
            amount: -input.actualAmount,
            balanceAfter,
            description: 'Module App reserved usage settlement',
            metadata: { ...reservation.metadata, ...input.metadata, reservedAmount: reservation.amount },
            referenceId: reservation.id,
            referenceType: 'module_app_credit_reservation',
            title: 'Module App Usage',
            type: 'consume',
            workspaceId: payer.workspaceId,
          })
          .returning({ id: workspaceCreditLedgerEntries.id });
        if (!ledger) throw new Error('MODULE_APP_CREDIT_LEDGER_CREATE_FAILED');
        ledgerEntryId = ledger.id;
      }

      const releasedAmount = Math.max(0, reservation.amount - input.actualAmount);
      const [settled] = await tx
        .update(creditReservations)
        .set({
          actualAmount: input.actualAmount,
          metadata: { ...reservation.metadata, ...input.metadata },
          releasedAmount,
          settledAt: now,
          settlementLedgerEntryId: ledgerEntryId,
          status: 'settled',
          updatedAt: now,
        })
        .where(eq(creditReservations.id, reservation.id))
        .returning();
      if (!settled) throw new Error('MODULE_APP_CREDIT_RESERVATION_SETTLEMENT_FAILED');
      return { ...settled, balanceAfter, ledgerEntryId };
    });
  };

  release = async (input: { reason: string; reservationId: string }) => {
    if (!input.reason.trim() || input.reason.length > 240) {
      throw new Error('MODULE_APP_CREDIT_RELEASE_REASON_INVALID');
    }
    return this.db.transaction(async (tx) => {
      const initial = await tx.query.creditReservations.findFirst({
        where: eq(creditReservations.id, input.reservationId),
      });
      if (!initial) throw new Error('MODULE_APP_CREDIT_RESERVATION_NOT_FOUND');
      const payer = moduleAppBillingPayerSchema.parse(
        initial.payerScopeType === 'personal'
          ? { scopeType: 'personal', userId: initial.payerUserId }
          : { scopeType: 'workspace', workspaceId: initial.payerWorkspaceId },
      );
      await this.lockPayerAccount(tx, payer);
      const [reservation] = await tx
        .select()
        .from(creditReservations)
        .where(eq(creditReservations.id, input.reservationId))
        .for('update');
      if (!reservation) throw new Error('MODULE_APP_CREDIT_RESERVATION_NOT_FOUND');
      if (reservation.status === 'released' || reservation.status === 'expired') return reservation;
      if (reservation.status !== 'active') {
        throw new Error('MODULE_APP_CREDIT_RESERVATION_NOT_RELEASABLE');
      }
      const now = this.now();
      const [released] = await tx
        .update(creditReservations)
        .set({
          releaseReason: input.reason,
          releasedAmount: reservation.amount,
          releasedAt: now,
          status: 'released',
          updatedAt: now,
        })
        .where(eq(creditReservations.id, reservation.id))
        .returning();
      if (!released) throw new Error('MODULE_APP_CREDIT_RESERVATION_RELEASE_FAILED');
      return released;
    });
  };

  transferToWorkspace = async (input: {
    actorUserId: string;
    amount: number;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    workspaceId: string;
  }) => {
    assertAmount(input.amount);
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 240) {
      throw new Error('MODULE_APP_CREDIT_IDEMPOTENCY_KEY_INVALID');
    }
    return this.db.transaction(async (tx) => {
      const workspace = await tx.query.workspaces.findFirst({
        columns: { id: true, primaryOwnerId: true },
        where: eq(workspaces.id, input.workspaceId),
      });
      if (!workspace) throw new Error('MODULE_APP_WORKSPACE_CREDIT_TRANSFER_DENIED');

      if (workspace.primaryOwnerId !== input.actorUserId) {
        const membership = await tx.query.workspaceMembers.findFirst({
          columns: { userId: true },
          where: and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.actorUserId),
            inArray(workspaceMembers.role, ['owner', 'admin']),
            isNull(workspaceMembers.deletedAt),
          ),
        });
        if (!membership) throw new Error('MODULE_APP_WORKSPACE_CREDIT_TRANSFER_DENIED');
      }

      await tx.insert(creditAccounts).values({ userId: input.actorUserId }).onConflictDoNothing();
      const [userAccount] = await tx
        .select({ balance: creditAccounts.balance })
        .from(creditAccounts)
        .where(eq(creditAccounts.userId, input.actorUserId))
        .for('update');
      if (!userAccount) throw new Error('MODULE_APP_CREDIT_ACCOUNT_NOT_FOUND');

      const existing = await tx.query.creditLedgerEntries.findFirst({
        where: and(
          eq(creditLedgerEntries.userId, input.actorUserId),
          eq(creditLedgerEntries.referenceType, 'module_app_workspace_transfer'),
          eq(creditLedgerEntries.referenceId, input.idempotencyKey),
          eq(creditLedgerEntries.type, 'consume'),
        ),
      });
      if (existing) {
        const workspaceLedger = await tx.query.workspaceCreditLedgerEntries.findFirst({
          where: and(
            eq(workspaceCreditLedgerEntries.workspaceId, input.workspaceId),
            eq(workspaceCreditLedgerEntries.referenceType, 'module_app_workspace_transfer'),
            eq(workspaceCreditLedgerEntries.referenceId, input.idempotencyKey),
            eq(workspaceCreditLedgerEntries.type, 'funding'),
          ),
        });
        if (!workspaceLedger || existing.amount !== -input.amount) {
          throw new Error('MODULE_APP_CREDIT_IDEMPOTENCY_CONFLICT');
        }
        return { userLedgerEntryId: existing.id, workspaceLedgerEntryId: workspaceLedger.id };
      }

      const now = this.now();
      const [debited] = await tx
        .update(creditAccounts)
        .set({
          balance: sql`${creditAccounts.balance} - ${input.amount}`,
          totalDebited: sql`${creditAccounts.totalDebited} + ${input.amount}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(creditAccounts.userId, input.actorUserId),
            gte(creditAccounts.balance, input.amount),
          ),
        )
        .returning({ balance: creditAccounts.balance });
      if (!debited) throw new Error('MODULE_APP_CREDIT_INSUFFICIENT_AVAILABLE_BALANCE');
      const [userLedger] = await tx
        .insert(creditLedgerEntries)
        .values({
          amount: -input.amount,
          balanceAfter: debited.balance,
          metadata: { ...input.metadata, workspaceId: input.workspaceId },
          referenceId: input.idempotencyKey,
          referenceType: 'module_app_workspace_transfer',
          title: 'Workspace Credit Funding',
          type: 'consume',
          userId: input.actorUserId,
        })
        .returning({ id: creditLedgerEntries.id });
      if (!userLedger) throw new Error('MODULE_APP_CREDIT_LEDGER_CREATE_FAILED');

      await tx
        .insert(workspaceCreditAccounts)
        .values({ workspaceId: input.workspaceId })
        .onConflictDoNothing();
      const [credited] = await tx
        .update(workspaceCreditAccounts)
        .set({
          balance: sql`${workspaceCreditAccounts.balance} + ${input.amount}`,
          totalCredited: sql`${workspaceCreditAccounts.totalCredited} + ${input.amount}`,
          updatedAt: now,
        })
        .where(eq(workspaceCreditAccounts.workspaceId, input.workspaceId))
        .returning({ balance: workspaceCreditAccounts.balance });
      if (!credited) throw new Error('MODULE_APP_WORKSPACE_CREDIT_ACCOUNT_UPDATE_FAILED');
      const [workspaceLedger] = await tx
        .insert(workspaceCreditLedgerEntries)
        .values({
          actorUserId: input.actorUserId,
          amount: input.amount,
          balanceAfter: credited.balance,
          metadata: input.metadata ?? {},
          referenceId: input.idempotencyKey,
          referenceType: 'module_app_workspace_transfer',
          title: 'Workspace Credit Funding',
          type: 'funding',
          workspaceId: input.workspaceId,
        })
        .returning({ id: workspaceCreditLedgerEntries.id });
      if (!workspaceLedger) throw new Error('MODULE_APP_CREDIT_LEDGER_CREATE_FAILED');
      return { userLedgerEntryId: userLedger.id, workspaceLedgerEntryId: workspaceLedger.id };
    });
  };
}
