'use client';

import type { PaymentProvider } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Tag } from '@lobehub/ui/base-ui';
import { Typography } from 'antd';

import type { ModuleAppPaymentDiagnosticRow } from './PaymentReconciliationTable';
import { IdList } from './PaymentReconciliationTable';

const { Text } = Typography;

type ReconciliationCopy = Record<string, string | undefined>;

type ReconciliationHandlers = {
  onAcknowledge?: (discrepancyId: string) => void;
  onOpenOfflineRefund?: (row: ModuleAppPaymentDiagnosticRow) => void;
  onOpenRefund?: (row: ModuleAppPaymentDiagnosticRow) => void;
  onOpenSettle?: (row: ModuleAppPaymentDiagnosticRow) => void;
  onRetryPayment?: (outTradeNo: string, provider: PaymentProvider) => void;
  onRetryRefund?: (orderId: string) => void;
  onResolveRefund?: (orderId: string) => void;
};

/** 对账表格列定义 builder（M5 拆页：从 PaymentReconciliationTable 抽出）。 */
export const buildReconciliationColumns = ({
  canWrite,
  copy,
  handlers,
  statusLabels,
}: {
  canWrite: boolean;
  copy: ReconciliationCopy;
  handlers: ReconciliationHandlers;
  statusLabels?: Record<string, string>;
}) => [
  { dataIndex: 'appName', key: 'appName', title: copy.app },
  {
    dataIndex: 'orderId',
    key: 'orderId',
    render: (value: string) => <IdList ids={[value]} />,
    title: copy.order,
  },
  {
    key: 'paymentMethod',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
      <Flexbox gap={2}>
        <Tag>{row.method}</Tag>
        <Text type="secondary">{row.provider}</Text>
      </Flexbox>
    ),
    title: copy.paymentMethod,
  },
  {
    dataIndex: 'outTradeNo',
    key: 'outTradeNo',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
      <IdList ids={[row.outTradeNo, row.providerTransactionId]} />
    ),
    title: copy.providerTrade,
  },
  {
    key: 'status',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
      <Flexbox gap={4}>
        <Tag color={row.paymentStatus === 'paid' ? 'green' : 'gold'}>
          {statusLabels?.[row.paymentStatus] ?? row.paymentStatus}
        </Tag>
        {row.refundStatus ? (
          <Tag>{statusLabels?.[row.refundStatus] ?? row.refundStatus}</Tag>
        ) : null}
        {row.discrepancyStatus ? (
          <Tag color="red">{statusLabels?.[row.discrepancyStatus] ?? row.discrepancyStatus}</Tag>
        ) : null}
      </Flexbox>
    ),
    title: copy.status,
  },
  {
    key: 'amount',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => `${row.currency} ${row.totalAmount}`,
    title: copy.amount,
  },
  {
    key: 'paymentEventIds',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => <IdList ids={row.paymentEventIds} />,
    title: copy.events,
  },
  {
    key: 'commerceIds',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
      <IdList ids={[...row.licenseIds, ...row.revenueEntryIds, ...row.payoutBatchIds]} />
    ),
    title: copy.commerce,
  },
  {
    key: 'latestAppRuntimeInvocationId',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
      <IdList ids={[row.latestAppRuntimeInvocationId]} />
    ),
    title: copy.latestRun,
  },
  {
    key: 'auditEventIds',
    render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => <IdList ids={row.auditEventIds} />,
    title: copy.audit,
  },
  ...(canWrite ? [buildActionsColumn(copy, handlers)] : []),
];

const buildActionsColumn = (copy: ReconciliationCopy, handlers: ReconciliationHandlers) => ({
  key: 'actions',
  render: (_: unknown, row: ModuleAppPaymentDiagnosticRow) => (
    <Flexbox horizontal gap={6} wrap="wrap">
      {row.discrepancyStatus === 'open' && row.discrepancyIds[0] && handlers.onAcknowledge ? (
        <Button onClick={() => handlers.onAcknowledge?.(row.discrepancyIds[0])}>
          {copy.acknowledge}
        </Button>
      ) : null}
      {row.outTradeNo && handlers.onRetryPayment ? (
        <Button onClick={() => handlers.onRetryPayment?.(row.outTradeNo, row.provider)}>
          {copy.retryPayment}
        </Button>
      ) : null}
      {row.orderId &&
      row.paymentStatus === 'paid' &&
      row.refundStatus !== 'requested' &&
      row.refundStatus !== 'succeeded' &&
      handlers.onOpenRefund ? (
        <Button onClick={() => handlers.onOpenRefund?.(row)}>{copy.refund}</Button>
      ) : null}
      {row.orderId &&
      row.paymentStatus === 'paid' &&
      row.refundStatus !== 'requested' &&
      row.refundStatus !== 'succeeded' &&
      handlers.onOpenOfflineRefund ? (
        <Button onClick={() => handlers.onOpenOfflineRefund?.(row)}>{copy.offlineRefund}</Button>
      ) : null}
      {row.orderId &&
      row.refundStatus &&
      (row.provider !== 'zpay' || row.refundStatus !== 'requested') &&
      handlers.onRetryRefund ? (
        <Button onClick={() => handlers.onRetryRefund?.(row.orderId)}>{copy.retryRefund}</Button>
      ) : null}
      {row.orderId &&
      row.provider === 'zpay' &&
      row.refundStatus === 'requested' &&
      handlers.onResolveRefund ? (
        <Button onClick={() => handlers.onResolveRefund?.(row.orderId)}>
          {copy.resolveRefund}
        </Button>
      ) : null}
      {row.orderId && row.orderStatus !== 'paid' && handlers.onOpenSettle ? (
        <Button onClick={() => handlers.onOpenSettle?.(row)}>{copy.settle}</Button>
      ) : null}
    </Flexbox>
  ),
  title: copy.action,
});
