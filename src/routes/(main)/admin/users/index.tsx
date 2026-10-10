'use client';

import {
  ADMIN_CAPABILITIES,
  ADMIN_ROLE_IDS,
  type AdminRole,
  hasAdminCapability,
  isFullAdminRole,
} from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Input, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Download } from 'lucide-react';
import type * as React from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import {
  AdminPageShell,
  AdminResponsiveTable,
  AdminSection,
  AdminToolbar,
  AdminUserDetailDrawer,
} from '@/features/Admin';
import AdminAssignPlanModal from '@/features/Admin/AdminAssignPlanModal';
import { toAdminAtomicCredits } from '@/features/Admin/adminCreditUnits';
import type { AdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';
import type { AdminSubscriptionCycle } from '@/features/Admin/adminSubscriptionCycles';
import { isFiniteAdminSubscriptionCycle } from '@/features/Admin/adminSubscriptionCycles';
import { AdminPageError } from '@/features/Admin/layout';
import { type AssignableRole, EMPTY_TEXT, type UserRow } from '@/features/Admin/Users/shared';
import { UserBulkToolbar } from '@/features/Admin/Users/userBulkToolbar';
import { buildUserColumns } from '@/features/Admin/Users/userColumns';
import { AdjustCreditsModal, BanUserModal, ResetAllToFreePlanSection } from '@/features/Admin/Users/userDangerousParts';
import { exportUsersCsv } from '@/features/Admin/Users/usersCsv';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

const styles = createStaticStyles(({ css }) => ({
  filter: css`
    width: 180px;

    @media (width < 640px) {
      width: 100%;
    }
  `,
  filters: css`
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    min-width: 0;
  `,
  search: css`
    width: min(320px, 100%);
  `,
  sort: css`
    width: 190px;

    @media (width < 640px) {
      width: 100%;
    }
  `,
}));

const AdminUsersPage = memo(() => {
  const { t } = useTranslation('subscription');
  const role = useUserStore((state) => (userProfileSelectors.userProfile(state) as any)?.role);
  const currentUserId = useUserStore(
    (state) => (userProfileSelectors.userId as any)(state) as string | undefined,
  );
  const canImpersonate = hasAdminCapability(role, ADMIN_CAPABILITIES.adminAccess);
  const canManageFinance = hasAdminCapability(role, ADMIN_CAPABILITIES.financeWrite);
  const canManageSupport = hasAdminCapability(role, ADMIN_CAPABILITIES.supportWrite);
  const canSetRoles = isFullAdminRole(role);
  const roleLabels: Record<AdminRole | 'user', string> = {
    admin: t('admin.roles.admin', '超级管理员'),
    content_admin: t('admin.roles.contentAdmin', '内容管理员'),
    finance_admin: t('admin.roles.financeAdmin', '财务管理员'),
    model_ops: t('admin.roles.modelOps', '模型运营'),
    module_admin: t('admin.roles.moduleAdmin', '模块管理员'),
    support_admin: t('admin.roles.supportAdmin', '用户支持'),
    system_admin: t('admin.roles.systemAdmin', '系统管理员'),
    user: t('admin.roles.user', '普通用户'),
  };
  const roleOptions: Array<{ label: string; value: AssignableRole }> = [
    ...ADMIN_ROLE_IDS.map((value) => ({ label: roleLabels[value], value })),
    { label: roleLabels.user, value: 'user' },
    { label: t('admin.roles.unset', '未设置'), value: '__none__' },
  ];
  const roleLabel = (value: string | null) =>
    value && value in roleLabels ? roleLabels[value as AdminRole | 'user'] : EMPTY_TEXT;
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string | undefined>();
  const [subscriptionStartedOrder, setSubscriptionStartedOrder] = useState<'asc' | 'desc'>();
  const [cursor, setCursor] = useState(0);
  const [allItems, setAllItems] = useState<UserRow[]>([]);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [assignPlan, setAssignPlan] = useState<string>();
  const [assignCycle, setAssignCycle] = useState<AdminSubscriptionCycle>('monthly');
  const [assignDurationMonths, setAssignDurationMonths] = useState<number>(1);
  const [assignReason, setAssignReason] = useState('');
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AssignableRole>>({});
  // M5 §5.2 批量：勾选 + 批量封禁/改角色（typed 确认），支持跨页累加。
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<AssignableRole | null>(null);
  const onClearSelection = () => {
    setSelectedUserIds([]);
    setBulkRole(null);
  };

  const swrKey = ['admin-users', query, planFilter ?? '', subscriptionStartedOrder ?? '', cursor];
  const { data: plansData } = useClientDataSWR(
    canManageFinance ? ['admin-user-list-plan-options'] : null,
    () => adminCommercialService.listPlans(),
  );
  const { data: resetAllToFreePlanPreview, isLoading: resetPreviewLoading } = useClientDataSWR(
    canSetRoles ? ['admin-reset-all-to-free-plan-preview'] : null,
    () => adminCommercialService.getResetAllUsersToFreePlanPreview(),
  );

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(
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
      toast.success(t('admin.ban.success', '用户已封禁'));
      setBanTarget(null);
      setBanReason('');
      invalidate();
    } catch {
      toast.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminCommercialService.unbanUser(userId);
      toast.success(t('admin.unban.success', '用户已解封'));
      invalidate();
    } catch {
      toast.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetRole = async (
    userId: string,
    value: string,
    command: AdminDangerousActionEnvelope<'user.setRole'>,
  ) => {
    setActionLoading(`${userId}-role`);
    try {
      const role = value === '__none__' ? null : (value as AdminRole | 'user');
      await adminCommercialService.setUserRole({ role, userId }, command);
      setRoleDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      toast.success(t('admin.setRole.success', '角色已更新'));
      invalidate();
    } catch {
      toast.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdjustCredits = async (command: AdminDangerousActionEnvelope<'credits.adjust'>) => {
    const normalizedReason = command.reason?.trim();
    if (!adjustTarget || !normalizedReason || !adjustAmount) {
      toast.warning(t('admin.adjustCredits.invalid', '请输入积分数量和调整原因'));
      return;
    }
    setActionLoading(`${adjustTarget}-credits`);
    try {
      await adminCommercialService.adjustCredits(
        {
          amount: toAdminAtomicCredits(adjustAmount),
          reason: normalizedReason,
          userId: adjustTarget,
        },
        command,
      );
      toast.success(t('admin.adjustCredits.success', '积分已调整'));
      setAdjustTarget(null);
      setAdjustAmount(0);
    } catch {
      toast.error(t('admin.error.generic', '操作失败，请稍后重试'));
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
    const durationMonths = isFiniteAdminSubscriptionCycle(assignCycle)
      ? Math.round(assignDurationMonths)
      : 1;
    if (!assignTarget || !assignPlan || durationMonths < 1 || !assignReason.trim()) {
      toast.warning(t('admin.assignPlan.invalid', '请选择套餐、使用时长并填写原因'));
      return;
    }

    setActionLoading(`${assignTarget}-plan`);
    try {
      await adminCommercialService.assignUserPlan({
        cycle: assignCycle,
        durationMonths,
        plan: assignPlan,
        reason: assignReason.trim(),
        userId: assignTarget,
      });
      toast.success(t('admin.assignPlan.success', '套餐已设置'));
      closeAssignPlan();
      await mutate(['admin-subscriptions']);
      invalidate();
    } catch {
      toast.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };
  const handleResetAllToFreePlan = async (
    command: AdminDangerousActionEnvelope<'user.resetAllToFreePlan'>,
  ) => {
    setActionLoading('reset-all-free');
    try {
      const result = await adminCommercialService.resetAllUsersToFreePlan(command);
      toast.success(
        t(
          'admin.resetAllToFreePlan.success',
          `已重置：取消 ${result.canceledPaid} 个付费套餐，规范 ${result.normalizedFree} 个免费套餐，新增 ${result.insertedFree} 个免费套餐。`,
        ),
      );
      invalidate();
    } catch {
      toast.error(t('admin.error.generic', '操作失败，请稍后重试'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async (
    row: UserRow,
    command: AdminDangerousActionEnvelope<'user.impersonate.attempt'>,
  ) => {
    setActionLoading(`${row.id}-impersonate`);
    try {
      await adminCommercialService.impersonateUser(row.id, command);
      toast.success(t('admin.impersonate.success', '已切换用户身份'));
      window.location.assign('/');
    } catch {
      toast.error(t('admin.impersonate.failed', '切换用户身份失败'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await adminCommercialService.exportUsers({
        limit: 10_000,
        query: undefined,
      });
      exportUsersCsv(result.items as any[], t);
      toast.success(t('admin.exportSuccess', `已导出 ${result.items.length} 条`));
    } catch {
      toast.error(t('admin.exportFailed', '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  const columns = buildUserColumns({
    actionLoading,
    canImpersonate,
    canManageFinance,
    canManageSupport,
    canSetRoles,
    handleAdjustTarget: (row) => {
      setAdjustTarget(row.id);
      setAdjustAmount(0);
    },
    handleAssignPlan: openAssignPlan,
    handleImpersonate,
    handleSetRole,
    handleUnban,
    roleDrafts,
    roleLabel,
    roleOptions,
    setAdjustAmount,
    setAdjustTarget,
    setBanTarget,
    setDetailUserId,
    setRoleDrafts,
    t: t as any,
  });

  return (
    <AdminPageShell
      title={t('admin.users.title', '用户与权限')}
      width="full"
      description={t(
        'admin.users.description',
        '查询用户、核对订阅状态，并在权限范围内执行支持、积分和角色管理。',
      )}
    >
      <AdminSection
        title={t('admin.users.listTitle', '用户列表')}
        description={
          t('admin.users.resultSummary', {
            count: allItems.length,
            defaultValue: '当前已加载 {{count}} 位用户',
          }) + (query ? `，${t('admin.search', '搜索')}“${query}”` : '')
        }
      >
        <AdminToolbar>
          <div className={styles.filters}>
            {/* base-ui Input 无 Search 复合件：Enter 提交搜索（onSearch 语义由 onPressEnter 承接）。 */}
            <Input
              allowClear
              className={styles.search}
              placeholder={t('admin.search', '搜索用户')}
              onPressEnter={(event) => handleSearch((event.target as HTMLInputElement).value)}
            />
            <Select
              allowClear
              className={styles.filter}
              placeholder={t('admin.filterByPlan', '按套餐筛选')}
              value={planFilter}
              options={(plansData?.items ?? []).map((item: any) => ({
                label: `${item.displayName || item.plan} (${item.plan})`,
                value: item.plan,
              }))}
              onChange={(value: null | string | undefined) => {
                setPlanFilter(value ?? undefined);
                resetList();
              }}
            />
            <Select
              allowClear
              className={styles.sort}
              placeholder={t('admin.subscriptionStartedOrder', '套餐开始时间排序')}
              value={subscriptionStartedOrder}
              options={[
                { label: t('admin.subscriptionStartedOrder.asc', '开始时间正序'), value: 'asc' },
                { label: t('admin.subscriptionStartedOrder.desc', '开始时间倒序'), value: 'desc' },
              ]}
              onChange={(value: 'asc' | 'desc' | null | undefined) => {
                setSubscriptionStartedOrder(value ?? undefined);
                resetList();
              }}
            />
          </div>
          {selectedUserIds.length > 0 && canManageSupport ? (
            <UserBulkToolbar
              bulkRole={bulkRole}
              canSetRoles={canSetRoles}
              invalidate={invalidate}
              roleOptions={roleOptions}
              selectedUserIds={selectedUserIds}
              setBulkRole={setBulkRole}
              t={t as any}
              onClearSelection={onClearSelection}
            />
          ) : null}
          <Button disabled={exporting} loading={exporting} onClick={handleExport}>
            <Download aria-hidden size={16} />
            {t('admin.exportCsv', '导出 CSV')}
          </Button>
        </AdminToolbar>
        {error ? (
          <AdminPageError
            description={t('admin.users.loadFailed', '用户列表加载失败，请重试。')}
            onRetry={refresh}
          />
        ) : (
          <AdminResponsiveTable label={t('admin.users.tableLabel', '用户数据表')}>
            <InlineTable
              columns={columns as any}
              dataSource={allItems}
              loading={isLoading && cursor === 0}
              locale={{ emptyText: t('admin.noData', '暂无数据') }}
              rowKey="id"
              rowSelection={{
                // 评审修复（对齐订单页 isBulkEligibleOrder 防线）：已封禁、
                // 超管账号与本人所在行不可勾选——封禁已封禁用户是空操作、
                // 超管账号封禁需要单独警示、勾中自己会触发服务端批级
                // CANNOT_BAN_SELF 而拒绝整批（最多 50 人）。
                getCheckboxProps: (row: any) => ({
                  disabled:
                    !canManageSupport ||
                    row.id === undefined ||
                    row.id === currentUserId ||
                    Boolean(row.banned) ||
                    isFullAdminRole(row.role),
                }),
                onChange: (keys: React.Key[]) => setSelectedUserIds(keys.map(String)),
                selectedRowKeys: selectedUserIds,
              }}
            />
          </AdminResponsiveTable>
        )}
        {!error && data?.nextCursor != null && (
          <Flexbox align="center">
            <Button loading={isLoading && cursor > 0} onClick={handleLoadMore}>
              {t('admin.loadMore', '加载更多')}
            </Button>
          </Flexbox>
        )}
      </AdminSection>
      {canSetRoles ? (
        <AdminSection
          title={t('admin.users.dangerTitle', '批量危险操作')}
          description={t(
            'admin.users.dangerDescription',
            '批量动作会影响大量用户权益，仅在完成影响预检后执行。',
          )}
        >
          <ResetAllToFreePlanSection
            actionLoading={actionLoading}
            handleResetAllToFreePlan={handleResetAllToFreePlan}
            resetPreview={resetAllToFreePlanPreview ?? null}
            resetPreviewLoading={resetPreviewLoading}
            t={t as any}
          />
        </AdminSection>
      ) : null}
      <BanUserModal
        actionLoading={actionLoading}
        banReason={banReason}
        banTarget={banTarget}
        handleBan={handleBan}
        setBanReason={setBanReason}
        setBanTarget={setBanTarget}
        t={t as any}
      />
      <AdjustCreditsModal
        actionLoading={actionLoading}
        adjustAmount={adjustAmount}
        adjustTarget={adjustTarget}
        handleAdjustCredits={handleAdjustCredits}
        setAdjustAmount={setAdjustAmount}
        setAdjustTarget={setAdjustTarget}
        t={t as any}
      />
      {canManageFinance ? (
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
      ) : null}
      <AdminUserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} />
    </AdminPageShell>
  );
});

AdminUsersPage.displayName = 'AdminUsersPage';

export default AdminUsersPage;
