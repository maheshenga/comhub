import type { AdminDangerousActionEnvelope } from '../adminDangerousActions';
import { ADMIN_BASE_PATH } from '../adminNavigation';

export type OrderStatus = 'pending' | 'paid' | 'canceled' | 'expired' | 'failed' | 'refunded';

export type PendingOrderCommand =
  | AdminDangerousActionEnvelope<'order.cancel'>
  | AdminDangerousActionEnvelope<'order.expire'>
  | AdminDangerousActionEnvelope<'order.settle'>;

export type AdminOrderDetail = {
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

export const statusColor: Record<OrderStatus, string> = {
  canceled: 'default',
  expired: 'orange',
  failed: 'red',
  paid: 'green',
  pending: 'blue',
  refunded: 'purple',
};

export const buildOrderAuditUrl = (orderId: string) => {
  const searchParams = new URLSearchParams();
  searchParams.set('resourceType', 'top_up_order');
  searchParams.set('resourceId', orderId);

  return `${ADMIN_BASE_PATH}/audit?${searchParams.toString()}`;
};

export const buildTopUpPaymentUrl = (orderId: string) => {
  const searchParams = new URLSearchParams({ orderId, tab: 'topups' });
  return `${ADMIN_BASE_PATH}/payments?${searchParams.toString()}`;
};

export const isOnlinePaymentOrder = (order: {
  provider?: null | string;
  source?: null | string;
}) =>
  order.source !== 'redemption' &&
  order.provider !== 'redemption' &&
  ['alipay', 'wechat_pay', 'zpay'].includes(order.provider ?? '');
