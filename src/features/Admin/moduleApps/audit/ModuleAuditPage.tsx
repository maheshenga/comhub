'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell } from '../../layout';
import AuditEventsTable from '../AuditEventsTable';
import CursorPager from '../CursorPager';
import ModuleAppFilter from '../operations/ModuleAppFilter';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import type { ModuleAppAuditRow } from '../types';

type ListResponse = { items?: ModuleAppAuditRow[]; nextCursor?: null | string };

const ModuleAuditPage = memo(() => {
  const { t: translate } = useTranslation('common');
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(key as any, options as any);
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('appId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const listKey = appId ? moduleAppCacheKeys.audit(appId, cursor) : null;
  const { data, error, isLoading } = useClientDataSWR<ListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listAuditEvents({
        appId: appId!,
        cursor,
        limit: 25,
      }) as Promise<ListResponse>,
    // 翻页时保留上一页数据，避免整表骨架闪烁。
    { keepPreviousData: true },
  );

  const isEmptyState = !isLoading && !error && (data?.items?.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.audit.description')}
      testId="module-audit-page"
      title={t('moduleApps.admin.audit.title')}
      width="full"
      state={
        appId
          ? {
              emptyDescription: t(
                cursor
                  ? 'moduleApps.admin.audit.filteredEmptyDescription'
                  : 'moduleApps.admin.audit.emptyDescription',
              ),
              emptyKind: cursor ? 'filtered' : 'initial',
              emptyTitle: t(
                cursor
                  ? 'moduleApps.admin.audit.filteredEmptyTitle'
                  : 'moduleApps.admin.audit.emptyTitle',
              ),
              error,
              isEmpty: isEmptyState,
              loading: isLoading,
              onClearFilters: () =>
                setSearchParams((current) => setFilter(current, 'cursor', undefined)),
              onRetry: () => listKey && mutate(listKey),
              retryLabel: t('moduleApps.admin.audit.retry'),
            }
          : undefined
      }
    >
      <ModuleAppFilter />
      {!appId ? (
        <p data-testid="module-audit-app-required">
          {t('moduleApps.admin.operations.selectAppDescription')}
        </p>
      ) : (
        !isEmptyState &&
        !error && (
          <div>
            <AuditEventsTable
              items={data?.items}
              labels={{
                actor: t('moduleApps.admin.audit.columns.actor'),
                audit: t('moduleApps.admin.audit.columns.audit'),
                created: t('moduleApps.admin.audit.columns.created'),
                event: t('moduleApps.admin.audit.columns.event'),
              }}
            />
            <CursorPager
              hasNext={Boolean(data?.nextCursor)}
              hasPrevious={Boolean(searchParams.getAll('previousCursor').length)}
              nextLabel={t('moduleApps.admin.audit.next')}
              positionLabel={t('moduleApps.admin.audit.pagePosition', { page: searchParams.getAll('previousCursor').length + 1 })}
              previousLabel={t('moduleApps.admin.audit.previous')}
              onPrevious={() => setSearchParams(retreatCursor(searchParams))}
              onNext={() =>
                data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
              }
            />
          </div>
        )
      )}
    </AdminPageShell>
  );
});

ModuleAuditPage.displayName = 'ModuleAuditPage';

export default ModuleAuditPage;
