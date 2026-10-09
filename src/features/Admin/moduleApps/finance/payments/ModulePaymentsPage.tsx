'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button } from '@lobehub/ui/base-ui';
import { Download, RefreshCw } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import PendingRefundResolutionModal from '../../../payments/PendingRefundResolutionModal';
import CursorPager from '../../CursorPager';
import PaymentReconciliationTable, {
  type ModuleAppPaymentDiagnosticRow,
} from '../../PaymentReconciliationTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import ModulePageState from '../../shared/ModulePageState';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';

import { ModulePaymentFilters } from './ModulePaymentFilters';
import {
  buildModuleFinanceStatusLabels,
  buildPaymentReconciliationLabels,
  PaymentActionModal,
} from './PaymentActionModal';
import { useModulePaymentActions } from './useModulePaymentActions';
import {
  type DiscrepancyStatus,
  modulePaymentStyles as styles,
  type PaymentStatus,
  type RefundStatus,
} from './modulePaymentsShared';

type ModulePaymentsPageProps = { canWrite?: boolean; embedded?: boolean };

type PaymentListResponse = {
  items: ModuleAppPaymentDiagnosticRow[];
  nextCursor: null | string;
};

const ModulePaymentsPage = memo<ModulePaymentsPageProps>((props) => {
  const { canWrite: canWriteOverride, embedded = false } = props;
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = canWriteOverride ?? hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const paymentStatus = searchParams.get('paymentStatus') ?? undefined;
  const refundStatus = searchParams.get('refundStatus') ?? undefined;
  const discrepancyStatus = searchParams.get('discrepancyStatus') ?? undefined;
  const appId = searchParams.get('appId') ?? undefined;
  const orderId = searchParams.get('orderId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const filters = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('cursor');
    next.delete('previousCursor');
    return next.toString();
  }, [searchParams]);
  const listKey = moduleAppCacheKeys.payments(filters, cursor);
  const {
    action,
    actionError,
    actionIsValid,
    actionTarget,
    busyAction,
    closeAction,
    closeResolution,
    exportDiscrepancies,
    offlineRefundReference,
    openAction,
    openResolution,
    operationResult,
    paymentReference,
    reason,
    resolution,
    resolutionNote,
    runDirectAction,
    setOfflineRefundReference,
    setPaymentReference,
    setReason,
    setResolution,
    setResolutionNote,
    submitAction,
    submitResolution,
    submitting,
    resolutionTarget,
  } = useModulePaymentActions({
    cursor,
    discrepancyStatus,
    listKey,
    t: t as any,
  });
  const { data, error, isLoading } = useClientDataSWR<PaymentListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listPaymentDiagnostics({
        appId,
        cursor,
        discrepancyStatus: discrepancyStatus as DiscrepancyStatus | undefined,
        limit: 25,
        orderId,
        paymentStatus: paymentStatus as PaymentStatus | undefined,
        refundStatus: refundStatus as RefundStatus | undefined,
      }) as Promise<PaymentListResponse>,
  );
  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      'paymentStatus',
      'refundStatus',
      'discrepancyStatus',
      'appId',
      'orderId',
      'cursor',
      'previousCursor',
    ].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const isFiltered = Boolean(
    paymentStatus || refundStatus || discrepancyStatus || appId || orderId || cursor,
  );
  const reconciliationLabels = buildPaymentReconciliationLabels(t as any);
  const statusLabels = buildModuleFinanceStatusLabels(t as any);

  return (
    <section
      className={styles.page}
      data-testid="module-payments-page"
      style={embedded ? { maxWidth: 'none' } : undefined}
    >
      {!embedded ? (
        <header>
          <h1>{t('moduleApps.admin.payments.title')}</h1>
          <p>{t('moduleApps.admin.payments.description')}</p>
        </header>
      ) : null}
      <div className={styles.actions}>
        <Button
          disabled={busyAction === 'export'}
          icon={<Download aria-hidden size={16} />}
          onClick={exportDiscrepancies}
        >
          {t('moduleApps.admin.payments.exportDiscrepancies')}
        </Button>
        {canWrite ? (
          <Button
            disabled={Boolean(busyAction)}
            icon={<RefreshCw aria-hidden size={16} />}
            onClick={() =>
              runDirectAction('reconcile', () =>
                adminCommercialService.moduleApps.reconcilePendingPayments({ limit: 100 }),
              )
            }
          >
            {t('moduleApps.admin.payments.reconcilePending')}
          </Button>
        ) : null}
      </div>
      {operationResult ? <p role="status">{operationResult}</p> : null}
      <ModulePaymentFilters
        appId={appId}
        discrepancyStatus={discrepancyStatus}
        orderId={orderId}
        paymentStatus={paymentStatus}
        refundStatus={refundStatus}
        statusLabels={statusLabels}
        updateFilter={updateFilter}
        t={t as any}
      />
      <ModulePageState
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        error={error}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        loading={isLoading}
        loadingLabel={t('moduleApps.admin.payments.loading')}
        retryLabel={t('moduleApps.admin.payments.retry')}
        emptyDescription={t(
          isFiltered
            ? 'moduleApps.admin.payments.filteredEmptyDescription'
            : 'moduleApps.admin.payments.emptyDescription',
        )}
        emptyTitle={t(
          isFiltered
            ? 'moduleApps.admin.payments.filteredEmptyTitle'
            : 'moduleApps.admin.payments.emptyTitle',
        )}
        onClearFilters={clearFilters}
        onRetry={() => mutate(listKey)}
      >
        <div>
          <PaymentReconciliationTable
            canWrite={canWrite}
            items={data?.items ?? []}
            statusLabels={statusLabels}
            labels={reconciliationLabels}
            onOpenOfflineRefund={(row) => openAction('offlineRefund', row)}
            onOpenRefund={(row) => openAction('refund', row)}
            onOpenSettle={(row) => openAction('settle', row)}
            onAcknowledge={(discrepancyId) =>
              runDirectAction(`acknowledge:${discrepancyId}`, () =>
                adminCommercialService.moduleApps.acknowledgePaymentDiscrepancy({
                  discrepancyId,
                }),
              )
            }
            onResolveRefund={(targetOrderId) => {
              const target = data?.items.find((item) => item.orderId === targetOrderId);
              if (target) openResolution(target);
            }}
            onRetryPayment={(outTradeNo, provider) =>
              runDirectAction(`payment:${outTradeNo}`, () =>
                adminCommercialService.moduleApps.retryPaymentQuery({ outTradeNo, provider }),
              )
            }
            onRetryRefund={(targetOrderId) =>
              runDirectAction(`refund:${targetOrderId}`, () =>
                adminCommercialService.moduleApps.retryRefundStatus({ orderId: targetOrderId }),
              )
            }
          />
          <CursorPager
            hasNext={Boolean(data?.nextCursor)}
            hasPrevious={Boolean(searchParams.getAll('previousCursor').length)}
            nextLabel={t('moduleApps.admin.payments.next')}
            previousLabel={t('moduleApps.admin.payments.previous')}
            onPrevious={() => setSearchParams(retreatCursor(searchParams))}
            onNext={() =>
              data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
            }
          />
        </div>
      </ModulePageState>
      {canWrite ? (
        <PaymentActionModal
          action={action}
          actionError={actionError}
          actionIsValid={actionIsValid}
          offlineRefundReference={offlineRefundReference}
          onOfflineRefundReferenceChange={setOfflineRefundReference}
          onPaymentReferenceChange={setPaymentReference}
          onReasonChange={setReason}
          paymentReference={paymentReference}
          reason={reason}
          submitting={submitting}
          t={t as any}
          onCancel={closeAction}
          onOk={submitAction}
        />
      ) : null}
      <PendingRefundResolutionModal
        busy={busyAction?.startsWith('resolve:') ?? false}
        note={resolutionNote}
        open={Boolean(resolutionTarget)}
        resolution={resolution}
        title={t('moduleApps.admin.payments.manualResolution.title')}
        labels={{
          cancel: t('cancel'),
          chooseOutcome: t('moduleApps.admin.payments.manualResolution.chooseOutcome'),
          confirm: t('moduleApps.admin.payments.manualResolution.confirm'),
          description: t('moduleApps.admin.payments.manualResolution.description'),
          note: t('moduleApps.admin.payments.manualResolution.note'),
          notRefunded: t('moduleApps.admin.payments.manualResolution.notRefunded'),
          outcome: t('moduleApps.admin.payments.manualResolution.outcome'),
          refunded: t('moduleApps.admin.payments.manualResolution.refunded'),
        }}
        summary={
          resolutionTarget
            ? `${resolutionTarget.appName} · ${resolutionTarget.currency} ${resolutionTarget.totalAmount}`
            : ''
        }
        onCancel={closeResolution}
        onConfirm={submitResolution}
        onNoteChange={setResolutionNote}
        onResolutionChange={setResolution}
      />
    </section>
  );
});

ModulePaymentsPage.displayName = 'ModulePaymentsPage';

export default ModulePaymentsPage;
