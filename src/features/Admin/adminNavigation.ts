export const ADMIN_BASE_PATH = '/settings/admin';

export type AdminNavGroupKey =
  | 'overview'
  | 'user-plan'
  | 'model-billing'
  | 'brand-growth'
  | 'system';

export type AdminNavIcon =
  | 'audit'
  | 'billing'
  | 'credits'
  | 'desktop'
  | 'growth'
  | 'models'
  | 'newapi'
  | 'orders'
  | 'overview'
  | 'plans'
  | 'pricing'
  | 'redemption'
  | 'recommendations'
  | 'settings'
  | 'stats'
  | 'subscriptions'
  | 'topup'
  | 'users';

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

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    description: '关键指标、待处理事项和后台入口总览',
    icon: 'overview',
    items: [
      {
        description: '查看后台核心指标、配置健康状态和常用管理入口',
        icon: 'overview',
        label: '工作台',
        path: ADMIN_BASE_PATH,
      },
    ],
    key: 'overview',
    label: '工作台',
  },
  {
    description: '用户、套餐、订阅、订单、兑换码和积分账户',
    icon: 'users',
    items: [
      {
        description: '搜索用户、调整角色、封禁、人工调账和分配套餐',
        icon: 'users',
        label: '用户管理',
        path: `${ADMIN_BASE_PATH}/users`,
      },
      {
        description: '查看用户订阅状态、人工变更套餐和处理套餐变更请求',
        icon: 'subscriptions',
        label: '订阅管理',
        path: `${ADMIN_BASE_PATH}/subscriptions`,
      },
      {
        description: '配置订阅套餐、价格、月积分、购买链接和套餐权益',
        icon: 'plans',
        label: '套餐管理',
        path: `${ADMIN_BASE_PATH}/plans`,
      },
      {
        description: '查看充值订单并处理待支付、过期和取消状态；充值包入口已收口到订单链路',
        icon: 'orders',
        label: '订单与充值',
        path: `${ADMIN_BASE_PATH}/orders`,
      },
      {
        description: '生成、查询、停用和批量管理兑换码',
        icon: 'redemption',
        label: '兑换码',
        path: `${ADMIN_BASE_PATH}/redemption`,
      },
      {
        description: '查看积分账户、余额异常和积分流水',
        icon: 'credits',
        label: '积分账户',
        path: `${ADMIN_BASE_PATH}/credits`,
      },
    ],
    key: 'user-plan',
    label: '用户与套餐',
  },
  {
    description: '服务商实例、模型同步、默认模型、套餐权限、模型策略和计费矩阵',
    icon: 'models',
    items: [
      {
        description: '维护服务商实例、分组、用途范围和模型目录',
        icon: 'newapi',
        label: '服务商实例',
        path: `${ADMIN_BASE_PATH}/providers`,
      },
      {
        description: '统一管理默认模型、套餐模型权限、模型倍率和每美元积分',
        icon: 'pricing',
        label: '模型与计费矩阵',
        path: `${ADMIN_BASE_PATH}/model-billing-matrix`,
      },
      {
        description: '设置平台级模型允许 / 禁用清单和拒绝提示',
        icon: 'models',
        label: '全局模型策略',
        path: `${ADMIN_BASE_PATH}/model-policy`,
      },
    ],
    key: 'model-billing',
    label: '模型与计费',
  },
  {
    description: '品牌、登录页、默认助手、注册、推荐和公开运营内容',
    icon: 'settings',
    items: [
      {
        description: '配置品牌展示、默认助手、默认模型、关于页、帮助菜单、客户端入口和维护任务',
        icon: 'settings',
        label: '站点设置',
        path: `${ADMIN_BASE_PATH}/settings`,
      },
      {
        description: '配置注册、手机号、注册送积分和上传限制',
        icon: 'growth',
        label: '增长设置',
        path: `${ADMIN_BASE_PATH}/growth`,
      },
      {
        description: '管理首页、社区、推荐和精选展示内容',
        icon: 'recommendations',
        label: '推荐运营',
        path: `${ADMIN_BASE_PATH}/recommendations`,
      },
      {
        description: '配置公开运营开关、公告和精选模块',
        icon: 'settings',
        label: '运营配置',
        path: `${ADMIN_BASE_PATH}/operations`,
      },
    ],
    key: 'brand-growth',
    label: '品牌与增长',
  },
  {
    description: '桌面端更新、数据看板、审计日志和系统运维',
    icon: 'stats',
    items: [
      {
        description: '查看用户、订阅、收入和兑换数据',
        icon: 'stats',
        label: '数据看板',
        path: `${ADMIN_BASE_PATH}/stats`,
      },
      {
        description: '查询后台操作和敏感动作记录',
        icon: 'audit',
        label: '审计日志',
        path: `${ADMIN_BASE_PATH}/audit`,
      },
      {
        description: '配置桌面端下载、发布版本和自动更新',
        icon: 'desktop',
        label: '桌面端更新',
        path: `${ADMIN_BASE_PATH}/desktop-update`,
      },
    ],
    key: 'system',
    label: '系统运维',
  },
];

const ADMIN_NAV_ALIASES: Record<string, string> = {
  [`${ADMIN_BASE_PATH}/change-requests`]: `${ADMIN_BASE_PATH}/subscriptions`,
  [`${ADMIN_BASE_PATH}/pricing`]: `${ADMIN_BASE_PATH}/model-billing-matrix`,
  [`${ADMIN_BASE_PATH}/topup`]: `${ADMIN_BASE_PATH}/orders`,
};

const allAdminItems = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupKey: group.key })),
).sort((a, b) => b.path.length - a.path.length);

export const getAdminSelectedKey = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/, '') || ADMIN_BASE_PATH;
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
