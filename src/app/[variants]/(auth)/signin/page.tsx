import { BRANDING_NAME } from '@lobechat/business-const';
import { type Metadata } from 'next';

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

  return {
    description: t('signin.subtitle', { appName }),
    title: t('betterAuth.signin.emailStep.title'),
  };
};

export default SignInPageClient;
