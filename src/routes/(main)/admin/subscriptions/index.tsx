'use client';

import { Button, Empty, Input, Modal, Select, Tag, message } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import {
  formatBusinessDate,
  formatCredits,
  formatCurrencyAmount,
} from '@/business/client/BusinessSettingPages/shared';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type PlanFilter = 'all' | 'free' | 'hobby' | 'starter' | 'premium' | 'ultimate';

const PLAN_COLORS: Record<string, string> = {
  free: 'default',
  hobby: 'blue',
  premium: 'gold',
  starter: 'cyan',
  ultimate: 'purple',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'success',
  canceled: 'default',
  expired: 'warning',
  past_due: 'error',
  trialing: 'processing',
};

const AdminSubscriptionsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [plan, setPlan] = useState<PlanFilter>('all');
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [forceModal, setForceModal] = useState<{
    cycle: 'monthly' | 'yearly';
    plan: string;
    reason: string;
    userId: string;
    visible: boolean;
  }>({ cycle: 'monthly', plan: 'free', reason: '', userId: '', visible: false });
  const [submitting, setSubmitting] = useState(false);

  const swrKey = useMemo(() => ['admin-subscriptions', plan, cursor] as const, [plan, cursor]);

  const { data, isLoading, mutate } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listSubscriptions({
      cursor,
      limit: 20,
      plan: plan === 'all' ? undefined : plan,
    }),
  );

  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor;

  const handlePlanFilterChange = (val: PlanFilter) => {
    setPlan(val);
    setCursor(undefined);
  };

  const handleLoadMore = () => {
    if (nextCursor == null) return;
    setCursor(nextCursor);
  };

  const openForceModal = (userId: string) => {
    setForceModal({ cycle: 'monthly', plan: 'free', reason: '', userId, visible: true });
  };

  const closeForceModal = () => {
    setForceModal((prev) => ({ ...prev, reason: '', visible: false }));
  };

  const handleForceConfirm = async () => {
    const { userId, plan: newPlan, cycle, reason } = forceModal;
    if (!reason.trim()) {
      message.warning(t('admin.subscriptions.reasonRequired', 'Reason is required'));
      return;
    }
    setSubmitting(true);
    try {
      await adminCommercialService.forceChangePlan({ cycle, plan: newPlan, reason, userId });
      message.success(t('admin.subscriptions.forceSuccess', 'Plan changed'));
      closeForceModal();
      await mutate();
    } catch {
      message.error(t('admin.subscriptions.forceFailed', 'Action failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (uid: string) => <code>{uid?.slice(0, 8)}</code>,
        title: t('admin.subscriptions.columns.userId', 'User ID'),
      },
      {
        dataIndex: 'plan',
        key: 'plan',
        render: (p: string) => <Tag color={PLAN_COLORS[p] ?? 'default'}>{p}</Tag>,
        title: t('admin.subscriptions.columns.plan', 'Plan'),
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{s}</Tag>,
        title: t('admin.subscriptions.columns.status', 'Status'),
      },
      {
        dataIndex: 'cycle',
        key: 'cycle',
        title: t('admin.subscriptions.columns.cycle', 'Cycle'),
      },
      {
        dataIndex: 'monthlyCredits',
        key: 'monthlyCredits',
        render: (v: number) => (v != null ? formatCredits(v) : '--'),
        title: t('admin.subscriptions.columns.monthlyCredits', 'Monthly Credits'),
      },
      {
        dataIndex: 'monthlyPrice',
        key: 'monthlyPrice',
        render: (v: number, row: any) =>
          v != null ? formatCurrencyAmount(v, row.currency) : '--',
        title: t('admin.subscriptions.columns.monthlyPrice', 'Monthly Price'),
      },
      {
        dataIndex: 'startedAt',
        key: 'startedAt',
        render: (v: string) => formatBusinessDate(v),
        title: t('admin.subscriptions.columns.started', 'Started'),
      },
      {
        dataIndex: 'renewsAt',
        key: 'renewsAt',
        render: (v: string) => formatBusinessDate(v),
        title: t('admin.subscriptions.columns.renewsAt', 'Renews At'),
      },
      {
        key: 'actions',
        render: (_: unknown, row: any) => (
          <Button size="small" type="primary" onClick={() => openForceModal(row.userId)}>
            {t('admin.subscriptions.actions.forceChange', 'Force Change')}
          </Button>
        ),
        title: t('admin.subscriptions.columns.actions', 'Actions'),
      },
    ],
    [t],
  );

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal gap={12}>
        <Select<PlanFilter>
          onChange={handlePlanFilterChange}
          options={[
            { label: t('admin.subscriptions.plan.all', 'All'), value: 'all' },
            { label: t('admin.subscriptions.plan.free', 'Free'), value: 'free' },
            { label: t('admin.subscriptions.plan.hobby', 'Hobby'), value: 'hobby' },
            { label: t('admin.subscriptions.plan.starter', 'Starter'), value: 'starter' },
            { label: t('admin.subscriptions.plan.premium', 'Premium'), value: 'premium' },
            { label: t('admin.subscriptions.plan.ultimate', 'Ultimate'), value: 'ultimate' },
          ]}
          style={{ width: 160 }}
          value={plan}
        />
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.subscriptions.empty', 'No subscriptions found')} />
      ) : (
        <InlineTable columns={columns} dataSource={items} loading={isLoading} rowKey="userId" />
      )}

      {nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={handleLoadMore}>
            {t('admin.subscriptions.loadMore', 'Load More')}
          </Button>
        </Flexbox>
      )}

      <Modal
        confirmLoading={submitting}
        onCancel={closeForceModal}
        onOk={handleForceConfirm}
        open={forceModal.visible}
        title={t('admin.subscriptions.modal.title', 'Force Change Plan')}
      >
        <Flexbox gap={12}>
          <Flexbox gap={4}>
            <div>{t('admin.subscriptions.modal.planLabel', 'Plan')}</div>
            <Select
              onChange={(val) => setForceModal((prev) => ({ ...prev, plan: val }))}
              options={[
                { label: 'Free', value: 'free' },
                { label: 'Hobby', value: 'hobby' },
                { label: 'Starter', value: 'starter' },
                { label: 'Premium', value: 'premium' },
                { label: 'Ultimate', value: 'ultimate' },
              ]}
              style={{ width: '100%' }}
              value={forceModal.plan}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <div>{t('admin.subscriptions.modal.cycleLabel', 'Cycle')}</div>
            <Select<'monthly' | 'yearly'>
              onChange={(val) => setForceModal((prev) => ({ ...prev, cycle: val }))}
              options={[
                { label: t('admin.subscriptions.modal.monthly', 'Monthly'), value: 'monthly' },
                { label: t('admin.subscriptions.modal.yearly', 'Yearly'), value: 'yearly' },
              ]}
              style={{ width: '100%' }}
              value={forceModal.cycle}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <div>{t('admin.subscriptions.modal.reasonLabel', 'Reason')}</div>
            <Input.TextArea
              onChange={(e) => setForceModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder={t('admin.subscriptions.modal.reasonPlaceholder', 'Enter reason...')}
              rows={3}
              value={forceModal.reason}
            />
          </Flexbox>
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminSubscriptionsPage.displayName = 'AdminSubscriptionsPage';

export default AdminSubscriptionsPage;
