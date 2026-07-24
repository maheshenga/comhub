import '../initialize';

import { RouterProvider } from 'react-router/dom';

import BootErrorBoundary from '@/components/BootErrorBoundary';
import { BrandProvider } from '@/features/Brand';
import NextThemeProvider from '@/layout/GlobalProvider/NextThemeProvider';
import { bootTiming } from '@/libs/bootTiming';
import { createAppRouter } from '@/utils/router';

import { startAppInitialization } from './initialize/bootstrap';
import { desktopRoutes } from './router/desktopRouter.config';
import { createSPARoot } from './runtime';

bootTiming.mark('bundle-eval');
startAppInitialization();

const debugProxyBase = '/_dangerous_local_dev_proxy';
const basename =
  window.__DEBUG_PROXY__ || window.location.pathname.startsWith(debugProxyBase)
    ? debugProxyBase
    : undefined;

const router = createAppRouter(desktopRoutes, { basename });

createSPARoot(document.getElementById('root')!).render(
  <BootErrorBoundary>
    <NextThemeProvider>
      <BrandProvider initialBrand={window.__SERVER_CONFIG__?.brand}>
        <RouterProvider router={router} />
      </BrandProvider>
    </NextThemeProvider>
  </BootErrorBoundary>,
);
