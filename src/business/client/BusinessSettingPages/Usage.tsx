'use client';

import { FormGroup, Icon, Segmented } from '@lobehub/ui';
import { ProviderIcon } from '@lobehub/ui/icons';
import { type DatePickerProps } from 'antd';
import { DatePicker, Divider } from 'antd';
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
  formatCredits,
  subscriptionPageStyles,
  SummaryTile,
  useBusinessSubscriptionProfile,
} from './shared';

const Usage = memo<{ mobile?: boolean }>(() => {
  const { t: tAuth, i18n } = useTranslation('auth');
  const { accountSummary, subscriptionSummary } = useBusinessSubscriptionProfile();
  const accountBreakdown = accountSummary?.breakdown;

  dayjs.locale(i18n.language);

  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.Model);
  const [dateRange, setDateRange] = useState(() => dayjs(new Date()));

  const month = dateRange.format('YYYY-MM');

  const { data, isLoading } = useClientDataSWR(['business-usage-stat', month], () =>
    usageService.findAndGroupByDay(month),
  );

  const handleDateChange: DatePickerProps['onChange'] = (value) => {
    if (value && !Array.isArray(value)) setDateRange(value);
  };

  return (
    <>
      <SettingHeader title={'用量'} />
      <div className={subscriptionPageStyles.pageStack}>
        <FormGroup
          collapsible={false}
          gap={16}
          title={'计算积分使用详情'}
          variant={'filled'}
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
        >
          <div className={subscriptionPageStyles.caption}>
            展示文本生成、嵌入、图像生成等功能的计算积分使用详情。
          </div>
          <UsageTable dateStrings={month} />
        </FormGroup>
        <FormGroup collapsible={false} gap={16} title={'本月使用情况'} variant={'filled'}>
          <div className={subscriptionPageStyles.cardGrid}>
            <SummaryTile
              caption={'当前账户可用积分'}
              title={'免费/可用积分'}
              value={formatCredits(accountSummary?.balance ?? 0)}
            />
            <SummaryTile
              caption={'订阅每月赠送额度'}
              title={'订阅积分'}
              value={formatCredits(subscriptionSummary?.monthlyCredits ?? 0)}
            />
            <SummaryTile
              caption={`已获得 ${formatCredits(accountBreakdown?.topup.credited ?? 0)}`}
              title={'充值积分'}
              value={formatCredits(accountBreakdown?.topup.available ?? 0)}
            />
            <SummaryTile
              caption={`已获得 ${formatCredits(accountBreakdown?.referral.credited ?? 0)}`}
              title={'推荐积分'}
              value={formatCredits(accountBreakdown?.referral.available ?? 0)}
            />
          </div>
          <Divider style={{ marginBlock: 0 }} />
          <UsageCards data={data} groupBy={groupBy} isLoading={isLoading} />
          <Divider style={{ marginBlock: 0 }} />
          <UsageTrends data={data} groupBy={groupBy} isLoading={isLoading} />
        </FormGroup>
      </div>
    </>
  );
});

Usage.displayName = 'Usage';
export default Usage;
