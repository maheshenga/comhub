'use client';

import { Flexbox, FormGroup, Icon, Segmented } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Button, Empty, InputNumber, message, Tag } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { Pencil, ShoppingCart } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshCommercialEntitlementState } from '@/business/client/commercialRefresh';
import InlineTable from '@/components/InlineTable';
import { normalizeTopUpPackagePromotion } from '@/const/billingPresentation';
import { useBrand } from '@/features/Brand/BrandProvider';
import PlanIcon from '@/features/PlanIcon';
import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type CreditLedgerEntryItem, type TopUpOrderHistoryItem } from '@/types/business';

import { formatCreditLedgerDescription } from './ledgerDisplay';
import RedemptionPanel from './RedemptionPanel';
import {
  formatBusinessDate,
  formatCredits,
  formatCurrencyAmount,
  formatSignedCredits,
  getCreditLedgerTypeTranslationKey,
  getCreditSourceTranslationKey,
  isPaidPlan,
  subscriptionPageStyles,
  toRawCredits,
  useBusinessSubscriptionProfile,
} from './shared';

const styles = createStaticStyles(({ css }) => ({
  balanceGrid: css`
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(220px, 0.8fr);
    gap: 12px;

    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  `,
  balancePanel: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
  balanceStats: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (width <= 560px) {
      grid-template-columns: 1fr;
    }
  `,
  bigValue: css`
    margin-block-start: 4px;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.25;
    color: ${cssVar.colorText};
  `,
  purchaseMeta: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    color: ${cssVar.colorTextDescription};
  `,
  subscriptionBox: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
}));

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
  const brand = useBrand();
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
    selectedPackageId === 'custom'
      ? undefined
      : topUpPackages.find((item) => item.id === selectedPackageId) || topUpPackages[0];
  const effectiveCredits = selectedPackage?.credits ?? toRawCredits(customCredits);
  const effectiveAmount = selectedPackage?.amount ?? customCredits;
  const effectiveCurrency = selectedPackage?.currency ?? accountSummary?.currency ?? 'USD';
  const accountBreakdown = accountSummary?.breakdown;
  const selectedPromotion = normalizeTopUpPackagePromotion(selectedPackage?.metadata);
  const canPurchaseTopUp = isPaidPlan(currentPlan);

  const packageOptions = useMemo(
    () => [
      ...topUpPackages.map((item) => ({
        label: item.displayName || formatCredits(item.credits),
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
          const description = formatCreditLedgerDescription(value, record.metadata);

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
    void refreshCommercialEntitlementState();
  };

  const handleTopUpAction = () => {
    if (!canPurchaseTopUp) {
      message.info('积分充值仅对付费套餐开放，请先升级会员套餐。');
      return;
    }

    message.info('在线支付暂未接入，请联系管理员充值，或使用兑换码发放积分。');
  };

  return (
    <>
      <SettingHeader title={'积分'} />
      <div className={subscriptionPageStyles.pageStack}>
        <FormGroup collapsible={false} gap={16} title={'余额'} variant={'filled'}>
          <div className={styles.balanceGrid}>
            <div className={styles.balancePanel}>
              <div className={styles.balanceStats}>
                <div>
                  <div className={subscriptionPageStyles.caption}>可用积分余额</div>
                  <div className={styles.bigValue}>{formatCredits(accountSummary?.balance ?? 0)}</div>
                </div>
                <div>
                  <div className={subscriptionPageStyles.caption}>订阅积分</div>
                  <div className={styles.bigValue}>
                    {formatCredits(accountBreakdown?.subscription?.available ?? 0)} /{' '}
                    {formatCredits(subscriptionSummary?.monthlyCredits ?? 0)}
                  </div>
                </div>
              </div>
              <div className={subscriptionPageStyles.caption}>
                优先使用订阅积分，其次使用充值积分。更新时间：
                {formatBusinessDate(accountSummary?.updatedAt)}
              </div>
              <Flexbox horizontal gap={8} wrap="wrap">
                <Button href="#credit-ledger" size="small">
                  查看使用情况
                </Button>
                <Button href="#topup-orders" size="small">
                  充值记录
                </Button>
              </Flexbox>
            </div>
            <div className={styles.subscriptionBox}>
              <div className={subscriptionPageStyles.caption}>{brand.name} Subscription</div>
              <PlanIcon plan={currentPlan} type={'combine'} />
              <div className={subscriptionPageStyles.caption}>
                每月订阅积分 {formatCredits(subscriptionSummary?.monthlyCredits ?? 0)}
              </div>
            </div>
          </div>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'购买积分'} variant={'filled'}>
          <Flexbox gap={16}>
            <div>
              <div style={{ marginBottom: 10 }}>选择积分包</div>
              <Segmented
                options={packageOptions}
                value={selectedPackageId || topUpPackages[0]?.id || 'custom'}
                onChange={(value: string | number) => setSelectedPackageId(value as string)}
              />
            </div>
            {selectedPackageId === 'custom' || topUpPackages.length === 0 ? (
              <InputNumber
                addonAfter={'M'}
                max={5000}
                min={50}
                value={customCredits}
                onChange={(value: number | null) => setCustomCredits(Number(value || 50))}
              />
            ) : null}
            <div className={styles.purchaseMeta}>
              {selectedPromotion.enabled ? (
                <Flexbox horizontal align="center" gap={6} wrap="wrap">
                  <Tag color="red" style={{ margin: 0 }}>
                    {selectedPromotion.label || '限时优惠'}
                  </Tag>
                  {typeof selectedPromotion.originalAmount === 'number' ? (
                    <span style={{ textDecoration: 'line-through' }}>
                      原价 {formatCurrencyAmount(selectedPromotion.originalAmount, effectiveCurrency)}
                    </span>
                  ) : null}
                  {selectedPromotion.note ? <span>{selectedPromotion.note}</span> : null}
                </Flexbox>
              ) : null}
              <div>
                {formatCurrencyAmount(
                  effectiveAmount / Math.max(1, effectiveCredits / toRawCredits(1)),
                  effectiveCurrency,
                )}{' '}
                / 每百万算力积分
                {selectedPackage?.validityMonths
                  ? `（有效期 ${selectedPackage.validityMonths} 个月）`
                  : ''}
              </div>
            </div>
            <div className={subscriptionPageStyles.metricRow}>
              <span>总计</span>
              <strong style={{ fontSize: 24 }}>
                {formatCurrencyAmount(effectiveAmount, effectiveCurrency)}
              </strong>
              <span className={subscriptionPageStyles.caption}>{formatCredits(effectiveCredits)}</span>
            </div>
            <Button
              href={canPurchaseTopUp ? undefined : '/settings/plans'}
              icon={<Icon icon={ShoppingCart} />}
              type={'primary'}
              onClick={canPurchaseTopUp ? handleTopUpAction : undefined}
            >
              {canPurchaseTopUp ? '联系管理员充值' : '升级会员'}
            </Button>
          </Flexbox>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'自动充值'} variant={'filled'}>
          <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
            <div>
              <strong>在线支付暂未接入</strong>
              <div className={subscriptionPageStyles.caption}>
                自动充值将在支付网关接入后开放；当前可联系管理员或使用兑换码补充积分。
              </div>
            </div>
            <Button
              href={canPurchaseTopUp ? undefined : '/settings/plans'}
              onClick={canPurchaseTopUp ? handleTopUpAction : undefined}
            >
              {canPurchaseTopUp ? '联系管理员' : '升级会员'}
            </Button>
          </Flexbox>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'兑换码'} variant={'filled'}>
          <RedemptionPanel onSuccess={refreshCreditData} />
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'我的积分包'} variant={'filled'}>
          <InlineTable
            columns={orderColumns as any}
            dataSource={topUpOrders}
            id="topup-orders"
            loading={isOrdersLoading}
            locale={{ emptyText: <Empty description={'暂无积分包'} /> }}
            rowKey={(record) => record.id}
          />
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'积分使用详情'} variant={'filled'}>
          <InlineTable
            columns={ledgerColumns as any}
            dataSource={ledgerResult?.items || []}
            id="credit-ledger"
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
