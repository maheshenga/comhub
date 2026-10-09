'use client';

import { createStaticStyles } from 'antd-style';

export const paymentStyles = createStaticStyles(({ css, cssVar }) => ({
  controls: css`
    display: grid;
    grid-template-columns:
      repeat(2, minmax(160px, 220px)) minmax(220px, 1fr) minmax(220px, 1fr)
      auto;
    gap: 8px;
    align-items: end;

    @media (width <= 960px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  field: css`
    display: grid;
    gap: 6px;

    min-width: 0;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  page: css`
    display: grid;
    gap: 16px;
    min-width: 0;
  `,
  refundForm: css`
    display: grid;
    gap: 8px;
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
  `,
}));

export const ONLINE_PAYMENT_PROVIDERS = [
  'alipay',
  'wechat_pay',
  'zpay',
] as const satisfies readonly string[];

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'canceled',
  'expired',
  'failed',
  'refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export const parseSearchParam = <T extends string>(value: null | string, allowed: readonly T[]) =>
  value && allowed.includes(value as T) ? (value as T) : undefined;

export const statusColor: Record<PaymentStatus, string> = {
  canceled: 'default',
  expired: 'orange',
  failed: 'red',
  paid: 'green',
  pending: 'blue',
  refunded: 'purple',
};

export type PendingReconciliationResponse = {
  count: number;
  failedCount: number;
  results: Array<{ ok: boolean; orderId: string }>;
};
