import { type RouteObject } from 'react-router-dom';

import { dynamicElement, dynamicLayout, ErrorBoundary } from '@/utils/router';

const adminRoute: RouteObject = {
  children: [
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/users'),
        'Desktop > Admin > Users',
      ),
      index: true,
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/users'),
        'Desktop > Admin > Users',
      ),
      path: 'users',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/plans'),
        'Desktop > Admin > Plans',
      ),
      path: 'plans',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/topup'),
        'Desktop > Admin > TopUp',
      ),
      path: 'topup',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/credits'),
        'Desktop > Admin > Credits',
      ),
      path: 'credits',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/subscriptions'),
        'Desktop > Admin > Subscriptions',
      ),
      path: 'subscriptions',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/change-requests'),
        'Desktop > Admin > Change Requests',
      ),
      path: 'change-requests',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/redemption'),
        'Desktop > Admin > Redemption',
      ),
      path: 'redemption',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/settings'),
        'Desktop > Admin > Settings',
      ),
      path: 'settings',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/stats'),
        'Desktop > Admin > Stats',
      ),
      path: 'stats',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/audit'),
        'Desktop > Admin > Audit',
      ),
      path: 'audit',
    },
  ],
  element: dynamicLayout(
    () => import('@/routes/(main)/admin/_layout'),
    'Desktop > Admin > Layout',
  ),
  errorElement: <ErrorBoundary />,
  path: 'admin',
};

export const BusinessDesktopRoutesWithMainLayout: RouteObject[] = [adminRoute];
export const BusinessDesktopRoutesWithSettingsLayout: RouteObject[] = [];
export const BusinessDesktopRoutesWithoutMainLayout: RouteObject[] = [];
