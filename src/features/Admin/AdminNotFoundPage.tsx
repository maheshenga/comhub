'use client';

import { Flexbox } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { ADMIN_BASE_PATH } from '@/features/Admin/adminCatalog';
import { getAdminDefaultPath } from '@/features/Admin/adminNavigation';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell, AdminSection } from './layout';

/**
 * Fallback page for unknown admin segments (`§3.2` ② of the admin console
 * redesign blueprint): a deep link into a never-registered `/settings/admin/*`
 * segment renders this instead of the app-wide blank catch-all — the failure
 * mode behind the v2.2.18 deep-link regression. The back link lands on the
 * viewer's role-specific admin workspace.
 *
 * Renders through the shared AdminPageShell like the rest of the console so the
 * heading level (h1) and page rhythm stay identical across all 27 admin pages.
 */
export const AdminNotFoundPage = () => {
  const { t } = useTranslation('subscription');
  const location = useLocation();
  const user = useUserStore(userProfileSelectors.userProfile);
  const role = (user as { role?: string } | undefined)?.role;

  return (
    <AdminPageShell
      description={t('admin.notFound.description', '管理后台中没有与当前地址匹配的页面')}
      title={t('admin.notFound.title', '页面不存在')}
      width="small"
    >
      <AdminSection>
        <Flexbox gap={8}>
          <code>{location.pathname}</code>
          <Link to={getAdminDefaultPath(role) ?? ADMIN_BASE_PATH}>
            {t('admin.notFound.back', '返回工作台')}
          </Link>
        </Flexbox>
      </AdminSection>
    </AdminPageShell>
  );
};

AdminNotFoundPage.displayName = 'AdminNotFoundPage';

export default AdminNotFoundPage;
