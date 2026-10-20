'use client';

import { createStaticStyles } from '@lobehub/ui';

import type { AdminDataTablePagerState } from '../shared';

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
  // 页面级容器间距对齐壳的 page gap 约定（adminPageStyles.page: 24px），
  // 避免 Tab 切换时同一支付中心内 16px/24px 间距跳变。
  page: css`
    display: grid;
    gap: 24px;
    min-width: 0;
  `,
  refundForm: css`
    display: grid;
    gap: 8px;
  `,
}));

export const ONLINE_PAYMENT_PROVIDERS = [
  'alipay',
  'wechat_pay',
  'zpay',
] as const satisfies readonly string[];

/** 三张支付表的游标页大小（列表接口 limit 与游标步长共用）。 */
export const PAYMENTS_PAGE_SIZE = 25;

/**
 * 支付中心三个子页共享的游标分页器状态：统一交给 AdminDataTable 的 pager
 * prop（内置上一页/下一页 + 位置标签），取代各处手写的
 * Space + Button + PagerPositionLabel 组合。
 * 返回 undefined 表示无可翻页内容，AdminDataTable 不渲染分页条。
 */
export const buildPaymentsPager = ({
  cursor,
  label,
  nextCursor,
  onCursorChange,
}: {
  cursor: number;
  label: string;
  nextCursor: null | number | undefined;
  onCursorChange: (next: number) => void;
}): AdminDataTablePagerState | undefined => {
  const hasNext = nextCursor != null;
  if (cursor <= 0 && !hasNext) return undefined;

  return {
    hasNext,
    hasPrevious: cursor > 0,
    positionLabel: label,
    onNext: () => {
      if (nextCursor != null) onCursorChange(nextCursor);
    },
    onPrevious: () => onCursorChange(Math.max(0, cursor - PAYMENTS_PAGE_SIZE)),
  };
};

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
