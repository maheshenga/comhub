'use client';

import { Button, Descriptions, Drawer, Empty, Input, InputNumber, Modal, Spin, Table, Tag, message } from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import { useClientDataSWR, mutate as swrMutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

interface AdminUserDetailDrawerProps {
  onClose: () => void;
  userId: string | null;
}

const AdminUserDetailDrawer = memo<AdminUserDetailDrawerProps>(({ onClose, userId }) => {
  const { t } = useTranslation('subscription');
  const swrKey = userId ? ['admin-user-full-detail', userId] : null;
  const { data, isLoading } = useClientDataSWR(swrKey, () =>
    adminCommercialService.getUserFullDetail(userId!),
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number | null>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjust = async () => {
    if (!userId || !adjustAmount || !adjustReason.trim()) {
      message.warning(t('admin.adjustCredits.invalid', 'Amount and reason are required'));
      return;
    }
    setAdjusting(true);
    try {
      await adminCommercialService.adjustCredits({
        amount: Math.round(adjustAmount),
        reason: adjustReason,
        userId,
      });
      message.success(t('admin.adjustCredits.success', 'Credits adjusted'));
      setAdjustOpen(false);
      setAdjustAmount(0);
      setAdjustReason('');
      if (swrKey) await swrMutate(swrKey);
    } catch {
      message.error(t('admin.adjustCredits.failed', 'Failed'));
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      extra={
        userId ? (
          <Button onClick={() => setAdjustOpen(true)} type="primary">
            {t('admin.adjustCredits', 'Adjust Credits')}
          </Button>
        ) : null
      }
      onClose={onClose}
      open={!!userId}
      title={t('admin.userDetail.title', 'User Detail')}
      width={720}
    >
      {isLoading || !data ? (
        <Spin />
      ) : (
        <Flexbox gap={24}>
          <Descriptions
            bordered
            column={1}
            size="small"
            title={t('admin.userDetail.profile', 'Profile')}
          >
            <Descriptions.Item label="ID">
              <code>{data.user.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.email', 'Email')}>
              {data.user.email ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.name', 'Name')}>
              {data.user.fullName ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.role', 'Role')}>
              {data.user.role ? (
                <Tag color={data.user.role === 'admin' ? 'purple' : 'blue'}>
                  {data.user.role}
                </Tag>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.status', 'Status')}>
              {data.user.banned ? <Tag color="red">Banned</Tag> : <Tag color="green">Active</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.joined', 'Joined')}>
              {data.user.createdAt ? new Date(data.user.createdAt).toLocaleString() : '—'}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            bordered
            column={2}
            size="small"
            title={t('admin.userDetail.balance', 'Credit Balance')}
          >
            <Descriptions.Item label={t('admin.userDetail.balanceCurrent', 'Current')}>
              {data.creditAccount?.balance ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.totalCredited', 'Total Credited')}>
              {data.creditAccount?.totalCredited ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.totalDebited', 'Total Debited')}>
              {data.creditAccount?.totalDebited ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.currency', 'Currency')}>
              {data.creditAccount?.currency ?? 'credits'}
            </Descriptions.Item>
          </Descriptions>

          {data.subscription ? (
            <Descriptions
              bordered
              column={2}
              size="small"
              title={t('admin.userDetail.subscription', 'Subscription')}
            >
              <Descriptions.Item label={t('admin.userDetail.plan', 'Plan')}>
                <Tag>{data.subscription.plan}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.cycle', 'Cycle')}>
                {data.subscription.cycle}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.subStatus', 'Status')}>
                {data.subscription.status}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.monthlyCredits', 'Monthly Credits')}>
                {data.subscription.monthlyCredits}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.monthlyPrice', 'Monthly Price')}>
                {data.subscription.monthlyPrice} {data.subscription.currency}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.renewsAt', 'Renews At')}>
                {data.subscription.renewsAt
                  ? new Date(data.subscription.renewsAt).toLocaleDateString()
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description={t('admin.userDetail.noSubscription', 'No subscription')} />
          )}

          <div>
            <h4>{t('admin.userDetail.recentLedger', 'Recent Ledger Entries')}</h4>
            <Table
              columns={[
                { dataIndex: 'type', key: 'type', title: 'Type' },
                { dataIndex: 'amount', key: 'amount', title: 'Amount' },
                { dataIndex: 'balanceAfter', key: 'balanceAfter', title: 'Balance After' },
                { dataIndex: 'description', key: 'description', title: 'Description' },
                {
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (v: Date) => new Date(v).toLocaleString(),
                  title: 'At',
                },
              ]}
              dataSource={data.recentLedger}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </div>

          <div>
            <h4>{t('admin.userDetail.recentOrders', 'Recent Top-up Orders')}</h4>
            <Table
              columns={[
                {
                  dataIndex: 'id',
                  key: 'id',
                  render: (v: string) => <code>{v.slice(0, 8)}</code>,
                  title: 'ID',
                },
                { dataIndex: 'credits', key: 'credits', title: 'Credits' },
                { dataIndex: 'amount', key: 'amount', title: 'Amount' },
                { dataIndex: 'currency', key: 'currency', title: 'Currency' },
                {
                  dataIndex: 'status',
                  key: 'status',
                  render: (s: string) => <Tag>{s}</Tag>,
                  title: 'Status',
                },
                {
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (v: Date) => new Date(v).toLocaleString(),
                  title: 'Created',
                },
              ]}
              dataSource={data.recentOrders}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </div>

          <div>
            <h4>{t('admin.userDetail.auditTrail', 'Recent Admin Actions on User')}</h4>
            <Table
              columns={[
                {
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (v: Date) => new Date(v).toLocaleString(),
                  title: 'At',
                  width: 160,
                },
                {
                  dataIndex: 'action',
                  key: 'action',
                  render: (v: string) => <Tag>{v}</Tag>,
                  title: 'Action',
                },
                {
                  dataIndex: 'actorUserId',
                  key: 'actor',
                  render: (v: string | null) => (v ? <code>{v.slice(0, 8)}</code> : '—'),
                  title: 'Actor',
                },
                {
                  dataIndex: 'payload',
                  key: 'payload',
                  render: (v: Record<string, unknown> | null) =>
                    v ? <code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</code> : '—',
                  title: 'Payload',
                },
              ]}
              dataSource={data.recentAudit ?? []}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </div>
        </Flexbox>
      )}
      <Modal
        confirmLoading={adjusting}
        onCancel={() => setAdjustOpen(false)}
        onOk={handleAdjust}
        open={adjustOpen}
        title={t('admin.adjustCredits', 'Adjust Credits')}
      >
        <Flexbox gap={12}>
          <div>{t('admin.adjustCredits.amount', 'Amount (positive = credit, negative = debit)')}</div>
          <InputNumber
            onChange={(v) => setAdjustAmount((v as number | null) ?? 0)}
            style={{ width: '100%' }}
            value={adjustAmount}
          />
          <div>{t('admin.adjustCredits.reason', 'Reason')}</div>
          <Input.TextArea
            onChange={(e) => setAdjustReason(e.target.value)}
            rows={3}
            value={adjustReason}
          />
        </Flexbox>
      </Modal>
    </Drawer>
  );
});

AdminUserDetailDrawer.displayName = 'AdminUserDetailDrawer';

export default AdminUserDetailDrawer;
