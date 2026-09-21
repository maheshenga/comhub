import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);

export const V2217_APPEND_TAGS = [
  '0158_file_upload_reservations',
  '0159_task_activities',
  '0160_acceptance_check_assets',
  '0161_acceptance_comments',
];

export const V2218_APPEND_TAGS = [
  '0162_fts_capture_version',
  '0163_environments',
  '0164_document_comment_selection_anchor',
  '0165_expertise_rejection_provenance',
  '0166_device_architecture',
];

const readJournal = (rootDirectory) => {
  const migrationsDirectory = path.join(rootDirectory, 'packages/database/migrations');
  const journalPath = path.join(migrationsDirectory, 'meta/_journal.json');

  if (!existsSync(journalPath)) {
    throw new Error(`Migration journal not found: ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));

  if (!Array.isArray(journal.entries)) {
    throw new Error('Migration journal does not contain an entries array');
  }

  return { journal, migrationsDirectory };
};

const sha256 = (content) => createHash('sha256').update(content).digest('hex');

/**
 * Validate the checked-in migration journal without connecting to a database.
 * Historical duplicate numeric prefixes are reported as warnings because the
 * journal tag and timestamp, rather than the filename prefix, identify a
 * migration to Drizzle.
 */
export const verifyMigrationChain = ({
  rootDirectory = path.resolve(scriptDirectory, '..'),
} = {}) => {
  const { journal, migrationsDirectory } = readJournal(rootDirectory);
  const entries = journal.entries;
  const errors = [];
  const warnings = [];
  const tags = new Map();
  const whens = new Map();
  const indexes = new Map();
  const duplicateIndexes = [];
  const files = [];

  if (journal.dialect !== 'postgresql') {
    errors.push(`Expected a PostgreSQL journal, received ${String(journal.dialect)}`);
  }

  for (const [position, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') {
      errors.push(`Entry ${position} is not an object`);
      continue;
    }

    const { idx, tag, when } = entry;
    if (!Number.isInteger(idx) || !Number.isInteger(when) || typeof tag !== 'string' || !tag) {
      errors.push(`Entry ${position} has invalid idx, tag, or when`);
      continue;
    }

    if (tags.has(tag)) {
      errors.push(`Duplicate migration tag: ${tag}`);
    } else {
      tags.set(tag, position);
    }

    if (whens.has(when)) {
      errors.push(`Duplicate migration timestamp ${when}: ${tag} and ${whens.get(when)}`);
    } else {
      whens.set(when, tag);
    }

    if (indexes.has(idx)) {
      duplicateIndexes.push({ firstTag: indexes.get(idx), idx, tag });
    } else {
      indexes.set(idx, tag);
    }

    const sqlPath = path.join(migrationsDirectory, `${tag}.sql`);
    if (!existsSync(sqlPath)) {
      errors.push(`SQL file missing for ${tag}: ${sqlPath}`);
      continue;
    }

    const sql = readFileSync(sqlPath, 'utf8');
    if (!sql.trim()) {
      errors.push(`SQL file is empty for ${tag}`);
    }
    files.push({ path: sqlPath, sha256: sha256(sql), tag, when });
  }

  if (duplicateIndexes.length > 0) {
    warnings.push(
      `Historical duplicate idx values found (${duplicateIndexes.length}); preserving journal order because migration tags and timestamps identify Drizzle migrations`,
    );
  }

  const verifyAppend = (version, expectedTags) => {
    const appendStart = entries.findIndex((entry) => entry.tag === expectedTags[0]);
    if (appendStart < 0) {
      errors.push(`Missing ${version} append migration: ${expectedTags[0]}`);
      return;
    }

    const appendEntries = entries.slice(appendStart, appendStart + expectedTags.length);
    const actualAppendTags = appendEntries.map((entry) => entry.tag);

    if (actualAppendTags.join('\u0000') !== expectedTags.join('\u0000')) {
      errors.push(
        `${version} migrations are not contiguous: expected ${expectedTags.join(', ')}, got ${actualAppendTags.join(', ')}`,
      );
    }

    const previousEntries = entries.slice(0, appendStart);
    const previousMaxWhen = Math.max(...previousEntries.map((entry) => entry.when));

    appendEntries.forEach((entry, index) => {
      if (entry.when <= previousMaxWhen) {
        errors.push(
          `${version} migration ${entry.tag} timestamp ${entry.when} is not after the legacy cutoff ${previousMaxWhen}`,
        );
      }
      if (index > 0 && entry.when <= appendEntries[index - 1].when) {
        errors.push(`${version} migration timestamps are not strictly increasing at ${entry.tag}`);
      }
    });
  };

  verifyAppend('v2.2.17', V2217_APPEND_TAGS);
  verifyAppend('v2.2.18', V2218_APPEND_TAGS);

  const summary = {
    appendTags: V2217_APPEND_TAGS,
    entryCount: entries.length,
    fileCount: files.length,
    legacyDuplicateIndexCount: duplicateIndexes.length,
    migrationFiles: files,
    v2218AppendTags: V2218_APPEND_TAGS,
  };

  return { errors, warnings, summary };
};

const isMainModule = path.resolve(process.argv[1] ?? '') === scriptPath;

if (isMainModule) {
  try {
    const result = verifyMigrationChain();

    for (const warning of result.warnings) console.warn(`[migration-check] warning: ${warning}`);
    for (const error of result.errors) console.error(`[migration-check] error: ${error}`);

    if (result.errors.length > 0) {
      process.exitCode = 1;
    } else {
      console.log(
        `[migration-check] OK: ${result.summary.entryCount} journal entries and ${result.summary.fileCount} SQL files; v2.2.17 and v2.2.18 appends verified`,
      );
    }
  } catch (error) {
    console.error(
      `[migration-check] error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
