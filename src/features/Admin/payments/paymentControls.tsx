'use client';

import { Alert, Button, Input, Modal, Select, TextArea  } from '@lobehub/ui/base-ui';
import { Space } from 'antd';
import { Search } from 'lucide-react';
import type * as React from 'react';

import {
  PAYMENT_STATUSES,
  paymentStyles as styles,
} from './paymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

/** 两页共用的退款行最小形状（订阅行带 displayName，充值行以 id 呈现）。 */
export type PaymentRefundOrderRow = {
  amount: number | string;
  currency: string;
  displayName?: string;
  id: string;
};

export interface PaymentRefundModalProps {
  busyRefunding: boolean;
  /** 文案键命名空间：subscriptions | topups。 */
  i18nNamespace?: string;
  onCancel: () => void;
  onOk: () => void;
  onReasonChange: (value: string) => void;
  reason: string;
  refundOrder?: PaymentRefundOrderRow;
  t: TFn;
  title: string;
}

/** 退款确认弹窗（M5 拆页：从 SubscriptionPaymentsPage / TopUpPaymentsPage 共用形态抽出）。 */
export const PaymentRefundModal = ({
  busyRefunding,
  i18nNamespace = 'subscriptions',
  onCancel,
  onOk,
  onReasonChange,
  reason,
  t,
  title,
  refundOrder,
}: PaymentRefundModalProps) => (
  <Modal
    cancelText={t('cancel', 'Cancel')}
    confirmLoading={busyRefunding}
    okButtonProps={{ disabled: !reason.trim() }}
    okText={t(`admin.payments.${i18nNamespace}.confirmRefund`, 'Confirm refund')}
    open={Boolean(refundOrder)}
    title={title}
    onCancel={onCancel}
    onOk={onOk}
  >
    <div className={styles.refundForm}>
      <div>
        {refundOrder
          ? `${refundOrder.currency} ${refundOrder.amount} · ${refundOrder.displayName}`
          : null}
      </div>
      <label>
        {t(`admin.payments.${i18nNamespace}.refundReason`, 'Refund reason')}
        <TextArea
          required
          maxLength={500}
          value={reason}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            onReasonChange(event.target.value)
          }
        />
      </label>
    </div>
  </Modal>
);

export interface PaymentFilterControlsProps {
  applyTextFilters: () => void;
  clearFilters: () => void;
  filterError?: string;
  /** 文案键命名空间：subscriptions | topups。 */
  i18nNamespace?: string;
  onOrderDraftChange: (value: string) => void;
  onProviderChange: (value: null | string) => void;
  onStatusChange: (value: null | string) => void;
  onUserDraftChange: (value: string) => void;
  orderDraft: string;
  provider?: string;
  status?: string;
  t: TFn;
  userDraft: string;
}

/** 支付列表筛选控件区（状态 / 渠道 / 订单 ID / 用户 ID）。 */
export const PaymentFilterControls = ({
  applyTextFilters,
  clearFilters,
  filterError,
  onOrderDraftChange,
  onProviderChange,
  onStatusChange,
  onUserDraftChange,
  orderDraft,
  provider,
  status,
  t,
  userDraft,
  i18nNamespace = 'subscriptions',
}: PaymentFilterControlsProps) => (
  <>
    <div className={styles.controls}>
      <label className={styles.field}>
        {t(`admin.payments.${i18nNamespace}.filters.status`, 'Status')}
        <Select
          value={status ?? ''}
          options={['', ...PAYMENT_STATUSES].map((value) => ({
            label: value
              ? t(`admin.payments.${i18nNamespace}.status.${value}`, value)
              : t(`admin.payments.${i18nNamespace}.filters.all`, 'All'),
            value,
          }))}
          onChange={(value: string) => onStatusChange(value || null)}
        />
      </label>
      <label className={styles.field}>
        {t(`admin.payments.${i18nNamespace}.filters.provider`, 'Provider')}
        <Select
          value={provider ?? ''}
          options={[
            { label: t(`admin.payments.${i18nNamespace}.filters.all`, 'All'), value: '' },
            { label: t('admin.payments.provider.alipay', 'Alipay'), value: 'alipay' },
            { label: t('admin.payments.provider.wechat', 'WeChat Pay'), value: 'wechat_pay' },
            { label: t('admin.payments.provider.zpay', 'Z-Pay'), value: 'zpay' },
          ]}
          onChange={(value: string) => onProviderChange(value || null)}
        />
      </label>
      <label className={styles.field}>
        {t(`admin.payments.${i18nNamespace}.filters.orderId`, 'Order ID')}
        <Input value={orderDraft} onChange={(event) => onOrderDraftChange(event.target.value)} />
      </label>
      <label className={styles.field}>
        {t(`admin.payments.${i18nNamespace}.filters.userId`, 'User ID')}
        <Input value={userDraft} onChange={(event) => onUserDraftChange(event.target.value)} />
      </label>
      <Space>
        <Button icon={<Search aria-hidden size={16} />} onClick={applyTextFilters}>
          {t(`admin.payments.${i18nNamespace}.filters.apply`, 'Apply')}
        </Button>
        <Button onClick={clearFilters}>
          {t(`admin.payments.${i18nNamespace}.filters.clear`, 'Clear')}
        </Button>
      </Space>
    </div>
    {filterError ? <Alert showIcon message={filterError} type="warning" /> : null}
  </>
);
