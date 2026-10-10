'use client';

import { Button, Tag  } from '@lobehub/ui/base-ui';
import { Space } from 'antd';
import { RotateCcw, ShieldCheck } from 'lucide-react';

import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { adminCommercialService } from '@/services/adminCommercial';

import { statusColor } from './paymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export type TopUpPaymentRow = {
  amount: number | string;
  createdAt: Date | string;
  credits: number | string;
  currency: string;
  externalOrderId: null | string;
  id: string;
  idempotencyKey: null | string;
  method: null | string;
  packageId: null | string;
  paidAt: Date | null | string;
  paymentReference: null | string;
  provider: string;
  refundReference: null | string;
  refundStatus: 'failed' | 'pending' | 'succeeded' | null;
  status: string;
  updatedAt: Date | string;
  userEmail: null | string;
  userId: string;
  userName: null | string;
};

export interface TopUpPaymentColumnsParams {
  busyAction?: string;
  canWrite: boolean;
  onRefund: (row: TopUpPaymentRow) => void;
  onResolveRefund: (row: TopUpPaymentRow) => void;
  runOperation: <T,>(
    key: string,
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ) => Promise<void>;
  t: TFn;
}

/** 充值支付表列定义（M5 拆页：从 TopUpPaymentsPage 抽出）。 */
export const buildTopUpPaymentColumns = ({
  busyAction,
  canWrite,
  onRefund,
  onResolveRefund,
  runOperation,
  t,
}: TopUpPaymentColumnsParams) => [
  {
    dataIndex: 'id',
    key: 'id',
    render: (value: string) => <code title={value}>{value.slice(0, 12)}</code>,
    title: t('admin.payments.topups.columns.order', 'Order'),
  },
  {
    dataIndex: 'userId',
    key: 'user',
    render: (value: string, row: TopUpPaymentRow) => (
      <div>
        <div>{row.userEmail || row.userName || '-'}</div>
        <code title={value}>{value.slice(0, 12)}</code>
      </div>
    ),
    title: t('admin.payments.topups.columns.user', 'User'),
  },
  {
    key: 'channel',
    render: (_: unknown, row: TopUpPaymentRow) => (
      <div>
        <div>{row.provider}</div>
        <small>{row.method || '-'}</small>
      </div>
    ),
    title: t('admin.payments.topups.columns.channel', 'Channel'),
  },
  {
    key: 'amount',
    render: (_: unknown, row: TopUpPaymentRow) => (
      <div>
        <div>{`${row.currency} ${row.amount}`}</div>
        <small>{formatAdminCredits(row.credits)}</small>
      </div>
    ),
    title: t('admin.payments.topups.columns.amount', 'Amount / credits'),
  },
  {
    dataIndex: 'status',
    key: 'status',
    render: (value: string, row: TopUpPaymentRow) => (
      <Space direction="vertical" size={2}>
        <Tag color={statusColor[value as keyof typeof statusColor]}>
          {t(`admin.payments.topups.status.${value}`, value)}
        </Tag>
        {row.refundStatus && value !== 'refunded' ? (
          <small>
            {t(
              `admin.payments.topups.refundStatus.${row.refundStatus}`,
              `Refund ${row.refundStatus}`,
            )}
          </small>
        ) : null}
      </Space>
    ),
    title: t('admin.payments.topups.columns.status', 'Status'),
  },
  {
    dataIndex: 'externalOrderId',
    key: 'externalOrderId',
    render: (value: null | string) => (value ? <code title={value}>{value}</code> : '-'),
    title: t('admin.payments.topups.columns.providerOrder', 'Provider order'),
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (value: Date | string) => new Date(value).toLocaleString(),
    title: t('admin.payments.topups.columns.createdAt', 'Created'),
    width: 180,
  },
  {
    key: 'actions',
    render: (_: unknown, row: TopUpPaymentRow) => {
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
                runOperation(row.id, () => adminCommercialService.reconcileTopUpPayment(row.id))
              }
            >
              {t('admin.payments.topups.reconcile', 'Reconcile')}
            </Button>
          ) : null}
          {canRefund ? (
            <Button
              icon={<RotateCcw aria-hidden size={14} />}
              loading={busyAction === `refund:${row.id}`}
              size="small"
              onClick={() => onRefund(row)}
            >
              {t('admin.payments.topups.refund', 'Refund')}
            </Button>
          ) : null}
          {canResolveRefund ? (
            <Button
              icon={<ShieldCheck aria-hidden size={14} />}
              loading={busyAction === `resolve:${row.id}`}
              size="small"
              onClick={() => onResolveRefund(row)}
            >
              {t('admin.payments.topups.manualResolution.action', 'Verify refund')}
            </Button>
          ) : null}
        </Space>
      );
    },
    title: t('admin.actions', 'Actions'),
    width: 190,
  },
];
