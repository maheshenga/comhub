'use client';

import { Flexbox, Icon, Tag } from '@lobehub/ui';
import { type MenuProps } from 'antd';
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

import { type AdminNavGroup, type AdminNavIcon } from '../adminNavigation';

export const iconMap: Record<AdminNavIcon, typeof Gauge> = {
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

export const buildMenuItems = (
  groups: AdminNavGroup[],
  statusLabel: Record<'deprecated' | 'experimental' | 'planned', string>,
  translate: (key: string, fallback: string) => string,
): MenuProps['items'] =>
  groups.map((group) => ({
    children: group.items.map((item) => ({
      icon: <Icon icon={iconMap[item.icon]} />,
      key: item.path,
      label:
        item.status === 'active' ? (
          translate(`admin.navigation.items.${item.id}.label`, item.label)
        ) : (
          <Flexbox horizontal align="center" gap={8} justify="space-between">
            <span>{translate(`admin.navigation.items.${item.id}.label`, item.label)}</span>
            {item.status === 'experimental' || item.status === 'deprecated' ? (
              <Tag color={item.status === 'deprecated' ? 'gold' : 'blue'}>
                {statusLabel[item.status]}
              </Tag>
            ) : null}
          </Flexbox>
        ),
      title: translate(`admin.navigation.items.${item.id}.description`, item.description),
    })),
    icon: <Icon icon={iconMap[group.icon]} />,
    key: group.key,
    label: `${translate(`admin.navigation.groups.${group.key}.label`, group.label)} (${group.items.length})`,
    title: translate(`admin.navigation.groups.${group.key}.description`, group.description),
  }));
