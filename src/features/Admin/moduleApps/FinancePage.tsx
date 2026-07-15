'use client';

import type { ModuleAppPayoutStatus, ModuleAppPublisherStatus } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, message, Select, Tabs, Typography } from 'antd';
import { RefreshCwIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import CommerceTable, { type ModuleAppRevenueRow } from './CommerceTable';
import CursorPager from './CursorPager';
import PaymentReconciliationTable, {
  type ModuleAppPaymentDiagnosticRow,
} from './PaymentReconciliationTable';
import PayoutTable, { type ModuleAppPayoutRow } from './PayoutTable';
import PublisherTable, { type ModuleAppPublisherRow } from './PublisherTable';
import { useCursorPagination } from './useCursorPagination';

const { Text, Title } = Typography;
const ADMIN_PAGE_SIZE = 25;

type ListResponse<T> = {
  items?: T[];
  nextCursor?: null | number | string;
};

type RevenueStatusFilter = 'all' | 'pending' | 'reversed' | 'settled';
type PublisherStatusFilter = 'all' | ModuleAppPublisherStatus;
type PayoutStatusFilter = 'all' | ModuleAppPayoutStatus;
type PaymentStatusFilter = 'all' | 'created' | 'failed' | 'paid' | 'pending' | 'refunded';
type RefundStatusFilter = 'all' | 'failed' | 'requested' | 'succeeded';
type DiscrepancyStatusFilter = 'all' | 'open' | 'resolved';

const ModuleAppFinancePage = memo(() => {
  const { t } = useTranslation('common');
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<RevenueStatusFilter>('pending');
  const [publisherStatusFilter, setPublisherStatusFilter] = useState<PublisherStatusFilter>('all');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<PayoutStatusFilter>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all');
  const [refundStatusFilter, setRefundStatusFilter] = useState<RefundStatusFilter>('all');
  const [discrepancyStatusFilter, setDiscrepancyStatusFilter] =
    useState<DiscrepancyStatusFilter>('all');

  const revenuePager = useCursorPagination(revenueStatusFilter);
  const publisherPager = useCursorPagination(publisherStatusFilter);
  const payoutPager = useCursorPagination(payoutStatusFilter);
  const paymentPager = useCursorPagination(
    [paymentStatusFilter, refundStatusFilter, discrepancyStatusFilter].join(':'),
  );

  const revenueKey = useMemo(
    () => ['admin-module-app-revenue', revenueStatusFilter, revenuePager.cursor],
    [revenuePager.cursor, revenueStatusFilter],
  );
  const publishersKey = useMemo(
    () => ['admin-module-app-publishers', publisherStatusFilter, publisherPager.cursor],
    [publisherPager.cursor, publisherStatusFilter],
  );
  const payoutsKey = useMemo(
    () => ['admin-module-app-payouts', payoutStatusFilter, payoutPager.cursor],
    [payoutPager.cursor, payoutStatusFilter],
  );
  const paymentsKey = useMemo(
    () => [
      'admin-module-app-payments',
      paymentStatusFilter,
      refundStatusFilter,
      discrepancyStatusFilter,
      paymentPager.cursor,
    ],
    [discrepancyStatusFilter, paymentPager.cursor, paymentStatusFilter, refundStatusFilter],
  );

  const {
    data: revenueData,
    error: revenueError,
    isLoading: revenueLoading,
  } = useClientDataSWR(
    revenueKey,
    () =>
      adminCommercialService.moduleApps.listRevenue({
        cursor: revenuePager.cursor,
        limit: ADMIN_PAGE_SIZE,
        status: revenueStatusFilter === 'all' ? undefined : revenueStatusFilter,
      }) as Promise<ListResponse<ModuleAppRevenueRow>>,
  );
  const {
    data: publishersData,
    error: publishersError,
    isLoading: publishersLoading,
  } = useClientDataSWR(
    publishersKey,
    () =>
      adminCommercialService.moduleApps.listPublishers({
        cursor: publisherPager.cursor,
        limit: ADMIN_PAGE_SIZE,
        status: publisherStatusFilter === 'all' ? undefined : publisherStatusFilter,
      }) as Promise<ListResponse<ModuleAppPublisherRow>>,
  );
  const {
    data: payoutsData,
    error: payoutsError,
    isLoading: payoutsLoading,
  } = useClientDataSWR(
    payoutsKey,
    () =>
      adminCommercialService.moduleApps.listPayouts({
        cursor: payoutPager.cursor,
        limit: ADMIN_PAGE_SIZE,
        status: payoutStatusFilter === 'all' ? undefined : payoutStatusFilter,
      }) as Promise<ListResponse<ModuleAppPayoutRow>>,
  );
  const {
    data: paymentsData,
    error: paymentsError,
    isLoading: paymentsLoading,
  } = useClientDataSWR(
    paymentsKey,
    () =>
      adminCommercialService.moduleApps.listPaymentDiagnostics({
        cursor: paymentPager.cursor,
        discrepancyStatus: discrepancyStatusFilter === 'all' ? undefined : discrepancyStatusFilter,
        limit: ADMIN_PAGE_SIZE,
        paymentStatus: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
        refundStatus: refundStatusFilter === 'all' ? undefined : refundStatusFilter,
      }) as Promise<ListResponse<ModuleAppPaymentDiagnosticRow>>,
  );

  const revenueStatusOptions = useMemo(
    () => [
      { label: t('moduleApps.admin.finance.filters.allRevenue'), value: 'all' },
      { label: t('moduleApps.admin.finance.status.pending'), value: 'pending' },
      { label: t('moduleApps.admin.finance.status.settled'), value: 'settled' },
      { label: t('moduleApps.admin.finance.status.reversed'), value: 'reversed' },
    ],
    [t],
  );
  const publisherStatusOptions = useMemo(
    () => [
      { label: t('moduleApps.admin.finance.filters.allPublishers'), value: 'all' },
      { label: t('moduleApps.admin.finance.status.pending'), value: 'pending' },
      { label: t('moduleApps.admin.finance.status.verified'), value: 'verified' },
      { label: t('moduleApps.admin.finance.status.suspended'), value: 'suspended' },
    ],
    [t],
  );
  const payoutStatusOptions = useMemo(
    () => [
      { label: t('moduleApps.admin.finance.filters.allPayouts'), value: 'all' },
      { label: t('moduleApps.admin.finance.status.pending'), value: 'pending' },
      { label: t('moduleApps.admin.finance.status.eligible'), value: 'eligible' },
      { label: t('moduleApps.admin.finance.status.processing'), value: 'processing' },
      { label: t('moduleApps.admin.finance.status.paid'), value: 'paid' },
      { label: t('moduleApps.admin.finance.status.failed'), value: 'failed' },
      { label: t('moduleApps.admin.finance.status.reversed'), value: 'reversed' },
    ],
    [t],
  );
  const paymentStatusOptions = useMemo(
    () => [
      { label: t('moduleApps.admin.finance.filters.allPayments'), value: 'all' },
      { label: t('moduleApps.admin.finance.status.created'), value: 'created' },
      { label: t('moduleApps.admin.finance.status.pending'), value: 'pending' },
      { label: t('moduleApps.admin.finance.status.paid'), value: 'paid' },
      { label: t('moduleApps.admin.finance.status.failed'), value: 'failed' },
      { label: t('moduleApps.admin.finance.status.refunded'), value: 'refunded' },
    ],
    [t],
  );
  const refundStatusOptions = useMemo(
    () => [
      { label: t('moduleApps.admin.finance.filters.allRefunds'), value: 'all' },
      { label: t('moduleApps.admin.finance.status.requested'), value: 'requested' },
      { label: t('moduleApps.admin.finance.status.succeeded'), value: 'succeeded' },
      { label: t('moduleApps.admin.finance.status.failed'), value: 'failed' },
    ],
    [t],
  );
  const discrepancyStatusOptions = useMemo(
    () => [
      { label: t('moduleApps.admin.finance.filters.allDiscrepancies'), value: 'all' },
      { label: t('moduleApps.admin.finance.status.open'), value: 'open' },
      { label: t('moduleApps.admin.finance.status.resolved'), value: 'resolved' },
    ],
    [t],
  );

  const refreshFinanceData = async () => {
    try {
      await Promise.all([
        mutate(revenueKey),
        mutate(paymentsKey),
        mutate(publishersKey),
        mutate(payoutsKey),
      ]);
      message.success(t('moduleApps.admin.finance.refreshSuccess'));
    } catch {
      message.error(t('moduleApps.admin.finance.refreshError'));
    }
  };

  const settleRevenue = async (entryIds: string[]) => {
    try {
      await adminCommercialService.moduleApps.settleRevenueBatch({ entryIds });
      await mutate(revenueKey);
      message.success(t('moduleApps.admin.finance.settlementSuccess'));
    } catch {
      message.error(t('moduleApps.admin.finance.settlementError'));
    }
  };

  const tabItems = [
    {
      children: (
        <Flexbox gap={12}>
          <Flexbox horizontal justify="flex-end">
            <Select<RevenueStatusFilter>
              options={revenueStatusOptions}
              style={{ width: 160 }}
              value={revenueStatusFilter}
              onChange={setRevenueStatusFilter}
            />
          </Flexbox>
          <CommerceTable
            items={revenueData?.items ?? []}
            loading={revenueLoading}
            onSettle={settleRevenue}
          />
          {revenueError ? (
            <Text type="danger">{t('moduleApps.admin.finance.loadError')}</Text>
          ) : null}
          <CursorPager
            hasNext={Boolean(revenueData?.nextCursor)}
            hasPrevious={revenuePager.hasPrevious}
            onNext={() => revenuePager.next(revenueData?.nextCursor)}
            onPrevious={revenuePager.previous}
          />
        </Flexbox>
      ),
      key: 'revenue',
      label: t('moduleApps.admin.finance.tabs.revenue'),
    },
    {
      children: (
        <Flexbox gap={12}>
          <Flexbox horizontal gap={8} justify="flex-end" wrap="wrap">
            <Select<PaymentStatusFilter>
              options={paymentStatusOptions}
              style={{ width: 160 }}
              value={paymentStatusFilter}
              onChange={setPaymentStatusFilter}
            />
            <Select<RefundStatusFilter>
              options={refundStatusOptions}
              style={{ width: 160 }}
              value={refundStatusFilter}
              onChange={setRefundStatusFilter}
            />
            <Select<DiscrepancyStatusFilter>
              options={discrepancyStatusOptions}
              style={{ width: 180 }}
              value={discrepancyStatusFilter}
              onChange={setDiscrepancyStatusFilter}
            />
          </Flexbox>
          <PaymentReconciliationTable
            error={paymentsError}
            hasNext={Boolean(paymentsData?.nextCursor)}
            hasPrevious={paymentPager.hasPrevious}
            items={paymentsData?.items ?? []}
            loading={paymentsLoading}
            onNext={() => paymentPager.next(paymentsData?.nextCursor)}
            onPrevious={paymentPager.previous}
            onRetry={() => mutate(paymentsKey)}
          />
        </Flexbox>
      ),
      key: 'payments',
      label: t('moduleApps.admin.finance.tabs.payments'),
    },
    {
      children: (
        <Flexbox gap={12}>
          <Flexbox horizontal justify="flex-end">
            <Select<PublisherStatusFilter>
              options={publisherStatusOptions}
              style={{ width: 170 }}
              value={publisherStatusFilter}
              onChange={setPublisherStatusFilter}
            />
          </Flexbox>
          <PublisherTable
            error={publishersError}
            hasNext={Boolean(publishersData?.nextCursor)}
            hasPrevious={publisherPager.hasPrevious}
            items={publishersData?.items ?? []}
            loading={publishersLoading}
            onNext={() => publisherPager.next(publishersData?.nextCursor)}
            onPrevious={publisherPager.previous}
            onRetry={() => mutate(publishersKey)}
          />
        </Flexbox>
      ),
      key: 'publishers',
      label: t('moduleApps.admin.finance.tabs.publishers'),
    },
    {
      children: (
        <Flexbox gap={12}>
          <Flexbox horizontal justify="flex-end">
            <Select<PayoutStatusFilter>
              options={payoutStatusOptions}
              style={{ width: 170 }}
              value={payoutStatusFilter}
              onChange={setPayoutStatusFilter}
            />
          </Flexbox>
          <PayoutTable
            error={payoutsError}
            hasNext={Boolean(payoutsData?.nextCursor)}
            hasPrevious={payoutPager.hasPrevious}
            items={payoutsData?.items ?? []}
            loading={payoutsLoading}
            onNext={() => payoutPager.next(payoutsData?.nextCursor)}
            onPrevious={payoutPager.previous}
            onRetry={() => mutate(payoutsKey)}
          />
        </Flexbox>
      ),
      key: 'payouts',
      label: t('moduleApps.admin.finance.tabs.payouts'),
    },
  ];

  return (
    <Flexbox data-testid="module-app-finance-page" gap={16} padding={24} style={{ maxWidth: 1180 }}>
      <Flexbox horizontal align="center" gap={16} justify="space-between">
        <Flexbox gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            {t('moduleApps.admin.finance.title')}
          </Title>
          <Text type="secondary">{t('moduleApps.admin.finance.description')}</Text>
        </Flexbox>
        <Button icon={<RefreshCwIcon size={16} />} onClick={refreshFinanceData}>
          {t('moduleApps.admin.finance.refresh')}
        </Button>
      </Flexbox>

      <Tabs items={tabItems} />
    </Flexbox>
  );
});

ModuleAppFinancePage.displayName = 'ModuleAppFinancePage';

export default ModuleAppFinancePage;
