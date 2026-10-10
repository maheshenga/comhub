'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button, Input, Modal, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import PublisherTable, { type ModuleAppPublisherRow } from '../PublisherTable';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import ModulePageState from '../shared/ModulePageState';
import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import PublisherFormModal, { type PublisherFormValues } from './PublisherFormModal';
import { usePublisherGovernance } from './usePublisherGovernance';

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

type PublisherListResponse = { items: ModuleAppPublisherRow[]; nextCursor: null | string };

const ModulePublishersPage = memo(() => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const governance = usePublisherGovernance({ t: t as any });
  const status = searchParams.get('status') ?? undefined;
  const userId = searchParams.get('userId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const filters = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('cursor');
    next.delete('previousCursor');
    return next.toString();
  }, [searchParams]);
  const listKey = moduleAppCacheKeys.publishers(filters, cursor);
  const {
    data,
    error: loadError,
    isLoading,
  } = useClientDataSWR<PublisherListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listPublishers({
        cursor,
        limit: 25,
        status: status as 'pending' | 'suspended' | 'verified' | undefined,
        userId,
      }) as Promise<PublisherListResponse>,
  );
  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'userId', 'cursor', 'previousCursor'].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const isFiltered = Boolean(status || userId || cursor);
  const createPublisher = async (values: PublisherFormValues) => {
    setSubmitting(true);
    try {
      await adminCommercialService.moduleApps.createPublisher(values);
      await mutate(listKey);
      toast.success(t('moduleApps.admin.publishers.createSuccess'));
      setCreateOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.page} data-testid="module-publishers-page">
      <header>
        <h1>{t('moduleApps.admin.publishers.title')}</h1>
        <p>{t('moduleApps.admin.publishers.description')}</p>
      </header>
      <div className={styles.controls}>
        <label>
          {t('moduleApps.admin.publishers.filters.status')}
          <Select
            value={status ?? ''}
            options={[
              { label: t('moduleApps.admin.publishers.filters.all'), value: '' },
              { label: t('moduleApps.admin.publishers.status.pending'), value: 'pending' },
              { label: t('moduleApps.admin.publishers.status.verified'), value: 'verified' },
              { label: t('moduleApps.admin.publishers.status.suspended'), value: 'suspended' },
            ]}
            onChange={(value) => updateFilter('status', String(value ?? ''))}
          />
        </label>
        <label>
          {t('moduleApps.admin.publishers.filters.userId')}
          <Input
            maxLength={255}
            value={userId ?? ''}
            onChange={(event) => updateFilter('userId', event.target.value)}
          />
        </label>
        {canWrite && (data?.items.length ?? 0) > 0 ? (
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            {t('moduleApps.admin.publishers.create')}
          </Button>
        ) : null}
      </div>
      <ModulePageState
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        error={loadError}
        isEmpty={!isLoading && !loadError && (data?.items.length ?? 0) === 0}
        loading={isLoading}
        loadingLabel={t('moduleApps.admin.publishers.loading')}
        retryLabel={t('moduleApps.admin.publishers.retry')}
        emptyDescription={t(
          isFiltered
            ? 'moduleApps.admin.publishers.filteredEmptyDescription'
            : 'moduleApps.admin.publishers.emptyDescription',
        )}
        emptyTitle={t(
          isFiltered
            ? 'moduleApps.admin.publishers.filteredEmptyTitle'
            : 'moduleApps.admin.publishers.emptyTitle',
        )}
        primaryAction={
          !isFiltered && canWrite
            ? {
                label: t('moduleApps.admin.publishers.create'),
                onClick: () => setCreateOpen(true),
              }
            : undefined
        }
        onClearFilters={clearFilters}
        onRetry={() => mutate(listKey)}
      >
        <PublisherTable
          showPager
          actionsTitle={t('moduleApps.admin.publishers.actions')}
          hasNext={Boolean(data?.nextCursor)}
          hasPrevious={Boolean(searchParams.getAll('previousCursor').length)}
          items={data?.items ?? []}
          labels={{
            columns: {
              apps: t('moduleApps.admin.publishers.columns.apps'),
              id: t('moduleApps.admin.publishers.columns.id'),
              owner: t('moduleApps.admin.publishers.columns.owner'),
              publisher: t('moduleApps.admin.publishers.columns.publisher'),
              recipient: t('moduleApps.admin.publishers.columns.recipient'),
              status: t('moduleApps.admin.publishers.columns.status'),
            },
            empty: t('moduleApps.admin.publishers.emptyTitle'),
            loading: t('moduleApps.admin.publishers.loading'),
            next: t('moduleApps.admin.publishers.next'),
            previous: t('moduleApps.admin.publishers.previous'),
            retry: t('moduleApps.admin.publishers.retry'),
            status: {
              pending: t('moduleApps.admin.publishers.status.pending'),
              suspended: t('moduleApps.admin.publishers.status.suspended'),
              verified: t('moduleApps.admin.publishers.status.verified'),
            },
          }}
          renderActions={
            canWrite
              ? (publisher) => (
                  <div className={styles.controls}>
                    <Button onClick={() => governance.openAction('verify', publisher)}>
                      {t('moduleApps.admin.publishers.verify')}
                    </Button>
                    <Button onClick={() => governance.openAction('suspend', publisher)}>
                      {t('moduleApps.admin.publishers.suspend')}
                    </Button>
                    <Button onClick={() => governance.openAction('assign', publisher)}>
                      {t('moduleApps.admin.publishers.assign')}
                    </Button>
                  </div>
                )
              : undefined
          }
          onPrevious={() => setSearchParams(retreatCursor(searchParams))}
          onNext={() =>
            data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
          }
        />
      </ModulePageState>
      {canWrite ? (
        <PublisherFormModal
          open={createOpen}
          submitting={submitting}
          onCancel={() => setCreateOpen(false)}
          onSubmit={createPublisher}
        />
      ) : null}
      {canWrite ? (
        <Modal
          destroyOnHidden
          cancelText={t('cancel')}
          confirmLoading={governance.submitting}
          okText={governance.action ? t(`moduleApps.admin.publishers.${governance.action}`) : ''}
          open={Boolean(governance.action)}
          title={governance.action ? t(`moduleApps.admin.publishers.${governance.action}`) : ''}
          okButtonProps={{
            disabled: governance.submitting || (governance.action === 'assign' && !governance.appIdIsValid),
          }}
          onCancel={governance.closeAction}
          onOk={governance.submitAction}
        >
          {governance.action === 'assign' ? (
            <label>
              {t('moduleApps.admin.publishers.appId')}
              <Input
                maxLength={36}
                value={governance.appId}
                onChange={(event) => governance.setAppId(event.target.value)}
              />
            </label>
          ) : null}
          {governance.action === 'assign' && governance.appId && !governance.appIdIsValid ? (
            <p role="alert">{t('moduleApps.admin.publishers.appIdError')}</p>
          ) : null}
          {governance.error ? <p role="alert">{governance.error}</p> : null}
        </Modal>
      ) : null}
    </section>
  );
});

ModulePublishersPage.displayName = 'ModulePublishersPage';

export default ModulePublishersPage;
