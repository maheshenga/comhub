import type { ComponentType } from 'react';

import { MODULE_ADMIN_ROUTE_IMPORTS } from '@/business/client/moduleAdminRouteImports';
import {
  ADMIN_BASE_PATH,
  ADMIN_CATALOG,
  type AdminCatalogId,
  type AdminFeatureStatus,
} from '@/features/Admin/adminCatalog';
import {
  MODULE_ADMIN_ROUTE_TREE,
  type ModuleAdminRouteId,
  type ModuleAdminRouteNode,
} from '@/features/Admin/moduleApps/navigation/catalog';

export type ImportPage = () => Promise<{ default: ComponentType } | ComponentType>;

export type AdminRouteManifestEntry = {
  /** Dev-tools loading label (`Desktop > Admin > …`), carried from the catalog. */
  debugId?: string;
  /** Catalog id (top level) or ModuleAdminRouteId (Module Center subtree). */
  id: AdminCatalogId | ModuleAdminRouteId;
  /** Fully qualified URL path (ADMIN_BASE_PATH + segments). */
  path: string;
  /** URL segment; '' marks the index entry. */
  segment: string;
  status: AdminFeatureStatus;
  importPage?: ImportPage;
};

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
  'payments': () => import('@/routes/(main)/admin/payments'),
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

const flattenModuleRouteIds = (node: ModuleAdminRouteNode): ModuleAdminRouteId[] => [
  node.id,
  ...(node.children?.flatMap(flattenModuleRouteIds) ?? []),
];

/**
 * Admin route manifest — the single source of truth for the desktop admin URL
 * space (§3.1 of the admin console redesign blueprint: "目录单源").
 *
 * Top-level entries derive 1:1 from `ADMIN_CATALOG` (segment + status + lazy
 * import); the `modules` catalog item expands through the Module Center route
 * tree so every routed node keeps exactly one lazy import. Consumers:
 * - `src/business/client/adminSettingsRouteRegistry.ts` rebuilds the mounted
 *   route tree from it (previously it duplicated the catalog→route mapping).
 * - `src/spa/router/desktopRouter.shared.tsx` derives the `/admin/*` legacy
 *   redirect tree and the admin fallback segment from it.
 * - `src/routes/(main)/admin/modules/routes.test.ts` generates its file map
 *   from it instead of hand-listing 19 routes.
 */
export const ADMIN_ROUTE_MANIFEST: AdminRouteManifestEntry[] = ADMIN_CATALOG.flatMap((item) => {
  if (item.id !== 'modules') {
    return [
      {
        debugId: item.debugId,
        id: item.id,
        importPage: ADMIN_PAGE_IMPORTS[item.id],
        path: item.path,
        segment: item.segment,
        status: item.status,
      },
    ];
  }

  const flatten = (node: ModuleAdminRouteNode, parentPath: string): AdminRouteManifestEntry[] => {
    const path = node.index ? parentPath : `${parentPath}/${node.segment ?? ''}`;
    const entry: AdminRouteManifestEntry = {
      debugId: `Desktop > Admin > modules > ${node.id}`,
      id: node.id,
      ...(MODULE_ADMIN_ROUTE_IMPORTS[node.id]
        ? { importPage: MODULE_ADMIN_ROUTE_IMPORTS[node.id] }
        : {}),
      path,
      segment: node.index ? '' : (node.segment ?? ''),
      status: 'experimental',
    };
    return [entry, ...(node.children?.flatMap((child) => flatten(child, path)) ?? [])];
  };

  return flatten(MODULE_ADMIN_ROUTE_TREE, ADMIN_BASE_PATH);
});

/**
 * Routed top-level admin segments (catalog items visible to the router, in
 * catalog order). Layout-only Module Center nodes (`module-finance`,
 * `module-operations`) have no segment and no import, so they do not appear.
 */
export const ADMIN_MANIFEST_SEGMENTS = ADMIN_ROUTE_MANIFEST.filter(
  (entry) => entry.segment !== '',
).map((entry) => entry.segment);

/** Every fully qualified admin route path the manifest mounts (index included). */
export const ADMIN_MANIFEST_PATHS = ADMIN_ROUTE_MANIFEST.map((entry) => entry.path);

export const MODULE_ADMIN_ROUTE_IDS = flattenModuleRouteIds(MODULE_ADMIN_ROUTE_TREE);
