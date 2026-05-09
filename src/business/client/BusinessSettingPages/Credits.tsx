'use client';

import { Flexbox, FormGroup, Icon, Segmented } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Button, Card, Empty, InputNumber, message, Tag } from 'antd';
import { Pencil, ShoppingCart } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type CreditLedgerEntryItem, type TopUpOrderHistoryItem } from '@/types/business';

import RedemptionPanel from './RedemptionPanel';
import {
  formatBusinessDate,
  formatCredits,
  formatCurrencyAmount,
  formatSignedCredits,
  getCreditLedgerTypeTranslationKey,
  getCreditSourceTranslationKey,
  subscriptionPageStyles,
  SummaryTile,
  toRawCredits,
  useBusinessSubscriptionProfile,
} from './shared';

const orderStatusLabels: Record<string, string> = {
  canceled: '已取消',
  expired: '已过期',
  failed: '失败',
  paid: '已支付',
  pending: '待支付',
  refunded: '已退款',
};

const sourceLabels: Record<string, string> = {
  alipay: '支付宝',
  manual: '手动充值',
  redemption: '兑换码',
  wechat_pay: '微信支付',
};

const Credits = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { accountSummary, currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const { data: ledgerResult, isLoading: isLedgerLoading } = useClientDataSWR(
    ['business-credit-ledger'],
    () => commercialService.listCreditLedger({ limit: 20 }),
  );
  const { data: topUpPackages = [] } = useClientDataSWR(['business-topup-packages'], () =>
    commercialService.getTopUpPackages(),
  );
  const { data: topUpOrders = [], isLoading: isOrdersLoading } = useClientDataSWR(
    ['business-topup-orders'],
    () => commercialService.listTopUpOrders({ limit: 20 }),
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>();
  const [customCredits, setCustomCredits] = useState(50);

  const selectedPackage =
    topUpPackages.find((item) => item.id === selectedPackageId) || topUpPackages[0];
  const effectiveCredits = selectedPackage?.credits ?? toRawCredits(customCredits);
  const effectiveAmount = selectedPackage?.amount ?? customCredits;
  const effectiveCurrency = selectedPackage?.currency ?? accountSummary?.currency ?? 'USD';
  const accountBreakdown = accountSummary?.breakdown;

  const packageOptions = useMemo(
    () => [
      ...topUpPackages.map((item) => ({
        label: formatCredits(item.credits),
        value: item.id,
      })),
      { icon: <Icon icon={Pencil} />, label: '自定义', value: 'custom' },
    ],
    [topUpPackages],
  );

  const getLedgerAllocationText = useCallback(
    (record: CreditLedgerEntryItem) => {
      if (record.type !== 'consume') return null;

      const allocations = record.metadata?.allocations;
      if (!Array.isArray(allocations) || allocations.length === 0) return null;

      const normalizedAllocations = allocations.flatMap((item) => {
        if (typeof item !== 'object' || item === null) return [];

        const amount = (item as { amount?: unknown }).amount;
        const source = (item as { source?: unknown }).source;

        if (!Number.isFinite(amount) || typeof source !== 'string') return [];

        return [`${t(getCreditSourceTranslationKey(source))} ${formatCredits(Number(amount))}`];
      });

      if (normalizedAllocations.length === 0) return null;

      return `扣费来源：${normalizedAllocations.join(' · ')}`;
    },
    [t],
  );

  const ledgerColumns = useMemo<TableColumnType<CreditLedgerEntryItem>[]>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: '创建时间',
      },
      {
        dataIndex: 'type',
        key: 'type',
        render: (value) => <Tag>{t(getCreditLedgerTypeTranslationKey(value))}</Tag>,
        title: '类型',
      },
      {
        dataIndex: 'title',
        key: 'title',
        render: (value, record) => value || record.referenceType || '--',
        title: '触发方式',
      },
      {
        dataIndex: 'amount',
        key: 'amount',
        render: (value) => formatSignedCredits(value),
        title: '消耗/增加积分',
      },
      {
        dataIndex: 'balanceAfter',
        key: 'balanceAfter',
        render: (value) => formatCredits(value),
        title: '余额',
      },
      {
        dataIndex: 'description',
        key: 'description',
        render: (value, record) => {
          const allocationText = getLedgerAllocationText(record);
          const description = value || '--';

          if (!allocationText) return description;

          return (
            <div>
              <div>{description}</div>
              <div className={subscriptionPageStyles.caption}>{allocationText}</div>
            </div>
          );
        },
        title: '说明',
      },
    ],
    [getLedgerAllocationText, t],
  );

  const orderColumns = useMemo<TableColumnType<TopUpOrderHistoryItem>[]>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: '购买时间',
      },
      {
        dataIndex: 'credits',
        key: 'credits',
        render: (value) => formatCredits(value),
        title: '积分包',
      },
      {
        dataIndex: 'amount',
        key: 'amount',
        render: (value, record) => formatCurrencyAmount(value, record.currency),
        title: '金额',
      },
      {
        dataIndex: 'source',
        key: 'source',
        render: (value) => sourceLabels[value as string] || value || '--',
        title: '来源',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => <Tag>{orderStatusLabels[value] || value}</Tag>,
        title: '状态',
      },
    ],
    [],
  );

  const refreshCreditData = () => {
    void Promise.all([
      mutate(['business-commercial-overview']),
      mutate(['business-credit-ledger']),
      mutate(['business-topup-orders']),
    ]);
  };

  const handleSubscribeFirst = () => {
    message.info('当前前端未接入真实支付，管理员可通过后台或兑换码发放套餐与积分。');
  };

  return (
    <>
      <SettingHeader title={'积分'} />
      <div className={subscriptionPageStyles.pageStack}>
        <FormGroup collapsible={false} gap={16} title={'余额'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <div className={subscriptionPageStyles.cardGrid}>
              <SummaryTile
                caption={formatBusinessDate(accountSummary?.updatedAt)}
                title={'充值积分余额'}
                value={formatCredits(accountSummary?.balance ?? 0)}
              />
              <SummaryTile
                caption={'优先使用订阅积分，其次使用充值积分'}
                title={'订阅积分'}
                value={`${formatCredits(accountBreakdown?.subscription.available ?? 0)} / ${formatCredits(
                  subscriptionSummary?.monthlyCredits ?? 0,
                )}`}
              />
              <SummaryTile
                caption={'当前订阅状态'}
                title={'LobeChat Cloud Subscription'}
                value={<PlanIcon plan={currentPlan} type={'combine'} />}
              />
            </div>
          </Card>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'购买积分'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <Flexbox gap={16}>
              <div>
                <div style={{ marginBottom: 10 }}>选择积分包</div>
                <Segmented
                  options={packageOptions}
                  value={selectedPackageId || topUpPackages[0]?.id || 'custom'}
                  onChange={(value) => setSelectedPackageId(value as string)}
                />
              </div>
              {selectedPackageId === 'custom' || topUpPackages.length === 0 ? (
                <InputNumber
                  addonAfter={'M'}
                  max={5000}
                  min={50}
                  value={customCredits}
                  onChange={(value) => setCustomCredits(Number(value || 50))}
                />
              ) : null}
              <div className={subscriptionPageStyles.caption}>
                {formatCurrencyAmount(
                  effectiveAmount / Math.max(1, effectiveCredits / toRawCredits(1)),
                  effectiveCurrency,
                )}{' '}
                / 每百万算力积分
                {selectedPackage?.validityMonths
                  ? `（有效期 ${selectedPackage.validityMonths} 个月）`
                  : ''}
              </div>
              <div className={subscriptionPageStyles.metricRow}>
                <span>总计</span>
                <strong style={{ fontSize: 24 }}>
                  {formatCurrencyAmount(effectiveAmount, effectiveCurrency)}
                </strong>
                <span className={subscriptionPageStyles.caption}>
                  {formatCredits(effectiveCredits)}
                </span>
              </div>
              <Button
                icon={<Icon icon={ShoppingCart} />}
                type={'primary'}
                onClick={handleSubscribeFirst}
              >
                请先订阅
              </Button>
            </Flexbox>
          </Card>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'自动充值'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
              <div>
                <strong>订阅付费计划以启用自动充值</strong>
                <div className={subscriptionPageStyles.caption}>确保你的积分不会用光。</div>
              </div>
              <Button onClick={handleSubscribeFirst}>升级</Button>
            </Flexbox>
          </Card>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'兑换码'} variant={'filled'}>
          <RedemptionPanel onSuccess={refreshCreditData} />
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'我的积分包'} variant={'filled'}>
          <InlineTable
            columns={orderColumns as any}
            dataSource={topUpOrders}
            loading={isOrdersLoading}
            locale={{ emptyText: <Empty description={'暂无积分包'} /> }}
            rowKey={(record) => record.id}
          />
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'积分使用详情'} variant={'filled'}>
          <InlineTable
            columns={ledgerColumns as any}
            dataSource={ledgerResult?.items || []}
            loading={isLedgerLoading}
            locale={{ emptyText: <Empty description={'暂无积分明细'} /> }}
            rowKey={(record) => record.id}
          />
        </FormGroup>
      </div>
    </>
  );
});

Credits.displayName = 'Credits';
export default Credits;
