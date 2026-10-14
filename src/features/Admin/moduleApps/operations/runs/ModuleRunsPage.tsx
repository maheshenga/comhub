'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell } from '../../../layout';
import CursorPager from '../../CursorPager';
import RunsTable from '../../RunsTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';
import type { ModuleAppRunRow } from '../../types';
import ModuleAppFilter from '../ModuleAppFilter';

type ListResponse = { items?: ModuleAppRunRow[]; nextCursor?: null | string };

const ModuleRunsPage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('appId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const listKey = appId ? moduleAppCacheKeys.runs(appId, cursor) : null;
  const { data, error, isLoading } = useClientDataSWR<ListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listRuns({
        appId: appId!,
        cursor,
        limit: 25,
      }) as Promise<ListResponse>,
    { keepPreviousData: true },
  );
  const isEmptyState = !isLoading && !error && (data?.items?.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.operations.runs.description')}
      testId="module-runs-page"
      title={t('moduleApps.admin.operations.runs.title')}
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
          <RunsTable
            items={data?.items}
            labels={{
              action: t('moduleApps.admin.operations.runs.columns.action'),
              created: t('moduleApps.admin.operations.runs.columns.created'),
              duration: t('moduleApps.admin.operations.runs.columns.duration'),
              error: t('moduleApps.admin.operations.runs.columns.error'),
              run: t('moduleApps.admin.operations.runs.columns.run'),
              status: t('moduleApps.admin.operations.runs.columns.status'),
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

ModuleRunsPage.displayName = 'ModuleRunsPage';

export default ModuleRunsPage;
