'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Input, message, Popconfirm, Select, Space, Tag } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type OrderStatus = 'pending' | 'paid' | 'canceled' | 'expired' | 'failed' | 'refunded';

const statusColor: Record<OrderStatus, string> = {
  canceled: 'default',
  expired: 'orange',
  failed: 'red',
  paid: 'green',
  pending: 'blue',
  refunded: 'purple',
};

const AdminOrdersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [userId, setUserId] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const swrKey = useMemo(
    () => ['admin-orders', cursor, status, userId.trim()] as const,
    [cursor, status, userId],
  );
  const { data, isLoading } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listOrders({
      cursor,
      limit: 50,
      status,
      userId: userId.trim() || undefined,
    }),
  );

  const refresh = async () => mutate(swrKey);

  const handlePendingAction = async (orderId: string, action: 'cancel' | 'expire') => {
    setActingId(orderId);
    try {
      if (action === 'cancel') await adminCommercialService.cancelOrder(orderId);
      else await adminCommercialService.expireOrder(orderId);
      message.success(t('admin.orders.actionSuccess', '订单已更新'));
      await refresh();
    } catch {
      message.error(t('admin.orders.actionFailed', '订单更新失败'));
    } finally {
      setActingId(null);
    }
  };

  const columns = [
    {
      dataIndex: 'id',
      key: 'id',
      render: (v: string) => <code>{v.slice(0, 12)}</code>,
      title: t('admin.orders.col.id', '订单 ID'),
    },
    {
      dataIndex: 'userId',
      key: 'userId',
      render: (v: string, r: any) => (
        <Flexbox gap={2}>
          <code>{v.slice(0, 12)}</code>
          <span>{r.userEmail || r.userName || '—'}</span>
        </Flexbox>
      ),
      title: t('admin.orders.col.user', '用户'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: OrderStatus) => <Tag color={statusColor[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.orders.col.status', '状态'),
    },
    {
      dataIndex: 'credits',
      key: 'credits',
      title: t('admin.orders.col.credits', '积分'),
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number, r: any) => `${r.currency || 'USD'} ${v}`,
      title: t('admin.orders.col.amount', '金额'),
    },
    {
      dataIndex: 'provider',
      key: 'provider',
      render: (v: string | null) => v || '—',
      title: t('admin.orders.col.provider', '支付渠道（Provider）'),
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: Date) => (v ? new Date(v).toLocaleString() : '—'),
      title: t('admin.orders.col.createdAt', '创建时间'),
      width: 180,
    },
    {
      key: 'actions',
      render: (_: unknown, r: any) =>
        r.status === 'pending' ? (
          <Space>
            <Popconfirm
              title={t('admin.orders.expireConfirm', '确认将这个待支付订单设为过期？')}
              onConfirm={() => handlePendingAction(r.id, 'expire')}
            >
              <Button loading={actingId === r.id} size="small">
                {t('admin.orders.expire', '设为过期')}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('admin.orders.cancelConfirm', '确认取消这个待支付订单？')}
              onConfirm={() => handlePendingAction(r.id, 'cancel')}
            >
              <Button danger loading={actingId === r.id} size="small">
                {t('admin.orders.cancel', '取消订单')}
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
      title: t('admin.actions', '操作'),
      width: 180,
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" gap={12}>
        <Select<OrderStatus>
          allowClear
          placeholder={t('admin.orders.filter.status', '状态')}
          style={{ width: 160 }}
          value={status}
          options={(['pending', 'paid', 'canceled', 'expired', 'failed', 'refunded'] as const).map(
            (value) => ({ label: value, value }),
          )}
          onChange={(value) => {
            setStatus(value);
            setCursor(0);
          }}
        />
        <Input.Search
          allowClear
          placeholder={t('admin.orders.filter.userId', '用户 ID')}
          style={{ width: 260 }}
          onSearch={(value) => {
            setUserId(value);
            setCursor(0);
          }}
        />
      </Flexbox>
      <InlineTable
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        rowKey="id"
      />
      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
            {t('admin.orders.loadMore', '加载更多')}
          </Button>
        </Flexbox>
      )}
    </Flexbox>
  );
});

AdminOrdersPage.displayName = 'AdminOrdersPage';

export default AdminOrdersPage;
