'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Descriptions, Drawer, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';

import type { AdminOrderDetail, OrderStatus } from './shared';
import {
  buildOrderAuditUrl,
  buildTopUpPaymentUrl,
  isOnlinePaymentOrder,
  statusColor,
} from './shared';

const renderDateTime = (value?: Date | null | string) =>
  value ? new Date(value).toLocaleString() : '-';

const OrderDetailDrawerBody = ({
  orderDetail,
}: {
  orderDetail: AdminOrderDetail;
}) => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();

  return (
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
        <Descriptions.Item label={t('admin.orders.detail.redemptionCodeStatus', '兑换码状态')}>
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
      destroyOnClose
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
