'use client';

import { Button, Modal } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { advanceCursor, retreatCursor, setFilter } from '../shared/queryState';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import ModulePageState from '../shared/ModulePageState';
import type { AdminModuleAppPackageRow } from '../types';

import { packageColumns } from './packageColumns';

const styles = createStaticStyles(({ css, cssVar }) => ({
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

type PackageListResponse = { items: AdminModuleAppPackageRow[]; nextCursor: null | string };
type ReviewAction = 'approve' | 'reject' | 'rescan';

const ModuleReviewsPage = memo(() => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [action, setAction] = useState<ReviewAction>();
  const [actionError, setActionError] = useState<string>();
  const [actionTarget, setActionTarget] = useState<AdminModuleAppPackageRow>();
  const [actionComplete, setActionComplete] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reviewStatus = searchParams.get('reviewStatus') ?? undefined;
  const buildStatus = searchParams.get('buildStatus') ?? undefined;
  const appId = searchParams.get('appId') ?? undefined;
  const publisherId = searchParams.get('publisherId') ?? undefined;
  const submittedByUserId = searchParams.get('submittedByUserId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const filters = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('cursor');
    next.delete('previousCursor');
    return next.toString();
  }, [searchParams]);
  const listKey = moduleAppCacheKeys.packages(filters, cursor);
  const { data, error, isLoading } = useClientDataSWR<PackageListResponse>(
    listKey,
    () =>
      adminCommercialService.moduleApps.listPackages({
        appId,
        buildStatus: buildStatus as 'building' | 'failed' | 'queued' | 'ready' | undefined,
        cursor,
        limit: 25,
        publisherId,
        reviewStatus,
        submittedByUserId,
      }) as Promise<PackageListResponse>,
  );
  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      'reviewStatus',
      'buildStatus',
      'appId',
      'publisherId',
      'submittedByUserId',
      'cursor',
      'previousCursor',
    ].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const isFiltered = Boolean(
    reviewStatus || buildStatus || appId || publisherId || submittedByUserId || cursor,
  );
  const openAction = (nextAction: ReviewAction, target: AdminModuleAppPackageRow) => {
    setAction(nextAction);
    setActionComplete(false);
    setActionError(undefined);
    setActionTarget(target);
    setRejectReason('');
  };
  const closeAction = () => {
    if (submitting) return;
    setAction(undefined);
    setActionTarget(undefined);
  };
  const submitAction = async () => {
    if (!action || !actionTarget || (action === 'reject' && !rejectReason.trim())) return;
    setSubmitting(true);
    setActionError(undefined);
    try {
      if (action === 'approve') {
        await adminCommercialService.moduleApps.approvePackage({ packageId: actionTarget.id });
        await mutate(listKey);
        if (actionTarget.appId) await mutate(moduleAppCacheKeys.detail(actionTarget.appId));
        await mutate(
          (key) => Array.isArray(key) && key[0] === 'admin-module-apps' && key[1] === 'apps',
          undefined,
          { revalidate: true },
        );
      } else if (action === 'reject') {
        await adminCommercialService.moduleApps.rejectPackage({
          packageId: actionTarget.id,
          reason: rejectReason.trim(),
        });
        await mutate(listKey);
      } else {
        await adminCommercialService.moduleApps.rescanPackage({ packageId: actionTarget.id });
        await mutate(listKey);
      }
      setActionComplete(true);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('moduleApps.admin.reviews.actionError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.page} data-testid="module-reviews-page">
      <header>
        <h1>{t('moduleApps.admin.reviews.title')}</h1>
        <p>{t('moduleApps.admin.reviews.description')}</p>
      </header>
      <div className={styles.controls}>
        <label>
          {t('moduleApps.admin.reviews.filters.reviewStatus')}
          <select
            value={reviewStatus ?? ''}
            onChange={(event) => updateFilter('reviewStatus', event.target.value)}
          >
            <option value="">{t('moduleApps.admin.reviews.filters.all')}</option>
            <option value="pending_review">
              {t('moduleApps.admin.reviews.status.pendingReview')}
            </option>
            <option value="approved">{t('moduleApps.admin.reviews.status.approved')}</option>
            <option value="rejected">{t('moduleApps.admin.reviews.status.rejected')}</option>
          </select>
        </label>
        <label>
          {t('moduleApps.admin.reviews.filters.buildStatus')}
          <select
            value={buildStatus ?? ''}
            onChange={(event) => updateFilter('buildStatus', event.target.value)}
          >
            <option value="">{t('moduleApps.admin.reviews.filters.all')}</option>
            <option value="queued">{t('moduleApps.admin.reviews.buildStatus.queued')}</option>
            <option value="building">{t('moduleApps.admin.reviews.buildStatus.building')}</option>
            <option value="ready">{t('moduleApps.admin.reviews.buildStatus.ready')}</option>
            <option value="failed">{t('moduleApps.admin.reviews.buildStatus.failed')}</option>
          </select>
        </label>
        <label>
          {t('moduleApps.admin.reviews.filters.appId')}
          <input
            value={appId ?? ''}
            onChange={(event) => updateFilter('appId', event.target.value)}
          />
        </label>
        <label>
          {t('moduleApps.admin.reviews.filters.publisherId')}
          <input
            value={publisherId ?? ''}
            onChange={(event) => updateFilter('publisherId', event.target.value)}
          />
        </label>
        <label>
          {t('moduleApps.admin.reviews.filters.submittedByUserId')}
          <input
            value={submittedByUserId ?? ''}
            onChange={(event) => updateFilter('submittedByUserId', event.target.value)}
          />
        </label>
      </div>
      <ModulePageState
        error={error}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        emptyKind={isFiltered ? 'filtered' : 'initial'}
        loading={isLoading}
        onClearFilters={clearFilters}
      >
        <div>
          <table className={styles.table}>
            <thead>
              <tr>
                {packageColumns.map((column) => (
                  <th key={column.title}>{t(column.title)}</th>
                ))}
                <th>{t('moduleApps.admin.reviews.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr key={item.id}>
                  {packageColumns.map((column) => (
                    <td key={column.title}>{column.render?.(item)}</td>
                  ))}
                  <td>
                    <div className={styles.controls}>
                      <Button
                        disabled={
                          item.reviewStatus !== 'pending_review' || item.scanStatus !== 'clean'
                        }
                        onClick={() => openAction('approve', item)}
                      >
                        {t('moduleApps.admin.reviews.approve')}
                      </Button>
                      {item.reviewStatus === 'pending_review' && item.scanStatus !== 'clean' ? (
                        <Button onClick={() => openAction('rescan', item)}>
                          {t('moduleApps.admin.reviews.rescan')}
                        </Button>
                      ) : null}
                      <Button
                        disabled={item.reviewStatus !== 'pending_review'}
                        onClick={() => openAction('reject', item)}
                      >
                        {t('moduleApps.admin.reviews.reject')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.controls}>
            <Button
              disabled={!searchParams.getAll('previousCursor').length}
              onClick={() => setSearchParams(retreatCursor(searchParams))}
            >
              {t('moduleApps.admin.reviews.previous')}
            </Button>
            <Button
              disabled={!data?.nextCursor}
              onClick={() =>
                data?.nextCursor && setSearchParams(advanceCursor(searchParams, data.nextCursor))
              }
            >
              {t('moduleApps.admin.reviews.next')}
            </Button>
          </div>
        </div>
      </ModulePageState>
      <Modal
        cancelText={t('cancel')}
        confirmLoading={submitting}
        destroyOnHidden
        okButtonProps={{
          danger: action === 'reject',
          disabled: submitting || (action === 'reject' && !rejectReason.trim()),
        }}
        okText={
          action === 'reject'
            ? t('moduleApps.admin.reviews.confirmRejection')
            : t(`moduleApps.admin.reviews.${action}`)
        }
        open={Boolean(action)}
        title={action ? t(`moduleApps.admin.reviews.${action}`) : ''}
        onCancel={closeAction}
        onOk={actionComplete ? closeAction : submitAction}
      >
        {actionComplete ? <p>{t('moduleApps.admin.reviews.actionSuccess')}</p> : null}
        {action === 'reject' && !actionComplete ? (
          <label>
            {t('moduleApps.admin.reviews.rejectReason')}
            <textarea
              required
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </label>
        ) : null}
        {actionError ? <p role="alert">{actionError}</p> : null}
      </Modal>
    </section>
  );
});

ModuleReviewsPage.displayName = 'ModuleReviewsPage';

export default ModuleReviewsPage;
