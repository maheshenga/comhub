'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button, Modal } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import PublisherTable, { type ModuleAppPublisherRow } from '../PublisherTable';
import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import ModulePageState from '../shared/ModulePageState';

import PublisherFormModal, { type PublisherFormValues } from './PublisherFormModal';

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
type GovernanceAction = 'assign' | 'suspend' | 'verify';

const ModulePublishersPage = memo(() => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<GovernanceAction>();
  const [appId, setAppId] = useState('');
  const [error, setError] = useState<string>();
  const [selectedPublisher, setSelectedPublisher] = useState<ModuleAppPublisherRow>();
  const [submitting, setSubmitting] = useState(false);
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
      setCreateOpen(false);
      await mutate(listKey);
    } finally {
      setSubmitting(false);
    }
  };
  const openAction = (nextAction: GovernanceAction, publisher: ModuleAppPublisherRow) => {
    setAction(nextAction);
    setAppId('');
    setError(undefined);
    setSelectedPublisher(publisher);
  };
  const submitAction = async () => {
    if (!action || !selectedPublisher || (action === 'assign' && !appId.trim())) return;
    setSubmitting(true);
    setError(undefined);
    try {
      if (action === 'verify') {
        await adminCommercialService.moduleApps.verifyPublisher({
          publisherId: selectedPublisher.id,
          verificationMetadata: {},
        });
      } else if (action === 'suspend') {
        await adminCommercialService.moduleApps.suspendPublisher({
          publisherId: selectedPublisher.id,
        });
      } else {
        await adminCommercialService.moduleApps.assignPublisher({
          appId: appId.trim(),
          publisherId: selectedPublisher.id,
        });
        await Promise.all([
          mutate(moduleAppCacheKeys.detail(appId.trim())),
          mutate(
            (key) => Array.isArray(key) && key[0] === 'admin-module-apps' && key[1] === 'apps',
            undefined,
            { revalidate: true },
          ),
        ]);
      }
      await mutate(listKey);
      setAction(undefined);
      setSelectedPublisher(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('moduleApps.admin.publishers.actionError'),
      );
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
          <select
            value={status ?? ''}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="">{t('moduleApps.admin.publishers.filters.all')}</option>
            <option value="pending">{t('moduleApps.admin.publishers.status.pending')}</option>
            <option value="verified">{t('moduleApps.admin.publishers.status.verified')}</option>
            <option value="suspended">{t('moduleApps.admin.publishers.status.suspended')}</option>
          </select>
        </label>
        <label>
          {t('moduleApps.admin.publishers.filters.userId')}
          <input
            value={userId ?? ''}
            onChange={(event) => updateFilter('userId', event.target.value)}
          />
        </label>
        {canWrite ? (
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            {t('moduleApps.admin.publishers.create')}
          </Button>
        ) : null}
      </div>
      <ModulePageState
        error={loadError}
        isEmpty={!isLoading && !loadError && (data?.items.length ?? 0) === 0}
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        loading={isLoading}
        onClearFilters={clearFilters}
      >
        <div>
          <PublisherTable
            actionsTitle={t('moduleApps.admin.publishers.actions')}
            items={data?.items ?? []}
            renderActions={
              canWrite
                ? (publisher) => (
                    <div className={styles.controls}>
                      <Button onClick={() => openAction('verify', publisher)}>
                        {t('moduleApps.admin.publishers.verify')}
                      </Button>
                      <Button onClick={() => openAction('suspend', publisher)}>
                        {t('moduleApps.admin.publishers.suspend')}
                      </Button>
                      <Button onClick={() => openAction('assign', publisher)}>
                        {t('moduleApps.admin.publishers.assign')}
                      </Button>
                    </div>
                  )
                : undefined
            }
          />
          <div className={styles.controls}>
            <Button
              disabled={!searchParams.getAll('previousCursor').length}
              onClick={() => setSearchParams(retreatCursor(searchParams))}
            >
              {t('moduleApps.admin.publishers.previous')}
            </Button>
            <Button
              disabled={!data?.nextCursor}
              onClick={() =>
                data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
              }
            >
              {t('moduleApps.admin.publishers.next')}
            </Button>
          </div>
        </div>
      </ModulePageState>
      {canWrite ? (
        <PublisherFormModal
          open={createOpen}
          submitting={submitting}
          onCancel={() => setCreateOpen(false)}
          onSubmit={createPublisher}
        />
      ) : null}
      <Modal
        cancelText={t('cancel')}
        confirmLoading={submitting}
        destroyOnHidden
        okButtonProps={{ disabled: submitting || (action === 'assign' && !appId.trim()) }}
        okText={action ? t(`moduleApps.admin.publishers.${action}`) : ''}
        open={Boolean(action)}
        title={action ? t(`moduleApps.admin.publishers.${action}`) : ''}
        onCancel={() => !submitting && setAction(undefined)}
        onOk={submitAction}
      >
        {action === 'assign' ? (
          <label>
            {t('moduleApps.admin.publishers.appId')}
            <input value={appId} onChange={(event) => setAppId(event.target.value)} />
          </label>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </Modal>
    </section>
  );
});

ModulePublishersPage.displayName = 'ModulePublishersPage';

export default ModulePublishersPage;
