import { adminAuditLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export interface AuditEntry {
  action: string;
  payload?: Record<string, unknown>;
  resourceId?: string | null;
  resourceType?: string | null;
  targetUserId?: string | null;
}

interface AuditContext {
  clientIp?: string | null;
  serverDB: LobeChatDatabase;
  userId: string;
}

/**
 * Records an administrative action. Failures are swallowed so an audit failure
 * never blocks the user-visible mutation — the caller is responsible for the
 * primary write.
 */
export const recordAdminAudit = async (
  ctxOrDb: AuditContext | LobeChatDatabase,
  actorOrEntry: string | AuditEntry,
  maybeEntry?: AuditEntry,
): Promise<void> => {
  // Backward-compatible signature: (db, actorUserId, entry) OR (ctx, entry)
  const isCtx = typeof actorOrEntry === 'object';
  const db: LobeChatDatabase = isCtx
    ? (ctxOrDb as AuditContext).serverDB
    : (ctxOrDb as LobeChatDatabase);
  const actorUserId: string = isCtx
    ? (ctxOrDb as AuditContext).userId
    : (actorOrEntry as string);
  const entry: AuditEntry = isCtx ? (actorOrEntry as AuditEntry) : (maybeEntry as AuditEntry);
  const ipAddress: string | null = isCtx
    ? (ctxOrDb as AuditContext).clientIp ?? null
    : null;

  try {
    await db.insert(adminAuditLogs).values({
      action: entry.action,
      actorUserId,
      ipAddress,
      payload: entry.payload ?? null,
      resourceId: entry.resourceId ?? null,
      resourceType: entry.resourceType ?? null,
      targetUserId: entry.targetUserId ?? null,
    });
  } catch (error) {
    console.error('[admin-audit] failed to record audit log', error);
  }
};

