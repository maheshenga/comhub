import {
  DEFAULT_MOBILE_CONFIG,
  type MobileNavigationItemV1,
  type MobilePublicConfigV1,
  normalizeMobileConfig,
} from '@/const/mobileConfig';

const TOP_LEVEL_MOBILE_PATHS = new Set([
  '/',
  '/apps',
  '/community',
  '/community/agent',
  '/community/mcp',
  '/community/model',
  '/community/plugin',
  '/community/provider',
  '/community/skill',
  '/design',
  '/discover',
]);

const SLOT_ALIASES: Record<MobileNavigationItemV1['id'], string[]> = {
  'slot-1': ['/', '/agent'],
  'slot-2': ['/design'],
  'slot-3': ['/discover', '/community'],
  'slot-4': ['/apps'],
};

const normalizePathname = (pathname: string) => {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : '/';
};

const matchesPath = (pathname: string, routePath: string) => {
  const normalizedRoute = normalizePathname(routePath);
  if (normalizedRoute === '/') return pathname === '/';
  return pathname === normalizedRoute || pathname.startsWith(`${normalizedRoute}/`);
};

const visibleItems = (config: MobilePublicConfigV1) =>
  normalizeMobileConfig(config)
    .navigation.items.filter((item) => item.visible)
    .sort((left, right) => left.order - right.order);

export const resolveMobileActiveSlot = (
  rawPathname: string,
  config: MobilePublicConfigV1 = DEFAULT_MOBILE_CONFIG,
): MobileNavigationItemV1['id'] => {
  const pathname = normalizePathname(rawPathname);
  const items = visibleItems(config);
  const fallback = items[0]?.id ?? 'slot-1';
  const configuredMatch = items.find((item) => matchesPath(pathname, item.path));
  if (configuredMatch) return configuredMatch.id;

  const aliasMatch = items.find((item) =>
    SLOT_ALIASES[item.id].some((alias) => matchesPath(pathname, alias)),
  );
  return aliasMatch?.id ?? fallback;
};

export const shouldShowMobileTabBar = (
  rawPathname: string,
  config: MobilePublicConfigV1 = DEFAULT_MOBILE_CONFIG,
) => {
  const pathname = normalizePathname(rawPathname);
  if (TOP_LEVEL_MOBILE_PATHS.has(pathname)) return true;
  return visibleItems(config).some((item) => normalizePathname(item.path) === pathname);
};
