'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button } from '@lobehub/ui/base-ui';
import { RefreshCw } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { MODULE_ADMIN_ROUTE_PATHS } from '../navigation/catalog';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import {
  clearModuleDraft,
  createModuleDraftScope,
  loadModuleDraft,
  saveModuleDraft,
} from '../shared/draftStorage';
import ModulePageState from '../shared/ModulePageState';
import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import type { AdminModuleAppItem } from '../types';
import AppIdentityModal from './AppIdentityModal';
import { buildIdentityUpsertInput, type ModuleAppIdentityFormValues } from './identityForm';
import { ModuleAppsCreateButton, ModuleAppsFilterBar, ModuleAppsTable } from './moduleAppsDirectoryParts';
import { moduleAppsDirectoryStyles as styles } from './moduleAppsDirectoryStyles';

type ApplicationListResponse = { items: AdminModuleAppItem[]; nextCursor: null | string };
type ApplicationSort = 'catalog' | 'name_asc' | 'updated_desc';

const NEW_APP_IDENTITY_SCOPE = createModuleDraftScope('new', 'configuration');
const allowedSorts = new Set<ApplicationSort>(['catalog', 'name_asc', 'updated_desc']);

const ModuleAppsPage = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canReadPublishers = hasAdminCapability(role, ADMIN_CAPABILITIES.financeRead);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queryInput, setQueryInput] = useState(searchParams.get('q') ?? '');
  const [newIdentityDraft, setNewIdentityDraft] = useState<ModuleAppIdentityFormValues | null>(() =>
    loadModuleDraft<ModuleAppIdentityFormValues>(NEW_APP_IDENTITY_SCOPE),
  );

  const query = searchParams.get('q') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const publisherId = searchParams.get('publisherId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const sortValue = searchParams.get('sort');
  const sort = allowedSorts.has(sortValue as ApplicationSort)
    ? (sortValue as ApplicationSort)
    : undefined;
  const filters = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('cursor');
    params.delete('previousCursor');
    return params.toString();
  }, [searchParams]);
  const listKey = moduleAppCacheKeys.apps(filters, cursor);
  const { data, error, isLoading } = useClientDataSWR<ApplicationListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.list({
        category,
        cursor,
        limit: 25,
        publisherId,
        query,
        sort,
        status,
      }) as Promise<ApplicationListResponse>,
  );

  useEffect(() => setQueryInput(searchParams.get('q') ?? ''), [searchParams]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (queryInput.trim() === (searchParams.get('q') ?? '')) return;
      setSearchParams((current) => setFilter(current, 'q', queryInput.trim() || undefined));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [queryInput, searchParams, setSearchParams]);

  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const openApp = (appId: string) =>
    navigate(
      MODULE_ADMIN_ROUTE_PATHS['module-app-overview'].replace(':appId', encodeURIComponent(appId)),
    );
  const createApp = async (identity: ModuleAppIdentityFormValues) => {
    setSubmitting(true);
    try {
      const app = await adminCommercialService.moduleApps.upsert(
        buildIdentityUpsertInput(identity),
      );
      clearModuleDraft(NEW_APP_IDENTITY_SCOPE);
      setNewIdentityDraft(null);
      setIdentityOpen(false);
      await mutate(listKey);
      openApp(app.id);
    } finally {
      setSubmitting(false);
    }
  };
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['q', 'status', 'category', 'publisherId', 'sort', 'cursor', 'previousCursor'].forEach((key) =>
      next.delete(key),
    );
    setSearchParams(next);
  };
  const isFiltered = Boolean(query || status || category || publisherId || sort || cursor);

  return (
    <section className={styles.page} data-testid="module-app-directory">
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1>{t('moduleApps.admin.apps.title')}</h1>
          <p className={styles.description}>{t('moduleApps.admin.apps.description')}</p>
        </div>
        <div className={styles.actions}>
          <Button
            icon={RefreshCw}
            title={t('moduleApps.admin.apps.refresh')}
            onClick={() => mutate(listKey)}
          />
          <ModuleAppsCreateButton t={t as any} onClick={() => setIdentityOpen(true)} />
        </div>
      </header>
      <ModuleAppsFilterBar
        canReadPublishers={canReadPublishers}
        category={category}
        publisherId={publisherId}
        queryInput={queryInput}
        sort={sort}
        status={status}
        t={t as any}
        onQueryInput={setQueryInput}
        onUpdateFilter={updateFilter}
      />
      <ModulePageState
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        error={error}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        loading={isLoading}
        onClearFilters={clearFilters}
      >
        <div>
          <ModuleAppsTable items={data?.items ?? []} t={t as any} onOpen={openApp} />
          <div className={styles.pagination}>
            <Button
              disabled={!searchParams.getAll('previousCursor').length}
              onClick={() => setSearchParams(retreatCursor(searchParams))}
            >
              {t('moduleApps.admin.apps.previous')}
            </Button>
            <Button
              disabled={!data?.nextCursor}
              onClick={() =>
                data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
              }
            >
              {t('moduleApps.admin.apps.next')}
            </Button>
          </div>
        </div>
      </ModulePageState>
      <AppIdentityModal
        draft={newIdentityDraft}
        open={identityOpen}
        submitting={submitting}
        onCancel={() => setIdentityOpen(false)}
        onSubmit={createApp}
        onDraftChange={(draft) => {
          setNewIdentityDraft(draft);
          saveModuleDraft(NEW_APP_IDENTITY_SCOPE, draft);
        }}
      />
    </section>
  );
});

ModuleAppsPage.displayName = 'ModuleAppsPage';

export default ModuleAppsPage;
