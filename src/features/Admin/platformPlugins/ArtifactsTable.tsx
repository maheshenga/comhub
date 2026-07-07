'use client';

import { Typography } from 'antd';
import { memo } from 'react';

import InlineTable from '@/components/InlineTable';

import type { AdminPlatformPluginArtifact } from './types';

const { Text } = Typography;

type ArtifactsTableProps = {
  artifacts?: AdminPlatformPluginArtifact[];
  loading?: boolean;
};

const formatDate = (value?: Date | string | null) => (value ? new Date(value).toLocaleString() : '-');

const formatSize = (value?: number) => {
  if (!value) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const ArtifactsTable = memo<ArtifactsTableProps>(({ artifacts = [], loading }) => {
  const columns = [
    { dataIndex: 'id', key: 'id', render: (value: string) => <Text code>{value}</Text>, title: 'Artifact ID' },
    { dataIndex: 'fileName', key: 'fileName', title: '文件名' },
    { dataIndex: 'mimeType', key: 'mimeType', title: 'MIME' },
    { dataIndex: 'sizeBytes', key: 'sizeBytes', render: formatSize, title: '大小' },
    { dataIndex: 'downloadCount', key: 'downloadCount', title: '下载次数' },
    { dataIndex: 'storageKey', key: 'storageKey', render: (value: string) => <Text code>{value}</Text>, title: '存储 Key' },
    { dataIndex: 'createdAt', key: 'createdAt', render: formatDate, title: '创建时间' },
  ];

  return <InlineTable columns={columns as any} dataSource={artifacts} loading={loading} rowKey="id" />;
});

ArtifactsTable.displayName = 'ArtifactsTable';

export default ArtifactsTable;
