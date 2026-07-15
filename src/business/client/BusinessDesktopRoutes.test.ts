import { describe, expect, it, vi } from 'vitest';

import { ADMIN_CATALOG, ADMIN_LEGACY_ROUTES } from '@/features/Admin/adminCatalog';

import {
  BusinessDesktopRoutesWithMainLayout,
  BusinessDesktopRoutesWithSettingsLayout,
} from './BusinessDesktopRoutes';
import {
  ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS,
  ADMIN_SETTINGS_ROUTE_REGISTRY,
  ADMIN_SETTINGS_ROUTE_SEGMENTS,
} from './adminSettingsRouteRegistry';

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
    ).map((item) => item.segment);

    expect(registryVisibleSegments).toEqual(visibleSegments);
    expect(new Set(registryVisibleSegments).size).toBe(registryVisibleSegments.length);
  });

  it('keeps legacy segments reachable but outside the visible catalog', () => {
    expect(ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS).toEqual(
      ADMIN_LEGACY_ROUTES.map((item) => item.segment),
    );

    for (const segment of ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS) {
      expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain(segment);
      expect(ADMIN_CATALOG.map((item) => item.segment)).not.toContain(segment);
    }
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
    expect(childSegments).toEqual(ADMIN_SETTINGS_ROUTE_SEGMENTS);
    expect(new Set(childSegments).size).toBe(childSegments.length);
    expect(ADMIN_SETTINGS_ROUTE_REGISTRY.map((route) => route.segment)).toEqual(childSegments);
  });
});
