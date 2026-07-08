'use client';

import { Flexbox } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { AdminSidebar } from '@/features/Admin';
import AdminAuditPage from '@/routes/(main)/admin/audit';
import AdminCreditsPage from '@/routes/(main)/admin/credits';
import AdminDesktopUpdatePage from '@/routes/(main)/admin/desktop-update';
import AdminDocumentsPage from '@/routes/(main)/admin/documents';
import AdminExpertPlazaPage from '@/routes/(main)/admin/expert-plaza';
import AdminFileStoragePage from '@/routes/(main)/admin/file-storage';
import AdminFilesPage from '@/routes/(main)/admin/files';
import AdminGrowthPage from '@/routes/(main)/admin/growth';
import AdminMaintenancePage from '@/routes/(main)/admin/maintenance';
import AdminModelBillingMatrixPage from '@/routes/(main)/admin/model-billing-matrix';
import AdminModelPolicyPage from '@/routes/(main)/admin/model-policy';
import AdminModuleAppsPage from '@/routes/(main)/admin/module-apps';
import AdminNotificationsPage from '@/routes/(main)/admin/notifications';
import AdminOperationsPage from '@/routes/(main)/admin/operations';
import AdminOrdersPage from '@/routes/(main)/admin/orders';
import AdminOverviewPage from '@/routes/(main)/admin/overview';
import AdminPlansPage from '@/routes/(main)/admin/plans';
import AdminPptPage from '@/routes/(main)/admin/ppt';
import AdminPricingPage from '@/routes/(main)/admin/pricing';
import AdminProvidersPage from '@/routes/(main)/admin/providers';
import AdminRecommendationsPage from '@/routes/(main)/admin/recommendations';
import AdminRedemptionPage from '@/routes/(main)/admin/redemption';
import AdminSettingsPage from '@/routes/(main)/admin/settings';
import AdminStatsPage from '@/routes/(main)/admin/stats';
import AdminSubscriptionsPage from '@/routes/(main)/admin/subscriptions';
import AdminSystemDefaultsPage from '@/routes/(main)/admin/system-defaults';
import AdminTopicsPage from '@/routes/(main)/admin/topics';
import AdminUsersPage from '@/routes/(main)/admin/users';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

const adminPageMap = {
  'audit': AdminAuditPage,
  'change-requests': AdminSubscriptionsPage,
  'credits': AdminCreditsPage,
  'desktop-update': AdminDesktopUpdatePage,
  'documents': AdminDocumentsPage,
  'expert-plaza': AdminExpertPlazaPage,
  'file-storage': AdminFileStoragePage,
  'files': AdminFilesPage,
  'growth': AdminGrowthPage,
  'maintenance': AdminMaintenancePage,
  'model-billing-matrix': AdminModelBillingMatrixPage,
  'model-policy': AdminModelPolicyPage,
  'module-apps': AdminModuleAppsPage,
  'notifications': AdminNotificationsPage,
  'operations': AdminOperationsPage,
  'orders': AdminOrdersPage,
  'overview': AdminOverviewPage,
  'plans': AdminPlansPage,
  'ppt': AdminPptPage,
  'pricing': AdminPricingPage,
  'providers': AdminProvidersPage,
  'recommendations': AdminRecommendationsPage,
  'redemption': AdminRedemptionPage,
  'settings': AdminSettingsPage,
  'stats': AdminStatsPage,
  'subscriptions': AdminSubscriptionsPage,
  'system-defaults': AdminSystemDefaultsPage,
  'topup': AdminOrdersPage,
  'topics': AdminTopicsPage,
  'users': AdminUsersPage,
};

const getAdminPage = (pathname: string) => {
  const segment = pathname.replace(/\/+$/, '').split('/')[3];

  return adminPageMap[segment as keyof typeof adminPageMap] ?? AdminOverviewPage;
};

const SettingsAdminPage = () => {
  const { t } = useTranslation('subscription');
  const location = useLocation();
  const [user, isUserStateInit] = useUserStore((s) => [
    userProfileSelectors.userProfile(s),
    s.isUserStateInit,
  ]);
  const role = (user as any)?.role as string | undefined;
  const Page = getAdminPage(location.pathname);

  if (!isUserStateInit) return null;
  if (role !== 'admin') return <Navigate replace to="/" />;

  return (
    <>
      <SettingHeader title={t('admin.console', '后台管理')} />
      <Flexbox horizontal flex={1} style={{ minHeight: 0 }}>
        <AdminSidebar />
        <Flexbox flex={1} style={{ minWidth: 0, overflow: 'auto' }}>
          <Page />
        </Flexbox>
      </Flexbox>
    </>
  );
};

SettingsAdminPage.displayName = 'SettingsAdminPage';

export default SettingsAdminPage;
