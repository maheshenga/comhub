import { ORG_NAME } from '@lobechat/business-const';
import { OG_URL } from '@lobechat/const';
import { DEFAULT_BRAND_ICON_SVG, DEFAULT_BRAND_TITLE } from '@/const/branding';

import { getServerFeatureFlagsValue } from '@/config/featureFlags';
import { OFFICIAL_URL } from '@/const/url';
import { isCustomORG, isDesktop } from '@/const/version';
import {
  getRuntimeBrandConfig,
  type RuntimeBrandConfig,
} from '@/server/globalConfig/getBrandConfig';
import { analyticsEnv } from '@/envs/analytics';
import { appEnv } from '@/envs/app';
import { fileEnv } from '@/envs/file';
import { pythonEnv } from '@/envs/python';
import { type Locales } from '@/locales/resources';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { translation } from '@/server/translation';
import { serializeForHtml } from '@/server/utils/serializeForHtml';
import {
  type AnalyticsConfig,
  type SPAClientEnv,
  type SPAServerConfig,
} from '@/types/spaServerConfig';
import { RouteVariants } from '@/utils/server/routeVariants';

export function generateStaticParams() {
  const mobileOptions = isDesktop ? [false] : [true, false];
  const staticLocales: Locales[] = ['en-US', 'zh-CN'];

  const variants: { variants: string }[] = [];

  for (const locale of staticLocales) {
    for (const isMobile of mobileOptions) {
      variants.push({
        variants: RouteVariants.serializeVariants({ isMobile, locale }),
      });
    }
  }

  return variants;
}

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_ORIGIN = 'http://localhost:9876';
const DEFAULT_LOADING_ICON_MARKUP = `<img alt="" data-loading-icon="true" src="data:image/svg+xml;charset=UTF-8,${encodeURIComponent(DEFAULT_BRAND_ICON_SVG)}" />`;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

async function rewriteViteAssetUrls(html: string): Promise<string> {
  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML(html);

  document.querySelectorAll('script[src]').forEach((el: Element) => {
    const src = el.getAttribute('src');
    if (src && src.startsWith('/')) {
      el.setAttribute('src', `${VITE_DEV_ORIGIN}${src}`);
    }
  });

  document.querySelectorAll('link[href]').forEach((el: Element) => {
    const href = el.getAttribute('href');
    if (href && href.startsWith('/')) {
      el.setAttribute('href', `${VITE_DEV_ORIGIN}${href}`);
    }
  });

  document.querySelectorAll('script[type="module"]:not([src])').forEach((el: Element) => {
    const text = el.textContent || '';
    if (text.includes('/@')) {
      el.textContent = text.replaceAll(
        /from\s+["'](\/[@\w].*?)["']/g,
        (_match: string, p: string) => `from "${VITE_DEV_ORIGIN}${p}"`,
      );
    }
  });

  const workerPatch = document.createElement('script');
  workerPatch.textContent = `(function(){
var O=globalThis.Worker;
globalThis.Worker=function(u,o){
var h=typeof u==='string'?u:u instanceof URL?u.href:'';
if(h.startsWith('${VITE_DEV_ORIGIN}')){
var b=new Blob(['import "'+h+'";'],{type:'application/javascript'});
return new O(URL.createObjectURL(b),Object.assign({},o,{type:'module'}));
}return new O(u,o)};
globalThis.Worker.prototype=O.prototype;
})();`;
  const head = document.querySelector('head');
  if (head?.firstChild) {
    head.insertBefore(workerPatch, head.firstChild);
  }

  return document.toString();
}

async function getTemplate(isMobile: boolean): Promise<string> {
  if (isDev) {
    const res = await fetch(VITE_DEV_ORIGIN);
    const html = await res.text();
    return rewriteViteAssetUrls(html);
  }

  const { desktopHtmlTemplate, mobileHtmlTemplate } = await import('./spaHtmlTemplates');

  return isMobile ? mobileHtmlTemplate : desktopHtmlTemplate;
}

function buildAnalyticsConfig(): AnalyticsConfig {
  const config: AnalyticsConfig = {};

  if (analyticsEnv.ENABLE_GOOGLE_ANALYTICS && analyticsEnv.GOOGLE_ANALYTICS_MEASUREMENT_ID) {
    config.google = { measurementId: analyticsEnv.GOOGLE_ANALYTICS_MEASUREMENT_ID };
  }

  if (analyticsEnv.ENABLED_PLAUSIBLE_ANALYTICS && analyticsEnv.PLAUSIBLE_DOMAIN) {
    config.plausible = {
      domain: analyticsEnv.PLAUSIBLE_DOMAIN,
      scriptBaseUrl: analyticsEnv.PLAUSIBLE_SCRIPT_BASE_URL,
    };
  }

  if (analyticsEnv.ENABLED_UMAMI_ANALYTICS && analyticsEnv.UMAMI_WEBSITE_ID) {
    config.umami = {
      scriptUrl: analyticsEnv.UMAMI_SCRIPT_URL,
      websiteId: analyticsEnv.UMAMI_WEBSITE_ID,
    };
  }

  if (analyticsEnv.ENABLED_CLARITY_ANALYTICS && analyticsEnv.CLARITY_PROJECT_ID) {
    config.clarity = { projectId: analyticsEnv.CLARITY_PROJECT_ID };
  }

  if (analyticsEnv.ENABLED_POSTHOG_ANALYTICS && analyticsEnv.POSTHOG_KEY) {
    config.posthog = {
      debug: analyticsEnv.DEBUG_POSTHOG_ANALYTICS,
      host: analyticsEnv.POSTHOG_HOST,
      key: analyticsEnv.POSTHOG_KEY,
    };
  }

  if (analyticsEnv.REACT_SCAN_MONITOR_API_KEY) {
    config.reactScan = { apiKey: analyticsEnv.REACT_SCAN_MONITOR_API_KEY };
  }

  if (analyticsEnv.ENABLE_VERCEL_ANALYTICS) {
    config.vercel = {
      debug: analyticsEnv.DEBUG_VERCEL_ANALYTICS,
      enabled: true,
    };
  }

  if (
    process.env.NEXT_PUBLIC_DESKTOP_PROJECT_ID &&
    process.env.NEXT_PUBLIC_DESKTOP_UMAMI_BASE_URL
  ) {
    config.desktop = {
      baseUrl: process.env.NEXT_PUBLIC_DESKTOP_UMAMI_BASE_URL,
      projectId: process.env.NEXT_PUBLIC_DESKTOP_PROJECT_ID,
    };
  }

  return config;
}

function buildClientEnv(): SPAClientEnv {
  return {
    marketBaseUrl: appEnv.MARKET_BASE_URL,
    pyodideIndexUrl: pythonEnv.NEXT_PUBLIC_PYODIDE_INDEX_URL,
    pyodidePipIndexUrl: pythonEnv.NEXT_PUBLIC_PYODIDE_PIP_INDEX_URL,
    s3FilePath: fileEnv.NEXT_PUBLIC_S3_FILE_PATH,
  };
}

const hasCustomSiteIdentity = (brandConfig: RuntimeBrandConfig) =>
  brandConfig.isCustomBranding || brandConfig.siteTitle !== brandConfig.brandName;

async function applyLoadingScreenBranding(
  html: string,
  brandConfig: RuntimeBrandConfig,
): Promise<string> {
  if (!html.includes('id="loading-brand"')) return html;

  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML(html);
  const loadingBrand = document.querySelector('#loading-brand');

  if (!loadingBrand) return html;

  const useCustomIdentity = hasCustomSiteIdentity(brandConfig);
  const brandTitle = brandConfig.siteTitle || DEFAULT_BRAND_TITLE;

  loadingBrand.innerHTML = useCustomIdentity
    ? `<span data-loading-spinner="true"></span><span data-loading-label="true"></span>`
    : `${DEFAULT_LOADING_ICON_MARKUP}<span data-loading-label="true"></span>`;
  loadingBrand.setAttribute('data-branding-mode', useCustomIdentity ? 'custom' : 'default');

  const label = loadingBrand.querySelector('[data-loading-label="true"]');
  if (label) label.textContent = brandTitle;

  if (document.head?.querySelector('[data-brand-loading-style="true"]')) {
    return document.toString();
  }

  const style = document.createElement('style');
  style.setAttribute('data-brand-loading-style', 'true');
  style.textContent = `
@keyframes loading-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes loading-breathe {
  0%, 100% { opacity: 0.92; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-1px); }
}
#loading-brand[data-branding-mode] {
  gap: 10px;
}
#loading-brand [data-loading-icon='true'] {
  animation: loading-breathe 1.6s ease-in-out infinite;
  flex: none;
  height: 40px;
  width: 40px;
}
#loading-brand[data-branding-mode='custom'] [data-loading-spinner='true'] {
  width: 28px;
  height: 28px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: loading-spin 0.8s linear infinite;
}
#loading-brand [data-loading-label='true'] {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
`;
  document.head?.appendChild(style);

  return document.toString();
}

async function buildSeoMeta(
  locale: string,
  brandConfig: RuntimeBrandConfig,
): Promise<{ metaTags: string; titleTag: string }> {
  const { t } = await translation('metadata', locale);
  const title = brandConfig.siteTitle;
  const description = t('chat.description', { appName: brandConfig.brandName });
  const officialUrl = brandConfig.officialUrl || OFFICIAL_URL;
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedOfficialUrl = escapeHtml(officialUrl);
  const escapedSiteName = escapeHtml(brandConfig.brandName);
  const escapedLocale = escapeHtml(locale);
  const escapedOgUrl = escapeHtml(OG_URL);

  return {
    metaTags: [
      `<meta name="description" content="${escapedDescription}" />`,
      `<meta property="og:title" content="${escapedTitle}" />`,
      `<meta property="og:description" content="${escapedDescription}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${escapedOfficialUrl}" />`,
      `<meta property="og:image" content="${escapedOgUrl}" />`,
      `<meta property="og:site_name" content="${escapedSiteName}" />`,
      `<meta property="og:locale" content="${escapedLocale}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapedTitle}" />`,
      `<meta name="twitter:description" content="${escapedDescription}" />`,
      `<meta name="twitter:image" content="${escapedOgUrl}" />`,
      `<meta name="twitter:site" content="${isCustomORG ? `@${ORG_NAME}` : '@lobehub'}" />`,
    ].join('\n    '),
    titleTag: `<title>${escapedTitle}</title>`,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[]; variants: string }> },
) {
  const { variants } = await params;
  const { locale, isMobile } = RouteVariants.deserializeVariants(variants);

  const serverConfig = await getServerGlobalConfig();
  const brandConfig = await getRuntimeBrandConfig();
  const featureFlags = getServerFeatureFlagsValue();
  const analyticsConfig = buildAnalyticsConfig();
  const clientEnv = buildClientEnv();

  const spaConfig: SPAServerConfig = {
    analyticsConfig,
    clientEnv,
    config: serverConfig,
    featureFlags,
    isMobile,
  };

  let html = await getTemplate(isMobile);
  html = await applyLoadingScreenBranding(html, brandConfig);

  html = html.replace(
    /window\.__SERVER_CONFIG__\s*=\s*undefined;\s*(?:\/\*\s*SERVER_CONFIG\s*\*\/)?/,
    `window.__SERVER_CONFIG__ = ${serializeForHtml(spaConfig)};`,
  );

  const { metaTags, titleTag } = await buildSeoMeta(locale, brandConfig);

  html = /<title>.*?<\/title>/s.test(html)
    ? html.replace(/<title>.*?<\/title>/s, titleTag)
    : html.replace('<head>', `<head>\n    ${titleTag}`);

  html = html.includes('<!--SEO_META-->')
    ? html.replace('<!--SEO_META-->', metaTags)
    : html.replace(titleTag, `${titleTag}\n    ${metaTags}`);

  html = html.includes('<!--ANALYTICS_SCRIPTS-->')
    ? html.replace('<!--ANALYTICS_SCRIPTS-->', '')
    : html;

  return new Response(html, {
    headers: {
      'Cache-Control': 'no-cache',
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
