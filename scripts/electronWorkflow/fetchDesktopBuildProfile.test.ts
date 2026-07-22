// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { stageDesktopBuildProfile } from './fetchDesktopBuildProfile';

const assetBytes = {
  appPreview: Buffer.from('preview'),
  nsisHeader: Buffer.from('header'),
  nsisSidebar: Buffer.from('sidebar'),
  windowsIcon: Buffer.from('icon'),
};
const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const stagedDirs: string[] = [];

const profileResponse = (overrides: Record<string, unknown> = {}) => ({
  assets: Object.fromEntries(
    Object.entries(assetBytes).map(([kind, bytes]) => [
      kind,
      {
        contentType: kind === 'windowsIcon' ? 'image/x-icon' : 'image/png',
        sha256: sha256(bytes),
        size: bytes.byteLength,
        url: `https://assets.example.test/${kind}`,
      },
    ]),
  ),
  profileRevision: {
    id: '22222222-2222-4222-8222-222222222222',
    payload: { applicationId: 'com.qingyou.comhub' },
    state: 'frozen',
  },
  releaseId: '11111111-1111-4111-8111-111111111111',
  ...overrides,
});

const fetcherFor = (profile: Record<string, any>, responses = new Map<string, Response>()) =>
  vi.fn(async (input: URL | RequestInfo) => {
    const url = input.toString();
    if (url.includes('/profile')) return new Response(JSON.stringify(profile), { status: 200 });
    return (
      responses.get(url) ??
      new Response(assetBytes[url.split('/').at(-1)! as keyof typeof assetBytes])
    );
  }) as typeof fetch;

const createOutputDir = async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'desktop-profile-test-'));
  stagedDirs.push(outputDir);
  return outputDir;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(stagedDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('stageDesktopBuildProfile', () => {
  it('stages verified assets at fixed absolute paths after a controlled redirect', async () => {
    const outputDir = await createOutputDir();
    const responses = new Map<string, Response>([
      [
        'https://assets.example.test/appPreview',
        new Response(null, { headers: { location: '/appPreview-final' }, status: 302 }),
      ],
      ['https://assets.example.test/appPreview-final', new Response(assetBytes.appPreview)],
    ]);

    const result = await stageDesktopBuildProfile({
      appUrl: 'https://chat.qingyouai.com/',
      fetcher: fetcherFor(profileResponse(), responses),
      outputDir,
      releaseId: '11111111-1111-4111-8111-111111111111',
      token: 'release-token',
    });
    const staged = JSON.parse(await readFile(result, 'utf8'));

    expect(path.isAbsolute(result)).toBe(true);
    expect(staged).toMatchObject({
      profile: { applicationId: 'com.qingyou.comhub' },
      profileRevisionId: '22222222-2222-4222-8222-222222222222',
      releaseId: '11111111-1111-4111-8111-111111111111',
    });
    expect(Object.values(staged.assets).every((file) => path.isAbsolute(file as string))).toBe(
      true,
    );
    await expect(readFile(staged.assets.windowsIcon)).resolves.toEqual(assetBytes.windowsIcon);
  });

  it('rejects a checksum mismatch and removes partial staged files', async () => {
    const outputDir = await createOutputDir();
    const profile = profileResponse();
    profile.assets.appPreview.sha256 = '0'.repeat(64);

    await expect(
      stageDesktopBuildProfile({
        appUrl: 'https://chat.qingyouai.com',
        fetcher: fetcherFor(profile),
        outputDir,
        releaseId: profile.releaseId,
        token: 'release-token',
      }),
    ).rejects.toThrow('DESKTOP_BUILD_PROFILE_ASSET_CHECKSUM_MISMATCH');
    await expect(readFile(path.join(outputDir, 'app-preview.png'))).rejects.toThrow();
  });

  it('rejects oversized content-length values before streaming the response', async () => {
    const outputDir = await createOutputDir();
    const profile = profileResponse();
    profile.assets.appPreview.size = 1;
    const responses = new Map<string, Response>([
      [
        'https://assets.example.test/appPreview',
        new Response(assetBytes.appPreview, { headers: { 'content-length': '999999999' } }),
      ],
    ]);

    await expect(
      stageDesktopBuildProfile({
        appUrl: 'https://chat.qingyouai.com',
        fetcher: fetcherFor(profile, responses),
        outputDir,
        releaseId: profile.releaseId,
        token: 'release-token',
      }),
    ).rejects.toThrow('DESKTOP_BUILD_PROFILE_ASSET_TOO_LARGE');
  });

  it('rejects profiles missing a required asset', async () => {
    const outputDir = await createOutputDir();
    const profile = profileResponse();
    delete profile.assets.nsisSidebar;

    await expect(
      stageDesktopBuildProfile({
        appUrl: 'https://chat.qingyouai.com',
        fetcher: fetcherFor(profile),
        outputDir,
        releaseId: profile.releaseId,
        token: 'release-token',
      }),
    ).rejects.toThrow('DESKTOP_BUILD_PROFILE_ASSET_MISSING');
  });
});
