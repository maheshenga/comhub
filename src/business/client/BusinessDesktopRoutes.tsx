import { type RouteObject } from 'react-router-dom';

import { dynamicElement, dynamicLayout, ErrorBoundary } from '@/utils/router';

const settingsAdminRoute: RouteObject = {
  children: [
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/overview'),
        'Desktop > Admin > Overview',
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
        () => import('@/routes/(main)/admin/orders'),
        'Desktop > Admin > Orders',
      ),
      path: 'orders',
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
        () => import('@/routes/(main)/admin/pricing'),
        'Desktop > Admin > Pricing',
      ),
      path: 'pricing',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/recommendations'),
        'Desktop > Admin > Recommendations',
      ),
      path: 'recommendations',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/operations'),
        'Desktop > Admin > Operations',
      ),
      path: 'operations',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/growth'),
        'Desktop > Admin > Growth',
      ),
      path: 'growth',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/model-policy'),
        'Desktop > Admin > Model Policy',
      ),
      path: 'model-policy',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/providers'),
        'Desktop > Admin > Providers',
      ),
      path: 'providers',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/model-billing-matrix'),
        'Desktop > Admin > Model Billing Matrix',
      ),
      path: 'model-billing-matrix',
    },
    {
      element: dynamicElement(() => import('@/routes/(main)/admin/ppt'), 'Desktop > Admin > PPT'),
      path: 'ppt',
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
        () => import('@/routes/(main)/admin/notifications'),
        'Desktop > Admin > Notifications',
      ),
      path: 'notifications',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/expert-plaza'),
        'Desktop > Admin > Expert Plaza',
      ),
      path: 'expert-plaza',
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
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/system-defaults'),
        'Desktop > Admin > System Defaults',
      ),
      path: 'system-defaults',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/topics'),
        'Desktop > Admin > Topics',
      ),
      path: 'topics',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/files'),
        'Desktop > Admin > Files',
      ),
      path: 'files',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/documents'),
        'Desktop > Admin > Documents',
      ),
      path: 'documents',
    },
    {
      element: dynamicElement(
        () => import('@/routes/(main)/admin/desktop-update'),
        'Desktop > Admin > Desktop Update',
      ),
      path: 'desktop-update',
    },
  ],
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
