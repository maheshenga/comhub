import { moduleAppAuditLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export const writeModuleAppAuditLog = async (params: {
  actorUserId?: null | string;
  db: LobeChatDatabase;
  eventType: string;
  metadata?: null | Record<string, unknown>;
  resourceId: string;
  resourceType: string;
}) => {
  await params.db.insert(moduleAppAuditLogs).values({
    actorUserId: params.actorUserId ?? null,
    eventType: params.eventType,
    metadata: params.metadata ?? {},
    resourceId: params.resourceId,
    resourceType: params.resourceType,
  });
};
