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

import { ADMIN_BASE_PATH, ADMIN_NAV_GROUPS } from '@/features/Admin/adminNavigation';

import { Sparkline } from '../charts';
import type { AdminMetric } from '../layout';
import { overviewStyles } from './overviewStyles';
import { WorkbenchTodoCard } from './workbenchCards';

const metricIcon = (IconCmp: typeof Users) => <Icon aria-hidden icon={IconCmp} size={18} />;

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

/** 末位快捷入口带：按职责域分组的页面直达（h2 管理模块）。 */
export const WorkbenchQuickLinks = memo(() => {
  const navigate = useNavigate();

  return (
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
  );
});

WorkbenchQuickLinks.displayName = 'WorkbenchQuickLinks';
