'use client';

import AdminMergedRoutePage from '@/features/Admin/AdminMergedRoutePage';
import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';

const AdminTopupLegacyRoute = () => (
  <AdminMergedRoutePage
    description="充值套餐已经合并到订单与充值页面的充值套餐标签页，订单处理和充值包配置统一在同一个管理面完成。"
    title="充值套餐入口已合并"
    primaryAction={{
      label: '打开订单与充值',
      path: `${ADMIN_BASE_PATH}/orders`,
    }}
  />
);

export default AdminTopupLegacyRoute;
