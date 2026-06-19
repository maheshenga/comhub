import type { ComponentType } from 'react';

export type AdminSettingsRouteRegistryItem = {
  debugId: string;
  importPage: () => Promise<{ default: ComponentType } | ComponentType>;
  segment: string;
};

export const ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS = [
  'topup',
  'pricing',
  'change-requests',
] as const;

export const ADMIN_SETTINGS_ROUTE_REGISTRY = [
  {
    debugId: 'Desktop > Admin > Overview',
    importPage: () => import('@/routes/(main)/admin/overview'),
    segment: '',
  },
  {
    debugId: 'Desktop > Admin > Users',
    importPage: () => import('@/routes/(main)/admin/users'),
    segment: 'users',
  },
  {
    debugId: 'Desktop > Admin > Plans',
    importPage: () => import('@/routes/(main)/admin/plans'),
    segment: 'plans',
  },
  {
    debugId: 'Desktop > Admin > TopUp',
    importPage: () => import('@/routes/(main)/admin/topup'),
    segment: 'topup',
  },
  {
    debugId: 'Desktop > Admin > Orders',
    importPage: () => import('@/routes/(main)/admin/orders'),
    segment: 'orders',
  },
  {
    debugId: 'Desktop > Admin > Credits',
    importPage: () => import('@/routes/(main)/admin/credits'),
    segment: 'credits',
  },
  {
    debugId: 'Desktop > Admin > Pricing',
    importPage: () => import('@/routes/(main)/admin/pricing'),
    segment: 'pricing',
  },
  {
    debugId: 'Desktop > Admin > Recommendations',
    importPage: () => import('@/routes/(main)/admin/recommendations'),
    segment: 'recommendations',
  },
  {
    debugId: 'Desktop > Admin > Operations',
    importPage: () => import('@/routes/(main)/admin/operations'),
    segment: 'operations',
  },
  {
    debugId: 'Desktop > Admin > Growth',
    importPage: () => import('@/routes/(main)/admin/growth'),
    segment: 'growth',
  },
  {
    debugId: 'Desktop > Admin > Model Policy',
    importPage: () => import('@/routes/(main)/admin/model-policy'),
    segment: 'model-policy',
  },
  {
    debugId: 'Desktop > Admin > Providers',
    importPage: () => import('@/routes/(main)/admin/providers'),
    segment: 'providers',
  },
  {
    debugId: 'Desktop > Admin > Model Billing Matrix',
    importPage: () => import('@/routes/(main)/admin/model-billing-matrix'),
    segment: 'model-billing-matrix',
  },
  {
    debugId: 'Desktop > Admin > PPT',
    importPage: () => import('@/routes/(main)/admin/ppt'),
    segment: 'ppt',
  },
  {
    debugId: 'Desktop > Admin > Subscriptions',
    importPage: () => import('@/routes/(main)/admin/subscriptions'),
    segment: 'subscriptions',
  },
  {
    debugId: 'Desktop > Admin > Change Requests',
    importPage: () => import('@/routes/(main)/admin/change-requests'),
    segment: 'change-requests',
  },
  {
    debugId: 'Desktop > Admin > Redemption',
    importPage: () => import('@/routes/(main)/admin/redemption'),
    segment: 'redemption',
  },
  {
    debugId: 'Desktop > Admin > Settings',
    importPage: () => import('@/routes/(main)/admin/settings'),
    segment: 'settings',
  },
  {
    debugId: 'Desktop > Admin > Notifications',
    importPage: () => import('@/routes/(main)/admin/notifications'),
    segment: 'notifications',
  },
  {
    debugId: 'Desktop > Admin > Expert Plaza',
    importPage: () => import('@/routes/(main)/admin/expert-plaza'),
    segment: 'expert-plaza',
  },
  {
    debugId: 'Desktop > Admin > Stats',
    importPage: () => import('@/routes/(main)/admin/stats'),
    segment: 'stats',
  },
  {
    debugId: 'Desktop > Admin > Audit',
    importPage: () => import('@/routes/(main)/admin/audit'),
    segment: 'audit',
  },
  {
    debugId: 'Desktop > Admin > System Defaults',
    importPage: () => import('@/routes/(main)/admin/system-defaults'),
    segment: 'system-defaults',
  },
  {
    debugId: 'Desktop > Admin > Topics',
    importPage: () => import('@/routes/(main)/admin/topics'),
    segment: 'topics',
  },
  {
    debugId: 'Desktop > Admin > Files',
    importPage: () => import('@/routes/(main)/admin/files'),
    segment: 'files',
  },
  {
    debugId: 'Desktop > Admin > Documents',
    importPage: () => import('@/routes/(main)/admin/documents'),
    segment: 'documents',
  },
  {
    debugId: 'Desktop > Admin > Desktop Update',
    importPage: () => import('@/routes/(main)/admin/desktop-update'),
    segment: 'desktop-update',
  },
] satisfies AdminSettingsRouteRegistryItem[];

export const ADMIN_SETTINGS_ROUTE_SEGMENTS = ADMIN_SETTINGS_ROUTE_REGISTRY.map(
  (route) => route.segment,
);
