import { type TableColumnType } from 'antd';
import { memo, useMemo } from 'react';

import { AdminDataTable } from '../shared';
import type { ModuleAppArtifactRow } from './types';

export type ArtifactsTableLabels = {
  artifact?: string;
  file?: string;
  mime?: string;
  scope?: string;
  size?: string;
  storageKey?: string;
};

interface ArtifactsTableProps {
  items?: ModuleAppArtifactRow[];
  labels?: ArtifactsTableLabels;
  /** 无障碍滚动区名字；三态由页面层 ModulePageState 先行拦截。 */
  regionLabel?: string;
}

const ArtifactsTable = memo<ArtifactsTableProps>(({ items = [], labels, regionLabel }) => {
  const resolvedLabels = useMemo(
    () => ({
      artifact: 'Artifact',
      file: 'File',
      mime: 'MIME',
      scope: 'Scope',
      size: 'Size',
      storageKey: 'Storage key',
      ...labels,
    }),
    [labels],
  );

  const columns = useMemo<TableColumnType<ModuleAppArtifactRow>[]>(
    () => [
      { dataIndex: 'id', key: 'artifact', title: resolvedLabels.artifact },
      {
        dataIndex: 'scopeType',
        key: 'scope',
        render: (value) => value ?? '-',
        title: resolvedLabels.scope,
      },
      {
        dataIndex: 'fileName',
        key: 'file',
        render: (value) => value ?? '-',
        title: resolvedLabels.file,
      },
      {
        dataIndex: 'mimeType',
        key: 'mime',
        render: (value) => value ?? '-',
        title: resolvedLabels.mime,
      },
      {
        key: 'size',
        render: (_, record) =>
          record.sizeBytes === undefined || record.sizeBytes === null ? '-' : record.sizeBytes,
        title: resolvedLabels.size,
      },
      {
        dataIndex: 'storageKey',
        key: 'storageKey',
        render: (value) => value ?? '-',
        title: resolvedLabels.storageKey,
      },
    ],
    [resolvedLabels],
  );

  return (
    <AdminDataTable
      columns={columns}
      dataSource={items}
      regionLabel={regionLabel ?? resolvedLabels.artifact}
      rowKey="id"
    />
  );
});

ArtifactsTable.displayName = 'ArtifactsTable';

export default ArtifactsTable;
