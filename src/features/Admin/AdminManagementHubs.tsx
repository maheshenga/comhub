'use client';

import { Tabs } from 'antd';
import { memo } from 'react';
import { useSearchParams } from 'react-router';

import { AdminDocumentsPage, AdminFilesPage, AdminTopicsPage } from './AdminContentPages';
import AdminExpertPlazaPage from './AdminExpertPlazaPage';
import AdminNotificationsPage from './AdminNotificationsPage';
import AdminOperationsPage from './AdminOperationsPage';
import AdminRecommendationsPage from './AdminRecommendationsPage';

const selectTab = <T extends string>(
  tabs: readonly T[],
  fallback: T,
  value: string | null,
): T => (tabs.includes(value as T) ? (value as T) : fallback);

const useAdminHubTab = <T extends string>(tabs: readonly T[], fallback: T) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = selectTab(tabs, fallback, searchParams.get('tab'));

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

  return (
    <Tabs
      activeKey={activeTab}
      tabBarStyle={{ marginInline: 24, marginTop: 16 }}
      items={[
        { children: <AdminTopicsPage />, key: 'topics', label: '话题' },
        { children: <AdminFilesPage />, key: 'files', label: '文件' },
        { children: <AdminDocumentsPage />, key: 'documents', label: '文档' },
      ]}
      onChange={setActiveTab}
    />
  );
});

AdminContentResourcesPage.displayName = 'AdminContentResourcesPage';

export const AdminContentOperationsPage = memo(() => {
  const [activeTab, setActiveTab] = useAdminHubTab(OPERATION_TABS, 'recommendations');

  return (
    <Tabs
      activeKey={activeTab}
      tabBarStyle={{ marginInline: 24, marginTop: 16 }}
      items={[
        { children: <AdminRecommendationsPage />, key: 'recommendations', label: '推荐' },
        { children: <AdminExpertPlazaPage />, key: 'expert-plaza', label: '专家广场' },
        { children: <AdminNotificationsPage />, key: 'notifications', label: '公告与通知' },
        { children: <AdminOperationsPage />, key: 'operations', label: '运营开关' },
      ]}
      onChange={setActiveTab}
    />
  );
});

AdminContentOperationsPage.displayName = 'AdminContentOperationsPage';
