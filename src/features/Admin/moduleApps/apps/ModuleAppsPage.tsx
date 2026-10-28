'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button } from '@lobehub/ui';
import { RefreshCw } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell } from '../../layout';
import { MODULE_ADMIN_ROUTE_PATHS } from '../navigation/catalog';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import {
  clearModuleDraft,
  createModuleDraftScope,
  loadModuleDraft,
  saveModuleDraft,
} from '../shared/draftStorage';
import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import { useDebouncedFilter } from '../shared/useDebouncedFilter';
import type { AdminModuleAppItem } from '../types';
import AppIdentityModal from './AppIdentityModal';
import { buildIdentityUpsertInput, type ModuleAppIdentityFormValues } from './identityForm';
import {
  buildModuleAppsColumns,
  ModuleAppsCreateButton,
  ModuleAppsFilterBar,
  ModuleAppsTable,
} from './moduleAppsDirectoryParts';
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
  // 搜索/类目/发布商三个文本筛选统一走防抖回写（逐键直写 URL 会让粘贴
  // 36 位 UUID 打出 36 个请求）；状态/排序是 Select，仍即时回写。
  const [queryInput, setQueryInput] = useDebouncedFilter('q', query ?? '');
  const [categoryInput, setCategoryInput] = useDebouncedFilter('category', category ?? '');
  const [publisherIdInput, setPublisherIdInput] = useDebouncedFilter(
    'publisherId',
    publisherId ?? '',
  );
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
    // 翻页/筛选/搜索时保留上一页数据，避免整表骨架闪烁。
    { keepPreviousData: true },
  );

  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const openApp = useCallback(
    (appId: string) =>
      navigate(
        MODULE_ADMIN_ROUTE_PATHS['module-app-overview'].replace(
          ':appId',
          encodeURIComponent(appId),
        ),
      ),
    [navigate],
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
  const isEmptyState = !isLoading && !error && (data?.items.length ?? 0) === 0;
  const appColumns = useMemo(() => buildModuleAppsColumns(openApp, t as any), [openApp, t]);

  return (
    <AdminPageShell
      description={t('moduleApps.admin.apps.description')}
      testId="module-app-directory"
      title={t('moduleApps.admin.apps.title')}
      width="full"
      actions={
        <>
          <Button
            icon={RefreshCw}
            title={t('moduleApps.admin.apps.refresh')}
            onClick={() => mutate(listKey)}
          />
          <ModuleAppsCreateButton t={t as any} onClick={() => setIdentityOpen(true)} />
        </>
      }
      state={{
        emptyKind: isFiltered ? 'filtered' : 'initial',
        error,
        isEmpty: isEmptyState,
        loading: isLoading,
        onClearFilters: clearFilters,
      }}
    >
      <ModuleAppsFilterBar
        canReadPublishers={canReadPublishers}
        categoryInput={categoryInput}
        publisherIdInput={publisherIdInput}
        queryInput={queryInput}
        sort={sort}
        status={status}
        t={t as any}
        onCategoryInput={setCategoryInput}
        onPublisherInput={setPublisherIdInput}
        onQueryInput={setQueryInput}
        onUpdateFilter={updateFilter}
      />
      {!isEmptyState && !error ? (
        <div>
          <ModuleAppsTable
            columns={appColumns}
            items={data?.items ?? []}
            regionLabel={t('moduleApps.admin.apps.title')}
          />
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
      ) : null}
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
    </AdminPageShell>
  );
});

ModuleAppsPage.displayName = 'ModuleAppsPage';

export default ModuleAppsPage;
