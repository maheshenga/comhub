'use client';

import { Flexbox, Icon, type MenuProps } from '@lobehub/ui';
import { Tag } from '@lobehub/ui/base-ui';
import {
  Activity,
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

import { type AdminNavItem, type AdminNavSection } from '../adminNavigation';

// ux-redesign-spec §2.4: lucide is the single icon source, every entry is
// unique (audit/documents, billing/topup, plugins/providers duplicates
// resolved), rendered at 16px with the default 1.5 stroke.
export const iconMap: Record<string, typeof Gauge> = {
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
  // 子栏目图标（方案 §2.2）。B6 先把容量备好：AdminNavIcon 与 iconMap 必须
  // 双向零差集，adminCatalog.test.ts 会断言；B8 起一级组沿用这些图标，子栏
  // 目按产品决策 C7 为纯文字条目、不带独立图标。
  'module-catalog': Blocks,
  'module-finance': ReceiptText,
  'module-operations': Activity,
  'module-audit': ScrollText,
  'content-growth': ShieldCheck,
};

/**
 * Group header render (ux-redesign-spec §2.2): icon + uppercase-style group
 * label, count demoted to a tertiary mini-badge on the right. The `label`
 * i18n payload keeps the `label (N)` string shape — the count suffix is
 * stripped here at the render layer so the translation keys stay untouched.
 * B8: 计数口径改为**页面直达条目**数（子栏目内的条目 + 无子栏目形态的裸条
 * 目），不再把子栏目本身计入——徽标语义一直是「这个组里有多少个可去的页面」。
 */
export const renderGroupLabel = (
  group: AdminNavSection,
  translate: (key: string, fallback: string) => string,
): ReactNode => {
  const translated = translate(`admin.navigation.groups.${group.key}.label`, group.label);
  const countSuffix = ` (${group.items.length})`;
  const leafCount = group.subSections
    ? group.subSections.reduce((sum, subSection) => sum + subSection.items.length, 0)
    : group.items.length;

  return (
    <Flexbox horizontal align="center" gap={8} justify="space-between">
      <span>
        {translated.endsWith(countSuffix) ? translated.slice(0, -countSuffix.length) : translated}
      </span>
      <span aria-hidden className="admin-nav-group-count">
        {leafCount}
      </span>
    </Flexbox>
  );
};

const renderStatusBadge = (
  item: AdminNavItem,
  statusLabel: Record<'deprecated' | 'experimental' | 'planned', string>,
) =>
  item.status === 'experimental' || item.status === 'deprecated' ? (
    <Tag color={item.status === 'deprecated' ? 'gold' : 'blue'}>{statusLabel[item.status]}</Tag>
  ) : null;

/**
 * Two-level sidebar menu (B8, IA 方案 §2.2 + 产品决策 C7):
 * 一级栏目（沿用组图标）→ 子栏目（纯文字、无独立图标）→ 页面条目。
 * 无子栏目的组保持原单层形态；子栏目状态徽标默认继承组内条目的 catalog
 * status（module-operations 为 experimental 的来源见 adminNavigation.ts 的
 * SUB_SECTION_STATUS_OVERRIDES 注释）。
 */
export const buildMenuItems = (
  groups: AdminNavSection[],
  statusLabel: Record<'deprecated' | 'experimental' | 'planned', string>,
  translate: (key: string, fallback: string) => string,
): MenuProps['items'] =>
  groups.map((group) => ({
    children: group.subSections.length
      ? group.subSections.map((subSection) => ({
          children: subSection.items.map((item) => ({
            key: item.path,
            label: translate(`admin.navigation.items.${item.id}.label`, item.label),
            title: translate(`admin.navigation.items.${item.id}.description`, item.description),
          })),
          key: `sub:${group.key}:${subSection.key}`,
          label: (
            <Flexbox horizontal align="center" gap={8} justify="space-between">
              <span>
                {translate(
                  `admin.navigation.subSections.${subSection.key}.label`,
                  subSection.label,
                )}
              </span>
              {subSection.status === 'active'
                ? null
                : renderStatusBadge(
                    { ...subSection.items[0], status: subSection.status },
                    statusLabel,
                  )}
            </Flexbox>
          ),
          title: translate(
            `admin.navigation.subSections.${subSection.key}.label`,
            subSection.label,
          ),
        }))
      : group.items.map((item) => ({
          icon: <Icon icon={iconMap[item.icon]} size={16} />,
          key: item.path,
          label:
            item.status === 'active' ? (
              translate(`admin.navigation.items.${item.id}.label`, item.label)
            ) : (
              <Flexbox horizontal align="center" gap={8} justify="space-between">
                <span>{translate(`admin.navigation.items.${item.id}.label`, item.label)}</span>
                {renderStatusBadge(item, statusLabel)}
              </Flexbox>
            ),
          title: translate(`admin.navigation.items.${item.id}.description`, item.description),
        })),
    icon: <Icon icon={iconMap[group.icon]} size={16} />,
    key: group.key,
    label: renderGroupLabel(group, translate),
    title: translate(`admin.navigation.groups.${group.key}.description`, group.description),
  }));
