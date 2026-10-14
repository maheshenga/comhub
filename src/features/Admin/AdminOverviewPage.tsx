'use client';

import { Button, Tag } from '@lobehub/ui/base-ui';
import { ArrowRight, GitPullRequest, Settings } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import { formatAdminCredits } from '@/features/Admin/adminCreditUnits';
import { ADMIN_BASE_PATH } from '@/features/Admin/adminNavigation';
import { AdminInlineSkeleton } from '@/features/Admin/shared';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import {
  adminIconSizes,
  AdminMetricStrip,
  AdminPageError,
  AdminPageShell,
  AdminSection,
} from './layout';
import { overviewStyles } from './Overview/overviewStyles';
import { WorkbenchTodoCard } from './Overview/workbenchCards';
import {
  buildOverviewMetrics,
  WorkbenchModuleAppsSection,
  WorkbenchQuickLinks,
  WorkbenchRevenueCard,
  WorkbenchUsersSection,
} from './Overview/workbenchDashboardCards';

const AdminOverviewPage = memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation('subscription');
  const currentUserId = useUserStore((s) => (userProfileSelectors as any).userId(s)) as
    | string
    | undefined;
  const {
    data: overview,
    error: overviewError,
    isLoading: overviewLoading,
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
  // §5.2 收入卡 30 天活跃走势：复用既有只读端点，不新增请求面。
  const { data: dauTrend } = useClientDataSWR(['admin-overview-dau-trend'], () =>
    adminCommercialService.getStatsDauTrend(),
  );

  const pendingChangeCount = pendingChanges?.total ?? 0;
  const pendingPackageItems: any[] = (pendingPackages as any)?.items ?? [];
  const pendingPayoutItems: any[] = (pendingPayouts as any)?.items ?? [];
  const recentAuditItems: any[] = (recentAudit as any)?.items ?? [];
  const defaultModel =
    settings?.defaultAgentProvider && settings?.defaultAgentModel
      ? `${settings.defaultAgentProvider}/${settings.defaultAgentModel}`
      : t('admin.overview.systemHealth.notSet', '未设置');
  const dauSparkValues = useMemo(
    () => (Array.isArray(dauTrend) ? dauTrend.map((d: { count: number }) => d.count) : []),
    [dauTrend],
  );
  const overviewAny = overview as any;

  return (
    <AdminPageShell
      title={t('admin.overview.title', '后台工作台')}
      width="full"
      description={t(
        'admin.overview.subtitle',
        '集中查看关键状态，并进入用户、商业化、AI 平台、模块应用和系统运维。',
      )}
    >
      {overviewError ? (
        <AdminPageError
          description={t('admin.overview.loadFailed', '核心指标加载失败，请重试。')}
          onRetry={refreshOverview}
        />
      ) : (
        <AdminMetricStrip
          items={buildOverviewMetrics(overview)}
          label={t('admin.overview.metricsLabel', '关键指标')}
        />
      )}

      <div className={overviewStyles.cardGrid}>
        <AdminSection
          carded
          title={t('admin.overview.pending.title', '待处理事项')}
          actions={
            <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/subscriptions`)}>
              {t('admin.overview.pending.action', '处理请求')}
              <ArrowRight aria-hidden size={adminIconSizes.inline} />
            </Button>
          }
          description={t(
            'admin.overview.pending.description',
            '优先处理会影响用户权益和订阅状态的请求。',
          )}
        >
          <div className={overviewStyles.pending}>
            {pendingChangesError ? (
              <AdminPageError
                description={t('admin.overview.pending.loadFailed', '待处理事项加载失败，请重试。')}
                onRetry={refreshPendingChanges}
              />
            ) : pendingChanges ? (
              <>
                <Tag
                  color={pendingChangeCount > 0 ? 'processing' : 'success'}
                  icon={<GitPullRequest size={adminIconSizes.tag} />}
                >
                  {t('admin.overview.pending.changeRequests', {
                    count: pendingChangeCount,
                    defaultValue: '套餐变更请求 {{count}}',
                  })}
                </Tag>
                <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/orders`)}>
                  {t('admin.overview.pending.viewOrders', '查看相关订单')}
                </Button>
              </>
            ) : (
              <AdminInlineSkeleton rows={2} />
            )}
          </div>
          <WorkbenchTodoCard
            title={t('admin.workbench.pendingPayouts', '收益结算')}
            total={pendingPayoutItems.length}
            viewAllLabel={t('admin.workbench.viewAll', '查看全部')}
            description={t(
              'admin.overview.pending.payoutsDescription',
              '待处理的收益结算单，确认后进入打款流程。',
            )}
            items={pendingPayoutItems.map((item: any) => ({
              hint: item.amount != null ? String(item.amount) : undefined,
              label: item.publisherName ?? item.publisherId ?? item.id,
            }))}
            onViewAll={() => navigate(`${ADMIN_BASE_PATH}/modules`)}
          />
          {(pendingPackagesError || pendingPayoutsError || recentAuditError) && (
            <AdminPageError
              description={t('admin.overview.workbenchLoadFailed', '工作台数据加载失败，请重试。')}
              onRetry={() => {
                refreshPendingPackages();
                refreshPendingPayouts();
                refreshRecentAudit();
              }}
            />
          )}
        </AdminSection>

        <AdminSection
          carded
          description={t('admin.overview.revenue.description', '近 30 天充值实收与平台活跃走势。')}
          title={t('admin.overview.revenue.title', '收入与活跃')}
          actions={
            <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/stats`)}>
              {t('admin.overview.revenue.action', '运营统计')}
              <ArrowRight aria-hidden size={adminIconSizes.inline} />
            </Button>
          }
        >
          <WorkbenchRevenueCard
            loading={overviewLoading}
            revenue={overviewAny?.revenueLast30dUsd}
            sparkValues={dauSparkValues}
          />
        </AdminSection>

        <WorkbenchUsersSection loading={overviewLoading} overview={overviewAny} />

        <WorkbenchModuleAppsSection items={pendingPackageItems} />

        <AdminSection
          carded
          title={t('admin.overview.systemHealth.title', '系统健康')}
          actions={
            <Button size="small" onClick={() => navigate(`${ADMIN_BASE_PATH}/settings`)}>
              <Settings aria-hidden size={adminIconSizes.inline} />
              {t('admin.overview.systemHealth.action', '修改设置')}
            </Button>
          }
          description={t(
            'admin.overview.systemHealth.description',
            '快速核对影响全站体验的核心默认值与我最近的操作。',
          )}
        >
          {settingsError ? (
            <AdminPageError
              description={t(
                'admin.overview.systemHealth.loadFailed',
                '系统状态加载失败，请重试。',
              )}
              onRetry={refreshSettings}
            />
          ) : settings ? (
            <div className={overviewStyles.stack}>
              <div className={overviewStyles.keyValue}>
                <span className={overviewStyles.keyValueLabel}>
                  {t('admin.overview.systemHealth.brandName', '品牌名称')}
                </span>
                <strong className={overviewStyles.keyValueValue}>
                  {settings.brandName || t('admin.overview.systemHealth.notSet', '未设置')}
                </strong>
              </div>
              <div className={overviewStyles.keyValue}>
                <span className={overviewStyles.keyValueLabel}>
                  {t('admin.overview.systemHealth.defaultModel', '默认模型')}
                </span>
                <strong className={overviewStyles.keyValueValue}>{defaultModel}</strong>
              </div>
              <div className={overviewStyles.keyValue}>
                <span className={overviewStyles.keyValueLabel}>
                  {t('admin.overview.systemHealth.referralReward', '推荐奖励')}
                </span>
                <strong className={overviewStyles.keyValueValue}>
                  {formatAdminCredits(settings.referralRewardCredits)}
                </strong>
              </div>
              <WorkbenchTodoCard
                title={t('admin.workbench.recentAuditCard', '我最近的操作')}
                total={recentAuditItems.length}
                viewAllLabel={t('admin.workbench.openAudit', '打开审计记录')}
                description={t(
                  'admin.overview.systemHealth.auditDescription',
                  '按操作者（当前管理员）过滤的最近 10 条审计记录。',
                )}
                items={recentAuditItems.map((item: any) => ({
                  hint: item.createdAt ? new Date(item.createdAt).toLocaleString() : undefined,
                  label: item.action,
                }))}
                onViewAll={() => navigate(`${ADMIN_BASE_PATH}/audit`)}
              />
            </div>
          ) : (
            <AdminInlineSkeleton rows={2} />
          )}
        </AdminSection>
      </div>

      <AdminSection
        carded
        title={t('admin.overview.modules.title', '管理模块')}
        description={t(
          'admin.overview.modules.description',
          '入口按职责域组织；日常操作无需在长菜单中反复定位。',
        )}
      >
        <WorkbenchQuickLinks />
      </AdminSection>
    </AdminPageShell>
  );
});

AdminOverviewPage.displayName = 'AdminOverviewPage';

export default AdminOverviewPage;
