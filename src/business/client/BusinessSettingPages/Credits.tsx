'use client';

import { Flexbox, Icon, Segmented } from '@lobehub/ui';
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
import { commercialService } from '@/services/commercial';
import { type CreditLedgerEntryItem, type TopUpOrderHistoryItem } from '@/types/business';

import BusinessSettingsPageShell from './BusinessSettingsPageShell';
import { formatLedgerAllocationText } from './creditsDisplay';
import { formatCreditLedgerDescription } from './ledgerDisplay';
import BusinessMobileRecordList from './mobile/BusinessMobileRecordList';
import { BusinessSettingsSection } from './mobile/BusinessMobileSection';
import {
  buildCreditLedgerRecord,
  buildTopUpOrderRecord,
  type BusinessRecordFormatters,
} from './mobile/businessRecordBuilders';
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
  mobileControl: css`
    width: 100%;
    min-height: 44px;

    .ant-input-number-input {
      min-height: 42px;
    }
  `,
  mobilePackageScroller: css`
    scrollbar-width: thin;

    overflow-x: auto;
    max-width: 100%;
    padding-block-end: 4px;
    overscroll-behavior-inline: contain;

    .ant-segmented {
      min-width: max-content;
    }

    .ant-segmented-item-label {
      display: flex;
      align-items: center;
      min-height: 44px;
    }
  `,
  mobileTouchTarget: css`
    min-height: 44px;
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

const Credits = memo<{ mobile?: boolean }>(({ mobile }) => {
  const { t } = useTranslation('subscription');
  const brand = useBrand();
  const { accountSummary, currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const {
    data: ledgerResult,
    error: ledgerError,
    isLoading: isLedgerLoading,
    mutate: refreshLedger,
  } = useClientDataSWR(['business-credit-ledger'], () =>
    commercialService.listCreditLedger({ limit: 20 }),
  );
  const { data: topUpPackages = [] } = useClientDataSWR(['business-topup-packages'], () =>
    commercialService.getTopUpPackages(),
  );
  const {
    data: topUpOrders = [],
    error: ordersError,
    isLoading: isOrdersLoading,
    mutate: refreshOrders,
  } = useClientDataSWR(['business-topup-orders'], () =>
    commercialService.listTopUpOrders({ limit: 20 }),
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>();
  const [customCredits, setCustomCredits] = useState(50);
  const [redemptionOpen, setRedemptionOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

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
    (record: CreditLedgerEntryItem) =>
      formatLedgerAllocationText(
        record,
        (source) => t(getCreditSourceTranslationKey(source)),
        formatCredits,
      ),
    [t],
  );

  const recordFormatters = useMemo<
    Pick<
      BusinessRecordFormatters,
      | 'creditLedgerAllocation'
      | 'creditLedgerDescription'
      | 'formatCredits'
      | 'formatCurrency'
      | 'formatDate'
      | 'formatSignedCredits'
      | 't'
    >
  >(
    () => ({
      creditLedgerAllocation: (item) => getLedgerAllocationText(item) ?? undefined,
      creditLedgerDescription: (item) =>
        formatCreditLedgerDescription(item.description, item.metadata),
      formatCredits,
      formatCurrency: (value, currency) => formatCurrencyAmount(value, currency ?? undefined),
      formatDate: formatBusinessDate,
      formatSignedCredits,
      t: (key, options) => t(key as any, options as any),
    }),
    [getLedgerAllocationText, t],
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
    void refreshLedger();
    void refreshOrders();
  };

  const handleTopUpAction = () => {
    if (!canPurchaseTopUp) {
      message.info('积分充值仅对付费套餐开放，请先升级会员套餐。');
      return;
    }

    message.info('在线支付暂未接入，请联系管理员充值，或使用兑换码发放积分。');
  };

  const mobileAction = mobile
    ? canPurchaseTopUp
      ? {
          href: '#credit-redemption',
          label: t('billing.redeem.title'),
          onClick: () => setRedemptionOpen(true),
        }
      : { href: '/settings/plans', label: t('upgradePlan') }
    : undefined;

  return (
    <BusinessSettingsPageShell mobile={mobile} mobileAction={mobileAction} title={'积分'}>
      <BusinessSettingsSection mobile={mobile} title={'余额'}>
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
              <Button
                className={mobile ? styles.mobileTouchTarget : undefined}
                href="#credit-ledger"
                size={mobile ? 'middle' : 'small'}
                onClick={mobile ? () => setLedgerOpen(true) : undefined}
              >
                查看使用情况
              </Button>
              <Button
                className={mobile ? styles.mobileTouchTarget : undefined}
                href="#topup-orders"
                size={mobile ? 'middle' : 'small'}
                onClick={mobile ? () => setOrdersOpen(true) : undefined}
              >
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
      </BusinessSettingsSection>
      <BusinessSettingsSection mobile={mobile} title={'购买积分'}>
        <Flexbox gap={16}>
          <div className={mobile ? styles.mobilePackageScroller : undefined}>
            <div style={{ marginBottom: 10 }}>选择积分包</div>
            <Segmented
              options={packageOptions}
              value={selectedPackageId || topUpPackages[0]?.id || 'custom'}
              onChange={(value: string | number) => setSelectedPackageId(value as string)}
            />
          </div>
          {selectedPackageId === 'custom' || topUpPackages.length === 0 ? (
            <InputNumber
              className={mobile ? styles.mobileControl : undefined}
              max={5000}
              min={50}
              suffix={'M'}
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
          {mobile ? (
            <div className={subscriptionPageStyles.caption}>
              在线支付暂未接入；当前可联系管理员或使用兑换码补充积分。
            </div>
          ) : null}
          <div className={subscriptionPageStyles.metricRow}>
            <span>总计</span>
            <strong style={{ fontSize: 24 }}>
              {formatCurrencyAmount(effectiveAmount, effectiveCurrency)}
            </strong>
            <span className={subscriptionPageStyles.caption}>
              {formatCredits(effectiveCredits)}
            </span>
          </div>
          {mobile ? null : (
            <Button
              href={canPurchaseTopUp ? undefined : '/settings/plans'}
              icon={<Icon icon={ShoppingCart} />}
              type={'primary'}
              onClick={canPurchaseTopUp ? handleTopUpAction : undefined}
            >
              {canPurchaseTopUp ? '联系管理员充值' : '升级会员'}
            </Button>
          )}
        </Flexbox>
      </BusinessSettingsSection>
      <BusinessSettingsSection defaultOpen={false} mobile={mobile} title={'自动充值'}>
        <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
          <div>
            <strong>在线支付暂未接入</strong>
            <div className={subscriptionPageStyles.caption}>
              自动充值将在支付网关接入后开放；当前可联系管理员或使用兑换码补充积分。
            </div>
          </div>
          {mobile ? null : (
            <Button
              href={canPurchaseTopUp ? undefined : '/settings/plans'}
              onClick={canPurchaseTopUp ? handleTopUpAction : undefined}
            >
              {canPurchaseTopUp ? '联系管理员' : '升级会员'}
            </Button>
          )}
        </Flexbox>
      </BusinessSettingsSection>
      <div id="credit-redemption">
        <BusinessSettingsSection
          defaultOpen={false}
          mobile={mobile}
          open={mobile ? redemptionOpen : undefined}
          title={'兑换码'}
          onOpenChange={mobile ? setRedemptionOpen : undefined}
        >
          <RedemptionPanel onSuccess={refreshCreditData} />
        </BusinessSettingsSection>
      </div>
      <div id="topup-orders">
        <BusinessSettingsSection
          defaultOpen={false}
          mobile={mobile}
          open={mobile ? ordersOpen : undefined}
          title={'我的积分包'}
          onOpenChange={mobile ? setOrdersOpen : undefined}
        >
          {mobile ? (
            <BusinessMobileRecordList
              emptyDescription={t('credits.topUp.orders.empty')}
              error={ordersError ? t('mobile.error.title') : undefined}
              isLoading={isOrdersLoading}
              records={topUpOrders.map((item) => buildTopUpOrderRecord(item, recordFormatters))}
              sheetTitle={t('credits.topUp.orders.details')}
              onRetry={() => void refreshOrders()}
            />
          ) : (
            <InlineTable
              columns={orderColumns as any}
              dataSource={topUpOrders}
              loading={isOrdersLoading}
              locale={{ emptyText: <Empty description={'暂无积分包'} /> }}
              rowKey={(record) => record.id}
            />
          )}
        </BusinessSettingsSection>
      </div>
      <div id="credit-ledger">
        <BusinessSettingsSection
          defaultOpen={false}
          mobile={mobile}
          open={mobile ? ledgerOpen : undefined}
          title={'积分使用详情'}
          onOpenChange={mobile ? setLedgerOpen : undefined}
        >
          {mobile ? (
            <BusinessMobileRecordList
              emptyDescription={t('credits.ledger.empty')}
              error={ledgerError ? t('mobile.error.title') : undefined}
              isLoading={isLedgerLoading}
              sheetTitle={t('credits.ledger.details')}
              records={(ledgerResult?.items || []).map((item) =>
                buildCreditLedgerRecord(item, recordFormatters),
              )}
              onRetry={() => void refreshLedger()}
            />
          ) : (
            <InlineTable
              columns={ledgerColumns as any}
              dataSource={ledgerResult?.items || []}
              loading={isLedgerLoading}
              locale={{ emptyText: <Empty description={'暂无积分明细'} /> }}
              rowKey={(record) => record.id}
            />
          )}
        </BusinessSettingsSection>
      </div>
    </BusinessSettingsPageShell>
  );
});

Credits.displayName = 'Credits';
export default Credits;
