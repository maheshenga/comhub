import urlJoin from 'url-join';

import { FetchCacheTag } from '@/const/cacheControl';
import { normalizeDesktopUpdateServerUrl } from '@/const/desktopUpdate';

import {
  DESKTOP_MANIFEST_TIMEOUT_MS,
  fetchUpdateServerManifest,
  normalizeManifestUrls,
  type UpdateServerManifest,
} from './diagnostics';
import {
  buildTypeMatchers,
  type DesktopDownloadType,
  resolveDesktopDownloadFromUrls,
} from './downloadTypes';

export {
  type DesktopArtifactDiagnostic,
  type DesktopChannelDiagnostic,
  type DesktopDiagnosticReason,
  type DesktopDiagnosticStatus,
  type DesktopReleaseChannel,
  getDesktopReleaseDiagnostics,
} from './diagnostics';
export type { DesktopDownloadType } from './downloadTypes';

export interface DesktopDownloadInfo {
  assetName: string;
  publishedAt?: string;
  tag: string;
  type: DesktopDownloadType;
  url: string;
  version: string;
}

type GithubReleaseAsset = {
  browser_download_url: string;
  name: string;
};

type GithubRelease = {
  assets: GithubReleaseAsset[];
  published_at?: string;
  tag_name: string;
};

export { resolveDesktopDownloadFromUrls };

export const resolveDesktopDownload = (
  release: GithubRelease,
  type: DesktopDownloadType,
): DesktopDownloadInfo | null => {
  const tag = release.tag_name;
  const version = tag.replace(/^v/i, '');
  const matchers = buildTypeMatchers(type);

  const matchedAsset = matchers
    .map((matcher) => release.assets.find((asset) => matcher.test(asset.name)))
    .find(Boolean);

  if (!matchedAsset) return null;

  return {
    assetName: matchedAsset.name,
    publishedAt: release.published_at,
    tag,
    type,
    url: matchedAsset.browser_download_url,
    version,
  };
};

export const getLatestDesktopReleaseFromGithub = async (options?: {
  owner?: string;
  repo?: string;
  token?: string;
}): Promise<GithubRelease> => {
  const owner = options?.owner || 'lobehub';
  const repo = options?.repo || 'lobe-chat';
  const token = options?.token || process.env.GITHUB_TOKEN;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'lobehub-server',
    },
    next: { revalidate: 300, tags: [FetchCacheTag.DesktopRelease] },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub releases/latest request failed: ${res.status} ${text}`.trim());
  }

  return (await res.json()) as GithubRelease;
};

export { fetchUpdateServerManifest };

export { normalizeManifestUrls };

export const getStableDesktopReleaseInfoFromUpdateServer = async (options?: {
  baseUrl?: string;
}): Promise<{ publishedAt?: string; tag: string; urls: string[]; version: string } | null> => {
  const baseUrl =
    options?.baseUrl || process.env.DESKTOP_UPDATE_SERVER_URL || process.env.UPDATE_SERVER_URL;
  if (!baseUrl) return null;

  const normalizedBaseUrl = normalizeDesktopUpdateServerUrl(baseUrl);
  if ('reason' in normalizedBaseUrl) return null;

  const timestamp = Date.now();
  const channelBaseUrl = urlJoin(normalizedBaseUrl.url, 'stable');
  const fetchOptions = { timeoutMs: DESKTOP_MANIFEST_TIMEOUT_MS };

  const [mac, win, linux] = await Promise.all([
    fetchUpdateServerManifest(channelBaseUrl, 'stable-mac.yml?t=' + timestamp, fetchOptions).catch(
      () => null,
    ),
    fetchUpdateServerManifest(channelBaseUrl, 'stable.yml?t=' + timestamp, fetchOptions).catch(
      () => null,
    ),
    fetchUpdateServerManifest(
      channelBaseUrl,
      'stable-linux.yml?t=' + timestamp,
      fetchOptions,
    ).catch(() => null),
  ]);

  const manifests = [mac, win, linux].filter(Boolean) as UpdateServerManifest[];
  const version = manifests.map((m) => m.version).find(Boolean) || '';
  if (!version) return null;

  const tag = `v${version.replace(/^v/i, '')}`;
  const publishedAt = manifests.map((m) => m.releaseDate).find(Boolean);

  const urls = [
    ...(mac ? normalizeManifestUrls(channelBaseUrl, mac) : []),
    ...(win ? normalizeManifestUrls(channelBaseUrl, win) : []),
    ...(linux ? normalizeManifestUrls(channelBaseUrl, linux) : []),
  ];

  return { publishedAt, tag, urls, version: version.replace(/^v/i, '') };
};

export const resolveDesktopDownloadFromUpdateServer = async (options: {
  baseUrl?: string;
  type: DesktopDownloadType;
}): Promise<DesktopDownloadInfo | null> => {
  const info = await getStableDesktopReleaseInfoFromUpdateServer({ baseUrl: options.baseUrl });
  if (!info) return null;

  return resolveDesktopDownloadFromUrls({ ...info, type: options.type });
};
