'use client';

import { Flexbox } from '@lobehub/ui';
import { Tag } from '@lobehub/ui/base-ui';
import { Button, Space } from 'antd';
import type React from 'react';

import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';

import AdminDangerousActionButton from '../AdminDangerousActionButton';
import {
  isOnlinePaymentOrder,
  type OrderStatus,
  type PendingOrderCommand,
  statusColor,
} from './shared';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export interface BuildOrderColumnsParams {
  actingId: string | null;
  handlePendingAction: (
    orderId: string,
    action: 'cancel' | 'expire' | 'settle',
    command: PendingOrderCommand,
  ) => Promise<void>;
  navigateToReconcile: (orderId: string) => void;
  renderSettleConfirmDescription: (row: any) => React.ReactNode;
  setOrderDetailId: (id: string) => void;
  t: TFn;
}

export const buildOrderColumns = ({
  actingId,
  handlePendingAction,
  navigateToReconcile,
  renderSettleConfirmDescription,
  setOrderDetailId,
  t,
}: BuildOrderColumnsParams) =>
  [
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
          {isOnlinePaymentOrder(row) ? (
            <Button size="small" onClick={() => navigateToReconcile(row.id)}>
              {t('admin.orders.reconcileOnline', '前往支付中心对账')}
            </Button>
          ) : row.status === 'pending' ? (
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
