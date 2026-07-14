'use client';

import { Icon } from '@lobehub/ui';
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
  Sparkles,
  Tags,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react';
import { memo, useMemo } from 'react';
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

const buildMenuItems = (role?: string | null): MenuProps['items'] =>
  getAdminNavGroupsForRole(role).map((group) => ({
    children: group.items.map((item) => ({
      icon: <Icon icon={iconMap[item.icon]} />,
      key: item.path,
      label: item.label,
      title: item.description,
    })),
    icon: <Icon icon={iconMap[group.icon]} />,
    key: group.key,
    label: group.label,
    title: group.description,
  }));

const AdminSidebar = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);

  const items = useMemo(() => buildMenuItems(role), [role]);
  const selectedKey = getAdminSelectedKey(location.pathname);

  return (
    <Menu
      defaultOpenKeys={getAdminOpenKeys(location.pathname)}
      items={items}
      mode="inline"
      selectedKeys={[selectedKey]}
      style={{ borderInlineEnd: 'none', height: '100%', width: 240 }}
      onClick={({ key }: { key: string }) => navigate(key)}
    />
  );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
