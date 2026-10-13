'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';

import { type AuditRow, BulkAuditGroupSummary } from '@/features/Admin/Audit/auditParts';
import { AdminDataTable } from '@/features/Admin/shared';

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
      <AdminDataTable
        columns={columns as any}
        dataSource={groups.flatMap((group) => group.rows)}
        loading={loading}
        regionLabel={t('admin.audit.tableLabel', '审计日志表')}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => onDetail(record as AuditRow),
          style: { cursor: 'pointer' },
        })}
      />
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
            {t('admin.audit.nextPage', '下一页')}
          </Button>
        </Flexbox>
      ) : null}
    </>
  );
};
