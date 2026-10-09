import { matchRoutes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MODULE_ADMIN_ROUTE_IMPORTS } from '@/business/client/moduleAdminRouteImports';
import { ADMIN_CATALOG } from '@/features/Admin/adminCatalog';
import { ADMIN_ROUTE_MANIFEST, MODULE_ADMIN_ROUTE_IDS } from '@/features/Admin/adminRouteManifest';
import {
  MODULE_ADMIN_ROUTE_TREE,
  type ModuleAdminRouteNode,
} from '@/features/Admin/moduleApps/navigation/catalog';

import {
  ADMIN_SETTINGS_ROUTE_REGISTRY,
  ADMIN_SETTINGS_ROUTE_SEGMENTS,
} from './adminSettingsRouteRegistry';
import {
  adminLegacyRedirectRoute,
  buildAdminSettingsRouteObject,
  BusinessDesktopRoutesWithMainLayout,
  BusinessDesktopRoutesWithSettingsLayout,
} from './BusinessDesktopRoutes';

vi.mock('@/utils/router', () => ({
  dynamicElement: () => null,
  dynamicLayout: () => null,
  ErrorBoundary: () => null,
}));

describe('BusinessDesktopRoutes', () => {
  it('registers every visible catalog route exactly once', () => {
    const visibleSegments = ADMIN_CATALOG.map((item) => item.segment);
    const registryVisibleSegments = ADMIN_SETTINGS_ROUTE_REGISTRY.filter(
      (item) => item.status !== 'compatibility',
    ).map((item) => item.segment ?? '');

    expect(registryVisibleSegments).toEqual(visibleSegments);
    expect(new Set(registryVisibleSegments).size).toBe(registryVisibleSegments.length);
  });

  it('does not register removed compatibility segments', () => {
    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).not.toEqual(
      expect.arrayContaining([
        'pricing',
        'topup',
        'change-requests',
        'topics',
        'files',
        'documents',
        'recommendations',
        'expert-plaza',
        'notifications',
        'operations',
        'system-defaults',
      ]),
    );
  });

  it('mounts admin only under the settings route tree', () => {
    expect(BusinessDesktopRoutesWithMainLayout).not.toContainEqual(
      expect.objectContaining({ path: 'admin' }),
    );
    expect(BusinessDesktopRoutesWithSettingsLayout).toHaveLength(1);
    expect(BusinessDesktopRoutesWithSettingsLayout[0]?.path).toBe('admin');
  });

  it('builds the desktop settings admin route from the same registry order', () => {
    const [adminRoute] = BusinessDesktopRoutesWithSettingsLayout;
    const childSegments =
      adminRoute.children?.map((route) => (route.index ? '' : String(route.path))) ?? [];

    expect(adminRoute.path).toBe('admin');
    // Trailing `*` is the admin fallback segment (§3.2 ②) — registered routes
    // still match the registry order exactly.
    expect(childSegments.slice(0, -1)).toEqual(ADMIN_SETTINGS_ROUTE_SEGMENTS);
    expect(childSegments.at(-1)).toBe('*');
    expect(new Set(childSegments).size).toBe(childSegments.length);
    expect(ADMIN_SETTINGS_ROUTE_REGISTRY.map((route) => route.segment ?? '')).toEqual(
      childSegments.slice(0, -1),
    );
  });
  it('builds nested admin route nodes recursively', () => {
    const route = buildAdminSettingsRouteObject({
      children: [
        {
          debugId: 'Index',
          id: 'index',
          importPage: async () => () => null,
          index: true,
          status: 'active',
        },
        {
          children: [
            {
              debugId: 'Detail',
              id: 'detail',
              importPage: async () => () => null,
              index: true,
              status: 'active',
            },
          ],
          debugId: 'App layout',
          id: 'app-layout',
          importPage: async () => () => null,
          segment: 'apps/:appId',
          status: 'active',
        },
      ],
      debugId: 'Modules layout',
      id: 'modules',
      importPage: async () => () => null,
      segment: 'modules',
      status: 'active',
    });

    expect(route.path).toBe('modules');
    expect(route.children?.[0]?.index).toBe(true);
    expect(route.children?.[1]?.path).toBe('apps/:appId');
    expect(route.children?.[1]?.children?.[0]?.index).toBe(true);
  });

  it('registers each Module Center route node with its exact importer', () => {
    const nodes: ModuleAdminRouteNode[] = [];
    const visit = (node: ModuleAdminRouteNode) => {
      nodes.push(node);
      node.children?.forEach(visit);
    };
    visit(MODULE_ADMIN_ROUTE_TREE);

    for (const node of nodes) {
      expect(MODULE_ADMIN_ROUTE_IMPORTS).toHaveProperty(node.id);
      if (node.id === 'module-finance' || node.id === 'module-operations') {
        expect(MODULE_ADMIN_ROUTE_IMPORTS[node.id]).toBeUndefined();
      } else {
        expect(MODULE_ADMIN_ROUTE_IMPORTS[node.id]).toBeTypeOf('function');
      }
    }
  });

  it('does not match the removed Module App URL', () => {
    // `/admin/module-apps` (pre-Module-Center URL): the legacy redirect route
    // owns it outside `/settings`, and inside the admin subtree it is caught
    // by the `*` fallback segment — either way it renders a managed admin
    // page, never a blank workspace.
    const legacy = matchRoutes([adminLegacyRedirectRoute], '/admin/module-apps');
    expect(legacy?.at(-1)?.route.path).toBe('admin/*');
    expect(legacy?.at(-1)?.params['*']).toBe('module-apps');

    const subtree = matchRoutes(BusinessDesktopRoutesWithSettingsLayout, '/admin/module-apps');
    expect(subtree?.at(-1)?.route.path).toBe('*');
    const modulesChain = matchRoutes(BusinessDesktopRoutesWithSettingsLayout, '/admin/modules');
    expect(modulesChain?.map((match) => match.route.path)).toContain('modules');
  });

  it('legacy admin/* redirect route covers the bare prefix and any depth', () => {
    expect(adminLegacyRedirectRoute.path).toBe('admin/*');
    for (const pathname of ['/admin', '/admin/users', '/admin/modules/apps/app-1/runtime']) {
      expect(matchRoutes([adminLegacyRedirectRoute], pathname), pathname).not.toBeNull();
    }
  });

  it('derives its segments from the shared admin route manifest', () => {
    // Registry order = manifest order: every manifest id that is mounted
    // top-level maps to a registry segment; the Module Center subtree is
    // nested under the single `module-center-layout` entry.
    const registryIds = ADMIN_SETTINGS_ROUTE_REGISTRY.map((route) => route.id);
    expect(registryIds).toEqual(
      ADMIN_ROUTE_MANIFEST.filter(
        (entry) =>
          !(MODULE_ADMIN_ROUTE_IDS as string[]).includes(entry.id) ||
          entry.id === 'module-center-layout',
      ).map((entry) => entry.id),
    );
    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain('modules');
    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS.filter((segment) => segment === '')).toHaveLength(1);
  });
});
