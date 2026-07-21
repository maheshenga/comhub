import urlJoin from 'url-join';
import { parse } from 'yaml';

import { FetchCacheTag } from '@/const/cacheControl';

export type DesktopDownloadType = 'linux' | 'mac-arm' | 'mac-intel' | 'windows';
export type DesktopReleaseChannel = 'canary' | 'stable';
export type DesktopDiagnosticStatus = 'available' | 'missing' | 'unavailable';

export interface DesktopDownloadInfo {
  assetName: string;
  publishedAt?: string;
  tag: string;
  type: DesktopDownloadType;
  url: string;
  version: string;
}

export interface DesktopArtifactDiagnostic {
  assetName?: string;
  publishedAt?: string;
  reason?: string;
  sha512?: string;
  size?: number;
  status: DesktopDiagnosticStatus;
  type: DesktopDownloadType;
  url?: string;
  version?: string;
}

export interface DesktopChannelDiagnostic {
  channel: DesktopReleaseChannel;
  platforms: Record<DesktopDownloadType, DesktopArtifactDiagnostic>;
  publishedAt?: string;
  status: 'degraded' | 'healthy' | 'unavailable';
  version?: string;
}

export interface DesktopReleaseDiagnostics {
  baseUrl: null | string;
  channels: DesktopChannelDiagnostic[];
  checkedAt: string;
  configured: boolean;
}

export interface DesktopReleaseDiagnosticsOptions {
  baseUrl?: null | string;
  channels?: DesktopReleaseChannel[];
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
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

type UpdateServerManifestFile = {
  sha512?: string;
  size?: number;
  url: string;
};

type UpdateServerManifest = {
  files?: UpdateServerManifestFile[];
  path?: string;
  releaseDate?: string;
  version?: string;
};

const getBasename = (pathname: string) => {
  const cleaned = pathname.split('?')[0] || '';
  const lastSlash = cleaned.lastIndexOf('/');
  return lastSlash >= 0 ? cleaned.slice(lastSlash + 1) : cleaned;
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const buildTypeMatchers = (type: DesktopDownloadType) => {
  switch (type) {
    case 'mac-arm': {
      return [/-arm64\.dmg$/i, /-arm64-mac\.zip$/i, /-arm64\.zip$/i, /\.dmg$/i, /\.zip$/i];
    }
    case 'mac-intel': {
      return [/-x64\.dmg$/i, /-x64-mac\.zip$/i, /-x64\.zip$/i, /\.dmg$/i, /\.zip$/i];
    }
    case 'windows': {
      return [/-setup\.exe$/i, /\.exe$/i];
    }
    case 'linux': {
      return [/\.appimage$/i, /\.deb$/i, /\.rpm$/i, /\.snap$/i, /\.tar\.gz$/i];
    }
  }
};

export const resolveDesktopDownloadFromUrls = (options: {
  publishedAt?: string;
  tag: string;
  type: DesktopDownloadType;
  urls: string[];
  version: string;
}): DesktopDownloadInfo | null => {
  const matchers = buildTypeMatchers(options.type);

  const matchedUrl = matchers
    .map((matcher) => options.urls.find((url) => matcher.test(getBasename(url))))
    .find(Boolean);

  if (!matchedUrl) return null;

  return {
    assetName: getBasename(matchedUrl),
    publishedAt: options.publishedAt,
    tag: options.tag,
    type: options.type,
    url: matchedUrl,
    version: options.version,
  };
};

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

const fetchUpdateServerManifest = async (
  baseUrl: string,
  manifestName: string,
  options?: {
    cache?: boolean;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<UpdateServerManifest> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 5000);
  const requestInit =
    options?.cache === false
      ? ({ cache: 'no-store', signal: controller.signal } satisfies RequestInit)
      : ({
          next: { revalidate: 300, tags: [FetchCacheTag.DesktopRelease] },
          signal: controller.signal,
        } as RequestInit);

  let res: Response;
  try {
    res = await (options?.fetcher ?? fetch)(urlJoin(baseUrl, manifestName), requestInit);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Update server manifest request failed: ${res.status}`);
  }

  const text = await res.text();
  if (text.length > 512 * 1024) {
    throw new Error('Update server manifest response is too large');
  }
  return (parse(text) || {}) as UpdateServerManifest;
};

const normalizeManifestUrls = (baseUrl: string, manifest: UpdateServerManifest) => {
  const urls: string[] = [];

  for (const file of manifest.files || []) {
    if (!file?.url) continue;
    urls.push(isAbsoluteUrl(file.url) ? file.url : urlJoin(baseUrl, file.url));
  }

  if (manifest.path) {
    urls.push(isAbsoluteUrl(manifest.path) ? manifest.path : urlJoin(baseUrl, manifest.path));
  }

  return urls;
};

type ManifestResult =
  | { manifest: UpdateServerManifest; reason?: never }
  | { manifest?: never; reason: string };

const readManifest = async (
  channelBaseUrl: string,
  manifestName: string,
  options: { fetcher: typeof fetch; timeoutMs: number },
): Promise<ManifestResult> => {
  try {
    return {
      manifest: await fetchUpdateServerManifest(channelBaseUrl, manifestName, {
        cache: false,
        ...options,
      }),
    };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
};

const resolveManifestArtifact = (options: {
  baseUrl: string;
  manifest?: UpdateServerManifest;
  reason?: string;
  type: DesktopDownloadType;
}): DesktopArtifactDiagnostic => {
  if (!options.manifest) {
    return {
      reason: options.reason || 'Update manifest is unavailable',
      status: 'unavailable',
      type: options.type,
    };
  }

  const version = options.manifest.version?.replace(/^v/i, '');
  if (!version) {
    return {
      reason: 'Update manifest version is missing',
      status: 'unavailable',
      type: options.type,
    };
  }

  const resolved = resolveDesktopDownloadFromUrls({
    publishedAt: options.manifest.releaseDate,
    tag: `v${version}`,
    type: options.type,
    urls: normalizeManifestUrls(options.baseUrl, options.manifest),
    version,
  });
  if (!resolved) {
    return {
      publishedAt: options.manifest.releaseDate,
      reason: `No ${options.type} installer in update manifest`,
      status: 'missing',
      type: options.type,
      version,
    };
  }

  const file = options.manifest.files?.find(
    ({ url }) => getBasename(url) === resolved.assetName,
  );

  return {
    ...resolved,
    sha512: file?.sha512,
    size: file?.size,
    status: 'available',
  };
};

const unavailableChannel = (
  channel: DesktopReleaseChannel,
  reason: string,
): DesktopChannelDiagnostic => {
  const unavailable = (type: DesktopDownloadType): DesktopArtifactDiagnostic => ({
    reason,
    status: 'unavailable',
    type,
  });

  return {
    channel,
    platforms: {
      linux: unavailable('linux'),
      'mac-arm': unavailable('mac-arm'),
      'mac-intel': unavailable('mac-intel'),
      windows: unavailable('windows'),
    },
    status: 'unavailable',
  };
};

const getDesktopChannelDiagnostic = async (options: {
  baseUrl: string;
  channel: DesktopReleaseChannel;
  fetcher: typeof fetch;
  timeoutMs: number;
}): Promise<DesktopChannelDiagnostic> => {
  const channelBaseUrl = urlJoin(options.baseUrl, options.channel);
  const [windowsManifest, macManifest, linuxManifest] = await Promise.all([
    readManifest(channelBaseUrl, `${options.channel}.yml`, options),
    readManifest(channelBaseUrl, `${options.channel}-mac.yml`, options),
    readManifest(channelBaseUrl, `${options.channel}-linux.yml`, options),
  ]);
  const platforms: DesktopChannelDiagnostic['platforms'] = {
    linux: resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: linuxManifest.manifest,
      reason: linuxManifest.reason,
      type: 'linux',
    }),
    'mac-arm': resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: macManifest.manifest,
      reason: macManifest.reason,
      type: 'mac-arm',
    }),
    'mac-intel': resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: macManifest.manifest,
      reason: macManifest.reason,
      type: 'mac-intel',
    }),
    windows: resolveManifestArtifact({
      baseUrl: channelBaseUrl,
      manifest: windowsManifest.manifest,
      reason: windowsManifest.reason,
      type: 'windows',
    }),
  };
  const artifacts = Object.values(platforms);
  const availableCount = artifacts.filter(({ status }) => status === 'available').length;
  const versions = new Set(artifacts.map(({ version }) => version).filter(Boolean));

  return {
    channel: options.channel,
    platforms,
    publishedAt: artifacts.find(({ publishedAt }) => publishedAt)?.publishedAt,
    status:
      availableCount === artifacts.length && versions.size === 1
        ? 'healthy'
        : availableCount === 0
          ? 'unavailable'
          : 'degraded',
    version: artifacts.find(({ version }) => version)?.version,
  };
};

export const getDesktopReleaseDiagnostics = async (
  options: DesktopReleaseDiagnosticsOptions = {},
): Promise<DesktopReleaseDiagnostics> => {
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const rawBaseUrl = options.baseUrl?.trim().replace(/\/+$/, '') || null;
  if (!rawBaseUrl) {
    return { baseUrl: null, channels: [], checkedAt, configured: false };
  }

  const channels = options.channels ?? ['stable', 'canary'];
  let baseUrl: string;
  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Update server URL must use HTTP or HTTPS');
    }
    baseUrl = parsed.toString().replace(/\/$/, '');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Update server URL is invalid';
    return {
      baseUrl: rawBaseUrl,
      channels: channels.map((channel) => unavailableChannel(channel, reason)),
      checkedAt,
      configured: true,
    };
  }

  return {
    baseUrl,
    channels: await Promise.all(
      channels.map((channel) =>
        getDesktopChannelDiagnostic({
          baseUrl,
          channel,
          fetcher: options.fetcher ?? fetch,
          timeoutMs: options.timeoutMs ?? 5000,
        }),
      ),
    ),
    checkedAt,
    configured: true,
  };
};

export const getStableDesktopReleaseInfoFromUpdateServer = async (options?: {
  baseUrl?: string;
}): Promise<{ publishedAt?: string; tag: string; urls: string[]; version: string } | null> => {
  const baseUrl =
    options?.baseUrl || process.env.DESKTOP_UPDATE_SERVER_URL || process.env.UPDATE_SERVER_URL;
  if (!baseUrl) return null;

  const timestamp = Date.now();
  const channelBaseUrl = urlJoin(baseUrl, 'stable');
  const fetchOptions = { fetcher: fetch, timeoutMs: 5000 };

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
