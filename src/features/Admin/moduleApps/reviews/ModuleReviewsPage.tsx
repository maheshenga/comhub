'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Modal } from '@lobehub/ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminPageShell } from '../../layout';
import { moduleAppCacheKeys } from '../shared/cacheKeys';
import { setFilter } from '../shared/queryState';
import type { AdminModuleAppOutboundHostPurpose, AdminModuleAppPackageRow } from '../types';
import { getPackageColumns } from './packageColumns';
import { submitReviewAction } from './reviewActions';
import {
  OutboundHostClassification,
  RejectReasonField,
  ReviewFilters,
} from './reviewParts';
import { ReviewTable } from './reviewTable';
import { useReviewTextFilters } from './reviewTextFilters';

type PackageListResponse = { items: AdminModuleAppPackageRow[]; nextCursor: null | string };
type ReviewAction = 'approve' | 'reject' | 'rescan';

const REVIEW_ACTION_TRANSLATION_KEYS = {
  approve: 'moduleApps.admin.reviews.approve',
  reject: 'moduleApps.admin.reviews.reject',
  rescan: 'moduleApps.admin.reviews.rescan',
} as const satisfies Record<ReviewAction, string>;

const getOutboundHosts = (target?: AdminModuleAppPackageRow) => {
  const hosts = target?.manifestSnapshot?.runtime?.outboundHosts;
  if (!Array.isArray(hosts)) return [];

  return [...new Set(hosts.map((host) => host.trim().toLowerCase()).filter(Boolean))];
};

const ModuleReviewsPage = memo(() => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );
  const canWrite = hasAdminCapability(role, ADMIN_CAPABILITIES.moduleAppWrite);
  const packageColumns = getPackageColumns((key) => t(key));
  const [action, setAction] = useState<ReviewAction>();
  const [actionError, setActionError] = useState<string>();
  const [actionTarget, setActionTarget] = useState<AdminModuleAppPackageRow>();
  const [actionComplete, setActionComplete] = useState(false);
  const [outboundHostPurposes, setOutboundHostPurposes] = useState<
    Record<string, AdminModuleAppOutboundHostPurpose | undefined>
  >({});
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const actionLabel = action ? t(REVIEW_ACTION_TRANSLATION_KEYS[action]) : '';
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
    // 筛选/翻页切换时保留上一页数据渲染，避免全局去重间隔为 0 触发的整表骨架闪烁。
    { keepPreviousData: true },
  );
  const updateFilter = (name: string, value: string) =>
    setSearchParams((current) => setFilter(current, name, value || undefined));
  // 三个文本筛选（appId/publisherId/submittedByUserId）走防抖回写；Select 类
  // 筛选仍是即时 updateFilter。
  const [textFilterInputs, setTextFilter] = useReviewTextFilters(
    appId ?? '',
    publisherId ?? '',
    submittedByUserId ?? '',
  );
  const handleFilter = (name: string, value: string) => {
    if (name in textFilterInputs) return setTextFilter(name, value);
    updateFilter(name, value);
  };
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
    setOutboundHostPurposes(
      Object.fromEntries(getOutboundHosts(target).map((host) => [host, undefined])),
    );
    setRejectReason('');
  };
  const closeAction = () => {
    if (submitting) return;
    setAction(undefined);
    setActionTarget(undefined);
  };
  const outboundHosts = getOutboundHosts(actionTarget);
  const outboundHostPolicies = outboundHosts.flatMap((host) => {
    const purpose = outboundHostPurposes[host];
    return purpose ? [{ host, purpose }] : [];
  });
  const approvalClassificationIncomplete =
    action === 'approve' && outboundHostPolicies.length !== outboundHosts.length;
  const submitAction = async () => {
    if (
      !action ||
      !actionTarget ||
      (action === 'reject' && !rejectReason.trim()) ||
      approvalClassificationIncomplete
    )
      return;
    setSubmitting(true);
    setActionError(undefined);
    try {
      await submitReviewAction({
        action,
        listKey,
        outboundHostPolicies,
        rejectReason: rejectReason.trim(),
        target: actionTarget,
        translate: (key) => t(key),
      });
      setActionComplete(true);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('moduleApps.admin.reviews.actionError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isEmptyState = !isLoading && !error && (data?.items.length ?? 0) === 0;

  return (
    <AdminPageShell
      description={t('moduleApps.admin.reviews.description')}
      testId="module-reviews-page"
      title={t('moduleApps.admin.reviews.title')}
      width="full"
      state={{
        emptyDescription: t(
          isFiltered
            ? 'moduleApps.admin.reviews.filteredEmptyDescription'
            : 'moduleApps.admin.reviews.emptyDescription',
        ),
        emptyKind: isFiltered ? 'filtered' : 'initial',
        emptyTitle: t(
          isFiltered
            ? 'moduleApps.admin.reviews.filteredEmptyTitle'
            : 'moduleApps.admin.reviews.emptyTitle',
        ),
        error,
        isEmpty: isEmptyState,
        loading: isLoading,
        onClearFilters: clearFilters,
        onRetry: () => mutate(listKey),
        retryLabel: t('moduleApps.admin.reviews.retry'),
      }}
    >
      <ReviewFilters
        appId={textFilterInputs.appId}
        buildStatus={buildStatus}
        publisherId={textFilterInputs.publisherId}
        reviewStatus={reviewStatus}
        submittedByUserId={textFilterInputs.submittedByUserId}
        t={t as any}
        onUpdateFilter={handleFilter}
      />
      {!isEmptyState && !error ? (
        <ReviewTable
          canWrite={canWrite}
          columns={packageColumns}
          data={data?.items ?? []}
          nextCursor={data?.nextCursor ?? undefined}
          page={searchParams.getAll('previousCursor').length + 1}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          t={t as any}
          onOpen={openAction}
        />
      ) : null}
      {canWrite ? (
        <Modal
          destroyOnHidden
          cancelText={t('cancel')}
          confirmLoading={submitting}
          open={Boolean(action)}
          title={actionLabel}
          okButtonProps={{
            danger: action === 'reject',
            disabled:
              submitting ||
              (action === 'reject' && !rejectReason.trim()) ||
              approvalClassificationIncomplete,
          }}
          okText={
            action === 'reject' ? t('moduleApps.admin.reviews.confirmRejection') : actionLabel
          }
          onCancel={closeAction}
          onOk={actionComplete ? closeAction : submitAction}
        >
          {actionComplete ? <p>{t('moduleApps.admin.reviews.actionSuccess')}</p> : null}
          {/* 弹窗标题只有「通过/拒绝/扫描」一个词；队列连审时管理员需要确认
              操作对象，正文先复述 app+版本。 */}
          {!actionComplete && actionTarget ? (
            <p>
              {t('moduleApps.admin.reviews.pendingContext', {
                action: actionLabel,
                app:
                  actionTarget.manifestSnapshot?.app?.displayName ??
                  actionTarget.appId ??
                  actionTarget.id,
                version: actionTarget.manifestSnapshot?.packageVersion ?? '-',
              })}
            </p>
          ) : null}
          {action === 'approve' && !actionComplete && outboundHosts.length > 0 ? (
            <OutboundHostClassification
              outboundHostPurposes={outboundHostPurposes}
              outboundHosts={outboundHosts}
              setOutboundHostPurposes={setOutboundHostPurposes}
              t={t as any}
            />
          ) : null}
          {action === 'reject' && !actionComplete ? (
            <RejectReasonField
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              t={t as any}
            />
          ) : null}
          {actionError ? <p role="alert">{actionError}</p> : null}
        </Modal>
      ) : null}
    </AdminPageShell>
  );
});

ModuleReviewsPage.displayName = 'ModuleReviewsPage';

export default ModuleReviewsPage;
