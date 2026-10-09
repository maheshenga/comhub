'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Select, Tabs } from '@lobehub/ui/base-ui';
import { Input, message } from 'antd';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import InlineTable from '@/components/InlineTable';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminTopUpPackagesPage from './AdminTopUpPackagesPage';
import { AdminPageShell, AdminResponsiveTable, AdminSection, AdminToolbar } from './layout';
import { buildOrderColumns } from './Orders/orderColumns';
import { OrderDetailDrawer } from './Orders/OrderDetailDrawer';
import type { AdminOrderDetail, OrderStatus, PendingOrderCommand } from './Orders/shared';
import { buildTopUpPaymentUrl } from './Orders/shared';

const styles = createStaticStyles(({ css }) => ({
  filters: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    width: 100%;
  `,
  search: css`
    width: min(280px, 100%);
  `,
  status: css`
    width: 160px;

    @media (width < 560px) {
      width: 100%;
    }
  `,
}));

const AdminOrdersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();
  const [cursorStack, setCursorStack] = useState([0]);
  const cursor = cursorStack.at(-1) ?? 0;
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

  const columns = buildOrderColumns({
    actingId,
    handlePendingAction,
    navigateToReconcile: (orderId: string) => navigate(buildTopUpPaymentUrl(orderId)),
    renderSettleConfirmDescription,
    setOrderDetailId,
    t: t as any,
  });

  return (
    <AdminPageShell
      title={t('admin.orders.title', '订单管理')}
      width="full"
      description={t(
        'admin.orders.description',
        '查询平台订单、核对支付状态，并在审计保护下处理待支付异常。',
      )}
    >
      <Tabs
        items={[
          {
            children: (
              <AdminSection
                title={t('admin.orders.listTitle', '订单记录')}
                description={t('admin.orders.resultSummary', {
                  count: data?.items?.length ?? 0,
                  defaultValue: '本页显示 {{count}} 条订单',
                })}
              >
                <AdminToolbar>
                  <div className={styles.filters}>
                    <Select
                      allowClear
                      className={styles.status}
                      placeholder={t('admin.orders.filter.status', '状态')}
                      value={status}
                      options={(
                        ['pending', 'paid', 'canceled', 'expired', 'failed', 'refunded'] as const
                      ).map((value) => ({ label: value, value }))}
                      onChange={(value: OrderStatus) => {
                        setStatus(value);
                        setCursorStack([0]);
                      }}
                    />
                    <Input.Search
                      allowClear
                      className={styles.search}
                      placeholder={t('admin.orders.filter.userId', '用户 ID')}
                      onSearch={(value: string) => {
                        setUserId(value);
                        setCursorStack([0]);
                      }}
                    />
                  </div>
                </AdminToolbar>
                <AdminResponsiveTable label={t('admin.orders.tableLabel', '订单数据表')}>
                  <InlineTable
                    columns={columns}
                    dataSource={data?.items ?? []}
                    loading={isLoading}
                    rowKey="id"
                  />
                </AdminResponsiveTable>
                {(cursorStack.length > 1 || data?.nextCursor != null) && (
                  <Flexbox horizontal align="center" gap={8}>
                    <Button
                      disabled={cursorStack.length === 1}
                      onClick={() =>
                        setCursorStack((current) =>
                          current.length > 1 ? current.slice(0, -1) : current,
                        )
                      }
                    >
                      {t('admin.pagination.previous', '上一页')}
                    </Button>
                    <Button
                      disabled={data?.nextCursor == null}
                      loading={isLoading}
                      onClick={() => setCursorStack((current) => [...current, data!.nextCursor!])}
                    >
                      {t('admin.pagination.next', '下一页')}
                    </Button>
                  </Flexbox>
                )}
              </AdminSection>
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
      <OrderDetailDrawer
        loading={orderDetailLoading}
        open={!!orderDetailId}
        orderDetail={orderDetail}
        orderDetailId={orderDetailId}
        onClose={() => setOrderDetailId(null)}
      />
    </AdminPageShell>
  );
});

AdminOrdersPage.displayName = 'AdminOrdersPage';

export default AdminOrdersPage;
