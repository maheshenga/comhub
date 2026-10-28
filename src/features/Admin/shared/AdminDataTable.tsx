'use client';

import { Button, createStaticStyles } from '@lobehub/ui';
import type { TableProps } from 'antd';
// keep-antd 豁免（原 no-restricted-imports 行内豁免已随升级失效，保留原因）：Admin's unified table primitive is the sanctioned antd Table wrapper (blueprint §4.2-1): Admin pages stop importing Table directly and render this instead; the base-ui Table is a separate tanstack-based re-implementation (no rowSelection, mandatory rowKey) and blueprint §4.1 keeps interactive components on antd while base-ui phases out.
import { Table } from 'antd';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminPageState } from './AdminPageState';

const styles = createStaticStyles(({ css, cssVar }) => ({
  pager: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    padding-block: 8px;
  `,
  pagerPosition: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
    white-space: nowrap;
  `,
  responsive: css`
    overflow-x: auto;
    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
}));

export interface AdminDataTableCsvColumn<Row> {
  /** CSV header text; falls back to `headerFor(index)` when omitted. */
  header?: string;
  /** Extract the cell text for the CSV export; return null to emit an empty cell. */
  value?: (row: Row) => number | null | string | undefined;
}

export interface AdminDataTablePagerState {
  /** True when the current response carries a next cursor. */
  hasNext: boolean;
  /** True when a previous page exists (cursor stack deeper than one entry). */
  hasPrevious: boolean;
  /** 下一页按钮的无障碍名；缺省回退到共享文案 admin.shared.pagination.next。 */
  nextLabel?: string;
  onNext: () => void;
  onPrevious: () => void;
  /** 游标分页无总页数；「第 N 页」位置标签（与 moduleApps CursorPager 对齐）。 */
  positionLabel?: string;
  /** 上一页按钮的无障碍名；缺省回退到共享文案 admin.shared.pagination.previous。 */
  previousLabel?: string;
}

export interface AdminDataTableProps<RecordType extends object> extends Omit<
  TableProps<RecordType>,
  'columns' | 'rowSelection' | 'scroll'
> {
  /** Column metadata; reuse the antd column shape Admin pages already write. */
  columns: TableProps<RecordType>['columns'];
  /** Ordered CSV export config; omit to hide the export action. */
  csvColumns?: AdminDataTableCsvColumn<RecordType>[];
  csvFileName?: string;
  /**
   * Built-in three-state gate: loading skeleton, error retry and empty states
   * render instead of the table. Omit all three to render the table
   * unconditionally (state management stays in the caller).
   */
  /** Copy for the gated empty state; falls back to AdminPageState defaults. */
  emptyDescription?: ReactNode;
  /** `'filtered'` swaps the empty state to the SearchX + clear-filters variant. */
  emptyKind?: 'filtered' | 'initial';
  emptyTitle?: ReactNode;
  error?: unknown;
  errorDescription?: ReactNode;
  errorTitle?: ReactNode;
  isEmpty?: boolean;
  loading?: boolean;
  /** Clear-filters action; rendered only together with `emptyKind="filtered"`. */
  onClearFilters?: () => void;
  onCsvExport?: () => void;
  onRetry?: () => void;
  /** Cursor pager wiring from useAdminCursorQuery state; omit for client-side data. */
  pager?: AdminDataTablePagerState;
  /**
   * Client-side pagination opt-in for tables that page a fully-loaded array.
   * Only sanctioned shape: `{ hideOnSinglePage: true, showSizeChanger: true }`
   * (DesktopBuildHistory / MatrixTable) — server-cursor tables must use `pager`
   * instead so the Admin domain keeps exactly two pagination shapes.
   */
  pagination?: TableProps<RecordType>['pagination'];
  /** Accessible region label; Admin pages must provide a translated string. */
  regionLabel?: string;
  /** antd rowSelection passthrough (checkbox / radio selection extension slot). */
  rowSelection?: TableProps<RecordType>['rowSelection'];
  scrollX?: number | string;
  toolbar?: ReactNode;
}

/**
 * Unified Admin data-table primitive (blueprint §4.2-1). Merges the
 * InlineTable / AdminResponsiveTable dual track: an accessible scroll region
 * wrapping an antd Table with scroll.x defaulted, plus optional three-state
 * gating, rowSelection passthrough, CSV export and cursor-pager wiring.
 *
 * Pages keep their own column definitions — this primitive owns the shell.
 */
export const AdminDataTable = <RecordType extends object>({
  columns,
  csvColumns,
  csvFileName,
  emptyDescription,
  emptyKind,
  emptyTitle,
  error,
  errorDescription,
  errorTitle,
  isEmpty,
  loading,
  locale,
  onClearFilters,
  onCsvExport,
  onRetry,
  pager,
  pagination = false,
  regionLabel,
  rowSelection,
  scrollX = 'max-content',
  toolbar,
  ...rest
}: AdminDataTableProps<RecordType>) => {
  const { t } = useTranslation('common');
  const translate = (key: string, fallback: string) => t(key, fallback) || fallback;

  if (error || loading || isEmpty) {
    return (
      <AdminPageState
        emptyDescription={emptyDescription}
        emptyKind={emptyKind}
        emptyTitle={emptyTitle}
        error={error}
        errorDescription={errorDescription}
        errorTitle={errorTitle}
        isEmpty={Boolean(isEmpty)}
        loading={loading}
        skeletonVariant="list"
        onClearFilters={onClearFilters}
        onRetry={onRetry}
      >
        {null}
      </AdminPageState>
    );
  }

  const exportCsv = () => {
    if (onCsvExport) {
      onCsvExport();
      return;
    }
    if (!csvColumns) return;

    const dataSource = (rest.dataSource ?? []) as RecordType[];
    const csvEscape = (text: string) =>
      /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    const header = csvColumns.map((column, index) =>
      csvEscape(column.header ?? `column_${index + 1}`),
    );
    const rows = dataSource.map((row) =>
      csvColumns.map((column) => {
        const raw = column.value?.(row);
        return csvEscape(raw == null ? '' : String(raw));
      }),
    );
    const csv = [header, ...rows].map((cells) => cells.join(',')).join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = csvFileName ?? 'admin-export.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const hasCsvAction = Boolean(onCsvExport || csvColumns);

  return (
    <div aria-label={regionLabel} className={styles.responsive} role="region" tabIndex={0}>
      {toolbar || hasCsvAction ? (
        <div className={styles.toolbar}>
          {toolbar}
          {hasCsvAction ? (
            <Button icon={<Download aria-hidden size={14} />} size="small" onClick={exportCsv}>
              {translate('admin.shared.dataTable.exportCsv', '导出 CSV')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <Table<RecordType>
        bordered={false}
        columns={columns}
        loading={loading}
        locale={locale ?? { emptyText: translate('admin.shared.table.empty', '暂无数据') }}
        pagination={pagination}
        rowSelection={rowSelection}
        scroll={{ x: scrollX }}
        size="small"
        {...rest}
      />
      {pager ? (
        <div className={styles.pager}>
          {pager.positionLabel ? (
            <span className={styles.pagerPosition}>{pager.positionLabel}</span>
          ) : null}
          <Button
            disabled={!pager.hasPrevious}
            icon={<ChevronLeft aria-hidden size={16} />}
            aria-label={
              pager.previousLabel ?? translate('admin.shared.pagination.previous', '上一页')
            }
            onClick={pager.onPrevious}
          />
          <Button
            aria-label={pager.nextLabel ?? translate('admin.shared.pagination.next', '下一页')}
            disabled={!pager.hasNext}
            icon={<ChevronRight aria-hidden size={16} />}
            onClick={pager.onNext}
          />
        </div>
      ) : null}
    </div>
  );
};

export default AdminDataTable;
