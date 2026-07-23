'use client';

import type { ModuleAppPublisherStatus } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Tag, Typography } from 'antd';
import { type ReactNode, memo } from 'react';

import InlineTable from '@/components/InlineTable';

import { AdminTableState } from './AdminTableState';
import CursorPager from './CursorPager';

const { Text } = Typography;

export type ModuleAppPublisherRow = {
  appCount: number;
  createdAt?: Date | string;
  displayName: string;
  id: string;
  recipientMask?: null | string;
  status: ModuleAppPublisherStatus;
  userId: string;
};

const PublisherTable = memo(
  ({
    error,
    hasNext,
    hasPrevious,
    items = [],
    loading,
    onNext,
    actionsTitle = 'Actions',
    renderActions,
    onPrevious,
    onRetry,
  }: {
    error?: unknown;
    actionsTitle?: string;
    hasNext?: boolean;
    hasPrevious?: boolean;
    items?: ModuleAppPublisherRow[];
    loading?: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    onRetry?: () => void;
    renderActions?: (publisher: ModuleAppPublisherRow) => ReactNode;
  }) => {
    const columns = [
      { dataIndex: 'displayName', key: 'displayName', title: 'Publisher' },
      {
        dataIndex: 'id',
        key: 'id',
        render: (value: string) => (
          <Text code copyable>
            {value}
          </Text>
        ),
        title: 'ID',
      },
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (value: string) => <Text code>{value}</Text>,
        title: 'Owner',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value: ModuleAppPublisherStatus) => (
          <Tag color={value === 'verified' ? 'green' : value === 'suspended' ? 'red' : 'gold'}>
            {value}
          </Tag>
        ),
        title: 'Status',
      },
      { dataIndex: 'recipientMask', key: 'recipientMask', title: 'Alipay recipient' },
      { dataIndex: 'appCount', key: 'appCount', title: 'Apps' },
    ];
    if (renderActions) {
      columns.push({
        key: 'actions',
        render: (_: unknown, publisher: ModuleAppPublisherRow) => renderActions(publisher),
        title: actionsTitle,
      });
    }
    return (
      <Flexbox gap={10}>
        <AdminTableState
          emptyLabel="No publishers"
          error={error}
          loading={loading}
          loadingLabel="Loading publishers"
          onRetry={onRetry}
        >
          {items.length ? (
            <InlineTable columns={columns as any} dataSource={items} rowKey="id" />
          ) : null}
        </AdminTableState>
        <CursorPager
          hasNext={hasNext}
          hasPrevious={hasPrevious}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      </Flexbox>
    );
  },
);

PublisherTable.displayName = 'PublisherTable';

export default PublisherTable;
