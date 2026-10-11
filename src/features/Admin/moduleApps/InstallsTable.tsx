import { type TableColumnType } from 'antd';
import { memo, useMemo } from 'react';

import { AdminDataTable } from '../shared';
import type { ModuleAppInstallRow } from './types';

export type InstallsTableLabels = {
  install?: string;
  installed?: string;
  scope?: string;
  status?: string;
  user?: string;
  workspace?: string;
};

interface InstallsTableProps {
  items?: ModuleAppInstallRow[];
  labels?: InstallsTableLabels;
  /** 无障碍滚动区名字；三态由页面层 ModulePageState 先行拦截。 */
  regionLabel?: string;
}

const InstallsTable = memo<InstallsTableProps>(({ items = [], labels, regionLabel }) => {
  const resolvedLabels = useMemo(
    () => ({
      install: 'Install',
      installed: 'Installed',
      scope: 'Scope',
      status: 'Status',
      user: 'User',
      workspace: 'Workspace',
      ...labels,
    }),
    [labels],
  );

  const columns = useMemo<TableColumnType<ModuleAppInstallRow>[]>(
    () => [
      { dataIndex: 'id', key: 'install', title: resolvedLabels.install },
      {
        dataIndex: 'scopeType',
        key: 'scope',
        render: (value) => value ?? '-',
        title: resolvedLabels.scope,
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => value ?? '-',
        title: resolvedLabels.status,
      },
      { dataIndex: 'userId', key: 'user', render: (value) => value ?? '-', title: resolvedLabels.user },
      {
        dataIndex: 'workspaceId',
        key: 'workspace',
        render: (value) => value ?? '-',
        title: resolvedLabels.workspace,
      },
      {
        dataIndex: 'installedAt',
        key: 'installed',
        render: (value) => (value ? String(value) : '-'),
        title: resolvedLabels.installed,
      },
    ],
    [resolvedLabels],
  );

  return (
    <AdminDataTable
      columns={columns}
      dataSource={items}
      regionLabel={regionLabel ?? resolvedLabels.install}
      rowKey="id"
    />
  );
});

InstallsTable.displayName = 'InstallsTable';

export default InstallsTable;
