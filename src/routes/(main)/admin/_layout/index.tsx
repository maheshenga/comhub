'use client';

import { Flexbox } from '@lobehub/ui';
import { Navigate, Outlet } from 'react-router-dom';

import { AdminSidebar } from '@/features/Admin';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

const AdminLayout = () => {
  const user = useUserStore(userProfileSelectors.userProfile);
  const role = (user as any)?.role as string | undefined;

  if (!user) return null;
  if (role !== 'admin') return <Navigate replace to="/" />;

  return (
    <Flexbox flex={1} horizontal style={{ height: '100%' }}>
      <AdminSidebar />
      <Flexbox flex={1} style={{ overflow: 'auto' }}>
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
};

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;
