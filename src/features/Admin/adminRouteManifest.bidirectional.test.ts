import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MODULE_ADMIN_ROUTE_IMPORTS } from '@/business/client/moduleAdminRouteImports';
import { ADMIN_CATALOG, type AdminCatalogItem } from '@/features/Admin/adminCatalog';
import {
  ADMIN_ROUTE_MANIFEST,
  type AdminRouteManifestEntry,
} from '@/features/Admin/adminRouteManifest';

/**
 * Catalog ↔ route bidirectional assertions (admin console redesign §3.1):
 * the manifest is the single source of truth, so the catalog and the mounted
 * route files must never drift from it — in either direction.
 *
 * Forward: every catalog entry has a manifest route at its declared path
 * (dead-nav prevention). Reverse: every manifest route file exists on disk and
 * every admin route directory mounts through the catalog (AdminPricingPage-
 * style dead routes — directories whose page can only be reached by typing its
 * URL — fail here the moment the folder appears without a catalog entry).
 */

/** Vite SSR transpiles dynamic imports; read the specifier off either form. */
const importSpecifier = (importPage: NonNullable<AdminRouteManifestEntry['importPage']>) => {
  const source = Function.prototype.toString.call(importPage);
  const match = source.match(/import\(['"](.+?)['"]\)|import__\(["'](.+?)["']\)/);
  if (!match) return undefined;

  return (match[1] ?? match[2]).replace(/^\/src\//, 'src/');
};

const manifestFileTargets = ADMIN_ROUTE_MANIFEST.flatMap((entry) => {
  const specifier = entry.importPage ? importSpecifier(entry.importPage) : undefined;
  return specifier ? [{ id: entry.id, specifier }] : [];
});

/** Paths claimed by more than one manifest entry (layout + index pairs). */
const sharedManifestPaths = new Set(
  ADMIN_ROUTE_MANIFEST.map((entry) => entry.path).filter(
    (p, index, all) => all.indexOf(p) !== index || all.lastIndexOf(p) !== index,
  ),
);

describe('admin route manifest ↔ catalog bidirectional assertions', () => {
  it('forward: every catalog path is mounted by a manifest route', () => {
    const manifestPaths = new Set(ADMIN_ROUTE_MANIFEST.map((entry) => entry.path));

    for (const item of ADMIN_CATALOG as readonly AdminCatalogItem[]) {
      expect(
        manifestPaths.has(item.path),
        `catalog '${item.id}' (${item.path}) has no manifest route`,
      ).toBe(true);
    }
  });

  it('reverse: every manifest route file exists on disk', () => {
    expect(manifestFileTargets.length).toBeGreaterThan(40);

    for (const { id, specifier } of manifestFileTargets) {
      expect(
        existsSync(path.resolve(process.cwd(), specifier)),
        `manifest '${id}' points at missing file: ${specifier}`,
      ).toBe(true);
    }
  });

  it('reverse: every admin route directory mounts through the catalog', () => {
    const catalogPaths = new Set(
      (ADMIN_CATALOG as readonly AdminCatalogItem[]).map((item) => item.path),
    );
    // `overview` is the documented exception: its catalog segment is the empty
    // string, so its directory mounts at ADMIN_BASE_PATH itself.
    const dirToPath: Record<string, string> = { overview: '/settings/admin' };
    const routeDirs = [
      'ai-runtime-defaults',
      'audit',
      'content-operations',
      'content-resources',
      'credits',
      'desktop-update',
      'file-storage',
      'growth',
      'integrations',
      'maintenance',
      'mobile',
      'model-billing-matrix',
      'model-policy',
      'modules',
      'orders',
      'overview',
      'payments',
      'plans',
      'ppt',
      'providers',
      'redemption',
      'settings',
      'stats',
      'subscriptions',
      'user-defaults',
      'users',
    ];

    for (const dir of routeDirs) {
      expect(
        existsSync(path.resolve(process.cwd(), `src/routes/(main)/admin/${dir}`)),
        `fixture drift: route dir '${dir}' missing on disk`,
      ).toBe(true);
      const mountedPath = dirToPath[dir] ?? `/settings/admin/${dir}`;
      expect(
        catalogPaths.has(mountedPath),
        `route dir '${dir}' exists but no catalog entry mounts it (dead route?)`,
      ).toBe(true);
    }
  });

  it('reverse: Module Center import map covers every manifest module node', () => {
    const manifestModuleIds = ADMIN_ROUTE_MANIFEST.filter((entry) =>
      entry.id.startsWith('module-'),
    ).map((entry) => entry.id);

    expect(manifestModuleIds.length).toBeGreaterThan(15);
    for (const id of manifestModuleIds) {
      expect(
        MODULE_ADMIN_ROUTE_IMPORTS,
        `module node '${id}' missing from import map`,
      ).toHaveProperty(id);
    }
  });

  it('manifest path collisions are layout+index pairs only (never two pages)', () => {
    const byPath = new Map<string, string[]>();
    for (const entry of ADMIN_ROUTE_MANIFEST) {
      byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry.id]);
    }

    for (const [p, ids] of byPath) {
      if (ids.length < 2) continue;
      // Layout+index pairs legitimately share one URL (nested layouts render
      // the index child). They import DIFFERENT files (layout vs page); two
      // claimants importing the SAME page file would be a real routing bug.
      const specifiers = new Set(
        ids.map(
          (id) =>
            importSpecifier(ADMIN_ROUTE_MANIFEST.find((entry) => entry.id === id)!.importPage!) ??
            `no-spec:${id}`,
        ),
      );
      expect(
        specifiers.size,
        `path '${p}' claimed by entries importing the same file: ${ids.join(', ')}`,
      ).toBe(ids.length);
    }
    expect(sharedManifestPaths.size).toBeGreaterThan(0);
  });
});
