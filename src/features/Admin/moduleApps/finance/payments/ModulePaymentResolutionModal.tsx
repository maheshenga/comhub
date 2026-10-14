'use client';

import { useTranslation } from 'react-i18next';

import PendingRefundResolutionModal from '../../../payments/PendingRefundResolutionModal';

type ModulePaymentResolutionModalProps = {
  busy: boolean;
  note: string;
  open: boolean;
  resolution?: 'failed' | 'succeeded';
  summary: string;
  onCancel: () => void;
  onConfirm: () => void;
  onNoteChange: (value: string) => void;
  onResolutionChange: (value: 'failed' | 'succeeded') => void;
};

/** 本地化装配层：把 moduleApps.admin.payments.manualResolution.* 文案桥接进通用弹窗。 */
const ModulePaymentResolutionModal = (props: ModulePaymentResolutionModalProps) => {
  const { t } = useTranslation('common');

  return (
    <PendingRefundResolutionModal
      busy={props.busy}
      note={props.note}
      open={props.open}
      resolution={props.resolution}
      summary={props.summary}
      title={t('moduleApps.admin.payments.manualResolution.title')}
      labels={{
        cancel: t('cancel'),
        chooseOutcome: t('moduleApps.admin.payments.manualResolution.chooseOutcome'),
        confirm: t('moduleApps.admin.payments.manualResolution.confirm'),
        description: t('moduleApps.admin.payments.manualResolution.description'),
        note: t('moduleApps.admin.payments.manualResolution.note'),
        notRefunded: t('moduleApps.admin.payments.manualResolution.notRefunded'),
        outcome: t('moduleApps.admin.payments.manualResolution.outcome'),
        refunded: t('moduleApps.admin.payments.manualResolution.refunded'),
      }}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
      onNoteChange={props.onNoteChange}
      onResolutionChange={props.onResolutionChange}
    />
  );
};

export default ModulePaymentResolutionModal;
