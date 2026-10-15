'use client';

import type { ModuleAppPayoutStatus } from '@lobechat/types';
import { CopyButton, Flexbox } from '@lobehub/ui';
import { Button, Tag, Text } from '@lobehub/ui/base-ui';
import { memo } from 'react';

import { formatAdminAmount } from '@/features/Admin/adminAmountUnits';

import { AdminDataTable } from '../shared';
import { AdminTableState } from './AdminTableState';

export type ModuleAppPayoutRow = {
  auditEventIds: string[];
  createdAt?: Date | string;
  currency: string;
  id: string;
  publisherId: string;
  publisherName: string;
  recipientMask?: null | string;
  revenueEntryIds: string[];
  status: ModuleAppPayoutStatus;
  totalAmount: number;
  transactionNo?: null | string;
};

export type PayoutTableLabels = Partial<{
  action: string;
  alipayTransaction: string;
  amount: string;
  audit: string;
  empty: string;
  loading: string;
  manage: string;
  next: string;
  payout: string;
  previous: string;
  publisher: string;
  recipient: string;
  retry: string;
  revenue: string;
  status: string;
}>;

type PayoutTableProps = {
  canWrite?: boolean;
  error?: unknown;
  hasNext?: boolean;
  positionLabel?: string;
  hasPrevious?: boolean;
  items?: ModuleAppPayoutRow[];
  labels?: PayoutTableLabels;
  loading?: boolean;
  onAction?: (row: ModuleAppPayoutRow) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  /** 无障碍滚动区名字；三态由 AdminTableState 前置拦截。 */
  regionLabel?: string;
  onRetry?: () => void;
  statusLabels?: Record<string, string>;
};

const defaultLabels = {
  action: 'Actions',
  alipayTransaction: 'Alipay transaction',
  amount: 'Amount',
  audit: 'Audit',
  empty: 'No payouts',
  loading: 'Loading payouts',
  manage: 'Manage payout',
  next: 'Next page',
  payout: 'Payout',
  previous: 'Previous page',
  publisher: 'Publisher',
  recipient: 'Recipient',
  retry: 'Retry',
  revenue: 'Revenue',
  status: 'Status',
};

const CodeList = ({ values }: { values: string[] }) =>
  values.length ? (
    <Flexbox gap={2} style={{ maxWidth: 220 }}>
      {values.map((value) => (
        <Flexbox horizontal align="center" gap={2} key={value}>
          <Text code style={{ overflowWrap: 'anywhere' }}>
            {value}
          </Text>
          <CopyButton content={value} size="small" />
        </Flexbox>
      ))}
    </Flexbox>
  ) : (
    '-'
  );

const PayoutTable = memo<PayoutTableProps>(
  ({
    canWrite = false,
    error,
    hasNext,
    positionLabel,
    hasPrevious,
    items = [],
    labels,
    loading,
    onAction,
    onNext,
    onPrevious,
    onRetry,
    regionLabel,
    statusLabels,
  }) => {
    const copy = { ...defaultLabels, ...labels };
    const hasPager =
      hasNext !== undefined || hasPrevious !== undefined || Boolean(onNext) || Boolean(onPrevious);
    const columns = [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value: string) => <CodeList values={[value]} />,
        title: copy.payout,
      },
      { dataIndex: 'publisherName', key: 'publisherName', title: copy.publisher },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value: ModuleAppPayoutStatus) => (
          <Tag color={value === 'paid' ? 'green' : value === 'failed' ? 'red' : 'gold'}>
            {statusLabels?.[value] ?? value}
          </Tag>
        ),
        title: copy.status,
      },
      {
        key: 'amount',
        render: (_: unknown, row: ModuleAppPayoutRow) =>
          formatAdminAmount(row.totalAmount, row.currency),
        title: copy.amount,
      },
      { dataIndex: 'recipientMask', key: 'recipientMask', title: copy.recipient },
      {
        dataIndex: 'transactionNo',
        key: 'transactionNo',
        render: (value?: null | string) => <CodeList values={value ? [value] : []} />,
        title: copy.alipayTransaction,
      },
      {
        key: 'revenueEntryIds',
        render: (_: unknown, row: ModuleAppPayoutRow) => <CodeList values={row.revenueEntryIds} />,
        title: copy.revenue,
      },
      {
        key: 'auditEventIds',
        render: (_: unknown, row: ModuleAppPayoutRow) => <CodeList values={row.auditEventIds} />,
        title: copy.audit,
      },
      ...(canWrite && onAction
        ? [
            {
              key: 'actions',
              render: (_: unknown, row: ModuleAppPayoutRow) => (
                <Button aria-label={`${copy.manage} ${row.id}`} onClick={() => onAction(row)}>
                  {copy.manage}
                </Button>
              ),
              title: copy.action,
            },
          ]
        : []),
    ];
    return (
      <Flexbox gap={10}>
        <AdminTableState
          emptyLabel={copy.empty}
          error={error}
          loading={loading}
          loadingLabel={copy.loading}
          retryLabel={copy.retry}
          onRetry={onRetry}
        >
          {items.length ? (
            <AdminDataTable
              columns={columns as any}
              dataSource={items}
              regionLabel={regionLabel ?? copy.payout}
              rowKey="id"
              pager={
                hasPager
                  ? {
                      hasNext: Boolean(hasNext),
                      hasPrevious: Boolean(hasPrevious),
                      nextLabel: copy.next,
                      positionLabel,
                      previousLabel: copy.previous,
                      onNext: () => onNext?.(),
                      onPrevious: () => onPrevious?.(),
                    }
                  : undefined
              }
            />
          ) : null}
        </AdminTableState>
      </Flexbox>
    );
  },
);

PayoutTable.displayName = 'PayoutTable';

export default PayoutTable;
