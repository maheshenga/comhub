import { describe, expect, it, vi } from 'vitest';

import {
  type DesktopDownloadType,
  getDesktopReleaseDiagnostics,
  resolveDesktopDownload,
  resolveDesktopDownloadFromUrls,
} from './index';

const mockRelease = {
  assets: [
    {
      browser_download_url: 'https://example.com/LobeHub-2.0.0-arm64.dmg',
      name: 'LobeHub-2.0.0-arm64.dmg',
    },
    {
      browser_download_url: 'https://example.com/LobeHub-2.0.0-x64.dmg',
      name: 'LobeHub-2.0.0-x64.dmg',
    },
    {
      browser_download_url: 'https://example.com/LobeHub-2.0.0-setup.exe',
      name: 'LobeHub-2.0.0-setup.exe',
    },
    {
      browser_download_url: 'https://example.com/LobeHub-2.0.0.AppImage',
      name: 'LobeHub-2.0.0.AppImage',
    },
  ],
  published_at: '2026-01-01T00:00:00.000Z',
  tag_name: 'v2.0.0',
};

const manifest = (
  version: string,
  files: Array<{ sha512?: string; size?: number; url: string }>,
) =>
  [
    `version: ${version}`,
    'files:',
    ...files.flatMap((file) => [
      `  - url: ${file.url}`,
      ...(file.sha512 ? [`    sha512: ${file.sha512}`] : []),
      ...(file.size ? [`    size: ${file.size}`] : []),
    ]),
    'releaseDate: 2026-07-21T00:00:00.000Z',
  ].join('\n');

describe('desktopRelease', () => {
  it.each([
    ['mac-arm', 'LobeHub-2.0.0-arm64.dmg'],
    ['mac-intel', 'LobeHub-2.0.0-x64.dmg'],
    ['windows', 'LobeHub-2.0.0-setup.exe'],
    ['linux', 'LobeHub-2.0.0.AppImage'],
  ] as Array<[DesktopDownloadType, string]>)(
    'resolveDesktopDownload(%s)',
    (type, expectedAssetName) => {
      const resolved = resolveDesktopDownload(mockRelease as any, type);
      expect(resolved?.assetName).toBe(expectedAssetName);
      expect(resolved?.version).toBe('2.0.0');
      expect(resolved?.tag).toBe('v2.0.0');
      expect(resolved?.type).toBe(type);
      expect(resolved?.url).toContain(expectedAssetName);
    },
  );

  it('resolveDesktopDownloadFromUrls should match basename', () => {
    const resolved = resolveDesktopDownloadFromUrls({
      publishedAt: '2026-01-01T00:00:00.000Z',
      tag: 'v2.0.0',
      type: 'windows',
      urls: [
        'https://releases.example.com/stable/2.0.0/LobeHub-2.0.0-setup.exe?download=1',
        'https://releases.example.com/stable/2.0.0/LobeHub-2.0.0-x64.dmg',
      ],
      version: '2.0.0',
    });

    expect(resolved?.assetName).toBe('LobeHub-2.0.0-setup.exe');
    expect(resolved?.url).toContain('setup.exe');
  });

  it('reports stable and canary platform artifacts independently', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/stable/stable-mac.yml')) {
        return new Response(
          manifest('2.3.0', [
            { size: 11, url: 'ComHub-2.3.0-arm64.dmg' },
            { size: 12, url: 'ComHub-2.3.0-x64.dmg' },
          ]),
        );
      }
      if (url.includes('/stable/stable-linux.yml')) {
        return new Response(manifest('2.3.0', [{ url: 'ComHub-2.3.0.AppImage' }]));
      }
      if (url.includes('/stable/stable.yml')) {
        return new Response(
          manifest('2.3.0', [
            { sha512: 'win-hash', url: 'ComHub-2.3.0-setup.exe' },
          ]),
        );
      }

      return new Response('missing', { status: 404 });
    });

    const result = await getDesktopReleaseDiagnostics({
      baseUrl: 'https://releases.example.com',
      fetcher: fetcher as typeof fetch,
      now: () => new Date('2026-07-21T01:00:00.000Z'),
    });

    expect(result.configured).toBe(true);
    expect(result.checkedAt).toBe('2026-07-21T01:00:00.000Z');
    expect(result.channels.find(({ channel }) => channel === 'stable')).toMatchObject({
      channel: 'stable',
      status: 'healthy',
      version: '2.3.0',
    });
    expect(
      result.channels.find(({ channel }) => channel === 'stable')?.platforms.windows,
    ).toMatchObject({
      assetName: 'ComHub-2.3.0-setup.exe',
      sha512: 'win-hash',
      status: 'available',
    });
    expect(result.channels.find(({ channel }) => channel === 'canary')?.status).toBe(
      'unavailable',
    );
  });

  it('keeps healthy platforms when one manifest is unavailable', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) =>
      String(input).includes('-linux.yml')
        ? new Response('upstream unavailable', { status: 503 })
        : new Response(manifest('2.3.0', [{ url: 'ComHub-2.3.0-setup.exe' }])),
    );

    const result = await getDesktopReleaseDiagnostics({
      baseUrl: 'https://releases.example.com',
      channels: ['stable'],
      fetcher: fetcher as typeof fetch,
    });

    expect(result.channels[0].status).toBe('degraded');
    expect(result.channels[0].platforms.windows.status).toBe('available');
    expect(result.channels[0].platforms.linux).toMatchObject({
      reason: expect.stringContaining('503'),
      status: 'unavailable',
    });
  });

  it('returns an unconfigured result without making network requests', async () => {
    const fetcher = vi.fn();
    const result = await getDesktopReleaseDiagnostics({
      baseUrl: '',
      fetcher: fetcher as typeof fetch,
    });

    expect(result).toMatchObject({ configured: false, channels: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
