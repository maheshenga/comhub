import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { creditLedgerEntries, subscriptionChangeRequests, userPlanSnapshots } from './commercial';

const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((index) => index.config.name);

describe('commercial database invariants', () => {
  it('declares partial unique indexes in the live Drizzle schema', () => {
    expect(indexNames(userPlanSnapshots)).toContain(
      'user_plan_snapshots_one_active_per_user_unique',
    );
    expect(indexNames(subscriptionChangeRequests)).toContain(
      'subscription_change_requests_one_pending_per_user_unique',
    );
    expect(indexNames(creditLedgerEntries)).toContain(
      'credit_ledger_entries_subscription_period_unique',
    );
  });

  it('ships a data-safe migration before creating the unique indexes', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0146_harden_commercial_invariants.sql'),
      'utf8',
    );

    expect(migration).toContain('user_plan_snapshots_one_active_per_user_unique');
    expect(migration).toContain('subscription_change_requests_one_pending_per_user_unique');
    expect(migration).toContain('credit_ledger_entries_subscription_period_unique');
    expect(migration).toContain("'subscription_snapshot_period_legacy_duplicate'");
    expect(migration).toContain("'legacyDuplicateReferenceType'");
    expect(migration).not.toContain('DELETE FROM "credit_ledger_entries"');

    const cleanupPosition = migration.indexOf('WITH ranked_active_snapshots');
    const activeIndexPosition = migration.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS "user_plan_snapshots_one_active_per_user_unique"',
    );
    expect(cleanupPosition).toBeGreaterThanOrEqual(0);
    expect(activeIndexPosition).toBeGreaterThan(cleanupPosition);
  });

  it('registers the commercial invariant migration in the journal', () => {
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.some(({ tag }) => tag === '0146_harden_commercial_invariants')).toBe(
      true,
    );
  });
});
