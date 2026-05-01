'use client';

import { Plans as SubscriptionPlan } from '@lobechat/types';
import { FormGroup } from '@lobehub/ui';
import { Alert, Card, Tag } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import PlanIcon from '@/features/PlanIcon';
import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';

import {
  formatBusinessDate,
  formatCredits,
  formatCurrencyAmount,
  getSubscriptionCycleTranslationKey,
  subscriptionPageStyles,
  subscriptionPlanOrder,
  SummaryTile,
  useBusinessSubscriptionProfile,
} from './shared';

const PLAN_FEATURES_FALLBACK: Record<SubscriptionPlan, string[]> = {
  [SubscriptionPlan.Free]: [
    'plans.cloud.title',
    'plans.knowledgeBase.title',
    'plans.storage.title',
  ],
  [SubscriptionPlan.Hobby]: ['plans.credit.api', 'plans.llm.title', 'plans.support.hobby'],
  [SubscriptionPlan.Starter]: [
    'plans.credit.title',
    'plans.features.title',
    'plans.support.starter',
  ],
  [SubscriptionPlan.Premium]: [
    'plans.credit.title',
    'plans.features.plugins',
    'plans.support.premium',
  ],
  [SubscriptionPlan.Ultimate]: [
    'plans.credit.title',
    'plans.features.showAll',
    'plans.support.ultimate',
  ],
};

const Plans = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const { data: pendingChangeRequest } = useClientDataSWR(
    ['business-subscription-change-request'],
    () => commercialService.getPendingSubscriptionChangeRequest(),
  );
  const { data: planCatalog = [] } = useClientDataSWR(
    ['business-plan-catalog'],
    () => commercialService.listPlanCatalog(),
  );
  const planCatalogMap = useMemo(() => {
    const map = new Map<string, (typeof planCatalog)[number]>();
    for (const p of planCatalog) map.set(p.plan, p);
    return map;
  }, [planCatalog]);
  const visiblePlans = useMemo(() => {
    const catalogPlans = planCatalog
      .map((item) => item.plan)
      .filter((plan): plan is SubscriptionPlan =>
        subscriptionPlanOrder.includes(plan as SubscriptionPlan),
      );

    return Array.from(
      new Set([
        ...(subscriptionPlanOrder.includes(currentPlan) ? [currentPlan] : []),
        ...catalogPlans,
      ]),
    );
  }, [currentPlan, planCatalog]);
  const getPlanFeatures = (plan: SubscriptionPlan): string[] => {
    const dbFeatures = planCatalogMap.get(plan)?.features;
    if (dbFeatures && dbFeatures.length > 0) return dbFeatures;
    return PLAN_FEATURES_FALLBACK[plan];
  };

  return (
    <>
      <SettingHeader title={t('tab.plans')} />
      <Alert
        description={t('billing.purchaseDisabledHint')}
        message={t('billing.redeem.title')}
        showIcon
        type={'info'}
      />
      <FormGroup collapsible={false} gap={16} title={t('currentPlan.title')} variant={'filled'}>
        <Card size={'small'}>
          <div className={subscriptionPageStyles.cardGrid}>
            <SummaryTile
              caption={t('currentPlan.seeAllFeaturesAndComparePlans')}
              title={t('currentPlan.title')}
              value={<PlanIcon plan={currentPlan} type={'combine'} />}
            />
            <SummaryTile
              caption={t('billing.redeem.title')}
              title={t('plans.features.title')}
              value={t(`plans.plan.${currentPlan}.desc`)}
            />
            <SummaryTile
              caption={t('plans.credit.tooltip')}
              title={t('compare.monthlyCredit')}
              value={formatCredits(subscriptionSummary?.monthlyCredits ?? 0)}
            />
            <SummaryTile
              caption={subscriptionSummary?.provider || t('recurring.title')}
              title={t('billing.price')}
              value={formatCurrencyAmount(
                subscriptionSummary?.monthlyPrice ?? 0,
                subscriptionSummary?.currency,
              )}
            />
            <SummaryTile
              caption={t('currentPlan.management')}
              title={t('recurring.title')}
              value={t(getSubscriptionCycleTranslationKey(subscriptionSummary?.cycle))}
            />
          </div>
        </Card>
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
      </FormGroup>
      <FormGroup collapsible={false} gap={16} title={t('comparePlans')} variant={'filled'}>
        <div className={subscriptionPageStyles.cardGrid}>
          {visiblePlans.map((plan) => {
            const isCurrent = plan === currentPlan;
            const isPendingTarget = pendingChangeRequest?.toPlan === plan;
            const dbPlan = planCatalogMap.get(plan);
            const monthlyPrice =
              dbPlan?.monthlyPrice ??
              (isCurrent ? (subscriptionSummary?.monthlyPrice ?? 0) : undefined);
            const monthlyCredits =
              dbPlan?.monthlyCredits ??
              (isCurrent ? (subscriptionSummary?.monthlyCredits ?? 0) : undefined);
            const currency = dbPlan?.currency ?? subscriptionSummary?.currency;

            return (
              <Card
                key={plan}
                extra={
                  isCurrent ? (
                    <Tag color={'blue'}>{t('plans.current')}</Tag>
                  ) : isPendingTarget ? (
                    <Tag color={'orange'}>{t('plans.pendingChange')}</Tag>
                  ) : plan === SubscriptionPlan.Premium ? (
                    <Tag color={'gold'}>{t('plans.mostPicked')}</Tag>
                  ) : null
                }
                size={'small'}
                title={<PlanIcon plan={plan} type={'combine'} />}
              >
                <div className={subscriptionPageStyles.caption}>{t(`plans.plan.${plan}.desc`)}</div>
                {typeof monthlyPrice === 'number' ? (
                  <>
                    <div style={{ height: 8 }} />
                    <div style={{ fontWeight: 600 }}>
                      {formatCurrencyAmount(monthlyPrice, currency)}
                      <span className={subscriptionPageStyles.caption}>
                        {' '}
                        / {t('recurring.monthly')}
                      </span>
                    </div>
                    <div className={subscriptionPageStyles.caption}>
                      {formatCredits(monthlyCredits ?? 0)} {t('compare.monthlyCredit')}
                    </div>
                  </>
                ) : null}
                <div style={{ height: 12 }} />
                <ul className={subscriptionPageStyles.featureList}>
                  {getPlanFeatures(plan).map((feature) => (
                    <li key={feature}>{t(feature)}</li>
                  ))}
                </ul>
                <div style={{ height: 16 }} />
                {isCurrent ? (
                  <Tag color={'blue'}>{t('plans.current')}</Tag>
                ) : isPendingTarget ? (
                  <Tag color={'orange'}>{t('plans.pendingChange')}</Tag>
                ) : (
                  <Tag>{t('billing.redeem.title')}</Tag>
                )}
              </Card>
            );
          })}
        </div>
        {visiblePlans.length === 0 ? (
          <Alert
            description={t(
              'admin.redemption.field.planKey.empty',
              'Create and activate a plan in the admin plan catalog before generating plan redemption codes.',
            )}
            message={t('comparePlans')}
            showIcon
            type={'warning'}
          />
        ) : null}
      </FormGroup>
    </>
  );
});

Plans.displayName = 'Plans';
export default Plans;
