'use client';

import type { Plans } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Tag } from '@lobehub/ui/base-ui';

import { normalizePlanCatalogPresentation } from '@/const/billingPresentation';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import {
  ADMIN_PLAN_MODEL_MATRIX_PATH,
  type AdminPlanModelRules,
  getPlanModelRulesSummaryInfo,
} from '@/features/Admin/adminPlanModelRules';

/** 套餐行类型（B2 拆分自 routes/(main)/admin/plans，原样迁移）。 */
export type PlanRow = {
  currency: string;
  displayName: string;
  features: string[] | null;
  isActive: boolean;
  modelRules: AdminPlanModelRules | null;
  monthlyCredits: number;
  monthlyPrice: number;
  metadata?: {
    badge?: string;
    comparisonNote?: string;
    lifetimePrice?: null | number;
    oneTimePrice?: null | number;
    pptCreditCost?: number;
    pptEnabled?: boolean;
    pptMonthlyQuota?: null | number;
    purchaseUrl?: string;
    storageQuotaMb?: null | number;
    vectorQuota?: null | number;
    yearlyDiscountLabel?: string;
  } | null;
  plan: string;
  sortOrder: number;
  yearlyPrice: number;
};

export const ADMIN_PLANS_SWR_KEY = ['admin-plans'];

/** 套餐编辑弹窗表单值类型（字段与原页面一一对应）。 */
export type PlanFormValues = {
  badge?: string;
  comparisonNote?: string;
  currency?: string;
  displayName: string;
  features?: string;
  isActive?: boolean;
  lifetimePrice?: null | number;
  monthlyCredits?: number;
  monthlyPrice?: number;
  oneTimePrice?: null | number;
  plan: Plans;
  pptCreditCost?: number;
  pptEnabled?: boolean;
  pptMonthlyQuota?: null | number;
  purchaseUrl?: string;
  sortOrder?: number;
  storageQuotaMb?: null | number;
  vectorQuota?: null | number;
  yearlyDiscountLabel?: string;
  yearlyPrice?: number;
};

/** 套餐列定义（渲染、模型权限摘要与操作按钮原样迁移）。 */
export const buildPlanColumns = (
  t: (key: any, defaultValue?: any, values?: any) => string,
  handlers: {
    handleDelete: (plan: string) => void;
    handleToggleActive: (row: PlanRow) => void;
    navigate: (path: string) => void;
    openEdit: (row: PlanRow) => void;
  },
) => [
  { dataIndex: 'plan', key: 'plan', title: t('admin.plans.col.key', '键名') },
  { dataIndex: 'displayName', key: 'displayName', title: t('admin.plans.col.name', '显示名称') },
  {
    dataIndex: 'monthlyCredits',
    key: 'monthlyCredits',
    render: (value: number) => formatAdminCredits(value),
    title: t('admin.plans.col.monthlyCredits', '每月积分'),
  },
  {
    dataIndex: 'monthlyPrice',
    key: 'monthlyPrice',
    render: (value: number, row: PlanRow) => `${value} ${row.currency}`,
    title: t('admin.plans.col.monthly', '月付'),
  },
  {
    dataIndex: 'yearlyPrice',
    key: 'yearlyPrice',
    render: (value: number, row: PlanRow) => `${value} ${row.currency}`,
    title: t('admin.plans.col.yearly', '年付'),
  },
  {
    dataIndex: 'metadata',
    key: 'presentation',
    render: (metadata: PlanRow['metadata']) => {
      const presentation = normalizePlanCatalogPresentation(metadata);

      return (
        <Flexbox horizontal gap={4} wrap="wrap">
          {presentation.badge ? <Tag color="gold">{presentation.badge}</Tag> : null}
          {presentation.yearlyDiscountLabel ? (
            <Tag color="green">{presentation.yearlyDiscountLabel}</Tag>
          ) : null}
          {presentation.comparisonNote ? <Tag color="blue">对比说明</Tag> : null}
          {!presentation.badge &&
          !presentation.yearlyDiscountLabel &&
          !presentation.comparisonNote ? (
            <Tag>未设置</Tag>
          ) : null}
        </Flexbox>
      );
    },
    title: t('admin.plans.col.presentation', '展示设置'),
  },
  {
    dataIndex: 'metadata',
    key: 'purchaseUrl',
    render: (metadata: PlanRow['metadata']) =>
      metadata?.purchaseUrl ? <Tag color="blue">已设置</Tag> : <Tag>未设置</Tag>,
    title: t('admin.plans.col.purchaseUrl', '购买链接'),
  },
  {
    dataIndex: 'metadata',
    key: 'quotas',
    render: (metadata: PlanRow['metadata']) => (
      <Flexbox gap={4}>
        <Tag>
          存储{' '}
          {metadata?.storageQuotaMb === null || metadata?.storageQuotaMb === undefined
            ? '不限'
            : `${metadata.storageQuotaMb} MB`}
        </Tag>
        <Tag>
          向量{' '}
          {metadata?.vectorQuota === null || metadata?.vectorQuota === undefined
            ? '不限'
            : metadata.vectorQuota}
        </Tag>
      </Flexbox>
    ),
    title: t('admin.plans.col.quotas', '资源限制'),
  },
  {
    dataIndex: 'metadata',
    key: 'ppt',
    render: (metadata: PlanRow['metadata']) =>
      metadata?.pptEnabled ? (
        <Tag color="purple">
          PPT {metadata.pptMonthlyQuota ?? '不限'} / {metadata.pptCreditCost ?? 0} 积分
        </Tag>
      ) : (
        <Tag>未启用</Tag>
      ),
    title: t('admin.plans.col.ppt', 'PPT 权益'),
  },
  {
    dataIndex: 'isActive',
    key: 'isActive',
    render: (value: boolean) => (value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    title: t('admin.plans.col.active', '状态'),
  },
  {
    dataIndex: 'modelRules',
    key: 'modelRules',
    render: (rules: AdminPlanModelRules | null) => {
      const summary = getPlanModelRulesSummaryInfo(rules);

      return (
        <Flexbox gap={4}>
          <Tag color={summary.hasRules ? 'orange' : 'green'}>{summary.label}</Tag>
          {summary.allowlistTypeCount > 0 ? (
            <Tag>
              白名单 {summary.allowlistTypeCount} 类 / {summary.allowlistEntryCount} 项
            </Tag>
          ) : null}
          {summary.blocklistTypeCount > 0 ? (
            <Tag>
              黑名单 {summary.blocklistTypeCount} 类 / {summary.blocklistEntryCount} 项
            </Tag>
          ) : null}
        </Flexbox>
      );
    },
    title: t('admin.plans.col.modelRules', '模型权限'),
  },
  {
    key: 'actions',
    render: (_: unknown, row: PlanRow) => (
      <Flexbox horizontal gap={8}>
        <Button size="small" onClick={() => handlers.navigate(ADMIN_PLAN_MODEL_MATRIX_PATH)}>
          {t('admin.plans.modelRules', '去矩阵配置')}
        </Button>
        <Button size="small" onClick={() => handlers.openEdit(row)}>
          {t('admin.plans.edit', '编辑')}
        </Button>
        <Button size="small" onClick={() => handlers.handleToggleActive(row)}>
          {row.isActive ? t('admin.plans.deactivate', '停用') : t('admin.plans.activate', '启用')}
        </Button>
        <Button danger size="small" onClick={() => handlers.handleDelete(row.plan)}>
          {t('admin.plans.delete', '删除')}
        </Button>
      </Flexbox>
    ),
    title: t('admin.plans.col.actions', '操作'),
  },
];
