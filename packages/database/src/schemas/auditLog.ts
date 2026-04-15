import { index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';

import { createdAt } from './_helpers';
import { users } from './user';

/**
 * Audit log for admin actions.
 * Records who did what, when, and on what target.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
    /** The admin user who performed the action */
    actorId: text('actor_id')
      .references(() => users.id, { onDelete: 'set null' }),
    /** Action type, e.g. 'plan.create', 'credits.adjust', 'redeem.create' */
    action: varchar('action', { length: 64 }).notNull(),
    /** Target entity type, e.g. 'plan', 'redeemCode', 'userCredits' */
    targetType: varchar('target_type', { length: 64 }),
    /** Target entity ID */
    targetId: text('target_id'),
    /** Additional details (input payload, before/after values) */
    details: jsonb('details').default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_logs_actor_id_idx').on(table.actorId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export type AuditLogItem = typeof auditLogs.$inferSelect;
export type NewAuditLogItem = typeof auditLogs.$inferInsert;
