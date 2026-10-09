'use client';

import type * as React from 'react';
import type { TableProps } from 'antd';
import { Alert, Space } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button, toast } from '@lobehub/ui/base-ui';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import type { PendingRefundResolution } from './PendingRefundResolutionModal';
import PendingRefundResolutionModal from './PendingRefundResolutionModal';
import { buildSubscriptionPaymentColumns } from './subscriptionPaymentColumns';
import type { SubscriptionPaymentRow as SubscriptionPaymentRowBase } from './subscriptionPaymentColumns';
import { PaymentFilterControls, PaymentRefundModal } from './paymentControls';
import { PaymentListHeader } from './paymentListHeader';
import { useManualResolutionLabels } from './useManualResolutionLabels';
import { useRefundResolutionActions } from './useRefundResolutionActions';
import {
  parseSearchParam,
  PAYMENT_STATUSES,
  type PendingReconciliationResponse,
  paymentStyles as styles,
  UUID_PATTERN,
} from './paymentsShared';

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
        limit: 25,
        orderId: orderId || undefined,
        provider: provider as any,
        status: status as any,
        userId: userId || undefined,
      }) as Promise<SubscriptionPaymentListResponse>,
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
        description={t(
          'admin.payments.subscriptions.description',
          'Review plan purchases, reconcile provider state, and process full refunds.',
        )}
        title={t('admin.payments.subscriptions.title', 'Plan payment transactions')}
        i18nNamespace='subscriptions'
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
        selectedRefundCount={selectedRefundableIds.length}
        bulkRefund={{
          description: t(
            'admin.payments.subscriptions.bulkRefundDescription',
            'Requests provider refunds for the selected paid subscription payments. This is a typed-confirmation command: type the command ID to proceed. Each refund is audited with a shared batchCorrelationId.',
          ),
          onRun: (command: any) =>
            adminCommercialService.bulkRefundTopUpPayments(selectedRefundableIds, command),
          onSuccess: async () => {
            setSelectedRefundableIds([]);
            await mutate(swrKey);
          },
          title: t('admin.payments.subscriptions.bulkRefundTitle', {
            count: selectedRefundableIds.length,
            defaultValue: 'Batch refund {{count}} paid payments?',
          }),
        }}
        t={t as any}
      />

      <PaymentFilterControls
        applyTextFilters={applyTextFilters}
        clearFilters={clearFilters}
        filterError={filterError}
        orderDraft={orderDraft}
        provider={provider}
        status={status}
        userDraft={userDraft}
        onOrderDraftChange={setOrderDraft}
        onProviderChange={(value) => updateParams({ provider: value })}
        onStatusChange={(value) => updateParams({ status: value })}
        onUserDraftChange={setUserDraft}
        i18nNamespace='subscriptions'
        t={t as any}
      />

      {error ? (
        <Alert
          showIcon
          type="error"
          message={t(
            'admin.payments.subscriptions.loadFailed',
            'Unable to load plan payment transactions',
          )}
        />
      ) : null}
      <InlineTable
        columns={columns as TableProps['columns']}
        dataSource={data?.items ?? []}
        loading={isLoading}
        rowKey="id"
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
      {(cursor > 0 || data?.nextCursor != null) && (
        <Space>
          <Button
            disabled={cursor === 0}
            onClick={() =>
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                const previous = Math.max(0, cursor - 25);
                if (previous) next.set('cursor', String(previous));
                else next.delete('cursor');
                return next;
              })
            }
          >
            {t('admin.pagination.previous', 'Previous')}
          </Button>
          <Button
            disabled={data?.nextCursor == null}
            onClick={() =>
              data?.nextCursor != null &&
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set('cursor', String(data.nextCursor));
                return next;
              })
            }
          >
            {t('admin.pagination.next', 'Next')}
          </Button>
        </Space>
      )}
      <PaymentRefundModal
        busyRefunding={Boolean(busyAction?.startsWith('refund:'))}
        reason={refundReason}
        refundOrder={refundOrder}
        title={t('admin.payments.subscriptions.refundTitle', 'Refund plan payment')}
        onCancel={closeRefund}
        onOk={() => {
          if (refundOrder) void submitRefund(refundOrder, refundReason);
        }}
        onReasonChange={setRefundReason}
        i18nNamespace='subscriptions'
        t={t as any}
      />
      <PendingRefundResolutionModal
        busy={Boolean(busyAction?.startsWith('resolve:'))}
        note={resolutionNote}
        open={Boolean(resolutionOrder)}
        resolution={resolution}
        title={t('admin.payments.subscriptions.manualResolution.title', 'Verify pending refund')}
        labels={manualResolutionLabels}
        summary={
          resolutionOrder
            ? `${resolutionOrder.currency} ${resolutionOrder.amount} · ${resolutionOrder.displayName}`
            : ''
        }
        onCancel={closeResolution}
        onConfirm={() => {
          if (resolutionOrder && resolution) void submitResolution(resolutionOrder, resolution, resolutionNote);
        }}
        onNoteChange={setResolutionNote}
        onResolutionChange={setResolution}
      />
    </section>
  );
});

SubscriptionPaymentsPage.displayName = 'SubscriptionPaymentsPage';

export default SubscriptionPaymentsPage;
