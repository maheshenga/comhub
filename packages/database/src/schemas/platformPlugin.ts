import type {
  PlatformPluginActionRuntimeType,
  PlatformPluginBillingConfig,
  PlatformPluginInputSchema,
  PlatformPluginRunStatus,
  PlatformPluginRuntimeType,
  PlatformPluginStatus,
} from '@lobechat/types';
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';
import { users } from './user';

const DEFAULT_PLATFORM_PLUGIN_BILLING_CONFIG: PlatformPluginBillingConfig = {
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge',
  fixedServiceFeeCredits: 0,
};

export const platformPlugins = pgTable(
  'platform_plugins',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    icon: text('icon').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    author: text('author').default('ComHub').notNull(),
    runtimeType: text('runtime_type').$type<PlatformPluginRuntimeType>().notNull(),
    status: text('status').$type<PlatformPluginStatus>().default('draft').notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    billing: jsonb('billing')
      .$type<PlatformPluginBillingConfig>()
      .$defaultFn(() => ({ ...DEFAULT_PLATFORM_PLUGIN_BILLING_CONFIG }))
      .notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('platform_plugins_status_category_sort_idx').on(table.status, table.category, table.sortOrder)],
);

export type NewPlatformPlugin = typeof platformPlugins.$inferInsert;
export type PlatformPluginItem = typeof platformPlugins.$inferSelect;

export const platformPluginVersions = pgTable(
  'platform_plugin_versions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version').notNull(),
    configSnapshot: jsonb('config_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    changelog: text('changelog').default('').notNull(),
    publishedAt: timestamptz('published_at'),
    rollbackSourceVersionId: uuid('rollback_source_version_id'),
    createdAt: createdAt(),
  },
  (table) => [index('platform_plugin_versions_plugin_id_version_idx').on(table.pluginId, table.version)],
);

export type NewPlatformPluginVersion = typeof platformPluginVersions.$inferInsert;
export type PlatformPluginVersionItem = typeof platformPluginVersions.$inferSelect;

export const platformPluginActions = pgTable(
  'platform_plugin_actions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => platformPluginVersions.id, { onDelete: 'cascade' })
      .notNull(),
    actionKey: text('action_key').notNull(),
    runtimeType: text('runtime_type').$type<PlatformPluginActionRuntimeType>().notNull(),
    name: text('name').notNull(),
    inputSchema: jsonb('input_schema').$type<PlatformPluginInputSchema>().default({ fields: [] }).notNull(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>().default({}).notNull(),
    moduleMultiplier: integer('module_multiplier').default(1).notNull(),
    runtimeConfig: jsonb('runtime_config').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('platform_plugin_actions_plugin_id_version_id_action_key_idx').on(table.pluginId, table.versionId, table.actionKey)],
);

export type NewPlatformPluginAction = typeof platformPluginActions.$inferInsert;
export type PlatformPluginActionItem = typeof platformPluginActions.$inferSelect;

export const platformPluginPlanEntitlements = pgTable(
  'platform_plugin_plan_entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    plan: text('plan').notNull(),
    visible: boolean('visible').default(false).notNull(),
    installable: boolean('installable').default(false).notNull(),
    runnable: boolean('runnable').default(false).notNull(),
    freeQuotaCredits: integer('free_quota_credits').default(0).notNull(),
    discountPercent: integer('discount_percent').default(0).notNull(),
    forcedEnabled: boolean('forced_enabled').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('platform_plugin_plan_entitlements_plugin_id_plan_idx').on(table.pluginId, table.plan)],
);

export type NewPlatformPluginPlanEntitlement = typeof platformPluginPlanEntitlements.$inferInsert;
export type PlatformPluginPlanEntitlementItem = typeof platformPluginPlanEntitlements.$inferSelect;

export const platformPluginSecrets = pgTable('platform_plugin_secrets', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  pluginId: uuid('plugin_id')
    .references(() => platformPlugins.id, { onDelete: 'cascade' })
    .notNull(),
  scope: text('scope').notNull(),
  secretKey: text('secret_key').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  maskedValue: text('masked_value').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  lastUsedAt: timestamptz('last_used_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type NewPlatformPluginSecret = typeof platformPluginSecrets.$inferInsert;
export type PlatformPluginSecretItem = typeof platformPluginSecrets.$inferSelect;

export const platformPluginInstallations = pgTable(
  'platform_plugin_installations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => platformPluginVersions.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').default('installed').notNull(),
    installedAt: timestamptz('installed_at').defaultNow().notNull(),
    uninstalledAt: timestamptz('uninstalled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('platform_plugin_installations_plugin_id_user_id_unique').on(table.pluginId, table.userId)],
);

export type NewPlatformPluginInstallation = typeof platformPluginInstallations.$inferInsert;
export type PlatformPluginInstallationItem = typeof platformPluginInstallations.$inferSelect;

export const platformPluginAgentBindings = pgTable(
  'platform_plugin_agent_bindings',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: text('agent_id').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('platform_plugin_agent_bindings_plugin_id_user_id_agent_id_unique').on(table.pluginId, table.userId, table.agentId)],
);

export type NewPlatformPluginAgentBinding = typeof platformPluginAgentBindings.$inferInsert;
export type PlatformPluginAgentBindingItem = typeof platformPluginAgentBindings.$inferSelect;

export const platformPluginRuns = pgTable(
  'platform_plugin_runs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id').references(() => platformPluginVersions.id, { onDelete: 'set null' }),
    actionId: uuid('action_id').references(() => platformPluginActions.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    agentId: text('agent_id'),
    status: text('status').$type<PlatformPluginRunStatus>().default('queued').notNull(),
    inputSnapshot: jsonb('input_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    outputSnapshot: jsonb('output_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    billingSnapshot: jsonb('billing_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    errorType: text('error_type'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('platform_plugin_runs_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('platform_plugin_runs_plugin_id_created_at_idx').on(table.pluginId, table.createdAt),
  ],
);

export type NewPlatformPluginRun = typeof platformPluginRuns.$inferInsert;
export type PlatformPluginRunItem = typeof platformPluginRuns.$inferSelect;

export const platformPluginArtifacts = pgTable(
  'platform_plugin_artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    pluginId: uuid('plugin_id')
      .references(() => platformPlugins.id, { onDelete: 'cascade' })
      .notNull(),
    runId: uuid('run_id')
      .references(() => platformPluginRuns.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    expiresAt: timestamptz('expires_at'),
    downloadCount: integer('download_count').default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('platform_plugin_artifacts_run_id_idx').on(table.runId)],
);

export type NewPlatformPluginArtifact = typeof platformPluginArtifacts.$inferInsert;
export type PlatformPluginArtifactItem = typeof platformPluginArtifacts.$inferSelect;

export const platformPluginAuditLogs = pgTable(
  'platform_plugin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    eventType: text('event_type').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('platform_plugin_audit_logs_resource_type_resource_id_created_at_idx').on(table.resourceType, table.resourceId, table.createdAt)],
);

export type NewPlatformPluginAuditLog = typeof platformPluginAuditLogs.$inferInsert;
export type PlatformPluginAuditLogItem = typeof platformPluginAuditLogs.$inferSelect;
