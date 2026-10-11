import { type AdminRole, hasAdminCapability, isAdminRole, isFullAdminRole } from '@lobechat/types';

import {
  ADMIN_BASE_PATH,
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  type AdminCatalogItem,
  type AdminFeatureStatus,
  type AdminNavGroupKey,
  type AdminNavIcon,
  getAdminCatalogAccessCapabilities,
} from './adminCatalog';
import {
  findModuleAdminSectionByPath,
  MODULE_ADMIN_ROOT_PATH,
} from './moduleApps/navigation/catalog';
import {
  canAccessAdminPolicy,
  getModuleCenterSectionsForRole,
  MODULE_ADMIN_ROUTE_POLICIES,
} from './moduleApps/navigation/policy';

export { ADMIN_BASE_PATH, type AdminNavGroupKey, type AdminNavIcon } from './adminCatalog';

export type AdminNavItem = {
  description: string;
  icon: AdminNavIcon;
  id: string;
  label: string;
  path: string;
  status: AdminFeatureStatus;
};

export type AdminNavGroup = {
  description: string;
  icon: AdminNavIcon;
  items: AdminNavItem[];
  key: AdminNavGroupKey;
  label: string;
};

const isVisibleInNavigation = (item: AdminCatalogItem) =>
  item.status !== 'planned' && item.status !== 'compatibility';

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = ADMIN_CATALOG_GROUPS.map((group) => ({
  ...group,
  items: ADMIN_CATALOG.filter(
    (item) => item.group === group.key && isVisibleInNavigation(item),
  ).map((item) => ({
    description: item.description,
    icon: item.icon,
    id: item.id,
    label: item.label,
    path: item.path,
    status: item.status,
  })),
}));

const ADMIN_PATH_CAPABILITIES = new Map(
  ADMIN_CATALOG.map((item) => [item.path, getAdminCatalogAccessCapabilities(item)] as const),
);

const ADMIN_ROLE_DEFAULT_PATHS: Record<AdminRole, string> = {
  admin: ADMIN_BASE_PATH,
  content_admin: `${ADMIN_BASE_PATH}/content-resources`,
  finance_admin: `${ADMIN_BASE_PATH}/subscriptions`,
  model_ops: `${ADMIN_BASE_PATH}/providers`,
  module_admin: `${ADMIN_BASE_PATH}/modules`,
  support_admin: `${ADMIN_BASE_PATH}/users`,
  system_admin: `${ADMIN_BASE_PATH}/settings`,
};

export const normalizeAdminPath = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/, '') || ADMIN_BASE_PATH;

  if (cleanPath === '/admin') return ADMIN_BASE_PATH;
  if (cleanPath.startsWith('/admin/'))
    return `${ADMIN_BASE_PATH}${cleanPath.slice('/admin'.length)}`;

  return cleanPath;
};

export const canAccessAdminPath = (role: string | null | undefined, pathname: string) => {
  if (!isAdminRole(role)) return false;
  if (isFullAdminRole(role)) return true;

  const cleanPath = normalizeAdminPath(pathname);
  const moduleSection = findModuleAdminSectionByPath(cleanPath);
  if (moduleSection) {
    return canAccessAdminPolicy(role, MODULE_ADMIN_ROUTE_POLICIES[moduleSection.id].access);
  }

  const selectedPath = getAdminSelectedKey(pathname);
  const capabilities = ADMIN_PATH_CAPABILITIES.get(selectedPath);

  return !!capabilities && capabilities.some((capability) => hasAdminCapability(role, capability));
};

export const getAdminDefaultPath = (role: string | null | undefined) => {
  if (!isAdminRole(role)) return '/';

  return ADMIN_ROLE_DEFAULT_PATHS[role];
};

export const getAdminUnauthorizedFallbackPath = (
  role: string | null | undefined,
  pathname: string,
) => {
  const cleanPath = normalizeAdminPath(pathname);
  if (cleanPath === MODULE_ADMIN_ROOT_PATH || cleanPath.startsWith(`${MODULE_ADMIN_ROOT_PATH}/`)) {
    return getModuleCenterSectionsForRole(role)[0]?.path ?? getAdminDefaultPath(role);
  }

  return getAdminDefaultPath(role);
};

export const getAdminNavGroupsForRole = (role: string | null | undefined): AdminNavGroup[] =>
  ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessAdminPath(role, item.path)),
  })).filter((group) => group.items.length > 0);

const allAdminItems = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupKey: group.key })),
).sort((a, b) => b.path.length - a.path.length);

/**
 * 选中态解析用的全集：**包含**不进侧栏的条目。
 *
 * compatibility 状态（如 payments）被 isVisibleInNavigation 过滤掉，因此不在
 * ADMIN_NAV_GROUPS 里；它可以被深链直达，此时若只查侧栏集合就会一路回落到
 * ADMIN_BASE_PATH，整个侧栏没有任何高亮，管理员看不出自己在支付中心。这里改用
 * catalog 全集解析，groupKey 仍取自 catalog 的 group 字段，两侧一致。
 */
const allSelectableItems = ADMIN_CATALOG.map((item) => ({
  path: item.path,
  groupKey: item.group,
})).sort((a, b) => b.path.length - a.path.length);

/**
 * 把任意深度的后台路径解析到最深的已登记条目。
 *
 * ADMIN_CATALOG 登记的是**顶层**路径（如 `/settings/admin/modules`），而模块
 * 中心的真实路由深达 `/settings/admin/modules/finance/payments`。原先只按
 * 顶层条目做前缀匹配，于是：
 * - `/settings/admin/modules/finance/payments` → 回落成 `/settings/admin/modules`
 *   （选中态丢失在父级：页面内换了分区，侧栏看不出自己在哪）
 * - `/settings/admin/payments` → 回落成 `/settings/admin`（compatibility 条目
 *   不在侧栏集合里，直达时整个侧栏无高亮）
 *
 * B6 起 catalog 条目带 subSection，B8 会在侧栏渲染子栏目；这里先让选中态能
 * 落到叶子路径，为接线做准备。模块分区路径交给既有的
 * findModuleAdminSectionByPath（它已按 specificity 排序并做 end 匹配），不重复
 * 实现一套前缀匹配。
 */
export const getAdminSelectedKey = (pathname: string) => {
  const cleanPath = normalizeAdminPath(pathname);

  const topLevel = allSelectableItems.find(
    (item) => cleanPath === item.path || cleanPath.startsWith(`${item.path}/`),
  )?.path;

  // 只有落在模块中心之下、且确实匹配到一个已登记分区时才下沉到叶子。
  if (topLevel && cleanPath.startsWith(`${MODULE_ADMIN_ROOT_PATH}/`)) {
    const section = findModuleAdminSectionByPath(cleanPath);
    // 跳过带 :param 的分区（MODULE_APP_DETAIL_SECTIONS）——那是应用详情页的
    // 页签，方案 §2.4 已确认它们**留在详情页内、不入主侧栏**，选中态必须继续
    // 折叠在顶层 modules 上。返回 pattern 字符串还会让 :appId 原样泄漏给高亮。
    if (section?.path && !section.path.includes(':')) return section.path;
  }

  return topLevel ?? ADMIN_BASE_PATH;
};

export const getAdminOpenKeys = (pathname: string): AdminNavGroupKey[] => {
  const selectedKey = getAdminSelectedKey(pathname);
  // 用全集而非侧栏集合：selectedKey 现在可能是 compatibility 条目（payments）
  // 或模块分区叶子路径，二者都不在 ADMIN_NAV_GROUPS 里，改用侧栏集合查会
  // 再次回落到 workbench——直达支付中心时模块栏目不会展开。
  const group = allSelectableItems.find((item) => item.path === selectedKey)?.groupKey;

  if (group) return [group];

  // 落到模块分区叶子（modules/finance/payments 等）时，顶层 modules 条目才是
  // 侧栏上真正被展开的那一组。
  const cleanPath = normalizeAdminPath(pathname);
  if (cleanPath === MODULE_ADMIN_ROOT_PATH || cleanPath.startsWith(`${MODULE_ADMIN_ROOT_PATH}/`)) {
    const modulesGroup = allSelectableItems.find(
      (item) => item.path === MODULE_ADMIN_ROOT_PATH,
    )?.groupKey;

    if (modulesGroup) return [modulesGroup];
  }

  return ['workbench'];
};

export const getAdminNavigationContext = (role: string | null | undefined, pathname: string) => {
  const groups = getAdminNavGroupsForRole(role);
  const selectedKey = getAdminSelectedKey(pathname);

  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.path === selectedKey);
    if (item) return { group, item };
  }

  return null;
};

export const filterAdminNavGroups = (groups: AdminNavGroup[], query: string): AdminNavGroup[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    const groupMatches = `${group.label} ${group.description}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
    const items = groupMatches
      ? group.items
      : group.items.filter((item) =>
          `${item.label} ${item.description}`.toLocaleLowerCase().includes(normalizedQuery),
        );

    return items.length > 0 ? [{ ...group, items }] : [];
  });
};
