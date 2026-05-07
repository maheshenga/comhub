'use client';

import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import AdminSettingsPage from '@/routes/(main)/admin/settings';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

const SettingsAdminPage = () => {
  const { t } = useTranslation('subscription');
  const [user, isUserStateInit] = useUserStore((s) => [
    userProfileSelectors.userProfile(s),
    s.isUserStateInit,
  ]);
  const role = (user as any)?.role as string | undefined;

  if (!isUserStateInit) return null;
  if (role !== 'admin') return <Navigate replace to="/" />;

  return (
    <>
      <SettingHeader title={t('admin.console', '后台管理')} />
      <AdminSettingsPage />
    </>
  );
};

SettingsAdminPage.displayName = 'SettingsAdminPage';

export default SettingsAdminPage;
