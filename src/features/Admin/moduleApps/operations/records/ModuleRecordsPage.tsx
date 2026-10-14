'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell } from '../../../layout';
import CursorPager from '../../CursorPager';
import RecordsTable from '../../RecordsTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';
import type { ModuleAppRecordRow } from '../../types';
import ModuleAppFilter from '../ModuleAppFilter';

type ListResponse = { items?: ModuleAppRecordRow[]; nextCursor?: null | string };

const ModuleRecordsPage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('appId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const listKey = appId ? moduleAppCacheKeys.records(appId, cursor) : null;
  const { data, error, isLoading } = useClientDataSWR<ListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listRecords({
        appId: appId!,
        cursor,
        limit: 25,
      }) as Promise<ListResponse>,
    { keepPreviousData: true },
  );
  const isEmptyState = !isLoading && !error && (data?.items?.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.operations.records.description')}
      testId="module-records-page"
      title={t('moduleApps.admin.operations.records.title')}
      width="full"
      state={{
        emptyDescription: t(
          cursor
            ? 'moduleApps.admin.operations.filteredEmptyDescription'
            : 'moduleApps.admin.operations.emptyDescription',
        ),
        emptyKind: cursor ? 'filtered' : 'initial',
        emptyTitle: t(
          cursor
            ? 'moduleApps.admin.operations.filteredEmptyTitle'
            : 'moduleApps.admin.operations.emptyTitle',
        ),
        error,
        isEmpty: isEmptyState,
        loading: isLoading,
        onClearFilters: () => setSearchParams((current) => setFilter(current, 'cursor', undefined)),
        onRetry: () => listKey && mutate(listKey),
        retryLabel: t('moduleApps.admin.operations.retry'),
      }}
    >
      <ModuleAppFilter />
      {!appId ? (
        <p data-testid="module-operation-app-required">
          {t('moduleApps.admin.operations.selectAppDescription')}
        </p>
      ) : !isEmptyState && !error ? (
        <div>
          <RecordsTable
            items={data?.items}
            labels={{
              collection: t('moduleApps.admin.operations.records.columns.collection'),
              record: t('moduleApps.admin.operations.records.columns.record'),
              scope: t('moduleApps.admin.operations.records.columns.scope'),
              status: t('moduleApps.admin.operations.records.columns.status'),
              updated: t('moduleApps.admin.operations.records.columns.updated'),
            }}
          />
          <CursorPager
            hasNext={Boolean(data?.nextCursor)}
            hasPrevious={Boolean(searchParams.getAll('previousCursor').length)}
            nextLabel={t('moduleApps.admin.operations.next')}
            positionLabel={t('moduleApps.admin.operations.pagePosition', { page: searchParams.getAll('previousCursor').length + 1 })}
            previousLabel={t('moduleApps.admin.operations.previous')}
            onPrevious={() => setSearchParams(retreatCursor(searchParams))}
            onNext={() =>
              data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
            }
          />
        </div>
      ) : null}
    </AdminPageShell>
  );
});

ModuleRecordsPage.displayName = 'ModuleRecordsPage';

export default ModuleRecordsPage;
