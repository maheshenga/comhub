// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readMigrationFiles } from 'drizzle-orm/migrator';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const migrationTag = '0129_workspace_device_and_ai_infra_surrogate_pk';

const readMigration = () => readFileSync(join(migrationsDir, `${migrationTag}.sql`), 'utf8');

describe('ComHub v2.2.7 workspace/device/aiInfra migration chain', () => {
  it('appends the upstream structural migration as a later ComHub migration', () => {
    const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string; when: number }[];
    };

    const tags = journal.entries.map((entry) => entry.tag);
    expect(tags).toContain(migrationTag);
    expect(tags).not.toContain('0111_workspace_device_and_ai_infra_surrogate_pk');
    expect(tags.filter((tag) => tag === migrationTag)).toHaveLength(1);

    const entryIndex = journal.entries.findIndex((entry) => entry.tag === migrationTag);
    const entry = journal.entries[entryIndex];
    const previousEntries = journal.entries.slice(0, entryIndex);

    expect(entry.idx).toBeGreaterThan(Math.max(...previousEntries.map((item) => item.idx)));
    expect(entry.when).toBeGreaterThan(Math.max(...previousEntries.map((item) => item.when)));

    const migrations = readMigrationFiles({ migrationsFolder: migrationsDir });
    const lastMigration = migrations.at(-1);

    expect(lastMigration?.folderMillis).toBe(entry.when);
    expect(lastMigration?.sql[0]).toContain('ComHub carry-forward of upstream v2.2.7');
  });

  it('contains the v2.2.7 aiInfra, device, and workspace structural changes', () => {
    expect(existsSync(join(migrationsDir, `${migrationTag}.sql`))).toBe(true);

    const sql = readMigration();

    expect(sql).toContain('UPDATE "ai_providers" SET "_id" = gen_random_uuid()');
    expect(sql).toContain('UPDATE "ai_models" SET "_id" = gen_random_uuid()');
    expect(sql).toContain('ALTER TABLE "ai_providers" ALTER COLUMN "_id" SET NOT NULL');
    expect(sql).toContain('ALTER TABLE "ai_models" ALTER COLUMN "_id" SET NOT NULL');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "ai_providers_id_user_id_pk"');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "ai_models_id_provider_id_user_id_pk"');
    expect(sql).toContain('ADD CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("_id")');
    expect(sql).toContain('ADD CONSTRAINT "ai_models_pkey" PRIMARY KEY ("_id")');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "ai_providers_id_user_id_unique"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "ai_providers_id_user_id_workspace_id_unique"',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_id_provider_id_user_id_unique"',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_id_provider_id_user_id_workspace_id_unique"',
    );
    expect(sql).toContain('DROP INDEX IF EXISTS "devices_user_id_device_id_unique"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "frozen" boolean DEFAULT false');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "frozen_reason" text');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "frozen_at" timestamp with time zone');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "devices_workspace_id_device_id_unique"',
    );
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "devices_user_id_device_id_unique"');
  });
});
