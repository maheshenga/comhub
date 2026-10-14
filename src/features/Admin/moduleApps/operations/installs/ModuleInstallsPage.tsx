'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell } from '../../../layout';
import CursorPager from '../../CursorPager';
import InstallsTable from '../../InstallsTable';
import { moduleAppCacheKeys } from '../../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../../shared/queryState';
import type { ModuleAppInstallRow } from '../../types';
import ModuleAppFilter from '../ModuleAppFilter';

type ListResponse = { items?: ModuleAppInstallRow[]; nextCursor?: null | string };

const ModuleInstallsPage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('appId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const listKey = appId ? moduleAppCacheKeys.installs(appId, cursor) : null;
  const { data, error, isLoading } = useClientDataSWR<ListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listInstalls({
        appId: appId!,
        cursor,
        limit: 25,
      }) as Promise<ListResponse>,
    { keepPreviousData: true },
  );
  const isEmptyState = !isLoading && !error && (data?.items?.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.operations.installs.description')}
      testId="module-installs-page"
      title={t('moduleApps.admin.operations.installs.title')}
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
          <InstallsTable
            items={data?.items}
            labels={{
              install: t('moduleApps.admin.operations.installs.columns.install'),
              installed: t('moduleApps.admin.operations.installs.columns.installed'),
              scope: t('moduleApps.admin.operations.installs.columns.scope'),
              status: t('moduleApps.admin.operations.installs.columns.status'),
              user: t('moduleApps.admin.operations.installs.columns.user'),
              workspace: t('moduleApps.admin.operations.installs.columns.workspace'),
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

ModuleInstallsPage.displayName = 'ModuleInstallsPage';

export default ModuleInstallsPage;
