'use client';

import type { ModuleAppPayoutStatus } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Tag, Typography } from 'antd';
import { memo } from 'react';

import InlineTable from '@/components/InlineTable';

import { AdminTableState } from './AdminTableState';
import CursorPager from './CursorPager';

const { Text } = Typography;

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

const CodeList = ({ values }: { values: string[] }) =>
  values.length ? (
    <Flexbox gap={2} style={{ maxWidth: 220 }}>
      {values.map((value) => (
        <Text code copyable key={value} style={{ overflowWrap: 'anywhere' }}>
          {value}
        </Text>
      ))}
    </Flexbox>
  ) : (
    '-'
  );

const PayoutTable = memo(
  ({
    error,
    hasNext,
    hasPrevious,
    items = [],
    loading,
    onNext,
    onPrevious,
    onRetry,
  }: {
    error?: unknown;
    hasNext?: boolean;
    hasPrevious?: boolean;
    items?: ModuleAppPayoutRow[];
    loading?: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    onRetry?: () => void;
  }) => {
    const columns = [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value: string) => <CodeList values={[value]} />,
        title: 'Payout',
      },
      { dataIndex: 'publisherName', key: 'publisherName', title: 'Publisher' },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value: ModuleAppPayoutStatus) => (
          <Tag color={value === 'paid' ? 'green' : value === 'failed' ? 'red' : 'gold'}>{value}</Tag>
        ),
        title: 'Status',
      },
      {
        key: 'amount',
        render: (_: unknown, row: ModuleAppPayoutRow) =>
          `${row.currency} ${Number(row.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 6 })}`,
        title: 'Amount',
      },
      { dataIndex: 'recipientMask', key: 'recipientMask', title: 'Recipient' },
      {
        dataIndex: 'transactionNo',
        key: 'transactionNo',
        render: (value?: null | string) => <CodeList values={value ? [value] : []} />,
        title: 'Alipay transaction',
      },
      {
        key: 'revenueEntryIds',
        render: (_: unknown, row: ModuleAppPayoutRow) => (
          <CodeList values={row.revenueEntryIds} />
        ),
        title: 'Revenue',
      },
      {
        key: 'auditEventIds',
        render: (_: unknown, row: ModuleAppPayoutRow) => <CodeList values={row.auditEventIds} />,
        title: 'Audit',
      },
    ];
    return (
      <Flexbox gap={10}>
        <AdminTableState
          emptyLabel="No payouts"
          error={error}
          loading={loading}
          loadingLabel="Loading payouts"
          onRetry={onRetry}
        >
          {items.length ? (
            <InlineTable columns={columns as any} dataSource={items} rowKey="id" />
          ) : null}
        </AdminTableState>
        <CursorPager
          hasNext={hasNext}
          hasPrevious={hasPrevious}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      </Flexbox>
    );
  },
);

PayoutTable.displayName = 'PayoutTable';

export default PayoutTable;
