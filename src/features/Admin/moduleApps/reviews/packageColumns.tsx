import type { ModuleAppPackageReviewStatus, ModuleAppPackageScanStatus } from '@lobechat/types';
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

export const packageColumns: PackageColumn[] = [
  {
    render: (row) => row.manifestSnapshot?.app?.displayName ?? '-',
    title: 'moduleApps.admin.reviews.columns.app',
  },
  {
    render: (row) => row.manifestSnapshot?.packageVersion ?? '-',
    title: 'moduleApps.admin.reviews.columns.version',
  },
  {
    render: (row) => row.reviewStatus as ModuleAppPackageReviewStatus,
    title: 'moduleApps.admin.reviews.columns.reviewStatus',
  },
  {
    render: (row) => row.scanStatus as ModuleAppPackageScanStatus,
    title: 'moduleApps.admin.reviews.columns.scanStatus',
  },
  {
    render: (row) => row.buildStatus ?? '-',
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
