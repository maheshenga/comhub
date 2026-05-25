import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { type PropsWithChildren } from 'react';

import BusinessAuthProvider from '@/business/client/BusinessAuthProvider';
import ClientOnly from '@/components/client/ClientOnly';
import { BrandProvider } from '@/features/Brand';
import { getServerBrand } from '@/server/services/brand';
import { type DynamicLayoutProps } from '@/types/next';

import AuthContainer from './_layout';
import AuthGlobalProvider from './_layout/AuthGlobalProvider';

const AuthLayout = async ({ children, params }: PropsWithChildren<DynamicLayoutProps>) => {
  const { variants } = await params;
  const brand = await getServerBrand();

  return (
    <AuthGlobalProvider variants={variants}>
      {/* ComHub: auth pages are outside the SPA shell, so inject the admin brand here. */}
      <BrandProvider initialBrand={brand} updateDocumentTitle={false}>
        <ClientOnly>
          <NuqsAdapter>
            <BusinessAuthProvider>
              <AuthContainer>{children}</AuthContainer>
            </BusinessAuthProvider>
          </NuqsAdapter>
        </ClientOnly>
      </BrandProvider>
    </AuthGlobalProvider>
  );
};

export default AuthLayout;
