'use client';

import type { PaymentMethodId, PaymentProvider } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Typography } from 'antd';
import { memo } from 'react';

import InlineTable from '@/components/InlineTable';

import { AdminTableState } from './AdminTableState';
import CursorPager from './CursorPager';
import { buildReconciliationColumns } from './reconciliationColumns';

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
  method: PaymentMethodId;
  orderId: string;
  orderStatus: string;
  outTradeNo: string;
  paymentEventIds: string[];
  paymentStatus: string;
  payoutBatchIds: string[];
  provider: PaymentProvider;
  providerTransactionId?: null | string;
  refundIds: string[];
  refundStatus?: null | string;
  revenueEntryIds: string[];
  totalAmount: string;
};

export type PaymentTableLabels = Partial<{
  acknowledge: string;
  action: string;
  amount: string;
  app: string;
  audit: string;
  commerce: string;
  empty: string;
  events: string;
  latestRun: string;
  loading: string;
  next: string;
  offlineRefund: string;
  order: string;
  previous: string;
  providerTrade: string;
  paymentMethod: string;
  refund: string;
  resolveRefund: string;
  retry: string;
  retryPayment: string;
  retryRefund: string;
  settle: string;
  status: string;
}>;

type PaymentTableProps = {
  canWrite?: boolean;
  error?: unknown;
  hasNext?: boolean;
  hasPrevious?: boolean;
  items?: ModuleAppPaymentDiagnosticRow[];
  labels?: PaymentTableLabels;
  loading?: boolean;
  onAcknowledge?: (discrepancyId: string) => void;
  onNext?: () => void;
  onOpenOfflineRefund?: (row: ModuleAppPaymentDiagnosticRow) => void;
  onOpenRefund?: (row: ModuleAppPaymentDiagnosticRow) => void;
  onOpenSettle?: (row: ModuleAppPaymentDiagnosticRow) => void;
  onPrevious?: () => void;
  onRetry?: () => void;
  onRetryPayment?: (outTradeNo: string, provider: PaymentProvider) => void;
  onRetryRefund?: (orderId: string) => void;
  onResolveRefund?: (orderId: string) => void;
  statusLabels?: Record<string, string>;
};

export const defaultLabels = {
  acknowledge: 'Acknowledge discrepancy',
  action: 'Actions',
  amount: 'Amount',
  app: 'App',
  audit: 'Audit',
  commerce: 'License / revenue / payout',
  empty: 'No payment records',
  events: 'Events',
  latestRun: 'Latest app run',
  loading: 'Loading payment records',
  next: 'Next page',
  offlineRefund: 'Record offline refund',
  order: 'Order',
  paymentMethod: 'Payment method',
  previous: 'Previous page',
  providerTrade: 'Provider trade',
  refund: 'Refund payment',
  resolveRefund: 'Verify pending refund',
  retry: 'Retry',
  retryPayment: 'Retry payment query',
  retryRefund: 'Retry refund status',
  settle: 'Settle order',
  status: 'Status',
};

export const IdList = ({ ids }: { ids: Array<null | string | undefined> }) => {
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

const PaymentReconciliationTable = memo<PaymentTableProps>(
  ({
    canWrite = false,
    error,
    hasNext,
    hasPrevious,
    items = [],
    labels,
    loading,
    onAcknowledge,
    onNext,
    onOpenOfflineRefund,
    onOpenRefund,
    onOpenSettle,
    onPrevious,
    onRetry,
    onRetryPayment,
    onRetryRefund,
    onResolveRefund,
    statusLabels,
  }) => {
    const copy = { ...defaultLabels, ...labels };
    const hasPager =
      hasNext !== undefined || hasPrevious !== undefined || Boolean(onNext) || Boolean(onPrevious);
    const columns = buildReconciliationColumns({
      canWrite,
      copy,
      handlers: {
        onAcknowledge,
        onOpenOfflineRefund,
        onOpenRefund,
        onOpenSettle,
        onRetryPayment,
        onRetryRefund,
        onResolveRefund,
      },
      statusLabels,
    });

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
            <InlineTable columns={columns as any} dataSource={items} rowKey="id" />
          ) : null}
        </AdminTableState>
        {hasPager ? (
          <CursorPager
            hasNext={hasNext}
            hasPrevious={hasPrevious}
            nextLabel={copy.next}
            previousLabel={copy.previous}
            onNext={onNext}
            onPrevious={onPrevious}
          />
        ) : null}
      </Flexbox>
    );
  },
);

PaymentReconciliationTable.displayName = 'PaymentReconciliationTable';

export default PaymentReconciliationTable;
