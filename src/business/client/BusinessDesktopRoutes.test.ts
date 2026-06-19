import { describe, expect, it } from 'vitest';

import { ADMIN_BASE_PATH, ADMIN_NAV_GROUPS } from '@/features/Admin/adminNavigation';

import { BusinessDesktopRoutesWithSettingsLayout } from './BusinessDesktopRoutes';
import {
  ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS,
  ADMIN_SETTINGS_ROUTE_REGISTRY,
  ADMIN_SETTINGS_ROUTE_SEGMENTS,
} from './adminSettingsRouteRegistry';

const routeSegmentFromAdminPath = (path: string) => {
  if (path === ADMIN_BASE_PATH) return '';

  return path.slice(`${ADMIN_BASE_PATH}/`.length);
};

describe('BusinessDesktopRoutes', () => {
  it('keeps every admin navigation page reachable from the shared settings route registry', () => {
    const adminPaths = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path));
    const visibleSegments = adminPaths.map(routeSegmentFromAdminPath);

    expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toEqual(expect.arrayContaining(visibleSegments));
  });

  it('keeps legacy merged admin aliases reachable without adding sidebar-only entries', () => {
    expect(ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS).toEqual([
      'topup',
      'pricing',
      'change-requests',
    ]);

    for (const segment of ADMIN_LEGACY_SETTINGS_ROUTE_SEGMENTS) {
      expect(ADMIN_SETTINGS_ROUTE_SEGMENTS).toContain(segment);
    }
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
