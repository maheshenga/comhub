'use client';

import { Flexbox, FormGroup, Icon, Segmented } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { type TableColumnType } from 'antd';
import { Button, Empty, InputNumber, message, Tag } from 'antd';
import { Pencil, Save, ShoppingCart } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshCommercialEntitlementState } from '@/business/client/commercialRefresh';
import { Card } from '@/components/antd-compat/Card';
import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type CreditLedgerEntryItem, type TopUpOrderHistoryItem } from '@/types/business';

import RedemptionPanel from './RedemptionPanel';
import {
  buildAutoTopUpUpdateParams,
  canSaveAutoTopUpForm,
  createAutoTopUpFormState,
  type AutoTopUpFormState,
} from './creditsDisplay';
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
  const { accountSummary, currentPlan, isPaidPlan, subscriptionSummary } =
    useBusinessSubscriptionProfile();
  const { data: ledgerResult, isLoading: isLedgerLoading } = useClientDataSWR(
    ['business-credit-ledger'],
    () => commercialService.listCreditLedger({ limit: 20 }),
  );
  const {
    data: autoTopUpSetting,
    isLoading: isAutoTopUpLoading,
    mutate: mutateAutoTopUpSetting,
  } = useClientDataSWR(['business-auto-topup-setting'], () =>
    commercialService.getAutoTopUpSetting(),
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
  const [autoTopUpForm, setAutoTopUpForm] = useState<AutoTopUpFormState>(() =>
    createAutoTopUpFormState(null),
  );
  const [isAutoTopUpSaving, setAutoTopUpSaving] = useState(false);

  const selectedPackage =
    topUpPackages.find((item) => item.id === selectedPackageId) || topUpPackages[0];
  const effectiveCredits = selectedPackage?.credits ?? toRawCredits(customCredits);
  const effectiveAmount = selectedPackage?.amount ?? customCredits;
  const effectiveCurrency = selectedPackage?.currency ?? accountSummary?.currency ?? 'USD';
  const accountBreakdown = accountSummary?.breakdown;

  useEffect(() => {
    setAutoTopUpForm(createAutoTopUpFormState(autoTopUpSetting));
  }, [autoTopUpSetting]);

  const updateAutoTopUpForm = useCallback((patch: Partial<AutoTopUpFormState>) => {
    setAutoTopUpForm((previous) => ({ ...previous, ...patch }));
  }, []);

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
    void refreshCommercialEntitlementState();
  };

  const handleSubscribeFirst = () => {
    message.info('当前前端未接入真实支付，管理员可通过后台或兑换码发放套餐与积分。');
  };

  const handleSaveAutoTopUpSetting = async () => {
    if (!canSaveAutoTopUpForm(autoTopUpForm)) {
      message.warning('目标余额必须高于触发阈值');
      return;
    }

    if (autoTopUpForm.enabled && !isPaidPlan) {
      message.warning('自动充值仅支持付费套餐用户');
      return;
    }

    setAutoTopUpSaving(true);
    try {
      await commercialService.updateAutoTopUpSetting(buildAutoTopUpUpdateParams(autoTopUpForm));
      await mutateAutoTopUpSetting();
      message.success('自动充值设置已更新');
    } catch {
      message.error('自动充值设置更新失败');
    } finally {
      setAutoTopUpSaving(false);
    }
  };

  const autoTopUpControlsDisabled = !isPaidPlan || isAutoTopUpLoading || isAutoTopUpSaving;
  const autoTopUpSaveDisabled =
    !isPaidPlan || isAutoTopUpLoading || isAutoTopUpSaving || !canSaveAutoTopUpForm(autoTopUpForm);

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
                购买积分包
              </Button>
            </Flexbox>
          </Card>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'成本估算警报'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <div className={subscriptionPageStyles.cardGrid}>
              <SummaryTile
                caption={'余额低于该值时需要关注消耗速度'}
                title={'触发阈值'}
                value={formatCredits(toRawCredits(autoTopUpForm.thresholdM))}
              />
              <SummaryTile
                caption={'自动充值启用后会补足到该余额'}
                title={'目标余额'}
                value={formatCredits(toRawCredits(autoTopUpForm.targetBalanceM))}
              />
              <SummaryTile
                caption={'避免单月意外超额充值'}
                title={'月度充值上限'}
                value={
                  autoTopUpForm.monthlyLimitM == null
                    ? '不限制'
                    : formatCredits(toRawCredits(autoTopUpForm.monthlyLimitM))
                }
              />
            </div>
          </Card>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'自动充值'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <Flexbox gap={16}>
              <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
                <div>
                  <strong>{isPaidPlan ? '自动充值设置' : '订阅付费计划以启用自动充值'}</strong>
                  <div className={subscriptionPageStyles.caption}>
                    当余额低于触发阈值时，系统会按目标余额补足积分。设置保存后立即对当前用户生效。
                  </div>
                </div>
                <Switch
                  checked={autoTopUpForm.enabled}
                  disabled={autoTopUpControlsDisabled}
                  onChange={(enabled) => updateAutoTopUpForm({ enabled })}
                />
              </Flexbox>
              <div className={subscriptionPageStyles.cardGrid}>
                <Flexbox gap={8}>
                  <span>触发阈值</span>
                  <InputNumber
                    addonAfter={'M'}
                    disabled={autoTopUpControlsDisabled}
                    min={1}
                    value={autoTopUpForm.thresholdM}
                    onChange={(value: number | null) =>
                      updateAutoTopUpForm({ thresholdM: Number(value || 1) })
                    }
                  />
                  <span className={subscriptionPageStyles.caption}>余额低于该值时触发。</span>
                </Flexbox>
                <Flexbox gap={8}>
                  <span>目标余额</span>
                  <InputNumber
                    addonAfter={'M'}
                    disabled={autoTopUpControlsDisabled}
                    min={1}
                    status={canSaveAutoTopUpForm(autoTopUpForm) ? undefined : 'error'}
                    value={autoTopUpForm.targetBalanceM}
                    onChange={(value: number | null) =>
                      updateAutoTopUpForm({ targetBalanceM: Number(value || 1) })
                    }
                  />
                  <span className={subscriptionPageStyles.caption}>必须高于触发阈值。</span>
                </Flexbox>
                <Flexbox gap={8}>
                  <span>月度上限</span>
                  <InputNumber
                    addonAfter={'M'}
                    disabled={autoTopUpControlsDisabled}
                    min={0}
                    placeholder={'不限制'}
                    value={autoTopUpForm.monthlyLimitM}
                    onChange={(value: number | null) =>
                      updateAutoTopUpForm({
                        monthlyLimitM: value == null || Number(value) <= 0 ? null : Number(value),
                      })
                    }
                  />
                  <span className={subscriptionPageStyles.caption}>留空或 0 表示不限制。</span>
                </Flexbox>
              </div>
              <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
                <div className={subscriptionPageStyles.caption}>
                  {!isPaidPlan
                    ? '当前为免费套餐，只能查看默认配置。升级后可开启自动充值。'
                    : '自动充值会复用后台套餐与积分账本规则，实际支付接入后可完成扣款闭环。'}
                </div>
                <Flexbox horizontal gap={8}>
                  {!isPaidPlan ? (
                    <Button href="/settings/plans">升级</Button>
                  ) : null}
                  <Button
                    disabled={autoTopUpSaveDisabled}
                    icon={<Icon icon={Save} />}
                    loading={isAutoTopUpSaving}
                    type={'primary'}
                    onClick={handleSaveAutoTopUpSetting}
                  >
                    保存设置
                  </Button>
                </Flexbox>
              </Flexbox>
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
