'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Checkbox, Tag, Typography } from 'antd';
import { memo, useMemo, useState } from 'react';

import InlineTable from '@/components/InlineTable';

const { Text } = Typography;

export type ModuleAppRevenueRow = {
  appId: string;
  createdAt?: Date | string;
  currency: string;
  developerAmount: number;
  grossAmount: number;
  id: string;
  orderId: string;
  platformFee: number;
  publisherUserId?: null | string;
  reserveAmount: number;
  settlementBatchId?: null | string;
  status: string;
  type: string;
};

type CommerceTableProps = {
  items?: ModuleAppRevenueRow[];
  loading?: boolean;
  onSettle: (entryIds: string[]) => Promise<void>;
};

const formatAmount = (value: number, currency: string) =>
  `${currency} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })}`;

const CommerceTable = memo<CommerceTableProps>(({ items = [], loading, onSettle }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settling, setSettling] = useState(false);
  const selectableIds = useMemo(
    () => new Set(items.filter((item) => item.type === 'accrual' && item.status === 'pending').map((item) => item.id)),
    [items],
  );
  const validSelectedIds = selectedIds.filter((id) => selectableIds.has(id));

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    );
  };

  const settle = async () => {
    const entryIds = validSelectedIds;
    if (entryIds.length === 0) return;
    setSettling(true);
    try {
      await onSettle(entryIds);
      setSelectedIds([]);
    } finally {
      setSettling(false);
    }
  };

  const columns = [
    {
      key: 'select',
      render: (_: unknown, row: ModuleAppRevenueRow) => {
        const selectable = selectableIds.has(row.id);
        return (
          <Checkbox
            aria-label={`Select revenue ${row.id}`}
            checked={selectedIds.includes(row.id)}
            disabled={!selectable}
            onChange={(event) => toggle(row.id, event.target.checked)}
          />
        );
      },
      width: 48,
    },
    { dataIndex: 'orderId', key: 'orderId', render: (value: string) => <Text code>{value}</Text>, title: 'Order' },
    { dataIndex: 'publisherUserId', key: 'publisherUserId', render: (value?: null | string) => value ?? 'Platform', title: 'Publisher' },
    { dataIndex: 'type', key: 'type', render: (value: string) => <Tag>{value}</Tag>, title: 'Type' },
    { key: 'gross', render: (_: unknown, row: ModuleAppRevenueRow) => formatAmount(row.grossAmount, row.currency), title: 'Gross' },
    { key: 'platform', render: (_: unknown, row: ModuleAppRevenueRow) => formatAmount(row.platformFee, row.currency), title: 'Platform fee' },
    { key: 'reserve', render: (_: unknown, row: ModuleAppRevenueRow) => formatAmount(row.reserveAmount, row.currency), title: 'Reserve' },
    { key: 'developer', render: (_: unknown, row: ModuleAppRevenueRow) => formatAmount(row.developerAmount, row.currency), title: 'Developer' },
    { dataIndex: 'status', key: 'status', render: (value: string) => <Tag color={value === 'settled' ? 'green' : value === 'reversed' ? 'red' : 'gold'}>{value}</Tag>, title: 'Status' },
  ];

  return (
    <Flexbox data-testid="admin-module-app-commerce-table" gap={12}>
      <Flexbox horizontal align="center" justify="space-between">
        <Text type="secondary">
          Product revenue only. Runtime, AI, storage, and network costs are excluded.
        </Text>
        <Button disabled={validSelectedIds.length === 0} loading={settling} type="primary" onClick={settle}>
          Settle selected
        </Button>
      </Flexbox>
      <InlineTable columns={columns as any} dataSource={items} loading={loading} rowKey="id" />
    </Flexbox>
  );
});

CommerceTable.displayName = 'CommerceTable';

export default CommerceTable;
