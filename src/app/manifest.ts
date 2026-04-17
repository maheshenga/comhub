import { type MetadataRoute } from 'next';
import { DEFAULT_BRAND_ASSET_VERSION, DEFAULT_BRAND_TITLE } from '@/const/branding';

const manifest = async (): Promise<MetadataRoute.Manifest> => {
  // Skip heavy module compilation in development
  if (process.env.NODE_ENV === 'development') {
    return {
      background_color: '#000000',
      description: `${DEFAULT_BRAND_TITLE} Development`,
      display: 'standalone',
      icons: [
        {
          sizes: '192x192',
          src: '/icons/icon-192x192.png',
          type: 'image/png',
          purpose: 'any',
        },
      ],
      name: DEFAULT_BRAND_TITLE,
      short_name: DEFAULT_BRAND_TITLE,
      start_url: '/',
      theme_color: '#000000',
    };
  }

  const [{ kebabCase }, { manifestModule }, { getRuntimeBrandConfig }] = await Promise.all([
    import('es-toolkit/compat'),
    import('@/server/manifest'),
    import('@/server/globalConfig/getBrandConfig'),
  ]);

  const brandConfig = await getRuntimeBrandConfig();

  // @ts-expect-error - manifestModule.generate returns extended manifest with custom properties
  return manifestModule.generate({
    brandLogoUrl: brandConfig.brandLogoUrl,
    description: `${brandConfig.brandName} is a work-and-lifestyle space to find, build, and collaborate with agent teams that grow with you.`,
    icons: [
      {
        purpose: 'any',
        sizes: '192x192',
        url: '/icons/icon-192x192.png',
        version: DEFAULT_BRAND_ASSET_VERSION,
      },
      {
        purpose: 'maskable',
        sizes: '192x192',
        url: '/icons/icon-192x192.maskable.png',
        version: DEFAULT_BRAND_ASSET_VERSION,
      },
      {
        purpose: 'any',
        sizes: '512x512',
        url: '/icons/icon-512x512.png',
        version: DEFAULT_BRAND_ASSET_VERSION,
      },
      {
        purpose: 'maskable',
        sizes: '512x512',
        url: '/icons/icon-512x512.maskable.png',
        version: DEFAULT_BRAND_ASSET_VERSION,
      },
    ],
    id: kebabCase(brandConfig.brandName),
    name: brandConfig.brandName,
    screenshots: brandConfig.isCustomBranding
      ? []
      : [
          {
            form_factor: 'narrow',
            url: '/screenshots/shot-1.mobile.png',
          },
          {
            form_factor: 'narrow',
            url: '/screenshots/shot-2.mobile.png',
          },
          {
            form_factor: 'narrow',
            url: '/screenshots/shot-3.mobile.png',
          },
          {
            form_factor: 'narrow',
            url: '/screenshots/shot-4.mobile.png',
          },
          {
            form_factor: 'narrow',
            url: '/screenshots/shot-5.mobile.png',
          },
          {
            form_factor: 'wide',
            url: '/screenshots/shot-1.desktop.png',
          },
          {
            form_factor: 'wide',
            url: '/screenshots/shot-2.desktop.png',
          },
          {
            form_factor: 'wide',
            url: '/screenshots/shot-3.desktop.png',
          },
          {
            form_factor: 'wide',
            url: '/screenshots/shot-4.desktop.png',
          },
          {
            form_factor: 'wide',
            url: '/screenshots/shot-5.desktop.png',
          },
        ],
  });
};

export default manifest;
