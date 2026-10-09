'use client';

import { Button } from '@lobehub/ui/base-ui';
import { Space } from 'antd';
import { RefreshCw } from 'lucide-react';

import AdminBulkActionFlow from '@/features/Admin/AdminBulkActionFlow';

import { paymentStyles as styles } from './paymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export interface PaymentListHeaderProps {
  busyReconciling: boolean;
  canWrite: boolean;
  description: string;
  /** 文案键命名空间：subscriptions | topups（两页共用形态）。 */
  i18nNamespace: 'subscriptions' | 'topups';
  onRefresh: () => void;
  onReconcilePending: () => void;
  selectedRefundCount: number;
  t: TFn;
  title: string;
  bulkRefund?: {
    /** 勾选域对应的批量退款命令 ID：充值页 payment.bulkRefund / 订阅页 payment.subscriptionBulkRefund。 */
    actionId: 'payment.bulkRefund' | 'payment.subscriptionBulkRefund';
    description: string;
    onRun: (command: any) => Promise<unknown>;
    onSuccess: () => Promise<void>;
    title: string;
  };
}

/** 支付列表页头：标题 + 刷新 + 批量退款入口 + 对账（订阅/充值两页共用形态）。 */
export const PaymentListHeader = ({
  bulkRefund,
  busyReconciling,
  canWrite,
  description,
  i18nNamespace,
  onRefresh,
  onReconcilePending,
  selectedRefundCount,
  t,
  title,
}: PaymentListHeaderProps) => (
  <div className={styles.toolbar}>
    <div>
      <strong>{title}</strong>
      <div>{description}</div>
    </div>
    <Space wrap>
      <Button icon={<RefreshCw aria-hidden size={16} />} onClick={onRefresh}>
        {t(`admin.payments.${i18nNamespace}.refresh`, 'Refresh list')}
      </Button>
      {canWrite && bulkRefund && selectedRefundCount > 0 ? (
        <AdminBulkActionFlow
          actionId={bulkRefund.actionId}
          count={selectedRefundCount}
          danger
          size="small"
          confirmTitle={bulkRefund.title}
          confirmDescription={bulkRefund.description}
          onRun={bulkRefund.onRun}
          onSuccess={bulkRefund.onSuccess}
          summary={(result: any) => ({
            failed: result?.failed ?? result?.results?.filter((r: any) => !r.ok).length ?? 0,
            requested: result?.total,
            succeeded: result?.succeeded ?? result?.results?.filter((r: any) => r.ok).length ?? 0,
          })}
        >
          {t(`admin.payments.${i18nNamespace}.bulkRefund`, 'Batch refund')}
        </AdminBulkActionFlow>
      ) : null}
      {canWrite ? (
        <Button loading={busyReconciling} type="primary" onClick={onReconcilePending}>
          {t(`admin.payments.${i18nNamespace}.reconcilePending`, 'Reconcile pending')}
        </Button>
      ) : null}
    </Space>
  </div>
);

