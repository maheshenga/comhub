import type { ModuleAppBuildProfile } from '@lobechat/types';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, lt, lte, or, sql } from 'drizzle-orm';

import { moduleAppBuilds, moduleAppPackages, moduleAppVersions } from '../schemas';
import type { LobeChatDatabase } from '../type';

type ModuleAppBuildModelOptions = {
  now?: () => Date;
};

export type ClaimedModuleAppBuild = {
  attemptCount: number;
  buildProfile: ModuleAppBuildProfile;
  claimExpiresAt: Date;
  claimToken: string;
  id: string;
  manifestSnapshot: typeof moduleAppPackages.$inferSelect.manifestSnapshot;
  sourceSha256: string;
  sourceStorageKey: string;
  status: 'building';
  workerId: string;
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
    const [created] = await this.db
      .insert(moduleAppBuilds)
      .values({ ...input, nextAttemptAt: this.now() })
      .returning();

    if (!created) throw new Error('MODULE_APP_BUILD_CREATE_FAILED');
    return created;
  };

  claimNext = async (input: {
    leaseDurationMs: number;
    workerId: string;
  }): Promise<ClaimedModuleAppBuild | null> => {
    const now = this.now();
    const claimExpiresAt = new Date(now.getTime() + input.leaseDurationMs);
    const claimToken = randomUUID();

    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({
          archive: moduleAppPackages.archive,
          id: moduleAppBuilds.id,
          manifestSnapshot: moduleAppPackages.manifestSnapshot,
        })
        .from(moduleAppBuilds)
        .innerJoin(moduleAppPackages, eq(moduleAppPackages.id, moduleAppBuilds.packageId))
        .where(
          or(
            and(
              eq(moduleAppBuilds.status, 'queued'),
              lte(moduleAppBuilds.nextAttemptAt, now),
              lt(moduleAppBuilds.attemptCount, 4),
            ),
            and(
              eq(moduleAppBuilds.status, 'building'),
              lte(moduleAppBuilds.claimExpiresAt, now),
              lt(moduleAppBuilds.attemptCount, 4),
            ),
          ),
        )
        .orderBy(asc(moduleAppBuilds.nextAttemptAt), asc(moduleAppBuilds.createdAt), asc(moduleAppBuilds.id))
        .limit(1)
        .for('update', { skipLocked: true });

      if (!candidate) return null;

      const [claimed] = await tx
        .update(moduleAppBuilds)
        .set({
          attemptCount: sql`${moduleAppBuilds.attemptCount} + 1`,
          claimedAt: now,
          claimExpiresAt,
          claimToken,
          failureCode: null,
          status: 'building',
          updatedAt: now,
          workerId: input.workerId,
        })
        .where(eq(moduleAppBuilds.id, candidate.id))
        .returning();

      return claimed
        ? {
            ...claimed,
            claimExpiresAt,
            claimToken,
            manifestSnapshot: candidate.manifestSnapshot,
            sourceStorageKey: candidate.archive.storageKey,
          } as ClaimedModuleAppBuild
        : null;
    });
  };

  renewLease = async (input: {
    buildId: string;
    claimToken: string;
    leaseDurationMs: number;
  }) => {
    const now = this.now();
    const claimExpiresAt = new Date(now.getTime() + input.leaseDurationMs);
    const [renewed] = await this.db
      .update(moduleAppBuilds)
      .set({ claimExpiresAt, updatedAt: now })
      .where(
        and(
          eq(moduleAppBuilds.id, input.buildId),
          eq(moduleAppBuilds.status, 'building'),
          eq(moduleAppBuilds.claimToken, input.claimToken),
        ),
      )
      .returning();
    if (!renewed) throw new Error('MODULE_APP_BUILD_LEASE_LOST');
    return renewed;
  };

  retry = async (input: {
    buildId: string;
    claimToken: string;
    failureCode: string;
    nextAttemptAt: Date;
  }) => {
    const now = this.now();
    const [retried] = await this.db
      .update(moduleAppBuilds)
      .set({
        claimExpiresAt: null,
        claimToken: null,
        claimedAt: null,
        failureCode: input.failureCode,
        nextAttemptAt: input.nextAttemptAt,
        status: 'queued',
        updatedAt: now,
        workerId: null,
      })
      .where(
        and(
          eq(moduleAppBuilds.id, input.buildId),
          eq(moduleAppBuilds.status, 'building'),
          eq(moduleAppBuilds.claimToken, input.claimToken),
        ),
      )
      .returning();
    if (!retried) throw new Error('MODULE_APP_BUILD_LEASE_LOST');
    return retried;
  };

  complete = async (input: {
    artifactKey: string;
    artifactSha256: string;
    buildId: string;
    claimToken: string;
  }) => {
    const now = this.now();

    return this.db.transaction(async (tx) => {
      const [completed] = await tx
        .update(moduleAppBuilds)
        .set({
          artifactKey: input.artifactKey,
          artifactSha256: input.artifactSha256,
          claimExpiresAt: null,
          claimToken: null,
          claimedAt: null,
          completedAt: now,
          failureCode: null,
          status: 'ready',
          updatedAt: now,
          workerId: null,
        })
        .where(
          and(
            eq(moduleAppBuilds.id, input.buildId),
            eq(moduleAppBuilds.status, 'building'),
            eq(moduleAppBuilds.claimToken, input.claimToken),
          ),
        )
        .returning();

      if (!completed) {
        const existing = await tx.query.moduleAppBuilds.findFirst({
          where: eq(moduleAppBuilds.id, input.buildId),
        });
        if (existing?.status === 'ready') throw new Error('MODULE_APP_BUILD_IMMUTABLE');
        throw new Error(existing ? 'MODULE_APP_BUILD_LEASE_LOST' : 'MODULE_APP_BUILD_NOT_FOUND');
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

  fail = async (input: { buildId: string; claimToken: string; failureCode: string }) => {
    const now = this.now();
    const [failed] = await this.db
      .update(moduleAppBuilds)
      .set({
        claimExpiresAt: null,
        claimToken: null,
        claimedAt: null,
        completedAt: now,
        failureCode: input.failureCode,
        status: 'failed',
        updatedAt: now,
        workerId: null,
      })
      .where(
        and(
          eq(moduleAppBuilds.id, input.buildId),
          eq(moduleAppBuilds.status, 'building'),
          eq(moduleAppBuilds.claimToken, input.claimToken),
        ),
      )
      .returning();

    if (!failed) throw new Error('MODULE_APP_BUILD_LEASE_LOST');
    return failed;
  };

  failExpiredExhausted = async () => {
    const now = this.now();
    return this.db
      .update(moduleAppBuilds)
      .set({
        claimExpiresAt: null,
        claimToken: null,
        claimedAt: null,
        completedAt: now,
        failureCode: 'MODULE_APP_BUILD_RETRY_EXHAUSTED',
        status: 'failed',
        updatedAt: now,
        workerId: null,
      })
      .where(
        and(
          eq(moduleAppBuilds.status, 'building'),
          eq(moduleAppBuilds.attemptCount, 4),
          lte(moduleAppBuilds.claimExpiresAt, now),
        ),
      )
      .returning();
  };

  getByVersionId = (versionId: string) =>
    this.db.query.moduleAppBuilds.findFirst({ where: eq(moduleAppBuilds.versionId, versionId) });

  getById = (buildId: string) =>
    this.db.query.moduleAppBuilds.findFirst({ where: eq(moduleAppBuilds.id, buildId) });
}
