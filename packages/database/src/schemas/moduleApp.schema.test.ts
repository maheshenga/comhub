import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  moduleAppActions,
  moduleAppArtifacts,
  moduleAppAuditLogs,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppPages,
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
});
