'use client';

import { Button, Input, Select, TextArea } from '@lobehub/ui/base-ui';

import { moduleReviewsStyles as styles } from './moduleReviewsStyles';
import type { AdminModuleAppOutboundHostPurpose } from '../types';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

/** 审核筛选区（M5 拆页：从 ModuleReviewsPage 抽出）。 */
export const ReviewFilters = ({
  appId,
  buildStatus,
  publisherId,
  reviewStatus,
  submittedByUserId,
  onUpdateFilter,
  t,
}: {
  appId?: string;
  buildStatus?: string;
  publisherId?: string;
  reviewStatus?: string;
  submittedByUserId?: string;
  onUpdateFilter: (name: string, value: string) => void;
  t: TFn;
}) => (
  <div className={styles.controls}>
    <label>
      {t('moduleApps.admin.reviews.filters.reviewStatus')}
      <Select
        value={reviewStatus ?? ''}
        options={[
          { label: t('moduleApps.admin.reviews.filters.all'), value: '' },
          { label: t('moduleApps.admin.reviews.status.pendingReview'), value: 'pending_review' },
          { label: t('moduleApps.admin.reviews.status.approved'), value: 'approved' },
          { label: t('moduleApps.admin.reviews.status.rejected'), value: 'rejected' },
        ]}
        onChange={(value) => onUpdateFilter('reviewStatus', String(value ?? ''))}
      />
    </label>
    <label>
      {t('moduleApps.admin.reviews.filters.buildStatus')}
      <Select
        value={buildStatus ?? ''}
        options={[
          { label: t('moduleApps.admin.reviews.filters.all'), value: '' },
          { label: t('moduleApps.admin.reviews.buildStatus.queued'), value: 'queued' },
          { label: t('moduleApps.admin.reviews.buildStatus.building'), value: 'building' },
          { label: t('moduleApps.admin.reviews.buildStatus.ready'), value: 'ready' },
          { label: t('moduleApps.admin.reviews.buildStatus.failed'), value: 'failed' },
        ]}
        onChange={(value) => onUpdateFilter('buildStatus', String(value ?? ''))}
      />
    </label>
    <label>
      {t('moduleApps.admin.reviews.filters.appId')}
      <Input
        maxLength={36}
        value={appId ?? ''}
        onChange={(event) => onUpdateFilter('appId', event.target.value)}
      />
    </label>
    <label>
      {t('moduleApps.admin.reviews.filters.publisherId')}
      <Input
        maxLength={36}
        value={publisherId ?? ''}
        onChange={(event) => onUpdateFilter('publisherId', event.target.value)}
      />
    </label>
    <label>
      {t('moduleApps.admin.reviews.filters.submittedByUserId')}
      <Input
        maxLength={255}
        value={submittedByUserId ?? ''}
        onChange={(event) => onUpdateFilter('submittedByUserId', event.target.value)}
      />
    </label>
  </div>
);

/** 出站域名用途分类弹窗体（M5 拆页：从 ModuleReviewsPage 抽出）。 */
export const OutboundHostClassification = ({
  outboundHosts,
  outboundHostPurposes,
  setOutboundHostPurposes,
  t,
}: {
  outboundHosts: string[];
  outboundHostPurposes: Record<string, AdminModuleAppOutboundHostPurpose | undefined>;
  setOutboundHostPurposes: (
    updater: (
      current: Record<string, AdminModuleAppOutboundHostPurpose | undefined>,
    ) => Record<string, AdminModuleAppOutboundHostPurpose | undefined>,
  ) => void;
  t: TFn;
}) => (
  <div className={styles.hostList}>
    {outboundHosts.map((host) => (
      <label className={styles.hostRow} key={host}>
        <span className={styles.hostName}>{host}</span>
        <Select
          aria-label={host}
          value={outboundHostPurposes[host] ?? ''}
          options={[
            { label: t('moduleApps.admin.reviews.outboundPurpose.unclassified'), value: '' },
            { label: t('moduleApps.admin.reviews.outboundPurpose.general'), value: 'general' },
            { label: t('moduleApps.admin.reviews.outboundPurpose.ai'), value: 'ai' },
            { label: t('moduleApps.admin.reviews.outboundPurpose.payment'), value: 'payment' },
          ]}
          onChange={(value) =>
            setOutboundHostPurposes((current) => ({
              ...current,
              [host]:
                value === 'ai' || value === 'general' || value === 'payment'
                  ? (value as AdminModuleAppOutboundHostPurpose)
                  : undefined,
            }))
          }
        />
      </label>
    ))}
  </div>
);

/** 拒绝理由输入（M5 拆页：从 ModuleReviewsPage 抽出）。 */
export const RejectReasonField = ({
  rejectReason,
  setRejectReason,
  t,
}: {
  rejectReason: string;
  setRejectReason: (value: string) => void;
  t: TFn;
}) => (
  <label>
    {t('moduleApps.admin.reviews.rejectReason')}
    <TextArea
      required
      maxLength={1000}
      value={rejectReason}
      onChange={(event) => setRejectReason(event.target.value)}
    />
  </label>
);

/** 表格动作列（M5 拆页：从 ModuleReviewsPage 抽出）。 */
export const ReviewRowActions = ({
  item,
  onOpen,
  t,
}: {
  item: { reviewStatus: string; scanStatus?: null | string };
  onOpen: (action: 'approve' | 'reject' | 'rescan') => void;
  t: TFn;
}) => (
  <div className={styles.controls}>
    <Button
      disabled={item.reviewStatus !== 'pending_review' || item.scanStatus !== 'clean'}
      onClick={() => onOpen('approve')}
    >
      {t('moduleApps.admin.reviews.approve')}
    </Button>
    {item.reviewStatus === 'pending_review' && item.scanStatus !== 'clean' ? (
      <Button onClick={() => onOpen('rescan')}>{t('moduleApps.admin.reviews.rescan')}</Button>
    ) : null}
    <Button disabled={item.reviewStatus !== 'pending_review'} onClick={() => onOpen('reject')}>
      {t('moduleApps.admin.reviews.reject')}
    </Button>
  </div>
);
