import { desc, eq } from 'drizzle-orm';

import { type AuditLogItem, type NewAuditLogItem, auditLogs } from '../schemas/auditLog';
import type { LobeChatDatabase } from '../type';

export class AuditLogModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  create = async (data: NewAuditLogItem): Promise<AuditLogItem> => {
    const [result] = await this.db.insert(auditLogs).values(data).returning();
    return result;
  };

  getRecent = async (limit: number = 100, offset: number = 0): Promise<AuditLogItem[]> => {
    return this.db.query.auditLogs.findMany({
      orderBy: [desc(auditLogs.createdAt)],
      limit,
      offset,
    });
  };

  getByActor = async (actorId: string, limit: number = 50): Promise<AuditLogItem[]> => {
    return this.db.query.auditLogs.findMany({
      where: eq(auditLogs.actorId, actorId),
      orderBy: [desc(auditLogs.createdAt)],
      limit,
    });
  };
}
