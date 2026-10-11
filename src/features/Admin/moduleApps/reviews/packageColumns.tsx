import type {
  ModuleAppBuildStatus,
  ModuleAppPackageReviewStatus,
  ModuleAppPackageScanStatus,
} from '@lobechat/types';
import type { ReactNode } from 'react';

import type { AdminModuleAppPackageRow } from '../types';

const formatDate = (value?: Date | string) => {
  if (!value) return '-';

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
};

const REVIEW_STATUS_TRANSLATION_KEYS = {
  approved: 'moduleApps.admin.reviews.status.approved',
  pending_review: 'moduleApps.admin.reviews.status.pendingReview',
  rejected: 'moduleApps.admin.reviews.status.rejected',
} as const satisfies Record<ModuleAppPackageReviewStatus, string>;

const SCAN_STATUS_TRANSLATION_KEYS = {
  blocked: 'moduleApps.admin.reviews.scanStatus.blocked',
  clean: 'moduleApps.admin.reviews.scanStatus.clean',
  error: 'moduleApps.admin.reviews.scanStatus.error',
  pending: 'moduleApps.admin.reviews.scanStatus.pending',
} as const satisfies Record<ModuleAppPackageScanStatus, string>;

const BUILD_STATUS_TRANSLATION_KEYS = {
  building: 'moduleApps.admin.reviews.buildStatus.building',
  failed: 'moduleApps.admin.reviews.buildStatus.failed',
  queued: 'moduleApps.admin.reviews.buildStatus.queued',
  ready: 'moduleApps.admin.reviews.buildStatus.ready',
} as const satisfies Record<ModuleAppBuildStatus, string>;

type PackageStatusTranslationKey =
  | (typeof REVIEW_STATUS_TRANSLATION_KEYS)[keyof typeof REVIEW_STATUS_TRANSLATION_KEYS]
  | (typeof SCAN_STATUS_TRANSLATION_KEYS)[keyof typeof SCAN_STATUS_TRANSLATION_KEYS]
  | (typeof BUILD_STATUS_TRANSLATION_KEYS)[keyof typeof BUILD_STATUS_TRANSLATION_KEYS];

type PackageColumnTitle =
  | 'moduleApps.admin.reviews.columns.app'
  | 'moduleApps.admin.reviews.columns.buildStatus'
  | 'moduleApps.admin.reviews.columns.rejectionReason'
  | 'moduleApps.admin.reviews.columns.reviewStatus'
  | 'moduleApps.admin.reviews.columns.scanStatus'
  | 'moduleApps.admin.reviews.columns.submitted'
  | 'moduleApps.admin.reviews.columns.submitter'
  | 'moduleApps.admin.reviews.columns.version';

export type PackageColumn = {
  render?: (row: AdminModuleAppPackageRow) => ReactNode;
  title: PackageColumnTitle;
};

export const getPackageColumns = (
  translate: (key: PackageStatusTranslationKey) => ReactNode,
): PackageColumn[] => [
  {
    render: (row) => row.manifestSnapshot?.app?.displayName ?? '-',
    title: 'moduleApps.admin.reviews.columns.app',
  },
  {
    render: (row) => row.manifestSnapshot?.packageVersion ?? '-',
    title: 'moduleApps.admin.reviews.columns.version',
  },
  {
    render: (row) => translate(REVIEW_STATUS_TRANSLATION_KEYS[row.reviewStatus]),
    title: 'moduleApps.admin.reviews.columns.reviewStatus',
  },
  {
    render: (row) => translate(SCAN_STATUS_TRANSLATION_KEYS[row.scanStatus]),
    title: 'moduleApps.admin.reviews.columns.scanStatus',
  },
  {
    render: (row) =>
      row.buildStatus ? translate(BUILD_STATUS_TRANSLATION_KEYS[row.buildStatus]) : '-',
    title: 'moduleApps.admin.reviews.columns.buildStatus',
  },
  {
    render: (row) => row.submittedByUserId ?? '-',
    title: 'moduleApps.admin.reviews.columns.submitter',
  },
  {
    // 驳回原因此前只在开发者端/市场端可见，管理员这一侧看不到自己写了什么，
    // 申诉时也无从对照。
    render: (row) => row.rejectionReason ?? '-',
    title: 'moduleApps.admin.reviews.columns.rejectionReason',
  },
  {
    render: (row) => formatDate(row.createdAt),
    title: 'moduleApps.admin.reviews.columns.submitted',
  },
];

/**
 * 审核动作的成功回执。原文案只有一句「操作已完成。」，不告诉管理员批的是
 * 哪个包、哪个版本，队列在弹窗关闭后被动停住；带上可定位信息后既能继续处理
 * 下一条，回看失败时也知道该找哪一个包。
 */
export const actionReceipt = (
  translate: (key: 'moduleApps.admin.reviews.actionSuccess') => string,
  row: AdminModuleAppPackageRow,
) => {
  const app = row.appId ?? row.manifestSnapshot?.app?.slug ?? row.id;
  const version = row.manifestSnapshot?.packageVersion;

  return [translate('moduleApps.admin.reviews.actionSuccess'), app, version]
    .filter(Boolean)
    .join(' ');
};
