import { useTranslation } from 'react-i18next';

/**
 * 支付人工结算弹窗的文案映射（M5 拆页：从 SubscriptionPaymentsPage 抽出，
 * TopUpPaymentsPage 复用同形态）。
 */
export const useManualResolutionLabels = (namespace: 'subscriptions' | 'topups' = 'subscriptions') => {
  const { t } = useTranslation('subscription');
  const ns = `admin.payments.${namespace}.manualResolution`;

  return {
    cancel: t('cancel', 'Cancel'),
    chooseOutcome: t(`${ns}.chooseOutcome`, 'Choose the provider outcome'),
    confirm: t(`${ns}.confirm`, 'Apply decision'),
    description: t(
      `${ns}.description`,
      'Check the Z-Pay merchant portal before deciding. An incorrect decision can duplicate a refund or leave plan benefits active.',
    ),
    note: t(`${ns}.note`, 'Verification note'),
    notRefunded: t(`${ns}.notRefunded`, 'Not refunded - allow retry'),
    outcome: t(`${ns}.outcome`, 'Provider outcome'),
    refunded: t(`${ns}.refunded`, 'Refunded - reverse benefits'),
  };
};
