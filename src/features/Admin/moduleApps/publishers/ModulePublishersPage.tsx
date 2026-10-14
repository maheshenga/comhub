'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Button, Input, Modal, Select, TextArea, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell } from '../../layout';
import PublisherTable, { type ModuleAppPublisherRow } from '../PublisherTable';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import { useDebouncedFilter } from '../shared/useDebouncedFilter';
import PublisherFormModal, { type PublisherFormValues } from './PublisherFormModal';
import { usePublisherGovernance } from './usePublisherGovernance';

const styles = createStaticStyles(({ css, cssVar }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  reasonHint: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    margin-top: 4px;
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
    // 翻页/筛选时保留上一页数据，避免整表骨架闪烁。
    { keepPreviousData: true },
  );
  // userId 文本筛选防抖回写（粘贴长 ID 不再逐键触发请求）；status 是 Select，即时回写。
  const [userIdInput, setUserIdInput] = useDebouncedFilter('userId', userId ?? '');
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

  const isEmptyState = !isLoading && !loadError && (data?.items.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.publishers.description')}
      testId="module-publishers-page"
      title={t('moduleApps.admin.publishers.title')}
      width="full"
      state={{
        emptyDescription: t(
          isFiltered
            ? 'moduleApps.admin.publishers.filteredEmptyDescription'
            : 'moduleApps.admin.publishers.emptyDescription',
        ),
        emptyKind: isFiltered ? 'filtered' : 'initial',
        emptyTitle: t(
          isFiltered
            ? 'moduleApps.admin.publishers.filteredEmptyTitle'
            : 'moduleApps.admin.publishers.emptyTitle',
        ),
        error: loadError,
        isEmpty: isEmptyState,
        loading: isLoading,
        onClearFilters: clearFilters,
        onRetry: () => mutate(listKey),
        retryLabel: t('moduleApps.admin.publishers.retry'),
      }}
    >
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
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
          />
        </label>
        {canWrite ? (
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            {t('moduleApps.admin.publishers.create')}
          </Button>
        ) : null}
      </div>
      {!isEmptyState && !loadError ? (
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
            suspensionReasonEmpty: t('moduleApps.admin.publishers.suspensionReasonEmpty'),
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
      ) : null}
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
          {governance.action === 'suspend' ? (
            <div>
              <label>
                {t('moduleApps.admin.publishers.suspensionReason')}
                <TextArea
                  maxLength={500}
                  placeholder={t('moduleApps.admin.publishers.suspensionReasonPlaceholder')}
                  value={governance.reason}
                  onChange={(event) => governance.setReason(event.target.value)}
                />
              </label>
              <p className={styles.reasonHint}>{t('moduleApps.admin.publishers.suspensionReasonHint')}</p>
            </div>
          ) : null}
          {governance.error ? <p role="alert">{governance.error}</p> : null}
        </Modal>
      ) : null}
    </AdminPageShell>
  );
});

ModulePublishersPage.displayName = 'ModulePublishersPage';

export default ModulePublishersPage;
