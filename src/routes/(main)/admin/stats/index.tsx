'use client';

import { Card, Col, Row, Spin, Statistic } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import { BarChart, Sparkline, StackedBarChart } from '@/features/Admin';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const PLAN_COLORS: Record<string, string> = {
  free: '#999',
  hobby: '#1677ff',
  premium: '#faad14',
  starter: '#13c2c2',
  ultimate: '#722ed1',
};

const AdminStatsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data: overview } = useClientDataSWR(['admin-stats'], () =>
    adminCommercialService.getStatsOverview(),
  );
  const { data: dauTrend } = useClientDataSWR(['admin-stats-dau-trend'], () =>
    adminCommercialService.getStatsDauTrend(),
  );
  const { data: byPlan } = useClientDataSWR(['admin-stats-subs-by-plan'], () =>
    adminCommercialService.getStatsSubscriptionsByPlan(),
  );
  const { data: revenue } = useClientDataSWR(['admin-stats-revenue-month'], () =>
    adminCommercialService.getStatsRevenueByMonth(),
  );
  const { data: redemptionStats } = useClientDataSWR(['admin-stats-redemption'], () =>
    adminCommercialService.getStatsRedemptionOverview(),
  );

  const dauValues = useMemo(() => (dauTrend ?? []).map((d: { count: number }) => d.count), [dauTrend]);
  const planBars = useMemo(
    () => (byPlan ?? []).map((d: { count: number; plan: string }) => ({ label: d.plan, value: d.count })),
    [byPlan],
  );
  const revenueStacked = useMemo(
    () =>
      (revenue ?? []).map((r) => ({
        label: r.month.slice(2),
        segments: [
          { color: '#1677ff', name: 'subscription', value: Number(r.subscription) },
          { color: '#faad14', name: 'topup', value: Number(r.topup) },
        ],
      })),
    [revenue],
  );

  return (
    <Flexbox gap={16} padding={24}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic title={t('admin.stats.totalUsers')} value={overview?.totalUsers ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('admin.stats.dau')} value={overview?.dau ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('admin.stats.mau')} value={overview?.mau ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('admin.stats.activeSubscriptions')}
              value={overview?.activeSubscriptions ?? 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              prefix="$"
              title={t('admin.stats.revenue')}
              value={overview?.revenueLast30dUsd ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('admin.stats.dauTrend', 'Active Users (last 30 days)')}>
        {dauTrend ? (
          dauValues.length === 0 ? (
            <div style={{ color: '#888' }}>{t('admin.stats.noData', 'No data yet')}</div>
          ) : (
            <Sparkline data={dauValues} height={120} width={720} />
          )
        ) : (
          <Spin />
        )}
      </Card>

      <Card title={t('admin.stats.subsByPlan', 'Active Subscriptions by Plan')}>
        {byPlan ? (
          planBars.length === 0 ? (
            <div style={{ color: '#888' }}>{t('admin.stats.noData', 'No data yet')}</div>
          ) : (
            <Flexbox gap={16}>
              <BarChart data={planBars} height={200} width={720} />
              <Flexbox gap={12} horizontal wrap="wrap">
                {planBars.map((b: { label: string; value: number }) => (
                  <Flexbox align="center" gap={6} horizontal key={b.label}>
                    <span
                      style={{
                        background: PLAN_COLORS[b.label] ?? '#888',
                        borderRadius: 4,
                        display: 'inline-block',
                        height: 12,
                        width: 12,
                      }}
                    />
                    <span>
                      {b.label}: <strong>{b.value}</strong>
                    </span>
                  </Flexbox>
                ))}
              </Flexbox>
            </Flexbox>
          )
        ) : (
          <Spin />
        )}
      </Card>

      <Card title={t('admin.stats.revenueByMonth', 'Revenue by Month (last 6 months)')}>
        {revenue ? (
          revenueStacked.length === 0 ? (
            <div style={{ color: '#888' }}>{t('admin.stats.noData', 'No data yet')}</div>
          ) : (
            <Flexbox gap={16}>
              <StackedBarChart data={revenueStacked} height={240} width={720} />
              <Flexbox gap={16} horizontal>
                <Flexbox align="center" gap={6} horizontal>
                  <span
                    style={{
                      background: '#1677ff',
                      borderRadius: 2,
                      display: 'inline-block',
                      height: 12,
                      width: 12,
                    }}
                  />
                  <span>{t('admin.stats.subscription', 'Subscription')}</span>
                </Flexbox>
                <Flexbox align="center" gap={6} horizontal>
                  <span
                    style={{
                      background: '#faad14',
                      borderRadius: 2,
                      display: 'inline-block',
                      height: 12,
                      width: 12,
                    }}
                  />
                  <span>{t('admin.stats.topup', 'Top-up')}</span>
                </Flexbox>
              </Flexbox>
            </Flexbox>
          )
        ) : (
          <Spin />
        )}
      </Card>

      <Card title={t('admin.stats.redemption.title', 'Redemption Codes')}>
        {redemptionStats ? (
          <Row gutter={[16, 16]}>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.active', 'Active')}
                value={redemptionStats.pending}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.redeemed', 'Redeemed')}
                value={redemptionStats.redeemed}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.disabled', 'Disabled')}
                value={redemptionStats.disabled}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.expired', 'Expired')}
                value={redemptionStats.expired}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.last30dRedeemed', 'Redeemed (30d)')}
                value={redemptionStats.redeemed30d}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.last30dCredits', 'Credits Granted (30d)')}
                value={redemptionStats.creditsGranted30d}
              />
            </Col>
            {redemptionStats.byRewardType.length > 0 && (
              <Col span={24}>
                <Flexbox gap={8} horizontal wrap="wrap">
                  {redemptionStats.byRewardType.map((r: { rewardType: string; total: number }) => (
                    <Card key={r.rewardType} size="small">
                      <Statistic title={r.rewardType} value={r.total} />
                    </Card>
                  ))}
                </Flexbox>
              </Col>
            )}
          </Row>
        ) : (
          <Spin />
        )}
      </Card>
    </Flexbox>
  );
});

AdminStatsPage.displayName = 'AdminStatsPage';

export default AdminStatsPage;
