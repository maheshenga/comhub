import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import * as liveSchema from './index';
import {
  moduleAppActions,
  moduleAppArtifacts,
  moduleAppAuditLogs,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppPages,
  moduleAppPackages,
  moduleAppRecordEvents,
  moduleAppRecords,
  moduleAppRuns,
  moduleApps,
  moduleAppVersions,
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
  });

  it('keeps database ownership constraints in the generated migration', () => {
    const migration = readFileSync(
      resolve(__dirname, '../../migrations/0131_add_module_apps.sql'),
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
        resolve(__dirname, '../../migrations/meta/_journal.json'),
        'utf8',
      ),
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.some(({ tag }) => tag === '0131_add_module_apps')).toBe(
      true,
    );
  });

  it('registers the module app package review migration', () => {
    const migration = readFileSync(
      resolve(__dirname, '../../migrations/0132_add_module_app_packages.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../migrations/meta/_journal.json'),
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
      resolve(__dirname, '../../migrations/0133_add_module_app_source.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'admin' NOT NULL`);
    expect(migration).toContain('module_apps_source_check');
    expect(migration).toContain(`IN ('system', 'admin', 'user', 'developer')`);
    expect(journal.entries.some(({ tag }) => tag === '0133_add_module_app_source')).toBe(true);
  });

  it('registers platform plugin table decommission migration without live schema exports', () => {
    const migration = readFileSync(
      resolve(__dirname, '../../migrations/0134_drop_platform_plugin_tables.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
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
});
