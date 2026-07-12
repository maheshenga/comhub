import type { ModuleAppBuildProfile } from '@lobechat/types';
import { and, asc, eq } from 'drizzle-orm';

import { moduleAppBuilds, moduleAppPackages, moduleAppVersions } from '../schemas';
import type { LobeChatDatabase } from '../type';

type ModuleAppBuildModelOptions = {
  now?: () => Date;
};

export class ModuleAppBuildModel {
  private readonly now: () => Date;

  constructor(
    private readonly db: LobeChatDatabase,
    options: ModuleAppBuildModelOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  create = async (input: {
    buildProfile: ModuleAppBuildProfile;
    packageId: string;
    sourceSha256: string;
    versionId: string;
  }) => {
    const [created] = await this.db.insert(moduleAppBuilds).values(input).returning();

    if (!created) throw new Error('MODULE_APP_BUILD_CREATE_FAILED');
    return created;
  };

  claimNext = async ({ workerId }: { workerId: string }) => {
    const now = this.now();

    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ archive: moduleAppPackages.archive, id: moduleAppBuilds.id })
        .from(moduleAppBuilds)
        .innerJoin(moduleAppPackages, eq(moduleAppPackages.id, moduleAppBuilds.packageId))
        .where(eq(moduleAppBuilds.status, 'queued'))
        .orderBy(asc(moduleAppBuilds.createdAt), asc(moduleAppBuilds.id))
        .limit(1)
        .for('update', { skipLocked: true });

      if (!candidate) return null;

      const [claimed] = await tx
        .update(moduleAppBuilds)
        .set({ claimedAt: now, status: 'building', updatedAt: now, workerId })
        .where(and(eq(moduleAppBuilds.id, candidate.id), eq(moduleAppBuilds.status, 'queued')))
        .returning();

      return claimed
        ? { ...claimed, sourceStorageKey: candidate.archive.storageKey }
        : null;
    });
  };

  complete = async (input: {
    artifactKey: string;
    artifactSha256: string;
    buildId: string;
  }) => {
    const now = this.now();

    return this.db.transaction(async (tx) => {
      const [completed] = await tx
        .update(moduleAppBuilds)
        .set({
          artifactKey: input.artifactKey,
          artifactSha256: input.artifactSha256,
          completedAt: now,
          failureCode: null,
          status: 'ready',
          updatedAt: now,
        })
        .where(and(eq(moduleAppBuilds.id, input.buildId), eq(moduleAppBuilds.status, 'building')))
        .returning();

      if (!completed) {
        const existing = await tx.query.moduleAppBuilds.findFirst({
          where: eq(moduleAppBuilds.id, input.buildId),
        });
        if (existing?.status === 'ready') throw new Error('MODULE_APP_BUILD_IMMUTABLE');
        throw new Error(existing ? 'MODULE_APP_BUILD_NOT_BUILDING' : 'MODULE_APP_BUILD_NOT_FOUND');
      }

      await tx
        .update(moduleAppVersions)
        .set({
          runtimeArtifactKey: input.artifactKey,
          runtimeArtifactSha256: input.artifactSha256,
        })
        .where(eq(moduleAppVersions.id, completed.versionId));

      return completed;
    });
  };

  fail = async (input: { buildId: string; failureCode: string }) => {
    const now = this.now();
    const [failed] = await this.db
      .update(moduleAppBuilds)
      .set({ completedAt: now, failureCode: input.failureCode, status: 'failed', updatedAt: now })
      .where(and(eq(moduleAppBuilds.id, input.buildId), eq(moduleAppBuilds.status, 'building')))
      .returning();

    if (!failed) throw new Error('MODULE_APP_BUILD_NOT_BUILDING');
    return failed;
  };

  getByVersionId = (versionId: string) =>
    this.db.query.moduleAppBuilds.findFirst({ where: eq(moduleAppBuilds.versionId, versionId) });

  getById = (buildId: string) =>
    this.db.query.moduleAppBuilds.findFirst({ where: eq(moduleAppBuilds.id, buildId) });
}
