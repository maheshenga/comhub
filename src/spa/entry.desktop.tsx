import '../initialize';

import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import BootErrorBoundary from '@/components/BootErrorBoundary';
import { BrandProvider } from '@/features/Brand';
import NextThemeProvider from '@/layout/GlobalProvider/NextThemeProvider';
import { bootTiming } from '@/libs/bootTiming';
import { createAppRouter } from '@/utils/router';

import { startAppInitialization } from './initialize/bootstrap';
import { desktopRoutes } from './router/desktopRouter.config';

bootTiming.mark('bundle-eval');
startAppInitialization();

const router = createAppRouter(desktopRoutes);

createRoot(document.getElementById('root')!).render(
  <BootErrorBoundary>
    <NextThemeProvider>
      <BrandProvider initialBrand={window.__SERVER_CONFIG__?.brand}>
        <RouterProvider router={router} />
      </BrandProvider>
    </NextThemeProvider>
  </BootErrorBoundary>,
);
