export const ADMIN_BASE_PATH = '/settings/admin';

export type AdminNavGroupKey =
  | 'overview'
  | 'user-plan'
  | 'model-billing'
  | 'plugins'
  | 'brand-growth'
  | 'content'
  | 'client'
  | 'system';

export type AdminNavIcon =
  | 'audit'
  | 'billing'
  | 'credits'
  | 'desktop'
  | 'documents'
  | 'expert-plaza'
  | 'file-storage'
  | 'files'
  | 'growth'
  | 'maintenance'
  | 'models'
  | 'notifications'
  | 'orders'
  | 'overview'
  | 'plans'
  | 'plugins'
  | 'ppt'
  | 'pricing'
  | 'providers'
  | 'redemption'
  | 'recommendations'
  | 'settings'
  | 'stats'
  | 'subscriptions'
  | 'system-defaults'
  | 'topup'
  | 'topics'
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
        description: '查看充值订单并处理待支付、过期和取消状态',
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
        icon: 'providers',
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
      {
        description: '配置 Docmee PPT 创作服务、下载权限和套餐额度规则',
        icon: 'ppt',
        label: 'PPT 创作',
        path: `${ADMIN_BASE_PATH}/ppt`,
      },
    ],
    key: 'model-billing',
    label: '模型与计费',
  },
  {
    description: '模块应用、运行记录、产物、套餐权限、审核发布和商业计费',
    icon: 'plugins',
    items: [
      {
        description: '管理模块应用、页面、动作、套餐权限、计费配置、记录、运行产物和审计日志',
        icon: 'plugins',
        label: '模块应用',
        path: `${ADMIN_BASE_PATH}/module-apps`,
      },
    ],
    key: 'plugins',
    label: '应用模块',
  },
  {
    description: '品牌、登录页、默认助手外观、注册、推荐和公开运营内容',
    icon: 'settings',
    items: [
      {
        description: '配置品牌展示、登录页、默认助手外观、关于页和帮助菜单',
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
        description: '管理站内通知、桌面通知默认策略、邮件通道预留配置和系统公告',
        icon: 'notifications',
        label: '通知管理',
        path: `${ADMIN_BASE_PATH}/notifications`,
      },
      {
        description: '配置侧栏专家广场入口、栏目名称、分类和展示卡片',
        icon: 'expert-plaza',
        label: '专家广场',
        path: `${ADMIN_BASE_PATH}/expert-plaza`,
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
    description: '统一治理用户话题、资源文件和文档内容',
    icon: 'documents',
    items: [
      {
        description: '查看所有用户话题，支持按状态筛选、归档和删除异常话题',
        icon: 'topics',
        label: '话题管理',
        path: `${ADMIN_BASE_PATH}/topics`,
      },
      {
        description: '查看所有用户资源文件，定位文件类型、体积、向量任务和归属用户',
        icon: 'files',
        label: '资源文件',
        path: `${ADMIN_BASE_PATH}/files`,
      },
      {
        description: '查看用户文档、知识文档、网页文档和助理相关文档',
        icon: 'documents',
        label: '用户文档',
        path: `${ADMIN_BASE_PATH}/documents`,
      },
    ],
    key: 'content',
    label: '内容治理',
  },
  {
    description: '客户端登录页、下载入口、发布版本、自动更新和对象存储',
    icon: 'desktop',
    items: [
      {
        description: '配置客户端登录页、桌面端下载、发布版本、自动更新和 OSS 存储',
        icon: 'desktop',
        label: '客户端',
        path: `${ADMIN_BASE_PATH}/desktop-update`,
      },
    ],
    key: 'client',
    label: '客户端',
  },
  {
    description: '文件存储、数据看板、审计日志和系统运维',
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
        description: '配置 S3 兼容文件存储、CDN、上传路径和预签名 URL',
        icon: 'file-storage',
        label: '文件存储',
        path: `${ADMIN_BASE_PATH}/file-storage`,
      },
      {
        description: '配置向量检索、用户服务模型默认值、默认技能和头像预设',
        icon: 'system-defaults',
        label: '系统默认值',
        path: `${ADMIN_BASE_PATH}/system-defaults`,
      },
      {
        description: '配置 Cron 密钥、数据保留策略、记忆任务执行方式和手动维护',
        icon: 'maintenance',
        label: '系统维护',
        path: `${ADMIN_BASE_PATH}/maintenance`,
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

export const normalizeAdminPath = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/, '') || ADMIN_BASE_PATH;

  if (cleanPath === '/admin') return ADMIN_BASE_PATH;
  if (cleanPath.startsWith('/admin/'))
    return `${ADMIN_BASE_PATH}${cleanPath.slice('/admin'.length)}`;

  return cleanPath;
};

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
