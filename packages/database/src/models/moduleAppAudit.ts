import { and, desc, eq } from 'drizzle-orm';

import { moduleAppAuditLogs } from '../schemas';
import { ModuleAppExecutionModel } from './moduleAppExecution';

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
    eventType: string;
    metadata?: null | Record<string, unknown>;
    resourceId: string;
    resourceType: string;
  }) => {
    await this.db.insert(moduleAppAuditLogs).values({
      actorUserId: params.actorUserId ?? null,
      eventType: params.eventType,
      metadata: params.metadata ?? {},
      resourceId: params.resourceId,
      resourceType: params.resourceType,
    });

    return { ok: true as const };
  };
}
