import type {
  DesktopBuildAssetManifest,
  DesktopBuildProfilePayload,
  DesktopReleaseChannel,
  DesktopReleaseStatus,
} from '@lobechat/types';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { desktopBuildProfileRevisions, desktopBuildProfiles, desktopReleases } from '../schemas';
import type {
  DesktopBuildProfileItem,
  DesktopReleaseArtifactManifest,
  DesktopReleaseItem,
} from '../schemas/desktopBuild';
import type { LobeChatDatabase, Transaction } from '../type';

const ERROR_SUMMARY_LIMIT = 1024;

const isTerminalReleaseStatus = (status: DesktopReleaseStatus) =>
  status === 'failed' || status === 'succeeded';

const canTransitionRelease = (current: DesktopReleaseStatus, next: DesktopReleaseStatus) => {
  if (current === next) return true;
  if (isTerminalReleaseStatus(current)) return false;
  if (next === 'failed') return true;

  return (
    (current === 'building' && next === 'publishing') ||
    (current === 'publishing' && next === 'succeeded')
  );
};

const boundedErrorSummary = (value: string | undefined) =>
  value === undefined ? undefined : value.slice(0, ERROR_SUMMARY_LIMIT);

export class DesktopBuildModel {
  constructor(private readonly db: LobeChatDatabase) {}

  private lockProfile = async (profileId: string, tx: Transaction) => {
    const [profile] = await tx
      .select()
      .from(desktopBuildProfiles)
      .where(eq(desktopBuildProfiles.id, profileId))
      .for('update');

    if (!profile) throw new Error('DESKTOP_BUILD_PROFILE_NOT_FOUND');
    return profile;
  };

  private lockRelease = async (releaseId: string, tx: Transaction) => {
    const [release] = await tx
      .select()
      .from(desktopReleases)
      .where(eq(desktopReleases.id, releaseId))
      .for('update');

    if (!release) throw new Error('DESKTOP_RELEASE_NOT_FOUND');
    return release;
  };

  private assertLockedIdentity = async (
    profile: DesktopBuildProfileItem,
    payload: DesktopBuildProfilePayload,
    tx: Transaction,
  ) => {
    if (!profile.firstStableReleaseAt) return;

    const release = await tx.query.desktopReleases.findFirst({
      orderBy: [
        asc(desktopReleases.completedAt),
        asc(desktopReleases.createdAt),
        asc(desktopReleases.id),
      ],
      where: and(
        eq(desktopReleases.profileId, profile.id),
        eq(desktopReleases.channel, 'stable'),
        eq(desktopReleases.status, 'succeeded'),
      ),
    });
    if (!release) throw new Error('DESKTOP_BUILD_STABLE_RELEASE_NOT_FOUND');

    const revision = await tx.query.desktopBuildProfileRevisions.findFirst({
      where: eq(desktopBuildProfileRevisions.id, release.frozenRevisionId),
    });
    if (!revision) throw new Error('DESKTOP_BUILD_RELEASE_REVISION_NOT_FOUND');

    if (
      revision.payload.applicationId !== payload.applicationId ||
      revision.payload.protocolScheme !== payload.protocolScheme
    ) {
      throw new Error('DESKTOP_BUILD_IDENTITY_LOCKED');
    }
  };

  private transitionRelease = async ({
    artifacts,
    errorSummary,
    release,
    status,
    tx,
  }: {
    artifacts?: DesktopReleaseArtifactManifest;
    errorSummary?: string;
    release: DesktopReleaseItem;
    status: DesktopReleaseStatus;
    tx: Transaction;
  }) => {
    if (release.status === status) return release;
    if (isTerminalReleaseStatus(release.status)) throw new Error('DESKTOP_RELEASE_TERMINAL');
    if (!canTransitionRelease(release.status, status)) {
      throw new Error('DESKTOP_RELEASE_INVALID_TRANSITION');
    }

    let profile: DesktopBuildProfileItem | undefined;
    if (release.channel === 'stable' && status === 'succeeded') {
      // Release rows are locked before their parent profile throughout release transitions.
      profile = await this.lockProfile(release.profileId, tx);
      const revision = await tx.query.desktopBuildProfileRevisions.findFirst({
        where: eq(desktopBuildProfileRevisions.id, release.frozenRevisionId),
      });
      if (!revision) throw new Error('DESKTOP_BUILD_RELEASE_REVISION_NOT_FOUND');
      await this.assertLockedIdentity(profile, revision.payload, tx);
    }

    const now = new Date();
    const [updated] = await tx
      .update(desktopReleases)
      .set({
        ...(artifacts === undefined ? {} : { artifacts }),
        ...(errorSummary === undefined ? {} : { errorSummary: boundedErrorSummary(errorSummary) }),
        ...(status === 'failed' || status === 'succeeded' ? { completedAt: now } : {}),
        status,
        updatedAt: now,
      })
      .where(eq(desktopReleases.id, release.id))
      .returning();
    if (!updated) throw new Error('DESKTOP_RELEASE_NOT_FOUND');

    if (profile && !profile.firstStableReleaseAt) {
      await tx
        .update(desktopBuildProfiles)
        .set({ firstStableReleaseAt: now, updatedAt: now })
        .where(
          and(
            eq(desktopBuildProfiles.id, updated.profileId),
            isNull(desktopBuildProfiles.firstStableReleaseAt),
          ),
        );
    }

    return updated;
  };

  listProfiles = () =>
    this.db.query.desktopBuildProfiles.findMany({
      orderBy: [desc(desktopBuildProfiles.updatedAt), desc(desktopBuildProfiles.id)],
    });

  getProfile = (profileId: string) =>
    this.db.query.desktopBuildProfiles.findFirst({
      where: eq(desktopBuildProfiles.id, profileId),
    });

  getRevision = (revisionId: string) =>
    this.db.query.desktopBuildProfileRevisions.findFirst({
      where: eq(desktopBuildProfileRevisions.id, revisionId),
    });

  saveDraft = async (
    input: {
      actorUserId: string;
      assets: DesktopBuildAssetManifest;
      createIfMissing?: boolean;
      name: string;
      payload: DesktopBuildProfilePayload;
      profileId?: string;
    },
    tx?: Transaction,
  ) => {
    const save = async (tx: Transaction) => {
      let profile: DesktopBuildProfileItem;

      if (input.profileId) {
        let existingProfile: DesktopBuildProfileItem | undefined;
        try {
          existingProfile = await this.lockProfile(input.profileId, tx);
        } catch (error) {
          if (!(
            input.createIfMissing && (error as Error).message === 'DESKTOP_BUILD_PROFILE_NOT_FOUND'
          )) {
            throw error;
          }
        }

        if (!existingProfile) {
          const [created] = await tx
            .insert(desktopBuildProfiles)
            .values({
              createdByUserId: input.actorUserId,
              id: input.profileId,
              name: input.name,
              updatedByUserId: input.actorUserId,
            })
            .returning();
          if (!created) throw new Error('DESKTOP_BUILD_PROFILE_CREATE_FAILED');
          profile = created;
        } else {
          if (existingProfile.status === 'archived')
            throw new Error('DESKTOP_BUILD_PROFILE_ARCHIVED');
          await this.assertLockedIdentity(existingProfile, input.payload, tx);
          profile = existingProfile;
        }
      } else {
        throw new Error('DESKTOP_BUILD_PROFILE_ID_REQUIRED');
      }

      const revisionNumber = profile.currentRevision + 1;
      const [revision] = await tx
        .insert(desktopBuildProfileRevisions)
        .values({
          assetManifest: input.assets,
          createdByUserId: input.actorUserId,
          payload: input.payload,
          profileId: profile.id,
          revision: revisionNumber,
          state: 'draft',
        })
        .returning();
      if (!revision) throw new Error('DESKTOP_BUILD_REVISION_CREATE_FAILED');

      const [updatedProfile] = await tx
        .update(desktopBuildProfiles)
        .set({
          currentDraftRevisionId: revision.id,
          currentRevision: revisionNumber,
          name: input.name,
          updatedAt: new Date(),
          updatedByUserId: input.actorUserId,
        })
        .where(eq(desktopBuildProfiles.id, profile.id))
        .returning();
      if (!updatedProfile) throw new Error('DESKTOP_BUILD_PROFILE_UPDATE_FAILED');

      return { profileId: profile.id, revision: revisionNumber, revisionId: revision.id };
    };

    return tx ? save(tx) : this.db.transaction(save);
  };

  archiveProfile = async (input: { actorUserId: string; profileId: string }, tx?: Transaction) => {
    const archive = async (tx: Transaction) => {
      const profile = await this.lockProfile(input.profileId, tx);
      if (profile.status === 'archived') return profile;

      const [updated] = await tx
        .update(desktopBuildProfiles)
        .set({ status: 'archived', updatedAt: new Date(), updatedByUserId: input.actorUserId })
        .where(eq(desktopBuildProfiles.id, profile.id))
        .returning();
      if (!updated) throw new Error('DESKTOP_BUILD_PROFILE_NOT_FOUND');
      return updated;
    };

    return tx ? archive(tx) : this.db.transaction(archive);
  };

  freezeDraftForRelease = async (input: {
    actorUserId: string;
    channel: DesktopReleaseChannel;
    profileId: string;
    releaseNotes: string;
    version: string;
  }) => {
    return this.db.transaction(async (tx) => {
      const profile = await this.lockProfile(input.profileId, tx);
      if (profile.status === 'archived') throw new Error('DESKTOP_BUILD_PROFILE_ARCHIVED');
      if (!profile.currentDraftRevisionId) throw new Error('DESKTOP_BUILD_DRAFT_NOT_FOUND');

      const draft = await tx.query.desktopBuildProfileRevisions.findFirst({
        where: and(
          eq(desktopBuildProfileRevisions.id, profile.currentDraftRevisionId),
          eq(desktopBuildProfileRevisions.profileId, profile.id),
          eq(desktopBuildProfileRevisions.state, 'draft'),
        ),
      });
      if (!draft) throw new Error('DESKTOP_BUILD_DRAFT_NOT_FOUND');
      await this.assertLockedIdentity(profile, draft.payload, tx);

      const revisionNumber = profile.currentRevision + 1;
      const [revision] = await tx
        .insert(desktopBuildProfileRevisions)
        .values({
          assetManifest: draft.assetManifest,
          createdByUserId: input.actorUserId,
          payload: draft.payload,
          profileId: profile.id,
          revision: revisionNumber,
          state: 'frozen',
        })
        .returning();
      if (!revision) throw new Error('DESKTOP_BUILD_FROZEN_REVISION_CREATE_FAILED');

      const [release] = await tx
        .insert(desktopReleases)
        .values({
          channel: input.channel,
          createdByUserId: input.actorUserId,
          frozenRevisionId: revision.id,
          profileId: profile.id,
          releaseNotes: input.releaseNotes,
          status: 'queued',
          version: input.version,
        })
        .returning();
      if (!release) throw new Error('DESKTOP_RELEASE_CREATE_FAILED');

      const [updatedProfile] = await tx
        .update(desktopBuildProfiles)
        .set({ currentRevision: revisionNumber, updatedAt: new Date() })
        .where(eq(desktopBuildProfiles.id, profile.id))
        .returning();
      if (!updatedProfile) throw new Error('DESKTOP_BUILD_PROFILE_UPDATE_FAILED');

      return { release, revision };
    });
  };

  listReleases = (params: { limit?: number; profileId?: string } = {}) => {
    const { profileId } = params;
    const limit = Math.min(params.limit ?? 50, 50);

    return this.db.query.desktopReleases.findMany({
      ...(profileId ? { where: eq(desktopReleases.profileId, profileId) } : {}),
      limit,
      orderBy: [desc(desktopReleases.createdAt), desc(desktopReleases.id)],
    });
  };

  markReleaseDispatched = async (input: { actorUserId?: string; releaseId: string }) => {
    return this.db.transaction(async (tx) => {
      const release = await this.lockRelease(input.releaseId, tx);
      if (release.status === 'building') return release;
      if (isTerminalReleaseStatus(release.status)) throw new Error('DESKTOP_RELEASE_TERMINAL');
      if (release.status !== 'queued') throw new Error('DESKTOP_RELEASE_INVALID_TRANSITION');

      const now = new Date();
      const [updated] = await tx
        .update(desktopReleases)
        .set({
          dispatchedAt: now,
          dispatchedByUserId: input.actorUserId,
          status: 'building',
          updatedAt: now,
        })
        .where(eq(desktopReleases.id, release.id))
        .returning();
      if (!updated) throw new Error('DESKTOP_RELEASE_NOT_FOUND');
      return updated;
    });
  };

  markReleaseResult = async (input: {
    artifacts?: DesktopReleaseArtifactManifest;
    errorSummary?: string;
    releaseId: string;
    status: DesktopReleaseStatus;
  }) => {
    if (input.status === 'queued') throw new Error('DESKTOP_RELEASE_INVALID_TRANSITION');

    return this.db.transaction(async (tx) => {
      const release = await this.lockRelease(input.releaseId, tx);
      return this.transitionRelease({ ...input, release, tx });
    });
  };
}
