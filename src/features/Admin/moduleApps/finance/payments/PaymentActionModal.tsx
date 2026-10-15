'use client';

import { Input, Modal, TextArea } from '@lobehub/ui/base-ui';

import type { PaymentFormAction } from './modulePaymentsShared';
import { modulePaymentStyles as styles } from './modulePaymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export interface PaymentActionModalProps {
  action?: PaymentFormAction;
  actionError?: string;
  actionIsValid: boolean;
  offlineRefundReference: string;
  onCancel: () => void;
  onOfflineRefundReferenceChange: (value: string) => void;
  onOk: () => void;
  onPaymentReferenceChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  paymentReference: string;
  reason: string;
  submitting: boolean;
  t: TFn;
  /** 弹窗正文先复述操作对象（app / 订单号），连审时管理员不再只看到一个动词。 */
  target?: { appName: string; orderId: string };
}

/** 支付动作表单弹窗（退款 / 线下退款 / 结算三态，M5 拆页抽出）。 */
export const PaymentActionModal = ({
  action,
  actionError,
  actionIsValid,
  offlineRefundReference,
  onOfflineRefundReferenceChange,
  onPaymentReferenceChange,
  onReasonChange,
  paymentReference,
  reason,
  submitting,
  target,
  t,
  onCancel,
  onOk,
}: PaymentActionModalProps) => (
  <Modal
    cancelText={t('cancel')}
    confirmLoading={submitting}
    okButtonProps={{ disabled: submitting || !actionIsValid }}
    okText={action ? t(`moduleApps.admin.payments.confirm.${action}`) : ''}
    open={Boolean(action)}
    title={action ? t(`moduleApps.admin.payments.modal.${action}`) : ''}
    onCancel={onCancel}
    onOk={onOk}
  >
    <div className={styles.form}>
      {action && target ? (
        <p className={styles.targetContext} data-testid="payment-action-target">
          {t('moduleApps.admin.payments.actionTargetContext', {
            action: t(`moduleApps.admin.payments.modal.${action}`),
            app: target.appName || '-',
            order: target.orderId,
          })}
        </p>
      ) : null}
      {action === 'settle' ? (
        <label>
          {t('moduleApps.admin.payments.form.paymentReference')}
          <Input
            required
            maxLength={240}
            value={paymentReference}
            onChange={(event: { target: { value: string } }) =>
              onPaymentReferenceChange(event.target.value)
            }
          />
        </label>
      ) : (
        <label>
          {t('moduleApps.admin.payments.form.reason')}
          <TextArea
            required
            maxLength={1000}
            value={reason}
            onChange={(event: { target: { value: string } }) => onReasonChange(event.target.value)}
          />
        </label>
      )}
      {action === 'offlineRefund' ? (
        <label>
          {t('moduleApps.admin.payments.form.offlineRefundReference')}
          <Input
            required
            maxLength={240}
            value={offlineRefundReference}
            onChange={(event: { target: { value: string } }) =>
              onOfflineRefundReferenceChange(event.target.value)
            }
          />
        </label>
      ) : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
    </div>
  </Modal>
);

export const buildPaymentReconciliationLabels = (t: TFn) => ({
  acknowledge: t('moduleApps.admin.payments.actions.acknowledge'),
  action: t('moduleApps.admin.payments.columns.actions'),
  amount: t('moduleApps.admin.payments.columns.amount'),
  app: t('moduleApps.admin.payments.columns.app'),
  audit: t('moduleApps.admin.payments.columns.audit'),
  commerce: t('moduleApps.admin.payments.columns.commerce'),
  events: t('moduleApps.admin.payments.columns.events'),
  latestRun: t('moduleApps.admin.payments.columns.latestRun'),
  offlineRefund: t('moduleApps.admin.payments.actions.offlineRefund'),
  order: t('moduleApps.admin.payments.columns.order'),
  paymentMethod: t('moduleApps.admin.payments.columns.paymentMethod'),
  providerTrade: t('moduleApps.admin.payments.columns.providerTrade'),
  refund: t('moduleApps.admin.payments.actions.refund'),
  resolveRefund: t('moduleApps.admin.payments.actions.resolveRefund'),
  retryPayment: t('moduleApps.admin.payments.actions.retryPayment'),
  retryRefund: t('moduleApps.admin.payments.actions.retryRefund'),
  settle: t('moduleApps.admin.payments.actions.settle'),
  status: t('moduleApps.admin.payments.columns.status'),
});

export const buildPaymentStatusLabels = (t: TFn) => ({
  created: t('moduleApps.admin.payments.status.created'),
  failed: t('moduleApps.admin.payments.status.failed'),
  paid: t('moduleApps.admin.payments.status.paid'),
  pending: t('moduleApps.admin.payments.status.pending'),
  refunded: t('moduleApps.admin.payments.status.refunded'),
});

/** 模块财务中心共用的状态文案表（M5 拆页抽出）。 */
export const buildModuleFinanceStatusLabels = (t: TFn) => ({
  created: t('moduleApps.admin.finance.status.created'),
  failed: t('moduleApps.admin.finance.status.failed'),
  open: t('moduleApps.admin.finance.status.open'),
  paid: t('moduleApps.admin.finance.status.paid'),
  pending: t('moduleApps.admin.finance.status.pending'),
  refunded: t('moduleApps.admin.finance.status.refunded'),
  requested: t('moduleApps.admin.finance.status.requested'),
  resolved: t('moduleApps.admin.finance.status.resolved'),
  succeeded: t('moduleApps.admin.finance.status.succeeded'),
});
