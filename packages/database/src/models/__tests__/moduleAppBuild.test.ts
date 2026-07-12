// @vitest-environment node
import { moduleAppPackageManifestSchema } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppBuilds,
  moduleAppPackages,
  moduleApps,
  moduleAppVersions,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppBuildModel } from '../moduleAppBuild';

const USER_ID = 'module-app-build-user';
const NOW = new Date('2026-07-11T01:00:00.000Z');
const serverDB: LobeChatDatabase = await getTestDB();

const createClock = () => {
  let value = NOW;

  return {
    now: () => value,
    set: (next: Date) => {
      value = next;
    },
  };
};

const buildManifest = moduleAppPackageManifestSchema.parse({
  app: {
    actions: [],
    appType: 'hybrid_app',
    billing: {},
    category: 'business',
    description: 'Build test app.',
    displayName: 'Build Test',
    icon: 'Package',
    pages: [],
    slug: 'build-test',
    tags: [],
  },
  build: { frontend: { output: 'dist', profile: 'node22-static' } },
  entitlements: [],
  manifestVersion: 2,
  packageVersion: '1.0.0',
  runtime: { functions: [], permissions: [] },
});

const createPackageVersion = async () => {
  const [app] = await serverDB
    .insert(moduleApps)
    .values({
      appType: 'hybrid_app',
      category: 'business',
      description: 'Build test app.',
      displayName: 'Build Test',
      icon: 'Package',
      slug: `build-test-${crypto.randomUUID()}`,
    })
    .returning();
  const [version] = await serverDB
    .insert(moduleAppVersions)
    .values({ appId: app.id, version: '1.0.0' })
    .returning();
  const [packageRow] = await serverDB
    .insert(moduleAppPackages)
    .values({
      appId: app.id,
      archive: {
        fileName: 'build.zip',
        mimeType: 'application/zip',
        sha256: 'a'.repeat(64),
        sizeBytes: 100,
        storageKey: 'module-app-packages/build.zip',
      },
      fileManifest: [{ path: 'module-app.yaml', sizeBytes: 100 }],
      manifestSnapshot: {
        ...buildManifest,
        app: { ...buildManifest.app, slug: app.slug },
      },
      reviewStatus: 'approved',
      submittedByUserId: USER_ID,
      validationReport: [],
      versionId: version.id,
    })
    .returning();

  return { packageId: packageRow.id, versionId: version.id };
};

beforeEach(async () => {
  await serverDB.delete(moduleAppBuilds);
  await serverDB.delete(moduleAppPackages);
  await serverDB.delete(moduleAppVersions);
  await serverDB.delete(moduleApps);
  await serverDB.delete(users);
  await serverDB.insert(users).values({ id: USER_ID });
});

describe('ModuleAppBuildModel', () => {
  it('claims a queued build with a lease and completes it immutably', async () => {
    const ids = await createPackageVersion();
    const clock = createClock();
    const model = new ModuleAppBuildModel(serverDB, { now: clock.now });
    const build = await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: 'b'.repeat(64),
      versionId: ids.versionId,
    });

    const claim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'builder-1' });
    expect(claim).toMatchObject({
      attemptCount: 1,
      id: build.id,
      claimExpiresAt: new Date(NOW.getTime() + 60_000),
      sourceStorageKey: 'module-app-packages/build.zip',
      status: 'building',
      workerId: 'builder-1',
    });
    expect(claim?.claimToken).toEqual(expect.any(String));
    await expect(model.getById(build.id)).resolves.toMatchObject({ id: build.id });
    await expect(model.claimNext({ leaseDurationMs: 60_000, workerId: 'builder-2' })).resolves.toBeNull();

    const completed = await model.complete({
      artifactKey: 'module-app-builds/app/hash.tgz',
      artifactSha256: 'c'.repeat(64),
      buildId: build.id,
      claimToken: claim!.claimToken,
    });
    expect(completed).toMatchObject({
      artifactSha256: 'c'.repeat(64),
      claimExpiresAt: null,
      claimToken: null,
      status: 'ready',
      workerId: null,
    });
    await expect(
      model.complete({
        artifactKey: 'module-app-builds/app/other.tgz',
        artifactSha256: 'd'.repeat(64),
        buildId: build.id,
        claimToken: claim!.claimToken,
      }),
    ).rejects.toThrow('MODULE_APP_BUILD_IMMUTABLE');
  });

  it('does not return the same queued row to concurrent claimers', async () => {
    const ids = await createPackageVersion();
    const model = new ModuleAppBuildModel(serverDB, { now: () => NOW });
    await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: 'e'.repeat(64),
      versionId: ids.versionId,
    });

    const results = await Promise.all([
      model.claimNext({ leaseDurationMs: 60_000, workerId: 'builder-a' }),
      model.claimNext({ leaseDurationMs: 60_000, workerId: 'builder-b' }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('reclaims an expired lease with a fresh token and denies stale mutations', async () => {
    const ids = await createPackageVersion();
    const clock = createClock();
    const model = new ModuleAppBuildModel(serverDB, { now: clock.now });
    const build = await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: 'f'.repeat(64),
      versionId: ids.versionId,
    });

    const first = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-a' });
    expect(first).toMatchObject({ attemptCount: 1, status: 'building', workerId: 'worker-a' });

    await expect(
      model.renewLease({
        buildId: first!.id,
        claimToken: 'stale-token',
        leaseDurationMs: 60_000,
      }),
    ).rejects.toThrow('MODULE_APP_BUILD_LEASE_LOST');
    await expect(
      model.retry({
        buildId: first!.id,
        claimToken: 'stale-token',
        failureCode: 'MODULE_APP_BUILD_TEMPORARY_FAILURE',
        nextAttemptAt: new Date(clock.now().getTime() + 30_000),
      }),
    ).rejects.toThrow('MODULE_APP_BUILD_LEASE_LOST');
    await expect(
      model.fail({
        buildId: first!.id,
        claimToken: 'stale-token',
        failureCode: 'MODULE_APP_BUILD_WORKER_FAILED',
      }),
    ).rejects.toThrow('MODULE_APP_BUILD_LEASE_LOST');

    clock.set(new Date(first!.claimExpiresAt.getTime() + 1));
    const reclaimed = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-b' });
    expect(reclaimed).toMatchObject({
      attemptCount: 2,
      id: build.id,
      status: 'building',
      workerId: 'worker-b',
    });
    expect(reclaimed!.claimToken).not.toBe(first!.claimToken);

    await expect(
      model.complete({
        artifactKey: `module-app-builds/${build.id}/${'c'.repeat(64)}.tgz`,
        artifactSha256: 'c'.repeat(64),
        buildId: build.id,
        claimToken: first!.claimToken,
      }),
    ).rejects.toThrow('MODULE_APP_BUILD_LEASE_LOST');

    const renewed = await model.renewLease({
      buildId: build.id,
      claimToken: reclaimed!.claimToken,
      leaseDurationMs: 120_000,
    });
    expect(renewed.claimExpiresAt).toEqual(new Date(clock.now().getTime() + 120_000));
  });

  it('orders due retries before later queued builds and clears the lease when retrying', async () => {
    const firstIds = await createPackageVersion();
    const secondIds = await createPackageVersion();
    const clock = createClock();
    const model = new ModuleAppBuildModel(serverDB, { now: clock.now });
    const firstBuild = await model.create({
      buildProfile: 'node22-static',
      packageId: firstIds.packageId,
      sourceSha256: '1'.repeat(64),
      versionId: firstIds.versionId,
    });
    const secondBuild = await model.create({
      buildProfile: 'node22-static',
      packageId: secondIds.packageId,
      sourceSha256: '2'.repeat(64),
      versionId: secondIds.versionId,
    });

    const firstClaim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-a' });
    const retryAt = new Date(clock.now().getTime() + 60_000);
    const retried = await model.retry({
      buildId: firstClaim!.id,
      claimToken: firstClaim!.claimToken,
      failureCode: 'MODULE_APP_BUILD_TEMPORARY_FAILURE',
      nextAttemptAt: retryAt,
    });
    expect(retried).toMatchObject({
      claimExpiresAt: null,
      claimToken: null,
      claimedAt: null,
      failureCode: 'MODULE_APP_BUILD_TEMPORARY_FAILURE',
      status: 'queued',
      workerId: null,
    });

    const secondClaim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-b' });
    expect(secondClaim?.id).toBe(secondBuild.id);

    clock.set(retryAt);
    const earlierDueClaim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-c' });
    expect(earlierDueClaim).toMatchObject({ attemptCount: 2, id: secondBuild.id });
    const retryClaim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-d' });
    expect(retryClaim).toMatchObject({ attemptCount: 2, id: firstBuild.id });
  });

  it('allows three retries and terminalizes an expired fourth attempt', async () => {
    const ids = await createPackageVersion();
    const clock = createClock();
    const model = new ModuleAppBuildModel(serverDB, { now: clock.now });
    const build = await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: '3'.repeat(64),
      versionId: ids.versionId,
    });

    let claim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-1' });
    const retryDelays = [30_000, 120_000, 600_000];
    for (const [index, retryDelay] of retryDelays.entries()) {
      const attempt = index + 1;
      const retryAt = new Date(clock.now().getTime() + retryDelay);
      await expect(
        model.retry({
          buildId: build.id,
          claimToken: claim!.claimToken,
          failureCode: `MODULE_APP_BUILD_RETRY_${attempt}`,
          nextAttemptAt: retryAt,
        }),
      ).resolves.toMatchObject({ attemptCount: attempt, status: 'queued' });
      clock.set(retryAt);
      claim = await model.claimNext({ leaseDurationMs: 60_000, workerId: `worker-${attempt + 1}` });
      expect(claim).toMatchObject({ attemptCount: attempt + 1, status: 'building' });
    }

    clock.set(new Date(claim!.claimExpiresAt.getTime() + 1));
    await expect(model.failExpiredExhausted()).resolves.toHaveLength(1);
    await expect(model.getById(build.id)).resolves.toMatchObject({
      claimExpiresAt: null,
      claimToken: null,
      failureCode: 'MODULE_APP_BUILD_RETRY_EXHAUSTED',
      status: 'failed',
      workerId: null,
    });
    await expect(model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-5' })).resolves.toBeNull();
  });

  it('terminalizes an active fourth attempt instead of returning it to queued', async () => {
    const ids = await createPackageVersion();
    const clock = createClock();
    const model = new ModuleAppBuildModel(serverDB, { now: clock.now });
    const build = await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: '4'.repeat(64),
      versionId: ids.versionId,
    });

    let claim = await model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-1' });
    for (let attempt = 1; attempt < 4; attempt++) {
      const retryAt = new Date(clock.now().getTime() + 1);
      await model.retry({
        buildId: build.id,
        claimToken: claim!.claimToken,
        failureCode: `MODULE_APP_BUILD_RETRY_${attempt}`,
        nextAttemptAt: retryAt,
      });
      clock.set(retryAt);
      claim = await model.claimNext({ leaseDurationMs: 60_000, workerId: `worker-${attempt + 1}` });
    }

    await expect(
      model.retry({
        buildId: build.id,
        claimToken: claim!.claimToken,
        failureCode: 'MODULE_APP_BUILD_TEMPORARY_FAILURE',
        nextAttemptAt: new Date(clock.now().getTime() + 60_000),
      }),
    ).resolves.toMatchObject({
      attemptCount: 4,
      claimToken: null,
      failureCode: 'MODULE_APP_BUILD_RETRY_EXHAUSTED',
      status: 'failed',
      workerId: null,
    });
    await expect(model.claimNext({ leaseDurationMs: 60_000, workerId: 'worker-5' })).resolves.toBeNull();
  });

  it('reclaims a legacy building row with null claim token and expiry', async () => {
    const ids = await createPackageVersion();
    const model = new ModuleAppBuildModel(serverDB, { now: () => NOW });
    const build = await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: '5'.repeat(64),
      versionId: ids.versionId,
    });
    await serverDB
      .update(moduleAppBuilds)
      .set({ claimExpiresAt: null, claimToken: null, status: 'building', workerId: 'legacy-worker' })
      .where(eq(moduleAppBuilds.id, build.id));

    await expect(
      model.claimNext({ leaseDurationMs: 60_000, workerId: 'replacement-worker' }),
    ).resolves.toMatchObject({
      attemptCount: 1,
      id: build.id,
      status: 'building',
      workerId: 'replacement-worker',
    });
  });
});
