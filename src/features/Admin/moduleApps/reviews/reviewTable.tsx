import { AdminDataTable } from '../../shared';
import { advanceCursor, retreatCursor } from '../shared/queryState';
import type { AdminModuleAppPackageRow } from '../types';
import type { PackageColumn } from './packageColumns';
import { ReviewRowActions } from './reviewParts';

type TFn = (key: any, options?: any) => any;

type ReviewTableProps = {
  canWrite: boolean;
  columns: PackageColumn[];
  data: AdminModuleAppPackageRow[];
  nextCursor?: string;
  page: number;
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams) => void;
  t: TFn;
  onOpen: (action: 'approve' | 'reject' | 'rescan', item: AdminModuleAppPackageRow) => void;
};

/**
 * 审核表格 + 游标分页（批次2拆页：从 ModuleReviewsPage 抽出以守 300 行门禁）。
 * F5：原来的裸 <table> 没有 role="region" 也没有空态文案，统一交给
 * AdminDataTable（无障碍滚动区 + 缺省空态 + pager 插槽）。
 */
export const ReviewTable = ({
  canWrite,
  columns,
  data,
  nextCursor,
  page,
  searchParams,
  setSearchParams,
  t,
  onOpen,
}: ReviewTableProps) => {
  const tableColumns = [
    ...columns.map((column) => ({
      key: column.title,
      render: (_: unknown, item: AdminModuleAppPackageRow) => column.render?.(item),
      title: t(column.title),
    })),
    ...(canWrite
      ? [
          {
            key: 'actions',
            render: (_: unknown, item: AdminModuleAppPackageRow) => (
              <ReviewRowActions
                item={item}
                t={t as any}
                onOpen={(nextAction) => onOpen(nextAction, item)}
              />
            ),
            title: t('moduleApps.admin.reviews.columns.actions'),
          },
        ]
      : []),
  ];

  return (
    <AdminDataTable
      columns={tableColumns as any}
      dataSource={data}
      regionLabel={t('moduleApps.admin.reviews.title')}
      rowKey="id"
      pager={{
        hasNext: Boolean(nextCursor),
        hasPrevious: page > 1,
        nextLabel: t('moduleApps.admin.reviews.next'),
        positionLabel: t('moduleApps.admin.reviews.pagePosition', { page }),
        previousLabel: t('moduleApps.admin.reviews.previous'),
        onNext: () => nextCursor && setSearchParams(advanceCursor(searchParams, nextCursor)),
        onPrevious: () => setSearchParams(retreatCursor(searchParams)),
      }}
    />
  );
};
