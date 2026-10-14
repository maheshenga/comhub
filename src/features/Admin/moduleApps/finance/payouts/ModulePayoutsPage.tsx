'use client';

import {
  ADMIN_CAPABILITIES,
  hasAdminCapability,
  type ModuleAppPayoutStatus,
} from '@lobechat/types';
import { Button, Input, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Plus } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell } from '../../../layout';
import PayoutTable, { type ModuleAppPayoutRow } from '../../PayoutTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';
import PayoutActionModal from './PayoutActionModal';

const styles = createStaticStyles(({ css }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
}));

type PayoutListResponse = { items: ModuleAppPayoutRow[]; nextCursor: null | string };
type PayoutModalMode = 'create' | 'manage';

const ModulePayoutsPage = memo<{ canWrite?: boolean }>(({ canWrite: canWriteOverride }) => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = canWriteOverride ?? hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const [modalMode, setModalMode] = useState<PayoutModalMode>();
  const [selectedPayout, setSelectedPayout] = useState<ModuleAppPayoutRow>();
  const status = searchParams.get('status') ?? undefined;
  const publisherId = searchParams.get('publisherId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const filters = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('cursor');
    next.delete('previousCursor');
    return next.toString();
  }, [searchParams]);
  const listKey = moduleAppCacheKeys.payouts(filters, cursor);
  const { data, error, isLoading } = useClientDataSWR<PayoutListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listPayouts({
        cursor,
        limit: 25,
        publisherId,
        status: status as ModuleAppPayoutStatus | undefined,
      }) as Promise<PayoutListResponse>,
    { keepPreviousData: true },
  );
  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'publisherId', 'cursor', 'previousCursor'].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const closeModal = () => {
    setModalMode(undefined);
    setSelectedPayout(undefined);
  };
  const mutationSucceeded = async () => {
    await mutate(listKey);
    // 提现是资金写动作，提交后弹窗直接关闭会让管理员拿不到受理确认；同工作面
    // 的 revenue/payments 都有 toast，这里补齐。
    toast.success(t('moduleApps.admin.payouts.actionSuccess'));
    closeModal();
  };
  const isFiltered = Boolean(status || publisherId || cursor);
  const statusValues = ['pending', 'eligible', 'processing', 'paid', 'failed', 'reversed'] as const;
  const statusLabels = {
    eligible: t('moduleApps.admin.finance.status.eligible'),
    failed: t('moduleApps.admin.finance.status.failed'),
    paid: t('moduleApps.admin.finance.status.paid'),
    pending: t('moduleApps.admin.finance.status.pending'),
    processing: t('moduleApps.admin.finance.status.processing'),
    reversed: t('moduleApps.admin.finance.status.reversed'),
  };
  const isEmptyState = !isLoading && !error && (data?.items.length ?? 0) === 0;

  const content = (
    <>
      {canWrite ? (
        <div className={styles.controls}>
          <Button
            icon={<Plus aria-hidden size={16} />}
            type="primary"
            onClick={() => setModalMode('create' as const)}
          >
            {t('moduleApps.admin.payouts.create')}
          </Button>
        </div>
      ) : null}
      <div className={styles.controls}>
        <label>
          {t('moduleApps.admin.payouts.filters.status')}
          <Select
            value={status ?? ''}
            options={[
              { label: t('moduleApps.admin.payouts.filters.all'), value: '' },
              ...statusValues.map((value) => ({ label: statusLabels[value], value })),
            ]}
            onChange={(value) => updateFilter('status', String(value ?? ''))}
          />
        </label>
        <label>
          {t('moduleApps.admin.payouts.filters.publisherId')}
          <Input
            maxLength={36}
            value={publisherId ?? ''}
            onChange={(event) => updateFilter('publisherId', event.target.value)}
          />
        </label>
      </div>
      {!isEmptyState && !error ? (
        <div>
          <PayoutTable
            canWrite={canWrite}
            hasNext={Boolean(data?.nextCursor)}
            hasPrevious={Boolean(searchParams.getAll('previousCursor').length)}
            items={data?.items ?? []}
            statusLabels={statusLabels}
            labels={{
              action: t('moduleApps.admin.payouts.columns.actions'),
              alipayTransaction: t('moduleApps.admin.payouts.columns.alipayTransaction'),
              amount: t('moduleApps.admin.payouts.columns.amount'),
              audit: t('moduleApps.admin.payouts.columns.audit'),
              manage: t('moduleApps.admin.payouts.manage'),
              payout: t('moduleApps.admin.payouts.columns.payout'),
              publisher: t('moduleApps.admin.payouts.columns.publisher'),
              recipient: t('moduleApps.admin.payouts.columns.recipient'),
              revenue: t('moduleApps.admin.payouts.columns.revenue'),
              status: t('moduleApps.admin.payouts.columns.status'),
            }}
            positionLabel={t('moduleApps.admin.payouts.pagePosition', {
              page: searchParams.getAll('previousCursor').length + 1,
            })}
            onPrevious={() => setSearchParams(retreatCursor(searchParams))}
            onAction={(row) => {
              setSelectedPayout(row);
              setModalMode('manage');
            }}
            onNext={() =>
              data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
            }
          />
        </div>
      ) : null}
      {canWrite && modalMode ? (
        <PayoutActionModal
          open
          mode={modalMode}
          payout={selectedPayout}
          onClose={closeModal}
          onSuccess={mutationSucceeded}
        />
      ) : null}
    </>
  );

  return (
    <AdminPageShell
      description={t('moduleApps.admin.payouts.description')}
      testId="module-payouts-page"
      title={t('moduleApps.admin.payouts.title')}
      width="full"
      state={{
        emptyDescription: t(
          isFiltered
            ? 'moduleApps.admin.payouts.filteredEmptyDescription'
            : 'moduleApps.admin.payouts.emptyDescription',
        ),
        emptyKind: isFiltered ? 'filtered' : 'initial',
        emptyTitle: t(
          isFiltered
            ? 'moduleApps.admin.payouts.filteredEmptyTitle'
            : 'moduleApps.admin.payouts.emptyTitle',
        ),
        error,
        isEmpty: isEmptyState,
        loading: isLoading,
        onClearFilters: clearFilters,
        onRetry: () => mutate(listKey),
        retryLabel: t('moduleApps.admin.payouts.retry'),
      }}
    >
      {content}
    </AdminPageShell>
  );
});

ModulePayoutsPage.displayName = 'ModulePayoutsPage';

export default ModulePayoutsPage;
