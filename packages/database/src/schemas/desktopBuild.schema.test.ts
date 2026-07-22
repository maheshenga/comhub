import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { getTestDB } from '../core/getTestDB';
import {
  desktopBuildProfileRevisions,
  desktopBuildProfiles,
  desktopReleases,
} from './desktopBuild';

describe('desktop build schema', () => {
  it('defines immutable profile revisions and release uniqueness constraints', () => {
    const revisionConfig = getTableConfig(desktopBuildProfileRevisions);
    const releaseConfig = getTableConfig(desktopReleases);

    expect(revisionConfig.indexes.map((index) => index.config.name)).toContain(
      'desktop_build_profile_revisions_profile_revision_unique',
    );
    expect(releaseConfig.indexes.map((index) => index.config.name)).toContain(
      'desktop_releases_channel_version_unique',
    );
    expect(revisionConfig.checks.map((check) => check.name)).toContain(
      'desktop_build_profile_revisions_state_check',
    );
    expect(releaseConfig.checks.map((check) => check.name)).toContain(
      'desktop_releases_status_check',
    );
  });

  it('uses typed JSONB snapshots and preserves release history through restrictive references', () => {
    const revisionConfig = getTableConfig(desktopBuildProfileRevisions);
    const releaseConfig = getTableConfig(desktopReleases);

    expect(desktopBuildProfiles.currentDraftRevisionId).toBeDefined();
    expect(revisionConfig.columns.find((column) => column.name === 'payload')?.dataType).toBe(
      'json',
    );
    expect(
      revisionConfig.columns.find((column) => column.name === 'asset_manifest')?.dataType,
    ).toBe('json');
    const artifacts = releaseConfig.columns.find((column) => column.name === 'artifacts');
    expect(artifacts?.dataType).toBe('json');
    expect(artifacts?.default).toEqual([]);
    expect(releaseConfig.foreignKeys.map((foreignKey) => foreignKey.getName())).toContain(
      'desktop_releases_frozen_revision_id_desktop_build_profile_revisions_id_fk',
    );
    expect(
      releaseConfig.columns.find((column) => column.name === 'workflow_run_id')?.dataType,
    ).toBe('string');
    expect(
      releaseConfig.columns.find((column) => column.name === 'workflow_run_url')?.dataType,
    ).toBe('string');
    expect(
      releaseConfig.columns.find((column) => column.name === 'revisionless_failed_pre_staging')?.dataType,
    ).toBe('boolean');
  });

  it('registers migration 0149', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0149_add_desktop_build_branding.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "desktop_build_profiles"');
    expect(migration).toContain('desktop_build_profile_revisions_profile_revision_unique');
    expect(migration).toContain('desktop_releases_channel_version_unique');
    expect(migration).toContain('DO $$');
    expect(journal.entries.some(({ tag }) => tag === '0149_add_desktop_build_branding')).toBe(true);
  });

  it('can apply migration 0149 again on PGlite', async () => {
    const db = await getTestDB();
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0149_add_desktop_build_branding.sql'),
      'utf8',
    );
    const statements = migration
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) await db.execute(sql.raw(statement));
    for (const statement of statements) await db.execute(sql.raw(statement));
  });

  it('registers an idempotent workflow-run migration', async () => {
    const db = await getTestDB();
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0150_add_desktop_release_workflow_run.sql'),
      'utf8',
    );
    const statements = migration
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "workflow_run_id"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "workflow_run_url"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "revisionless_failed_pre_staging"');
    for (const statement of statements) await db.execute(sql.raw(statement));
    for (const statement of statements) await db.execute(sql.raw(statement));
  });
});
