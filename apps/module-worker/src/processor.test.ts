import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

import type { ClaimedModuleAppBuild } from '@lobechat/database/models/moduleAppBuild';
import {
  ModuleAppBuildPolicyError,
  type ModuleAppObjectStorage,
} from '@lobechat/module-app-build';
import type { ModuleAppPackageManifest } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import { loadModuleAppWorkerConfig } from './config';
import { ModuleAppWorkerError } from './errors';
import {
  processModuleAppBuild,
  type ProcessModuleAppBuildDependencies,
} from './processor';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

type ManifestV2 = Extract<ModuleAppPackageManifest, { manifestVersion: 2 }>;

const manifest = {
  build: { frontend: { output: 'dist', profile: 'node22-static' } },
  manifestVersion: 2,
  runtime: { functions: [] },
} as unknown as ManifestV2;

const claim: ClaimedModuleAppBuild = {
  attemptCount: 1,
  buildProfile: 'node22-static',
  claimExpiresAt: new Date('2026-07-13T00:01:00.000Z'),
  claimToken: 'claim-token',
  id: 'build-id',
  manifestSnapshot: manifest,
  sourceSha256: 'a'.repeat(64),
  sourceStorageKey: 'module-app-sources/source.zip',
  status: 'building',
  workerId: 'worker-id',
};

const createDependencies = (
  overrides: Partial<ProcessModuleAppBuildDependencies> = {},
) => {
  const order: string[] = [];
  const sourceBytes = new TextEncoder().encode('source');
  const artifactBytes = new TextEncoder().encode('artifact');
  const artifactSha256 = createHash('sha256')
    .update(artifactBytes)
    .digest('hex');
  const artifactKey = `module-app-builds/${claim.id}/${artifactSha256}.tgz`;
  const storage: ModuleAppObjectStorage = {
    deleteObject: vi.fn(async () => undefined),
    getObject: vi.fn(async ({ key }) => {
      order.push(
        key === claim.sourceStorageKey
          ? 'download-source'
          : 'download-promoted',
      );
      return key === claim.sourceStorageKey ? sourceBytes : artifactBytes;
    }),
    headObject: vi.fn(async () => ({
      contentLength: artifactBytes.byteLength,
    })),
    putObject: vi.fn(async () => undefined),
  };
  const buildModel = {
    complete: vi.fn(async () => {
      order.push('complete');
      return {};
    }),
    fail: vi.fn(async () => ({})),
    retry: vi.fn(async () => ({})),
  };
  const dependencies: ProcessModuleAppBuildDependencies = {
    artifactRoot: '/runtime/artifacts',
    buildArtifact: vi.fn(async () => {
      order.push('build-artifact');
      return { bytes: artifactBytes, sha256: artifactSha256 };
    }),
    buildModel,
    logger: { error: vi.fn() },
    materializeArtifact: vi.fn(async () => {
      order.push('materialize');
      return {
        directory: `/runtime/artifacts/${artifactSha256}`,
        reused: false,
      };
    }),
    metrics: { recordStagingCleanupFailure: vi.fn() },
    now: () => new Date('2026-07-13T00:00:00.000Z'),
    publishArtifact: vi.fn(async () => {
      order.push('publish-artifact');
      return { artifactKey, artifactSha256 };
    }),
    storage,
    validateSource: vi.fn(async () => {
      order.push('validate-source');
      return { files: { 'dist/index.html': sourceBytes }, manifest };
    }),
    ...overrides,
  };

  return {
    artifactKey,
    artifactSha256,
    buildModel,
    dependencies,
    order,
    storage,
  };
};

describe('loadModuleAppWorkerConfig', () => {
  it('loads required settings and secure worker defaults', () => {
    expect(
      loadModuleAppWorkerConfig({
        DATABASE_URL: 'postgresql://worker:secret@db/comhub',
        MODULE_APP_ARTIFACT_ROOT: '/runtime/artifacts',
        S3_ACCESS_KEY_ID: 'key',
        S3_BUCKET: 'comhub',
        S3_ENDPOINT: 'http://s3:9000',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toMatchObject({
      artifactRoot: '/runtime/artifacts',
      cleanupIntervalMs: 600_000,
      leaseDurationMs: 60_000,
      leaseRenewalIntervalMs: 20_000,
      maxAttempts: 4,
      maxRetries: 3,
      pollIntervalMs: 5000,
      retryDelaysMs: [30_000, 120_000, 600_000],
      s3EnablePathStyle: true,
      s3Region: 'auto',
      shutdownTimeoutMs: 40_000,
      staleStagingMs: 3_600_000,
    });
  });

  it('rejects missing secrets, invalid booleans, and relative artifact roots', () => {
    const base = {
      DATABASE_URL: 'postgresql://worker:secret@db/comhub',
      MODULE_APP_ARTIFACT_ROOT: '/runtime/artifacts',
      S3_ACCESS_KEY_ID: 'key',
      S3_BUCKET: 'comhub',
      S3_ENDPOINT: 'http://s3:9000',
      S3_SECRET_ACCESS_KEY: 'secret',
    };

    expect(() =>
      loadModuleAppWorkerConfig({ ...base, S3_SECRET_ACCESS_KEY: '' }),
    ).toThrow('MODULE_APP_WORKER_CONFIG_INVALID');
    expect(() =>
      loadModuleAppWorkerConfig({ ...base, S3_ENABLE_PATH_STYLE: 'yes' }),
    ).toThrow('MODULE_APP_WORKER_CONFIG_INVALID');
    expect(() =>
      loadModuleAppWorkerConfig({
        ...base,
        MODULE_APP_ARTIFACT_ROOT: 'runtime/artifacts',
      }),
    ).toThrow('MODULE_APP_WORKER_CONFIG_INVALID');
  });
});

describe('processModuleAppBuild', () => {
  it('processes a build in the required verified order and completes it', async () => {
    const { artifactKey, artifactSha256, buildModel, dependencies, order } =
      createDependencies();

    await expect(processModuleAppBuild(claim, dependencies)).resolves.toBe(
      'ready',
    );

    expect(order).toEqual([
      'download-source',
      'validate-source',
      'build-artifact',
      'publish-artifact',
      'download-promoted',
      'materialize',
      'complete',
    ]);
    expect(buildModel.complete).toHaveBeenCalledWith({
      artifactKey,
      artifactSha256,
      buildId: claim.id,
      claimToken: claim.claimToken,
    });
    expect(buildModel.fail).not.toHaveBeenCalled();
    expect(buildModel.retry).not.toHaveBeenCalled();
  });

  it('fails a permanent validation error with only its bounded code', async () => {
    const { buildModel, dependencies } = createDependencies({
      validateSource: vi.fn(async () => {
        throw new ModuleAppBuildPolicyError(
          'MODULE_APP_BUILD_SOURCE_POLICY_REJECTED',
          'secret package detail',
        );
      }),
    });

    await expect(processModuleAppBuild(claim, dependencies)).resolves.toBe(
      'failed',
    );

    expect(buildModel.fail).toHaveBeenCalledWith({
      buildId: claim.id,
      claimToken: claim.claimToken,
      failureCode: 'MODULE_APP_BUILD_SOURCE_POLICY_REJECTED',
    });
    expect(dependencies.logger!.error).toHaveBeenCalledWith({
      attempt: 1,
      buildId: claim.id,
      code: 'MODULE_APP_BUILD_SOURCE_POLICY_REJECTED',
      outcome: 'failed',
    });
  });

  it.each([
    [1, 30_000],
    [2, 120_000],
    [3, 600_000],
  ])(
    'retries retryable attempt %i after %i milliseconds',
    async (attemptCount, delayMs) => {
      const retryClaim = { ...claim, attemptCount };
      const { buildModel, dependencies } = createDependencies({
        validateSource: vi.fn(async () => {
          throw new ModuleAppWorkerError(
            'MODULE_APP_BUILD_SOURCE_DOWNLOAD_FAILED',
            'retryable',
          );
        }),
      });

      await expect(
        processModuleAppBuild(retryClaim, dependencies),
      ).resolves.toBe('retried');

      expect(buildModel.retry).toHaveBeenCalledWith({
        buildId: claim.id,
        claimToken: claim.claimToken,
        failureCode: 'MODULE_APP_BUILD_SOURCE_DOWNLOAD_FAILED',
        nextAttemptAt: new Date(
          `2026-07-13T00:${delayMs === 30_000 ? '00:30' : delayMs === 120_000 ? '02:00' : '10:00'}.000Z`,
        ),
      });
    },
  );

  it('fails the fourth retryable attempt as exhausted', async () => {
    const { buildModel, dependencies } = createDependencies({
      validateSource: vi.fn(async () => {
        throw new ModuleAppWorkerError(
          'MODULE_APP_BUILD_S3_READ_FAILED',
          'retryable',
        );
      }),
    });

    await expect(
      processModuleAppBuild({ ...claim, attemptCount: 4 }, dependencies),
    ).resolves.toBe('failed');
    expect(buildModel.fail).toHaveBeenCalledWith({
      buildId: claim.id,
      claimToken: claim.claimToken,
      failureCode: 'MODULE_APP_BUILD_RETRY_EXHAUSTED',
    });
    expect(buildModel.retry).not.toHaveBeenCalled();
  });

  it('maps unknown errors to a bounded internal failure without leaking details', async () => {
    const { buildModel, dependencies } = createDependencies({
      buildArtifact: vi.fn(async () => {
        throw new Error('database-password stack-like detail');
      }),
    });

    await expect(processModuleAppBuild(claim, dependencies)).resolves.toBe(
      'failed',
    );
    expect(buildModel.fail).toHaveBeenCalledWith({
      buildId: claim.id,
      claimToken: claim.claimToken,
      failureCode: 'MODULE_APP_BUILD_INTERNAL_FAILED',
    });
    expect(dependencies.logger!.error).toHaveBeenCalledWith({
      attempt: 1,
      buildId: claim.id,
      code: 'MODULE_APP_BUILD_INTERNAL_FAILED',
      outcome: 'failed',
    });
  });

  it('stops on lease loss without attempting another state write', async () => {
    const { buildModel, dependencies } = createDependencies();
    buildModel.complete.mockRejectedValueOnce(
      new Error('MODULE_APP_BUILD_LEASE_LOST'),
    );

    await expect(processModuleAppBuild(claim, dependencies)).resolves.toBe(
      'failed',
    );

    expect(buildModel.complete).toHaveBeenCalledTimes(1);
    expect(buildModel.fail).not.toHaveBeenCalled();
    expect(buildModel.retry).not.toHaveBeenCalled();
    expect(dependencies.logger!.error).toHaveBeenCalledWith({
      attempt: 1,
      buildId: claim.id,
      code: 'MODULE_APP_BUILD_LEASE_LOST',
      outcome: 'lease_lost',
    });
  });

  it('does not start package processes or package-controlled network requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { dependencies } = createDependencies();

    await processModuleAppBuild(claim, dependencies);

    expect(spawn).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
