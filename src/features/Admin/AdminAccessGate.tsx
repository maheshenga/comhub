'use client';

import { type AdminRole, isAdminRole } from '@lobechat/types';
import { Navigate, useLocation } from 'react-router';

import {
  canAccessAdminPath,
  getAdminUnauthorizedFallbackPath,
} from '@/features/Admin/adminNavigation';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

export interface AdminAccessGateProps {
  children: React.ReactNode;
  /** Fallback for initialized users whose role is not an admin role. */
  deniedTo?: string;
  /** When false, only `isAdminRole` is enforced (path-level check is opt-in). */
  enforcePathAccess?: boolean;
}

/**
 * Generation-time access gate for the admin route subtree (`§3.2` ③ of the
 * admin console redesign blueprint).
 *
 * Mounted ONCE on the admin layout route element in the SPA router, so every
 * admin page — present and future — is gated without each page remembering to
 * check. Rendering-level checks in the admin layout remain harmless
 * duplicates.
 *
 * Backend `requireAdminCapability` is the security boundary; this gate is UX
 * only (avoids flashing admin content or a blank page before the redirect).
 */
export const AdminAccessGate = ({
  children,
  deniedTo = '/',
  enforcePathAccess = true,
}: AdminAccessGateProps) => {
  const { pathname } = useLocation();
  const user = useUserStore(userProfileSelectors.userProfile);
  const role = (user as { role?: AdminRole | string } | undefined)?.role;

  if (!isAdminRole(role)) return <Navigate replace to={deniedTo} />;

  if (enforcePathAccess && !canAccessAdminPath(role, pathname)) {
    return <Navigate replace to={getAdminUnauthorizedFallbackPath(role, pathname)} />;
  }

  return <>{children}</>;
};
