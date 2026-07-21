import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

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
    expect(releaseConfig.columns.find((column) => column.name === 'artifacts')?.dataType).toBe(
      'json',
    );
    expect(releaseConfig.foreignKeys.map((foreignKey) => foreignKey.getName())).toContain(
      'desktop_releases_frozen_revision_id_desktop_build_profile_revisions_id_fk',
    );
  });

  it('registers migration 0149', () => {
    const migration = readFileSync(
      path.resolve(__dirname, '../../migrations/0149_add_desktop_build_branding.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(migration).toContain('CREATE TABLE "desktop_build_profiles"');
    expect(migration).toContain('desktop_build_profile_revisions_profile_revision_unique');
    expect(migration).toContain('desktop_releases_channel_version_unique');
    expect(journal.entries.some(({ tag }) => tag === '0149_add_desktop_build_branding')).toBe(true);
  });
});
