import type { DesktopBuildAssetManifest, DesktopBuildProfilePayload } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import {
  desktopBuildProfileRevisions,
  desktopBuildProfiles,
  desktopReleases,
} from '../schemas/desktopBuild';
import { DesktopBuildModel } from './desktopBuild';

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

const createModelDb = () => {
  const profiles: any[] = [];
  const revisions: any[] = [];
  const releases: any[] = [];
  let nextId = 1;

  const insert = vi.fn((table: unknown) => ({
    values: vi.fn((values: Record<string, unknown>) => ({
      returning: vi.fn(async () => {
        const row = {
          ...values,
          ...(table === desktopBuildProfiles ? { currentRevision: 0, status: 'active' } : {}),
          createdAt: new Date(),
          id: `id-${nextId++}`,
          updatedAt: new Date(),
        };
        if (table === desktopBuildProfiles) profiles.push(row);
        if (table === desktopBuildProfileRevisions) revisions.push(row);
        if (table === desktopReleases) releases.push(row);
        return [row];
      }),
    })),
  }));
  const update = vi.fn((table: unknown) => ({
    set: vi.fn((values: Record<string, unknown>) => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          const rows =
            table === desktopBuildProfiles
              ? profiles
              : table === desktopReleases
                ? releases
                : revisions;
          const row = rows.at(-1);
          if (!row) return [];
          Object.assign(row, values);
          return [row];
        }),
      })),
    })),
  }));
  const tx = {
    insert,
    query: {
      desktopBuildProfileRevisions: { findFirst: vi.fn(async () => revisions[0]) },
      desktopBuildProfiles: { findFirst: vi.fn(async () => profiles.at(-1)) },
      desktopReleases: { findFirst: vi.fn(async () => releases.at(-1)) },
    },
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => ({
          for: vi.fn(async () => [
            table === desktopBuildProfiles
              ? profiles.at(-1)
              : table === desktopReleases
                ? releases.at(-1)
                : revisions.at(-1),
          ]),
        })),
      })),
    })),
    update,
  };

  return {
    db: {
      ...tx,
      transaction: vi.fn((callback) => callback(tx)),
    },
    profiles,
    releases,
    revisions,
  };
};

describe('DesktopBuildModel', () => {
  it('appends a revision without updating the prior payload', async () => {
    const { db } = createModelDb();
    const model = new DesktopBuildModel(db as any);

    const first = await model.saveDraft({
      actorUserId: 'admin-1',
      assets,
      name: 'ComHub',
      payload,
    });
    const second = await model.saveDraft({
      actorUserId: 'admin-1',
      assets,
      name: 'ComHub',
      payload: { ...payload, applicationName: 'ComHub Pro' },
      profileId: first.profileId,
    });

    expect(second.revision).toBe(first.revision + 1);
    expect(await model.getRevision(first.revisionId)).toMatchObject({ payload });
  });

  it('freezes the current draft and creates a queued release atomically', async () => {
    const { db, profiles } = createModelDb();
    const model = new DesktopBuildModel(db as any);
    const draft = await model.saveDraft({
      actorUserId: 'admin-1',
      assets,
      name: 'ComHub',
      payload,
    });

    const result = await model.freezeDraftForRelease({
      actorUserId: 'admin-1',
      channel: 'stable',
      profileId: draft.profileId,
      releaseNotes: 'First branded build',
      version: '2.4.0',
    });

    expect(result.revision).toMatchObject({
      assetManifest: assets,
      payload,
      state: 'frozen',
    });
    expect(result.release).toMatchObject({ status: 'queued', version: '2.4.0' });
    expect(profiles[0].currentDraftRevisionId).toBe(draft.revisionId);
  });

  it('accepts idempotent release callbacks while rejecting terminal transitions', async () => {
    const { db } = createModelDb();
    const model = new DesktopBuildModel(db as any);
    const draft = await model.saveDraft({
      actorUserId: 'admin-1',
      assets,
      name: 'ComHub',
      payload,
    });
    const { release } = await model.freezeDraftForRelease({
      actorUserId: 'admin-1',
      channel: 'canary',
      profileId: draft.profileId,
      releaseNotes: 'Canary build',
      version: '2.4.1-canary.1',
    });

    await model.markReleaseDispatched({ actorUserId: 'admin-1', releaseId: release.id });
    await model.markReleaseResult({ releaseId: release.id, status: 'publishing' });
    const completed = await model.markReleaseResult({ releaseId: release.id, status: 'succeeded' });

    await expect(
      model.markReleaseResult({ releaseId: release.id, status: 'succeeded' }),
    ).resolves.toMatchObject({ status: 'succeeded' });
    await expect(
      model.markReleaseResult({ releaseId: release.id, status: 'failed' }),
    ).rejects.toThrow('DESKTOP_RELEASE_TERMINAL');
    expect(completed.status).toBe('succeeded');
  });
});
