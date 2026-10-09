import type { AdminFeatureStatus } from '@/features/Admin/adminCatalog';
import { ADMIN_ROUTE_MANIFEST, type ImportPage } from '@/features/Admin/adminRouteManifest';
import {
  MODULE_ADMIN_ROUTE_TREE,
  type ModuleAdminRouteNode,
} from '@/features/Admin/moduleApps/navigation/catalog';

export type AdminSettingsRouteRegistryItem = {
  children?: readonly AdminSettingsRouteRegistryItem[];
  debugId: string;
  id: string;
  importPage?: ImportPage;
  index?: boolean;
  segment?: string;
  status: AdminFeatureStatus;
};

const manifestById = new Map(ADMIN_ROUTE_MANIFEST.map((entry) => [entry.id, entry]));
const MODULE_SUBTREE_IDS = new Set<string>([
  'module-center-layout',
  ...(MODULE_ADMIN_ROUTE_TREE.children?.flatMap(function collect(node): string[] {
    return [node.id, ...(node.children?.flatMap(collect) ?? [])];
  }) ?? []),
]);

/**
 * Rebuilds the nested Module Center route tree: the shape (index/segment
 * nesting) lives in MODULE_ADMIN_ROUTE_TREE, while each node's lazy import and
 * status is resolved through the shared manifest — the manifest stays the
 * single source of truth without flattening same-named segments (modules'
 * `finance/payments` and `audit` must stay nested under `modules`, not collide
 * with the top-level `payments`/`audit` catalog pages).
 */
const buildModuleRegistryItem = (node: ModuleAdminRouteNode): AdminSettingsRouteRegistryItem => {
  const entry = manifestById.get(node.id);

  return {
    ...(node.children ? { children: node.children.map(buildModuleRegistryItem) } : {}),
    debugId: `Desktop > Admin > modules > ${node.id}`,
    id: node.id,
    ...(entry?.importPage ? { importPage: entry.importPage } : {}),
    ...(node.index ? { index: true } : node.segment ? { segment: node.segment } : {}),
    status: entry?.status ?? 'experimental',
  };
};

/**
 * Mounted admin settings route tree, derived from the shared
 * `ADMIN_ROUTE_MANIFEST` (single source of truth) instead of re-mapping the
 * catalog here. Item order = manifest order = catalog order.
 */
export const ADMIN_SETTINGS_ROUTE_REGISTRY: AdminSettingsRouteRegistryItem[] =
  ADMIN_ROUTE_MANIFEST.flatMap((entry) => {
    // Module Center keeps its nested route tree (see buildModuleRegistryItem);
    // its flattened subtree entries are consumed there, not mounted top-level.
    if (entry.id === 'module-center-layout') {
      return [buildModuleRegistryItem(MODULE_ADMIN_ROUTE_TREE)];
    }
    if (MODULE_SUBTREE_IDS.has(entry.id)) return [];

    return [
      {
        // Carried from the catalog through the manifest so dev loading panels
        // show the semantic `Desktop > Admin > <id>` label, not the URL.
        debugId: entry.debugId ?? entry.path,
        id: entry.id,
        ...(entry.importPage ? { importPage: entry.importPage } : {}),
        ...(entry.segment === '' ? { index: true } : { segment: entry.segment }),
        status: entry.status,
      },
    ];
  });

export const ADMIN_SETTINGS_ROUTE_SEGMENTS = ADMIN_SETTINGS_ROUTE_REGISTRY.map(
  (route) => route.segment ?? '',
);
