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
  HardDrive,
  FileArchive,
  FileText,
  FolderOpen,
  Gauge,
  Wrench,
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
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  ADMIN_NAV_GROUPS,
  type AdminNavIcon,
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

const buildMenuItems = (): MenuProps['items'] =>
  ADMIN_NAV_GROUPS.map((group) => ({
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

  const items = useMemo(() => buildMenuItems(), []);
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
