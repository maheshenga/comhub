'use client';

import { Button, Tag  } from '@lobehub/ui/base-ui';
import { Space } from 'antd';
import { RotateCcw, ShieldCheck } from 'lucide-react';

import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { adminCommercialService } from '@/services/adminCommercial';

import { statusColor } from './paymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export type SubscriptionPaymentRow = {
  amount: number | string;
  createdAt: Date | string;
  currency: string;
  cycle: string;
  displayName: string;
  externalOrderId: null | string;
  id: string;
  idempotencyKey: string;
  method: string;
  monthlyCredits: number | string;
  paidAt: Date | null | string;
  plan: string;
  provider: string;
  refundReference: null | string;
  refundStatus: 'failed' | 'pending' | 'succeeded' | null;
  status: string;
  updatedAt: Date | string;
  userEmail: null | string;
  userId: string;
  userName: null | string;
};

export interface SubscriptionPaymentColumnsParams {
  busyAction?: string;
  canWrite: boolean;
  onRefund: (row: SubscriptionPaymentRow) => void;
  onResolveRefund: (row: SubscriptionPaymentRow) => void;
  runOperation: <T,>(
    key: string,
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ) => Promise<void>;
  t: TFn;
}

/** 订阅支付表列定义（M5 拆页：从 SubscriptionPaymentsPage 抽出）。 */
export const buildSubscriptionPaymentColumns = ({
  busyAction,
  canWrite,
  onRefund,
  onResolveRefund,
  runOperation,
  t,
}: SubscriptionPaymentColumnsParams) => [
  {
    dataIndex: 'id',
    key: 'id',
    render: (value: string) => <code title={value}>{value.slice(0, 12)}</code>,
    title: t('admin.payments.subscriptions.columns.order', 'Order'),
  },
  {
    dataIndex: 'userId',
    key: 'user',
    render: (value: string, row: SubscriptionPaymentRow) => (
      <div>
        <div>{row.userEmail || row.userName || '-'}</div>
        <code title={value}>{value.slice(0, 12)}</code>
      </div>
    ),
    title: t('admin.payments.subscriptions.columns.user', 'User'),
  },
  {
    key: 'plan',
    render: (_: unknown, row: SubscriptionPaymentRow) => (
      <div>
        <div>{row.displayName || row.plan}</div>
        <small>{`${row.cycle} · ${formatAdminCredits(row.monthlyCredits)}`}</small>
      </div>
    ),
    title: t('admin.payments.subscriptions.columns.plan', 'Plan / cycle'),
  },
  {
    key: 'channel',
    render: (_: unknown, row: SubscriptionPaymentRow) => (
      <div>
        <div>{row.provider}</div>
        <small>{row.method}</small>
      </div>
    ),
    title: t('admin.payments.subscriptions.columns.channel', 'Channel'),
  },
  {
    key: 'amount',
    render: (_: unknown, row: SubscriptionPaymentRow) => `${row.currency} ${row.amount}`,
    title: t('admin.payments.subscriptions.columns.amount', 'Amount'),
  },
  {
    dataIndex: 'status',
    key: 'status',
    render: (value: string, row: SubscriptionPaymentRow) => (
      <Space direction="vertical" size={2}>
        <Tag color={statusColor[value as keyof typeof statusColor]}>
          {t(`admin.payments.subscriptions.status.${value}`, value)}
        </Tag>
        {row.refundStatus && value !== 'refunded' ? (
          <small>
            {t(
              `admin.payments.subscriptions.refundStatus.${row.refundStatus}`,
              `Refund ${row.refundStatus}`,
            )}
          </small>
        ) : null}
      </Space>
    ),
    title: t('admin.payments.subscriptions.columns.status', 'Status'),
  },
  {
    dataIndex: 'externalOrderId',
    key: 'externalOrderId',
    render: (value: null | string) => (value ? <code title={value}>{value}</code> : '-'),
    title: t('admin.payments.subscriptions.columns.providerOrder', 'Provider order'),
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (value: Date | string) => new Date(value).toLocaleString(),
    title: t('admin.payments.subscriptions.columns.createdAt', 'Created'),
    width: 180,
  },
  {
    key: 'actions',
    render: (_: unknown, row: SubscriptionPaymentRow) => {
      if (!canWrite) return '-';
      const canReconcile =
        ['expired', 'failed', 'pending'].includes(row.status) ||
        (row.status === 'canceled' && ['failed', 'pending'].includes(row.refundStatus ?? ''));
      const canRefund =
        row.status === 'paid' &&
        row.refundStatus !== 'pending' &&
        row.refundStatus !== 'succeeded';
      const canResolveRefund = row.provider === 'zpay' && row.refundStatus === 'pending';
      if (!canReconcile && !canRefund && !canResolveRefund) return '-';
      return (
        <Space wrap size={4}>
          {canReconcile ? (
            <Button
              loading={busyAction === row.id}
              size="small"
              onClick={() =>
                runOperation(row.id, () =>
                  adminCommercialService.reconcileSubscriptionPayment(row.id),
                )
              }
            >
              {t('admin.payments.subscriptions.reconcile', 'Reconcile')}
            </Button>
          ) : null}
          {canRefund ? (
            <Button
              icon={<RotateCcw aria-hidden size={14} />}
              loading={busyAction === `refund:${row.id}`}
              size="small"
              onClick={() => onRefund(row)}
            >
              {t('admin.payments.subscriptions.refund', 'Refund')}
            </Button>
          ) : null}
          {canResolveRefund ? (
            <Button
              icon={<ShieldCheck aria-hidden size={14} />}
              loading={busyAction === `resolve:${row.id}`}
              size="small"
              onClick={() => onResolveRefund(row)}
            >
              {t('admin.payments.subscriptions.manualResolution.action', 'Verify refund')}
            </Button>
          ) : null}
        </Space>
      );
    },
    title: t('admin.actions', 'Actions'),
    width: 190,
  },
];
