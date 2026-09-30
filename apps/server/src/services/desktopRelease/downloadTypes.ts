export type DesktopDownloadType = 'linux' | 'mac-arm' | 'mac-intel' | 'windows';

export const getBasename = (pathname: string) => {
  const cleaned = pathname.split('?')[0] || '';
  const lastSlash = cleaned.lastIndexOf('/');
  return lastSlash >= 0 ? cleaned.slice(lastSlash + 1) : cleaned;
};

export const buildTypeMatchers = (type: DesktopDownloadType) => {
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
}) => {
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
