'use client';

import { isAdminRole } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Navigate, Outlet, useLocation } from 'react-router';

import { AdminSidebar } from '@/features/Admin';
import {
  canAccessAdminPath,
  getAdminUnauthorizedFallbackPath,
} from '@/features/Admin/adminNavigation';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

const AdminLayout = () => {
  const location = useLocation();
  const [user, isUserStateInit] = useUserStore((s) => [
    userProfileSelectors.userProfile(s),
    s.isUserStateInit,
  ]);
  const role = (user as any)?.role as string | undefined;

  if (!isUserStateInit) return null;
  if (!isAdminRole(role)) return <Navigate replace to="/" />;
  if (!canAccessAdminPath(role, location.pathname)) {
    return <Navigate replace to={getAdminUnauthorizedFallbackPath(role, location.pathname)} />;
  }

  return (
    <Flexbox horizontal flex={1} style={{ height: '100%' }}>
      <AdminSidebar />
      <Flexbox flex={1} style={{ overflow: 'auto' }}>
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
};

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;
