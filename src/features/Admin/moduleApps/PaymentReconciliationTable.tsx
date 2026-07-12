'use client';

import { Flexbox } from '@lobehub/ui';
import { Tag, Typography } from 'antd';
import { memo } from 'react';

import InlineTable from '@/components/InlineTable';

import { AdminTableState } from './AdminTableState';
import CursorPager from './CursorPager';

const { Text } = Typography;

export type ModuleAppPaymentDiagnosticRow = {
  appId: string;
  appName: string;
  auditEventIds: string[];
  createdAt?: Date | string;
  currency: string;
  discrepancyIds: string[];
  discrepancyStatus?: null | string;
  id: string;
  licenseIds: string[];
  latestAppRuntimeInvocationId?: null | string;
  orderId: string;
  orderStatus: string;
  outTradeNo: string;
  paymentEventIds: string[];
  paymentStatus: string;
  payoutBatchIds: string[];
  providerTransactionId?: null | string;
  refundIds: string[];
  refundStatus?: null | string;
  revenueEntryIds: string[];
  totalAmount: string;
};

const IdList = ({ ids }: { ids: Array<null | string | undefined> }) => {
  const values = ids.filter((id): id is string => Boolean(id));
  return values.length ? (
    <Flexbox gap={2} style={{ maxWidth: 220 }}>
      {values.map((id) => (
        <Text code copyable key={id} style={{ overflowWrap: 'anywhere' }}>
          {id}
        </Text>
      ))}
    </Flexbox>
  ) : (
    '-'
  );
};

const PaymentReconciliationTable = memo(
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
    items?: ModuleAppPaymentDiagnosticRow[];
    loading?: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    onRetry?: () => void;
  }) => {
    const columns = [
      { dataIndex: 'appName', key: 'appName', title: 'App' },
      {
        dataIndex: 'orderId',
        key: 'orderId',
        render: (value: string) => <IdList ids={[value]} />,
        title: 'Order',
      },
      {
        dataIndex: 'outTradeNo',
        key: 'outTradeNo',
        render: (value: string) => <IdList ids={[value]} />,
        title: 'Alipay trade',
      },
      {
        key: 'status',
        render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
          <Flexbox gap={4}>
            <Tag color={row.paymentStatus === 'paid' ? 'green' : 'gold'}>{row.paymentStatus}</Tag>
            {row.refundStatus && <Tag>{row.refundStatus}</Tag>}
            {row.discrepancyStatus && <Tag color="red">{row.discrepancyStatus}</Tag>}
          </Flexbox>
        ),
        title: 'Status',
      },
      {
        key: 'amount',
        render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) =>
          `${row.currency} ${row.totalAmount}`,
        title: 'Amount',
      },
      {
        key: 'paymentEventIds',
        render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
          <IdList ids={row.paymentEventIds} />
        ),
        title: 'Events',
      },
      {
        key: 'commerceIds',
        render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
          <IdList ids={[...row.licenseIds, ...row.revenueEntryIds, ...row.payoutBatchIds]} />
        ),
        title: 'License / revenue / payout',
      },
      {
        key: 'latestAppRuntimeInvocationId',
        render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
          <IdList ids={[row.latestAppRuntimeInvocationId]} />
        ),
        title: 'Latest app run',
      },
      {
        key: 'auditEventIds',
        render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
          <IdList ids={row.auditEventIds} />
        ),
        title: 'Audit',
      },
    ];

    return (
      <Flexbox gap={10}>
        <AdminTableState
          emptyLabel="No payment records"
          error={error}
          loading={loading}
          loadingLabel="Loading payment records"
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

PaymentReconciliationTable.displayName = 'PaymentReconciliationTable';

export default PaymentReconciliationTable;
