'use client';

import { Flexbox, Icon, Tag } from '@lobehub/ui';
import { type MenuProps } from 'antd';
import {
  BarChart3,
  Bell,
  Blocks,
  ChartNoAxesColumn,
  CircleDollarSign,
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
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tags,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { type AdminNavGroup, type AdminNavIcon } from '../adminNavigation';

// ux-redesign-spec §2.4: lucide is the single icon source, every entry is
// unique (audit/documents, billing/topup, plugins/providers duplicates
// resolved), rendered at 16px with the default 1.5 stroke.
export const iconMap: Record<AdminNavIcon, typeof Gauge> = {
  'audit': ScrollText,
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
  'plugins': Blocks,
  'ppt': Presentation,
  'pricing': Tags,
  'providers': Plug,
  'redemption': Ticket,
  'recommendations': Sparkles,
  'settings': Megaphone,
  'stats': BarChart3,
  'subscriptions': ChartNoAxesColumn,
  'system-defaults': FolderOpen,
  'topup': CircleDollarSign,
  'topics': MessageSquareText,
  'users': Users,
};

/**
 * Group header render (ux-redesign-spec §2.2): icon + uppercase-style group
 * label, count demoted to a tertiary mini-badge on the right. The `label`
 * i18n payload keeps the `label (N)` string shape — the count suffix is
 * stripped here at the render layer so the translation keys stay untouched.
 */
export const renderGroupLabel = (
  group: AdminNavGroup,
  translate: (key: string, fallback: string) => string,
): ReactNode => {
  const translated = translate(
    `admin.navigation.groups.${group.key}.label`,
    group.label,
  );
  const countSuffix = ` (${group.items.length})`;

  return (
    <Flexbox horizontal align="center" gap={8} justify="space-between">
      <span>
        {translated.endsWith(countSuffix) ? translated.slice(0, -countSuffix.length) : translated}
      </span>
      <span aria-hidden className="admin-nav-group-count">
        {group.items.length}
      </span>
    </Flexbox>
  );
};

export const buildMenuItems = (
  groups: AdminNavGroup[],
  statusLabel: Record<'deprecated' | 'experimental' | 'planned', string>,
  translate: (key: string, fallback: string) => string,
): MenuProps['items'] =>
  groups.map((group) => ({
    children: group.items.map((item) => ({
      icon: <Icon icon={iconMap[item.icon]} size={16} />,
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
    icon: <Icon icon={iconMap[group.icon]} size={16} />,
    key: group.key,
    label: renderGroupLabel(group, translate),
    title: translate(`admin.navigation.groups.${group.key}.description`, group.description),
  }));
