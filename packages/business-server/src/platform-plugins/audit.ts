import { platformPluginAuditLogs } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import { redactPlatformPluginLogValue } from './secrets';

type PlatformPluginAuditDb = LobeChatDatabase | Transaction;

export interface WritePlatformPluginAuditLogInput {
  actorUserId?: string | null;
  db: PlatformPluginAuditDb;
  eventType: string;
  metadata?: Record<string, unknown> | null;
  resourceId: string;
  resourceType: string;
  targetUserId?: string | null;
}

const redactMetadata = (metadata: Record<string, unknown> | null | undefined) => {
  const redacted = redactPlatformPluginLogValue(metadata ?? {});

  return redacted && typeof redacted === 'object' && !Array.isArray(redacted)
    ? (redacted as Record<string, unknown>)
    : {};
};

export const writePlatformPluginAuditLog = async ({
  actorUserId,
  db,
  eventType,
  metadata,
  resourceId,
  resourceType,
  targetUserId,
}: WritePlatformPluginAuditLogInput): Promise<void> => {
  await db.insert(platformPluginAuditLogs).values({
    actorUserId: actorUserId ?? null,
    eventType,
    metadata: redactMetadata(metadata),
    resourceId,
    resourceType,
    targetUserId: targetUserId ?? null,
  });
};
