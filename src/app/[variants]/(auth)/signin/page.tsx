import { BRANDING_NAME } from '@lobechat/business-const';
import { type Metadata } from 'next';
import { Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { getServerBrand } from '@/server/services/brand';
import { translation } from '@/server/translation';
import { type DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

import SignInPageClient from './SignInPageClient';

export const generateMetadata = async (props: DynamicLayoutProps): Promise<Metadata> => {
  const locale = await RouteVariants.getLocale(props);
  const { t } = await translation('auth', locale);
  const brand = await getServerBrand();
  const appName = brand.name?.trim() || BRANDING_NAME;
  const description = brand.authTitle?.trim() || t('signin.title');
  const faviconUrl = brand.faviconUrl?.trim();

  return {
    appleWebApp: {
      title: appName,
    },
    description,
    icons: faviconUrl || undefined,
    openGraph: {
      description,
      locale,
      siteName: appName,
      title: appName,
      type: 'website',
    },
    title: appName,
    twitter: {
      card: 'summary_large_image',
      description,
      title: appName,
    },
  };
};

const SignInPage = () => (
  <Suspense fallback={<Loading debugId={'Signin'} />}>
    <SignInPageClient />
  </Suspense>
);

export default SignInPage;
