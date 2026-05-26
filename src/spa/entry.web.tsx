import '../initialize';

import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import BootErrorBoundary from '@/components/BootErrorBoundary';
import { BrandProvider } from '@/features/Brand';
import { createAppRouter } from '@/utils/router';

import { desktopRoutes } from './router/desktopRouter.config';

const debugProxyBase = '/_dangerous_local_dev_proxy';
const basename =
  window.__DEBUG_PROXY__ || window.location.pathname.startsWith(debugProxyBase)
    ? debugProxyBase
    : undefined;

const router = createAppRouter(desktopRoutes, { basename });

createRoot(document.getElementById('root')!).render(
  <BootErrorBoundary>
    <BrandProvider initialBrand={window.__SERVER_CONFIG__?.brand}>
      <RouterProvider router={router} />
    </BrandProvider>
  </BootErrorBoundary>,
);
