'use client';

import type { ModuleAppPublisherStatus } from '@lobechat/types';
import { CopyButton, Flexbox } from '@lobehub/ui';
import { Tag, Text } from '@lobehub/ui/base-ui';
import type { TableProps } from 'antd';
import { memo, type ReactNode } from 'react';

import { ADMIN_EMPTY_TEXT, AdminDataTable } from '../shared';
import { AdminTableState } from './AdminTableState';

export type ModuleAppPublisherRow = {
  appCount: number;
  createdAt?: Date | string;
  displayName: string;
  id: string;
  recipientMask?: null | string;
  status: ModuleAppPublisherStatus;
  suspensionReason?: null | string;
  userId: string;
};

export type PublisherTableLabels = {
  columns: {
    apps: string;
    id: string;
    owner: string;
    publisher: string;
    recipient: string;
    status: string;
  };
  empty: string;
  loading: string;
  next: string;
  previous: string;
  retry: string;
  status: Record<ModuleAppPublisherRow['status'], string>;
  suspensionReasonEmpty: string;
};

type PublisherTableLabelOverrides = Omit<Partial<PublisherTableLabels>, 'columns' | 'status'> & {
  columns?: Partial<PublisherTableLabels['columns']>;
  status?: Partial<PublisherTableLabels['status']>;
};

const defaultLabels: PublisherTableLabels = {
  columns: {
    apps: 'Apps',
    id: 'ID',
    owner: 'Owner',
    publisher: 'Publisher',
    recipient: 'Alipay recipient',
    status: 'Status',
  },
  empty: 'No publishers',
  loading: 'Loading publishers',
  next: 'Next page',
  previous: 'Previous page',
  retry: 'Retry',
  status: {
    pending: 'Pending',
    suspended: 'Suspended',
    verified: 'Verified',
  },
  // F12：空占位统一为 repo 惯例的 '-'（原 '—' 与审计域口径不一致）。
  suspensionReasonEmpty: ADMIN_EMPTY_TEXT,
};

const PublisherTable = memo(
  ({
    error,
    hasNext,
    positionLabel,
    hasPrevious,
    items = [],
    labels,
    loading,
    onNext,
    actionsTitle = 'Actions',
    regionLabel,
    renderActions,
    onPrevious,
    onRetry,
    showPager,
  }: {
    error?: unknown;
    actionsTitle?: string;
    hasNext?: boolean;
    positionLabel?: string;
    hasPrevious?: boolean;
    items?: ModuleAppPublisherRow[];
    labels?: PublisherTableLabelOverrides;
    loading?: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    onRetry?: () => void;
    /** 无障碍滚动区名字；页面可传本地化标题，缺省回退到发布者列名。 */
    regionLabel?: string;
    renderActions?: (publisher: ModuleAppPublisherRow) => ReactNode;
    showPager?: boolean;
  }) => {
    const resolvedLabels: PublisherTableLabels = {
      ...defaultLabels,
      ...labels,
      columns: { ...defaultLabels.columns, ...labels?.columns },
      status: { ...defaultLabels.status, ...labels?.status },
    };
    const columns: NonNullable<TableProps<ModuleAppPublisherRow>['columns']> = [
      {
        dataIndex: 'displayName',
        key: 'displayName',
        title: resolvedLabels.columns.publisher,
      },
      {
        dataIndex: 'id',
        key: 'id',
        render: (value: string) => (
          <Flexbox horizontal align="center" gap={2}>
            <Text code>{value}</Text>
            <CopyButton content={value} size="small" />
          </Flexbox>
        ),
        title: resolvedLabels.columns.id,
      },
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (value: string) => <Text code>{value}</Text>,
        title: resolvedLabels.columns.owner,
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value: ModuleAppPublisherStatus, record) => (
          <Flexbox gap={4}>
            <Tag color={value === 'verified' ? 'green' : value === 'suspended' ? 'red' : 'gold'}>
              {resolvedLabels.status[value]}
            </Tag>
            {value === 'suspended' ? (
              <Text ellipsis={{ tooltip: record.suspensionReason || undefined }} type="secondary">
                {record.suspensionReason || resolvedLabels.suspensionReasonEmpty}
              </Text>
            ) : null}
          </Flexbox>
        ),
        title: resolvedLabels.columns.status,
      },
      {
        dataIndex: 'recipientMask',
        key: 'recipientMask',
        title: resolvedLabels.columns.recipient,
      },
      { dataIndex: 'appCount', key: 'appCount', title: resolvedLabels.columns.apps },
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
          emptyLabel={resolvedLabels.empty}
          error={error}
          loading={loading}
          loadingLabel={resolvedLabels.loading}
          retryLabel={resolvedLabels.retry}
          onRetry={onRetry}
        >
          {items.length ? (
            <AdminDataTable
              columns={columns}
              dataSource={items}
              regionLabel={regionLabel ?? resolvedLabels.columns.publisher}
              rowKey="id"
              pager={
                (showPager ?? Boolean(hasNext || hasPrevious || onNext || onPrevious))
                  ? {
                      hasNext: Boolean(hasNext),
                      hasPrevious: Boolean(hasPrevious),
                      nextLabel: resolvedLabels.next,
                      positionLabel,
                      previousLabel: resolvedLabels.previous,
                      onNext: () => onNext?.(),
                      onPrevious: () => onPrevious?.(),
                    }
                  : undefined
              }
            />
          ) : null}
        </AdminTableState>
      </Flexbox>
    );
  },
);

PublisherTable.displayName = 'PublisherTable';

export default PublisherTable;
