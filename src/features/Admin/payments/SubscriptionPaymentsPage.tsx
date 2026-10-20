'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { toast } from '@lobehub/ui';
import type { TableProps } from 'antd';
import type * as React from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { formatAdminAmount } from '@/features/Admin/adminAmountUnits';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageError, AdminSection } from '../layout';
import { AdminDataTable } from '../shared';
import { PaymentFilterControls, PaymentRefundModal } from './paymentControls';
import { PaymentListHeader } from './paymentListHeader';
import {
  buildPaymentsPager,
  parseSearchParam,
  PAYMENT_STATUSES,
  PAYMENTS_PAGE_SIZE,
  paymentStyles as styles,
  type PendingReconciliationResponse,
  UUID_PATTERN,
} from './paymentsShared';
import type { PendingRefundResolution } from './PendingRefundResolutionModal';
import PendingRefundResolutionModal from './PendingRefundResolutionModal';
import type { SubscriptionPaymentRow as SubscriptionPaymentRowBase } from './subscriptionPaymentColumns';
import { buildSubscriptionPaymentColumns } from './subscriptionPaymentColumns';
import { useManualResolutionLabels } from './useManualResolutionLabels';
import { useRefundResolutionActions } from './useRefundResolutionActions';

type SubscriptionPaymentRow = SubscriptionPaymentRowBase;

type SubscriptionPaymentListResponse = {
  items: SubscriptionPaymentRow[];
  nextCursor: null | number;
};

const SubscriptionPaymentsPage = memo<{ canWrite?: boolean }>(({ canWrite: canWriteOverride }) => {
  const { t } = useTranslation('subscription');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = canWriteOverride ?? hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const manualResolutionLabels = useManualResolutionLabels();
  const cursorValue = Number(searchParams.get('cursor') ?? 0);
  const cursor = Number.isInteger(cursorValue) && cursorValue >= 0 ? cursorValue : 0;
  const orderIdParam = searchParams.get('orderId') ?? '';
  const orderId = UUID_PATTERN.test(orderIdParam) ? orderIdParam : '';
  const provider = parseSearchParam(searchParams.get('provider'), ['alipay', 'wechat_pay', 'zpay']);
  const status = parseSearchParam(searchParams.get('status'), PAYMENT_STATUSES);
  const userId = searchParams.get('userId') ?? '';
  const [orderDraft, setOrderDraft] = useState(orderIdParam);
  const [userDraft, setUserDraft] = useState(userId);
  const [filterError, setFilterError] = useState<string>();
  const [refundOrder, setRefundOrder] = useState<SubscriptionPaymentRow>();
  const [refundReason, setRefundReason] = useState('');
  const [resolutionOrder, setResolutionOrder] = useState<SubscriptionPaymentRow>();
  const [resolution, setResolution] = useState<PendingRefundResolution>();
  const [resolutionNote, setResolutionNote] = useState('');
  // M5 §5.2 批量退款入口（typed 确认；勾选 paid 订单后出现）。
  const [selectedRefundableIds, setSelectedRefundableIds] = useState<string[]>([]);

  useEffect(() => setOrderDraft(orderIdParam), [orderIdParam]);
  useEffect(() => setUserDraft(userId), [userId]);

  const swrKey = useMemo(
    () => ['admin-subscription-payments', cursor, orderId, provider, status, userId] as const,
    [cursor, orderId, provider, status, userId],
  );
  const { busyAction, closeRefund, closeResolution, runOperation, submitRefund, submitResolution } =
    useRefundResolutionActions({ swrKey, t: t as any });

  const { data, error, isLoading } = useClientDataSWR<SubscriptionPaymentListResponse>(
    swrKey,
    () =>
      adminCommercialService.listSubscriptionPayments({
        cursor,
        limit: PAYMENTS_PAGE_SIZE,
        orderId: orderId || undefined,
        provider: provider as any,
        status: status as any,
        userId: userId || undefined,
      }) as Promise<SubscriptionPaymentListResponse>,
    { keepPreviousData: true },
  );

  const updateParams = (updates: Record<string, null | string>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete('cursor');
      return next;
    });
  };

  const applyTextFilters = () => {
    const normalizedOrderId = orderDraft.trim();
    if (normalizedOrderId && !UUID_PATTERN.test(normalizedOrderId)) {
      setFilterError(t('admin.payments.topups.invalidOrderId', 'Enter a complete order UUID'));
      return;
    }
    setFilterError(undefined);
    updateParams({ orderId: normalizedOrderId || null, userId: userDraft.trim() || null });
  };

  const clearFilters = () => {
    setFilterError(undefined);
    setOrderDraft('');
    setUserDraft('');
    updateParams({ orderId: null, provider: null, status: null, userId: null });
  };
  const columns = buildSubscriptionPaymentColumns({
    busyAction,
    canWrite,
    onRefund: setRefundOrder,
    onResolveRefund: setResolutionOrder,
    runOperation,
    t: t as any,
  });

  return (
    <section className={styles.page} data-testid="subscription-payments-page">
      <PaymentListHeader
        busyReconciling={busyAction === 'pending'}
        canWrite={canWrite}
        i18nNamespace="subscriptions"
        selectedRefundCount={selectedRefundableIds.length}
        t={t as any}
        title={t('admin.payments.subscriptions.title', 'Plan payment transactions')}
        bulkRefund={{
          actionId: 'payment.subscriptionBulkRefund' as const, // 订阅域端点（非 topUpOrders）
          description: t(
            'admin.payments.subscriptions.bulkRefundDescription',
            'Requests provider refunds for the selected paid subscription payments. This is a typed-confirmation command: type the command ID to proceed. Each refund is audited with a shared batchCorrelationId.',
          ),
          onRun: (command: any) =>
            adminCommercialService.bulkRefundSubscriptionPayments(selectedRefundableIds, command),
          onSuccess: async () => {
            setSelectedRefundableIds([]);
            await mutate(swrKey);
          },
          title: t('admin.payments.subscriptions.bulkRefundTitle', {
            count: selectedRefundableIds.length,
            defaultValue: 'Batch refund {{count}} paid payments?',
          }),
        }}
        description={t(
          'admin.payments.subscriptions.description',
          'Review plan purchases, reconcile provider state, and process full refunds.',
        )}
        onRefresh={() => mutate(swrKey)}
        onReconcilePending={() =>
          runOperation(
            'pending',
            () =>
              adminCommercialService.reconcilePendingSubscriptionPayments(
                100,
              ) as Promise<PendingReconciliationResponse>,
            (result) => {
              if (result.failedCount > 0) {
                toast.warning(
                  t('admin.payments.subscriptions.reconcilePartial', {
                    defaultValue:
                      '{{failed}} of {{total}} payments could not be refreshed. Review the failed rows and retry.',
                    failed: result.failedCount,
                    total: result.count,
                  }),
                );
              } else {
                toast.success(
                  t('admin.payments.subscriptions.reconcileSuccess', 'Payment status refreshed'),
                );
              }
            },
          )
        }
      />

      <AdminSection>
        <PaymentFilterControls
          applyTextFilters={applyTextFilters}
          clearFilters={clearFilters}
          filterError={filterError}
          i18nNamespace="subscriptions"
          orderDraft={orderDraft}
          provider={provider}
          status={status}
          t={t as any}
          userDraft={userDraft}
          onOrderDraftChange={setOrderDraft}
          onProviderChange={(value) => updateParams({ provider: value })}
          onStatusChange={(value) => updateParams({ status: value })}
          onUserDraftChange={setUserDraft}
        />

        {error ? (
          <AdminPageError
            description={t(
              'admin.payments.subscriptions.loadFailed',
              'Unable to load plan payment transactions',
            )}
            onRetry={() => void mutate(swrKey)}
          />
        ) : null}
        <AdminDataTable
          columns={columns as TableProps['columns']}
          dataSource={data?.items ?? []}
          isEmpty={!isLoading && !error && (data?.items?.length ?? 0) === 0}
          loading={isLoading}
          rowKey="id"
          pager={buildPaymentsPager({
            cursor,
            label: t('admin.pagination.pagePosition', {
              defaultValue: '第 {{page}} 页',
              page: cursor / PAYMENTS_PAGE_SIZE + 1,
            }),
            nextCursor: data?.nextCursor,
            onCursorChange: (next) =>
              setSearchParams((current) => {
                const params = new URLSearchParams(current);
                if (next) params.set('cursor', String(next));
                else params.delete('cursor');
                return params;
              }),
          })}
          regionLabel={t(
            'admin.payments.subscriptions.tableLabel',
            'Plan payment transactions table',
          )}
          rowSelection={
            canWrite
              ? {
                  getCheckboxProps: (row: any) => ({
                    disabled: !(row.status === 'paid' && row.externalOrderId),
                  }),
                  onChange: (keys: React.Key[]) => setSelectedRefundableIds(keys.map(String)),
                  selectedRowKeys: selectedRefundableIds,
                }
              : undefined
          }
        />
      </AdminSection>
      <PaymentRefundModal
        busyRefunding={Boolean(busyAction?.startsWith('refund:'))}
        i18nNamespace="subscriptions"
        reason={refundReason}
        refundOrder={refundOrder}
        t={t as any}
        title={t('admin.payments.subscriptions.refundTitle', 'Refund plan payment')}
        onCancel={closeRefund}
        onReasonChange={setRefundReason}
        onOk={() => {
          if (refundOrder) void submitRefund(refundOrder, refundReason);
        }}
      />
      <PendingRefundResolutionModal
        busy={Boolean(busyAction?.startsWith('resolve:'))}
        labels={manualResolutionLabels}
        note={resolutionNote}
        open={Boolean(resolutionOrder)}
        resolution={resolution}
        title={t('admin.payments.subscriptions.manualResolution.title', 'Verify pending refund')}
        summary={
          resolutionOrder
            ? `${formatAdminAmount(resolutionOrder.amount, resolutionOrder.currency)} · ${resolutionOrder.displayName}`
            : ''
        }
        onCancel={closeResolution}
        onNoteChange={setResolutionNote}
        onResolutionChange={setResolution}
        onConfirm={() => {
          if (resolutionOrder && resolution)
            void submitResolution(resolutionOrder, resolution, resolutionNote);
        }}
      />
    </section>
  );
});

SubscriptionPaymentsPage.displayName = 'SubscriptionPaymentsPage';

export default SubscriptionPaymentsPage;
