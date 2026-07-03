import { type RouteObject } from 'react-router';

import { dynamicElement, dynamicLayout, ErrorBoundary } from '@/utils/router';

import { ADMIN_SETTINGS_ROUTE_REGISTRY } from './adminSettingsRouteRegistry';

const settingsAdminRoute: RouteObject = {
  children: ADMIN_SETTINGS_ROUTE_REGISTRY.map(({ debugId, importPage, segment }) => ({
    element: dynamicElement(importPage, debugId),
    ...(segment ? { path: segment } : { index: true }),
  })),
  element: dynamicLayout(() => import('@/routes/(main)/admin/_layout'), 'Desktop > Admin > Layout'),
  errorElement: <ErrorBoundary />,
  path: 'admin',
};

export const BusinessDesktopRoutesWithMainLayout: RouteObject[] = [
  {
    element: dynamicElement(() => import('@/routes/(main)/topup'), 'Desktop > TopUp'),
    path: 'topup',
  },
];
export const BusinessDesktopRoutesWithSettingsLayout: RouteObject[] = [settingsAdminRoute];
export const BusinessDesktopRoutesWithoutMainLayout: RouteObject[] = [];
