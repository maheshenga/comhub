'use client';

import { Flexbox } from '@lobehub/ui';
import { Col, Row, Spin, Statistic } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
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

  const dauValues = useMemo(
    () => (dauTrend ?? []).map((d: { count: number }) => d.count),
    [dauTrend],
  );
  const planBars = useMemo(
    () =>
      (byPlan ?? []).map((d: { count: number; plan: string }) => ({
        label: d.plan,
        value: d.count,
      })),
    [byPlan],
  );
  const revenueStacked = useMemo(
    () =>
      (revenue ?? []).map((r) => ({
        label: r.month.slice(2),
        segments: [
          {
            color: '#1677ff',
            name: 'subscriptionSnapshotAmount',
            value: Number(r.subscriptionSnapshotAmount ?? r.subscription),
          },
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
            <Statistic
              title={t('admin.stats.totalUsers', '总用户')}
              value={overview?.totalUsers ?? 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('admin.stats.dau', '日活用户')} value={overview?.dau ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title={t('admin.stats.mau', '月活用户')} value={overview?.mau ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('admin.stats.activeSubscriptions', '有效订阅')}
              value={overview?.activeSubscriptions ?? 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              prefix="$"
              title={t('admin.stats.revenue', '近 30 天实收充值收入')}
              value={overview?.revenueLast30dUsd ?? 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('admin.stats.subscriptionSnapshotAmount', '近 30 天订阅快照估算')}
              value={overview?.subscriptionSnapshotAmountLast30d ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('admin.stats.dauTrend', '最近 30 天日活趋势')}>
        {dauTrend ? (
          dauValues.length === 0 ? (
            <div style={{ color: '#888' }}>{t('admin.stats.noData', '暂无数据')}</div>
          ) : (
            <Sparkline data={dauValues} height={120} width={720} />
          )
        ) : (
          <Spin />
        )}
      </Card>

      <Card title={t('admin.stats.subsByPlan', '订阅按套餐分布')}>
        {byPlan ? (
          planBars.length === 0 ? (
            <div style={{ color: '#888' }}>{t('admin.stats.noData', '暂无数据')}</div>
          ) : (
            <Flexbox gap={16}>
              <BarChart data={planBars} height={200} width={720} />
              <Flexbox horizontal gap={12} wrap="wrap">
                {planBars.map((b: { label: string; value: number }) => (
                  <Flexbox horizontal align="center" gap={6} key={b.label}>
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

      <Card title={t('admin.stats.revenueByMonth', '最近 6 个月实收收入与订阅快照估算')}>
        {revenue ? (
          revenueStacked.length === 0 ? (
            <div style={{ color: '#888' }}>{t('admin.stats.noData', '暂无数据')}</div>
          ) : (
            <Flexbox gap={16}>
              <StackedBarChart data={revenueStacked} height={240} width={720} />
              <Flexbox horizontal gap={16}>
                <Flexbox horizontal align="center" gap={6}>
                  <span
                    style={{
                      background: '#1677ff',
                      borderRadius: 2,
                      display: 'inline-block',
                      height: 12,
                      width: 12,
                    }}
                  />
                  <span>{t('admin.stats.subscriptionSnapshot', '订阅快照估算')}</span>
                </Flexbox>
                <Flexbox horizontal align="center" gap={6}>
                  <span
                    style={{
                      background: '#faad14',
                      borderRadius: 2,
                      display: 'inline-block',
                      height: 12,
                      width: 12,
                    }}
                  />
                  <span>{t('admin.stats.topup', '充值')}</span>
                </Flexbox>
              </Flexbox>
            </Flexbox>
          )
        ) : (
          <Spin />
        )}
      </Card>

      <Card title={t('admin.stats.redemption.title', '兑换码')}>
        {redemptionStats ? (
          <Row gutter={[16, 16]}>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.active', '可用')}
                value={redemptionStats.pending}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.redeemed', '已兑换')}
                value={redemptionStats.redeemed}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.disabled', '已停用')}
                value={redemptionStats.disabled}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.expired', '已过期')}
                value={redemptionStats.expired}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.last30dRedeemed', '近 30 天兑换')}
                value={redemptionStats.redeemed30d}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title={t('admin.stats.redemption.last30dCredits', '近 30 天发放积分')}
                value={redemptionStats.creditsGranted30d}
              />
            </Col>
            {redemptionStats.byRewardType.length > 0 && (
              <Col span={24}>
                <Flexbox horizontal gap={8} wrap="wrap">
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
