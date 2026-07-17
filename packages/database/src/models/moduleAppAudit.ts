import { randomUUID } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';

import { moduleAppAuditLogs } from '../schemas';
import { ModuleAppExecutionModel } from './moduleAppExecution';

type AuditStatus = 'failed' | 'started' | 'succeeded';

const SENSITIVE_AUDIT_FIELD = /authorization|certificate|cookie|key|password|secret|token/i;

const redactAuditMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_AUDIT_FIELD.test(key) ? '[REDACTED]' : redactAuditMetadata(nestedValue),
    ]),
  );
};

const createAuditEnvelopeMetadata = (params: {
  correlationId?: string;
  eventType: string;
  metadata?: null | Record<string, unknown>;
  resourceId: string;
  resourceType: string;
  status?: AuditStatus;
}): Record<string, unknown> => ({
  ...(redactAuditMetadata(params.metadata ?? {}) as Record<string, unknown>),
  action: params.eventType,
  correlationId: params.correlationId ?? randomUUID(),
  resourceId: params.resourceId,
  resourceType: params.resourceType,
  status: params.status ?? 'succeeded',
});

export class ModuleAppAuditModel extends ModuleAppExecutionModel {
  listAdminAuditEvents = async (params: { appId: string; cursor?: number; limit?: number }) => {
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? 0;
    const items = await this.db.query.moduleAppAuditLogs.findMany({
      limit,
      offset: cursor,
      orderBy: [desc(moduleAppAuditLogs.createdAt)],
      where: and(
        eq(moduleAppAuditLogs.resourceType, 'moduleApp'),
        eq(moduleAppAuditLogs.resourceId, params.appId),
      ),
    });

    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  };

  writeAuditLog = async (params: {
    actorUserId?: null | string;
    correlationId?: string;
    eventType: string;
    metadata?: null | Record<string, unknown>;
    resourceId: string;
    resourceType: string;
    status?: AuditStatus;
  }) => {
    await this.db.insert(moduleAppAuditLogs).values({
      actorUserId: params.actorUserId ?? null,
      eventType: params.eventType,
      metadata: createAuditEnvelopeMetadata(params),
      resourceId: params.resourceId,
      resourceType: params.resourceType,
    });

    return { ok: true as const };
  };
}
