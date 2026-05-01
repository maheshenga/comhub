'use client';

import { Icon } from '@lobehub/ui';
import { Menu } from 'antd';
import { Coins, CreditCard, FileBarChart, FileText, Gauge, GitPullRequest, Package, Settings, Ticket, Users } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

const AdminSidebar = memo(() => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();
  const location = useLocation();

  const items = useMemo(
    () => [
      { icon: <Icon icon={Users} />, key: '/admin/users', label: t('admin.sidebar.users') },
      { icon: <Icon icon={Package} />, key: '/admin/plans', label: t('admin.sidebar.plans') },
      { icon: <Icon icon={CreditCard} />, key: '/admin/topup', label: t('admin.sidebar.topup') },
      { icon: <Icon icon={Coins} />, key: '/admin/credits', label: t('admin.sidebar.credits', 'Credits') },
      { icon: <Icon icon={FileBarChart} />, key: '/admin/subscriptions', label: t('admin.sidebar.subscriptions') },
      { icon: <Icon icon={GitPullRequest} />, key: '/admin/change-requests', label: t('admin.sidebar.changeRequests', 'Change Requests') },
      { icon: <Icon icon={Ticket} />, key: '/admin/redemption', label: t('admin.sidebar.redemption', 'Redemption Codes') },
      { icon: <Icon icon={Settings} />, key: '/admin/settings', label: t('admin.sidebar.settings') },
      { icon: <Icon icon={Gauge} />, key: '/admin/stats', label: t('admin.sidebar.stats') },
      { icon: <Icon icon={FileText} />, key: '/admin/audit', label: t('admin.sidebar.audit', 'Audit Log') },
    ],
    [t],
  );

  return (
    <Menu
      items={items}
      mode="inline"
      onClick={({ key }) => navigate(key)}
      selectedKeys={[location.pathname]}
      style={{ borderInlineEnd: 'none', height: '100%', width: 220 }}
    />
  );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
