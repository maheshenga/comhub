import type {
  ModuleAppActionConfig,
  ModuleAppBillingConfig,
  ModuleAppBuildProfile,
  ModuleAppBuildStatus,
  ModuleAppInputSchema,
  ModuleAppPackageArchiveMetadata,
  ModuleAppPackageFileManifestItem,
  ModuleAppPackageManifest,
  ModuleAppPackageReviewStatus,
  ModuleAppPackageScanStatus,
  ModuleAppPackageUploadStatus,
  ModuleAppPackageValidationIssue,
  ModuleAppPage,
  ModuleAppRunStatus,
  ModuleAppScopeType,
  ModuleAppSource,
  ModuleAppStatus,
  ModuleAppType,
} from '@lobechat/types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';
import { users } from './user';
import { workspaces } from './workspace';

const DEFAULT_MODULE_APP_BILLING: ModuleAppBillingConfig = {
  chargeMode: 'free',
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge',
  fixedServiceFeeCredits: 0,
};

export const moduleApps = pgTable(
  'module_apps',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    icon: text('icon').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    appType: text('app_type').$type<ModuleAppType>().notNull(),
    source: text('source').$type<ModuleAppSource>().default('admin').notNull(),
    status: text('status').$type<ModuleAppStatus>().default('draft').notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    billing: jsonb('billing')
      .$type<ModuleAppBillingConfig>()
      .default(DEFAULT_MODULE_APP_BILLING)
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_apps_status_category_sort_idx').on(
      table.status,
      table.category,
      table.sortOrder,
    ),
  ],
);

export type NewModuleApp = typeof moduleApps.$inferInsert;
export type ModuleAppItem = typeof moduleApps.$inferSelect;

export const moduleAppVersions = pgTable(
  'module_app_versions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version').notNull(),
    manifestSnapshot: jsonb('manifest_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    changelog: text('changelog').default('').notNull(),
    publishedAt: timestamptz('published_at'),
    rollbackSourceVersionId: uuid('rollback_source_version_id'),
    runtimeArtifactKey: text('runtime_artifact_key'),
    runtimeArtifactSha256: text('runtime_artifact_sha256'),
    runtimeManifest: jsonb('runtime_manifest')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('module_app_versions_app_id_version_idx').on(
      table.appId,
      table.version,
    ),
  ],
);

export type NewModuleAppVersion = typeof moduleAppVersions.$inferInsert;
export type ModuleAppVersionItem = typeof moduleAppVersions.$inferSelect;

export const moduleAppPages = pgTable(
  'module_app_pages',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => moduleAppVersions.id, { onDelete: 'cascade' })
      .notNull(),
    pageKey: text('page_key').notNull(),
    title: text('title').notNull(),
    pageType: text('page_type').notNull(),
    routePath: text('route_path').notNull(),
    layoutSchema: jsonb('layout_schema')
      .$type<ModuleAppPage['layoutSchema']>()
      .default({})
      .notNull(),
    dataSource: jsonb('data_source')
      .$type<ModuleAppPage['dataSource']>()
      .default({})
      .notNull(),
    actionBindings: jsonb('action_bindings')
      .$type<ModuleAppPage['actionBindings']>()
      .default([])
      .notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_app_pages_app_id_version_id_sort_order_idx').on(
      table.appId,
      table.versionId,
      table.sortOrder,
    ),
  ],
);

export type NewModuleAppPage = typeof moduleAppPages.$inferInsert;
export type ModuleAppPageItem = typeof moduleAppPages.$inferSelect;

export const moduleAppActions = pgTable(
  'module_app_actions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => moduleAppVersions.id, { onDelete: 'cascade' })
      .notNull(),
    actionKey: text('action_key').notNull(),
    runtimeType: text('runtime_type')
      .$type<ModuleAppActionConfig['runtimeType']>()
      .notNull(),
    name: text('name').notNull(),
    inputSchema: jsonb('input_schema')
      .$type<ModuleAppInputSchema>()
      .default({ fields: [] })
      .notNull(),
    outputSchema: jsonb('output_schema')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    moduleMultiplier: integer('module_multiplier').default(1).notNull(),
    runtimeConfig: jsonb('runtime_config')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_app_actions_app_id_version_id_action_key_idx').on(
      table.appId,
      table.versionId,
      table.actionKey,
    ),
  ],
);

export type NewModuleAppAction = typeof moduleAppActions.$inferInsert;
export type ModuleAppActionItem = typeof moduleAppActions.$inferSelect;

export const moduleAppEntitlements = pgTable(
  'module_app_entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    plan: text('plan').notNull(),
    visible: boolean('visible').default(false).notNull(),
    installable: boolean('installable').default(false).notNull(),
    runnable: boolean('runnable').default(false).notNull(),
    freeQuotaCredits: integer('free_quota_credits').default(0).notNull(),
    discountPercent: integer('discount_percent').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('module_app_entitlements_app_id_plan_unique').on(
      table.appId,
      table.plan,
    ),
  ],
);

export type NewModuleAppEntitlement = typeof moduleAppEntitlements.$inferInsert;
export type ModuleAppEntitlementItem =
  typeof moduleAppEntitlements.$inferSelect;

export const moduleAppInstallations = pgTable(
  'module_app_installations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => moduleAppVersions.id, { onDelete: 'cascade' })
      .notNull(),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    status: text('status').default('installed').notNull(),
    installedAt: timestamptz('installed_at').defaultNow().notNull(),
    uninstalledAt: timestamptz('uninstalled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'module_app_installations_scope_owner_check',
      sql`(
        (${table.scopeType} = 'personal' AND ${table.userId} IS NOT NULL AND ${table.workspaceId} IS NULL)
        OR (${table.scopeType} = 'workspace' AND ${table.workspaceId} IS NOT NULL)
      )`,
    ),
    uniqueIndex('module_app_install_personal_unique')
      .on(table.appId, table.userId)
      .where(sql`${table.scopeType} = 'personal' AND ${table.userId} IS NOT NULL`),
    uniqueIndex('module_app_install_workspace_unique')
      .on(table.appId, table.workspaceId)
      .where(sql`${table.scopeType} = 'workspace' AND ${table.workspaceId} IS NOT NULL`),
  ],
);

export type NewModuleAppInstallation =
  typeof moduleAppInstallations.$inferInsert;
export type ModuleAppInstallationItem =
  typeof moduleAppInstallations.$inferSelect;

export const moduleAppInstallationSecrets = pgTable(
  'module_app_installation_secrets',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    installationId: uuid('installation_id')
      .references(() => moduleAppInstallations.id, { onDelete: 'cascade' })
      .notNull(),
    secretKey: text('secret_key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('module_app_installation_secrets_installation_key_unique').on(
      table.installationId,
      table.secretKey,
    ),
  ],
);

export type NewModuleAppInstallationSecret = typeof moduleAppInstallationSecrets.$inferInsert;
export type ModuleAppInstallationSecretItem = typeof moduleAppInstallationSecrets.$inferSelect;

export const moduleAppRecords = pgTable(
  'module_app_records',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    collectionKey: text('collection_key').notNull(),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    recordKey: text('record_key'),
    title: text('title'),
    status: text('status').default('active').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: text('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'module_app_records_scope_owner_check',
      sql`(
        (${table.scopeType} = 'personal' AND ${table.ownerUserId} IS NOT NULL AND ${table.workspaceId} IS NULL)
        OR (${table.scopeType} = 'workspace' AND ${table.workspaceId} IS NOT NULL)
      )`,
    ),
    index('module_app_records_personal_idx').on(
      table.appId,
      table.scopeType,
      table.ownerUserId,
      table.collectionKey,
      table.updatedAt,
    ),
    index('module_app_records_workspace_idx').on(
      table.appId,
      table.scopeType,
      table.workspaceId,
      table.collectionKey,
      table.updatedAt,
    ),
    index('module_app_records_record_key_idx').on(
      table.appId,
      table.collectionKey,
      table.recordKey,
    ),
  ],
);

export type NewModuleAppRecord = typeof moduleAppRecords.$inferInsert;
export type ModuleAppRecordItem = typeof moduleAppRecords.$inferSelect;

export const moduleAppRecordEvents = pgTable(
  'module_app_record_events',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    recordId: uuid('record_id')
      .references(() => moduleAppRecords.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: text('event_type').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    beforeSnapshot: jsonb('before_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    afterSnapshot: jsonb('after_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('module_app_record_events_record_id_created_at_idx').on(
      table.recordId,
      table.createdAt,
    ),
  ],
);

export type NewModuleAppRecordEvent = typeof moduleAppRecordEvents.$inferInsert;
export type ModuleAppRecordEventItem =
  typeof moduleAppRecordEvents.$inferSelect;

export const moduleAppRuns = pgTable(
  'module_app_runs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id').references(() => moduleAppVersions.id, {
      onDelete: 'set null',
    }),
    actionId: uuid('action_id').references(() => moduleAppActions.id, {
      onDelete: 'set null',
    }),
    recordId: uuid('record_id').references(() => moduleAppRecords.id, {
      onDelete: 'set null',
    }),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    status: text('status')
      .$type<ModuleAppRunStatus>()
      .default('queued')
      .notNull(),
    inputSnapshot: jsonb('input_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    outputSnapshot: jsonb('output_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    billingSnapshot: jsonb('billing_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    errorType: text('error_type'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_app_runs_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('module_app_runs_workspace_id_created_at_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
    index('module_app_runs_app_id_created_at_idx').on(
      table.appId,
      table.createdAt,
    ),
  ],
);

export type NewModuleAppRun = typeof moduleAppRuns.$inferInsert;
export type ModuleAppRunItem = typeof moduleAppRuns.$inferSelect;

export const moduleAppArtifacts = pgTable(
  'module_app_artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id')
      .references(() => moduleApps.id, { onDelete: 'cascade' })
      .notNull(),
    runId: uuid('run_id')
      .references(() => moduleAppRuns.id, { onDelete: 'cascade' })
      .notNull(),
    recordId: uuid('record_id').references(() => moduleAppRecords.id, {
      onDelete: 'set null',
    }),
    scopeType: text('scope_type').$type<ModuleAppScopeType>().notNull(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    expiresAt: timestamptz('expires_at'),
    downloadCount: integer('download_count').default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('module_app_artifacts_run_id_idx').on(table.runId)],
);

export type NewModuleAppArtifact = typeof moduleAppArtifacts.$inferInsert;
export type ModuleAppArtifactItem = typeof moduleAppArtifacts.$inferSelect;

export const moduleAppPackages = pgTable(
  'module_app_packages',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    appId: uuid('app_id').references(() => moduleApps.id, {
      onDelete: 'set null',
    }),
    versionId: uuid('version_id').references(() => moduleAppVersions.id, {
      onDelete: 'set null',
    }),
    submittedByUserId: text('submitted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewStatus: text('review_status')
      .$type<ModuleAppPackageReviewStatus>()
      .default('pending_review')
      .notNull(),
    archive: jsonb('archive')
      .$type<ModuleAppPackageArchiveMetadata>()
      .notNull(),
    fileManifest: jsonb('file_manifest')
      .$type<ModuleAppPackageFileManifestItem[]>()
      .default([])
      .notNull(),
    manifestSnapshot: jsonb('manifest_snapshot')
      .$type<ModuleAppPackageManifest>()
      .notNull(),
    validationReport: jsonb('validation_report')
      .$type<ModuleAppPackageValidationIssue[]>()
      .default([])
      .notNull(),
    rejectionReason: text('rejection_reason'),
    reviewedAt: timestamptz('reviewed_at'),
    publishedAt: timestamptz('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('module_app_packages_review_status_created_at_idx').on(
      table.reviewStatus,
      table.createdAt,
    ),
    index('module_app_packages_submitted_by_created_at_idx').on(
      table.submittedByUserId,
      table.createdAt,
    ),
    index('module_app_packages_app_id_created_at_idx').on(
      table.appId,
      table.createdAt,
    ),
  ],
);

export type NewModuleAppPackage = typeof moduleAppPackages.$inferInsert;
export type ModuleAppPackageItem = typeof moduleAppPackages.$inferSelect;

export const moduleAppBuilds = pgTable(
  'module_app_builds',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    packageId: uuid('package_id')
      .references(() => moduleAppPackages.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => moduleAppVersions.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').$type<ModuleAppBuildStatus>().default('queued').notNull(),
    sourceSha256: text('source_sha256').notNull(),
    artifactKey: text('artifact_key'),
    artifactSha256: text('artifact_sha256'),
    buildProfile: text('build_profile').$type<ModuleAppBuildProfile>().notNull(),
    workerId: text('worker_id'),
    claimedAt: timestamptz('claimed_at'),
    completedAt: timestamptz('completed_at'),
    failureCode: text('failure_code'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('module_app_builds_version_id_unique').on(table.versionId),
    index('module_app_builds_status_created_at_idx').on(table.status, table.createdAt),
    check(
      'module_app_builds_status_check',
      sql`${table.status} IN ('queued', 'building', 'ready', 'failed')`,
    ),
    check(
      'module_app_builds_source_sha256_check',
      sql`${table.sourceSha256} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export type NewModuleAppBuild = typeof moduleAppBuilds.$inferInsert;
export type ModuleAppBuildItem = typeof moduleAppBuilds.$inferSelect;

export const moduleAppPackageUploads = pgTable(
  'module_app_package_uploads',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    packageId: uuid('package_id').references(() => moduleAppPackages.id, {
      onDelete: 'set null',
    }),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    declaredSizeBytes: integer('declared_size_bytes').notNull(),
    actualSizeBytes: integer('actual_size_bytes'),
    sha256: text('sha256'),
    status: text('status').$type<ModuleAppPackageUploadStatus>().default('issued').notNull(),
    scanStatus: text('scan_status')
      .$type<ModuleAppPackageScanStatus>()
      .default('pending')
      .notNull(),
    scanReport: jsonb('scan_report')
      .$type<ModuleAppPackageValidationIssue[]>()
      .default([])
      .notNull(),
    failureCode: text('failure_code'),
    storageReleasedAt: timestamptz('storage_released_at'),
    expiresAt: timestamptz('expires_at').notNull(),
    completedAt: timestamptz('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('module_app_package_uploads_storage_key_unique').on(table.storageKey),
    uniqueIndex('module_app_package_uploads_package_id_unique').on(table.packageId),
    index('module_app_package_uploads_user_status_created_at_idx').on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index('module_app_package_uploads_status_expires_at_idx').on(table.status, table.expiresAt),
    check(
      'module_app_package_uploads_status_check',
      sql`${table.status} IN ('issued', 'processing', 'submitted', 'rejected', 'failed', 'cleaning', 'expired')`,
    ),
    check(
      'module_app_package_uploads_scan_status_check',
      sql`${table.scanStatus} IN ('pending', 'clean', 'blocked', 'error')`,
    ),
  ],
);

export type NewModuleAppPackageUpload = typeof moduleAppPackageUploads.$inferInsert;
export type ModuleAppPackageUploadItem = typeof moduleAppPackageUploads.$inferSelect;

export const moduleAppAuditLogs = pgTable(
  'module_app_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    eventType: text('event_type').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('module_app_audit_logs_resource_type_resource_id_created_at_idx').on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
  ],
);

export type NewModuleAppAuditLog = typeof moduleAppAuditLogs.$inferInsert;
export type ModuleAppAuditLogItem = typeof moduleAppAuditLogs.$inferSelect;
