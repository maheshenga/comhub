import type { ComponentType } from 'react';

import type { ModuleAdminRouteId } from '@/features/Admin/moduleApps/navigation/catalog';

type ImportPage = () => Promise<{ default: ComponentType } | ComponentType>;

export const MODULE_ADMIN_ROUTE_IMPORTS: Record<ModuleAdminRouteId, ImportPage | undefined> = {
  'module-app-configuration': () =>
    import('@/routes/(main)/admin/modules/apps/[appId]/configuration'),
  'module-app-detail-layout': () => import('@/routes/(main)/admin/modules/apps/[appId]/_layout'),
  'module-app-entitlements': () =>
    import('@/routes/(main)/admin/modules/apps/[appId]/entitlements'),
  'module-app-overview': () => import('@/routes/(main)/admin/modules/apps/[appId]'),
  'module-app-products': () => import('@/routes/(main)/admin/modules/apps/[appId]/products'),
  'module-app-runtime': () => import('@/routes/(main)/admin/modules/apps/[appId]/runtime'),
  'module-apps': () => import('@/routes/(main)/admin/modules/apps'),
  'module-artifacts': () => import('@/routes/(main)/admin/modules/operations/artifacts'),
  'module-audit': () => import('@/routes/(main)/admin/modules/audit'),
  // B8b：模块中心二级树形侧栏（216px aside）已下线，module-center-layout 不再
  // 挂任何布局组件——各分区页直接并入后台主栏。undefined 让它在
  // buildAdminSettingsRouteObject 里退化为无 element 的分组路由（与既有
  // module-finance / module-operations 同形态），URL 空间零变更。
  'module-center-layout': undefined,
  'module-finance': undefined,
  'module-installs': () => import('@/routes/(main)/admin/modules/operations/installs'),
  'module-operations': undefined,
  'module-overview': () => import('@/routes/(main)/admin/modules'),
  'module-payments': () => import('@/routes/(main)/admin/modules/finance/payments'),
  'module-payouts': () => import('@/routes/(main)/admin/modules/finance/payouts'),
  'module-publishers': () => import('@/routes/(main)/admin/modules/publishers'),
  'module-records': () => import('@/routes/(main)/admin/modules/operations/records'),
  'module-revenue': () => import('@/routes/(main)/admin/modules/finance/revenue'),
  'module-reviews': () => import('@/routes/(main)/admin/modules/reviews'),
  'module-runs': () => import('@/routes/(main)/admin/modules/operations/runs'),
};
