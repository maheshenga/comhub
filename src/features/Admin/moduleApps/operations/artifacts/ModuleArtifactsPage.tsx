'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell } from '../../../layout';
import ArtifactsTable from '../../ArtifactsTable';
import CursorPager from '../../CursorPager';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';
import type { ModuleAppArtifactRow } from '../../types';
import ModuleAppFilter from '../ModuleAppFilter';

type ListResponse = { items?: ModuleAppArtifactRow[]; nextCursor?: null | string };

const ModuleArtifactsPage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('appId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const listKey = appId ? moduleAppCacheKeys.artifacts(appId, cursor) : null;
  const { data, error, isLoading } = useClientDataSWR<ListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listArtifacts({
        appId: appId!,
        cursor,
        limit: 25,
      }) as Promise<ListResponse>,
    { keepPreviousData: true },
  );
  const isEmptyState = !isLoading && !error && (data?.items?.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.operations.artifacts.description')}
      testId="module-artifacts-page"
      title={t('moduleApps.admin.operations.artifacts.title')}
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
          <ArtifactsTable
            items={data?.items}
            labels={{
              artifact: t('moduleApps.admin.operations.artifacts.columns.artifact'),
              file: t('moduleApps.admin.operations.artifacts.columns.file'),
              mime: t('moduleApps.admin.operations.artifacts.columns.mime'),
              scope: t('moduleApps.admin.operations.artifacts.columns.scope'),
              size: t('moduleApps.admin.operations.artifacts.columns.size'),
              storageKey: t('moduleApps.admin.operations.artifacts.columns.storageKey'),
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

ModuleArtifactsPage.displayName = 'ModuleArtifactsPage';

export default ModuleArtifactsPage;
