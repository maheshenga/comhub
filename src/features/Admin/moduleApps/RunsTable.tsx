import { type TableColumnType } from 'antd';
import { memo, useMemo } from 'react';

import { AdminDataTable } from '../shared';
import type { ModuleAppRunRow } from './types';

export type RunsTableLabels = {
  action?: string;
  created?: string;
  duration?: string;
  error?: string;
  run?: string;
  status?: string;
};

interface RunsTableProps {
  items?: ModuleAppRunRow[];
  labels?: RunsTableLabels;
  /**
   * 仅用于无障碍滚动区的名字。三态（loading/error/empty）由页面层的
   * ModulePageState 先行拦截，因此这里不再自带 loading/empty 分支——那两
   * 个分支在生产路径上是死代码，只被旧测试覆盖。
   */
  regionLabel?: string;
}

const RunsTable = memo<RunsTableProps>(({ items = [], labels, regionLabel }) => {
  const resolvedLabels = useMemo(
    () => ({
      action: 'Action',
      created: 'Created',
      duration: 'Duration',
      error: 'Error',
      run: 'Run',
      status: 'Status',
      ...labels,
    }),
    [labels],
  );

  const columns = useMemo<TableColumnType<ModuleAppRunRow>[]>(
    () => [
      { dataIndex: 'id', key: 'run', title: resolvedLabels.run },
      {
        dataIndex: 'actionId',
        key: 'action',
        render: (value) => value ?? '-',
        title: resolvedLabels.action,
      },
      { dataIndex: 'status', key: 'status', title: resolvedLabels.status },
      {
        dataIndex: 'errorType',
        key: 'error',
        render: (value) => value ?? '-',
        title: resolvedLabels.error,
      },
      {
        key: 'duration',
        render: (_, record) =>
          record.durationMs === undefined || record.durationMs === null
            ? '-'
            : `${record.durationMs}ms`,
        title: resolvedLabels.duration,
      },
      {
        dataIndex: 'createdAt',
        key: 'created',
        render: (value) => (value ? String(value) : '-'),
        title: resolvedLabels.created,
      },
    ],
    [resolvedLabels],
  );

  return (
    <AdminDataTable
      columns={columns}
      dataSource={items}
      regionLabel={regionLabel ?? resolvedLabels.run}
      rowKey="id"
    />
  );
});

RunsTable.displayName = 'RunsTable';

export default RunsTable;
