import { type RouteObject } from 'react-router';
import { Navigate, useParams } from 'react-router';

import RouteSegmentSkeleton from '@/components/Skeleton/RouteSegment';
import { AdminAccessGate } from '@/features/Admin/AdminAccessGate';
import { normalizeAdminPath } from '@/features/Admin/adminNavigation';
import { routeMeta } from '@/spa/router/routeMeta';
import { dynamicElement, dynamicLayout, ErrorBoundary } from '@/utils/router';

import {
  ADMIN_SETTINGS_ROUTE_REGISTRY,
  type AdminSettingsRouteRegistryItem,
} from './adminSettingsRouteRegistry';

export const buildAdminSettingsRouteObject = (
  node: AdminSettingsRouteRegistryItem,
): RouteObject => {
  const hasChildren = Boolean(node.children?.length);
  const element = node.importPage
    ? hasChildren
      ? dynamicLayout(node.importPage, node.debugId)
      : dynamicElement(node.importPage, node.debugId)
    : undefined;

  if (node.index) {
    return {
      ...(element ? { element } : {}),
      index: true,
    };
  }

  return {
    ...(node.children ? { children: node.children.map(buildAdminSettingsRouteObject) } : {}),
    ...(element ? { element } : {}),
    path: node.segment,
  };
};

const settingsAdminRoute: RouteObject = {
  children: [
    ...ADMIN_SETTINGS_ROUTE_REGISTRY.map(buildAdminSettingsRouteObject),
    // Fallback segment (§3.2 ②): unknown admin sub-paths render the admin
    // not-found page instead of falling through to the app-wide blank
    // catch-all — the v2.2.18 deep-link failure mode.
    {
      element: dynamicElement(
        () => import('@/features/Admin/AdminNotFoundPage'),
        'Desktop > Admin > Not Found',
      ),
      path: '*',
    },
  ],
  // Generation-time access gate (§3.2 ③): mounted once on the admin layout
  // route so every admin page is gated without per-page checks. The gate reads
  // role + location from the stores/hooks itself. Backend
  // requireAdminCapability stays the security boundary — this is UX only.
  element: (
    <AdminAccessGate>
      {dynamicLayout(() => import('@/routes/(main)/admin/_layout'), 'Desktop > Admin > Layout')}
    </AdminAccessGate>
  ),
  errorElement: <ErrorBoundary />,
  path: 'admin',
};

/**
 * Redirect component for legacy `/admin/*` deep links (admin console redesign
 * §3.2 ①). Mounted as the element of the single legacy route `admin/*`; the
 * splat keeps every legacy depth working with one route instead of a
 * per-segment redirect list derived from the manifest (which would go stale
 * when a segment is renamed — `normalizeAdminPath` already owns the legacy
 * mapping). Unknown remainder segments then land on the admin fallback page
 * via the `*` segment below, not on a blank workspace.
 *
 * Static `<Navigate>` keeps the redirect generation-time — no admin chunk
 * loads for an out-of-date link.
 */
const AdminLegacyRedirect = () => {
  const params = useParams();

  return <Navigate replace to={normalizeAdminPath(`/admin/${params['*'] ?? ''}`)} />;
};

/**
 * Legacy `/admin/*` deep-link redirect route (§3.2 ①), mounted by the shared
 * desktop router ahead of the settings route.
 */
export const adminLegacyRedirectRoute: RouteObject = {
  element: <AdminLegacyRedirect />,
  path: 'admin/*',
};
export const BusinessDesktopRoutesWithMainLayout: RouteObject[] = [
  {
    element: dynamicElement(() => import('@/routes/(main)/topup'), 'Desktop > TopUp'),
    handle: { meta: routeMeta({ Skeleton: RouteSegmentSkeleton }) },
    path: 'topup',
  },
];
export const BusinessDesktopRoutesWithSettingsLayout: RouteObject[] = [settingsAdminRoute];
export const BusinessDesktopRoutesWithoutMainLayout: RouteObject[] = [];
export const BusinessResourceRoutes: RouteObject[] = [];
