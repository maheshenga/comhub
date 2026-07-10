// @vitest-environment node
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
        app: {
          actions: [],
          appType: 'hybrid_app',
          billing: {},
          category: 'business',
          description: 'Build test app.',
          displayName: 'Build Test',
          icon: 'Package',
          pages: [],
          slug: app.slug,
          tags: [],
        },
        build: { frontend: { output: 'dist', profile: 'node22-static' } },
        entitlements: [],
        manifestVersion: 2,
        packageVersion: '1.0.0',
        runtime: { functions: [], permissions: [] },
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
  it('claims a queued build once and completes it immutably', async () => {
    const ids = await createPackageVersion();
    const model = new ModuleAppBuildModel(serverDB, { now: () => NOW });
    const build = await model.create({
      buildProfile: 'node22-static',
      packageId: ids.packageId,
      sourceSha256: 'b'.repeat(64),
      versionId: ids.versionId,
    });

    await expect(model.claimNext({ workerId: 'builder-1' })).resolves.toMatchObject({
      id: build.id,
      status: 'building',
      workerId: 'builder-1',
    });
    await expect(model.claimNext({ workerId: 'builder-2' })).resolves.toBeNull();

    const completed = await model.complete({
      artifactKey: 'module-app-builds/app/hash.tgz',
      artifactSha256: 'c'.repeat(64),
      buildId: build.id,
    });
    expect(completed).toMatchObject({
      artifactSha256: 'c'.repeat(64),
      status: 'ready',
    });
    await expect(
      model.complete({
        artifactKey: 'module-app-builds/app/other.tgz',
        artifactSha256: 'd'.repeat(64),
        buildId: build.id,
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
      model.claimNext({ workerId: 'builder-a' }),
      model.claimNext({ workerId: 'builder-b' }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
