'use client';

import { Icon, Segmented } from '@lobehub/ui';
import { ProviderIcon } from '@lobehub/ui/icons';
import { type DatePickerProps } from 'antd';
import { DatePicker, Divider } from 'antd';
import { createStaticStyles } from 'antd-style';
import dayjs from 'dayjs';
import { Brain } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import UsageCards from '@/routes/(main)/settings/stats/features/usage/UsageCards';
import UsageTable from '@/routes/(main)/settings/stats/features/usage/UsageTable';
import UsageTrends from '@/routes/(main)/settings/stats/features/usage/UsageTrends';
import { GroupBy } from '@/routes/(main)/settings/stats/types';
import { usageService } from '@/services/usage';
import { type UsageLog } from '@/types/usage/usageRecord';

import BusinessSettingsPageShell from './BusinessSettingsPageShell';
import { BusinessSettingsSection } from './mobile/BusinessMobileSection';
import {
  formatCredits,
  subscriptionPageStyles,
  SummaryTile,
  useBusinessSubscriptionProfile,
} from './shared';

const styles = createStaticStyles(({ css }) => ({
  mobileFilters: css`
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;

    width: 100%;

    > .ant-picker,
    > .ant-segmented {
      width: 100%;
      min-height: 44px;
    }

    .ant-segmented-item-label {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
    }
  `,
}));

const Usage = memo<{ mobile?: boolean }>(({ mobile }) => {
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
  const usageData = (data ?? []) as unknown as UsageLog[];

  const handleDateChange: DatePickerProps['onChange'] = (value) => {
    if (value && !Array.isArray(value)) setDateRange(value);
  };

  const filterControls = (
    <>
      <DatePicker picker="month" value={dateRange} onChange={handleDateChange} />
      <Segmented
        style={mobile ? undefined : { marginLeft: 8 }}
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
        onChange={(value: string | number) => setGroupBy(value as GroupBy)}
      />
    </>
  );

  const detailsSection = (
    <BusinessSettingsSection
      defaultOpen={false}
      desktopExtra={mobile ? undefined : filterControls}
      mobile={mobile}
      title={'计算积分使用详情'}
    >
      <div className={subscriptionPageStyles.caption}>
        展示文本生成、嵌入、图像生成等功能的计算积分使用详情。
      </div>
      <div className={subscriptionPageStyles.tableSection}>
        <UsageTable dateStrings={month} mobile={mobile} />
      </div>
    </BusinessSettingsSection>
  );

  const coreSection = (
    <BusinessSettingsSection mobile={mobile} title={'本月使用情况'}>
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
      <Divider style={{ marginBlock: 8 }} />
      <UsageCards data={usageData} groupBy={groupBy} isLoading={isLoading} />
    </BusinessSettingsSection>
  );

  const trendsSection = (
    <BusinessSettingsSection defaultOpen={false} mobile={mobile} title={'使用趋势'}>
      <UsageTrends data={usageData} groupBy={groupBy} isLoading={isLoading} />
    </BusinessSettingsSection>
  );

  return (
    <BusinessSettingsPageShell mobile={mobile} title={'用量'}>
      {mobile ? <div className={styles.mobileFilters}>{filterControls}</div> : null}
      {mobile ? (
        <>
          {coreSection}
          {trendsSection}
          {detailsSection}
        </>
      ) : (
        <>
          {detailsSection}
          {coreSection}
          {trendsSection}
        </>
      )}
    </BusinessSettingsPageShell>
  );
});

Usage.displayName = 'Usage';
export default Usage;
