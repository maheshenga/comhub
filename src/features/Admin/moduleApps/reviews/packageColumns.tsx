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

export type PackageColumn = {
  render?: (row: AdminModuleAppPackageRow) => ReactNode;
  title: string;
};

export const getPackageColumns = (translate: (key: string) => ReactNode): PackageColumn[] => [
  {
    render: (row) => row.manifestSnapshot?.app?.displayName ?? '-',
    title: 'moduleApps.admin.reviews.columns.app',
  },
  {
    render: (row) => row.manifestSnapshot?.packageVersion ?? '-',
    title: 'moduleApps.admin.reviews.columns.version',
  },
  {
    render: (row) =>
      translate(
        `moduleApps.admin.reviews.status.${
          (
            {
              pending_review: 'pendingReview',
              approved: 'approved',
              rejected: 'rejected',
            } as Record<ModuleAppPackageReviewStatus, string>
          )[row.reviewStatus]
        }`,
      ),
    title: 'moduleApps.admin.reviews.columns.reviewStatus',
  },
  {
    render: (row) =>
      translate(
        `moduleApps.admin.reviews.scanStatus.${row.scanStatus as ModuleAppPackageScanStatus}`,
      ),
    title: 'moduleApps.admin.reviews.columns.scanStatus',
  },
  {
    render: (row) =>
      row.buildStatus
        ? translate(
            `moduleApps.admin.reviews.buildStatus.${row.buildStatus as ModuleAppBuildStatus}`,
          )
        : '-',
    title: 'moduleApps.admin.reviews.columns.buildStatus',
  },
  {
    render: (row) => row.submittedByUserId ?? '-',
    title: 'moduleApps.admin.reviews.columns.submitter',
  },
  {
    render: (row) => formatDate(row.createdAt),
    title: 'moduleApps.admin.reviews.columns.submitted',
  },
];
