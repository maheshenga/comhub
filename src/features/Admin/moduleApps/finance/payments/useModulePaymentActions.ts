import { toast } from '@lobehub/ui/base-ui';
import { useCallback, useState } from 'react';

import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import type { PendingRefundResolution } from '../../../payments/PendingRefundResolutionModal';
import { type DiscrepancyStatus, downloadJson, type PaymentFormAction } from './modulePaymentsShared';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

type ActionTargetRow = {
  appName: string;
  currency: string;
  orderId: string;
  totalAmount: string;
};

/**
 * 模块支付动作状态机（M5 拆页：从 ModulePaymentsPage 抽出）。
 * 动作弹窗（refund/offlineRefund/settle）、差异导出、人工结算三组动作。
 */
export const useModulePaymentActions = ({
  cursor,
  discrepancyStatus,
  listKey,
  t,
}: {
  cursor?: string;
  discrepancyStatus?: string;
  listKey: readonly unknown[];
  t: TFn;
}) => {
  const [action, setAction] = useState<PaymentFormAction>();
  const [actionError, setActionError] = useState<string>();
  const [actionTarget, setActionTarget] = useState<ActionTargetRow>();
  const [busyAction, setBusyAction] = useState<string>();
  const [offlineRefundReference, setOfflineRefundReference] = useState('');
  const [operationResult, setOperationResult] = useState<string>();
  const [paymentReference, setPaymentReference] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolution, setResolution] = useState<PendingRefundResolution>();
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionTarget, setResolutionTarget] = useState<ActionTargetRow>();

  const runDirectAction = useCallback(
    async (name: string, operation: () => Promise<unknown>) => {
      setBusyAction(name);
      setOperationResult(undefined);
      try {
        const result = await operation();
        await mutate(listKey as any);
        setOperationResult(t('moduleApps.admin.payments.operationSuccess'));
        return result;
      } catch (cause) {
        setOperationResult(
          cause instanceof Error ? cause.message : t('moduleApps.admin.payments.operationError'),
        );
        return undefined;
      } finally {
        setBusyAction(undefined);
      }
    },
    [listKey, t],
  );

  const openAction = useCallback((nextAction: PaymentFormAction, row: ActionTargetRow) => {
    setAction(nextAction);
    setActionError(undefined);
    setActionTarget(row);
    setOfflineRefundReference('');
    setPaymentReference('');
    setReason('');
  }, []);

  const closeAction = useCallback(() => {
    setSubmitting((current) => {
      if (current) return current;
      setAction(undefined);
      setActionTarget(undefined);
      return current;
    });
  }, []);

  const submitAction = useCallback(async () => {
    if (!action || !actionTarget) return;
    if (action !== 'settle' && !reason.trim()) return;
    if (action === 'offlineRefund' && !offlineRefundReference.trim()) return;
    if (action === 'settle' && !paymentReference.trim()) return;
    setSubmitting(true);
    setActionError(undefined);
    try {
      if (action === 'refund') {
        await adminCommercialService.moduleApps.refundPaymentOrder({
          orderId: actionTarget.orderId,
          reason: reason.trim(),
        });
      } else if (action === 'offlineRefund') {
        await adminCommercialService.moduleApps.refundOrder({
          offlineRefundReference: offlineRefundReference.trim(),
          orderId: actionTarget.orderId,
          reason: reason.trim(),
        });
      } else {
        await adminCommercialService.moduleApps.settleOrder({
          orderId: actionTarget.orderId,
          paymentReference: paymentReference.trim(),
        });
      }
      await mutate(listKey as any);
      toast.success(t('moduleApps.admin.payments.operationSuccess'));
      setAction(undefined);
      setActionTarget(undefined);
      setOfflineRefundReference('');
      setPaymentReference('');
      setReason('');
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : t('moduleApps.admin.payments.operationError'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [action, actionTarget, listKey, offlineRefundReference, paymentReference, reason, t]);

  const exportDiscrepancies = useCallback(async () => {
    setBusyAction('export');
    setOperationResult(undefined);
    try {
      const numericCursor = cursor === undefined ? undefined : Number(cursor);
      const result = await adminCommercialService.moduleApps.exportPaymentReconciliation({
        cursor: Number.isFinite(numericCursor) ? numericCursor : undefined,
        limit: 500,
        status: discrepancyStatus as DiscrepancyStatus | undefined,
      });
      downloadJson(result);
      setOperationResult(t('moduleApps.admin.payments.exportSuccess'));
    } catch (cause) {
      setOperationResult(
        cause instanceof Error ? cause.message : t('moduleApps.admin.payments.operationError'),
      );
    } finally {
      setBusyAction(undefined);
    }
  }, [cursor, discrepancyStatus, t]);

  const actionIsValid =
    action === 'settle'
      ? Boolean(paymentReference.trim())
      : Boolean(reason.trim()) &&
        (action !== 'offlineRefund' || Boolean(offlineRefundReference.trim()));

  const openResolution = useCallback((target: ActionTargetRow) => {
    setResolutionTarget(target);
  }, []);

  const closeResolution = useCallback(() => {
    setResolutionTarget(undefined);
    setResolution(undefined);
    setResolutionNote('');
  }, []);

  const submitResolution = useCallback(async () => {
    if (!resolutionTarget || !resolution || !resolutionNote.trim()) return;
    const result = await runDirectAction(`resolve:${resolutionTarget.orderId}`, () =>
      adminCommercialService.moduleApps.resolvePaymentRefund({
        note: resolutionNote.trim(),
        orderId: resolutionTarget.orderId,
        resolution,
      }),
    );
    if (result) {
      toast.success(t('moduleApps.admin.payments.manualResolution.operationSuccess'));
      closeResolution();
    }
  }, [closeResolution, resolution, resolutionNote, resolutionTarget, runDirectAction, t]);

  return {
    action,
    actionError,
    actionIsValid,
    actionTarget,
    busyAction,
    closeAction,
    closeResolution,
    exportDiscrepancies,
    offlineRefundReference,
    openAction,
    openResolution,
    operationResult,
    paymentReference,
    reason,
    resolution,
    resolutionNote,
    runDirectAction,
    setOfflineRefundReference,
    setPaymentReference,
    setReason,
    setResolution,
    setResolutionNote,
    submitAction,
    submitResolution,
    submitting,
    resolutionTarget,
  };
};
