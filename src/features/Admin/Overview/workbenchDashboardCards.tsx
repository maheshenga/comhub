'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import {
  ArrowRight,
  ChartNoAxesColumn,
  CircleDollarSign,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ADMIN_BASE_PATH, getAdminNavGroupsForRole } from '@/features/Admin/adminNavigation';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { Sparkline } from '../charts';
import { adminIconSizes, type AdminMetric, AdminSection } from '../layout';
import { overviewStyles } from './overviewStyles';
import { WorkbenchTodoCard } from './workbenchCards';

const metricIcon = (IconCmp: typeof Users) => (
  <Icon aria-hidden icon={IconCmp} size={adminIconSizes.metric} />
);

/** 指标带条目构造（region 关键指标，label/value 形态与 M5 版本逐字一致）。 */
export const buildOverviewMetrics = (overview?: {
  activeSubscriptions?: number;
  dau?: number;
  revenueLast30dUsd?: number;
  totalUsers?: number;
}): AdminMetric[] => [
  {
    hint: '平台注册账户',
    icon: metricIcon(Users),
    key: 'users',
    label: '总用户',
    value: overview ? overview.totalUsers : '...',
  },
  {
    hint: '最近 24 小时',
    icon: metricIcon(UserRoundCheck),
    key: 'dau',
    label: '日活用户',
    value: overview ? overview.dau : '...',
  },
  {
    hint: '当前有效状态',
    icon: metricIcon(ChartNoAxesColumn),
    key: 'subscriptions',
    label: '有效订阅',
    value: overview ? overview.activeSubscriptions : '...',
  },
  {
    hint: '近 30 天实收充值',
    icon: metricIcon(CircleDollarSign),
    key: 'revenue',
    label: '充值收入',
    value: overview ? `$${overview.revenueLast30dUsd}` : '...',
  },
];

/**
 * Workbench dashboard card shells without error-face contracts (spec §5.2
 * cards ②③④ and the quick-link strip). The todo/system-health cards stay in
 * AdminOverviewPage.tsx because its error faces are locked there by
 * AdminOverviewExperience.test.ts literal assertions.
 */

/** ② 收入卡：大数字 + 30 天活跃 sparkline。 */
export const WorkbenchRevenueCard = memo<{
  loading: boolean;
  revenue?: number;
  sparkValues: number[];
}>(({ loading, revenue, sparkValues }) => (
  <div className={overviewStyles.metricCard}>
    <div className={overviewStyles.metricHero}>
      ${loading || revenue == null ? '...' : revenue}
      <small>近 30 天充值收入</small>
    </div>
    {sparkValues.length > 0 ? (
      <Sparkline data={sparkValues} height={72} width={280} />
    ) : (
      <div className={overviewStyles.chartEmpty}>活跃趋势数据加载中</div>
    )}
  </div>
));

WorkbenchRevenueCard.displayName = 'WorkbenchRevenueCard';

/** ③ 用户卡：totalUsers/dau/mau 三指标。 */
export const WorkbenchUsersCard = memo<{
  dau?: number;
  loading: boolean;
  mau?: number;
  totalUsers?: number;
}>(({ dau, loading, mau, totalUsers }) => (
  <div>
    <div className={overviewStyles.keyValue}>
      <span className={overviewStyles.keyValueLabel}>总用户</span>
      <strong className={overviewStyles.keyValueValue}>
        {loading || totalUsers == null ? '...' : totalUsers}
      </strong>
    </div>
    <div className={overviewStyles.keyValue}>
      <span className={overviewStyles.keyValueLabel}>日活（24h）</span>
      <strong className={overviewStyles.keyValueValue}>
        {loading || dau == null ? '...' : dau}
      </strong>
    </div>
    <div className={overviewStyles.keyValue}>
      <span className={overviewStyles.keyValueLabel}>月活（30d）</span>
      <strong className={overviewStyles.keyValueValue}>
        {loading || mau == null ? '...' : mau}
      </strong>
    </div>
  </div>
));

WorkbenchUsersCard.displayName = 'WorkbenchUsersCard';

/** ④ 模块应用卡：待审包数 + 模块中心入口。 */
export const WorkbenchModuleAppsCard = memo<{
  items: Array<{ hint?: string; label: string; tag?: string; tagColor?: string }>;
  total: number;
}>(({ items, total }) => {
  const { t } = useTranslation('subscription');
  const navigate = useNavigate();

  return (
    <Flexbox gap={12}>
      <WorkbenchTodoCard
        description="模块应用包待人工审核，按提交时间排序处理。"
        items={items}
        title={t('admin.workbench.pendingPackages', '模块应用审核')}
        total={total}
        viewAllLabel={t('admin.workbench.viewAll', '查看全部')}
        onViewAll={() => navigate(`${ADMIN_BASE_PATH}/modules`)}
      />
    </Flexbox>
  );
});

WorkbenchModuleAppsCard.displayName = 'WorkbenchModuleAppsCard';

/** ③ 用户概览分区：AdminSection 壳 + 三指标卡（工作台五卡片网格成员）。 */
export const WorkbenchUsersSection = memo<{
  loading: boolean;
  overview?: { dau?: number; mau?: number; totalUsers?: number };
}>(({ loading, overview }) => {
  const { t } = useTranslation('subscription');

  return (
    <AdminSection
      carded
      description={t('admin.overview.users.description', '平台规模与健康度速览。')}
      title={t('admin.overview.users.title', '用户概览')}
    >
      <WorkbenchUsersCard
        dau={overview?.dau}
        loading={loading}
        mau={overview?.mau}
        totalUsers={overview?.totalUsers}
      />
    </AdminSection>
  );
});

WorkbenchUsersSection.displayName = 'WorkbenchUsersSection';

/** ④ 模块应用分区：待审包数 + 警示标签（工作台五卡片网格成员）。 */
export const WorkbenchModuleAppsSection = memo<{ items: any[] }>(({ items }) => {
  const { t } = useTranslation('subscription');

  return (
    <AdminSection
      carded
      description={t('admin.overview.moduleApps.description', '模块应用平台的审核与结算状态。')}
      title={t('admin.overview.moduleApps.title', '模块应用')}
    >
      <WorkbenchModuleAppsCard
        total={items.length}
        items={items.map((item: any) => ({
          hint: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : undefined,
          label: item.name ?? item.appId ?? item.id,
          tag:
            item.scanStatus === 'flagged'
              ? t('admin.overview.moduleApps.flagged', '警示')
              : undefined,
          tagColor: 'warning',
        }))}
      />
    </AdminSection>
  );
});

WorkbenchModuleAppsSection.displayName = 'WorkbenchModuleAppsSection';

/** 末位快捷入口带：按职责域分组的页面直达（h2 管理模块）。仅展示当前角色可达的分组（M8）。 */
export const WorkbenchQuickLinks = memo(() => {
  const navigate = useNavigate();
  const role = useUserStore(
    (state) => (userProfileSelectors.userProfile(state) as { role?: string } | undefined)?.role,
  );

  return (
    <div className={overviewStyles.groupGrid}>
      {getAdminNavGroupsForRole(role)
        .filter((group) => group.key !== 'workbench')
        .map((group) => (
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
                  <ArrowRight aria-hidden size={adminIconSizes.inline} />
                </button>
              ))}
            </div>
          </article>
        ))}
    </div>
  );
});

WorkbenchQuickLinks.displayName = 'WorkbenchQuickLinks';
