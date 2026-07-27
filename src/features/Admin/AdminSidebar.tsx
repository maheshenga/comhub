'use client';

import { Flexbox, Icon, Tag } from '@lobehub/ui';
import { Menu, type MenuProps } from 'antd';
import {
  BarChart3,
  Bell,
  ChartNoAxesColumn,
  Coins,
  Compass,
  CreditCard,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  Megaphone,
  MessageSquareText,
  Package,
  Plug,
  Presentation,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tags,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import {
  type AdminNavIcon,
  getAdminNavGroupsForRole,
  getAdminOpenKeys,
  getAdminSelectedKey,
} from './adminNavigation';

const iconMap: Record<AdminNavIcon, typeof Gauge> = {
  'audit': FileText,
  'billing': CreditCard,
  'credits': Coins,
  'desktop': Download,
  'documents': FileText,
  'expert-plaza': Compass,
  'file-storage': HardDrive,
  'files': FileArchive,
  'growth': ShieldCheck,
  'maintenance': Wrench,
  'mobile': Smartphone,
  'models': SlidersHorizontal,
  'notifications': Bell,
  'orders': ReceiptText,
  'overview': Gauge,
  'plans': Package,
  'plugins': Plug,
  'ppt': Presentation,
  'pricing': Tags,
  'providers': Plug,
  'redemption': Ticket,
  'recommendations': Sparkles,
  'settings': Megaphone,
  'stats': BarChart3,
  'subscriptions': ChartNoAxesColumn,
  'system-defaults': FolderOpen,
  'topup': CreditCard,
  'topics': MessageSquareText,
  'users': Users,
};

const buildMenuItems = (
  role: null | string | undefined,
  statusLabel: Record<'deprecated' | 'experimental' | 'planned', string>,
): MenuProps['items'] =>
  getAdminNavGroupsForRole(role).map((group) => ({
    children: group.items.map((item) => ({
      icon: <Icon icon={iconMap[item.icon]} />,
      key: item.path,
      label:
        item.status === 'active' ? (
          item.label
        ) : (
          <Flexbox horizontal align="center" gap={8} justify="space-between">
            <span>{item.label}</span>
            {item.status === 'experimental' || item.status === 'deprecated' ? (
              <Tag color={item.status === 'deprecated' ? 'gold' : 'blue'}>
                {statusLabel[item.status]}
              </Tag>
            ) : null}
          </Flexbox>
        ),
      title: item.description,
    })),
    icon: <Icon icon={iconMap[group.icon]} />,
    key: group.key,
    label: group.label,
    title: group.description,
  }));

const AdminSidebar = memo<{ onNavigate?: () => void }>(({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('subscription');
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);

  const items = useMemo(
    () =>
      buildMenuItems(role, {
        deprecated: t('admin.navigation.status.deprecated'),
        experimental: t('admin.navigation.status.experimental'),
        planned: t('admin.navigation.status.planned'),
      }),
    [role, t],
  );
  const selectedKey = getAdminSelectedKey(location.pathname);

  return (
    <Menu
      defaultOpenKeys={getAdminOpenKeys(location.pathname)}
      items={items}
      mode="inline"
      selectedKeys={[selectedKey]}
      style={{ borderInlineEnd: 'none', height: '100%', width: '100%' }}
      onClick={({ key }: { key: string }) => {
        navigate(key);
        onNavigate?.();
      }}
    />
  );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
