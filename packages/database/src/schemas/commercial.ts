import type {
  AutoTopUpSetting,
  CreditLedgerEntryType,
  ReferralStatusString,
  SubscriptionChangeRequestReasonType,
  SubscriptionChangeRequestStatusType,
  SubscriptionCycleType,
  SubscriptionStatusType,
  TopUpOrderSourceType,
  TopUpOrderStatusType,
} from '@lobechat/types';
import { Plans } from '@lobechat/types';
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
  varchar,
} from 'drizzle-orm/pg-core';

import { amountNumeric, createdAt, timestamptz, updatedAt } from './_helpers';
import type { PlanModelRules } from './newapiInstance';
import { users } from './user';
import { workspaces } from './workspace';

export const userPlanSnapshots = pgTable(
  'user_plan_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    plan: text('plan').$type<Plans>().notNull().default(Plans.Free),
    status: text('status').$type<SubscriptionStatusType>().notNull().default('active'),
    cycle: text('cycle').$type<SubscriptionCycleType>().notNull().default('monthly'),

    monthlyCredits: amountNumeric('monthly_credits').notNull().default(0),
    monthlyPrice: amountNumeric('monthly_price').notNull().default(0),
    currency: varchar('currency', { length: 16 }).notNull().default('USD'),

    provider: text('provider'),
    externalSubscriptionId: text('external_subscription_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    startedAt: timestamptz('started_at').notNull().defaultNow(),
    renewsAt: timestamptz('renews_at'),
    endsAt: timestamptz('ends_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('user_plan_snapshots_user_id_idx').on(table.userId),
    index('user_plan_snapshots_user_started_at_idx').on(table.userId, table.startedAt),
    uniqueIndex('user_plan_snapshots_one_active_per_user_unique')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export type NewUserPlanSnapshot = typeof userPlanSnapshots.$inferInsert;
export type UserPlanSnapshotItem = typeof userPlanSnapshots.$inferSelect;

export const subscriptionChangeRequests = pgTable(
  'subscription_change_requests',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    fromPlan: text('from_plan').$type<Plans>().notNull(),
    toPlan: text('to_plan').$type<Plans>().notNull(),
    cycle: text('cycle').$type<SubscriptionCycleType>().notNull().default('monthly'),
    reason: text('reason').$type<SubscriptionChangeRequestReasonType>().notNull(),
    status: text('status')
      .$type<SubscriptionChangeRequestStatusType>()
      .notNull()
      .default('pending'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('subscription_change_requests_user_id_idx').on(table.userId),
    index('subscription_change_requests_user_status_idx').on(table.userId, table.status),
    uniqueIndex('subscription_change_requests_one_pending_per_user_unique')
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type NewSubscriptionChangeRequest = typeof subscriptionChangeRequests.$inferInsert;
export type SubscriptionChangeRequestItemRecord = typeof subscriptionChangeRequests.$inferSelect;

export const creditAccounts = pgTable(
  'credit_accounts',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .primaryKey()
      .notNull(),

    balance: amountNumeric('balance').notNull().default(0),
    totalCredited: amountNumeric('total_credited').notNull().default(0),
    totalDebited: amountNumeric('total_debited').notNull().default(0),
    currency: varchar('currency', { length: 16 }).notNull().default('CREDITS'),

    storageUsed: amountNumeric('storage_used').notNull().default(0),
    storageQuota: amountNumeric('storage_quota'),
    vectorQuota: amountNumeric('vector_quota'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('credit_accounts_updated_at_idx').on(table.updatedAt)],
);

export type NewCreditAccount = typeof creditAccounts.$inferInsert;
export type CreditAccountItem = typeof creditAccounts.$inferSelect;

export const autoTopUpSettings = pgTable(
  'auto_top_up_settings',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .primaryKey()
      .notNull(),

    enabled: boolean('enabled').notNull().default(false),
    threshold: amountNumeric('threshold').notNull().default(40_000_000),
    targetBalance: amountNumeric('target_balance').notNull().default(120_000_000),
    monthlyLimit: amountNumeric('monthly_limit'),
    monthlyTopUpAmount: amountNumeric('monthly_top_up_amount').notNull().default(0),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('auto_top_up_settings_updated_at_idx').on(table.updatedAt)],
);

export type NewAutoTopUpSetting = typeof autoTopUpSettings.$inferInsert;
export type AutoTopUpSettingItem = typeof autoTopUpSettings.$inferSelect;

export const defaultAutoTopUpSetting: AutoTopUpSetting = {
  enabled: false,
  monthlyLimit: null,
  monthlyTopUpAmount: 0,
  targetBalance: 120_000_000,
  threshold: 40_000_000,
  updatedAt: null,
};

export const creditLedgerEntries = pgTable(
  'credit_ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    type: text('type').$type<CreditLedgerEntryType>().notNull(),
    amount: amountNumeric('amount').notNull(),
    balanceAfter: amountNumeric('balance_after').notNull(),

    title: text('title'),
    description: text('description'),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('credit_ledger_entries_user_id_idx').on(table.userId),
    index('credit_ledger_entries_user_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('credit_ledger_entries_ppt_generation_unique_idx')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'ppt_generation' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'consume'`,
      ),
    uniqueIndex('credit_ledger_entries_image_generation_unique_idx')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'image_generation' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'consume'`,
      ),
    uniqueIndex('credit_ledger_entries_video_generation_unique_idx')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'video_generation' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'consume'`,
      ),
    uniqueIndex('credit_ledger_entries_ai_usage_reservation_unique_idx')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'ai_usage_reservation' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'consume'`,
      ),
    uniqueIndex('credit_ledger_entries_module_app_reservation_unique_idx')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'module_app_credit_reservation' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'consume'`,
      ),
    uniqueIndex('credit_ledger_entries_module_app_workspace_transfer_unique_idx')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'module_app_workspace_transfer' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'consume'`,
      ),
    uniqueIndex('credit_ledger_entries_subscription_period_unique')
      .on(table.userId, table.referenceType, table.referenceId, table.type)
      .where(
        sql`${table.referenceType} = 'subscription_snapshot_period' AND ${table.referenceId} IS NOT NULL AND ${table.type} = 'subscription_grant'`,
      ),
  ],
);

export type NewCreditLedgerEntry = typeof creditLedgerEntries.$inferInsert;
export type CreditLedgerEntryItemRecord = typeof creditLedgerEntries.$inferSelect;

export const workspaceCreditAccounts = pgTable(
  'workspace_credit_accounts',
  {
    workspaceId: text('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .primaryKey()
      .notNull(),
    balance: amountNumeric('balance').default(0).notNull(),
    totalCredited: amountNumeric('total_credited').default(0).notNull(),
    totalDebited: amountNumeric('total_debited').default(0).notNull(),
    currency: varchar('currency', { length: 16 }).default('CREDITS').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('workspace_credit_accounts_updated_at_idx').on(table.updatedAt),
    check('workspace_credit_accounts_balance_nonnegative', sql`${table.balance} >= 0`),
  ],
);

export const workspaceCreditLedgerEntries = pgTable(
  'workspace_credit_ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    workspaceId: text('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').$type<'adjustment' | 'consume' | 'funding' | 'refund'>().notNull(),
    amount: amountNumeric('amount').notNull(),
    balanceAfter: amountNumeric('balance_after').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title'),
    description: text('description'),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('workspace_credit_ledger_entries_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
    uniqueIndex('workspace_credit_ledger_entries_reference_unique').on(
      table.workspaceId,
      table.referenceType,
      table.referenceId,
      table.type,
    ),
  ],
);

export const creditReservations = pgTable(
  'credit_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    payerScopeType: text('payer_scope_type').$type<'personal' | 'workspace'>().notNull(),
    payerUserId: text('payer_user_id').references(() => users.id, { onDelete: 'cascade' }),
    payerWorkspaceId: text('payer_workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    amount: amountNumeric('amount').notNull(),
    actualAmount: amountNumeric('actual_amount'),
    releasedAmount: amountNumeric('released_amount').default(0).notNull(),
    status: text('status')
      .$type<'active' | 'expired' | 'released' | 'settled'>()
      .default('active')
      .notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    settlementLedgerEntryId: uuid('settlement_ledger_entry_id'),
    releaseReason: text('release_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    settledAt: timestamptz('settled_at'),
    releasedAt: timestamptz('released_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('credit_reservations_user_status_expires_idx').on(
      table.payerUserId,
      table.status,
      table.expiresAt,
    ),
    index('credit_reservations_workspace_status_expires_idx').on(
      table.payerWorkspaceId,
      table.status,
      table.expiresAt,
    ),
    check('credit_reservations_amount_positive', sql`${table.amount} > 0`),
    check(
      'credit_reservations_payer_scope_check',
      sql`(${table.payerScopeType} = 'personal' AND ${table.payerUserId} IS NOT NULL AND ${table.payerWorkspaceId} IS NULL) OR (${table.payerScopeType} = 'workspace' AND ${table.payerWorkspaceId} IS NOT NULL AND ${table.payerUserId} IS NULL)`,
    ),
    check(
      'credit_reservations_status_check',
      sql`${table.status} IN ('active', 'expired', 'released', 'settled')`,
    ),
  ],
);

export type CreditReservationItem = typeof creditReservations.$inferSelect;
export type WorkspaceCreditAccountItem = typeof workspaceCreditAccounts.$inferSelect;
export type WorkspaceCreditLedgerEntryItem = typeof workspaceCreditLedgerEntries.$inferSelect;

export const topUpOrders = pgTable(
  'top_up_orders',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    status: text('status').$type<TopUpOrderStatusType>().notNull().default('pending'),
    credits: amountNumeric('credits').notNull().default(0),
    amount: amountNumeric('amount').notNull().default(0),
    currency: varchar('currency', { length: 16 }).notNull().default('USD'),

    provider: text('provider'),
    externalOrderId: text('external_order_id'),
    source: text('source').$type<TopUpOrderSourceType>(),
    redemptionCodeId: text('redemption_code_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    paidAt: timestamptz('paid_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('top_up_orders_user_id_idx').on(table.userId),
    uniqueIndex('top_up_orders_external_order_id_idx').on(table.provider, table.externalOrderId),
    uniqueIndex('top_up_orders_redemption_code_unique')
      .on(table.redemptionCodeId)
      .where(sql`${table.redemptionCodeId} IS NOT NULL`),
  ],
);

export type NewTopUpOrder = typeof topUpOrders.$inferInsert;
export type TopUpOrderItem = typeof topUpOrders.$inferSelect;

export const referralProfiles = pgTable(
  'referral_profiles',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .primaryKey()
      .notNull(),

    code: varchar('code', { length: 8 }).notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('referral_profiles_code_idx').on(table.code)],
);

export type NewReferralProfile = typeof referralProfiles.$inferInsert;
export type ReferralProfileItem = typeof referralProfiles.$inferSelect;

export const referralRelations = pgTable(
  'referral_relations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    inviterUserId: text('inviter_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    inviteeUserId: text('invitee_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    code: text('code'),
    status: text('status').$type<ReferralStatusString>().notNull().default('registered'),
    rewardCredits: amountNumeric('reward_credits').notNull().default(0),
    rewardedAt: timestamptz('rewarded_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('referral_relations_inviter_user_id_idx').on(table.inviterUserId),
    uniqueIndex('referral_relations_invitee_user_id_idx').on(table.inviteeUserId),
  ],
);

export type NewReferralRelation = typeof referralRelations.$inferInsert;
export type ReferralRelationItem = typeof referralRelations.$inferSelect;

export const referralRewards = pgTable(
  'referral_rewards',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    relationId: uuid('relation_id')
      .references(() => referralRelations.id, { onDelete: 'cascade' })
      .notNull(),
    rewardUserId: text('reward_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    role: text('role').$type<'invitee' | 'inviter'>().notNull(),
    amount: amountNumeric('amount').notNull().default(0),
    ledgerEntryId: uuid('ledger_entry_id').references(() => creditLedgerEntries.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: createdAt(),
  },
  (table) => [
    index('referral_rewards_relation_id_idx').on(table.relationId),
    index('referral_rewards_reward_user_id_idx').on(table.rewardUserId),
  ],
);

export type NewReferralReward = typeof referralRewards.$inferInsert;
export type ReferralRewardItem = typeof referralRewards.$inferSelect;

// ============================================================================
// Phase 3: Plan catalog, top-up packages, app settings (admin-managed)
// ============================================================================

export const planCatalog = pgTable('plan_catalog', {
  plan: varchar('plan', { length: 32 }).primaryKey().notNull(),

  displayName: text('display_name').notNull(),
  monthlyCredits: amountNumeric('monthly_credits').notNull().default(0),
  monthlyPrice: amountNumeric('monthly_price').notNull().default(0),
  yearlyPrice: amountNumeric('yearly_price').notNull().default(0),
  currency: varchar('currency', { length: 16 }).notNull().default('USD'),

  features: jsonb('features').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: amountNumeric('sort_order').notNull().default(0),

  modelRules: jsonb('model_rules').$type<PlanModelRules>(),

  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type NewPlanCatalog = typeof planCatalog.$inferInsert;
export type PlanCatalogItem = typeof planCatalog.$inferSelect;

export const pptUsageRecords = pgTable(
  'ppt_usage_records',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: varchar('session_id', { length: 64 }).notNull(),
    docmeeUid: text('docmee_uid').notNull(),
    upstreamTaskId: text('upstream_task_id'),
    status: varchar('status', { length: 32 })
      .$type<'created' | 'editing' | 'generated' | 'failed' | 'canceled' | 'downloaded'>()
      .notNull()
      .default('created'),
    title: text('title'),
    plan: varchar('plan', { length: 32 }),
    creditCost: amountNumeric('credit_cost').notNull().default(0),
    quotaCost: amountNumeric('quota_cost').notNull().default(0),
    chargedLedgerEntryId: uuid('charged_ledger_entry_id').references(() => creditLedgerEntries.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamptz('completed_at'),
  },
  (table) => [
    index('ppt_usage_records_user_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('ppt_usage_records_user_session_idx').on(table.userId, table.sessionId),
    uniqueIndex('ppt_usage_records_user_upstream_task_idx')
      .on(table.userId, table.upstreamTaskId)
      .where(sql`${table.upstreamTaskId} IS NOT NULL`),
  ],
);

export type NewPptUsageRecord = typeof pptUsageRecords.$inferInsert;
export type PptUsageRecordItem = typeof pptUsageRecords.$inferSelect;

export const topUpPackages = pgTable('topup_packages', {
  id: varchar('id', { length: 64 }).primaryKey().notNull(),

  displayName: text('display_name').notNull(),
  credits: amountNumeric('credits').notNull(),
  amount: amountNumeric('amount').notNull(),
  currency: varchar('currency', { length: 16 }).notNull().default('USD'),
  validityMonths: amountNumeric('validity_months').notNull().default(12),

  recommended: boolean('recommended').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: amountNumeric('sort_order').notNull().default(0),

  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type NewTopUpPackage = typeof topUpPackages.$inferInsert;
export type TopUpPackageRow = typeof topUpPackages.$inferSelect;

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 128 }).primaryKey().notNull(),
  value: jsonb('value'),

  description: text('description'),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const appSettingRevisions = pgTable(
  'app_setting_revisions',
  {
    section: varchar('section', { length: 64 }).primaryKey().notNull(),
    revision: integer('revision').default(0).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [check('app_setting_revisions_nonnegative_check', sql`${table.revision} >= 0`)],
);

export type AppSettingRevisionItem = typeof appSettingRevisions.$inferSelect;

export type NewAppSetting = typeof appSettings.$inferInsert;
export type AppSettingItem = typeof appSettings.$inferSelect;

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserId: text('target_user_id'),

    action: varchar('action', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }),
    resourceId: text('resource_id'),

    payload: jsonb('payload').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),

    createdAt: createdAt(),
  },
  (table) => [
    index('admin_audit_logs_actor_idx').on(table.actorUserId),
    index('admin_audit_logs_target_idx').on(table.targetUserId),
    index('admin_audit_logs_action_idx').on(table.action),
    index('admin_audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
export type AdminAuditLogItem = typeof adminAuditLogs.$inferSelect;

/**
 * Redemption codes (卡密) — admin-issued, user-redeemable codes that grant a
 * subscription plan, credit balance, or a top-up package without payment.
 */
export type RedemptionRewardType = 'plan' | 'credits' | 'topup_package';
export type RedemptionStatus = 'active' | 'redeemed' | 'disabled' | 'expired';

export const redemptionCodes = pgTable(
  'redemption_codes',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    code: varchar('code', { length: 64 }).notNull().unique(),
    batchId: varchar('batch_id', { length: 64 }),

    rewardType: varchar('reward_type', { length: 32 }).$type<RedemptionRewardType>().notNull(),

    // For rewardType = 'plan'
    planKey: varchar('plan_key', { length: 32 }),
    planCycle: varchar('plan_cycle', { length: 16 }).$type<SubscriptionCycleType>(),
    planDurationMonths: amountNumeric('plan_duration_months'),

    // For rewardType = 'credits'
    creditsAmount: amountNumeric('credits_amount'),

    // For rewardType = 'topup_package'
    topupPackageId: varchar('topup_package_id', { length: 64 }),

    note: text('note'),
    status: varchar('status', { length: 16 }).$type<RedemptionStatus>().notNull().default('active'),

    expiresAt: timestamptz('expires_at'),
    redeemedAt: timestamptz('redeemed_at'),
    redeemedByUserId: text('redeemed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('redemption_codes_status_idx').on(table.status),
    index('redemption_codes_batch_idx').on(table.batchId),
    index('redemption_codes_redeemed_user_idx').on(table.redeemedByUserId),
  ],
);

export type NewRedemptionCode = typeof redemptionCodes.$inferInsert;
export type RedemptionCodeItem = typeof redemptionCodes.$inferSelect;
