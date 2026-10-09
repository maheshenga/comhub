'use client';

import { Flexbox } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { ADMIN_BASE_PATH } from '@/features/Admin/adminCatalog';
import { getAdminDefaultPath } from '@/features/Admin/adminNavigation';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

/**
 * Fallback page for unknown admin segments (`§3.2` ② of the admin console
 * redesign blueprint): a deep link into a never-registered `/settings/admin/*`
 * segment renders this instead of the app-wide blank catch-all — the failure
 * mode behind the v2.2.18 deep-link regression. The back link lands on the
 * viewer's role-specific admin workspace.
 */
export const AdminNotFoundPage = () => {
  const { t } = useTranslation('subscription');
  const location = useLocation();
  const user = useUserStore(userProfileSelectors.userProfile);
  const role = (user as { role?: string } | undefined)?.role;

  return (
    <Flexbox align="center" gap={12} justify="center" style={{ minHeight: '50vh' }}>
      <h2 style={{ margin: 0 }}>{t('admin.notFound.title', '页面不存在')}</h2>
      <p style={{ color: 'var(--color-text-secondary, #999)', margin: 0 }}>
        {t('admin.notFound.description', '管理后台中没有与当前地址匹配的页面')}
      </p>
      <code style={{ opacity: 0.7 }}>{location.pathname}</code>
      <Link to={getAdminDefaultPath(role) ?? ADMIN_BASE_PATH}>
        {t('admin.notFound.back', '返回工作台')}
      </Link>
    </Flexbox>
  );
};

AdminNotFoundPage.displayName = 'AdminNotFoundPage';

export default AdminNotFoundPage;
