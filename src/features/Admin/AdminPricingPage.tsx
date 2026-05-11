'use client';

import { memo } from 'react';

import AdminMergedRoutePage from '@/features/Admin/AdminMergedRoutePage';
import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';

const AdminPricingPage = memo(() => (
  <AdminMergedRoutePage
    description="全局积分倍率和订单开关已移到站点设置；模型倍率、每美元积分和套餐模型权限在模型与计费矩阵维护。"
    title="计费入口已合并"
    primaryAction={{
      label: '打开站点设置',
      path: `${ADMIN_BASE_PATH}/settings`,
    }}
    secondaryAction={{
      label: '打开模型与计费矩阵',
      path: `${ADMIN_BASE_PATH}/model-billing-matrix`,
    }}
  />
));

AdminPricingPage.displayName = 'AdminPricingPage';

export default AdminPricingPage;
