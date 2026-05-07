'use client';

import { Flexbox } from '@lobehub/ui';
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'antd';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate as swrMutate, useClientDataSWR } from '@/libs/swr';
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
  const { data: plansData } = useClientDataSWR(['admin-plan-catalog-options'], () =>
    adminCommercialService.listPlans(),
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number | null>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPlan, setAssignPlan] = useState<string>();
  const [assignCycle, setAssignCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [assignDurationMonths, setAssignDurationMonths] = useState<number | null>(1);
  const [assignReason, setAssignReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  const handleAdjust = async () => {
    if (!userId || !adjustAmount || !adjustReason.trim()) {
      message.warning(t('admin.adjustCredits.invalid', '请填写调整数量和原因'));
      return;
    }
    setAdjusting(true);
    try {
      await adminCommercialService.adjustCredits({
        amount: Math.round(adjustAmount),
        reason: adjustReason,
        userId,
      });
      message.success(t('admin.adjustCredits.success', '积分已调整'));
      setAdjustOpen(false);
      setAdjustAmount(0);
      setAdjustReason('');
      if (swrKey) await swrMutate(swrKey);
    } catch {
      message.error(t('admin.adjustCredits.failed', '操作失败'));
    } finally {
      setAdjusting(false);
    }
  };

  const handleAssignPlan = async () => {
    if (!userId || !assignPlan || !assignDurationMonths || !assignReason.trim()) {
      message.warning('请选择套餐、使用时长并填写原因');
      return;
    }

    setAssigning(true);
    try {
      await adminCommercialService.assignUserPlan({
        cycle: assignCycle,
        durationMonths: Math.round(assignDurationMonths),
        plan: assignPlan,
        reason: assignReason.trim(),
        userId,
      });
      message.success('套餐已分配');
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
        userId ? (
          <Space>
            <Button onClick={() => setAssignOpen(true)}>分配套餐</Button>
            <Button type="primary" onClick={() => setAdjustOpen(true)}>
              {t('admin.adjustCredits', '调整积分')}
            </Button>
          </Space>
        ) : null
      }
      onClose={onClose}
    >
      {isLoading || !data ? (
        <Spin />
      ) : (
        <Flexbox gap={24}>
          <Descriptions
            bordered
            column={1}
            size="small"
            title={t('admin.userDetail.profile', '用户资料')}
          >
            <Descriptions.Item label="ID">
              <code>{data.user.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.email', '邮箱')}>
              {data.user.email ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.phone', '手机号')}>
              {data.user.phone ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.name', '名称')}>
              {data.user.fullName ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.role', '角色')}>
              {data.user.role ? (
                <Tag color={data.user.role === 'admin' ? 'purple' : 'blue'}>{data.user.role}</Tag>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.status', '状态')}>
              {data.user.banned ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.joined', '注册时间')}>
              {data.user.createdAt ? new Date(data.user.createdAt).toLocaleString() : '—'}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            bordered
            column={2}
            size="small"
            title={t('admin.userDetail.balance', '积分余额')}
          >
            <Descriptions.Item label={t('admin.userDetail.balanceCurrent', '当前余额')}>
              {data.creditAccount?.balance ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.totalCredited', '累计增加')}>
              {data.creditAccount?.totalCredited ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.totalDebited', '累计扣减')}>
              {data.creditAccount?.totalDebited ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.userDetail.currency', '币种')}>
              {data.creditAccount?.currency ?? 'credits'}
            </Descriptions.Item>
          </Descriptions>

          {data.subscription ? (
            <Descriptions
              bordered
              column={2}
              size="small"
              title={t('admin.userDetail.subscription', '订阅')}
            >
              <Descriptions.Item label={t('admin.userDetail.plan', '套餐')}>
                <Tag>{data.subscription.plan}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.cycle', '周期')}>
                {data.subscription.cycle}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.subStatus', '状态')}>
                {data.subscription.status}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.monthlyCredits', '每月积分')}>
                {data.subscription.monthlyCredits}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.monthlyPrice', '月付价格')}>
                {data.subscription.monthlyPrice} {data.subscription.currency}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.userDetail.renewsAt', '续费时间')}>
                {data.subscription.renewsAt
                  ? new Date(data.subscription.renewsAt).toLocaleDateString()
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {data.subscription.endsAt
                  ? new Date(data.subscription.endsAt).toLocaleDateString()
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description={t('admin.userDetail.noSubscription', '暂无订阅')} />
          )}

          <div>
            <h4>{t('admin.userDetail.recentLedger', '最近积分流水')}</h4>
            <Table
              dataSource={data.recentLedger}
              pagination={false}
              rowKey="id"
              size="small"
              columns={[
                { dataIndex: 'type', key: 'type', title: '类型' },
                { dataIndex: 'amount', key: 'amount', title: '数量' },
                { dataIndex: 'balanceAfter', key: 'balanceAfter', title: '变动后余额' },
                { dataIndex: 'description', key: 'description', title: '描述' },
                {
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (v: Date) => new Date(v).toLocaleString(),
                  title: '时间',
                },
              ]}
            />
          </div>

          <div>
            <h4>{t('admin.userDetail.recentOrders', '最近充值订单')}</h4>
            <Table
              dataSource={data.recentOrders}
              pagination={false}
              rowKey="id"
              size="small"
              columns={[
                {
                  dataIndex: 'id',
                  key: 'id',
                  render: (v: string) => <code>{v.slice(0, 8)}</code>,
                  title: 'ID',
                },
                { dataIndex: 'credits', key: 'credits', title: '积分' },
                { dataIndex: 'amount', key: 'amount', title: '金额' },
                { dataIndex: 'currency', key: 'currency', title: '币种' },
                {
                  dataIndex: 'status',
                  key: 'status',
                  render: (s: string) => <Tag>{s}</Tag>,
                  title: '状态',
                },
                {
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (v: Date) => new Date(v).toLocaleString(),
                  title: '创建时间',
                },
              ]}
            />
          </div>

          <div>
            <h4>{t('admin.userDetail.auditTrail', '最近后台操作')}</h4>
            <Table
              dataSource={data.recentAudit ?? []}
              pagination={false}
              rowKey="id"
              size="small"
              columns={[
                {
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (v: Date) => new Date(v).toLocaleString(),
                  title: '时间',
                  width: 160,
                },
                {
                  dataIndex: 'action',
                  key: 'action',
                  render: (v: string) => <Tag>{v}</Tag>,
                  title: '操作',
                },
                {
                  dataIndex: 'actorUserId',
                  key: 'actor',
                  render: (v: string | null) => (v ? <code>{v.slice(0, 8)}</code> : '—'),
                  title: '操作者',
                },
                {
                  dataIndex: 'payload',
                  key: 'payload',
                  render: (v: Record<string, unknown> | null) =>
                    v ? (
                      <code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</code>
                    ) : (
                      '—'
                    ),
                  title: '载荷（Payload）',
                },
              ]}
            />
          </div>
        </Flexbox>
      )}
      <Modal
        confirmLoading={assigning}
        open={assignOpen}
        title="给用户分配套餐"
        onCancel={() => setAssignOpen(false)}
        onOk={handleAssignPlan}
      >
        <Flexbox gap={12}>
          <div>套餐</div>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="选择套餐"
            style={{ width: '100%' }}
            value={assignPlan}
            options={(plansData?.items ?? [])
              .filter((item: any) => item.isActive !== false)
              .map((item: any) => ({
                label: `${item.displayName || item.plan} (${item.plan})`,
                value: item.plan,
              }))}
            onChange={setAssignPlan}
          />
          <div>周期</div>
          <Select
            style={{ width: '100%' }}
            value={assignCycle}
            options={[
              { label: '月付', value: 'monthly' },
              { label: '年付', value: 'yearly' },
            ]}
            onChange={setAssignCycle}
          />
          <div>使用时长（月）</div>
          <InputNumber
            max={120}
            min={1}
            precision={0}
            style={{ width: '100%' }}
            value={assignDurationMonths}
            onChange={(v) => setAssignDurationMonths((v as number | null) ?? 1)}
          />
          <div>原因</div>
          <Input.TextArea
            placeholder="例如：线下购买、客服补偿、测试账号等"
            rows={3}
            value={assignReason}
            onChange={(e) => setAssignReason(e.target.value)}
          />
        </Flexbox>
      </Modal>
      <Modal
        confirmLoading={adjusting}
        open={adjustOpen}
        title={t('admin.adjustCredits', '调整积分')}
        onCancel={() => setAdjustOpen(false)}
        onOk={handleAdjust}
      >
        <Flexbox gap={12}>
          <div>{t('admin.adjustCredits.amount', '数量（正数增加，负数扣减）')}</div>
          <InputNumber
            style={{ width: '100%' }}
            value={adjustAmount}
            onChange={(v) => setAdjustAmount((v as number | null) ?? 0)}
          />
          <div>{t('admin.adjustCredits.reason', '原因')}</div>
          <Input.TextArea
            rows={3}
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          />
        </Flexbox>
      </Modal>
    </Drawer>
  );
});

AdminUserDetailDrawer.displayName = 'AdminUserDetailDrawer';

export default AdminUserDetailDrawer;
