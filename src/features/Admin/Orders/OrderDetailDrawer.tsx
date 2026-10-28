'use client';

import { Alert, Button, Descriptions, Drawer, Flexbox, Tag } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { formatAdminAmount } from '@/features/Admin/adminAmountUnits';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { ADMIN_EMPTY_TEXT } from '@/features/Admin/shared';

import type { AdminOrderDetail, OrderStatus } from './shared';
import {
  buildOrderAuditUrl,
  buildTopUpPaymentUrl,
  isOnlinePaymentOrder,
  statusColor,
} from './shared';

const renderDateTime = (value?: Date | null | string) =>
  value ? new Date(value).toLocaleString() : ADMIN_EMPTY_TEXT;

const OrderDetailDrawerBody = ({ orderDetail }: { orderDetail: AdminOrderDetail }) => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();

  return (
    <Flexbox gap={16}>
      <Descriptions
        bordered
        column={1}
        items={[
          {
            children: <code>{orderDetail.id}</code>,
            key: 'orderId',
            label: t('admin.orders.detail.orderId', '订单 ID'),
          },
          {
            children:
              orderDetail.userEmail ||
              orderDetail.userFullName ||
              orderDetail.userName ||
              orderDetail.userId,
            key: 'user',
            label: t('admin.orders.detail.user', '用户'),
          },
          {
            children: (
              <Tag color={statusColor[orderDetail.status as OrderStatus] ?? 'default'}>
                {orderDetail.status}
              </Tag>
            ),
            key: 'status',
            label: t('admin.orders.detail.status', '状态'),
          },
          {
            children: formatAdminAmount(orderDetail.amount, orderDetail.currency),
            key: 'amount',
            label: t('admin.orders.detail.amount', '金额'),
          },
          {
            children: formatAdminCredits(orderDetail.credits),
            key: 'credits',
            label: t('admin.orders.detail.credits', '积分'),
          },
          {
            children: (
              <>
                {orderDetail.provider || ADMIN_EMPTY_TEXT} /{' '}
                {orderDetail.source || ADMIN_EMPTY_TEXT}
              </>
            ),
            key: 'provider',
            label: t('admin.orders.detail.provider', '渠道'),
          },
          {
            children: orderDetail.externalOrderId || ADMIN_EMPTY_TEXT,
            key: 'externalOrderId',
            label: t('admin.orders.detail.externalOrderId', '外部订单号'),
          },
          {
            children: renderDateTime(orderDetail.createdAt),
            key: 'createdAt',
            label: t('admin.orders.detail.createdAt', '创建时间'),
          },
          {
            children: renderDateTime(orderDetail.paidAt),
            key: 'paidAt',
            label: t('admin.orders.detail.paidAt', '支付时间'),
          },
          {
            children: renderDateTime(orderDetail.updatedAt),
            key: 'updatedAt',
            label: t('admin.orders.detail.updatedAt', '更新时间'),
          },
        ]}
      />

      <Descriptions
        bordered
        column={1}
        title={t('admin.orders.detail.redemptionCode', '关联兑换码')}
        items={[
          {
            children: orderDetail.redemptionCodeId ? (
              <code>{orderDetail.redemptionCodeId}</code>
            ) : (
              ADMIN_EMPTY_TEXT
            ),
            key: 'redemptionCodeId',
            label: t('admin.orders.detail.redemptionCodeId', '兑换码 ID'),
          },
          {
            children: orderDetail.redemptionCode?.code ? (
              <code>{orderDetail.redemptionCode.code}</code>
            ) : (
              ADMIN_EMPTY_TEXT
            ),
            key: 'redemptionCodeValue',
            label: t('admin.orders.detail.redemptionCodeValue', '兑换码'),
          },
          {
            children: orderDetail.redemptionCode?.status || ADMIN_EMPTY_TEXT,
            key: 'redemptionCodeStatus',
            label: t('admin.orders.detail.redemptionCodeStatus', '兑换码状态'),
          },
          {
            children: orderDetail.redemptionCode?.batchId || ADMIN_EMPTY_TEXT,
            key: 'redemptionCodeBatch',
            label: t('admin.orders.detail.redemptionCodeBatch', '批次'),
          },
        ]}
      />

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
      {isOnlinePaymentOrder(orderDetail) ? (
        <Alert
          showIcon
          type="warning"
          action={
            <Button size="small" onClick={() => navigate(buildTopUpPaymentUrl(orderDetail.id))}>
              {t('admin.orders.reconcileOnline', '前往支付中心对账')}
            </Button>
          }
          message={t(
            'admin.orders.onlineManagedInPayments',
            '在线支付订单必须通过支付渠道查询结果进行对账，不能人工改为已支付。',
          )}
        />
      ) : null}
    </Flexbox>
  );
};

OrderDetailDrawerBody.displayName = 'OrderDetailDrawerBody';

export const OrderDetailDrawer = ({
  loading,
  onClose,
  open,
  orderDetail,
  orderDetailId,
}: {
  loading: boolean;
  onClose: () => void;
  open: boolean;
  orderDetail?: AdminOrderDetail;
  orderDetailId: string | null;
}) => {
  const { t } = useTranslation('subscription');

  return (
    <Drawer
      open={open}
      title={t('admin.orders.detail.title', '订单详情')}
      width={640}
      onClose={onClose}
    >
      {loading || !orderDetail ? (
        <Flexbox align="center" padding={24}>
          <NeuralNetworkLoading size={48} />
        </Flexbox>
      ) : (
        <OrderDetailDrawerBody key={orderDetailId} orderDetail={orderDetail} />
      )}
    </Drawer>
  );
};

OrderDetailDrawer.displayName = 'OrderDetailDrawer';
