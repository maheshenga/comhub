import { type TableColumnType } from 'antd';
import { memo, useMemo } from 'react';

import { AdminDataTable } from '../shared';
import type { ModuleAppRecordRow } from './types';

export type RecordsTableLabels = {
  collection?: string;
  record?: string;
  scope?: string;
  status?: string;
  updated?: string;
};

interface RecordsTableProps {
  items?: ModuleAppRecordRow[];
  labels?: RecordsTableLabels;
  /** 无障碍滚动区名字；三态由页面层 ModulePageState 先行拦截。 */
  regionLabel?: string;
}

const RecordsTable = memo<RecordsTableProps>(({ items = [], labels, regionLabel }) => {
  const resolvedLabels = useMemo(
    () => ({
      collection: 'Collection',
      record: 'Record',
      scope: 'Scope',
      status: 'Status',
      updated: 'Updated',
      ...labels,
    }),
    [labels],
  );

  const columns = useMemo<TableColumnType<ModuleAppRecordRow>[]>(
    () => [
      {
        key: 'record',
        render: (_, record) => record.title ?? record.id,
        title: resolvedLabels.record,
      },
      { dataIndex: 'collectionKey', key: 'collection', title: resolvedLabels.collection },
      { dataIndex: 'scopeType', key: 'scope', title: resolvedLabels.scope },
      { dataIndex: 'status', key: 'status', render: (value) => value ?? '-', title: resolvedLabels.status },
      {
        dataIndex: 'updatedAt',
        key: 'updated',
        render: (value) => (value ? String(value) : '-'),
        title: resolvedLabels.updated,
      },
    ],
    [resolvedLabels],
  );

  return (
    <AdminDataTable
      columns={columns}
      dataSource={items}
      regionLabel={regionLabel ?? resolvedLabels.record}
      rowKey="id"
    />
  );
});

RecordsTable.displayName = 'RecordsTable';

export default RecordsTable;
