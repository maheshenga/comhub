import { randomUUID } from 'node:crypto';

import { moduleAppAuditLogs } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import { type AdminAuditStatus, redactAdminAuditValue } from '../lambda-routers/admin/audit';

export const createModuleAppAuditEnvelopeMetadata = (params: {
  correlationId?: string;
  eventType: string;
  metadata?: null | Record<string, unknown>;
  resourceId: string;
  resourceType: string;
  status?: AdminAuditStatus;
}): Record<string, unknown> => ({
  ...(redactAdminAuditValue(params.metadata ?? {}) as Record<string, unknown>),
  action: params.eventType,
  correlationId: params.correlationId ?? randomUUID(),
  resourceId: params.resourceId,
  resourceType: params.resourceType,
  status: params.status ?? 'succeeded',
});

export const writeModuleAppAuditLog = async (params: {
  actorUserId?: null | string;
  correlationId?: string;
  db: LobeChatDatabase | Transaction;
  eventType: string;
  metadata?: null | Record<string, unknown>;
  resourceId: string;
  resourceType: string;
  status?: AdminAuditStatus;
}) => {
  await params.db.insert(moduleAppAuditLogs).values({
    actorUserId: params.actorUserId ?? null,
    eventType: params.eventType,
    metadata: createModuleAppAuditEnvelopeMetadata(params),
    resourceId: params.resourceId,
    resourceType: params.resourceType,
  });
};
