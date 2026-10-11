import { type TableColumnType } from 'antd';
import { memo, useMemo } from 'react';

import { AdminDataTable } from '../shared';
import type { ModuleAppAuditRow } from './types';

export type AuditEventsTableLabels = {
  actor?: string;
  audit?: string;
  created?: string;
  event?: string;
};

interface AuditEventsTableProps {
  items?: ModuleAppAuditRow[];
  labels?: AuditEventsTableLabels;
  /** 无障碍滚动区名字；三态由页面层 ModulePageState 先行拦截。 */
  regionLabel?: string;
}

const AuditEventsTable = memo<AuditEventsTableProps>(({ items = [], labels, regionLabel }) => {
  const resolvedLabels = useMemo(
    () => ({
      actor: 'Actor',
      audit: 'Audit',
      created: 'Created',
      event: 'Event',
      ...labels,
    }),
    [labels],
  );

  const columns = useMemo<TableColumnType<ModuleAppAuditRow>[]>(
    () => [
      { dataIndex: 'id', key: 'audit', title: resolvedLabels.audit },
      { dataIndex: 'eventType', key: 'event', title: resolvedLabels.event },
      {
        dataIndex: 'actorUserId',
        key: 'actor',
        render: (value) => value ?? '-',
        title: resolvedLabels.actor,
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
      regionLabel={regionLabel ?? resolvedLabels.audit}
      rowKey="id"
    />
  );
});

AuditEventsTable.displayName = 'AuditEventsTable';

export default AuditEventsTable;
