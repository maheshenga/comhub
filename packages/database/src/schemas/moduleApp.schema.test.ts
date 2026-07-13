import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import * as liveSchema from './index';
import {
  moduleAppActions,
  moduleAppArtifacts,
  moduleAppAuditLogs,
  moduleAppBuilds,
  moduleAppDataRows,
  moduleAppDataSchemas,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppInstallationSecrets,
  moduleAppPackages,
  moduleAppPackageUploads,
  moduleAppPages,
  moduleAppRecordEvents,
  moduleAppRecords,
  moduleAppRuns,
  moduleApps,
  moduleAppSchedules,
  moduleAppVersions,
  moduleAppWebhookDeliveries,
  moduleAppWebhooks,
  moduleAppWorkflowNodes,
  moduleAppWorkflowRuns,
} from './moduleApp';

describe('module app schema exports', () => {
  it('exports all P1 tables', () => {
    expect(moduleApps).toBeDefined();
    expect(moduleAppVersions).toBeDefined();
    expect(moduleAppPages).toBeDefined();
    expect(moduleAppActions).toBeDefined();
    expect(moduleAppEntitlements).toBeDefined();
    expect(moduleAppInstallations).toBeDefined();
    expect(moduleAppRecords).toBeDefined();
    expect(moduleAppRecordEvents).toBeDefined();
    expect(moduleAppRuns).toBeDefined();
    expect(moduleAppArtifacts).toBeDefined();
    expect(moduleAppAuditLogs).toBeDefined();
    expect(moduleAppPackages).toBeDefined();
    expect(moduleAppPackageUploads).toBeDefined();
    expect(moduleAppBuilds).toBeDefined();
    expect(moduleAppInstallationSecrets).toBeDefined();
    expect(moduleAppDataSchemas).toBeDefined();
    expect(moduleAppDataRows).toBeDefined();
    expect(moduleAppWorkflowRuns).toBeDefined();
    expect(moduleAppWorkflowNodes).toBeDefined();
    expect(moduleAppWorkflowNodes.installationId).toBeDefined();
    expect(moduleAppSchedules).toBeDefined();
    expect(moduleAppWebhooks).toBeDefined();
    expect(moduleAppWebhookDeliveries).toBeDefined();
  });

  it('keeps database ownership constraints in the generated migration', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0131_add_module_apps.sql'),
      'utf8',
    );

    expect(migration).toContain('module_app_installations_scope_owner_check');
    expect(migration).toContain('module_app_records_scope_owner_check');
    expect(migration).toContain(
      `WHERE "scope_type" = 'personal' AND "user_id" IS NOT NULL`,
    );
    expect(migration).toContain(
      `WHERE "scope_type" = 'workspace' AND "workspace_id" IS NOT NULL`,
    );
    expect(migration).toContain(`"owner_user_id" IS NOT NULL`);
    expect(migration).toContain(`AND "workspace_id" IS NULL`);
  });

  it('registers the module app migration in the journal', () => {
    const journal = JSON.parse(
      readFileSync(
        path.resolve(__dirname, '../../migrations/meta/_journal.json'),
        'utf8',
      ),
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.some(({ tag }) => tag === '0131_add_module_apps')).toBe(
      true,
    );
  });

  it('registers the module app package review migration', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0132_add_module_app_packages.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(
        path.resolve(__dirname, '../../migrations/meta/_journal.json'),
        'utf8',
      ),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_packages"');
    expect(migration).toContain('"submitted_by_user_id" text');
    expect(migration).toContain('module_app_packages_review_status_created_at_idx');
    expect(journal.entries.some(({ tag }) => tag === '0132_add_module_app_packages')).toBe(
      true,
    );
  });

  it('registers the module app source migration', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0133_add_module_app_source.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'admin' NOT NULL`);
    expect(migration).toContain('module_apps_source_check');
    expect(migration).toContain(`IN ('system', 'admin', 'user', 'developer')`);
    expect(journal.entries.some(({ tag }) => tag === '0133_add_module_app_source')).toBe(true);
  });

  it('registers platform plugin table decommission migration without live schema exports', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0134_drop_platform_plugin_tables.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };
    const tableNames = Object.values(liveSchema).flatMap((value): string[] => {
      try {
        const name = getTableName(value as any);

        return typeof name === 'string' ? [name] : [];
      } catch {
        return [];
      }
    });

    expect(migration).toContain('DROP TABLE IF EXISTS "platform_plugin_audit_logs"');
    expect(migration).toContain('DROP TABLE IF EXISTS "platform_plugins"');
    expect(journal.entries.some(({ tag }) => tag === '0134_drop_platform_plugin_tables')).toBe(
      true,
    );
    expect(tableNames.filter((name) => name.startsWith('platform_plugin'))).toEqual([]);
  });

  it('registers the module app package upload session migration', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0135_add_module_app_package_uploads.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_package_uploads"');
    expect(migration).toContain('module_app_package_uploads_storage_key_unique');
    expect(migration).toContain('module_app_package_uploads_user_status_created_at_idx');
    expect(migration).toContain('module_app_package_uploads_status_expires_at_idx');
    expect(
      journal.entries.some(({ tag }) => tag === '0135_add_module_app_package_uploads'),
    ).toBe(true);
  });

  it('registers immutable build and encrypted installation secret persistence', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0136_add_module_app_build_runtime.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_builds"');
    expect(migration).toContain('module_app_builds_version_id_unique');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_installation_secrets"');
    expect(migration).toContain('"encrypted_value" text NOT NULL');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "runtime_artifact_sha256" text');
    expect(
      journal.entries.some(({ tag }) => tag === '0136_add_module_app_build_runtime'),
    ).toBe(true);
  });

  it('registers installation-bound managed data and workflow persistence', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0137_add_module_app_data_workflows.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "installation_id" uuid');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_data_schemas"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_data_rows"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_workflow_runs"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_workflow_nodes"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_schedules"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_webhooks"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "module_app_webhook_deliveries"');
    expect(migration).toContain('module_app_migration_quarantine');
    expect(journal.entries.some(({ tag }) => tag === '0137_add_module_app_data_workflows')).toBe(
      true,
    );
  });

  it('registers module app commerce accounts, reservations, and ledger persistence', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0138_add_module_app_commerce.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "workspace_credit_accounts"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "workspace_credit_ledger_entries"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "credit_reservations"');
    expect(migration).toContain('"idempotency_key" text NOT NULL UNIQUE');
    expect(migration).toContain('credit_ledger_entries_module_app_reservation_unique_idx');
    expect(journal.entries.some(({ tag }) => tag === '0138_add_module_app_commerce')).toBe(true);
  });

  it('registers an idempotent module app build lease migration', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0144_add_module_app_build_leases.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain("FROM pg_constraint WHERE conname = 'module_app_builds_attempt_count_check'");
    expect(migration).toContain(
      'ALTER TABLE "module_app_builds" ADD CONSTRAINT "module_app_builds_attempt_count_check"',
    );
    expect(
      journal.entries.some(({ tag }) => tag === '0144_add_module_app_build_leases'),
    ).toBe(true);
  });
});
