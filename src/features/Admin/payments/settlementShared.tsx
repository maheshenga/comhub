'use client';

import { Button, Tag  } from '@lobehub/ui/base-ui';
import type { TableProps } from 'antd';
import { Space } from 'antd';
import { createStaticStyles } from 'antd-style';
import { RotateCcw } from 'lucide-react';

import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';

export const settlementStyles = createStaticStyles(({ css, cssVar }) => ({
  error: css`
    display: grid;
    gap: 2px;
    max-width: 420px;
  `,
  errorMessage: css`
    overflow: hidden;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  toolbarField: css`
    display: grid;
    gap: 6px;

    min-width: 180px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

export type SettlementFailureStatus = 'pending' | 'resolved';

export type SettlementFailureRow = {
  actualAmount: number | string;
  attempts: number;
  createdAt: Date | string;
  errorCode: null | string;
  errorMessage: string;
  id: string;
  lastAttemptAt: Date | string;
  payerScopeType: 'personal' | 'workspace';
  payerUserId: null | string;
  payerWorkspaceId: null | string;
  reservationId: string;
  reservationStatus: string;
  resolvedAt: Date | null | string;
  status: SettlementFailureStatus;
  updatedAt: Date | string;
};

export const SETTLEMENT_STATUSES = ['pending', 'resolved'] as const;

export const formatDateTime = (value: Date | string) => new Date(value).toLocaleString();

type TFn = (key: any, defaultValue?: any, values?: any) => any;

/** 结算失败表格列定义 builder（M5 拆页：从 CreditSettlementFailuresPage 抽出）。 */
export const buildSettlementFailureColumns = ({
  busyId,
  canWrite,
  onRetry,
  t,
}: {
  busyId?: string;
  canWrite: boolean;
  onRetry: (row: SettlementFailureRow) => void;
  t: TFn;
}): TableProps<SettlementFailureRow>['columns'] => [
  {
    key: 'reservation',
    render: (_, row) => (
      <div>
        <div>{row.reservationId}</div>
        <small>{row.id}</small>
      </div>
    ),
    title: t('admin.payments.settlements.columns.reservation', 'Reservation / failure'),
    width: 300,
  },
  {
    key: 'payer',
    render: (_, row) =>
      row.payerScopeType === 'workspace' ? (row.payerWorkspaceId ?? '-') : (row.payerUserId ?? '-'),
    title: t('admin.payments.settlements.columns.payer', 'Payer'),
    width: 220,
  },
  {
    dataIndex: 'actualAmount',
    key: 'actualAmount',
    render: (value) => formatAdminCredits(Number(value)),
    title: t('admin.payments.settlements.columns.amount', 'Actual credits'),
    width: 130,
  },
  {
    key: 'error',
    render: (_, row) => (
      <div className={settlementStyles.error} title={row.errorMessage}>
        <strong>{row.errorCode ?? 'SETTLEMENT_FAILED'}</strong>
        <span className={settlementStyles.errorMessage}>{row.errorMessage}</span>
      </div>
    ),
    title: t('admin.payments.settlements.columns.error', 'Last error'),
    width: 360,
  },
  {
    key: 'attempts',
    render: (_, row) => (
      <div>
        <div>{row.attempts}</div>
        <small>{formatDateTime(row.lastAttemptAt)}</small>
      </div>
    ),
    title: t('admin.payments.settlements.columns.attempts', 'Attempts'),
    width: 180,
  },
  {
    key: 'status',
    render: (_, row) => (
      <Space direction="vertical" size={2}>
        <Tag color={row.status === 'resolved' ? 'green' : 'red'}>
          {t(`admin.payments.settlements.status.${row.status}`, row.status)}
        </Tag>
        <small>{row.reservationStatus}</small>
      </Space>
    ),
    title: t('admin.payments.settlements.columns.status', 'Status'),
    width: 130,
  },
  {
    fixed: 'right',
    key: 'actions',
    render: (_, row) =>
      canWrite && row.status === 'pending' ? (
        <Button
          icon={<RotateCcw aria-hidden size={16} />}
          loading={busyId === row.id}
          size="small"
          onClick={() => onRetry(row)}
        >
          {t('admin.payments.settlements.retry', 'Retry settlement')}
        </Button>
      ) : null,
    title: t('admin.payments.settlements.columns.actions', 'Actions'),
    width: 170,
  },
];
