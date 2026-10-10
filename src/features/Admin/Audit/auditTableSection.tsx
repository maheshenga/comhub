'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';

import InlineTable from '@/components/InlineTable';
import {
  type AuditRow,
  BulkAuditGroupSummary,
} from '@/features/Admin/Audit/auditParts';
import { AdminResponsiveTable } from '@/features/Admin/layout';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

/** 审计表 + 批量任务组摘要（§5.3：batchCorrelationId 聚合为可展开组）。 */
export const AdminAuditTableSection = ({
  columns,
  groups,
  hasMore,
  loading,
  nextCursor,
  onCursor,
  onDetail,
  onFilterBatch,
  t,
}: {
  columns: any[];
  groups: Array<{ batchCorrelationId: null | string; rows: AuditRow[] }>;
  hasMore: boolean;
  loading: boolean;
  nextCursor: null | number;
  onCursor: (cursor: number) => void;
  onDetail: (row: AuditRow) => void;
  onFilterBatch: (batchCorrelationId: string) => void;
  t: TFn;
}) => {
  return (
    <>
      <AdminResponsiveTable label={t('admin.audit.tableLabel', '审计日志表')}>
        <InlineTable
          columns={columns as any}
          dataSource={groups.flatMap((group) => group.rows)}
          loading={loading}
          rowKey="id"
          onRow={(record) => ({
            onClick: () => onDetail(record as AuditRow),
            style: { cursor: 'pointer' },
          })}
        />
      </AdminResponsiveTable>
      {groups
        .filter((group) => group.batchCorrelationId && group.rows.length > 1)
        .slice(0, 5)
        .map((group) => (
          <BulkAuditGroupSummary
            group={group}
            key={group.batchCorrelationId}
            t={t}
            onFilterBatch={onFilterBatch}
          />
        ))}
      {hasMore && nextCursor != null ? (
        <Flexbox align="center">
          <Button loading={loading} onClick={() => onCursor(nextCursor)}>
            {t('admin.audit.loadMore', '加载更多')}
          </Button>
        </Flexbox>
      ) : null}
    </>
  );
};

