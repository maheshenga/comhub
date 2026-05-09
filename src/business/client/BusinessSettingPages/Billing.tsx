'use client';

import { Flexbox, FormGroup, Icon } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Alert, Button, Card, Empty } from 'antd';
import { Check, X } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import {
  type SubscriptionChangeRequestItem,
  type SubscriptionChangeRequestStatusType,
} from '@/types/business';

import RedemptionPanel from './RedemptionPanel';
import {
  formatBusinessDate,
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

const Billing = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const historyRef = useRef<HTMLDivElement>(null);
  const { data: pendingChangeRequest } = useClientDataSWR(
    ['business-subscription-change-request'],
    () => commercialService.getPendingSubscriptionChangeRequest(),
  );
  const { data: changeRequests = [], isLoading: isChangeRequestsLoading } = useClientDataSWR(
    ['business-subscription-change-history'],
    () => commercialService.listSubscriptionChangeRequests({ limit: 20 }),
  );
  const hasBillingHistory = changeRequests.length > 0;

  const handleViewBillingHistory = () => {
    historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changeRequestColumns = useMemo<TableColumnType<SubscriptionChangeRequestItem>[]>(
    () => [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value: string) => value.slice(0, 8),
        title: '订单编号',
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value: SubscriptionChangeRequestStatusType) => t(`billing.changeStatus.${value}`),
        title: '交易状态',
      },
      {
        dataIndex: 'amount',
        key: 'amount',
        render: (value: number | undefined, record) => {
          const amount = value ?? subscriptionSummary?.monthlyPrice;
          const currency =
            (record as SubscriptionChangeRequestItem & { currency?: string }).currency ||
            subscriptionSummary?.currency;

          return Number.isFinite(amount) ? formatCurrencyAmount(Number(amount), currency) : '--';
        },
        title: '金额',
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: '付款日期',
      },
    ],
    [subscriptionSummary?.currency, subscriptionSummary?.monthlyPrice, t],
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
                  此金额仅包含订阅服务费用。
                  <Button size={'small'} type={'link'} onClick={handleViewBillingHistory}>
                    查看本月使用情况
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
                <Button size={'small'} type={'link'}>
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
                <Button type={'primary'}>升级</Button>
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
        <FormGroup collapsible={false} gap={16} title={'兑换码'} variant={'filled'}>
          <RedemptionPanel
            onSuccess={() => {
              mutate(['business-commercial-overview']);
              mutate(['business-credit-ledger']);
              mutate(['business-subscription-change-history']);
              mutate(['business-subscription-change-request']);
            }}
          />
        </FormGroup>
        <div ref={historyRef}>
          <FormGroup collapsible={false} gap={16} title={'账单历史'} variant={'filled'}>
            <InlineTable
              columns={changeRequestColumns as any}
              dataSource={changeRequests}
              loading={isChangeRequestsLoading}
              rowKey={(record) => record.id}
              locale={{
                emptyText: <Empty description={hasBillingHistory ? undefined : '暂无账单'} />,
              }}
            />
          </FormGroup>
        </div>
      </div>
    </>
  );
});

Billing.displayName = 'Billing';
export default Billing;
