'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Input, Select, Tabs, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import InlineTable from '@/components/InlineTable';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { buildAdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminTopUpPackagesPage from './AdminTopUpPackagesPage';
import { AdminPageShell, AdminResponsiveTable, AdminSection, AdminToolbar } from './layout';
import {
  BulkDryRunAlert,
  type BulkOrderDryRun,
  isBulkEligibleOrder,
  OrderBulkToolbar,
  orderRowSelection,
} from './Orders/orderBulkToolbar';
import { buildOrderColumns } from './Orders/orderColumns';
import { OrderDetailDrawer } from './Orders/OrderDetailDrawer';
import type { AdminOrderDetail, OrderStatus, PendingOrderCommand } from './Orders/shared';
import { buildTopUpPaymentUrl } from './Orders/shared';
import { useAdminCursorQuery } from './shared/useAdminCursorQuery';

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
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [userId, setUserId] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [orderDetailId, setOrderDetailId] = useState<string | null>(null);
  // T1 样板（ux-redesign-spec §3.4/§6 B3）：游标栈与 deps 重置收编进
  // useAdminCursorQuery。cursor 落 swrKey[1]（AdminPagination.test mock 按位
  // 置读取），status/userId 作为 deps 追加；首页 fetch 序列化层保持 cursor ?? 0。
  // refresh 直接用 primitive 的 mutate（swrKey 单一事实源在 hook 内部）。
  const trimUserId = userId.trim();
  // Draft state for the user-ID filter input: typing must not refetch per
  // keystroke (userId drives the query deps); the explicit search button and
  // Enter commit the draft (applyUserIdFilter below).
  const [userIdDraft, setUserIdDraft] = useState('');
  const ordersQuery = useAdminCursorQuery<number, { items: any[]; nextCursor: number | null }>({
    key: 'admin-orders',
    deps: [status, trimUserId],
    fetcher: ({ cursor, limit }) =>
      adminCommercialService.listOrders({
        cursor: cursor ?? 0,
        limit,
        status,
        userId: trimUserId || undefined,
      }),
  });
  const { data, isLoading } = ordersQuery;
  const { data: orderDetail, isLoading: orderDetailLoading } = useClientDataSWR(
    orderDetailId ? ['admin-order-detail', orderDetailId] : null,
    async (): Promise<AdminOrderDetail> =>
      adminCommercialService.getOrderDetail(orderDetailId!) as any,
  );

  // M5 §5.2 批量：仅 pending 订单可勾选；批量动作走 dry-run 预检 + 信封确认。
  const orderRows = useMemo(() => data?.items ?? [], [data]);
  const bulkEligibleIds = useMemo(
    () => orderRows.filter(isBulkEligibleOrder).map((row: any) => row.id as string),
    [orderRows],
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const effectiveSelectedIds = useMemo(
    () => selectedOrderIds.filter((id) => bulkEligibleIds.includes(id)),
    [selectedOrderIds, bulkEligibleIds],
  );
  const [bulkDryRun, setBulkDryRun] = useState<BulkOrderDryRun | null>(null);

  const runBulkDryRun = async (orderIds: string[], action: 'bulkCancel' | 'bulkExpire') => {
    const actionId = action === 'bulkCancel' ? 'order.bulkCancel' : 'order.bulkExpire';
    const command = buildAdminDangerousActionEnvelope(actionId, { confirmed: true });
    const preview =
      action === 'bulkCancel'
        ? await adminCommercialService.bulkCancelOrders(orderIds, command as any)
        : await adminCommercialService.bulkExpireOrders(orderIds, command as any);
    setBulkDryRun(preview);
    return preview;
  };

  const refresh = async () => ordersQuery.mutate();
  const applyUserIdFilter = () => {
    setUserId(userIdDraft);
    ordersQuery.state.reset();
  };
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
      toast.success(t('admin.orders.actionSuccess', '订单已更新'));
      await refresh();
    } catch {
      toast.error(t('admin.orders.actionFailed', '订单更新失败'));
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
                        ordersQuery.state.reset();
                      }}
                    />
                    {/* base-ui Input has no Search compound: explicit search
                        button + Enter both apply the draft value (restores
                        the antd onSearch affordance lost in the migration). */}
                    <Input
                      allowClear
                      className={styles.search}
                      placeholder={t('admin.orders.filter.userId', '用户 ID')}
                      value={userIdDraft}
                      onChange={(event) => setUserIdDraft(event.currentTarget.value)}
                      onPressEnter={() => applyUserIdFilter()}
                    />
                    <Button
                      aria-label={t('admin.orders.filter.userId', '用户 ID')}
                      size="small"
                      onClick={() => applyUserIdFilter()}
                    >
                      {t('admin.orders.filter.search', '搜索')}
                    </Button>
                  </div>
                  {effectiveSelectedIds.length > 0 ? (
                    <OrderBulkToolbar
                      effectiveSelectedIds={effectiveSelectedIds}
                      orderRows={orderRows as any}
                      refresh={refresh}
                      setBulkDryRun={setBulkDryRun}
                      t={t as any}
                      onClearSelection={() => setSelectedOrderIds([])}
                      onDryRun={runBulkDryRun}
                    />
                  ) : null}
                </AdminToolbar>
                <BulkDryRunAlert
                  dryRun={bulkDryRun}
                  t={t as any}
                  onDismiss={() => setBulkDryRun(null)}
                />
                <AdminResponsiveTable label={t('admin.orders.tableLabel', '订单数据表')}>
                  <InlineTable
                    columns={columns}
                    dataSource={data?.items ?? []}
                    loading={isLoading}
                    rowKey="id"
                    rowSelection={orderRowSelection(effectiveSelectedIds, setSelectedOrderIds)}
                  />
                </AdminResponsiveTable>
                {(ordersQuery.hasPrevious || ordersQuery.hasNext) && (
                  <Flexbox horizontal align="center" gap={8}>
                    <Button
                      disabled={!ordersQuery.hasPrevious}
                      onClick={ordersQuery.pager.onPrevious}
                    >
                      {t('admin.pagination.previous', '上一页')}
                    </Button>
                    <Button
                      disabled={!ordersQuery.hasNext}
                      loading={isLoading}
                      onClick={ordersQuery.pager.onNext}
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
