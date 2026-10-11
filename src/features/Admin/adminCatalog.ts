import { ADMIN_CAPABILITIES, type AdminCapability } from '@lobechat/types';

export const ADMIN_BASE_PATH = '/settings/admin';

export type AdminFeatureStatus =
  'active' | 'compatibility' | 'deprecated' | 'experimental' | 'planned';

export type AdminNavGroupKey =
  | 'workbench'
  | 'user-support'
  | 'finance-commerce'
  | 'ai-platform'
  | 'module-ecosystem'
  | 'content-ops'
  | 'client-release'
  | 'platform-ops'
  | 'audit-compliance';

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
  | 'mobile'
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
  | 'users'
  // 子栏目图标（方案 §2.2）。与 iconMap 双向零差集由 adminCatalog.test.ts
  // 断言锁住——两侧必须同步增删，否则 B8 接线时 iconMap[item.icon] 会静默
  // 取到 undefined 而不报错。
  | 'module-catalog'
  | 'module-finance'
  | 'module-operations'
  | 'module-audit'
  | 'content-growth';

/**
 * 一级栏目下的子栏目键。方案 §2.2 定稿 25 个子栏目。
 *
 * 数据层先落地（不改渲染、不改 URL），B7 再用它做选中态解析，B8 才接线。
 * 注意 `payments` 归属 finance-settlement 但 `status: 'compatibility'` 被
 * isVisibleInNavigation 过滤，不进侧栏——归属与可见性是两件事。
 */
export type AdminSubSectionKey =
  | 'workbench-overview'
  | 'workbench-quick'
  | 'user-support-identity'
  | 'user-support-defaults'
  | 'finance-products'
  | 'finance-accounts'
  | 'finance-settlement'
  | 'finance-analytics'
  | 'ai-sources'
  | 'ai-catalog'
  | 'ai-generate'
  | 'module-catalog'
  | 'module-finance'
  | 'module-operations'
  | 'module-audit'
  | 'content-resources'
  | 'content-operations'
  | 'content-growth'
  | 'client-desktop'
  | 'platform-brand'
  | 'platform-infra'
  | 'platform-runtime'
  | 'platform-maintenance'
  | 'audit-log';

export type AdminCatalogGroup = {
  description: string;
  icon: AdminNavIcon;
  key: AdminNavGroupKey;
  label: string;
};

export type AdminCatalogItem = {
  accessCapabilities?: AdminCapability[];
  backendDomains: string[];
  debugId: string;
  description: string;
  group: AdminNavGroupKey;
  icon: AdminNavIcon;
  id: string;
  label: string;
  owner: string;
  path: string;
  readCapability: AdminCapability;
  segment: string;
  status: AdminFeatureStatus;
  /**
   * 所属子栏目（方案 §2.2）。B6 先把归属写进数据层，B7 用它解析选中态，
   * B8 才接到侧栏渲染——三步分开落地，每步都可独立回滚。optional 是为了
   * 让 B6 能在不改动全部 28 个条目的前提下先加字段。
   */
  subSection?: AdminSubSectionKey;
  writeCapabilities: AdminCapability[];
};

export const ADMIN_CATALOG_GROUPS: readonly AdminCatalogGroup[] = [
  {
    description: '关键指标、跨域待办与运行健康的只读聚合',
    icon: 'overview',
    key: 'workbench',
    label: '工作台',
  },
  {
    description: '用户身份、权限档案与用户级默认值',
    icon: 'users',
    key: 'user-support',
    label: '用户与支持',
  },
  {
    description: '套餐、订阅、订单、积分、兑换码、支付渠道与商业统计',
    icon: 'orders',
    key: 'finance-commerce',
    label: '资金与商业化',
  },
  {
    description: '服务商、模型目录、访问策略与生成服务',
    icon: 'models',
    key: 'ai-platform',
    label: '模型与生成',
  },
  {
    description: '模块应用目录、审核、商业化、运行数据与审计',
    icon: 'plugins',
    key: 'module-ecosystem',
    label: '模块生态',
  },
  {
    description: '内容资源治理与推荐、专家广场、通知和增长运营',
    icon: 'documents',
    key: 'content-ops',
    label: '内容与曝光运营',
  },
  {
    description: '桌面安装包构建、版本发布与客户端更新',
    icon: 'desktop',
    key: 'client-release',
    label: '桌面端发版',
  },
  {
    description: '站点品牌、存储、集成、移动端与运行时维护',
    icon: 'settings',
    key: 'platform-ops',
    label: '平台配置与运维',
  },
  {
    description: '后台操作与敏感动作的审计记录',
    icon: 'audit',
    key: 'audit-compliance',
    label: '审计与合规',
  },
];

const pathFor = (segment: string) => (segment ? `${ADMIN_BASE_PATH}/${segment}` : ADMIN_BASE_PATH);

export const ADMIN_CATALOG = [
  {
    backendDomains: ['stats', 'subscriptions', 'settings'],
    debugId: 'Desktop > Admin > overview',
    description: '查看核心指标、待处理事项和运行健康状态',
    group: 'workbench',
    icon: 'overview',
    id: 'overview',
    label: '工作台',
    owner: 'admin-platform',
    path: pathFor(''),
    readCapability: ADMIN_CAPABILITIES.adminAccess,
    segment: '',
    status: 'active',
    subSection: 'workbench-overview',
    writeCapabilities: [],
  },
  {
    backendDomains: ['users', 'credits', 'subscriptions'],
    debugId: 'Desktop > Admin > users',
    description: '管理用户身份、角色、状态和支持动作',
    group: 'user-support',
    icon: 'users',
    id: 'users',
    label: '用户管理',
    owner: 'identity',
    path: pathFor('users'),
    readCapability: ADMIN_CAPABILITIES.userRead,
    segment: 'users',
    status: 'active',
    subSection: 'user-support-identity',
    writeCapabilities: [
      ADMIN_CAPABILITIES.supportWrite,
      ADMIN_CAPABILITIES.financeWrite,
      ADMIN_CAPABILITIES.adminAccess,
    ],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > user-defaults',
    description: '配置新用户继承的模型、工具、头像和兴趣领域默认值',
    group: 'user-support',
    icon: 'users',
    id: 'user-defaults',
    label: '用户默认值',
    owner: 'identity',
    path: pathFor('user-defaults'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'user-defaults',
    status: 'active',
    subSection: 'user-support-defaults',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['plans'],
    debugId: 'Desktop > Admin > plans',
    description: '配置套餐价格、积分和权益',
    group: 'finance-commerce',
    icon: 'plans',
    id: 'plans',
    label: '套餐与权益',
    owner: 'commercial',
    path: pathFor('plans'),
    readCapability: ADMIN_CAPABILITIES.financeRead,
    segment: 'plans',
    status: 'active',
    subSection: 'finance-products',
    writeCapabilities: [ADMIN_CAPABILITIES.financeWrite],
  },
  {
    backendDomains: ['subscriptions'],
    debugId: 'Desktop > Admin > subscriptions',
    description: '查看订阅并处理套餐变更',
    group: 'finance-commerce',
    icon: 'subscriptions',
    id: 'subscriptions',
    label: '订阅管理',
    owner: 'commercial',
    path: pathFor('subscriptions'),
    readCapability: ADMIN_CAPABILITIES.financeRead,
    segment: 'subscriptions',
    status: 'active',
    subSection: 'finance-accounts',
    writeCapabilities: [ADMIN_CAPABILITIES.financeWrite],
  },
  {
    backendDomains: ['orders', 'topupPackages'],
    debugId: 'Desktop > Admin > orders',
    description: '管理平台订单和充值套餐商品',
    group: 'finance-commerce',
    icon: 'orders',
    id: 'orders',
    label: '订单与充值套餐',
    owner: 'commercial',
    path: pathFor('orders'),
    readCapability: ADMIN_CAPABILITIES.financeRead,
    segment: 'orders',
    status: 'active',
    subSection: 'finance-products',
    writeCapabilities: [ADMIN_CAPABILITIES.financeWrite],
  },
  {
    accessCapabilities: [ADMIN_CAPABILITIES.systemRead, ADMIN_CAPABILITIES.financeRead],
    backendDomains: ['settings', 'payment', 'moduleApps'],
    debugId: 'Desktop > Admin > payments',
    description: '统一配置支付渠道并处理订阅与充值交易',
    group: 'finance-commerce',
    icon: 'billing',
    id: 'payments',
    label: '支付中心',
    owner: 'commercial',
    path: pathFor('payments'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'payments',
    // PP-12 / IA 重设计 §3.3：支付中心是渠道配置与退款执行的唯一 UI 入口，
    // 但转 active 会让 finance_admin 首次可见退款执行入口（授权增量，§7.2-1），
    // 须业务签字后再放开；签字前保留 compatibility 继续隐藏，moduleApps
    // 重复标签页已删除（1c），模块支付对账以 /settings/admin/modules/finance/payments 为唯一入口。
    status: 'compatibility',
    subSection: 'finance-settlement',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite, ADMIN_CAPABILITIES.financeWrite],
  },
  {
    backendDomains: ['credits'],
    debugId: 'Desktop > Admin > credits',
    description: '查看积分账户余额，支持排序、筛选与导出',
    group: 'finance-commerce',
    icon: 'credits',
    id: 'credits',
    label: '积分账户',
    owner: 'commercial',
    path: pathFor('credits'),
    readCapability: ADMIN_CAPABILITIES.financeRead,
    segment: 'credits',
    status: 'active',
    subSection: 'finance-accounts',
    writeCapabilities: [ADMIN_CAPABILITIES.financeWrite],
  },
  {
    backendDomains: ['redemption'],
    debugId: 'Desktop > Admin > redemption',
    description: '生成、查询和停用兑换码',
    group: 'finance-commerce',
    icon: 'redemption',
    id: 'redemption',
    label: '兑换码',
    owner: 'commercial',
    path: pathFor('redemption'),
    readCapability: ADMIN_CAPABILITIES.financeRead,
    segment: 'redemption',
    status: 'active',
    subSection: 'finance-settlement',
    writeCapabilities: [ADMIN_CAPABILITIES.financeWrite],
  },
  {
    backendDomains: ['stats'],
    debugId: 'Desktop > Admin > stats',
    description: '查看平台概览、活跃、订阅、收入与兑换统计',
    group: 'finance-commerce',
    icon: 'stats',
    id: 'stats',
    label: '商业统计',
    owner: 'commercial',
    path: pathFor('stats'),
    readCapability: ADMIN_CAPABILITIES.financeRead,
    segment: 'stats',
    status: 'active',
    subSection: 'finance-analytics',
    writeCapabilities: [],
  },
  {
    backendDomains: ['newapiProviders'],
    debugId: 'Desktop > Admin > providers',
    description: '维护服务商实例、用途范围和模型目录',
    group: 'ai-platform',
    icon: 'providers',
    id: 'providers',
    label: '服务商与实例',
    owner: 'ai-platform',
    path: pathFor('providers'),
    readCapability: ADMIN_CAPABILITIES.modelOpsRead,
    segment: 'providers',
    status: 'active',
    subSection: 'ai-sources',
    writeCapabilities: [ADMIN_CAPABILITIES.modelOpsWrite],
  },
  {
    accessCapabilities: [
      ADMIN_CAPABILITIES.modelOpsRead,
      ADMIN_CAPABILITIES.financeRead,
      ADMIN_CAPABILITIES.systemRead,
    ],
    backendDomains: ['newapiProviders', 'plans', 'settings'],
    debugId: 'Desktop > Admin > model-billing-matrix',
    description: '统一管理模型目录、倍率和套餐计费',
    group: 'ai-platform',
    icon: 'pricing',
    id: 'model-billing-matrix',
    label: '模型目录与计费',
    owner: 'ai-platform',
    path: pathFor('model-billing-matrix'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'model-billing-matrix',
    status: 'active',
    subSection: 'ai-catalog',
    writeCapabilities: [
      ADMIN_CAPABILITIES.modelOpsWrite,
      ADMIN_CAPABILITIES.financeWrite,
      ADMIN_CAPABILITIES.systemWrite,
    ],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > model-policy',
    description: '配置平台模型访问允许和禁用策略',
    group: 'ai-platform',
    icon: 'models',
    id: 'model-policy',
    label: '模型访问策略',
    owner: 'ai-platform',
    path: pathFor('model-policy'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'model-policy',
    status: 'active',
    subSection: 'ai-catalog',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['ppt'],
    debugId: 'Desktop > Admin > ppt',
    description: '配置 PPT 生成服务和套餐额度',
    group: 'ai-platform',
    icon: 'ppt',
    id: 'ppt',
    label: 'PPT 生成服务',
    owner: 'ai-platform',
    path: pathFor('ppt'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'ppt',
    status: 'experimental',
    subSection: 'ai-generate',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > ai-runtime-defaults',
    description: '配置向量检索和记忆抽取的 AI 运行时默认模型',
    group: 'platform-ops',
    icon: 'system-defaults',
    id: 'ai-runtime-defaults',
    label: 'AI 运行时默认值',
    owner: 'ai-runtime',
    path: pathFor('ai-runtime-defaults'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'ai-runtime-defaults',
    status: 'active',
    subSection: 'platform-runtime',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    accessCapabilities: [ADMIN_CAPABILITIES.moduleAppRead, ADMIN_CAPABILITIES.financeRead],
    backendDomains: ['moduleApps'],
    debugId: 'Desktop > Admin > modules',
    description: '治理模块应用、审核、商业化和运行数据',
    group: 'module-ecosystem',
    icon: 'plugins',
    id: 'modules',
    label: '模块生态',
    owner: 'module-apps',
    path: pathFor('modules'),
    readCapability: ADMIN_CAPABILITIES.moduleAppRead,
    segment: 'modules',
    status: 'active',
    subSection: 'module-catalog',
    writeCapabilities: [ADMIN_CAPABILITIES.moduleAppWrite, ADMIN_CAPABILITIES.financeWrite],
  },
  {
    backendDomains: ['content'],
    debugId: 'Desktop > Admin > content-resources',
    description: '集中管理话题、资源文件和用户文档',
    group: 'content-ops',
    icon: 'documents',
    id: 'content-resources',
    label: '内容资源',
    owner: 'content',
    path: pathFor('content-resources'),
    readCapability: ADMIN_CAPABILITIES.contentRead,
    segment: 'content-resources',
    status: 'active',
    subSection: 'content-resources',
    writeCapabilities: [ADMIN_CAPABILITIES.contentWrite],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > content-operations',
    description: '集中管理推荐、专家广场、公告通知和运营开关',
    group: 'content-ops',
    icon: 'recommendations',
    id: 'content-operations',
    label: '内容运营',
    owner: 'operations',
    path: pathFor('content-operations'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'content-operations',
    status: 'active',
    subSection: 'content-operations',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings', 'referral'],
    debugId: 'Desktop > Admin > growth',
    description: '配置注册、推荐和增长策略',
    group: 'content-ops',
    icon: 'growth',
    id: 'growth',
    label: '注册与增长',
    owner: 'operations',
    path: pathFor('growth'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'growth',
    status: 'active',
    subSection: 'content-growth',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings', 'desktop-release'],
    debugId: 'Desktop > Admin > desktop-update',
    description: '统一管理桌面安装、版本、客户端状态和更新设置',
    group: 'client-release',
    icon: 'desktop',
    id: 'desktop-update',
    label: '桌面端发版',
    owner: 'client',
    path: pathFor('desktop-update'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'desktop-update',
    status: 'active',
    subSection: 'client-desktop',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > mobile',
    description: '统一管理移动端品牌、底部导航、发现内容、应用入口与配置发布',
    group: 'platform-ops',
    icon: 'mobile',
    id: 'mobile',
    label: '移动端控制中心',
    owner: 'client',
    path: pathFor('mobile'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'mobile',
    status: 'active',
    subSection: 'platform-brand',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > integrations',
    description: '配置 Composio 外部工具集成',
    group: 'platform-ops',
    icon: 'plugins',
    id: 'integrations',
    label: '外部集成',
    owner: 'integrations',
    path: pathFor('integrations'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'integrations',
    status: 'active',
    subSection: 'platform-infra',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings', 's3'],
    debugId: 'Desktop > Admin > file-storage',
    description: '配置对象存储、CDN 和预签名 URL',
    group: 'platform-ops',
    icon: 'file-storage',
    id: 'file-storage',
    label: '文件存储',
    owner: 'storage',
    path: pathFor('file-storage'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'file-storage',
    status: 'active',
    subSection: 'platform-infra',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > settings',
    description: '配置站点品牌、登录页和帮助入口',
    group: 'platform-ops',
    icon: 'settings',
    id: 'settings',
    label: '站点与品牌',
    owner: 'system',
    path: pathFor('settings'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'settings',
    status: 'active',
    subSection: 'platform-brand',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['settings'],
    debugId: 'Desktop > Admin > maintenance',
    description: '管理缓存、数据保留和维护任务',
    group: 'platform-ops',
    icon: 'maintenance',
    id: 'maintenance',
    label: '缓存与维护',
    owner: 'system',
    path: pathFor('maintenance'),
    readCapability: ADMIN_CAPABILITIES.systemRead,
    segment: 'maintenance',
    status: 'active',
    subSection: 'platform-maintenance',
    writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
  },
  {
    backendDomains: ['audit'],
    debugId: 'Desktop > Admin > audit',
    description: '查询后台操作和敏感动作记录',
    group: 'audit-compliance',
    icon: 'audit',
    id: 'audit',
    label: '审计日志',
    owner: 'security',
    path: pathFor('audit'),
    readCapability: ADMIN_CAPABILITIES.auditRead,
    segment: 'audit',
    status: 'active',
    subSection: 'audit-log',
    writeCapabilities: [],
  },
] as const satisfies readonly AdminCatalogItem[];

export const getAdminCatalogAccessCapabilities = (item: AdminCatalogItem) =>
  item.accessCapabilities ?? [item.readCapability];

export type AdminCatalogId = (typeof ADMIN_CATALOG)[number]['id'];
