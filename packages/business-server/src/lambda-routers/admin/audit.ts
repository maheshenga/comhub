import { randomUUID } from 'node:crypto';

import { adminAuditLogs } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

export type AdminAuditStatus = 'failed' | 'started' | 'succeeded';
export type AdminAuditMode = 'best-effort' | 'required';
export type AdminAuditDatabase = LobeChatDatabase | Transaction;

export interface AuditEntry {
  action: string;
  payload?: Record<string, unknown>;
  resourceId?: string | null;
  resourceType?: string | null;
  targetUserId?: string | null;
}

export interface AuditContext {
  clientIp?: string | null;
  serverDB: AdminAuditDatabase;
  userId: string;
}

export type AdminAuditWriteResult = {
  correlationId: string;
  ok: boolean;
  status: AdminAuditStatus;
};

export type RecordAdminAuditOptions = {
  correlationId?: string;
  db?: AdminAuditDatabase;
  mode?: AdminAuditMode;
  status?: AdminAuditStatus;
};

const SENSITIVE_AUDIT_FIELD = /authorization|certificate|cookie|key|password|secret|token/i;
const REDACTED_VALUE = '[REDACTED]';

export const LOW_RISK_BEST_EFFORT_ADMIN_AUDIT_ACTIONS = new Set([
  'newapiInstanceModels.refreshRuntimeCache',
]);

export const redactAdminAuditValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactAdminAuditValue);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_AUDIT_FIELD.test(key) ? REDACTED_VALUE : redactAdminAuditValue(nestedValue),
    ]),
  );
};

export const createAdminAuditEnvelopePayload = ({
  correlationId,
  payload,
  status,
}: {
  correlationId: string;
  payload?: Record<string, unknown> | null;
  status: AdminAuditStatus;
}): Record<string, unknown> => ({
  ...(redactAdminAuditValue(payload ?? {}) as Record<string, unknown>),
  correlationId,
  status,
});

const insertAdminAudit = async (
  db: AdminAuditDatabase,
  actorUserId: string,
  ipAddress: string | null,
  entry: AuditEntry,
  correlationId: string,
  status: AdminAuditStatus,
) => {
  await db.insert(adminAuditLogs).values({
    action: entry.action,
    actorUserId,
    ipAddress,
    payload: createAdminAuditEnvelopePayload({ correlationId, payload: entry.payload, status }),
    resourceId: entry.resourceId ?? null,
    resourceType: entry.resourceType ?? null,
    targetUserId: entry.targetUserId ?? null,
  });
};

export async function recordAdminAudit(
  ctx: AuditContext,
  entry: AuditEntry,
  options?: RecordAdminAuditOptions,
): Promise<AdminAuditWriteResult>;
export async function recordAdminAudit(
  db: AdminAuditDatabase,
  actorUserId: string,
  entry: AuditEntry,
  options?: RecordAdminAuditOptions,
): Promise<AdminAuditWriteResult>;
export async function recordAdminAudit(
  ctxOrDb: AdminAuditDatabase | AuditContext,
  actorOrEntry: AuditEntry | string,
  entryOrOptions?: AuditEntry | RecordAdminAuditOptions,
  legacyOptions?: RecordAdminAuditOptions,
): Promise<AdminAuditWriteResult> {
  const isContextSignature = typeof actorOrEntry === 'object';
  const context = isContextSignature ? (ctxOrDb as AuditContext) : undefined;
  const entry = (isContextSignature ? actorOrEntry : entryOrOptions) as AuditEntry;
  const options = (isContextSignature ? entryOrOptions : legacyOptions) as
    RecordAdminAuditOptions | undefined;
  const actorUserId = isContextSignature ? context!.userId : (actorOrEntry as string);
  const correlationId = options?.correlationId ?? randomUUID();
  const db =
    options?.db ?? (isContextSignature ? context!.serverDB : (ctxOrDb as AdminAuditDatabase));
  const ipAddress = isContextSignature ? (context!.clientIp ?? null) : null;
  const mode = options?.mode ?? 'required';
  const status = options?.status ?? 'succeeded';

  if (mode === 'best-effort' && !LOW_RISK_BEST_EFFORT_ADMIN_AUDIT_ACTIONS.has(entry.action)) {
    throw new Error('ADMIN_AUDIT_BEST_EFFORT_NOT_ALLOWED');
  }

  try {
    await insertAdminAudit(db, actorUserId, ipAddress, entry, correlationId, status);
    return { correlationId, ok: true, status };
  } catch (error) {
    if (mode === 'required') throw error;

    console.error('[admin-audit] best-effort audit insert failed', {
      action: entry.action,
      correlationId,
      status,
    });
    return { correlationId, ok: false, status };
  }
}

export const recordAdminAuditStrict = async (
  ctx: AuditContext,
  entry: AuditEntry,
  options?: Omit<RecordAdminAuditOptions, 'mode'>,
) => recordAdminAudit(ctx, entry, { ...options, mode: 'required' });

export const runRequiredAdminAuditMutation = async <T>(
  ctx: Omit<AuditContext, 'serverDB'> & { serverDB: LobeChatDatabase },
  options: {
    audit: (result: T) => AuditEntry | Promise<AuditEntry>;
    correlationId?: string;
    mutation: (tx: Transaction) => Promise<T>;
  },
): Promise<T> => {
  const correlationId = options.correlationId ?? randomUUID();

  return ctx.serverDB.transaction(async (tx) => {
    const result = await options.mutation(tx);
    const entry = await options.audit(result);
    await recordAdminAudit({ ...ctx, serverDB: tx }, entry, {
      correlationId,
      mode: 'required',
      status: 'succeeded',
    });
    return result;
  });
};

/**
 * Audits effects that cannot participate in a database transaction. The
 * durable `started` row is the gate; terminal audit rows describe the outcome,
 * but cannot roll an already executed external effect back.
 */
export const runRequiredAdminAuditExternalEffect = async <T>(
  ctx: AuditContext,
  options: {
    audit: (status: AdminAuditStatus, result?: T) => AuditEntry | Promise<AuditEntry>;
    correlationId?: string;
    effect: () => Promise<T>;
  },
): Promise<T> => {
  const correlationId = options.correlationId ?? randomUUID();

  await recordAdminAudit(ctx, await options.audit('started'), {
    correlationId,
    mode: 'required',
    status: 'started',
  });

  let result: T;
  try {
    result = await options.effect();
  } catch (error) {
    await recordAdminAudit(ctx, await options.audit('failed'), {
      correlationId,
      mode: 'required',
      status: 'failed',
    });
    throw error;
  }

  await recordAdminAudit(ctx, await options.audit('succeeded', result), {
    correlationId,
    mode: 'required',
    status: 'succeeded',
  });

  return result;
};
