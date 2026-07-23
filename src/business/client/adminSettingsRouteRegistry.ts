import type { ComponentType } from 'react';

import { MODULE_ADMIN_ROUTE_IMPORTS } from '@/business/client/moduleAdminRouteImports';
import {
  ADMIN_CATALOG,
  ADMIN_LEGACY_ROUTES,
  type AdminCatalogId,
  type AdminFeatureStatus,
} from '@/features/Admin/adminCatalog';
import {
  MODULE_ADMIN_ROUTE_TREE,
  type ModuleAdminRouteNode,
} from '@/features/Admin/moduleApps/navigation/catalog';

type ImportPage = () => Promise<{ default: ComponentType } | ComponentType>;
type AdminLegacyRouteSegment = (typeof ADMIN_LEGACY_ROUTES)[number]['segment'];

const ADMIN_PAGE_IMPORTS: Record<Exclude<AdminCatalogId, 'modules'>, ImportPage> = {
  'ai-runtime-defaults': () => import('@/routes/(main)/admin/ai-runtime-defaults'),
  'audit': () => import('@/routes/(main)/admin/audit'),
  'credits': () => import('@/routes/(main)/admin/credits'),
  'content-operations': () => import('@/routes/(main)/admin/content-operations'),
  'content-resources': () => import('@/routes/(main)/admin/content-resources'),
  'desktop-update': () => import('@/routes/(main)/admin/desktop-update'),
  'file-storage': () => import('@/routes/(main)/admin/file-storage'),
  'growth': () => import('@/routes/(main)/admin/growth'),
  'integrations': () => import('@/routes/(main)/admin/integrations'),
  'maintenance': () => import('@/routes/(main)/admin/maintenance'),
  'mobile': () => import('@/routes/(main)/admin/mobile'),
  'model-billing-matrix': () => import('@/routes/(main)/admin/model-billing-matrix'),
  'model-policy': () => import('@/routes/(main)/admin/model-policy'),
  'orders': () => import('@/routes/(main)/admin/orders'),
  'overview': () => import('@/routes/(main)/admin/overview'),
  'plans': () => import('@/routes/(main)/admin/plans'),
  'ppt': () => import('@/routes/(main)/admin/ppt'),
  'providers': () => import('@/routes/(main)/admin/providers'),
  'redemption': () => import('@/routes/(main)/admin/redemption'),
  'settings': () => import('@/routes/(main)/admin/settings'),
  'stats': () => import('@/routes/(main)/admin/stats'),
  'subscriptions': () => import('@/routes/(main)/admin/subscriptions'),
  'user-defaults': () => import('@/routes/(main)/admin/user-defaults'),
  'users': () => import('@/routes/(main)/admin/users'),
};

const buildModuleRouteRegistryItem = (
  node: ModuleAdminRouteNode,
): AdminSettingsRouteRegistryItem => ({
  ...(node.children ? { children: node.children.map(buildModuleRouteRegistryItem) } : {}),
  debugId: `Desktop > Admin > modules > ${node.id}`,
  id: node.id,
  ...(MODULE_ADMIN_ROUTE_IMPORTS[node.id]
    ? { importPage: MODULE_ADMIN_ROUTE_IMPORTS[node.id] }
    : {}),
  ...(node.index ? { index: true } : { segment: node.segment }),
  status: 'experimental',
});

const ADMIN_LEGACY_PAGE_IMPORTS: Record<AdminLegacyRouteSegment, ImportPage> = {
  'change-requests': () => import('@/routes/(main)/admin/change-requests'),
  'documents': () => import('@/routes/(main)/admin/documents'),
  'expert-plaza': () => import('@/routes/(main)/admin/expert-plaza'),
  'files': () => import('@/routes/(main)/admin/files'),
  'notifications': () => import('@/routes/(main)/admin/notifications'),
  'operations': () => import('@/routes/(main)/admin/operations'),
  'pricing': () => import('@/routes/(main)/admin/pricing'),
  'recommendations': () => import('@/routes/(main)/admin/recommendations'),
  'system-defaults': () => import('@/routes/(main)/admin/system-defaults'),
  'topup': () => import('@/routes/(main)/admin/topup'),
  'topics': () => import('@/routes/(main)/admin/topics'),
};

export type AdminSettingsRouteRegistryItem = {
  children?: readonly AdminSettingsRouteRegistryItem[];
  debugId: string;
  id: string;
  importPage?: ImportPage;
  index?: boolean;
  segment?: string;
  status: AdminFeatureStatus;
};

const visibleRoutes: AdminSettingsRouteRegistryItem[] = ADMIN_CATALOG.flatMap((item) =>
  item.id === 'modules'
    ? [buildModuleRouteRegistryItem(MODULE_ADMIN_ROUTE_TREE)]
    : [
        {
          debugId: item.debugId,
          id: item.id,
          importPage: ADMIN_PAGE_IMPORTS[item.id],
          ...(item.id === 'overview' ? { index: true } : { segment: item.segment }),
          status: item.status,
        },
      ],
);

const compatibilityRoutes: AdminSettingsRouteRegistryItem[] = ADMIN_LEGACY_ROUTES.map(
  ({ segment }) => ({
    debugId: `Desktop > Admin > Legacy > ${segment}`,
    id: `legacy-${segment}`,
    importPage: ADMIN_LEGACY_PAGE_IMPORTS[segment],
    segment,
    status: 'compatibility',
  }),
);

export const ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS = ADMIN_LEGACY_ROUTES.map(
  (route) => route.segment,
);

export const ADMIN_SETTINGS_ROUTE_REGISTRY = [...visibleRoutes, ...compatibilityRoutes];
export const ADMIN_SETTINGS_ROUTE_SEGMENTS = ADMIN_SETTINGS_ROUTE_REGISTRY.map(
  (route) => route.segment ?? '',
);
