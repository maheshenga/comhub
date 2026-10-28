'use client';

import { Flexbox, Icon, Tag } from '@lobehub/ui';
import type { MenuProps } from 'antd';
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
import { sidebarIconSize } from './sidebarStyles';

// ux-redesign-spec §2.4: lucide is the single icon source, every entry is
// unique (audit/documents, billing/topup, plugins/providers duplicates
// resolved), rendered at the shared `sidebarIconSize` with the default 1.5
// stroke.
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
 * Two-level sidebar menu (产品指令 10-12：1级栏目 - 2级条目，**不要多级**):
 * 一级栏目（组图标）→ 页面条目，仅此两级。
 *
 * 子栏目（AdminNavSection.subSections）降级为**分组元数据**：不再占据侧栏层
 * 级，只保留三个职责——① 组内条目按子栏目归类排序（同组页面相邻）；
 * ② 子栏目状态（SUB_SECTION_STATUS_OVERRIDES，如 module-operations 的
 * experimental）以条目徽标呈现——继承到该子栏目第一个条目上渲染（侧栏没有
 * 子栏目节点可挂徽标，条目级是唯一落点）；③ 面包屑中段与搜索匹配仍走
 * subSections（adminNavigation.ts 侧，不在本文件）。
 * 无子栏目的组保持既有单层形态，行为不变。
 */
export const buildMenuItems = (
  groups: AdminNavSection[],
  statusLabel: Record<'deprecated' | 'experimental' | 'planned', string>,
  translate: (key: string, fallback: string) => string,
): MenuProps['items'] =>
  groups.map((group) => {
    const renderItem = (item: AdminNavItem, inheritedStatus?: AdminNavItem['status']) => {
      // inheritedStatus 来自条目所属子栏目（SUB_SECTION_STATUS_OVERRIDES，
      // 如 module-operations=experimental）；它与条目自身 status 的语义都是
      // 「experimental/deprecated 才显示徽标」，两者都不带徽标才走纯文本。
      const effective = inheritedStatus ?? item.status;
      const label = translate(`admin.navigation.items.${item.id}.label`, item.label);
      const badge = renderStatusBadge({ ...item, status: effective }, statusLabel);

      return {
        key: item.path,
        label: badge ? (
          <Flexbox horizontal align="center" gap={8} justify="space-between">
            <span>{label}</span>
            {badge}
          </Flexbox>
        ) : (
          label
        ),
        title: translate(`admin.navigation.items.${item.id}.description`, item.description),
      };
    };

    const children = group.subSections.length
      ? group.subSections.flatMap((subSection) =>
          subSection.items.map((item, index) =>
            renderItem(item, index === 0 ? subSection.status : undefined),
          ),
        )
      : group.items.map((item) => renderItem(item));

    return {
      children,
      icon: <Icon icon={iconMap[group.icon]} size={sidebarIconSize} />,
      key: group.key,
      label: renderGroupLabel(group, translate),
      title: translate(`admin.navigation.groups.${group.key}.description`, group.description),
    };
  });
