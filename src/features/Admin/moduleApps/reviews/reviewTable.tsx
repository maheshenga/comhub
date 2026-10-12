import { Button } from '@lobehub/ui/base-ui';

import { advanceCursor, retreatCursor } from '../shared/queryState';
import type { AdminModuleAppPackageRow } from '../types';
import { moduleReviewsStyles as styles } from './moduleReviewsStyles';
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

/** 审核表格 + 游标分页（批次2拆页：从 ModuleReviewsPage 抽出以守 300 行门禁）。 */
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
}: ReviewTableProps) => (
  <div className={styles.tableFrame}>
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.title}>{t(column.title)}</th>
          ))}
          {canWrite ? <th>{t('moduleApps.admin.reviews.columns.actions')}</th> : null}
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            {columns.map((column) => (
              <td key={column.title}>{column.render?.(item)}</td>
            ))}
            {canWrite ? (
              <td>
                <ReviewRowActions
                  item={item}
                  t={t as any}
                  onOpen={(nextAction) => onOpen(nextAction, item)}
                />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
    <div className={styles.controls}>
      <span className={styles.pagePosition}>
        {t('moduleApps.admin.reviews.pagePosition', { page })}
      </span>
      <Button
        disabled={page <= 1}
        onClick={() => setSearchParams(retreatCursor(searchParams))}
      >
        {t('moduleApps.admin.reviews.previous')}
      </Button>
      <Button
        disabled={!nextCursor}
        onClick={() => nextCursor && setSearchParams(advanceCursor(searchParams, nextCursor))}
      >
        {t('moduleApps.admin.reviews.next')}
      </Button>
    </div>
  </div>
);
