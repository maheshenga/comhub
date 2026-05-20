import { type ReactNode } from 'react';

import { appEnv } from '@/envs/app';
import { BrandProvider } from '@/features/Brand';
import AnalyticsRSCProvider from '@/layout/AnalyticsRSCProvider';
import AuthProvider from '@/layout/AuthProvider';
import NextThemeProvider from '@/layout/GlobalProvider/NextThemeProvider';
import StyleRegistry from '@/layout/GlobalProvider/StyleRegistry';
import { getServerFeatureFlagsStateFromRuntimeConfig } from '@/server/featureFlags';
import { getServerAuthConfig } from '@/server/globalConfig/getServerAuthConfig';
import { getServerBrand } from '@/server/services/brand';
import { RouteVariants } from '@/utils/server/routeVariants';

import AuthLocale from './AuthLocale';
import { AuthServerConfigProvider } from './AuthServerConfigProvider';
import AuthThemeLite from './AuthThemeLite';

interface AuthGlobalProviderProps {
  children: ReactNode;
  variants: string;
}

const AuthGlobalProvider = async ({ children, variants }: AuthGlobalProviderProps) => {
  const { locale, isMobile } = RouteVariants.deserializeVariants(variants);
  const serverConfig = getServerAuthConfig();
  const [featureFlags, brand] = await Promise.all([
    getServerFeatureFlagsStateFromRuntimeConfig(),
    getServerBrand(),
  ]);

  return (
    <StyleRegistry>
      <AuthLocale defaultLang={locale}>
        <NextThemeProvider>
          <AuthThemeLite globalCDN={appEnv.CDN_USE_GLOBAL}>
            <AuthServerConfigProvider
              featureFlags={featureFlags}
              isMobile={isMobile}
              segmentVariants={variants}
              serverConfig={serverConfig}
            >
              <AnalyticsRSCProvider>
                <BrandProvider initialBrand={brand} updateDocumentTitle={false}>
                  <AuthProvider>{children}</AuthProvider>
                </BrandProvider>
              </AnalyticsRSCProvider>
            </AuthServerConfigProvider>
          </AuthThemeLite>
        </NextThemeProvider>
      </AuthLocale>
    </StyleRegistry>
  );
};

export default AuthGlobalProvider;
