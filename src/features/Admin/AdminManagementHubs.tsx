'use client';

import { Tabs } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { AdminDocumentsPage, AdminFilesPage, AdminTopicsPage } from './AdminContentPages';
import AdminExpertPlazaPage from './AdminExpertPlazaPage';
import AdminNotificationsPage from './AdminNotificationsPage';
import AdminOperationsPage from './AdminOperationsPage';
import AdminRecommendationsPage from './AdminRecommendationsPage';

const styles = createStaticStyles(({ css, cssVar }) => ({
  tabs: css`
    min-width: 0;

    .ant-tabs-nav {
      position: sticky;
      z-index: 4;
      inset-block-start: 0;

      margin: 0;
      padding-block-start: 12px;
      padding-inline: 24px;

      background: color-mix(in srgb, ${cssVar.colorBgLayout} 94%, transparent);
      backdrop-filter: blur(12px);
    }

    .ant-tabs-content-holder,
    .ant-tabs-tabpane {
      min-width: 0;
    }

    @media (width < 640px) {
      .ant-tabs-nav {
        padding-block-start: 8px;
        padding-inline: 16px;
      }
    }
  `,
}));

export const selectAdminHubTab = <T extends string>(
  tabs: readonly T[],
  fallback: T,
  value: string | null,
): T => (tabs.includes(value as T) ? (value as T) : fallback);

const useAdminHubTab = <T extends string>(tabs: readonly T[], fallback: T) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = selectAdminHubTab(tabs, fallback, searchParams.get('tab'));

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return [activeTab, setActiveTab] as const;
};

const RESOURCE_TABS = ['topics', 'files', 'documents'] as const;
const OPERATION_TABS = ['recommendations', 'expert-plaza', 'notifications', 'operations'] as const;

export const AdminContentResourcesPage = memo(() => {
  const [activeTab, setActiveTab] = useAdminHubTab(RESOURCE_TABS, 'topics');
  const { t } = useTranslation('subscription');

  return (
    <Tabs
      activeKey={activeTab}
      className={styles.tabs}
      items={[
        { children: <AdminTopicsPage />, key: 'topics', label: t('admin.content.hubs.topics') },
        { children: <AdminFilesPage />, key: 'files', label: t('admin.content.hubs.files') },
        {
          children: <AdminDocumentsPage />,
          key: 'documents',
          label: t('admin.content.hubs.documents'),
        },
      ]}
      onChange={setActiveTab}
    />
  );
});

AdminContentResourcesPage.displayName = 'AdminContentResourcesPage';

export const AdminContentOperationsPage = memo(() => {
  const [activeTab, setActiveTab] = useAdminHubTab(OPERATION_TABS, 'recommendations');
  const { t } = useTranslation('subscription');

  return (
    <Tabs
      activeKey={activeTab}
      className={styles.tabs}
      items={[
        {
          children: <AdminRecommendationsPage />,
          key: 'recommendations',
          label: t('admin.content.hubs.recommendations'),
        },
        {
          children: <AdminExpertPlazaPage />,
          key: 'expert-plaza',
          label: t('admin.content.hubs.expertPlaza'),
        },
        {
          children: <AdminNotificationsPage />,
          key: 'notifications',
          label: t('admin.content.hubs.notifications'),
        },
        {
          children: <AdminOperationsPage />,
          key: 'operations',
          label: t('admin.content.hubs.operations'),
        },
      ]}
      onChange={setActiveTab}
    />
  );
});

AdminContentOperationsPage.displayName = 'AdminContentOperationsPage';
