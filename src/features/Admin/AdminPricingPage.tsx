'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AdminMergedRoutePage from '@/features/Admin/AdminMergedRoutePage';
import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';

const AdminPricingPage = memo(() => {
  const { t } = useTranslation('subscription');

  return (
    <AdminMergedRoutePage
      title={t('admin.pricing.merged.title', '计费入口已合并')}
      description={t(
        'admin.pricing.merged.description',
        '全局积分倍率、订单开关、模型倍率、每美元积分和套餐模型权限都已合并到模型与计费矩阵维护。',
      )}
      primaryAction={{
        label: t('admin.pricing.merged.action', '打开模型与计费矩阵'),
        path: `${ADMIN_BASE_PATH}/model-billing-matrix`,
      }}
    />
  );
});

AdminPricingPage.displayName = 'AdminPricingPage';

export default AdminPricingPage;
