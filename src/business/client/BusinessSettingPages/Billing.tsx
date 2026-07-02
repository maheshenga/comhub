'use client';

import { Flexbox, FormGroup, Icon } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Alert, Button, Empty } from 'antd';
import { Check, X } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type SubscriptionChangeRequestStatusType, type TopUpOrderStatusType } from '@/types/business';

import { buildBillingHistoryItems, type BillingHistoryItem } from './billingDisplay';
import {
  formatBusinessDate,
  formatCredits,
  formatCurrencyAmount,
  getBillingStatusTranslationKey,
  getSubscriptionCycleTranslationKey,
  subscriptionPageStyles,
  useBusinessSubscriptionProfile,
} from './shared';

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

const topUpStatusLabels: Record<TopUpOrderStatusType, string> = {
  canceled: '已取消',
  expired: '已过期',
  failed: '失败',
  paid: '已支付',
  pending: '待支付',
  refunded: '已退款',
};

const Billing = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const { data: pendingChangeRequest } = useClientDataSWR(
    ['business-subscription-change-request'],
    () => commercialService.getPendingSubscriptionChangeRequest(),
  );
  const { data: changeRequests = [], isLoading: isChangeRequestsLoading } = useClientDataSWR(
    ['business-subscription-change-history'],
    () => commercialService.listSubscriptionChangeRequests({ limit: 20 }),
  );
  const { data: topUpOrders = [], isLoading: isTopUpOrdersLoading } = useClientDataSWR(
    ['business-billing-topup-orders'],
    () => commercialService.listTopUpOrders({ limit: 20 }),
  );

  const billingHistoryItems = useMemo(
    () => buildBillingHistoryItems({ subscriptionChanges: changeRequests, topUpOrders }),
    [changeRequests, topUpOrders],
  );
  const hasBillingHistory = billingHistoryItems.length > 0;
  const isBillingHistoryLoading = isChangeRequestsLoading || isTopUpOrdersLoading;

  const billingHistoryColumns = useMemo<TableColumnType<BillingHistoryItem>[]>(
    () => [
      {
        dataIndex: 'rowKey',
        key: 'rowKey',
        render: (value: string) => value.split(':')[1]?.slice(0, 8) || value.slice(0, 8),
        title: '订单编号',
      },
      {
        dataIndex: 'title',
        key: 'title',
        render: (value, record) => (
          <div>
            <div>{value}</div>
            <div className={subscriptionPageStyles.caption}>
              {record.kind === 'topup' ? '积分包购买' : '套餐变更'}
            </div>
          </div>
        ),
        title: '项目',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value, record) =>
          record.kind === 'topup'
            ? topUpStatusLabels[value as TopUpOrderStatusType]
            : t(`billing.changeStatus.${value as SubscriptionChangeRequestStatusType}`),
        title: '交易状态',
      },
      {
        dataIndex: 'amount',
        key: 'amount',
        render: (value, record) =>
          typeof value === 'number' ? formatCurrencyAmount(value, record.currency) : '--',
        title: '金额',
      },
      {
        dataIndex: 'credits',
        key: 'credits',
        render: (value) => (typeof value === 'number' ? formatCredits(value) : '--'),
        title: '积分',
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: '付款日期',
      },
    ],
    [t],
  );

  return (
    <>
      <SettingHeader title={'账单'} />
      <div className={subscriptionPageStyles.pageStack}>
        <FormGroup collapsible={false} gap={16} title={'账单摘要'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <div className={subscriptionPageStyles.cardGrid}>
              <div>
                <div>您的下次付款</div>
                <div className={subscriptionPageStyles.tileValue}>
                  {formatCurrencyAmount(
                    subscriptionSummary?.monthlyPrice ?? 0,
                    subscriptionSummary?.currency,
                  )}
                </div>
                <div className={subscriptionPageStyles.caption}>
                  此金额包含订阅费用和本期超额存储费用。
                  <Button href="/settings/usage" size={'small'} type={'link'}>
                    查看本月使用情况。
                  </Button>
                </div>
              </div>
              <div>
                <div>账单信息</div>
                <div className={subscriptionPageStyles.caption}>
                  状态：{t(getBillingStatusTranslationKey(subscriptionSummary?.status))}
                </div>
                <div className={subscriptionPageStyles.caption}>
                  订阅 ID：{subscriptionSummary?.externalSubscriptionId || '--'}
                </div>
                <Button href="/settings/plans" size={'small'} type={'link'}>
                  升级计划
                </Button>
              </div>
            </div>
          </Card>
          {pendingChangeRequest ? (
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
          ) : null}
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'当前套餐'} variant={'filled'}>
          <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
            <Flexbox gap={16}>
              <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
                <PlanIcon plan={currentPlan} type={'combine'} />
                <Button href="/settings/plans" type={'primary'}>
                  升级
                </Button>
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
          </Card>
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'账单历史'} variant={'filled'}>
          <InlineTable
            columns={billingHistoryColumns as any}
            dataSource={billingHistoryItems}
            loading={isBillingHistoryLoading}
            rowKey={(record) => record.rowKey}
            locale={{
              emptyText: <Empty description={hasBillingHistory ? undefined : '暂无账单记录'} />,
            }}
          />
        </FormGroup>
      </div>
    </>
  );
});

Billing.displayName = 'Billing';
export default Billing;
