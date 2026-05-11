'use client';

import AdminMergedRoutePage from '@/features/Admin/AdminMergedRoutePage';
import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';

const AdminChangeRequestsLegacyRoute = () => (
  <AdminMergedRoutePage
    description="套餐变更请求已经合并到订阅管理页面，管理员可以在订阅列表和变更请求标签之间统一处理用户套餐状态。"
    title="套餐变更请求入口已合并"
    primaryAction={{
      label: '打开订阅管理',
      path: `${ADMIN_BASE_PATH}/subscriptions`,
    }}
  />
);

export default AdminChangeRequestsLegacyRoute;
