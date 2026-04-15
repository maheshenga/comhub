import { bigint, boolean, index, integer, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { createNanoId } from '../utils/idGenerator';
import { createdAt, timestamptz, timestamps } from './_helpers';
import { users } from './user';

// ============ Plans ============

export const plans = pgTable('plans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  priceMonthly: integer('price_monthly').default(0).notNull(),
  priceYearly: integer('price_yearly').default(0).notNull(),
  creditsPerMonth: bigint('credits_per_month', { mode: 'number' }).default(0).notNull(),
  features: jsonb('features').default({}),
  sort: integer('sort').default(0),
  enabled: boolean('enabled').default(true).notNull(),
  ...timestamps,
});

export type PlanItem = typeof plans.$inferSelect;
export type NewPlanItem = typeof plans.$inferInsert;

// ============ User Subscriptions ============

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: text('id')
      .$defaultFn(() => createNanoId(16)())
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    planId: varchar('plan_id', { length: 64 })
      .references(() => plans.id)
      .notNull(),
    status: varchar('status', {
      enum: ['active', 'expired', 'cancelled'],
      length: 20,
    })
      .default('active')
      .notNull(),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at'),
    paymentChannel: varchar('payment_channel', { length: 32 }),
    externalId: text('external_id'),
    ...timestamps,
  },
  (table) => [
    index('user_subscriptions_user_id_idx').on(table.userId),
    index('user_subscriptions_status_idx').on(table.status),
    index('user_subscriptions_expires_at_idx').on(table.expiresAt),
  ],
);

export type UserSubscriptionItem = typeof userSubscriptions.$inferSelect;
export type NewUserSubscriptionItem = typeof userSubscriptions.$inferInsert;

// ============ User Credits ============

export const userCredits = pgTable('user_credits', {
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  balance: bigint('balance', { mode: 'number' }).default(0).notNull(),
  totalEarned: bigint('total_earned', { mode: 'number' }).default(0).notNull(),
  totalConsumed: bigint('total_consumed', { mode: 'number' }).default(0).notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export type UserCreditsItem = typeof userCredits.$inferSelect;
export type NewUserCreditsItem = typeof userCredits.$inferInsert;

// ============ Credit Transactions ============

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: text('id')
      .$defaultFn(() => createNanoId(16)())
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    type: varchar('type', {
      enum: ['subscription_grant', 'usage_deduct', 'redeem', 'admin_adjust', 'referral'],
      length: 32,
    }).notNull(),
    description: text('description'),
    referenceId: text('reference_id'),
    model: varchar('model', { length: 150 }),
    tokensInput: integer('tokens_input'),
    tokensOutput: integer('tokens_output'),
    createdAt: createdAt(),
  },
  (table) => [
    index('credit_transactions_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('credit_transactions_type_created_at_idx').on(table.type, table.createdAt),
  ],
);

export type CreditTransactionItem = typeof creditTransactions.$inferSelect;
export type NewCreditTransactionItem = typeof creditTransactions.$inferInsert;

// ============ Redeem Codes ============

export const redeemCodes = pgTable(
  'redeem_codes',
  {
    id: text('id')
      .$defaultFn(() => createNanoId(16)())
      .primaryKey(),
    code: varchar('code', { length: 32 }).unique().notNull(),
    creditsAmount: bigint('credits_amount', { mode: 'number' }).default(0).notNull(),
    planId: varchar('plan_id', { length: 64 }).references(() => plans.id),
    planDurationDays: integer('plan_duration_days'),
    maxUses: integer('max_uses').default(1).notNull(),
    usedCount: integer('used_count').default(0).notNull(),
    expiresAt: timestamptz('expires_at'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (table) => [
    index('redeem_codes_code_idx').on(table.code),
    index('redeem_codes_created_by_idx').on(table.createdBy),
  ],
);

export type RedeemCodeItem = typeof redeemCodes.$inferSelect;
export type NewRedeemCodeItem = typeof redeemCodes.$inferInsert;

// ============ Redeem Logs ============

export const redeemLogs = pgTable(
  'redeem_logs',
  {
    id: text('id')
      .$defaultFn(() => createNanoId(16)())
      .primaryKey(),
    codeId: text('code_id')
      .references(() => redeemCodes.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    redeemedAt: timestamptz('redeemed_at').notNull().defaultNow(),
  },
  (table) => [
    index('redeem_logs_code_id_idx').on(table.codeId),
    index('redeem_logs_user_id_idx').on(table.userId),
    uniqueIndex('redeem_logs_code_id_user_id_unique').on(table.codeId, table.userId),
  ],
);

export type RedeemLogItem = typeof redeemLogs.$inferSelect;
export type NewRedeemLogItem = typeof redeemLogs.$inferInsert;
