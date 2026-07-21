// @vitest-environment node
import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { getDesktopReleaseDiagnostics } from '@/server/services/desktopRelease';

import { loadAppSettingsSectionSnapshot } from '../../appSettings/loader';
import { adminDesktopRouter } from './desktop';

const mocks = vi.hoisted(() => ({
  assets: {
    createDesktopBuildAssetUpload: vi.fn(),
    readTrustedDesktopBuildAsset: vi.fn(),
    validateDesktopBuildAssetManifest: vi.fn(),
  },
  audit: {
    runRequiredAdminAuditExternalEffect: vi.fn(async (_ctx, options) => {
      await options.audit('started');
      const result = await options.effect();
      await options.audit('succeeded', result);
      return result;
    }),
    runRequiredAdminAuditMutation: vi.fn(async (_ctx, options) => {
      const result = await options.mutation({});
      await options.audit(result);
      return result;
    }),
  },
  model: {
    archiveProfile: vi.fn(),
    getProfile: vi.fn(),
    getRevision: vi.fn(),
    getRevisionsByIds: vi.fn(),
    listProfiles: vi.fn(),
    listReleases: vi.fn(),
    saveDraft: vi.fn(),
  },
}));

vi.mock('@/database/models/desktopBuild', () => ({
  DesktopBuildModel: vi.fn(() => mocks.model),
}));

vi.mock('@/server/services/desktopBuild/assets', () => mocks.assets);

vi.mock('@/server/modules/S3', () => ({
  FileS3: vi.fn(() => ({})),
}));

vi.mock('./audit', () => mocks.audit);

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const payload = {
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
const trustedAsset = {
  contentType: 'image/png',
  height: 1024,
  key: `desktop-build-assets/${PROFILE_ID}/${ASSET_ID}.png`,
  kind: 'appPreview' as const,
  sha256: 'a'.repeat(64),
  size: 1024,
  width: 1024,
};
const manifest = {
  appPreview: trustedAsset,
  nsisHeader: {
    ...trustedAsset,
    contentType: 'image/bmp',
    height: 57,
    key: `desktop-build-assets/${PROFILE_ID}/22222222-2222-4222-8222-222222222223.bmp`,
    kind: 'nsisHeader' as const,
    width: 150,
  },
  nsisSidebar: {
    ...trustedAsset,
    contentType: 'image/bmp',
    height: 314,
    key: `desktop-build-assets/${PROFILE_ID}/22222222-2222-4222-8222-222222222224.bmp`,
    kind: 'nsisSidebar' as const,
    width: 164,
  },
  windowsIcon: {
    ...trustedAsset,
    contentType: 'image/x-icon',
    key: `desktop-build-assets/${PROFILE_ID}/22222222-2222-4222-8222-222222222225.ico`,
    kind: 'windowsIcon' as const,
  },
};

const adminRouterSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/server/services/desktopRelease', () => ({
  getDesktopReleaseDiagnostics: vi.fn(),
}));

vi.mock('../../appSettings/loader', () => ({
  loadAppSettingsSectionSnapshot: vi.fn(),
}));

const createDb = (role = 'system_admin') =>
  ({
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({ banned: false, role }),
      },
    },
  }) as any;

describe('adminDesktopRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue(createDb());
    vi.mocked(loadAppSettingsSectionSnapshot).mockResolvedValue(
      new Map([
        ['desktop.update.channel', 'stable'],
        ['desktop.update.currentVersion', '2.2.7'],
        ['desktop.update.serverUrl', 'https://releases.example.com'],
        ['desktop.oss.accessKeySecret', 'must-not-leak'],
      ]) as any,
    );
    vi.mocked(getDesktopReleaseDiagnostics).mockResolvedValue({
      baseUrl: 'https://releases.example.com',
      channels: [],
      checkedAt: '2026-07-21T00:00:00.000Z',
      configured: true,
    });
    mocks.model.archiveProfile.mockResolvedValue({ id: PROFILE_ID, status: 'archived' });
    mocks.model.getProfile.mockResolvedValue(null);
    mocks.model.getRevision.mockResolvedValue(null);
    mocks.model.getRevisionsByIds.mockResolvedValue([]);
    mocks.model.listProfiles.mockResolvedValue({ items: [], nextCursor: null });
    mocks.model.listReleases.mockResolvedValue([]);
    mocks.model.saveDraft.mockResolvedValue({
      profileId: PROFILE_ID,
      revision: 1,
      revisionId: 'revision-1',
    });
    mocks.assets.createDesktopBuildAssetUpload.mockResolvedValue({
      headers: { 'Content-Type': 'image/png' },
      key: trustedAsset.key,
      kind: 'appPreview',
      profileId: PROFILE_ID,
      uploadUrl: 'https://uploads.example.test/opaque-signature',
    });
    mocks.assets.readTrustedDesktopBuildAsset.mockResolvedValue(trustedAsset);
    mocks.assets.validateDesktopBuildAssetManifest.mockResolvedValue(manifest);
  });

  it('is registered under admin.desktop', () => {
    expect(adminRouterSource).toContain("import { adminDesktopRouter } from './desktop';");
    expect(adminRouterSource).toMatch(/\bdesktop:\s*adminDesktopRouter\b/);
  });

  it('uses the configured update server without exposing OSS credentials', async () => {
    const result = await adminDesktopRouter
      .createCaller({ userId: 'system-admin-user' } as any)
      .getOverview();

    expect(loadAppSettingsSectionSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      'desktop-update',
    );
    expect(getDesktopReleaseDiagnostics).toHaveBeenCalledWith({
      baseUrl: 'https://releases.example.com',
    });
    expect(result).toMatchObject({
      configuredChannel: 'stable',
      configuredVersion: '2.2.7',
      diagnostics: { configured: true },
    });
    expect(result).not.toHaveProperty('desktopOssConfig');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('requires the systemRead capability', async () => {
    vi.mocked(getServerDB).mockResolvedValue(createDb('finance_admin'));

    await expect(
      adminDesktopRouter.createCaller({ userId: 'finance-admin-user' } as any).getOverview(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getDesktopReleaseDiagnostics).not.toHaveBeenCalled();
  });

  it('returns draft profile DTOs without storage secrets or signed download URLs', async () => {
    mocks.model.listProfiles.mockResolvedValue({
      items: [
        {
          apiKey: 'must-not-leak',
          currentDraftRevisionId: 'revision-1',
          currentRevision: 1,
          firstStableReleaseAt: new Date('2026-07-21T00:00:00.000Z'),
          id: PROFILE_ID,
          name: 'ComHub',
          status: 'active',
        },
        {
          currentDraftRevisionId: 'revision-2',
          currentRevision: 2,
          firstStableReleaseAt: null,
          id: '33333333-3333-4333-8333-333333333333',
          name: 'ComHub Preview',
          status: 'active',
        },
      ],
      nextCursor: 2,
    });
    mocks.model.getRevisionsByIds.mockResolvedValue([
      {
        assetManifest: manifest,
        id: 'revision-1',
        payload,
        signedGetUrl: 'https://downloads.example.test/private',
        state: 'draft',
      },
      {
        assetManifest: manifest,
        id: 'revision-2',
        payload,
        state: 'draft',
      },
    ]);

    const result = await adminDesktopRouter
      .createCaller({ userId: 'system-admin-user' } as any)
      .listBuildProfiles({ cursor: 0, limit: 2 });

    expect(result).toMatchObject({ nextCursor: 2 });
    expect(result.items[0]).toMatchObject({
      currentDraft: { id: 'revision-1', state: 'draft' },
      currentRevision: 1,
      id: PROFILE_ID,
      identityLocked: true,
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('downloads.example.test');
    expect(mocks.model.listProfiles).toHaveBeenCalledWith({ cursor: 0, limit: 2 });
    expect(mocks.model.getRevisionsByIds).toHaveBeenCalledWith(['revision-1', 'revision-2']);
    expect(mocks.model.getRevision).not.toHaveBeenCalled();
  });

  it('requires systemWrite before issuing a private asset upload target', async () => {
    vi.mocked(getServerDB).mockResolvedValue(createDb('finance_admin'));

    await expect(
      adminDesktopRouter
        .createCaller({ userId: 'finance-admin-user' } as any)
        .createBuildAssetUpload({ kind: 'appPreview' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.assets.createDesktopBuildAssetUpload).not.toHaveBeenCalled();
  });

  it('completes trusted assets through the required external-effect audit wrapper', async () => {
    const result = await adminDesktopRouter
      .createCaller({ userId: 'system-admin-user' } as any)
      .completeBuildAssetUpload({
        key: trustedAsset.key,
        kind: 'appPreview',
        profileId: PROFILE_ID,
      });

    expect(result).toEqual(trustedAsset);
    expect(mocks.audit.runRequiredAdminAuditExternalEffect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ audit: expect.any(Function), effect: expect.any(Function) }),
    );
    const auditOptions = mocks.audit.runRequiredAdminAuditExternalEffect.mock.calls[0]?.[1] as {
      audit: (
        status: string,
        asset?: typeof trustedAsset,
      ) => Promise<{
        payload: Record<string, unknown>;
      }>;
    };
    const auditPayloads = await Promise.all([
      auditOptions.audit('started'),
      auditOptions.audit('succeeded', trustedAsset),
    ]);

    expect(auditPayloads.map((entry) => entry.payload)).toEqual([
      { key: trustedAsset.key, kind: 'appPreview', profileId: PROFILE_ID },
      {
        key: trustedAsset.key,
        kind: 'appPreview',
        profileId: PROFILE_ID,
        sha256: trustedAsset.sha256,
        size: trustedAsset.size,
      },
    ]);
    const serializedAuditPayloads = JSON.stringify(auditPayloads);
    for (const forbidden of [
      'uploadUrl',
      'headers',
      'accessKey',
      'secret',
      'token',
      'credentials',
    ]) {
      expect(serializedAuditPayloads).not.toContain(forbidden);
    }
    expect(JSON.stringify(result)).not.toContain('uploads.example.test');
  });

  it('saves only a revalidated draft inside the required audit transaction', async () => {
    const result = await adminDesktopRouter
      .createCaller({ userId: 'system-admin-user' } as any)
      .saveBuildProfileDraft({
        assets: manifest,
        createIfMissing: true,
        name: 'ComHub',
        payload,
        profileId: PROFILE_ID,
      });

    expect(result).toEqual({ profileId: PROFILE_ID, revision: 1, revisionId: 'revision-1' });
    expect(mocks.assets.validateDesktopBuildAssetManifest).toHaveBeenCalledWith(
      expect.objectContaining({ manifest, profileId: PROFILE_ID }),
    );
    expect(mocks.model.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ createIfMissing: true, profileId: PROFILE_ID }),
      expect.anything(),
    );
    expect(mocks.audit.runRequiredAdminAuditMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ audit: expect.any(Function), mutation: expect.any(Function) }),
    );
  });

  it('archives profiles through a required audit transaction without deleting drafts', async () => {
    await expect(
      adminDesktopRouter
        .createCaller({ userId: 'system-admin-user' } as any)
        .archiveBuildProfile({ profileId: PROFILE_ID }),
    ).resolves.toEqual({ id: PROFILE_ID, status: 'archived' });

    expect(mocks.model.archiveProfile).toHaveBeenCalledWith(
      { actorUserId: 'system-admin-user', profileId: PROFILE_ID },
      expect.anything(),
    );
    expect(mocks.audit.runRequiredAdminAuditMutation).toHaveBeenCalled();
  });
});
