'use client';

import { ADMIN_CAPABILITIES, hasAdminCapability } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Descriptions, Drawer, Empty, InputNumber, message, Modal, Space, Spin, Tag } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate as swrMutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import AdminAssignPlanModal from './AdminAssignPlanModal';
import { toAdminAtomicCredits } from './adminCreditUnits';
import AdminDangerousActionButton from './AdminDangerousActionButton';
import type { AdminDangerousActionEnvelope } from './adminDangerousActions';
import type { AdminSubscriptionCycle } from './adminSubscriptionCycles';
import { isFiniteAdminSubscriptionCycle } from './adminSubscriptionCycles';
import UserDetailSections from './UserDetail/DetailSections';

interface AdminUserDetailDrawerProps {
  onClose: () => void;
  userId: string | null;
}

const AdminUserDetailDrawer = memo<AdminUserDetailDrawerProps>(({ onClose, userId }) => {
  const { t } = useTranslation('subscription');
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);
  const canManageFinance = hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const canReadFullDetail = hasAdminCapability(role, ADMIN_CAPABILITIES.supportWrite);
  const fullDetailSWRKey = userId && canReadFullDetail ? ['admin-user-full-detail', userId] : null;
  const compactDetailSWRKey = userId && !canReadFullDetail ? ['admin-user-compact-detail', userId] : null;
  const { data: fullDetail, isLoading: fullDetailLoading } = useClientDataSWR(fullDetailSWRKey, () =>
    adminCommercialService.getUserFullDetail(userId!),
  );
  const { data: compactDetail, isLoading: compactDetailLoading } = useClientDataSWR(
    compactDetailSWRKey,
    () => adminCommercialService.getCompactUserDetail(userId!),
  );
  const data = fullDetail;
  const isLoading = fullDetailLoading || compactDetailLoading;
  const swrKey = fullDetailSWRKey ?? compactDetailSWRKey;
  const { data: plansData } = useClientDataSWR(
    canManageFinance ? ['admin-plan-catalog-options'] : null,
    () => adminCommercialService.listPlans(),
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number | null>(0);
  const [adjusting, setAdjusting] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPlan, setAssignPlan] = useState<string>();
  const [assignCycle, setAssignCycle] = useState<AdminSubscriptionCycle>('monthly');
  const [assignDurationMonths, setAssignDurationMonths] = useState<number | null>(1);
  const [assignReason, setAssignReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  const handleAdjust = async (command: AdminDangerousActionEnvelope<'credits.adjust'>) => {
    const normalizedReason = command.reason?.trim();
    if (!userId || !adjustAmount || !normalizedReason) {
      message.warning(t('admin.adjustCredits.invalid', '请填写调整数量和原因'));
      return;
    }
    setAdjusting(true);
    try {
      await adminCommercialService.adjustCredits(
        {
          amount: toAdminAtomicCredits(adjustAmount),
          reason: normalizedReason,
          userId,
        },
        command,
      );
      message.success(t('admin.adjustCredits.success', '积分已调整'));
      setAdjustOpen(false);
      setAdjustAmount(0);
      if (swrKey) await swrMutate(swrKey);
    } catch {
      message.error(t('admin.adjustCredits.failed', '操作失败'));
    } finally {
      setAdjusting(false);
    }
  };

  const handleAssignPlan = async () => {
    const durationMonths = isFiniteAdminSubscriptionCycle(assignCycle)
      ? Math.round(assignDurationMonths ?? 0)
      : 1;
    if (!userId || !assignPlan || durationMonths < 1 || !assignReason.trim()) {
      message.warning(t('admin.assignPlan.invalid', '请选择套餐、使用时长并填写原因'));
      return;
    }

    setAssigning(true);
    try {
      await adminCommercialService.assignUserPlan({
        cycle: assignCycle,
        durationMonths,
        plan: assignPlan,
        reason: assignReason.trim(),
        userId,
      });
      message.success(t('admin.assignPlan.success', '套餐已设置'));
      setAssignOpen(false);
      setAssignReason('');
      if (swrKey) await swrMutate(swrKey);
      await swrMutate(['admin-subscriptions']);
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      open={!!userId}
      title={t('admin.userDetail.title', '用户详情')}
      width={720}
      extra={
        userId && canManageFinance ? (
          <Space>
            <Button onClick={() => setAssignOpen(true)}>
              {t('admin.userDetail.assignPlan', '给用户分配套餐')}
            </Button>
            <Button type="primary" onClick={() => setAdjustOpen(true)}>
              {t('admin.adjustCredits', '调整积分')}
            </Button>
          </Space>
        ) : null
      }
      onClose={onClose}
    >
      {isLoading ? (
        <Spin />
      ) : data ? (
        <UserDetailSections data={data} />
      ) : compactDetail ? (
        <CompactProfile compactDetail={compactDetail} />
      ) : (
        <Empty />
      )}
      {canManageFinance ? (
        <AdminAssignPlanModal
          confirmLoading={assigning}
          cycle={assignCycle}
          durationMonths={assignDurationMonths}
          open={assignOpen}
          plan={assignPlan}
          plans={plansData?.items ?? []}
          reason={assignReason}
          title={t('admin.userDetail.assignPlan', '给用户分配套餐')}
          onCancel={() => setAssignOpen(false)}
          onCycleChange={setAssignCycle}
          onDurationMonthsChange={setAssignDurationMonths}
          onOk={handleAssignPlan}
          onPlanChange={setAssignPlan}
          onReasonChange={setAssignReason}
        />
      ) : null}
      {canManageFinance ? (
        <Modal
          open={adjustOpen}
          title={t('admin.adjustCredits', '调整积分')}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setAdjustOpen(false);
                setAdjustAmount(0);
              }}
            >
              {t('cancel', '取消')}
            </Button>,
            <AdminDangerousActionButton
              actionId="credits.adjust"
              key="confirm"
              loading={adjusting}
              type="primary"
              onConfirm={handleAdjust}
            >
              {t('admin.adjustCredits', '调整积分')}
            </AdminDangerousActionButton>,
          ]}
          onCancel={() => setAdjustOpen(false)}
        >
          <Flexbox gap={12}>
            <div>{t('admin.adjustCredits.amount', '数量（正数增加，负数扣减）')}</div>
            <InputNumber
              addonAfter={'M'}
              precision={6}
              style={{ width: '100%' }}
              value={adjustAmount}
              onChange={(value: number | null) => setAdjustAmount(value ?? 0)}
            />
          </Flexbox>
        </Modal>
      ) : null}
    </Drawer>
  );
});

const CompactProfile = ({ compactDetail }: { compactDetail: any }) => {
  const { t } = useTranslation('subscription');
  const EMPTY_TEXT = '-';

  return (
    <Descriptions
      bordered
      column={1}
      size="small"
      title={t('admin.userDetail.profile', '用户资料')}
    >
      <Descriptions.Item label={t('admin.userDetail.userId', 'ID')}>
        <code>{compactDetail.id}</code>
      </Descriptions.Item>
      <Descriptions.Item label={t('admin.role', '角色')}>
        {compactDetail.role ? (
          <Tag color={compactDetail.role === 'admin' ? 'purple' : 'blue'}>
            {compactDetail.role}
          </Tag>
        ) : (
          EMPTY_TEXT
        )}
      </Descriptions.Item>
      <Descriptions.Item label={t('admin.status', '状态')}>
        {compactDetail.banned ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>}
      </Descriptions.Item>
      <Descriptions.Item label={t('admin.joined', '注册时间')}>
        {compactDetail.createdAt
          ? new Date(compactDetail.createdAt).toLocaleString()
          : EMPTY_TEXT}
      </Descriptions.Item>
    </Descriptions>
  );
};

CompactProfile.displayName = 'CompactProfile';

AdminUserDetailDrawer.displayName = 'AdminUserDetailDrawer';

export default AdminUserDetailDrawer;
