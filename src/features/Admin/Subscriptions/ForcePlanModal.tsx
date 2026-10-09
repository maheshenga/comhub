'use client';

import { Flexbox } from '@lobehub/ui';
import { Modal, Select } from '@lobehub/ui/base-ui';
import { Input } from 'antd';
import { useTranslation } from 'react-i18next';

import type { AdminSubscriptionCycle } from '../adminSubscriptionCycles';
import { ADMIN_SUBSCRIPTION_CYCLES, getAdminSubscriptionCycleLabel } from '../adminSubscriptionCycles';

export interface ForceModalState {
  cycle: AdminSubscriptionCycle;
  plan: string;
  reason: string;
  userId: string;
  visible: boolean;
}

const ForcePlanModal = ({
  forceModal,
  onCancel,
  onConfirm,
  setForceModal,
  submitting,
}: {
  forceModal: ForceModalState;
  onCancel: () => void;
  onConfirm: () => void;
  setForceModal: (updater: (prev: ForceModalState) => ForceModalState) => void;
  submitting: boolean;
}) => {
  const { t } = useTranslation('subscription');

  return (
                <Modal
                  confirmLoading={submitting}
                  open={forceModal.visible}
                  title={t('admin.subscriptions.modal.title', '人工变更套餐')}
                  onCancel={onCancel}
                  onOk={onConfirm}
                >
                  <Flexbox gap={12}>
                    <Flexbox gap={4}>
                      <div>{t('admin.subscriptions.modal.planLabel', '套餐')}</div>
                      <Select
                        style={{ width: '100%' }}
                        value={forceModal.plan}
                        options={[
                          { label: '免费版（Free）', value: 'free' },
                          { label: '轻量版（Hobby）', value: 'hobby' },
                          { label: '基础版（Starter）', value: 'starter' },
                          { label: '专业版（Premium）', value: 'premium' },
                          { label: '旗舰版（Ultimate）', value: 'ultimate' },
                        ]}
                        onChange={(value: string) =>
                          setForceModal((prev) => ({ ...prev, plan: value }))
                        }
                      />
                    </Flexbox>
                    <Flexbox gap={4}>
                      <div>{t('admin.subscriptions.modal.cycleLabel', '周期')}</div>
                      <Select
                        style={{ width: '100%' }}
                        value={forceModal.cycle}
                        options={ADMIN_SUBSCRIPTION_CYCLES.map((item) => ({
                          label: t(
                            `admin.subscriptions.modal.${item}`,
                            getAdminSubscriptionCycleLabel(item),
                          ),
                          value: item,
                        }))}
                        onChange={(value) => setForceModal((prev) => ({ ...prev, cycle: value }))}
                      />
                    </Flexbox>
                    <Flexbox gap={4}>
                      <div>{t('admin.subscriptions.modal.reasonLabel', '原因')}</div>
                      <Input.TextArea
                        rows={3}
                        value={forceModal.reason}
                        placeholder={t(
                          'admin.subscriptions.modal.reasonPlaceholder',
                          '请输入变更原因...',
                        )}
                        onChange={(event: { target: { value: string } }) =>
                          setForceModal((prev) => ({ ...prev, reason: event.target.value }))
                        }
                      />
                    </Flexbox>
                  </Flexbox>
                </Modal>
  );
};

ForcePlanModal.displayName = 'ForcePlanModal';

export default ForcePlanModal;
