'use client';

import { Button, Tag } from '@lobehub/ui/base-ui';

import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';

type RewardType = 'credits' | 'plan' | 'topup_package';

export const REWARD_COLORS: Record<RewardType, string> = {
  credits: 'gold',
  plan: 'purple',
  topup_package: 'cyan',
};

export const REDEMPTION_STATUS_COLORS: Record<string, string> = {
  active: 'green',
  disabled: 'default',
  expired: 'warning',
  redeemed: 'blue',
};

export interface RedemptionColumnsContext {
  handleDisable: (id: string) => void | Promise<void>;
  handleEnable: (id: string) => void | Promise<void>;
  t: (key: any, defaultValue?: any, values?: any) => string;
}

/** 兑换码列表列定义（B2 拆分，渲染逻辑原样迁移）。 */
export const buildRedemptionColumns = (ctx: RedemptionColumnsContext) => {
  const { t } = ctx;

  return [
    {
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <code>{v}</code>,
      title: t('admin.redemption.col.code', '兑换码'),
    },
    {
      dataIndex: 'rewardType',
      key: 'rewardType',
      render: (v: RewardType) => <Tag color={REWARD_COLORS[v]}>{v}</Tag>,
      title: t('admin.redemption.col.type', '类型'),
    },
    {
      key: 'reward',
      render: (_: unknown, r: any) =>
        r.rewardType === 'plan'
          ? `${r.planKey} / ${r.planCycle}${r.planDurationMonths ? ` / ${r.planDurationMonths} 个月` : ''}`
          : r.rewardType === 'credits'
            ? formatAdminCredits(r.creditsAmount)
            : r.topupPackageId,
      title: t('admin.redemption.col.reward', '奖励'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={REDEMPTION_STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.redemption.col.status', '状态'),
    },
    {
      dataIndex: 'batchId',
      key: 'batchId',
      render: (v: string | null) => (v ? <code style={{ fontSize: 11 }}>{v}</code> : '-'),
      title: t('admin.redemption.col.batch', '批次'),
    },
    {
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '-'),
      title: t('admin.redemption.col.expires', '过期时间'),
    },
    {
      dataIndex: 'redeemedByUserId',
      key: 'redeemedByUserId',
      render: (v: string | null) => (v ? <code>{v.slice(0, 8)}</code> : '-'),
      title: t('admin.redemption.col.redeemedBy', '兑换用户'),
    },
    {
      dataIndex: 'redeemedAt',
      key: 'redeemedAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
      title: t('admin.redemption.col.redeemedAt', '兑换时间'),
    },
    {
      key: 'actions',
      render: (_: unknown, r: any) =>
        r.status === 'active' ? (
          <Button danger size="small" onClick={() => ctx.handleDisable(r.id)}>
            {t('admin.redemption.disable', '停用')}
          </Button>
        ) : r.status === 'disabled' ? (
          <Button size="small" type="primary" onClick={() => ctx.handleEnable(r.id)}>
            {t('admin.redemption.enable', '启用')}
          </Button>
        ) : (
          '-'
        ),
      title: t('admin.redemption.col.actions', '操作'),
    },
  ];
};
