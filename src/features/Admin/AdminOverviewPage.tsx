'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Spin, Tag } from 'antd';
import {
  ArrowRight,
  ChartNoAxesColumn,
  CircleDollarSign,
  GitPullRequest,
  Settings,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import { ADMIN_BASE_PATH, ADMIN_NAV_GROUPS } from '@/features/Admin/adminNavigation';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { AdminMetricStrip, AdminPageError, AdminPageShell, AdminSection } from './layout';
import { overviewStyles } from './Overview/overviewStyles';
import { WorkbenchTodoCard } from './Overview/workbenchCards';



const AdminOverviewPage = memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation('subscription');
  const currentUserId = useUserStore((s) => (userProfileSelectors as any).userId(s)) as
    | string
    | undefined;
  const {
    data: overview,
    error: overviewError,
    mutate: refreshOverview,
  } = useClientDataSWR(['admin-overview-stats'], () => adminCommercialService.getStatsOverview());
  const {
    data: pendingChanges,
    error: pendingChangesError,
    mutate: refreshPendingChanges,
  } = useClientDataSWR(['admin-overview-pending-changes'], () =>
    adminCommercialService.listChangeRequests({ limit: 5, status: 'pending' }),
  );
  // M5 §2.3 工作台五卡片：模块审核 / 收益结算 / 最近审计（全部只读查询聚合）。
  const {
    data: pendingPackages,
    error: pendingPackagesError,
    mutate: refreshPendingPackages,
  } = useClientDataSWR(['admin-overview-pending-packages'], () =>
    adminCommercialService.moduleApps.listPackages({ limit: 5, reviewStatus: 'pending_review' }),
  );
  const {
    data: pendingPayouts,
    error: pendingPayoutsError,
    mutate: refreshPendingPayouts,
  } = useClientDataSWR(['admin-overview-pending-payouts'], () =>
    adminCommercialService.moduleApps.listPayouts({ limit: 5, status: 'pending' }),
  );
  const {
    data: recentAudit,
    error: recentAuditError,
    mutate: refreshRecentAudit,
  } = useClientDataSWR(
    currentUserId ? ['admin-overview-recent-audit', currentUserId] : null,
    () => adminCommercialService.listAudit({ actorUserId: currentUserId, cursor: 0, limit: 10 }),
  );
  const {
    data: settings,
    error: settingsError,
    mutate: refreshSettings,
  } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () => adminCommercialService.getAllSettings());

  const pendingChangeCount = pendingChanges?.total ?? 0;
  const pendingPackageItems: any[] = (pendingPackages as any)?.items ?? [];
  const pendingPayoutItems: any[] = (pendingPayouts as any)?.items ?? [];
  const recentAuditItems: any[] = (recentAudit as any)?.items ?? [];
  const defaultModel =
    settings?.defaultAgentProvider && settings?.defaultAgentModel
      ? `${settings.defaultAgentProvider}/${settings.defaultAgentModel}`
      : '未设置';

  return (
    <AdminPageShell
      description="集中查看关键状态，并进入用户、商业化、AI 平台、模块应用和系统运维。"
      title="后台工作台"
      width="full"
    >
      {overviewError ? (
        <AdminPageError description="核心指标加载失败，请重试。" onRetry={refreshOverview} />
      ) : (
        <AdminMetricStrip
          label={t('admin.overview.metricsLabel', '关键指标')}
          items={[
            {
              hint: '平台注册账户',
              icon: <Icon icon={Users} size={18} />,
              key: 'users',
              label: '总用户',
              value: overview ? overview.totalUsers : '...',
            },
            {
              hint: '最近 24 小时',
              icon: <Icon icon={UserRoundCheck} size={18} />,
              key: 'dau',
              label: '日活用户',
              value: overview ? overview.dau : '...',
            },
            {
              hint: '当前有效状态',
              icon: <Icon icon={ChartNoAxesColumn} size={18} />,
              key: 'subscriptions',
              label: '有效订阅',
              value: overview ? overview.activeSubscriptions : '...',
            },
            {
              hint: '近 30 天实收充值',
              icon: <Icon icon={CircleDollarSign} size={18} />,
              key: 'revenue',
              label: '充值收入',
              value: overview ? `$${overview.revenueLast30dUsd}` : '...',
            },
          ]}
        />
      )}

      <div className={overviewStyles.split}>
        <AdminSection
          description="优先处理会影响用户权益和订阅状态的请求。"
          title="待处理事项"
          actions={
            <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/subscriptions`)}>
              处理请求
              <ArrowRight aria-hidden size={14} />
            </Button>
          }
        >
          <div className={overviewStyles.pending}>
            {pendingChangesError ? (
              <AdminPageError
                description="待处理事项加载失败，请重试。"
                onRetry={refreshPendingChanges}
              />
            ) : pendingChanges ? (
              <>
                <Tag
                  color={pendingChangeCount > 0 ? 'processing' : 'success'}
                  icon={<GitPullRequest size={13} />}
                >
                  套餐变更请求 {pendingChangeCount}
                </Tag>
                <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/orders`)}>
                  查看相关订单
                </Button>
              </>
            ) : (
              <Spin />
            )}
          </div>
          <Flexbox gap={12} style={{ marginTop: 12 }}>
            <WorkbenchTodoCard
              description="模块应用包待人工审核，按提交时间排序处理。"
              items={pendingPackageItems.map((item: any) => ({
                hint: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : undefined,
                label: item.name ?? item.appId ?? item.id,
                tag: item.scanStatus === 'flagged' ? '警示' : undefined,
                tagColor: 'warning',
              }))}
              title={t('admin.workbench.pendingPackages', '模块应用审核')}
              total={pendingPackageItems.length}
              onViewAll={() => navigate(`${ADMIN_BASE_PATH}/modules`)}
              viewAllLabel={t('admin.workbench.viewAll', '查看全部')}
            />
            <WorkbenchTodoCard
              description="待处理的收益结算单，确认后进入打款流程。"
              items={pendingPayoutItems.map((item: any) => ({
                hint: item.amount != null ? String(item.amount) : undefined,
                label: item.publisherName ?? item.publisherId ?? item.id,
              }))}
              title={t('admin.workbench.pendingPayouts', '收益结算')}
              total={pendingPayoutItems.length}
              onViewAll={() => navigate(`${ADMIN_BASE_PATH}/modules`)}
              viewAllLabel={t('admin.workbench.viewAll', '查看全部')}
            />
          </Flexbox>
          {(pendingPackagesError || pendingPayoutsError || recentAuditError) && (
            <AdminPageError
              description="工作台数据加载失败，请重试。"
              onRetry={() => {
                refreshPendingPackages();
                refreshPendingPayouts();
                refreshRecentAudit();
              }}
            />
          )}
        </AdminSection>

        <AdminSection
          description="快速核对影响全站体验的核心默认值与我最近的操作。"
          title="系统状态"
          actions={
            <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/settings`)}>
              <Settings aria-hidden size={14} />
              修改设置
            </Button>
          }
        >
          {settingsError ? (
            <AdminPageError description="系统状态加载失败，请重试。" onRetry={refreshSettings} />
          ) : settings ? (
            <div>
              <div className={overviewStyles.keyValue}>
                <span className={overviewStyles.keyValueLabel}>品牌名称</span>
                <strong className={overviewStyles.keyValueValue}>{settings.brandName || '未设置'}</strong>
              </div>
              <div className={overviewStyles.keyValue}>
                <span className={overviewStyles.keyValueLabel}>默认模型</span>
                <strong className={overviewStyles.keyValueValue}>{defaultModel}</strong>
              </div>
              <div className={overviewStyles.keyValue}>
                <span className={overviewStyles.keyValueLabel}>推荐奖励</span>
                <strong className={overviewStyles.keyValueValue}>
                  {settings.referralRewardCredits ?? 0} 积分
                </strong>
              </div>
              <div style={{ marginTop: 12 }}>
                <WorkbenchTodoCard
                  description="按操作者（当前管理员）过滤的最近 10 条审计记录。"
                  items={recentAuditItems.map((item: any) => ({
                    hint: item.createdAt ? new Date(item.createdAt).toLocaleString() : undefined,
                    label: item.action,
                  }))}
                  title={t('admin.workbench.recentAuditCard', '我最近的操作')}
                  total={recentAuditItems.length}
                  onViewAll={() => navigate(`${ADMIN_BASE_PATH}/audit`)}
                  viewAllLabel={t('admin.workbench.openAudit', '打开审计记录')}
                />
              </div>
            </div>
          ) : (
            <Spin />
          )}
        </AdminSection>
      </div>

      <AdminSection
        description="入口按职责域组织；日常操作无需在长菜单中反复定位。"
        title="管理模块"
      >
        <div className={overviewStyles.groupGrid}>
          {ADMIN_NAV_GROUPS.filter((group) => group.key !== 'overview').map((group) => (
            <article className={overviewStyles.group} key={group.key}>
              <h3 className={overviewStyles.groupTitle}>{group.label}</h3>
              <p className={overviewStyles.groupDescription}>{group.description}</p>
              <div className={overviewStyles.linkList}>
                {group.items.map((item) => (
                  <button
                    className={overviewStyles.link}
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                  >
                    <span>{item.label}</span>
                    <ArrowRight aria-hidden size={14} />
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </AdminSection>
    </AdminPageShell>
  );
});

AdminOverviewPage.displayName = 'AdminOverviewPage';

export default AdminOverviewPage;
