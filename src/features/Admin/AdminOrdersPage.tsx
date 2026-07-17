'use client';

import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Input,
  message,
  Select,
  Space,
  Tabs,
  Tag,
} from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import InlineTable from '@/components/InlineTable';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminDangerousActionButton from './AdminDangerousActionButton';
import type { AdminDangerousActionEnvelope } from './adminDangerousActions';
import { ADMIN_BASE_PATH } from './adminNavigation';
import AdminTopUpPackagesPage from './AdminTopUpPackagesPage';

type OrderStatus = 'pending' | 'paid' | 'canceled' | 'expired' | 'failed' | 'refunded';
type PendingOrderCommand =
  | AdminDangerousActionEnvelope<'order.cancel'>
  | AdminDangerousActionEnvelope<'order.expire'>
  | AdminDangerousActionEnvelope<'order.settle'>;

type AdminOrderDetail = {
  amount?: number | string;
  createdAt?: Date | null | string;
  credits?: number | string;
  currency?: null | string;
  externalOrderId?: null | string;
  id: string;
  paidAt?: Date | null | string;
  provider?: null | string;
  redemptionCode?: null | {
    batchId?: null | string;
    code?: null | string;
    status?: null | string;
  };
  redemptionCodeId?: null | string;
  source?: null | string;
  status: string;
  updatedAt?: Date | null | string;
  userEmail?: null | string;
  userFullName?: null | string;
  userId: string;
  userName?: null | string;
};

const statusColor: Record<OrderStatus, string> = {
  canceled: 'default',
  expired: 'orange',
  failed: 'red',
  paid: 'green',
  pending: 'blue',
  refunded: 'purple',
};

const buildOrderAuditUrl = (orderId: string) => {
  const searchParams = new URLSearchParams();
  searchParams.set('resourceType', 'top_up_order');
  searchParams.set('resourceId', orderId);

  return `${ADMIN_BASE_PATH}/audit?${searchParams.toString()}`;
};

const AdminOrdersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [userId, setUserId] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [orderDetailId, setOrderDetailId] = useState<string | null>(null);
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
  const { data: orderDetail, isLoading: orderDetailLoading } = useClientDataSWR(
    orderDetailId ? ['admin-order-detail', orderDetailId] : null,
    async (): Promise<AdminOrderDetail> =>
      adminCommercialService.getOrderDetail(orderDetailId!) as any,
  );

  const refresh = async () => mutate(swrKey);

  const handlePendingAction = async (
    orderId: string,
    action: 'cancel' | 'expire' | 'settle',
    command: PendingOrderCommand,
  ) => {
    setActingId(orderId);
    try {
      if (action === 'cancel' && command.actionId === 'order.cancel') {
        await adminCommercialService.cancelOrder(orderId, command);
      } else if (action === 'expire' && command.actionId === 'order.expire') {
        await adminCommercialService.expireOrder(orderId, command);
      } else if (action === 'settle' && command.actionId === 'order.settle') {
        await adminCommercialService.settleOrder(
          { orderId, reason: command.reason?.trim() ?? '' },
          command,
        );
      }
      message.success(t('admin.orders.actionSuccess', '订单已更新'));
      await refresh();
    } catch {
      message.error(t('admin.orders.actionFailed', '订单更新失败'));
    } finally {
      setActingId(null);
    }
  };

  const renderSettleConfirmDescription = (row: any) => (
    <Flexbox gap={4}>
      <span>
        {t(
          'admin.orders.settleConfirmDescription',
          '该操作会将订单标记为已支付并发放积分，请核对以下信息。',
        )}
      </span>
      <span>
        {t('admin.orders.settleConfirmOrder', '订单')}：<code>{row.id}</code>
      </span>
      <span>
        {t('admin.orders.settleConfirmUser', '用户')}：{row.userEmail || row.userName || row.userId}
      </span>
      <span>
        {t('admin.orders.settleConfirmAmount', '金额')}：{row.currency || 'CNY'} {row.amount}
      </span>
      <span>
        {t('admin.orders.settleConfirmCredits', '积分')}：{formatAdminCredits(row.credits)}
      </span>
      <span>
        {t('admin.orders.settleConfirmProvider', '渠道')}：{row.provider || '-'} /{' '}
        {row.source || '-'}
      </span>
    </Flexbox>
  );

  const renderDateTime = (value?: Date | null | string) =>
    value ? new Date(value).toLocaleString() : '-';

  const columns = [
    {
      dataIndex: 'id',
      key: 'id',
      render: (value: string) => <code>{value.slice(0, 12)}</code>,
      title: t('admin.orders.col.id', '订单 ID'),
    },
    {
      dataIndex: 'userId',
      key: 'userId',
      render: (value: string, row: any) => (
        <Flexbox gap={2}>
          <code>{value.slice(0, 12)}</code>
          <span>{row.userEmail || row.userName || '-'}</span>
        </Flexbox>
      ),
      title: t('admin.orders.col.user', '用户'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (value: OrderStatus) => <Tag color={statusColor[value] ?? 'default'}>{value}</Tag>,
      title: t('admin.orders.col.status', '状态'),
    },
    {
      dataIndex: 'credits',
      key: 'credits',
      render: (value: number | string) => formatAdminCredits(value),
      title: t('admin.orders.col.credits', '积分'),
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number, row: any) => `${row.currency || 'CNY'} ${value}`,
      title: t('admin.orders.col.amount', '金额'),
    },
    {
      dataIndex: 'provider',
      key: 'provider',
      render: (value: string | null) => value || '-',
      title: t('admin.orders.col.provider', '支付渠道（Provider）'),
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: Date) => (value ? new Date(value).toLocaleString() : '-'),
      title: t('admin.orders.col.createdAt', '创建时间'),
      width: 180,
    },
    {
      key: 'actions',
      render: (_: unknown, row: any) => (
        <Space>
          <Button size="small" onClick={() => setOrderDetailId(row.id)}>
            {t('admin.orders.viewDetail', '查看')}
          </Button>
          {row.status === 'pending' ? (
            <>
              <AdminDangerousActionButton
                danger
                actionId="order.settle"
                confirmDescription={renderSettleConfirmDescription(row)}
                confirmTitle={t('admin.orders.settleConfirm', '确认手动结算这个待支付订单？')}
                loading={actingId === row.id}
                size="small"
                onConfirm={(input) => handlePendingAction(row.id, 'settle', input)}
              >
                {t('admin.orders.settle', '手动结算')}
              </AdminDangerousActionButton>
              <AdminDangerousActionButton
                actionId="order.expire"
                confirmTitle={t('admin.orders.expireConfirm', '确认将这个待支付订单设为过期？')}
                loading={actingId === row.id}
                size="small"
                onConfirm={(command) => handlePendingAction(row.id, 'expire', command)}
              >
                {t('admin.orders.expire', '设为过期')}
              </AdminDangerousActionButton>
              <AdminDangerousActionButton
                danger
                actionId="order.cancel"
                confirmTitle={t('admin.orders.cancelConfirm', '确认取消这个待支付订单？')}
                loading={actingId === row.id}
                size="small"
                onConfirm={(command) => handlePendingAction(row.id, 'cancel', command)}
              >
                {t('admin.orders.cancel', '取消订单')}
              </AdminDangerousActionButton>
            </>
          ) : null}
        </Space>
      ),
      title: t('admin.actions', '操作'),
      width: 320,
    },
  ];

  return (
    <Flexbox padding={24}>
      <Tabs
        items={[
          {
            children: (
              <Flexbox gap={16}>
                <Flexbox horizontal align="center" gap={12}>
                  <Select<OrderStatus>
                    allowClear
                    placeholder={t('admin.orders.filter.status', '状态')}
                    style={{ width: 160 }}
                    value={status}
                    options={(
                      ['pending', 'paid', 'canceled', 'expired', 'failed', 'refunded'] as const
                    ).map((value) => ({ label: value, value }))}
                    onChange={(value: OrderStatus) => {
                      setStatus(value);
                      setCursor(0);
                    }}
                  />
                  <Input.Search
                    allowClear
                    placeholder={t('admin.orders.filter.userId', '用户 ID')}
                    style={{ width: 260 }}
                    onSearch={(value: string) => {
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
            ),
            key: 'orders',
            label: t('admin.orders.tabs.orders', '订单列表'),
          },
          {
            children: <AdminTopUpPackagesPage embedded />,
            key: 'topup',
            label: t('admin.orders.tabs.topup', '充值套餐'),
          },
        ]}
      />
      <Drawer
        destroyOnClose
        open={!!orderDetailId}
        title={t('admin.orders.detail.title', '订单详情')}
        width={640}
        onClose={() => setOrderDetailId(null)}
      >
        {orderDetailLoading || !orderDetail ? (
          <Flexbox align="center" padding={24}>
            <NeuralNetworkLoading size={48} />
          </Flexbox>
        ) : (
          <Flexbox gap={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={t('admin.orders.detail.orderId', '订单 ID')}>
                <code>{orderDetail.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.user', '用户')}>
                {orderDetail.userEmail ||
                  orderDetail.userFullName ||
                  orderDetail.userName ||
                  orderDetail.userId}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.status', '状态')}>
                <Tag color={statusColor[orderDetail.status as OrderStatus] ?? 'default'}>
                  {orderDetail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.amount', '金额')}>
                {orderDetail.currency || 'CNY'} {orderDetail.amount}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.credits', '积分')}>
                {formatAdminCredits(orderDetail.credits)}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.provider', '渠道')}>
                {orderDetail.provider || '-'} / {orderDetail.source || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.externalOrderId', '外部订单号')}>
                {orderDetail.externalOrderId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.createdAt', '创建时间')}>
                {renderDateTime(orderDetail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.paidAt', '支付时间')}>
                {renderDateTime(orderDetail.paidAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.updatedAt', '更新时间')}>
                {renderDateTime(orderDetail.updatedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              bordered
              column={1}
              size="small"
              title={t('admin.orders.detail.redemptionCode', '关联兑换码')}
            >
              <Descriptions.Item label={t('admin.orders.detail.redemptionCodeId', '兑换码 ID')}>
                {orderDetail.redemptionCodeId ? <code>{orderDetail.redemptionCodeId}</code> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.redemptionCodeValue', '兑换码')}>
                {orderDetail.redemptionCode?.code ? (
                  <code>{orderDetail.redemptionCode.code}</code>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('admin.orders.detail.redemptionCodeStatus', '兑换码状态')}
              >
                {orderDetail.redemptionCode?.status || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.detail.redemptionCodeBatch', '批次')}>
                {orderDetail.redemptionCode?.batchId || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              showIcon
              type="info"
              action={
                <Link style={{ whiteSpace: 'nowrap' }} to={buildOrderAuditUrl(orderDetail.id)}>
                  {t('admin.orders.detail.viewAudit', '查看审计日志')}
                </Link>
              }
              message={t(
                'admin.orders.detail.auditHint',
                '如需追踪后台操作，请在审计日志中按订单 ID 检索。',
              )}
            />
          </Flexbox>
        )}
      </Drawer>
    </Flexbox>
  );
});

AdminOrdersPage.displayName = 'AdminOrdersPage';

export default AdminOrdersPage;
