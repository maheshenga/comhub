'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, InputNumber, Modal } from '@lobehub/ui/base-ui';
import TextArea from '@lobehub/ui/es/base-ui/Input/TextArea';

import AdminDangerousActionButton from '@/features/Admin/AdminDangerousActionButton';
import type { AdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';

export interface BanUserModalProps {
  actionLoading: null | string;
  banReason: string;
  banTarget: null | string;
  handleBan: () => void | Promise<void>;
  setBanReason: (value: string) => void;
  setBanTarget: (value: null | string) => void;
  /** i18next TFunction 的结构化最小面（t(key, defaultValue, values)）。 */
  t: (key: any, defaultValue?: any, values?: any) => string;
}

/** 封禁确认弹窗（B2 拆分，confirmLoading 契约表达式原样保留）。 */
export const BanUserModal = (props: BanUserModalProps) => {
  const { actionLoading, banTarget, t } = props;

  return (
    <Modal
      confirmLoading={actionLoading === banTarget}
      open={!!props.banTarget}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      title={t('admin.ban', '封禁用户')}
      onOk={props.handleBan}
      onCancel={() => {
        props.setBanTarget(null);
        props.setBanReason('');
      }}
    >
      <TextArea
        placeholder={t('admin.ban.reason', '请输入封禁原因')}
        rows={3}
        value={props.banReason}
        onChange={(event: { target: { value: string } }) => props.setBanReason(event.target.value)}
      />
    </Modal>
  );
};

export interface AdjustCreditsModalProps {
  actionLoading: null | string;
  adjustAmount: number;
  adjustTarget: null | string;
  handleAdjustCredits: (
    command: AdminDangerousActionEnvelope<'credits.adjust'>,
  ) => void | Promise<void>;
  setAdjustAmount: (value: number) => void;
  setAdjustTarget: (value: null | string) => void;
  /** i18next TFunction 的结构化最小面（t(key, defaultValue, values)）。 */
  t: (key: any, defaultValue?: any, values?: any) => string;
}

/** 积分调整弹窗（B2 拆分；credits.adjust 走 AdminDangerousActionButton 确认门）。 */
export const AdjustCreditsModal = (props: AdjustCreditsModalProps) => {
  const { t } = props;

  return (
    <Modal
      open={!!props.adjustTarget}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      title={t('admin.adjustCredits', '调整积分')}
      footer={[
        <Button
          key="cancel"
          onClick={() => {
            props.setAdjustTarget(null);
            props.setAdjustAmount(0);
          }}
        >
          {t('cancel', '取消')}
        </Button>,
        <AdminDangerousActionButton
          actionId="credits.adjust"
          key="confirm"
          loading={props.actionLoading === `${props.adjustTarget ?? ''}-credits`}
          type="primary"
          onConfirm={props.handleAdjustCredits}
        >
          {t('admin.adjustCredits', '调整积分')}
        </AdminDangerousActionButton>,
      ]}
      onCancel={() => {
        props.setAdjustTarget(null);
        props.setAdjustAmount(0);
      }}
    >
      <Flexbox gap={12}>
        <Flexbox gap={4}>
          <div>{t('admin.adjustCredits.amount', '积分数量（可输入负数扣减）')}</div>
          {/* base-ui InputNumber 无 addonAfter：单位后缀改 suffix 渲染。 */}
          <InputNumber
            precision={6}
            style={{ width: '100%' }}
            suffix="M"
            value={props.adjustAmount}
            onChange={(value: number | null) => props.setAdjustAmount(Number(value ?? 0))}
          />
        </Flexbox>
      </Flexbox>
    </Modal>
  );
};

export interface ResetAllToFreePlanSectionProps {
  actionLoading: null | string;
  handleResetAllToFreePlan: (
    command: AdminDangerousActionEnvelope<'user.resetAllToFreePlan'>,
  ) => void | Promise<void>;
  resetPreview: null | { canceledPaid: number; insertedFree: number; normalizedFree: number };
  resetPreviewLoading: boolean;
  /** i18next TFunction 的结构化最小面（t(key, defaultValue, values)）。 */
  t: (key: any, defaultValue?: any, values?: any) => string;
}

/** 批量危险操作区（B2 拆分：重置全部用户为免费套餐）。 */
export const ResetAllToFreePlanSection = (props: ResetAllToFreePlanSectionProps) => {
  const { t } = props;

  return (
    <AdminDangerousActionButton
      danger
      actionId="user.resetAllToFreePlan"
      loading={props.actionLoading === 'reset-all-free' || props.resetPreviewLoading}
      confirmDescription={
        <Flexbox gap={8}>
          <div>
            {t(
              'admin.resetAllToFreePlan.confirmContent',
              '这会取消所有当前付费套餐，并确保每个用户都有一个无限期免费套餐。用户已有积分余额不会被清零。',
            )}
          </div>
          {props.resetPreview ? (
            <div>
              {t(
                'admin.resetAllToFreePlan.preview',
                `预计影响：取消 ${props.resetPreview.canceledPaid} 个付费套餐，规范 ${props.resetPreview.normalizedFree} 个免费套餐，补充 ${props.resetPreview.insertedFree} 个免费套餐。`,
              )}
            </div>
          ) : null}
        </Flexbox>
      }
      onConfirm={props.handleResetAllToFreePlan}
    >
      {t('admin.resetAllToFreePlan', '重置所有用户为免费套餐')}
    </AdminDangerousActionButton>
  );
};
