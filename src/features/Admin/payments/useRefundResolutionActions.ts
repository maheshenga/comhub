import { toast } from '@lobehub/ui/base-ui';
import { useCallback, useState } from 'react';

import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type TFn = (key: any, defaultValue?: any, values?: any) => any;

export type PaymentActionDomain = 'subscriptionPayment' | 'topUp';

/**
 * 退款 + 人工结算动作状态机（M5 拆页：从 SubscriptionPaymentsPage 抽出，
 * busyAction/closeRefund/submitRefund/closeResolution/submitResolution 一组）。
 * refundDomain/resolutionDomain 决定调用的服务方法（订阅支付 vs 充值支付）。
 */
export const useRefundResolutionActions = ({
  refundDomain = 'subscriptionPayment',
  resolutionDomain = 'subscriptionPayment',
  swrKey,
  t,
}: {
  refundDomain?: PaymentActionDomain;
  resolutionDomain?: PaymentActionDomain;
  swrKey: readonly unknown[];
  t: TFn;
}) => {
  const [busyAction, setBusyAction] = useState<string>();

  const runOperation = useCallback(
    async <T,>(key: string, operation: () => Promise<T>, onSuccess?: (result: T) => void) => {
      setBusyAction(key);
      try {
        const result = await operation();
        await mutate(swrKey as any);
        if (onSuccess) onSuccess(result);
        else toast.success(t('admin.payments.topups.reconcileSuccess', 'Payment status refreshed'));
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : t('admin.payments.topups.reconcileFailed', 'Unable to refresh payment status'),
        );
      } finally {
        setBusyAction(undefined);
      }
    },
    [swrKey, t],
  );

  const closeRefund = useCallback(() => {
    setBusyAction((current) => (current?.startsWith('refund:') ? current : undefined));
  }, []);

  const submitRefund = useCallback(
    async (
      refundOrder: {
        amount: number | string;
        currency: string;
        displayName?: string;
        id: string;
      },
      reason: string,
    ) => {
      const trimmed = reason.trim();
      if (!trimmed) return;
      const refund =
        refundDomain === 'topUp'
          ? adminCommercialService.refundTopUpPayment
          : adminCommercialService.refundSubscriptionPayment;
      await runOperation(
        `refund:${refundOrder.id}`,
        () =>
          refund({
            orderId: refundOrder.id,
            reason: trimmed,
          }) as Promise<{ debtAmount?: number; status: string }>,
        (result: { debtAmount?: number; status: string }) => {
          toast.success(
            t('admin.payments.subscriptions.refundQueued', {
              defaultValue: 'Refund requested ({status})',
              status: result.status,
            }),
          );
        },
      );
    },
    [refundDomain, runOperation, t],
  );

  const closeResolution = useCallback(() => {
    setBusyAction((current) => (current?.startsWith('resolve:') ? current : undefined));
  }, []);

  const submitResolution = useCallback(
    async (
      resolutionOrder: {
        amount: number | string;
        currency: string;
        displayName?: string;
        id: string;
      },
      resolution: 'failed' | 'succeeded',
      note: string,
    ) => {
      const resolve =
        resolutionDomain === 'topUp'
          ? adminCommercialService.resolveTopUpPaymentRefund
          : adminCommercialService.resolveSubscriptionPaymentRefund;
      await runOperation(
        `resolve:${resolutionOrder.id}`,
        () =>
          resolve({
            note: note.trim(),
            orderId: resolutionOrder.id,
            resolution,
          }),
        () => {
          toast.success(
            t('admin.payments.subscriptions.manualResolution.applied', 'Decision applied'),
          );
        },
      );
    },
    [resolutionDomain, runOperation, t],
  );

  return { busyAction, closeRefund, closeResolution, runOperation, submitRefund, submitResolution };
};
