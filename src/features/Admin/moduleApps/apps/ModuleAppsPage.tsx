'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Plus, RefreshCw } from 'lucide-react';
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

const styles = createStaticStyles(({ css, cssVar }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  header: css`
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  `,
  page: css`
    display: grid;
    gap: 16px;
    max-width: 1180px;
    padding: 24px;
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      padding: 10px 8px;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      text-align: start;
    }
  `,
}));

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
        <div>
          <h1>{t('moduleApps.admin.apps.title')}</h1>
          <p>{t('moduleApps.admin.apps.description')}</p>
        </div>
        <div className={styles.controls}>
          <Button
            icon={RefreshCw}
            title={t('moduleApps.admin.apps.refresh')}
            onClick={() => mutate(listKey)}
          />
          <Button type="primary" onClick={() => setIdentityOpen(true)}>
            <Plus aria-hidden size={16} />
            {t('moduleApps.admin.apps.create')}
          </Button>
        </div>
      </header>
      <div className={styles.controls}>
        <label>
          {t('moduleApps.admin.apps.search')}
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} />
        </label>
        <label>
          {t('moduleApps.admin.apps.status.label')}
          <select
            value={status ?? ''}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="">{t('moduleApps.admin.apps.filters.all')}</option>
            <option value="draft">{t('moduleApps.admin.apps.status.draft')}</option>
            <option value="published">{t('moduleApps.admin.apps.status.published')}</option>
            <option value="unpublished">{t('moduleApps.admin.apps.status.unpublished')}</option>
          </select>
        </label>
        <label>
          {t('moduleApps.admin.apps.category')}
          <input
            value={category ?? ''}
            onChange={(event) => updateFilter('category', event.target.value)}
          />
        </label>
        <label>
          {t('moduleApps.admin.apps.sort')}
          <select value={sort ?? ''} onChange={(event) => updateFilter('sort', event.target.value)}>
            <option value="">{t('moduleApps.admin.apps.sort.catalog')}</option>
            <option value="name_asc">{t('moduleApps.admin.apps.sort.nameAsc')}</option>
            <option value="updated_desc">{t('moduleApps.admin.apps.sort.updatedDesc')}</option>
          </select>
        </label>
        {canReadPublishers ? (
          <label>
            {t('moduleApps.admin.apps.publisher')}
            <input
              value={publisherId ?? ''}
              onChange={(event) => updateFilter('publisherId', event.target.value)}
            />
          </label>
        ) : null}
      </div>
      <ModulePageState
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        error={error}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        loading={isLoading}
        onClearFilters={clearFilters}
      >
        <div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('moduleApps.admin.apps.identity.displayName')}</th>
                <th>{t('moduleApps.admin.apps.category')}</th>
                <th>{t('moduleApps.admin.apps.identity.status')}</th>
                <th>{t('moduleApps.admin.apps.identity.source')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((app) => (
                <tr key={app.id}>
                  <td>
                    <button type="button" onClick={() => openApp(app.id)}>
                      {app.displayName}
                    </button>
                  </td>
                  <td>{app.category}</td>
                  <td>{t(`moduleApps.admin.apps.status.${app.status}`)}</td>
                  <td>{t(`moduleApps.admin.apps.source.${app.source ?? 'admin'}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.controls}>
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
