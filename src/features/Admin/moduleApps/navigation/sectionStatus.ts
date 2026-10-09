/**
 * PP-10（blueprint §2.1 治理三动作）：模块中心逐子页真实状态标注。
 *
 * 状态语义与 adminCatalog 一致：
 * - active：当前生产可用、数据源已接通；
 * - experimental：已上线但聚合口径仍在收敛，入口可用、数据仅供参考；
 * - compatibility：为兼容既有路径保留的聚合入口，主要操作已迁往他处。
 */
export type ModuleSectionStatus = 'active' | 'compatibility' | 'experimental';

export const MODULE_SECTION_STATUS: Partial<Record<string, ModuleSectionStatus>> = {
  // 审核队列：listPackages reviewStatus 原生过滤，生产主路径。
  'module-reviews': 'active',
  // 发布方 / 应用：列表 + 详情完整 CRUD。
  'module-publishers': 'active',
  'module-apps': 'active',
  'module-app-configuration': 'active',
  'module-app-entitlements': 'active',
  'module-app-products': 'active',
  'module-app-runtime': 'active',
  // 财务：收入与提现主路径可用；支付对账聚合页保留兼容入口。
  'module-revenue': 'active',
  'module-payouts': 'active',
  'module-payments': 'compatibility',
  // 运维观测子页为最近接通的聚合视图，口径仍在收敛。
  'module-installs': 'experimental',
  'module-records': 'experimental',
  'module-runs': 'experimental',
  'module-artifacts': 'experimental',
  // 审计事件流：读写已同事务化（M4），状态升级为 active。
  'module-audit': 'active',
  'module-overview': 'active',
};

export const getModuleSectionStatus = (id: string): ModuleSectionStatus =>
  MODULE_SECTION_STATUS[id] ?? 'active';
