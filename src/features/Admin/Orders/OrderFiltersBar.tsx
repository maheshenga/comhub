'use client';

import { Button, createStaticStyles,Input, Select } from '@lobehub/ui';

import type { OrderStatus } from './shared';

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

const ORDER_STATUS_OPTIONS = (
  ['pending', 'paid', 'canceled', 'expired', 'failed', 'refunded'] as const
).map((value) => ({ label: value, value }));

interface OrderFiltersBarProps {
  applyUserIdFilter: () => void;
  setStatus: (value: OrderStatus | undefined) => void;
  setUserIdDraft: (value: string) => void;
  status: OrderStatus | undefined;
  t: (key: any, defaultValue?: any, values?: any) => string;
  userIdDraft: string;
}

/** 订单列表筛选行（状态 Select + 用户 ID 搜索）。从 AdminOrdersPage 抽出以守住 300 行预算。 */
export const OrderFiltersBar = ({
  applyUserIdFilter,
  setStatus,
  setUserIdDraft,
  status,
  t,
  userIdDraft,
}: OrderFiltersBarProps) => (
  <div className={styles.filters}>
    <Select
      allowClear
      className={styles.status}
      options={ORDER_STATUS_OPTIONS}
      placeholder={t('admin.orders.filter.status', '状态')}
      value={status}
      onChange={(value: OrderStatus) => {
        setStatus(value);
      }}
    />
    {/* base-ui Input has no Search compound: explicit search button + Enter
        both apply the draft value (restores the antd onSearch affordance
        lost in the migration). */}
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
);
