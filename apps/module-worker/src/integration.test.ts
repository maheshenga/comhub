// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import { describe, expect, it } from 'vitest';

import type { ModuleAppWorkerFixtureState } from '../../../scripts/fixtures/moduleAppWorkerFixture.mts';

const { Pool } = pg;
const deadlineMs = 120_000;
const integrationRequired = process.env.MODULE_APP_WORKER_INTEGRATION_REQUIRED === 'true';
const phase = process.env.MODULE_APP_WORKER_INTEGRATION_PHASE;

if (integrationRequired && !['runtime', 'worker'].includes(phase ?? '')) {
  throw new Error('MODULE_APP_WORKER_INTEGRATION_PHASE_REQUIRED');
}

const requireEnvironment = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing integration environment: ${key}`);
  return value;
};

const loadState = async () =>
  JSON.parse(
    await readFile(requireEnvironment('MODULE_APP_WORKER_FIXTURE_STATE'), 'utf8'),
  ) as ModuleAppWorkerFixtureState;

const waitForBuild = async (buildId: string, expectedStatus: 'failed' | 'ready') => {
  const pool = new Pool({ connectionString: requireEnvironment('DATABASE_URL'), max: 1 });
  const deadline = Date.now() + deadlineMs;
  try {
    while (Date.now() < deadline) {
      const result = await pool.query<{
        artifact_key: string | null;
        artifact_sha256: string | null;
        failure_code: string | null;
        status: string;
      }>(
        `SELECT status, artifact_key, artifact_sha256, failure_code
         FROM module_app_builds WHERE id = $1`,
        [buildId],
      );
      const row = result.rows[0];
      if (row?.status === expectedStatus) return row;
      if (row?.status === 'failed' || row?.status === 'ready') {
        throw new Error(`Build ${buildId} reached unexpected status ${row.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Build ${buildId} did not reach ${expectedStatus} within ${deadlineMs}ms`);
  } finally {
    await pool.end();
  }
};

const createS3 = () =>
  new S3Client({
    credentials: {
      accessKeyId: requireEnvironment('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnvironment('S3_SECRET_ACCESS_KEY'),
    },
    endpoint: requireEnvironment('S3_ENDPOINT'),
    forcePathStyle: true,
    region: 'auto',
  });

const runWorkerContainerCommand = (args: string[]) => {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      requireEnvironment('MODULE_APP_WORKER_COMPOSE_FILE'),
      '--profile',
      'worker',
      'exec',
      '-T',
      'module-app-worker',
      ...args,
    ],
    { encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  return result;
};

describe.skipIf(!integrationRequired || phase !== 'worker')(
  'module worker real integration',
  () => {
    it(
      'moves one approved manifest v2 ZIP from queued to ready with identical S3, database, and local identities',
      async () => {
        const state = await loadState();
        const row = await waitForBuild(state.ready.buildId, 'ready');

        expect(row.artifact_key).toBe(state.ready.expectedArtifactKey);
        expect(row.artifact_sha256).toBe(state.ready.expectedArtifactSha256);
        expect(row.failure_code).toBeNull();

        const response = await createS3().send(
          new GetObjectCommand({
            Bucket: requireEnvironment('S3_BUCKET'),
            Key: state.ready.expectedArtifactKey,
          }),
        );
        const bytes = new Uint8Array(await response.Body!.transformToByteArray());
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.artifact_sha256);

        const materialized = path.posix.join(
          '/runtime/artifacts',
          state.ready.expectedArtifactSha256,
          'dist',
          'index.html',
        );
        const localFile = runWorkerContainerCommand(['cat', materialized]);
        expect(localFile.status, localFile.stderr).toBe(0);
        expect(localFile.stdout).toBe(state.expectedHtml);
      },
      deadlineMs + 10_000,
    );

    it(
      'fails a tampered source with a bounded code and creates no final object or content directory',
      async () => {
        const state = await loadState();
        const row = await waitForBuild(state.tampered.buildId, 'failed');

        expect(row.failure_code).toBe('MODULE_APP_BUILD_SOURCE_HASH_MISMATCH');
        expect(row.failure_code).toMatch(/^MODULE_APP_[A-Z0-9_]{1,96}$/);
        expect(row.artifact_key).toBeNull();
        expect(row.artifact_sha256).toBeNull();
        await expect(
          createS3().send(
            new HeadObjectCommand({
              Bucket: requireEnvironment('S3_BUCKET'),
              Key: state.tampered.expectedArtifactKey,
            }),
          ),
        ).rejects.toBeDefined();
        const contentDirectory = path.posix.join(
          '/runtime/artifacts',
          state.tampered.expectedArtifactSha256,
        );
        const localDirectory = runWorkerContainerCommand([
          'sh',
          '-ec',
          'test ! -e "$1"',
          'sh',
          contentDirectory,
        ]);
        expect(localDirectory.status, localDirectory.stderr).toBe(0);
      },
      deadlineMs + 10_000,
    );
  },
);

describe.skipIf(!integrationRequired || phase !== 'runtime')(
  'module runtime real integration',
  () => {
    it('serves the worker-materialized frontend through the runtime artifact route', async () => {
      const state = await loadState();
      const response = await fetch(
        `${requireEnvironment('MODULE_APP_RUNTIME_URL')}/artifacts/${state.ready.expectedArtifactSha256}/dist/index.html`,
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe(state.expectedHtml);
    }, 30_000);
  },
);
