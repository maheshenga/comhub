'use client';

import { useTranslation } from 'react-i18next';

import AdminSettingsPage from '@/routes/(main)/admin/settings';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

const SettingsAdminPage = () => {
  const { t } = useTranslation('subscription');

  return (
    <>
      <SettingHeader title={t('admin.console', '后台管理')} />
      <AdminSettingsPage />
    </>
  );
};

SettingsAdminPage.displayName = 'SettingsAdminPage';

export default SettingsAdminPage;
