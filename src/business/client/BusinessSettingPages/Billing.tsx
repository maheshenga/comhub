'use client';

import { FormGroup } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Alert, Button, Descriptions, Empty } from 'antd';
import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';

import RedemptionPanel from './RedemptionPanel';
import { type SubscriptionChangeRequestItem } from '@/types/business';

import {
  formatBusinessDate,
  getSubscriptionCycleTranslationKey,
  SubscriptionPreviewNotice,
  useBusinessSubscriptionProfile,
} from './shared';

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
        dataIndex: 'fromPlan',
        key: 'fromPlan',
        render: (value) => t(`plans.plan.${value}.title`),
        title: t('billing.planChangeFrom'),
      },
      {
        dataIndex: 'toPlan',
        key: 'toPlan',
        render: (value) => t(`plans.plan.${value}.title`),
        title: t('billing.planChangeTo'),
      },
      {
        dataIndex: 'cycle',
        key: 'cycle',
        render: (value) => t(getSubscriptionCycleTranslationKey(value)),
        title: t('billing.planChangeCycle'),
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => t(`billing.changeStatus.${value}`),
        title: t('billing.planChangeStatus'),
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: t('billing.created'),
      },
    ],
    [t],
  );

  return (
    <>
      <SettingHeader title={t('tab.billing')} />
      <FormGroup collapsible={false} gap={16} title={t('summary.title')} variant={'filled'}>
        <SubscriptionPreviewNotice />
        <Descriptions column={1} size={'small'}>
          <Descriptions.Item label={t('currentPlan.title')}>
            <PlanIcon plan={currentPlan} type={'combine'} />
          </Descriptions.Item>
          <Descriptions.Item label={t('billing.subscriptionId')}>
            {subscriptionSummary?.externalSubscriptionId || '--'}
          </Descriptions.Item>
          <Descriptions.Item label={t('summary.nextPayment')}>
            {formatBusinessDate(subscriptionSummary?.renewsAt || subscriptionSummary?.endsAt)}
          </Descriptions.Item>
        </Descriptions>
        {pendingChangeRequest ? (
          <Alert
            description={`${t('plans.pendingChangeDescription', {
              cycle: t(getSubscriptionCycleTranslationKey(pendingChangeRequest.cycle)),
              from: t(`plans.plan.${pendingChangeRequest.fromPlan}.title`),
              to: t(`plans.plan.${pendingChangeRequest.toPlan}.title`),
            })} · ${formatBusinessDate(pendingChangeRequest.createdAt)}`}
            message={t('plans.pendingChange')}
            showIcon
            type={'info'}
          />
        ) : null}
        <div>{t('summary.desc')}</div>
        <Button disabled={!hasBillingHistory} onClick={handleViewBillingHistory}>
          {t('summary.viewBillingHistory')}
        </Button>
      </FormGroup>
      <FormGroup
        collapsible={false}
        gap={16}
        title={t('billing.redeem.title', 'Redeem Code')}
        variant={'filled'}
      >
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
        <FormGroup
          collapsible={false}
          gap={16}
          title={t('billing.planChangeHistory')}
          variant={'filled'}
        >
          <InlineTable
            columns={changeRequestColumns}
            dataSource={changeRequests}
            locale={{ emptyText: <Empty description={t('billing.empty')} /> }}
            loading={isChangeRequestsLoading}
            rowKey={(record) => record.id}
          />
        </FormGroup>
      </div>
    </>
  );
});

Billing.displayName = 'Billing';
export default Billing;
