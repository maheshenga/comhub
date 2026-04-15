import { ORG_NAME } from '@lobechat/business-const';
import { OG_URL } from '@lobechat/const';

import { DEFAULT_LANG } from '@/const/locale';
import { OFFICIAL_URL } from '@/const/url';
import { isCustomORG } from '@/const/version';
import { getRuntimeBrandConfig } from '@/server/globalConfig/getBrandConfig';
import { translation } from '@/server/translation';
import { type DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

const isDev = process.env.NODE_ENV === 'development';

export const generateMetadata = async (props: DynamicLayoutProps) => {
  const locale = await RouteVariants.getLocale(props);
  const { t } = await translation('metadata', locale);
  const brandConfig = await getRuntimeBrandConfig();

  return {
    alternates: {
      canonical: brandConfig.officialUrl || OFFICIAL_URL,
    },
    appleWebApp: {
      statusBarStyle: 'black-translucent',
      title: brandConfig.brandName,
    },
    description: t('chat.description', { appName: brandConfig.brandName }),
    icons: brandConfig.isCustomBranding
      ? brandConfig.brandLogoUrl
      : {
          apple: '/apple-touch-icon.png?v=1',
          icon: isDev ? '/favicon-dev.ico' : '/favicon.ico?v=1',
          shortcut: isDev ? '/favicon-32x32-dev.ico' : '/favicon-32x32.ico?v=1',
        },
    manifest: '/manifest.json',
    metadataBase: new URL(brandConfig.officialUrl || OFFICIAL_URL),
    openGraph: {
      description: t('chat.description', { appName: brandConfig.brandName }),
      images: [
        {
          alt: t('chat.title', { appName: brandConfig.brandName }),
          height: 640,
          url: OG_URL,
          width: 1200,
        },
      ],
      locale: DEFAULT_LANG,
      siteName: brandConfig.brandName,
      title: brandConfig.brandName,
      type: 'website',
      url: brandConfig.officialUrl || OFFICIAL_URL,
    },
    title: {
      default: t('chat.title', { appName: brandConfig.brandName }),
      template: `%s · ${brandConfig.brandName}`,
    },
    twitter: {
      card: 'summary_large_image',
      description: t('chat.description', { appName: brandConfig.brandName }),
      images: [OG_URL],
      site: isCustomORG ? `@${ORG_NAME}` : '@lobehub',
      title: t('chat.title', { appName: brandConfig.brandName }),
    },
  };
};
