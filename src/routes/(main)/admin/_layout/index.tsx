'use client';

import { isAdminRole } from '@lobechat/types';
import { ActionIcon, Flexbox, Skeleton } from '@lobehub/ui';
import { Drawer } from 'antd';
import { useResponsive } from 'antd-style';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('subscription');
  const { mobile = false } = useResponsive();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [user, isUserStateInit] = useUserStore((s) => [
    userProfileSelectors.userProfile(s),
    s.isUserStateInit,
  ]);
  const role = (user as any)?.role as string | undefined;

  if (!isUserStateInit) {
    return (
      <Flexbox data-testid="admin-layout-loading" gap={16} style={{ padding: 24, width: '100%' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Flexbox>
    );
  }
  if (!isAdminRole(role)) return <Navigate replace to="/" />;
  if (!canAccessAdminPath(role, location.pathname)) {
    return <Navigate replace to={getAdminUnauthorizedFallbackPath(role, location.pathname)} />;
  }

  return (
    <Flexbox
      flex={1}
      horizontal={!mobile}
      style={{ height: '100%', minWidth: 0, overflow: 'hidden' }}
    >
      {mobile ? (
        <>
          <Flexbox
            horizontal
            align="center"
            gap={8}
            style={{
              borderBlockEnd: '1px solid var(--lobe-color-border-secondary)',
              minHeight: 48,
              paddingInline: 12,
            }}
          >
            <ActionIcon
              icon={Menu}
              title={t('admin.navigation.open')}
              onClick={() => setNavigationOpen(true)}
            />
            <strong>{t('admin.navigation.title')}</strong>
          </Flexbox>
          <Drawer
            open={navigationOpen}
            styles={{ body: { padding: 0 } }}
            title={t('admin.navigation.title')}
            width={300}
            onClose={() => setNavigationOpen(false)}
          >
            <AdminSidebar onNavigate={() => setNavigationOpen(false)} />
          </Drawer>
        </>
      ) : (
        <aside
          style={{
            borderInlineEnd: '1px solid var(--lobe-color-border-secondary)',
            flex: '0 0 240px',
            width: 240,
          }}
        >
          <AdminSidebar />
        </aside>
      )}
      <Flexbox flex={1} style={{ minWidth: 0, overflow: 'auto' }}>
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
};

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;
