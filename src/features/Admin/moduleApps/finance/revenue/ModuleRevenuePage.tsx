'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Input, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import CommerceTable, { type ModuleAppRevenueRow } from '../../CommerceTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import ModulePageState from '../../shared/ModulePageState';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';
import { useDebouncedFilter } from '../../shared/useDebouncedFilter';

const styles = createStaticStyles(({ css }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  page: css`
    display: grid;
    gap: 16px;
    max-width: 1180px;
  `,
}));

type RevenueListResponse = { items: ModuleAppRevenueRow[]; nextCursor: null | string };
type RevenueStatus = 'pending' | 'reversed' | 'settled';

const ModuleRevenuePage = memo<{ canWrite?: boolean }>(({ canWrite: canWriteOverride }) => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = canWriteOverride ?? hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const status = searchParams.get('status') ?? undefined;
  const appId = searchParams.get('appId') ?? undefined;
  const publisherId = searchParams.get('publisherId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const filters = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('cursor');
    next.delete('previousCursor');
    return next.toString();
  }, [searchParams]);
  const listKey = moduleAppCacheKeys.revenue(filters, cursor);
  const { data, error, isLoading } = useClientDataSWR<RevenueListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listRevenue({
        appId,
        cursor,
        limit: 25,
        publisherId,
        status: status as RevenueStatus | undefined,
      }) as Promise<RevenueListResponse>,
    // 翻页/筛选时保留上一页数据，避免整表骨架闪烁。
    { keepPreviousData: true },
  );
  // appId/publisherId 文本筛选防抖回写（粘贴 36 位 UUID 不再逐键触发请求）。
  const [appIdInput, setAppIdInput] = useDebouncedFilter('appId', appId ?? '');
  const [publisherIdInput, setPublisherIdInput] = useDebouncedFilter(
    'publisherId',
    publisherId ?? '',
  );
  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'appId', 'publisherId', 'cursor', 'previousCursor'].forEach((key) =>
      next.delete(key),
    );
    setSearchParams(next);
  };
  const isFiltered = Boolean(status || appId || publisherId || cursor);
  const settleRevenue = async (entryIds: string[]) => {
    try {
      await adminCommercialService.moduleApps.settleRevenueBatch({ entryIds });
      await mutate(listKey);
      toast.success(t('moduleApps.admin.revenue.settlementSuccess'));
    } catch {
      toast.error(t('moduleApps.admin.revenue.settlementError'));
      throw new Error(t('moduleApps.admin.revenue.settlementError'));
    }
  };
  const statusLabels = {
    pending: t('moduleApps.admin.finance.status.pending'),
    reversed: t('moduleApps.admin.finance.status.reversed'),
    settled: t('moduleApps.admin.finance.status.settled'),
  };

  return (
    <section className={styles.page} data-testid="module-revenue-page">
      <header>
        <h1>{t('moduleApps.admin.revenue.title')}</h1>
        <p>{t('moduleApps.admin.revenue.description')}</p>
      </header>
      <div className={styles.controls}>
        <label>
          {t('moduleApps.admin.revenue.filters.status')}
          <Select
            value={status ?? ''}
            options={[
              { label: t('moduleApps.admin.revenue.filters.all'), value: '' },
              { label: statusLabels.pending, value: 'pending' },
              { label: statusLabels.settled, value: 'settled' },
              { label: statusLabels.reversed, value: 'reversed' },
            ]}
            onChange={(value) => updateFilter('status', String(value ?? ''))}
          />
        </label>
        <label>
          {t('moduleApps.admin.revenue.filters.appId')}
          <Input
            maxLength={36}
            value={appIdInput}
            onChange={(event) => setAppIdInput(event.target.value)}
          />
        </label>
        <label>
          {t('moduleApps.admin.revenue.filters.publisherId')}
          <Input
            maxLength={36}
            value={publisherIdInput}
            onChange={(event) => setPublisherIdInput(event.target.value)}
          />
        </label>
      </div>
      <ModulePageState
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        error={error}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        loading={isLoading}
        loadingLabel={t('moduleApps.admin.revenue.loading')}
        retryLabel={t('moduleApps.admin.revenue.retry')}
        emptyDescription={t(
          isFiltered
            ? 'moduleApps.admin.revenue.filteredEmptyDescription'
            : 'moduleApps.admin.revenue.emptyDescription',
        )}
        emptyTitle={t(
          isFiltered
            ? 'moduleApps.admin.revenue.filteredEmptyTitle'
            : 'moduleApps.admin.revenue.emptyTitle',
        )}
        onClearFilters={clearFilters}
        onRetry={() => mutate(listKey)}
      >
        <div>
          <CommerceTable
            canWrite={canWrite}
            hasNext={Boolean(data?.nextCursor)}
            hasPrevious={Boolean(searchParams.getAll('previousCursor').length)}
            items={data?.items ?? []}
            regionLabel={t('moduleApps.admin.revenue.title')}
            statusLabels={statusLabels}
            labels={{
              cancel: t('cancel'),
              confirmDescription: t('moduleApps.admin.revenue.confirmDescription'),
              confirmSettlement: t('moduleApps.admin.revenue.confirmSettlement'),
              confirmTitle: t('moduleApps.admin.revenue.confirmTitle'),
              description: t('moduleApps.admin.revenue.tableDescription'),
              developer: t('moduleApps.admin.revenue.columns.developer'),
              gross: t('moduleApps.admin.revenue.columns.gross'),
              order: t('moduleApps.admin.revenue.columns.order'),
              platform: t('moduleApps.admin.revenue.platform'),
              platformFee: t('moduleApps.admin.revenue.columns.platformFee'),
              publisher: t('moduleApps.admin.revenue.columns.publisher'),
              reserve: t('moduleApps.admin.revenue.columns.reserve'),
              select: t('moduleApps.admin.revenue.select'),
              settle: t('moduleApps.admin.revenue.settle'),
              status: t('moduleApps.admin.revenue.columns.status'),
              type: t('moduleApps.admin.revenue.columns.type'),
            }}
            positionLabel={t('moduleApps.admin.revenue.pagePosition', {
              page: searchParams.getAll('previousCursor').length + 1,
            })}
            typeLabels={{
              accrual: t('moduleApps.admin.revenue.type.accrual'),
              reversal: t('moduleApps.admin.revenue.type.reversal'),
            }}
            onPrevious={() => setSearchParams(retreatCursor(searchParams))}
            onSettle={settleRevenue}
            onNext={() =>
              data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
            }
          />
        </div>
      </ModulePageState>
    </section>
  );
});

ModuleRevenuePage.displayName = 'ModuleRevenuePage';

export default ModuleRevenuePage;
