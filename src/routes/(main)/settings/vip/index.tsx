'use client';

import { Button, Flexbox, Input } from '@lobehub/ui';
import {
  Alert,
  App,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Progress,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { GiftIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

interface SubscriptionInfo {
  expiresAt: Date | null;
  plan?: { name: string } | null;
  planId: string;
  status: string;
}

interface CreditsInfo {
  balance: number;
  totalConsumed: number;
  totalEarned: number;
}

interface TransactionRow {
  amount: number;
  createdAt: Date;
  description: string | null;
  id: string;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  type: string;
}

interface PlanRow {
  creditsPerMonth: number;
  description: string | null;
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
}

const TX_TYPE_COLORS: Record<string, string> = {
  admin_adjust: 'purple',
  redeem: 'green',
  referral: 'cyan',
  subscription_grant: 'blue',
  usage_deduct: 'orange',
};

const VipSettings = memo(() => {
  const { t } = useTranslation('setting');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<Array<{ date: string; total: number; count: number }>>([]);
  const [modelBreakdown, setModelBreakdown] = useState<Array<{ model: string | null; total: number; count: number }>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subData, creditsData, txData, plansData, dailyData, modelData] = await Promise.all([
        lambdaClient.vip.getMySubscription.query().catch(() => null),
        lambdaClient.vip.getMyCredits.query().catch(() => null),
        lambdaClient.vip.getMyTransactions.query().catch(() => []),
        lambdaClient.vip.getPlans.query().catch(() => []),
        lambdaClient.vip.getMyDailyUsage.query().catch(() => []),
        lambdaClient.vip.getMyModelBreakdown.query().catch(() => []),
      ]);
      setSubscription(subData as SubscriptionInfo | null);
      setCredits(creditsData as CreditsInfo | null);
      setTransactions(txData as TransactionRow[]);
      setPlans(plansData as PlanRow[]);
      setDailyUsage(dailyData as any[]);
      setModelBreakdown(modelData as any[]);
    } catch {
      // silently fail, individual sections handle their own empty states
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      await lambdaClient.vip.redeem.mutate({ code: redeemCode.trim() });
      message.success(t('vip.redeem.success'));
      setRedeemCode('');
      fetchData();
    } catch (err: any) {
      const errorMsg = err?.message || '';
      const knownErrors = [
        'REDEEM_CODE_NOT_FOUND',
        'REDEEM_CODE_EXPIRED',
        'REDEEM_CODE_MAX_USES_REACHED',
        'REDEEM_CODE_ALREADY_USED',
      ];
      const matchedError = knownErrors.find((e) => errorMsg.includes(e));
      if (matchedError) {
        message.error(t(`vip.redeem.error.${matchedError}` as any));
      } else {
        message.error(t('vip.redeem.error.default'));
      }
    } finally {
      setRedeeming(false);
    }
  };

  const daysUntilExpiry = useMemo(() => {
    if (!subscription?.expiresAt || subscription.status !== 'active') return null;
    const diff = new Date(subscription.expiresAt).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
  }, [subscription]);

  const txColumns = [
    {
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={TX_TYPE_COLORS[type] || 'default'}>
          {t(`vip.transactions.type.${type}` as any) || type}
        </Tag>
      ),
      title: t('vip.transactions.type'),
      width: 150,
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {v > 0 ? `+${v}` : v}
        </span>
      ),
      title: t('vip.transactions.amount'),
      width: 100,
    },
    {
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      title: t('vip.transactions.description'),
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: Date) => new Date(v).toLocaleString(),
      title: t('vip.transactions.date'),
      width: 180,
    },
  ];

  return (
    <>
      <SettingHeader title={t('vip.title')} />
      <Spin spinning={loading}>
        <div style={{ maxWidth: 800, paddingBlockStart: 24 }}>
          {/* Subscription Status */}
          <Typography.Title level={5}>{t('vip.subscription.title')}</Typography.Title>
          {subscription ? (
            <>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label={t('vip.subscription.plan')}>
                  {(subscription as any).plan?.name || subscription.planId}
                </Descriptions.Item>
                <Descriptions.Item label={t('vip.subscription.status')}>
                  <Tag color={subscription.status === 'active' ? 'green' : 'red'}>
                    {subscription.status === 'active'
                      ? t('vip.subscription.active')
                      : t('vip.subscription.expired')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('vip.subscription.expiresAt')} span={2}>
                  {subscription.expiresAt
                    ? new Date(subscription.expiresAt).toLocaleDateString()
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
              {daysUntilExpiry !== null && daysUntilExpiry <= 0 && (
                <Alert
                  message={t('vip.subscription.expiredWarning')}
                  showIcon
                  style={{ marginBlockStart: 12 }}
                  type="error"
                />
              )}
              {daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 1 && (
                <Alert
                  message={t('vip.subscription.expiringTomorrow')}
                  showIcon
                  style={{ marginBlockStart: 12 }}
                  type="error"
                />
              )}
              {daysUntilExpiry !== null && daysUntilExpiry > 1 && daysUntilExpiry <= 3 && (
                <Alert
                  message={t('vip.subscription.expiringSoon', { days: daysUntilExpiry })}
                  showIcon
                  style={{ marginBlockStart: 12 }}
                  type="warning"
                />
              )}
              {daysUntilExpiry !== null && daysUntilExpiry > 3 && daysUntilExpiry <= 7 && (
                <Alert
                  message={t('vip.subscription.expiringWeek', { days: daysUntilExpiry })}
                  showIcon
                  style={{ marginBlockStart: 12 }}
                  type="info"
                />
              )}
            </>
          ) : (
            <Typography.Text type="secondary">
              {t('vip.subscription.none')}
            </Typography.Text>
          )}

          <Divider />

          {/* Credits */}
          <Typography.Title level={5}>{t('vip.credits.title')}</Typography.Title>
          {credits && (
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title={t('vip.credits.balance')} value={credits.balance} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title={t('vip.credits.totalEarned')}
                    value={credits.totalEarned}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title={t('vip.credits.totalConsumed')}
                    value={credits.totalConsumed}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Divider />

          {/* Redeem Code */}
          <Typography.Title level={5}>{t('vip.redeem.title')}</Typography.Title>
          <Flexbox align={'center'} gap={8} horizontal style={{ maxWidth: 400 }}>
            <Input
              onChange={(e) => setRedeemCode(e.target.value)}
              onPressEnter={handleRedeem}
              placeholder={t('vip.redeem.placeholder')}
              value={redeemCode}
            />
            <Button
              icon={GiftIcon}
              loading={redeeming}
              onClick={handleRedeem}
              type={'primary'}
            >
              {t('vip.redeem.submit')}
            </Button>
          </Flexbox>

          <Divider />

          {/* Available Plans */}
          {plans.length > 0 && (
            <>
              <Typography.Title level={5}>{t('vip.plans.title')}</Typography.Title>
              <Row gutter={16}>
                {plans.map((plan) => (
                  <Col key={plan.id} span={8}>
                    <Card size="small" title={plan.name}>
                      <Typography.Paragraph type="secondary">
                        {plan.description || '-'}
                      </Typography.Paragraph>
                      <Typography.Text>
                        {t('vip.plans.creditsPerMonth', { count: plan.creditsPerMonth })}
                      </Typography.Text>
                    </Card>
                  </Col>
                ))}
              </Row>
              <Divider />
            </>
          )}

          {/* Usage Statistics (U3) */}
          {(dailyUsage.length > 0 || modelBreakdown.length > 0) && (
            <>
              <Typography.Title level={5}>{t('vip.usage.title')}</Typography.Title>
              {dailyUsage.length > 0 && (
                <>
                  <Typography.Text type="secondary">{t('vip.usage.dailyTitle')}</Typography.Text>
                  <Table
                    columns={[
                      { dataIndex: 'date', key: 'date', title: t('vip.usage.date'), width: 120 },
                      { dataIndex: 'total', key: 'total', title: t('vip.usage.credits'), width: 100,
                        render: (v: number) => <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{v.toLocaleString()}</span>,
                      },
                      { dataIndex: 'count', key: 'count', title: t('vip.usage.requests'), width: 100 },
                    ]}
                    dataSource={dailyUsage}
                    pagination={false}
                    rowKey="date"
                    size="small"
                    style={{ marginBlock: 12 }}
                  />
                </>
              )}
              {modelBreakdown.length > 0 && (
                <>
                  <Typography.Text type="secondary">{t('vip.usage.modelTitle')}</Typography.Text>
                  <div style={{ marginBlock: 12 }}>
                    {(() => {
                      const maxVal = Math.max(...modelBreakdown.map((m) => m.total), 1);
                      const totalAll = modelBreakdown.reduce((sum, m) => sum + m.total, 0);
                      return modelBreakdown.map((item) => (
                        <Flexbox key={item.model || 'unknown'} gap={4} style={{ marginBottom: 8 }}>
                          <Flexbox horizontal align={'center'} justify={'space-between'}>
                            <Typography.Text>{item.model || 'unknown'}</Typography.Text>
                            <Typography.Text type="secondary">
                              {item.total.toLocaleString()} ({totalAll > 0 ? Math.round((item.total / totalAll) * 100) : 0}%)
                            </Typography.Text>
                          </Flexbox>
                          <Progress
                            percent={Math.round((item.total / maxVal) * 100)}
                            showInfo={false}
                            size="small"
                            strokeColor="#ff4d4f"
                          />
                        </Flexbox>
                      ));
                    })()}
                  </div>
                </>
              )}
              <Divider />
            </>
          )}

          {/* Transaction History */}
          <Typography.Title level={5}>{t('vip.transactions.title')}</Typography.Title>
          {transactions.length > 0 ? (
            <Table
              columns={txColumns}
              dataSource={transactions}
              pagination={{ pageSize: 20 }}
              rowKey="id"
              size="small"
            />
          ) : (
            <Empty description={t('vip.transactions.empty')} />
          )}
        </div>
      </Spin>
    </>
  );
});

export default VipSettings;
