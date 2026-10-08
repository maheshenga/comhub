'use client';

import { Button } from '@lobehub/ui/base-ui';
import type { TableProps } from 'antd';
import { Table } from 'antd';
import { createStaticStyles } from 'antd-style';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminPageState } from './AdminPageState';

const styles = createStaticStyles(({ css, cssVar }) => ({
  pager: css`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-block: 8px;
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
  onNext: () => void;
  onPrevious: () => void;
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
  error?: unknown;
  errorDescription?: ReactNode;
  errorTitle?: ReactNode;
  isEmpty?: boolean;
  loading?: boolean;
  onCsvExport?: () => void;
  onRetry?: () => void;
  /**
   * Cursor pager wiring: pass the state derived from useAdminCursorQuery to
   * get built-in previous/next buttons; omit for client-side-only data.
   */
  pager?: AdminDataTablePagerState;
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
  error,
  errorDescription,
  errorTitle,
  isEmpty,
  loading,
  onCsvExport,
  onRetry,
  pager,
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
        error={error}
        errorDescription={errorDescription}
        errorTitle={errorTitle}
        isEmpty={Boolean(isEmpty)}
        loading={loading}
        skeletonVariant="list"
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
        pagination={false}
        rowSelection={rowSelection}
        scroll={{ x: scrollX }}
        size="small"
        {...rest}
      />
      {pager ? (
        <div className={styles.pager}>
          <Button
            aria-label={translate('admin.shared.pagination.previous', '上一页')}
            disabled={!pager.hasPrevious}
            icon={<ChevronLeft aria-hidden size={16} />}
            onClick={pager.onPrevious}
          />
          <Button
            aria-label={translate('admin.shared.pagination.next', '下一页')}
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
