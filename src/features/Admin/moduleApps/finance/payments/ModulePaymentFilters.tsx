'use client';

import { Input, Select } from '@lobehub/ui/base-ui';

import { modulePaymentStyles as styles } from './modulePaymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export interface ModulePaymentFiltersProps {
  appIdInput: string;
  discrepancyStatus?: string;
  onAppIdInput: (value: string) => void;
  onOrderIdInput: (value: string) => void;
  orderIdInput: string;
  paymentStatus?: string;
  refundStatus?: string;
  statusLabels: Record<string, string>;
  t: TFn;
  updateFilter: (key: string, value: string) => void;
}

/** 模块支付对账筛选区（支付状态 / 退款状态 / 差异状态 / 应用 / 订单，M5 拆页抽出）。 */
export const ModulePaymentFilters = ({
  appIdInput,
  discrepancyStatus,
  onAppIdInput,
  onOrderIdInput,
  orderIdInput,
  paymentStatus,
  refundStatus,
  statusLabels,
  t,
  updateFilter,
}: ModulePaymentFiltersProps) => (
  <div className={styles.controls}>
    <label>
      {t('moduleApps.admin.payments.filters.paymentStatus')}
      <Select
        value={paymentStatus ?? ''}
        options={['', 'created', 'pending', 'paid', 'failed', 'refunded'].map((value) => ({
          label: value
            ? statusLabels[value as keyof typeof statusLabels]
            : t('moduleApps.admin.payments.filters.all'),
          value,
        }))}
        onChange={(value) => updateFilter('paymentStatus', String(value ?? ''))}
      />
    </label>
    <label>
      {t('moduleApps.admin.payments.filters.refundStatus')}
      <Select
        value={refundStatus ?? ''}
        options={['', 'requested', 'succeeded', 'failed'].map((value) => ({
          label: value
            ? statusLabels[value as keyof typeof statusLabels]
            : t('moduleApps.admin.payments.filters.all'),
          value,
        }))}
        onChange={(value) => updateFilter('refundStatus', String(value ?? ''))}
      />
    </label>
    <label>
      {t('moduleApps.admin.payments.filters.discrepancyStatus')}
      <Select
        value={discrepancyStatus ?? ''}
        options={['', 'open', 'resolved'].map((value) => ({
          label: value
            ? statusLabels[value as keyof typeof statusLabels]
            : t('moduleApps.admin.payments.filters.all'),
          value,
        }))}
        onChange={(value) => updateFilter('discrepancyStatus', String(value ?? ''))}
      />
    </label>
    <label>
      {t('moduleApps.admin.payments.filters.appId')}
      <Input
        maxLength={36}
        value={appIdInput}
        onChange={(event) => onAppIdInput(event.target.value)}
      />
    </label>
    <label>
      {t('moduleApps.admin.payments.filters.orderId')}
      <Input
        maxLength={36}
        value={orderIdInput}
        onChange={(event) => onOrderIdInput(event.target.value)}
      />
    </label>
  </div>
);
