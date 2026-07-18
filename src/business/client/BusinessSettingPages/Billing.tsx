'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Alert, Button, Empty } from 'antd';
import { createStaticStyles } from 'antd-style';
import { Check, X } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshCommercialEntitlementState } from '@/business/client/commercialRefresh';
import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { useClientDataSWR } from '@/libs/swr';
import { commercialService } from '@/services/commercial';
import {
  type SubscriptionChangeRequestItem,
  type SubscriptionChangeRequestStatusType,
} from '@/types/business';

import BusinessSettingsPageShell from './BusinessSettingsPageShell';
import BusinessMobileRecordList from './mobile/BusinessMobileRecordList';
import { BusinessSettingsSection } from './mobile/BusinessMobileSection';
import {
  buildBillingChangeRecord,
  type BusinessRecordFormatters,
} from './mobile/businessRecordBuilders';
import RedemptionPanel from './RedemptionPanel';
import {
  formatBusinessDate,
  formatCurrencyAmount,
  getBillingStatusTranslationKey,
  getSubscriptionCycleTranslationKey,
  subscriptionPageStyles,
  useBusinessSubscriptionProfile,
} from './shared';

const styles = createStaticStyles(({ css, cssVar }) => ({
  mobileSecondary: css`
    display: flex;
    flex-direction: column;
    gap: 6px;

    padding-block-start: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    overflow-wrap: anywhere;
  `,
  mobileSummaryGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 12px;

    > div {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `,
  mobileTouchTarget: css`
    align-self: flex-start;
    min-height: 44px;
  `,
}));

const includedBenefits = [
  '每月算力积分',
  '文件存储',
  '标准模型服务',
  '社区智能体市场',
  '社区插件市场',
];

const excludedBenefits = [
  '全球主流模型自定义 API 服务',
  '无限对话历史',
  '智能网页搜索',
  '专属高级插件',
];

const Billing = memo<{ mobile?: boolean }>(({ mobile }) => {
  const { t } = useTranslation('subscription');
  const { currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const historyRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: pendingChangeRequest } = useClientDataSWR(
    ['business-subscription-change-request'],
    () => commercialService.getPendingSubscriptionChangeRequest(),
  );
  const {
    data: changeRequests = [],
    error: changeRequestsError,
    isLoading: isChangeRequestsLoading,
    mutate: refreshChangeRequests,
  } = useClientDataSWR(['business-subscription-change-history'], () =>
    commercialService.listSubscriptionChangeRequests({ limit: 20 }),
  );
  const hasBillingHistory = changeRequests.length > 0;
  const cycleLabel = t(getSubscriptionCycleTranslationKey(subscriptionSummary?.cycle));
  const nextDate = subscriptionSummary?.renewsAt ?? subscriptionSummary?.endsAt;
  const billingStatusLabel = t(getBillingStatusTranslationKey(subscriptionSummary?.status));
  const recordFormatters = useMemo<Pick<BusinessRecordFormatters, 'formatDate' | 't'>>(
    () => ({
      formatDate: formatBusinessDate,
      t: (key, options) => t(key as any, options as any),
    }),
    [t],
  );

  const handleViewBillingHistory = () => {
    if (mobile) setHistoryOpen(true);
    historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changeRequestColumns = useMemo<TableColumnType<SubscriptionChangeRequestItem>[]>(
    () => [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value: string) => value.slice(0, 8),
        title: '变更编号',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value: SubscriptionChangeRequestStatusType) => t(`billing.changeStatus.${value}`),
        title: '变更状态',
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: '提交时间',
      },
    ],
    [t],
  );

  const pendingChangeAlert = pendingChangeRequest ? (
    <Alert
      showIcon
      message={'存在待处理套餐变更'}
      type={'info'}
      description={`${t('plans.pendingChangeDescription', {
        cycle: t(getSubscriptionCycleTranslationKey(pendingChangeRequest.cycle)),
        from: t(`plans.plan.${pendingChangeRequest.fromPlan}.title`),
        to: t(`plans.plan.${pendingChangeRequest.toPlan}.title`),
      })} · ${formatBusinessDate(pendingChangeRequest.createdAt)}`}
    />
  ) : null;

  const mobileAction = mobile ? { href: '/settings/plans', label: t('upgradePlan') } : undefined;

  return (
    <BusinessSettingsPageShell mobile={mobile} mobileAction={mobileAction} title={'账单'}>
      <BusinessSettingsSection mobile={mobile} title={'订阅摘要'}>
        {mobile ? (
          <Flexbox gap={16}>
            <div className={styles.mobileSummaryGrid}>
              <div>
                <div className={subscriptionPageStyles.caption}>
                  {t('billing.summary.currentCycleAmount')}
                </div>
                <div className={subscriptionPageStyles.tileValue}>
                  {formatCurrencyAmount(
                    subscriptionSummary?.monthlyPrice ?? 0,
                    subscriptionSummary?.currency,
                  )}
                </div>
              </div>
              <div>
                <div className={subscriptionPageStyles.caption}>{t('billing.summary.status')}</div>
                <strong>{billingStatusLabel}</strong>
              </div>
              <div>
                <div className={subscriptionPageStyles.caption}>{t('billing.summary.cycle')}</div>
                <strong>{cycleLabel}</strong>
              </div>
              <div>
                <div className={subscriptionPageStyles.caption}>
                  {t('billing.summary.renewsOrEndsAt')}
                </div>
                <strong>{formatBusinessDate(nextDate)}</strong>
              </div>
            </div>
            <div className={styles.mobileSecondary}>
              <div className={subscriptionPageStyles.caption}>
                {t('billing.summary.subscriptionId', {
                  id: subscriptionSummary?.externalSubscriptionId || '--',
                })}
              </div>
              <div className={subscriptionPageStyles.caption}>
                {t('billing.summary.startedAt', {
                  date: formatBusinessDate(subscriptionSummary?.startedAt),
                })}
              </div>
              <div className={subscriptionPageStyles.caption}>
                {t('billing.summary.amountDisclaimer')}
              </div>
              <Button
                className={styles.mobileTouchTarget}
                type={'link'}
                onClick={handleViewBillingHistory}
              >
                {t('billing.planChangeHistory')}
              </Button>
            </div>
            {pendingChangeAlert}
          </Flexbox>
        ) : (
          <>
            <div className={subscriptionPageStyles.cardGrid}>
              <div>
                <div>当前周期金额（{cycleLabel}）</div>
                <div className={subscriptionPageStyles.tileValue}>
                  {formatCurrencyAmount(
                    subscriptionSummary?.monthlyPrice ?? 0,
                    subscriptionSummary?.currency,
                  )}
                </div>
                <div className={subscriptionPageStyles.caption}>
                  此金额来自当前套餐快照；真实收款、退款与开票仍以管理员后台订单记录为准。
                  <Button size={'small'} type={'link'} onClick={handleViewBillingHistory}>
                    查看变更记录
                  </Button>
                </div>
              </div>
              <div>
                <div>账单信息</div>
                <div className={subscriptionPageStyles.caption}>状态：{billingStatusLabel}</div>
                <div className={subscriptionPageStyles.caption}>
                  订阅 ID：{subscriptionSummary?.externalSubscriptionId || '--'}
                </div>
                <div className={subscriptionPageStyles.caption}>周期：{cycleLabel}</div>
                <div className={subscriptionPageStyles.caption}>
                  开始时间：{formatBusinessDate(subscriptionSummary?.startedAt)}
                </div>
                <div className={subscriptionPageStyles.caption}>
                  续费/结束时间：{formatBusinessDate(nextDate)}
                </div>
                <Button href="/settings/plans" size={'small'} type={'link'}>
                  升级计划
                </Button>
              </div>
            </div>
            {pendingChangeAlert}
          </>
        )}
      </BusinessSettingsSection>
      <BusinessSettingsSection mobile={mobile} title={'当前套餐'}>
        <Flexbox gap={16}>
          <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
            <PlanIcon plan={currentPlan} type={'combine'} />
            {mobile ? null : (
              <Button href="/settings/plans" type={'primary'}>
                升级
              </Button>
            )}
          </Flexbox>
          <div className={subscriptionPageStyles.cardGrid}>
            <div>
              {includedBenefits.map((item) => (
                <div className={subscriptionPageStyles.caption} key={item}>
                  <Icon color={'#16a34a'} icon={Check} size={14} /> {item}
                </div>
              ))}
            </div>
            <div>
              {excludedBenefits.map((item) => (
                <div className={subscriptionPageStyles.caption} key={item}>
                  <Icon color={'#ef4444'} icon={X} size={14} /> {item}
                </div>
              ))}
            </div>
          </div>
        </Flexbox>
      </BusinessSettingsSection>
      <BusinessSettingsSection defaultOpen={false} mobile={mobile} title={'兑换码'}>
        <RedemptionPanel
          onSuccess={() => {
            void refreshCommercialEntitlementState();
          }}
        />
      </BusinessSettingsSection>
      <div ref={historyRef}>
        <BusinessSettingsSection
          defaultOpen={false}
          mobile={mobile}
          open={mobile ? historyOpen : undefined}
          title={'套餐变更记录'}
          onOpenChange={mobile ? setHistoryOpen : undefined}
        >
          {mobile ? (
            <BusinessMobileRecordList
              emptyDescription={t('billing.changeHistory.empty')}
              error={changeRequestsError ? t('mobile.error.title') : undefined}
              isLoading={isChangeRequestsLoading}
              sheetTitle={t('billing.changeHistory.details')}
              records={changeRequests.map((item) =>
                buildBillingChangeRecord(item, recordFormatters),
              )}
              onRetry={() => void refreshChangeRequests()}
            />
          ) : (
            <InlineTable
              columns={changeRequestColumns as any}
              dataSource={changeRequests}
              loading={isChangeRequestsLoading}
              rowKey={(record) => record.id}
              locale={{
                emptyText: (
                  <Empty description={hasBillingHistory ? undefined : '暂无套餐变更记录'} />
                ),
              }}
            />
          )}
        </BusinessSettingsSection>
      </div>
    </BusinessSettingsPageShell>
  );
});

Billing.displayName = 'Billing';
export default Billing;
