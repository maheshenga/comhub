import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MODULE_ADMIN_ROUTE_IMPORTS } from '@/business/client/moduleAdminRouteImports';
import { ADMIN_ROUTE_MANIFEST, MODULE_ADMIN_ROUTE_IDS } from '@/features/Admin/adminRouteManifest';
import {
  MODULE_ADMIN_ROUTE_TREE,
  type ModuleAdminRouteId,
  type ModuleAdminRouteNode,
} from '@/features/Admin/moduleApps/navigation/catalog';

/**
 * File-map derivation (admin console redesign §3.1): instead of hand-listing
 * the 19 routed modules, the expected route file for each Module Center import
 * is read back from the import map itself — the manifest's lazy imports point
 * at `@/routes/(main)/admin/...` specifiers, so existence and thin-route shape
 * assertions stay derived from the single route source of truth.
 */
const routeFiles = Object.entries(MODULE_ADMIN_ROUTE_IMPORTS).flatMap(([routeId, importFn]) => {
  // Layout-only grouping nodes have no import — nothing to assert on disk.
  if (typeof importFn !== 'function') return [];

  const source = Function.prototype.toString.call(importFn);
  const match = source.match(/import\('(@\/routes\/.+?)'\)/);
  if (!match) return [];

  const specifier = match[1];
  const relative = specifier.replace(/^@\//, '').replaceAll("'", '');
  const candidates = [`${relative}.tsx`, `${relative}/index.tsx`];

  return [[routeId as ModuleAdminRouteId, candidates] as const];
});

const flattenRouteIds = (node: ModuleAdminRouteNode): ModuleAdminRouteId[] => [
  node.id,
  ...(node.children?.flatMap(flattenRouteIds) ?? []),
];

describe('Module Center thin route modules', () => {
  it('defines one import-map entry for every route ID', () => {
    const routeIds = flattenRouteIds(MODULE_ADMIN_ROUTE_TREE);

    expect(Object.keys(MODULE_ADMIN_ROUTE_IMPORTS).sort()).toEqual([...routeIds].sort());
    expect(MODULE_ADMIN_ROUTE_IMPORTS['module-finance']).toBeUndefined();
    expect(MODULE_ADMIN_ROUTE_IMPORTS['module-operations']).toBeUndefined();
  });

  it('manifest carries every Module Center route id exactly once', () => {
    const manifestModuleIds = ADMIN_ROUTE_MANIFEST.filter((entry) =>
      (MODULE_ADMIN_ROUTE_IDS as string[]).includes(entry.id),
    ).map((entry) => entry.id);

    // Layout-only grouping nodes stay in the manifest without a segment; every
    // routed node must appear exactly once.
    expect(manifestModuleIds).toEqual([...MODULE_ADMIN_ROUTE_IDS]);
    expect(
      manifestModuleIds.filter(
        (id) => !['module-finance', 'module-operations'].includes(id as string),
      ),
    ).toEqual(
      MODULE_ADMIN_ROUTE_IDS.filter((id) => !['module-finance', 'module-operations'].includes(id)),
    );
  });

  it('keeps every routed page as a thin feature export', () => {
    for (const [routeId, candidates] of routeFiles) {
      const absolutePath = candidates
        .map((candidate) => path.resolve(process.cwd(), candidate))
        .find((candidate) => existsSync(candidate));
      expect(
        absolutePath,
        `${routeId} route file is missing (${candidates.join(' | ')})`,
      ).toBeDefined();

      const source = readFileSync(absolutePath!, 'utf8');
      expect(source, `${routeId} must import a moduleApps feature`).toMatch(
        /from '@\/features\/Admin\/moduleApps\//,
      );
      expect(source, `${routeId} must remain a default-export-only route root`).toMatch(
        /^import [^\n]+ from '@\/features\/Admin\/moduleApps\/[^']+';\r?\n\r?\nexport default [^;]+;\r?\n$/,
      );
      expect(source).not.toMatch(/@\/libs\/swr|@\/services|@\/store|from 'antd'/);
    }
  });
});
