'use client';

import { Icon, Segmented } from '@lobehub/ui';
import { ProviderIcon } from '@lobehub/ui/icons';
import { type DatePickerProps } from 'antd';
import { DatePicker, Divider } from 'antd';
import { FormGroup } from '@lobehub/ui';
import dayjs from 'dayjs';
import { Brain } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import UsageCards from '@/routes/(main)/settings/stats/features/usage/UsageCards';
import UsageTable from '@/routes/(main)/settings/stats/features/usage/UsageTable';
import UsageTrends from '@/routes/(main)/settings/stats/features/usage/UsageTrends';
import { GroupBy } from '@/routes/(main)/settings/stats/types';
import { usageService } from '@/services/usage';

import {
  formatBusinessDate,
  formatCredits,
  SubscriptionPreviewNotice,
  subscriptionPageStyles,
  SummaryTile,
  useBusinessSubscriptionProfile,
} from './shared';

const Usage = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { t: tAuth, i18n } = useTranslation('auth');
  const { accountSummary, currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const accountBreakdown = accountSummary?.breakdown;
  const shouldShowOtherBreakdown =
    (accountBreakdown?.other.available ?? 0) !== 0 ||
    (accountBreakdown?.other.credited ?? 0) !== 0 ||
    (accountBreakdown?.other.consumed ?? 0) !== 0;

  dayjs.locale(i18n.language);

  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.Model);
  const [dateRange, setDateRange] = useState(() => dayjs(new Date()));

  const month = dateRange.format('YYYY-MM');

  const { data, isLoading } = useClientDataSWR(['business-usage-stat', month], () =>
    usageService.findAndGroupByDay(month),
  );

  const handleDateChange: DatePickerProps['onChange'] = (value) => {
    if (value) setDateRange(value);
  };

  return (
    <>
      <SettingHeader title={t('tab.usage')} />
      <FormGroup
        collapsible={false}
        extra={
          <>
            <DatePicker picker="month" value={dateRange} onChange={handleDateChange} />
            <Segmented
              style={{ marginLeft: 8 }}
              value={groupBy}
              variant={'outlined'}
              options={[
                {
                  icon: <Icon icon={Brain} />,
                  label: tAuth('usage.welcome.model'),
                  value: GroupBy.Model,
                },
                {
                  icon: <Icon icon={ProviderIcon} />,
                  label: tAuth('usage.welcome.provider'),
                  value: GroupBy.Provider,
                },
              ]}
              onChange={(value) => setGroupBy(value as GroupBy)}
            />
          </>
        }
        gap={16}
        title={`${t('usage.credit.title')} · ${t(`plans.plan.${currentPlan}.title`)}`}
        variant={'filled'}
      >
        <SubscriptionPreviewNotice />
        <div className={subscriptionPageStyles.cardGrid}>
          <SummaryTile
            caption={t('balance.plansUsageDesc')}
            title={t('balance.creditBalance')}
            value={formatCredits(accountSummary?.balance ?? 0)}
          />
          <SummaryTile
            caption={t(`plans.plan.${currentPlan}.title`)}
            title={t('compare.monthlyCredit')}
            value={formatCredits(subscriptionSummary?.monthlyCredits ?? 0)}
          />
          <SummaryTile
            caption={t('credits.account.breakdown.stats', {
              credited: formatCredits(accountBreakdown?.subscription.credited ?? 0),
              used: formatCredits(accountBreakdown?.subscription.consumed ?? 0),
            })}
            title={t('credits.account.breakdown.subscription')}
            value={formatCredits(accountBreakdown?.subscription.available ?? 0)}
          />
          <SummaryTile
            caption={t('credits.account.breakdown.stats', {
              credited: formatCredits(accountBreakdown?.referral.credited ?? 0),
              used: formatCredits(accountBreakdown?.referral.consumed ?? 0),
            })}
            title={t('credits.account.breakdown.referral')}
            value={formatCredits(accountBreakdown?.referral.available ?? 0)}
          />
          <SummaryTile
            caption={t('credits.account.breakdown.stats', {
              credited: formatCredits(accountBreakdown?.topup.credited ?? 0),
              used: formatCredits(accountBreakdown?.topup.consumed ?? 0),
            })}
            title={t('credits.account.breakdown.topUp')}
            value={formatCredits(accountBreakdown?.topup.available ?? 0)}
          />
          <SummaryTile
            caption={t('usage.credit.desc')}
            title={t('credits.account.totalDebited')}
            value={formatCredits(accountSummary?.totalDebited ?? 0)}
          />
          <SummaryTile
            caption={subscriptionSummary?.provider || t('recurring.title')}
            title={t('summary.nextPayment')}
            value={formatBusinessDate(subscriptionSummary?.renewsAt || subscriptionSummary?.endsAt)}
          />
          {shouldShowOtherBreakdown ? (
            <SummaryTile
              caption={t('credits.account.breakdown.stats', {
                credited: formatCredits(accountBreakdown?.other.credited ?? 0),
                used: formatCredits(accountBreakdown?.other.consumed ?? 0),
              })}
              title={t('credits.account.breakdown.other')}
              value={formatCredits(accountBreakdown?.other.available ?? 0)}
            />
          ) : null}
        </div>
        <div>{t('usage.credit.desc')}</div>
        <Divider style={{ marginBlock: 0 }} />
        <UsageCards data={data} groupBy={groupBy} isLoading={isLoading} />
        <Divider style={{ marginBlock: 0 }} />
        <UsageTrends data={data} groupBy={groupBy} isLoading={isLoading} />
        <div style={{ height: 8 }} />
        <UsageTable dateStrings={month} />
      </FormGroup>
    </>
  );
});

Usage.displayName = 'Usage';
export default Usage;
