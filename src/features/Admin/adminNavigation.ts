import {
  type AdminRole,
  hasAdminCapability,
  isAdminRole,
  isFullAdminRole,
} from '@lobechat/types';

import {
  ADMIN_BASE_PATH,
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  ADMIN_LEGACY_ROUTES,
  getAdminCatalogAccessCapabilities,
  type AdminNavGroupKey,
  type AdminNavIcon,
} from './adminCatalog';

export { ADMIN_BASE_PATH, type AdminNavGroupKey, type AdminNavIcon } from './adminCatalog';

export type AdminNavItem = {
  description: string;
  icon: AdminNavIcon;
  label: string;
  path: string;
};

export type AdminNavGroup = {
  description: string;
  icon: AdminNavIcon;
  items: AdminNavItem[];
  key: AdminNavGroupKey;
  label: string;
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = ADMIN_CATALOG_GROUPS.map((group) => ({
  ...group,
  items: ADMIN_CATALOG.filter((item) => item.group === group.key).map((item) => ({
    description: item.description,
    icon: item.icon,
    label: item.label,
    path: item.path,
  })),
}));

const ADMIN_PATH_CAPABILITIES = new Map(
  ADMIN_CATALOG.map((item) => [item.path, getAdminCatalogAccessCapabilities(item)] as const),
);

const ADMIN_NAV_ALIASES = Object.fromEntries(
  ADMIN_LEGACY_ROUTES.map(({ segment, targetSegment }) => [
    `${ADMIN_BASE_PATH}/${segment}`,
    `${ADMIN_BASE_PATH}/${targetSegment}`,
  ]),
);

const ADMIN_ROLE_DEFAULT_PATHS: Record<AdminRole, string> = {
  admin: ADMIN_BASE_PATH,
  content_admin: `${ADMIN_BASE_PATH}/topics`,
  finance_admin: `${ADMIN_BASE_PATH}/subscriptions`,
  model_ops: `${ADMIN_BASE_PATH}/providers`,
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

  const selectedPath = getAdminSelectedKey(pathname);
  const capabilities = ADMIN_PATH_CAPABILITIES.get(selectedPath);

  return !!capabilities && capabilities.some((capability) => hasAdminCapability(role, capability));
};

export const getAdminDefaultPath = (role: string | null | undefined) => {
  if (!isAdminRole(role)) return '/';

  return ADMIN_ROLE_DEFAULT_PATHS[role];
};

export const getAdminNavGroupsForRole = (role: string | null | undefined): AdminNavGroup[] =>
  ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessAdminPath(role, item.path)),
  })).filter((group) => group.items.length > 0);

const allAdminItems = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupKey: group.key })),
).sort((a, b) => b.path.length - a.path.length);

export const getAdminSelectedKey = (pathname: string) => {
  const cleanPath = normalizeAdminPath(pathname);
  const alias = Object.entries(ADMIN_NAV_ALIASES).find(
    ([from]) => cleanPath === from || cleanPath.startsWith(`${from}/`),
  )?.[1];

  if (alias) return alias;

  return (
    allAdminItems.find((item) => cleanPath === item.path || cleanPath.startsWith(`${item.path}/`))
      ?.path ?? ADMIN_BASE_PATH
  );
};

export const getAdminOpenKeys = (pathname: string): AdminNavGroupKey[] => {
  const selectedKey = getAdminSelectedKey(pathname);
  const group = allAdminItems.find((item) => item.path === selectedKey)?.groupKey;

  return group ? [group] : ['overview'];
};
