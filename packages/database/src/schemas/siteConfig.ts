import { boolean, pgTable, text, varchar } from 'drizzle-orm/pg-core';

import { timestamptz } from './_helpers';
import { users } from './user';

export const siteConfig = pgTable('site_config', {
  key: varchar('key', { length: 128 }).primaryKey(),
  value: text('value'),
  encrypted: boolean('encrypted').default(false).notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export type SiteConfigItem = typeof siteConfig.$inferSelect;
export type NewSiteConfigItem = typeof siteConfig.$inferInsert;
