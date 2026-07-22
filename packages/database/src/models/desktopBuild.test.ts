import { randomUUID } from 'node:crypto';

import type { DesktopBuildAssetManifest, DesktopBuildProfilePayload } from '@lobechat/types';
import { eq, inArray, sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '../core/getTestDB';
import {
  desktopBuildProfileRevisions,
  desktopBuildProfiles,
  desktopReleases,
  users,
} from '../schemas';
import type { DesktopReleaseArtifactManifest } from '../schemas/desktopBuild';
import type { LobeChatDatabase } from '../type';
import { DesktopBuildModel } from './desktopBuild';

const ADMIN_IDS = ['desktop-build-admin-1', 'desktop-build-admin-2'];

const payload: DesktopBuildProfilePayload = {
  applicationId: 'com.qingyou.comhub',
  applicationName: 'ComHub',
  description: 'ComHub desktop',
  executableName: 'ComHub',
  homepage: 'https://comhub.example.com',
  installerArtifactName: '${productName}-${version}-${arch}.${ext}',
  protocolScheme: 'comhub',
  publisher: 'Qingyou',
  shortcutName: 'ComHub',
  uninstallDisplayName: 'ComHub',
};

const assets: DesktopBuildAssetManifest = {
  appPreview: {
    contentType: 'image/png',
    height: 1024,
    key: 'desktop-build-assets/profile/app-preview.png',
    kind: 'appPreview',
    sha256: 'a'.repeat(64),
    size: 1024,
    width: 1024,
  },
  nsisHeader: {
    contentType: 'image/bmp',
    height: 57,
    key: 'desktop-build-assets/profile/header.bmp',
    kind: 'nsisHeader',
    sha256: 'b'.repeat(64),
    size: 1024,
    width: 150,
  },
  nsisSidebar: {
    contentType: 'image/bmp',
    height: 314,
    key: 'desktop-build-assets/profile/sidebar.bmp',
    kind: 'nsisSidebar',
    sha256: 'c'.repeat(64),
    size: 1024,
    width: 164,
  },
  windowsIcon: {
    contentType: 'image/x-icon',
    key: 'desktop-build-assets/profile/icon.ico',
    kind: 'windowsIcon',
    sha256: 'd'.repeat(64),
    size: 1024,
  },
};

const artifacts: DesktopReleaseArtifactManifest = [
  {
    arch: 'x64',
    contentType: 'application/x-msdownload',
    fileName: 'ComHub-2.4.0-x64.exe',
    kind: 'installer',
    sha256: 'e'.repeat(64),
    size: 1024,
    storageKey: 'desktop-build-releases/ComHub-2.4.0-x64.exe',
  },
];

let db: LobeChatDatabase;

const model = () => new DesktopBuildModel(db);

const setProfileCreatedAt = (profileId: string, createdAt: string) =>
  db
    .update(desktopBuildProfiles)
    .set({ createdAt: sql`${createdAt}::timestamptz` })
    .where(eq(desktopBuildProfiles.id, profileId));

const saveDraft = ({
  createIfMissing,
  profileId,
  ...input
}: Partial<Parameters<DesktopBuildModel['saveDraft']>[0]> = {}) =>
  model().saveDraft({
    actorUserId: ADMIN_IDS[0],
    assets,
    name: 'ComHub',
    payload,
    ...input,
    createIfMissing: createIfMissing ?? profileId === undefined,
    profileId: profileId ?? randomUUID(),
  });

const freezeDraft = async (
  profileId: string,
  input: Partial<Parameters<DesktopBuildModel['freezeDraftForRelease']>[0]> & {
    expectedDraftRevisionId?: string;
  } = {},
) => {
  const expectedDraftRevisionId =
    input.expectedDraftRevisionId ?? (await model().getProfile(profileId))?.currentDraftRevisionId;
  if (!expectedDraftRevisionId) throw new Error('DESKTOP_BUILD_DRAFT_NOT_FOUND');

  return model().freezeDraftForRelease({
    actorUserId: ADMIN_IDS[0],
    channel: 'canary',
    expectedDraftRevisionId,
    profileId,
    releaseNotes: 'Branded build',
    version: '2.4.0-canary.1',
    ...input,
  });
};

const dispatchAndSucceed = async (releaseId: string) => {
  await model().markReleaseDispatched({ actorUserId: ADMIN_IDS[0], releaseId });
  await model().markReleaseResult({ releaseId, status: 'publishing' });
  return model().markReleaseResult({ artifacts, releaseId, status: 'succeeded' });
};

describe('DesktopBuildModel', () => {
  beforeAll(async () => {
    db = await getTestDB();
  });

  beforeEach(async () => {
    await db.delete(desktopReleases);
    await db.delete(desktopBuildProfileRevisions);
    await db.delete(desktopBuildProfiles);
    await db.delete(users).where(inArray(users.id, ADMIN_IDS));
    await db.insert(users).values(ADMIN_IDS.map((id) => ({ id })));
  });

  it('creates a draft only for an explicitly supplied profile ID and rejects profile typos', async () => {
    const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const created = await saveDraft({ createIfMissing: true, profileId });

    expect(created.profileId).toBe(profileId);
    expect(await model().getProfile(profileId)).toMatchObject({ id: profileId, status: 'active' });
    await expect(saveDraft({ profileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).rejects.toThrow(
      'DESKTOP_BUILD_PROFILE_NOT_FOUND',
    );
  });

  it('rejects implicit profile creation', async () => {
    await expect(
      model().saveDraft({
        actorUserId: ADMIN_IDS[0],
        assets,
        name: 'ComHub',
        payload,
      }),
    ).rejects.toThrow('DESKTOP_BUILD_PROFILE_ID_REQUIRED');
  });

  it('archives a profile without deleting its draft and is idempotent', async () => {
    const draft = await saveDraft();

    const archived = await model().archiveProfile({
      actorUserId: ADMIN_IDS[1],
      profileId: draft.profileId,
    });
    const repeated = await model().archiveProfile({
      actorUserId: ADMIN_IDS[1],
      profileId: draft.profileId,
    });

    expect(archived).toMatchObject({ id: draft.profileId, status: 'archived' });
    expect(repeated).toMatchObject({ id: draft.profileId, status: 'archived' });
    expect(await model().getRevision(draft.revisionId)).toMatchObject({ id: draft.revisionId });
  });

  it('bounds direct release listing to the administration maximum', async () => {
    const findMany = vi.spyOn(db.query.desktopReleases, 'findMany').mockResolvedValue([] as any);

    await model().listReleases({ limit: 500 });

    const calls = [...findMany.mock.calls];
    findMany.mockRestore();
    expect(calls).toEqual([expect.arrayContaining([expect.objectContaining({ limit: 50 })])]);
  });

  it('uses immutable microsecond createdAt keysets without duplicate or omitted profiles', async () => {
    const findMany = vi
      .spyOn(db.query.desktopBuildProfiles, 'findMany')
      .mockResolvedValue([] as any);

    await model().listProfiles();
    await model().listProfiles({ limit: 500 });

    expect(findMany.mock.calls).toEqual([
      [expect.objectContaining({ limit: 51 })],
      [expect.objectContaining({ limit: 101 })],
    ]);
    expect(findMany.mock.calls.map(([options]) => options)).not.toContainEqual(
      expect.objectContaining({ offset: expect.anything() }),
    );
    findMany.mockRestore();

    const profiles = [
      {
        id: '10000000-0000-4000-8000-000000000001',
        createdAt: '2026-01-05T00:00:00.000002Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        createdAt: '2026-01-05T00:00:00.000001Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        createdAt: '2026-01-04T00:00:00.000000Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        createdAt: '2026-01-03T00:00:00.000000Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000005',
        createdAt: '2026-01-02T00:00:00.000000Z',
      },
    ];
    for (const profile of profiles) {
      await saveDraft({ createIfMissing: true, profileId: profile.id });
      await setProfileCreatedAt(profile.id, profile.createdAt);
    }

    const firstPage = await model().listProfiles({ limit: 1 });
    expect(firstPage.items.map((profile) => profile.id)).toEqual([profiles[0]!.id]);
    expect(firstPage.nextCursor).toMatch(/^[\w-]+$/);
    expect(firstPage.nextCursor).not.toBe('2');
    expect(
      JSON.parse(Buffer.from(firstPage.nextCursor!, 'base64url').toString('utf8')),
    ).toMatchObject({
      createdAt: profiles[0]!.createdAt,
      id: profiles[0]!.id,
      v: 2,
    });

    // Updating a seen and an unseen row must not affect immutable createdAt pagination.
    await db
      .update(desktopBuildProfiles)
      .set({ updatedAt: new Date('2030-01-01T00:00:00.000Z') })
      .where(eq(desktopBuildProfiles.id, profiles[0]!.id));
    await db
      .update(desktopBuildProfiles)
      .set({ updatedAt: new Date('2030-01-01T00:00:00.000Z') })
      .where(eq(desktopBuildProfiles.id, profiles[1]!.id));

    const secondPage = await model().listProfiles({ cursor: firstPage.nextCursor!, limit: 1 });
    const thirdPage = await model().listProfiles({ cursor: secondPage.nextCursor!, limit: 1 });
    const fourthPage = await model().listProfiles({ cursor: thirdPage.nextCursor!, limit: 1 });
    const fifthPage = await model().listProfiles({ cursor: fourthPage.nextCursor!, limit: 1 });

    expect(secondPage.items.map((profile) => profile.id)).toEqual([profiles[1]!.id]);
    expect(thirdPage.items.map((profile) => profile.id)).toEqual([profiles[2]!.id]);
    expect(fourthPage.items.map((profile) => profile.id)).toEqual([profiles[3]!.id]);
    expect(fifthPage.items.map((profile) => profile.id)).toEqual([profiles[4]!.id]);
    expect(fifthPage.nextCursor).toBeNull();
    const pagedIds = [
      ...firstPage.items,
      ...secondPage.items,
      ...thirdPage.items,
      ...fourthPage.items,
      ...fifthPage.items,
    ].map((profile) => profile.id);
    expect(pagedIds).toEqual(profiles.map(({ id }) => id));
    expect(new Set(pagedIds).size).toBe(profiles.length);

    await expect(
      model().listProfiles({ cursor: 'not-a-desktop-build-profile-cursor', limit: 2 }),
    ).rejects.toThrow('DESKTOP_BUILD_PROFILE_CURSOR_INVALID');
  });

  it('batch-loads the requested draft revisions', async () => {
    const first = await saveDraft();
    const second = await saveDraft();

    const revisions = await model().getRevisionsByIds([
      second.revisionId,
      first.revisionId,
      second.revisionId,
    ]);

    expect(revisions.map((revision) => revision.id).sort()).toEqual(
      [first.revisionId, second.revisionId].sort(),
    );
  });

  it('preserves immutable prior payloads and freezes the current draft after multiple saves', async () => {
    const first = await saveDraft();
    const secondPayload = { ...payload, applicationName: 'ComHub Pro' };
    const second = await saveDraft({ payload: secondPayload, profileId: first.profileId });
    const result = await freezeDraft(first.profileId);

    expect(second.revision).toBe(first.revision + 1);
    expect(await model().getRevision(first.revisionId)).toMatchObject({ payload });
    expect(result.revision).toMatchObject({ payload: secondPayload, state: 'frozen' });
    expect((await model().getProfile(first.profileId))?.currentDraftRevisionId).toBe(
      second.revisionId,
    );
  });

  it('creates a frozen revision and queued release atomically', async () => {
    const draft = await saveDraft();
    const result = await freezeDraft(draft.profileId);

    expect(result.revision).toMatchObject({
      assetManifest: assets,
      payload,
      state: 'frozen',
    });
    expect(result.release).toMatchObject({ status: 'queued', version: '2.4.0-canary.1' });
  });

  it('rolls back a frozen revision and queued release when the required creation audit transaction fails', async () => {
    const draft = await saveDraft();
    const beforeRevisions = await db
      .select({ id: desktopBuildProfileRevisions.id })
      .from(desktopBuildProfileRevisions)
      .where(eq(desktopBuildProfileRevisions.profileId, draft.profileId));

    await expect(
      db.transaction(async (tx) => {
        await model().freezeDraftForRelease(
          {
            actorUserId: ADMIN_IDS[0],
            channel: 'canary',
            expectedDraftRevisionId: draft.revisionId,
            frozenRevisionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
            profileId: draft.profileId,
            releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
            releaseNotes: 'Branded build',
            version: '2.4.0-canary.1',
          },
          tx,
        );
        throw new Error('ADMIN_AUDIT_CREATE_FAILED');
      }),
    ).rejects.toThrow('ADMIN_AUDIT_CREATE_FAILED');

    await expect(
      model().getRevision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
    ).resolves.toBeUndefined();
    await expect(model().listReleases({ profileId: draft.profileId })).resolves.toEqual([]);
    await expect(
      db
        .select({ id: desktopBuildProfileRevisions.id })
        .from(desktopBuildProfileRevisions)
        .where(eq(desktopBuildProfileRevisions.profileId, draft.profileId)),
    ).resolves.toEqual(beforeRevisions);
  });

  it('rejects an interleaved freeze when the locked current draft no longer matches the validated revision', async () => {
    const firstDraft = await saveDraft();

    // Simulates a router validating the first draft while a later draft is saved before freeze.
    await saveDraft({ profileId: firstDraft.profileId });

    await expect(
      freezeDraft(firstDraft.profileId, { expectedDraftRevisionId: firstDraft.revisionId }),
    ).rejects.toThrow('DESKTOP_BUILD_DRAFT_CHANGED');

    const releases = await model().listReleases({ profileId: firstDraft.profileId });
    expect(releases).toEqual([]);
    expect((await model().getProfile(firstDraft.profileId))?.currentDraftRevisionId).not.toBe(
      firstDraft.revisionId,
    );
  });

  it('rolls back a duplicate channel/version freeze without orphaning a frozen revision', async () => {
    const draft = await saveDraft();
    await freezeDraft(draft.profileId);
    const before = await db
      .select({ count: desktopBuildProfileRevisions.id })
      .from(desktopBuildProfileRevisions)
      .where(eq(desktopBuildProfileRevisions.profileId, draft.profileId));

    await expect(freezeDraft(draft.profileId)).rejects.toThrow();

    const after = await db
      .select({ count: desktopBuildProfileRevisions.id })
      .from(desktopBuildProfileRevisions)
      .where(eq(desktopBuildProfileRevisions.profileId, draft.profileId));
    expect(after).toHaveLength(before.length);
    expect((await model().getProfile(draft.profileId))?.currentRevision).toBe(2);
  });

  it('rejects draft writes and freezes for archived profiles', async () => {
    const draft = await saveDraft();
    await db
      .update(desktopBuildProfiles)
      .set({ status: 'archived' })
      .where(eq(desktopBuildProfiles.id, draft.profileId));

    await expect(saveDraft({ profileId: draft.profileId })).rejects.toThrow(
      'DESKTOP_BUILD_PROFILE_ARCHIVED',
    );
    await expect(freezeDraft(draft.profileId)).rejects.toThrow('DESKTOP_BUILD_PROFILE_ARCHIVED');
  });

  it('locks stable identity during later draft saves', async () => {
    const draft = await saveDraft();
    const stable = await freezeDraft(draft.profileId, { channel: 'stable', version: '2.4.0' });
    await dispatchAndSucceed(stable.release.id);

    await expect(
      saveDraft({
        payload: { ...payload, applicationId: 'com.qingyou.changed', protocolScheme: 'changed' },
        profileId: draft.profileId,
      }),
    ).rejects.toThrow('DESKTOP_BUILD_IDENTITY_LOCKED');
  });

  it('locks a pre-existing incompatible draft again when freezing after stable success', async () => {
    const firstDraft = await saveDraft();
    const stable = await freezeDraft(firstDraft.profileId, { channel: 'stable', version: '2.4.0' });
    await saveDraft({
      payload: { ...payload, applicationId: 'com.qingyou.changed', protocolScheme: 'changed' },
      profileId: firstDraft.profileId,
    });
    await dispatchAndSucceed(stable.release.id);

    await expect(freezeDraft(firstDraft.profileId, { version: '2.4.1-canary.1' })).rejects.toThrow(
      'DESKTOP_BUILD_IDENTITY_LOCKED',
    );
  });

  it('requires dispatch before release result callbacks can report building', async () => {
    const draft = await saveDraft();
    const { release } = await freezeDraft(draft.profileId);

    await expect(
      model().markReleaseResult({ releaseId: release.id, status: 'building' }),
    ).rejects.toThrow('DESKTOP_RELEASE_INVALID_TRANSITION');
    const dispatched = await model().markReleaseDispatched({
      actorUserId: ADMIN_IDS[1],
      releaseId: release.id,
    });
    const callback = await model().markReleaseResult({ releaseId: release.id, status: 'building' });

    expect(dispatched).toMatchObject({ dispatchedByUserId: ADMIN_IDS[1], status: 'building' });
    expect(dispatched.dispatchedAt).toBeInstanceOf(Date);
    expect(callback).toMatchObject({ id: release.id, status: 'building' });
  });

  it('persists workflow run metadata on idempotent building callbacks', async () => {
    const draft = await saveDraft();
    const { release } = await freezeDraft(draft.profileId);
    await model().markReleaseDispatched({ actorUserId: ADMIN_IDS[1], releaseId: release.id });

    const callback = await model().markReleaseResult({
      releaseId: release.id,
      status: 'building',
      workflowRunId: '1234567890',
      workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1234567890',
    });

    expect(callback).toMatchObject({
      status: 'building',
      workflowRunId: '1234567890',
      workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1234567890',
    });
    await expect(
      model().markReleaseResult({
        releaseId: release.id,
        status: 'building',
        workflowRunId: '1234567890',
        workflowRunUrl: 'https://github.com/maheshenga/comhub/actions/runs/1234567890',
      }),
    ).resolves.toMatchObject({ workflowRunId: '1234567890' });
  });

  it('allows the release lifecycle and rejects terminal transitions', async () => {
    const draft = await saveDraft();
    const { release } = await freezeDraft(draft.profileId);

    await model().markReleaseDispatched({ actorUserId: ADMIN_IDS[0], releaseId: release.id });
    await model().markReleaseResult({ releaseId: release.id, status: 'publishing' });
    const completed = await model().markReleaseResult({
      artifacts,
      releaseId: release.id,
      status: 'succeeded',
    });

    await expect(
      model().markReleaseResult({ releaseId: release.id, status: 'succeeded' }),
    ).resolves.toMatchObject({ status: 'succeeded' });
    await expect(
      model().markReleaseResult({ releaseId: release.id, status: 'failed' }),
    ).rejects.toThrow('DESKTOP_RELEASE_TERMINAL');
    expect(completed.artifacts).toEqual(artifacts);
  });

  it.each(['queued', 'building', 'publishing'] as const)(
    'allows %s releases to fail',
    async (state) => {
      const draft = await saveDraft();
      const { release } = await freezeDraft(draft.profileId);

      if (state !== 'queued') {
        await model().markReleaseDispatched({ actorUserId: ADMIN_IDS[0], releaseId: release.id });
      }
      if (state === 'publishing') {
        await model().markReleaseResult({ releaseId: release.id, status: 'publishing' });
      }

      await expect(
        model().markReleaseResult({ releaseId: release.id, status: 'failed' }),
      ).resolves.toMatchObject({
        status: 'failed',
      });
    },
  );

  it('sets firstStableReleaseAt once and bounds failure errors', async () => {
    const draft = await saveDraft();
    const first = await freezeDraft(draft.profileId, { channel: 'stable', version: '2.4.0' });
    await dispatchAndSucceed(first.release.id);
    const firstStableReleaseAt = (await model().getProfile(draft.profileId))?.firstStableReleaseAt;

    const second = await freezeDraft(draft.profileId, { channel: 'stable', version: '2.4.1' });
    await dispatchAndSucceed(second.release.id);
    expect((await model().getProfile(draft.profileId))?.firstStableReleaseAt).toEqual(
      firstStableReleaseAt,
    );

    const failed = await freezeDraft(draft.profileId, { version: '2.4.2-canary.1' });
    const release = await model().markReleaseResult({
      errorSummary: 'x'.repeat(2048),
      releaseId: failed.release.id,
      status: 'failed',
    });
    expect(release.errorSummary).toHaveLength(1024);
  });

  it('rejects an out-of-order stable success that conflicts with the established identity', async () => {
    const firstDraft = await saveDraft();
    const stableA = await freezeDraft(firstDraft.profileId, {
      channel: 'stable',
      version: '2.4.0',
    });
    const stableBIdentity = {
      ...payload,
      applicationId: 'com.qingyou.comhub-b',
      protocolScheme: 'comhub-b',
    };
    await saveDraft({ payload: stableBIdentity, profileId: firstDraft.profileId });
    const stableB = await freezeDraft(firstDraft.profileId, {
      channel: 'stable',
      version: '2.4.1',
    });

    const succeededB = await dispatchAndSucceed(stableB.release.id);
    const profileAfterB = await model().getProfile(firstDraft.profileId);
    expect(profileAfterB?.firstStableReleaseAt).toEqual(succeededB.completedAt);
    expect((await model().getRevision(stableB.revision.id))?.payload).toMatchObject(
      stableBIdentity,
    );

    await model().markReleaseDispatched({
      actorUserId: ADMIN_IDS[0],
      releaseId: stableA.release.id,
    });
    await model().markReleaseResult({ releaseId: stableA.release.id, status: 'publishing' });
    await expect(
      model().markReleaseResult({ releaseId: stableA.release.id, status: 'succeeded' }),
    ).rejects.toThrow('DESKTOP_BUILD_IDENTITY_LOCKED');

    expect(
      (await model().listReleases({ profileId: firstDraft.profileId })).find(
        (release) => release.id === stableA.release.id,
      ),
    ).toMatchObject({ status: 'publishing' });
    expect((await model().getProfile(firstDraft.profileId))?.firstStableReleaseAt).toEqual(
      succeededB.completedAt,
    );
    await expect(
      model().markReleaseResult({ releaseId: stableA.release.id, status: 'failed' }),
    ).resolves.toMatchObject({ status: 'failed' });
  });
});
