'use client';

import { Tag, Typography } from 'antd';
import { memo } from 'react';

import InlineTable from '@/components/InlineTable';

import type { AdminPlatformPluginRun } from './types';

const { Text } = Typography;

type RunRecordsTableProps = {
  loading?: boolean;
  runs?: AdminPlatformPluginRun[];
};

const statusColor: Record<string, string> = {
  denied: 'orange',
  failed: 'red',
  queued: 'default',
  running: 'blue',
  succeeded: 'green',
};

const formatDate = (value?: Date | string) => (value ? new Date(value).toLocaleString() : '-');

const formatSnapshot = (value?: Record<string, unknown> | null) => {
  if (!value || Object.keys(value).length === 0) return '-';
  return JSON.stringify(value);
};

const RunRecordsTable = memo<RunRecordsTableProps>(({ loading, runs = [] }) => {
  const columns = [
    { dataIndex: 'id', key: 'id', render: (value: string) => <Text code>{value}</Text>, title: 'Run ID' },
    {
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
      title: '状态',
    },
    { dataIndex: 'userId', key: 'userId', title: '用户' },
    { dataIndex: 'agentId', key: 'agentId', title: 'Agent' },
    {
      dataIndex: 'billingSnapshot',
      key: 'billingSnapshot',
      render: formatSnapshot,
      title: '计费快照',
    },
    { dataIndex: 'durationMs', key: 'durationMs', render: (value?: number) => value ?? '-', title: '耗时 ms' },
    {
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      render: (value?: string | null, row?: AdminPlatformPluginRun) => value || row?.errorType || '-',
      title: '错误',
    },
    { dataIndex: 'createdAt', key: 'createdAt', render: formatDate, title: '创建时间' },
  ];

  return <InlineTable columns={columns as any} dataSource={runs} loading={loading} rowKey="id" />;
});

RunRecordsTable.displayName = 'RunRecordsTable';

export default RunRecordsTable;
