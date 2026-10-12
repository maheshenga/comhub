import { type AdminRole, hasAdminCapability, isAdminRole, isFullAdminRole } from '@lobechat/types';

import {
  ADMIN_BASE_PATH,
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  type AdminCatalogItem,
  type AdminFeatureStatus,
  type AdminNavGroupKey,
  type AdminNavIcon,
  type AdminSubSectionKey,
  getAdminCatalogAccessCapabilities,
} from './adminCatalog';
import {
  findModuleAdminSectionByPath,
  MODULE_ADMIN_ROOT_PATH,
  MODULE_ADMIN_ROUTE_PATHS,
  type ModuleAdminRouteId,
} from './moduleApps/navigation/catalog';
import {
  type AdminAccessPolicy,
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
  /** 所属子栏目（B8 接线：一级组 → 子栏目 → 条目 的分组/过滤/高亮依据）。 */
  subSection: AdminSubSectionKey;
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
    subSection: item.subSection as AdminSubSectionKey,
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

/**
 * 模块分区伪条目（B8 需求 4）：moduleApps 的各分区从「藏在二级树」上提为
 * 主侧栏 module-ecosystem 组下的子栏目条目，与其他后台栏目并列。细节：
 * - 顶层 catalog 条目 modules（/settings/admin/modules）与 module-overview
 *   是同一个页面（modules 目录的 index 路由），两者互为别名，**不重复**
 *   上提 module-overview；
 * - MODULE_APP_DETAIL_SECTIONS 里带 :appId 的详情页签（module-app-overview /
 *   configuration / entitlements / products / runtime）按方案 §2.4 **不进侧
 *   栏**，留在应用详情页内（getAdminSelectedKey 也跳过它们）；
 * - 文案语义沿用模块中心二级侧栏（locales common 的 moduleApps.admin.center
 *   .navigation.*，zh 见 adminChineseCopy.test.ts 锁定值），不在 subscription
 *   三源里新增键；英文文案取 en-US/common.json 同键值；
 * - 可见性与路由守卫共用 MODULE_ADMIN_ROUTE_POLICIES：角色过滤在
 *   getAdminNavGroupsForRole 里逐条 canAccessAdminPolicy，与 canAccessAdminPath
 *   对分区路径的判定同源。
 */
type ModuleSectionNavSeed = {
  access: AdminAccessPolicy;
  icon: AdminNavIcon;
  id: ModuleAdminRouteId;
  label: string;
  path: string;
  subSection: AdminSubSectionKey;
};

const MODULE_SECTION_NAV_SEEDS: readonly ModuleSectionNavSeed[] = [
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-apps'].access,
    icon: 'module-catalog',
    id: 'module-apps',
    label: 'Apps',
    path: MODULE_ADMIN_ROUTE_PATHS['module-apps'],
    subSection: 'module-catalog',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-reviews'].access,
    icon: 'module-catalog',
    id: 'module-reviews',
    label: 'Reviews',
    path: MODULE_ADMIN_ROUTE_PATHS['module-reviews'],
    subSection: 'module-catalog',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-publishers'].access,
    icon: 'module-catalog',
    id: 'module-publishers',
    label: 'Publishers',
    path: MODULE_ADMIN_ROUTE_PATHS['module-publishers'],
    subSection: 'module-catalog',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-revenue'].access,
    icon: 'module-finance',
    id: 'module-revenue',
    label: 'Revenue',
    path: MODULE_ADMIN_ROUTE_PATHS['module-revenue'],
    subSection: 'module-finance',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-payments'].access,
    icon: 'module-finance',
    id: 'module-payments',
    label: 'Payments',
    path: MODULE_ADMIN_ROUTE_PATHS['module-payments'],
    subSection: 'module-finance',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-payouts'].access,
    icon: 'module-finance',
    id: 'module-payouts',
    label: 'Payouts',
    path: MODULE_ADMIN_ROUTE_PATHS['module-payouts'],
    subSection: 'module-finance',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-installs'].access,
    icon: 'module-operations',
    id: 'module-installs',
    label: 'Installs',
    path: MODULE_ADMIN_ROUTE_PATHS['module-installs'],
    subSection: 'module-operations',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-records'].access,
    icon: 'module-operations',
    id: 'module-records',
    label: 'Records',
    path: MODULE_ADMIN_ROUTE_PATHS['module-records'],
    subSection: 'module-operations',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-runs'].access,
    icon: 'module-operations',
    id: 'module-runs',
    label: 'Runs',
    path: MODULE_ADMIN_ROUTE_PATHS['module-runs'],
    subSection: 'module-operations',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-artifacts'].access,
    icon: 'module-operations',
    id: 'module-artifacts',
    label: 'Artifacts',
    path: MODULE_ADMIN_ROUTE_PATHS['module-artifacts'],
    subSection: 'module-operations',
  },
  {
    access: MODULE_ADMIN_ROUTE_POLICIES['module-audit'].access,
    icon: 'module-audit',
    id: 'module-audit',
    label: 'Audit',
    path: MODULE_ADMIN_ROUTE_PATHS['module-audit'],
    subSection: 'module-audit',
  },
];

const MODULES_CATALOG_ITEM = ADMIN_CATALOG.find((item) => item.id === 'modules');

const toModuleSectionNavItem = (seed: ModuleSectionNavSeed): AdminNavItem => ({
  description: '',
  icon: seed.icon,
  id: seed.id,
  label: seed.label,
  path: seed.path,
  status: MODULES_CATALOG_ITEM?.status ?? 'active',
  subSection: seed.subSection,
});

/** 子栏目标签 fallback（与 zh-CN/subscription.json 的 subSections.*.label 逐字
 * 一致——adminNavigationLocales.test 锁定 zh-CN 与 catalog 双向同步，侧栏
 * translate(key, fallback) 在 key 缺失时才落到这里）。 */
const SUB_SECTION_LABELS: Record<AdminSubSectionKey, string> = {
  'ai-catalog': '模型目录与计费',
  'ai-generate': '生成服务',
  'ai-sources': '服务商接入',
  'audit-log': '审计日志',
  'client-desktop': '桌面端发版',
  'content-growth': '注册与增长',
  'content-operations': '内容运营',
  'content-resources': '内容资源',
  'finance-accounts': '订阅与账户',
  'finance-analytics': '商业统计',
  'finance-products': '商品与定价',
  'finance-settlement': '支付与结算',
  'module-audit': '模块审计',
  'module-catalog': '目录与审核',
  'module-finance': '模块财务',
  'module-operations': '模块运维',
  'platform-brand': '站点与品牌',
  'platform-infra': '存储与集成',
  'platform-maintenance': '缓存与维护',
  'platform-runtime': '运行时默认值',
  'user-support-defaults': '新用户默认值',
  'user-support-identity': '身份与权限',
  'workbench-overview': '总览',
  'workbench-quick': '常用入口',
};

/** 子栏目状态徽标覆盖（B8 决策 6）：默认继承组内条目的 catalog status；唯一
 * 特例是模块运维——sectionStatus.ts:26-29 把 installs/records/runs/artifacts
 * 四个分区标为 experimental（聚合口径仍在收敛），主侧栏与之同源保留标注，
 * 避免「看起来是稳定主路径」的误导。其余分区（catalog/finance/audit）在两
 * 张表里都是 active，继承即可。 */
const SUB_SECTION_STATUS_OVERRIDES: Partial<Record<AdminSubSectionKey, AdminFeatureStatus>> = {
  'module-operations': 'experimental',
};

export type AdminNavSubSection = {
  items: AdminNavItem[];
  key: AdminSubSectionKey;
  label: string;
  status: AdminFeatureStatus;
};

/**
 * 侧栏渲染用的两级结构：group（ADMIN_NAV_GROUPS）→ 子栏目分组，条目挂到
 * catalog 声明的 subSection 上；模块分区伪条目并入 module-ecosystem 组。
 * workbench-quick 三源文案已备但无任何条目归属（盘点报告：24 键仅 20 被引
 * 用），这里按「有归属才出现」构建，不造空子栏目。构建时未经角色过滤——
 * 角色过滤在 getAdminNavGroupsForRole 里做，此表只描述 catalog + 策略表的
 * 静态形状。
 */
export const ADMIN_NAV_SUB_SECTIONS: Readonly<
  Record<AdminNavGroupKey, readonly AdminNavSubSection[]>
> = Object.fromEntries(
  ADMIN_NAV_GROUPS.map((group): [AdminNavGroupKey, readonly AdminNavSubSection[]] => {
    const items = [...group.items];
    if (group.key === 'module-ecosystem') {
      items.push(...MODULE_SECTION_NAV_SEEDS.map(toModuleSectionNavItem));
    }

    const bySubSection = new Map<AdminSubSectionKey, AdminNavItem[]>();
    for (const item of items) {
      const bucket = bySubSection.get(item.subSection);
      if (bucket) bucket.push(item);
      else bySubSection.set(item.subSection, [item]);
    }

    return [
      group.key,
      [...bySubSection.entries()].map(([key, entries]): AdminNavSubSection => ({
        items: entries,
        key,
        label: SUB_SECTION_LABELS[key],
        status: SUB_SECTION_STATUS_OVERRIDES[key] ?? entries[0].status,
      })),
    ] as const;
  }),
) as Record<AdminNavGroupKey, readonly AdminNavSubSection[]>;

/**
 * 角色过滤后的两级侧栏结构（B8 需求 2）：先按既有语义过滤组内条目
 * （canAccessAdminPath，与顶层行为逐字一致），再过滤子栏目与伪条目，最后
 * 抑制空组/空子栏目：
 * - 某子栏目下的条目全被过滤光 → 该子栏目消失；
 * - 某组下所有子栏目全消失（仅含被过滤伪条目的组如 module_admin 之外角色
 *   访问 module-ecosystem）→ 整组隐藏，绝无空组；
 * - 组内一个子栏目都没有可归属条目（防御性：理论上 ADMIN_NAV_GROUPS 保证
 *   非空）→ 走无子栏目形态，条目直接挂组下。
 * 伪条目按分区自身的 MODULE_ADMIN_ROUTE_POLICIES 判定——finance_admin 不可
 * module-apps/reviews/publishers/operations，module_admin 不可 module-*，
 * 与路由守卫（_layout canAccessAdminPath）完全同源。
 */
export const getAdminNavSectionsForRole = (role: string | null | undefined): AdminNavSection[] =>
  getAdminNavGroupsForRole(role).flatMap((group) => {
    const subSections = (ADMIN_NAV_SUB_SECTIONS[group.key] ?? [])
      .map((subSection) => ({
        ...subSection,
        items: subSection.items.filter((item) => canAccessAdminPath(role, item.path)),
      }))
      .filter((subSection) => subSection.items.length > 0);

    if (subSections.length === 0) {
      return group.items.length > 0 ? [{ ...group, items: group.items, subSections: [] }] : [];
    }

    return [
      {
        ...group,
        items: subSections.flatMap((subSection) => subSection.items),
        subSections,
      },
    ];
  });

export type AdminNavSection = AdminNavGroup & {
  subSections: AdminNavSubSection[];
};

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

/**
 * 两级结构的搜索过滤（B8）：沿用 filterAdminNavGroups 的语义——组名/组描述
 * 命中则保留整组；否则按条目过滤。子栏目名也参与匹配：子栏目名命中时保留
 * 该子栏目全部条目，条目命中时保留所在子栏目（连带组）。空组/空子栏目照例
 * 抑制。
 */
export const filterAdminNavSections = (
  sections: AdminNavSection[],
  query: string,
): AdminNavSection[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return sections;

  const matches = (text: string) => text.toLocaleLowerCase().includes(normalizedQuery);

  return sections.flatMap((section) => {
    const groupMatches = matches(`${section.label} ${section.description}`);
    if (groupMatches) return [section];

    if (section.subSections.length === 0) {
      const items = section.items.filter((item) => matches(`${item.label} ${item.description}`));
      return items.length > 0 ? [{ ...section, items }] : [];
    }

    const subSections = section.subSections.flatMap((subSection) => {
      // 译文对搜索不可得（本函数无 translate 通道），按 catalog fallback 文案
      // 与条目匹配；中文界面下 zh-CN label 与该 fallback 逐字一致
      // （adminNavigationLocales.test 锁定），子栏目名搜索行为不变。
      if (matches(subSection.label)) return [subSection];

      const items = subSection.items.filter((item) => matches(`${item.label} ${item.description}`));
      return items.length > 0 ? [{ ...subSection, items }] : [];
    });

    return subSections.length > 0
      ? [
          {
            ...section,
            items: subSections.flatMap((subSection) => subSection.items),
            subSections,
          },
        ]
      : [];
  });
};

/**
 * 侧栏高亮键（B8 需求 3）：getAdminSelectedKey 已把路径解析到叶子（模块分
 * 区叶子如 /settings/admin/modules/finance/payments），但两级侧栏的 Menu
 * item key 是「子栏目代表路径」（子栏目下第一条可见条目的 path）。这里把
 * 叶子路径映射到它所属子栏目的代表路径：
 * - 模块分区叶子 → 子栏目代表条目（如 module-catalog 组的 modules 顶层条目；
 *   module-finance 的代表条目是 payments 顶层条目——仅 admin 可见）；
 * - 其余路径：selectedKey 本身就是某子栏目下的条目 → 该子栏目代表路径；
 *   找不到归属（不该发生，防御性）→ 原样返回。
 */
export const getAdminActiveLeafKey = (
  role: string | null | undefined,
  pathname: string,
): string => {
  const selectedKey = getAdminSelectedKey(pathname);

  for (const subSections of Object.values(ADMIN_NAV_SUB_SECTIONS)) {
    const owner = subSections.find((subSection) =>
      subSection.items.some((item) => item.path === selectedKey),
    );
    if (owner) {
      const firstVisible = owner.items.find((item) => canAccessAdminPath(role, item.path));
      return firstVisible?.path ?? owner.items[0].path;
    }
  }

  return selectedKey;
};

export type AdminNavigationContext = {
  /** 当前 URL 真正落在的条目（选中态解析后的叶子，可能不在侧栏中）。 */
  item: AdminNavItem;
  /** 一级组（含 label/key，供面包屑中段渲染）。 */
  group: AdminNavGroup;
  /** 叶子路径归属的子栏目（B8：面包屑第三段显示子栏目名）。 */
  subSection: AdminNavSubSection;
};

/**
 * 选中条目解析（B8 升级）：先按旧行为在角色过滤后的条目里精确匹配
 * selectedKey；miss 时（选中态已解析到模块分区叶子等侧栏条目之外的路径）
 * 用「子栏目归属」兜底——只要叶子路径登记在某个可见子栏目下，就返回该组 +
 * 子栏目 + 一个代表条目，面包屑不再回落「管理后台」。
 */
export const getAdminNavigationContext = (
  role: string | null | undefined,
  pathname: string,
): AdminNavigationContext | null => {
  const groups = getAdminNavGroupsForRole(role);
  const selectedKey = getAdminSelectedKey(pathname);

  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.path === selectedKey);
    if (item) {
      const subSection = (ADMIN_NAV_SUB_SECTIONS[group.key] ?? []).find((candidate) =>
        candidate.items.some((entry) => entry.path === item.path),
      );
      if (subSection) return { group, item, subSection };
    }
  }

  for (const [groupKey, subSections] of Object.entries(ADMIN_NAV_SUB_SECTIONS)) {
    const subSection = subSections.find((candidate) =>
      candidate.items.some((entry) => entry.path === selectedKey),
    );
    if (!subSection) continue;

    const group = groups.find((candidate) => candidate.key === groupKey);
    if (!group) return null;

    const leaf =
      subSection.items.find((entry) => entry.path === selectedKey) ?? subSection.items[0];

    return {
      group,
      item: leaf,
      subSection,
    };
  }

  return null;
};
