'use client';

import { Avatar, Flexbox } from '@lobehub/ui';
import { Button, Empty, Input, InputNumber, message, Modal, Select, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { AdminUserDetailDrawer } from '@/features/Admin';
import AdminAssignPlanModal from '@/features/Admin/AdminAssignPlanModal';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type UserSubscription = {
  cycle: string;
  endsAt: Date | null;
  plan: string;
  startedAt: Date | null;
  status: string;
};

type UserRow = {
  avatar: string | null;
  banned: boolean | null;
  createdAt: Date | null;
  email: string | null;
  fullName: string | null;
  id: string;
  lastActiveAt: Date | null;
  phone: string | null;
  role: string | null;
  subscription: UserSubscription | null;
};

const EMPTY_TEXT = '-';

const ROLE_OPTIONS = [
  { label: '管理员（Admin）', value: 'admin' },
  { label: '普通用户（User）', value: 'user' },
  { label: '未设置', value: '__none__' },
];

const roleLabel = (role: string | null) => {
  if (role === 'admin') return '管理员';
  if (role === 'user') return '普通用户';

  return EMPTY_TEXT;
};

const AdminUsersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string | undefined>();
  const [subscriptionStartedOrder, setSubscriptionStartedOrder] = useState<'asc' | 'desc'>();
  const [cursor, setCursor] = useState(0);
  const [allItems, setAllItems] = useState<UserRow[]>([]);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [assignPlan, setAssignPlan] = useState<string>();
  const [assignCycle, setAssignCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [assignDurationMonths, setAssignDurationMonths] = useState<number>(1);
  const [assignReason, setAssignReason] = useState('');
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const swrKey = ['admin-users', query, planFilter ?? '', subscriptionStartedOrder ?? '', cursor];
  const { data: plansData } = useClientDataSWR(['admin-user-list-plan-options'], () =>
    adminCommercialService.listPlans(),
  );

  const { data, isLoading } = useClientDataSWR(
    swrKey,
    () =>
      adminCommercialService.listUsers({
        cursor,
        limit: 20,
        plan: planFilter,
        query: query || undefined,
        subscriptionStartedOrder,
      }),
    {
      onSuccess: (result) => {
        if (cursor === 0) {
          setAllItems(result.items as UserRow[]);
        } else {
          setAllItems((prev) => [...prev, ...(result.items as UserRow[])]);
        }
      },
    },
  );

  const resetList = () => {
    setCursor(0);
    setAllItems([]);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    resetList();
  };

  const handleLoadMore = () => {
    if (data?.nextCursor != null) setCursor(data.nextCursor);
  };

  const invalidate = () => {
    setCursor(0);
    setAllItems([]);
    mutate(['admin-users', query, planFilter ?? '', subscriptionStartedOrder ?? '', 0]);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setActionLoading(banTarget);
    try {
      await adminCommercialService.banUser({
        banReason: banReason || undefined,
        userId: banTarget,
      });
      message.success(t('admin.ban.success', '用户已封禁'));
      setBanTarget(null);
      setBanReason('');
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminCommercialService.unbanUser(userId);
      message.success(t('admin.unban.success', '用户已解封'));
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetRole = async (userId: string, value: string) => {
    setActionLoading(`${userId}-role`);
    try {
      const role = value === '__none__' ? null : (value as 'admin' | 'user');
      await adminCommercialService.setUserRole({ role, userId });
      message.success(t('admin.setRole.success', '角色已更新'));
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdjustCredits = async () => {
    if (!adjustTarget || !adjustReason.trim() || !adjustAmount) {
      message.warning(t('admin.adjustCredits.invalid', '请输入积分数量和调整原因'));
      return;
    }
    setActionLoading(`${adjustTarget}-credits`);
    try {
      await adminCommercialService.adjustCredits({
        amount: Math.round(adjustAmount),
        reason: adjustReason,
        userId: adjustTarget,
      });
      message.success(t('admin.adjustCredits.success', '积分已调整'));
      setAdjustTarget(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const openAssignPlan = (userId: string) => {
    setAssignTarget(userId);
    setAssignPlan(undefined);
    setAssignCycle('monthly');
    setAssignDurationMonths(1);
    setAssignReason('');
  };

  const closeAssignPlan = () => {
    setAssignTarget(null);
    setAssignPlan(undefined);
    setAssignCycle('monthly');
    setAssignDurationMonths(1);
    setAssignReason('');
  };

  const handleAssignPlan = async () => {
    if (!assignTarget || !assignPlan || !assignDurationMonths || !assignReason.trim()) {
      message.warning(t('admin.assignPlan.invalid', '请选择套餐、使用时长并填写原因'));
      return;
    }

    setActionLoading(`${assignTarget}-plan`);
    try {
      await adminCommercialService.assignUserPlan({
        cycle: assignCycle,
        durationMonths: Math.round(assignDurationMonths),
        plan: assignPlan,
        reason: assignReason.trim(),
        userId: assignTarget,
      });
      message.success(t('admin.assignPlan.success', '套餐已设置'));
      closeAssignPlan();
      await mutate(['admin-subscriptions']);
      invalidate();
    } catch {
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetAllToFreePlan = async () => {
    setActionLoading('reset-all-free-preview');

    let preview: { canceledPaid: number; insertedFree: number; normalizedFree: number };
    try {
      preview = await adminCommercialService.getResetAllUsersToFreePlanPreview();
    } catch {
      setActionLoading(null);
      message.error(t('admin.error.generic', '操作失败，请稍后重试'));
      return;
    }

    setActionLoading(null);

    Modal.confirm({
      content: (
        <Flexbox gap={8}>
          <div>
            {t(
              'admin.resetAllToFreePlan.confirmContent',
              '这会取消所有当前付费套餐，并确保每个用户都有一个无限期免费套餐。用户已有积分余额不会被清零。',
            )}
          </div>
          <div>
            {t(
              'admin.resetAllToFreePlan.preview',
              `预计影响：取消 ${preview.canceledPaid} 个付费套餐，规范 ${preview.normalizedFree} 个免费套餐，补充 ${preview.insertedFree} 个免费套餐。`,
            )}
          </div>
        </Flexbox>
      ),
      okButtonProps: { danger: true },
      okText: t('admin.resetAllToFreePlan.ok', '确认重置'),
      title: t('admin.resetAllToFreePlan.confirmTitle', '确认重置所有用户套餐？'),
      onOk: async () => {
        setActionLoading('reset-all-free');
        try {
          const result = await adminCommercialService.resetAllUsersToFreePlan({
            reason: 'admin_reset_from_users_page',
          });
          message.success(
            t(
              'admin.resetAllToFreePlan.success',
              `已重置：取消 ${result.canceledPaid} 个付费套餐，规范 ${result.normalizedFree} 个免费套餐，新增 ${result.insertedFree} 个免费套餐。`,
            ),
          );
          invalidate();
        } catch {
          message.error(t('admin.error.generic', '操作失败，请稍后重试'));
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const columns: ColumnsType<UserRow> = [
    {
      dataIndex: 'fullName',
      key: 'name',
      render: (name: string | null, row) => (
        <Space>
          <Avatar avatar={row.avatar ?? undefined} size={28} title={name ?? row.email ?? ''} />
          <span>{name ?? EMPTY_TEXT}</span>
        </Space>
      ),
      title: t('admin.name', '姓名'),
    },
    {
      dataIndex: 'email',
      key: 'email',
      render: (value: string | null) => value ?? EMPTY_TEXT,
      title: t('admin.email', '邮箱'),
    },
    {
      dataIndex: 'phone',
      key: 'phone',
      render: (value: string | null) => value ?? EMPTY_TEXT,
      title: t('admin.phone', '手机号'),
    },
    {
      dataIndex: 'subscription',
      key: 'subscription',
      render: (subscription: UserSubscription | null) =>
        subscription ? (
          <Space size={6}>
            <Tag color="blue">{subscription.plan}</Tag>
            <span>
              {subscription.startedAt
                ? new Date(subscription.startedAt).toLocaleDateString()
                : EMPTY_TEXT}
            </span>
          </Space>
        ) : (
          <Tag>{EMPTY_TEXT}</Tag>
        ),
      title: t('admin.currentPlanWithStartedAt', '当前套餐 / 开始时间'),
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (value: string | null) =>
        value ? (
          <Tag color={value === 'admin' ? 'purple' : 'blue'}>{roleLabel(value)}</Tag>
        ) : (
          <span>{EMPTY_TEXT}</span>
        ),
      title: t('admin.role', '角色'),
    },
    {
      dataIndex: 'banned',
      key: 'status',
      render: (value: boolean | null) =>
        value ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>,
      title: t('admin.status', '状态'),
    },
    {
      dataIndex: 'createdAt',
      key: 'joined',
      render: (value: Date | null) => (value ? new Date(value).toLocaleDateString() : EMPTY_TEXT),
      title: t('admin.joined', '注册时间'),
    },
    {
      dataIndex: 'lastActiveAt',
      key: 'lastActive',
      render: (value: Date | null) => (value ? new Date(value).toLocaleDateString() : EMPTY_TEXT),
      title: t('admin.lastActive', '最近活跃'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: UserRow) => (
        <Space>
          {row.banned ? (
            <Button
              loading={actionLoading === row.id}
              size="small"
              onClick={() => handleUnban(row.id)}
            >
              {t('admin.unban', '解封')}
            </Button>
          ) : (
            <Button
              danger
              loading={actionLoading === row.id}
              size="small"
              onClick={() => setBanTarget(row.id)}
            >
              {t('admin.ban', '封禁')}
            </Button>
          )}
          <Select
            loading={actionLoading === `${row.id}-role`}
            options={ROLE_OPTIONS}
            placeholder={t('admin.setRole', '设置角色')}
            size="small"
            style={{ width: 132 }}
            value={row.role ?? '__none__'}
            onChange={(value) => handleSetRole(row.id, value)}
          />
          <Button
            size="small"
            onClick={() => {
              setAdjustTarget(row.id);
              setAdjustAmount(0);
              setAdjustReason('');
            }}
          >
            {t('admin.adjustCredits', '调整积分')}
          </Button>
          <Button
            loading={actionLoading === `${row.id}-plan`}
            size="small"
            onClick={() => openAssignPlan(row.id)}
          >
            {t('admin.assignPlan', '设置套餐')}
          </Button>
          <Button size="small" onClick={() => setDetailUserId(row.id)}>
            {t('admin.viewDetail', '详情')}
          </Button>
        </Space>
      ),
      title: t('admin.actions', '操作'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" gap={12}>
        <Input.Search
          allowClear
          placeholder={t('admin.search', '搜索用户')}
          style={{ maxWidth: 320 }}
          onSearch={handleSearch}
        />
        <Select
          allowClear
          placeholder={t('admin.filterByPlan', '按套餐筛选')}
          style={{ width: 180 }}
          value={planFilter}
          options={(plansData?.items ?? []).map((item: any) => ({
            label: `${item.displayName || item.plan} (${item.plan})`,
            value: item.plan,
          }))}
          onChange={(value) => {
            setPlanFilter(value);
            resetList();
          }}
        />
        <Select
          allowClear
          placeholder={t('admin.subscriptionStartedOrder', '套餐开始时间排序')}
          style={{ width: 190 }}
          value={subscriptionStartedOrder}
          options={[
            { label: t('admin.subscriptionStartedOrder.asc', '开始时间正序'), value: 'asc' },
            { label: t('admin.subscriptionStartedOrder.desc', '开始时间倒序'), value: 'desc' },
          ]}
          onChange={(value) => {
            setSubscriptionStartedOrder(value);
            resetList();
          }}
        />
        <Button
          onClick={async () => {
            try {
              const result = await adminCommercialService.exportUsers({
                limit: 10_000,
                query: undefined,
              });
              const header = [
                'id',
                'email',
                'username',
                'fullName',
                'phone',
                'role',
                'banned',
                'createdAt',
                'lastActiveAt',
              ];
              const escape = (value: unknown) => {
                if (value === null || value === undefined) return '';
                const text = typeof value === 'string' ? value : JSON.stringify(value);

                return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
              };
              const lines = [header.join(',')];
              for (const user of result.items as any[]) {
                lines.push(
                  [
                    user.id,
                    user.email,
                    user.username,
                    user.fullName,
                    user.phone,
                    user.role,
                    user.banned,
                    user.createdAt ? new Date(user.createdAt).toISOString() : '',
                    user.lastActiveAt ? new Date(user.lastActiveAt).toISOString() : '',
                  ]
                    .map(escape)
                    .join(','),
                );
              }
              const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
              const link = document.createElement('a');
              link.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
              link.href = URL.createObjectURL(blob);
              link.click();
              URL.revokeObjectURL(link.href);
              message.success(t('admin.exportSuccess', `已导出 ${result.items.length} 条`));
            } catch {
              message.error(t('admin.exportFailed', '导出失败'));
            }
          }}
        >
          {t('admin.exportCsv', '导出 CSV')}
        </Button>
        <Button
          danger
          loading={actionLoading === 'reset-all-free' || actionLoading === 'reset-all-free-preview'}
          onClick={handleResetAllToFreePlan}
        >
          {t('admin.resetAllToFreePlan', '重置所有用户为免费套餐')}
        </Button>
      </Flexbox>
      <InlineTable
        columns={columns as any}
        dataSource={allItems}
        loading={isLoading && cursor === 0}
        locale={{ emptyText: <Empty description={t('admin.noData', '暂无数据')} /> }}
        rowKey="id"
      />
      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading && cursor > 0} onClick={handleLoadMore}>
            {t('admin.loadMore', '加载更多')}
          </Button>
        </Flexbox>
      )}
      <Modal
        open={!!banTarget}
        title={t('admin.ban', '封禁用户')}
        onOk={handleBan}
        onCancel={() => {
          setBanTarget(null);
          setBanReason('');
        }}
      >
        <Input.TextArea
          placeholder={t('admin.ban.reason', '请输入封禁原因')}
          rows={3}
          value={banReason}
          onChange={(event) => setBanReason(event.target.value)}
        />
      </Modal>
      <Modal
        confirmLoading={actionLoading === `${adjustTarget ?? ''}-credits`}
        open={!!adjustTarget}
        title={t('admin.adjustCredits', '调整积分')}
        onOk={handleAdjustCredits}
        onCancel={() => {
          setAdjustTarget(null);
          setAdjustAmount(0);
          setAdjustReason('');
        }}
      >
        <Flexbox gap={12}>
          <Flexbox gap={4}>
            <div>{t('admin.adjustCredits.amount', '积分数量（可输入负数扣减）')}</div>
            <InputNumber
              style={{ width: '100%' }}
              value={adjustAmount}
              onChange={(value) => setAdjustAmount(Number(value ?? 0))}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <div>{t('admin.adjustCredits.reason', '原因')}</div>
            <Input.TextArea
              rows={3}
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
            />
          </Flexbox>
        </Flexbox>
      </Modal>
      <AdminAssignPlanModal
        confirmLoading={actionLoading === `${assignTarget ?? ''}-plan`}
        cycle={assignCycle}
        durationMonths={assignDurationMonths}
        open={!!assignTarget}
        plan={assignPlan}
        plans={plansData?.items ?? []}
        reason={assignReason}
        title={t('admin.assignPlan.title', '设置用户套餐')}
        onCancel={closeAssignPlan}
        onCycleChange={setAssignCycle}
        onDurationMonthsChange={setAssignDurationMonths}
        onOk={handleAssignPlan}
        onPlanChange={setAssignPlan}
        onReasonChange={setAssignReason}
      />
      <AdminUserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} />
    </Flexbox>
  );
});

AdminUsersPage.displayName = 'AdminUsersPage';

export default AdminUsersPage;
