export const ADMIN_BASE_PATH = '/settings/admin';

export type AdminNavGroupKey =
  | 'overview'
  | 'users'
  | 'business'
  | 'model-api'
  | 'operations'
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
        description: '查看后台核心指标和常用管理入口',
        icon: 'overview',
        label: '工作台',
        path: ADMIN_BASE_PATH,
      },
    ],
    key: 'overview',
    label: '概览',
  },
  {
    description: '用户查询、封禁、角色和积分调整',
    icon: 'users',
    items: [
      {
        description: '搜索用户、调整角色、封禁和人工调账',
        icon: 'users',
        label: '用户管理',
        path: `${ADMIN_BASE_PATH}/users`,
      },
    ],
    key: 'users',
    label: '用户',
  },
  {
    description: '套餐、订阅、订单、充值和兑换码',
    icon: 'billing',
    items: [
      {
        description: '配置订阅套餐、价格、月积分和套餐权益',
        icon: 'plans',
        label: '套餐管理',
        path: `${ADMIN_BASE_PATH}/plans`,
      },
      {
        description: '查看用户订阅状态并执行人工变更',
        icon: 'subscriptions',
        label: '订阅管理',
        path: `${ADMIN_BASE_PATH}/subscriptions`,
      },
      {
        description: '处理用户提交的套餐变更请求',
        icon: 'growth',
        label: '变更请求',
        path: `${ADMIN_BASE_PATH}/change-requests`,
      },
      {
        description: '配置一次性充值套餐和赠送积分',
        icon: 'topup',
        label: '充值套餐',
        path: `${ADMIN_BASE_PATH}/topup`,
      },
      {
        description: '查看和处理充值订单',
        icon: 'orders',
        label: '订单管理',
        path: `${ADMIN_BASE_PATH}/orders`,
      },
      {
        description: '查看积分账户和异常余额',
        icon: 'credits',
        label: '积分账户',
        path: `${ADMIN_BASE_PATH}/credits`,
      },
      {
        description: '生成、查询和停用兑换码',
        icon: 'redemption',
        label: '兑换码',
        path: `${ADMIN_BASE_PATH}/redemption`,
      },
    ],
    key: 'business',
    label: '商业化',
  },
  {
    description: 'NewAPI 实例、默认模型、全局策略和计费规则',
    icon: 'models',
    items: [
      {
        description: '维护 NewAPI 网关实例、优先级和模型目录',
        icon: 'newapi',
        label: 'NewAPI 实例',
        path: `${ADMIN_BASE_PATH}/newapi-providers`,
      },
      {
        description: '统一查看模型来源、套餐权限、默认模型和计费倍率',
        icon: 'pricing',
        label: '模型与计费矩阵',
        path: `${ADMIN_BASE_PATH}/model-billing-matrix`,
      },
      {
        description: '设置全局模型访问策略和兜底模型',
        icon: 'models',
        label: '模型策略',
        path: `${ADMIN_BASE_PATH}/model-policy`,
      },
      {
        description: '配置模型积分倍率和订单开关',
        icon: 'pricing',
        label: '计费规则',
        path: `${ADMIN_BASE_PATH}/pricing`,
      },
    ],
    key: 'model-api',
    label: '模型与 API',
  },
  {
    description: '品牌、增长、首页内容和推荐模块',
    icon: 'settings',
    items: [
      {
        description: '配置品牌、默认模型、兼容 API 设置和帮助菜单',
        icon: 'settings',
        label: '站点与 API 设置',
        path: `${ADMIN_BASE_PATH}/settings`,
      },
      {
        description: '配置注册、注册送积分、推荐奖励和上传限制',
        icon: 'growth',
        label: '增长设置',
        path: `${ADMIN_BASE_PATH}/growth`,
      },
      {
        description: '管理首页、社区和推荐展示内容',
        icon: 'recommendations',
        label: '推荐运营',
        path: `${ADMIN_BASE_PATH}/recommendations`,
      },
      {
        description: '配置运营开关和公共展示信息',
        icon: 'settings',
        label: '运营配置',
        path: `${ADMIN_BASE_PATH}/operations`,
      },
    ],
    key: 'operations',
    label: '运营',
  },
  {
    description: '数据看板、审计日志、维护和客户端更新',
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
        description: '配置桌面端下载和版本更新',
        icon: 'desktop',
        label: '桌面端更新',
        path: `${ADMIN_BASE_PATH}/desktop-update`,
      },
    ],
    key: 'system',
    label: '系统',
  },
];

const allAdminItems = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupKey: group.key })),
).sort((a, b) => b.path.length - a.path.length);

export const getAdminSelectedKey = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/, '') || ADMIN_BASE_PATH;

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
