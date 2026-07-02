// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetServerBrand = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
  ORG_NAME: 'lobehub',
}));

vi.mock('@lobechat/const', () => ({
  OG_URL: 'https://example.com/og.png',
}));

vi.mock('@/config/featureFlags', () => ({
  getServerFeatureFlagsValue: () => ({ enablePpt: true }),
}));

vi.mock('@/const/url', () => ({
  OFFICIAL_URL: 'https://chat.example.com',
}));

vi.mock('@/const/version', () => ({
  isCustomORG: false,
  isDesktop: false,
}));

vi.mock('@/envs/analytics', () => ({
  analyticsEnv: {},
}));

vi.mock('@/envs/app', () => ({
  appEnv: { MARKET_BASE_URL: 'https://market.example.com' },
}));

vi.mock('@/envs/file', () => ({
  fileEnv: { NEXT_PUBLIC_S3_FILE_PATH: 'files' },
}));

vi.mock('@/envs/python', () => ({
  pythonEnv: {},
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: vi.fn(async () => ({ defaultAgent: {} })),
}));

vi.mock('@/server/services/appSettings', () => ({
  getServerFileS3Config: vi.fn(async () => ({ filePath: 'runtime-files' })),
}));

vi.mock('@/server/services/brand', () => ({
  getServerBrand: mockGetServerBrand,
}));

vi.mock('@/server/translation', () => ({
  translation: vi.fn(async () => ({
    t: (key: string, vars?: { appName?: string }) => `${vars?.appName ?? 'App'} ${key}`,
  })),
}));

vi.mock('./spaHtmlTemplates', () => ({
  desktopHtmlTemplate: `<!doctype html><html><head><link rel="icon" href="/_spa/favicon.ico" /><link rel="shortcut icon" href="/_spa/favicon-32x32.ico" /><!--SEO_META--><script>window.__SERVER_CONFIG__ = undefined; /* SERVER_CONFIG */</script></head><body><div id="loading-screen"><div id="loading-brand" aria-label="Loading" role="status"><svg><title>LobeHub</title></svg></div></div><div id="root"></div><!--ANALYTICS_SCRIPTS--></body></html>`,
  mobileHtmlTemplate: `<!doctype html><html><head><!--SEO_META--><script>window.__SERVER_CONFIG__ = undefined; /* SERVER_CONFIG */</script></head><body><div id="root"></div><!--ANALYTICS_SCRIPTS--></body></html>`,
}));

describe('SPA route brand boot config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerBrand.mockResolvedValue({
      authTitle: '\u767b\u5f55\u9875\u6587\u6848\u4e0d\u4f5c\u4e3a\u52a0\u8f7d\u6587\u6848',
      copyrightText: 'Copyright',
      defaultSkillName: '\u7384\u679c\u52a9\u624b',
      faviconUrl: 'https://cdn.example.com/favicon.ico',
      loadingText: '\u6b63\u5728\u8fdb\u5165\u7384\u679cAI',
      logoUrl: null,
      name: '\u7384\u679cAI',
      primaryColor: '#12b981',
      slogan: '\u54c1\u724c\u53e3\u53f7\u4e0d\u4f5c\u4e3a\u52a0\u8f7d\u6587\u6848',
    });
  });

  it('injects the server brand into SPA config without replacing the upstream loading screen', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('https://chat.example.com/'), {
      params: Promise.resolve({ variants: 'zh-CN__0' }),
    });
    const html = await response.text();

    expect(html).toContain(
      '"brand":{"authTitle":"\u767b\u5f55\u9875\u6587\u6848\u4e0d\u4f5c\u4e3a\u52a0\u8f7d\u6587\u6848"',
    );
    expect(html).toContain('"\u7384\u679cAI"');
    expect(html).toContain('<title>\u7384\u679cAI chat.title</title>');
    expect(html).toContain('<meta property="og:site_name" content="\u7384\u679cAI" />');
    expect(html).not.toContain('<meta property="og:site_name" content="LobeHub" />');

    const loadingBrandHtml = html.match(/<div id="loading-brand"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(loadingBrandHtml).toContain('<svg><title>LobeHub</title></svg>');
    expect(loadingBrandHtml).not.toContain('\u6b63\u5728\u8fdb\u5165\u7384\u679cAI');
    expect(loadingBrandHtml).not.toContain('\u54c1\u724c\u53e3\u53f7\u4e0d\u4f5c\u4e3a\u52a0\u8f7d\u6587\u6848');
    expect(loadingBrandHtml).not.toContain(
      '\u767b\u5f55\u9875\u6587\u6848\u4e0d\u4f5c\u4e3a\u52a0\u8f7d\u6587\u6848',
    );
  });
});
