import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const businessPages = ['Billing', 'Credits', 'Plans', 'Referral', 'Usage'];
const readBusinessPage = (pageName: string) =>
  readFile(
    path.join(process.cwd(), `src/business/client/BusinessSettingPages/${pageName}.tsx`),
    'utf8',
  );

describe('mobile business settings presentation', () => {
  it.each(businessPages)('%s uses the shared responsive page shell', async (pageName) => {
    const source = await readBusinessPage(pageName);

    expect(source).toContain('BusinessSettingsPageShell');
    expect(source).toContain('mobile={mobile}');
    expect(source).not.toContain('SettingHeader');
  });

  it('uses selectable snap cards and progressive disclosure on Plans', async () => {
    const source = await readBusinessPage('Plans');

    expect(source).toContain('getDefaultMobilePlanTarget');
    expect(source).toContain('scroll-snap-type: x mandatory');
    expect(source.match(/defaultOpen=\{false\}/g)).toHaveLength(3);
    expect(source).toContain('mobileAction={mobileAction}');
    expect(source).not.toContain('minWidth={0}');
  });

  it('uses mobile record cards and hides non-executable purchase controls on Credits', async () => {
    const source = await readBusinessPage('Credits');

    expect(source).toContain('buildTopUpOrderRecord');
    expect(source).toContain('buildCreditLedgerRecord');
    expect(source).toContain('mobile ? (');
    expect(source).toContain('mobileAction={mobileAction}');
    expect(source).toContain('defaultOpen={false}');
    expect(source).toContain('setRedemptionOpen(true)');
    expect(source).toContain('setOrdersOpen(true)');
    expect(source).toContain('setLedgerOpen(true)');
    expect(source).toContain("suffix={'M'}");
    expect(source).not.toContain("addonAfter={'M'}");
  });

  it('uses a collapsed mobile change history and upgrade action on Billing', async () => {
    const source = await readBusinessPage('Billing');

    expect(source).toContain('buildBillingChangeRecord');
    expect(source).toContain("href: '/settings/plans'");
    expect(source).toContain('defaultOpen={false}');
    expect(source).toContain('BusinessMobileRecordList');
    expect(source).toContain('setHistoryOpen(true)');
    expect(source).toContain('open={mobile ? historyOpen : undefined}');
    expect(source).toContain("t('billing.summary.currentCycleAmount')");
  });

  it('shows referral records as cards and gates the reward action', async () => {
    const source = await readBusinessPage('Referral');

    expect(source).toContain('buildReferralHistoryRecord');
    expect(source).toContain('canActivateReward');
    expect(source).toContain('mobileAction={mobileAction}');
    expect(source).toContain('BusinessMobileRecordList');
    expect(source).toContain("title={t('referral.rules.backfill.title')}");
    expect(source).toContain("t('referral.copy.linkSuccess')");
    expect(source).not.toContain('`${label}已复制`');
  });

  it('passes mobile through to UsageTable and keeps the query inside UsageTable', async () => {
    const usagePage = await readBusinessPage('Usage');
    const usageTable = await readFile(
      path.join(process.cwd(), 'src/routes/(main)/settings/stats/features/usage/UsageTable.tsx'),
      'utf8',
    );
    const usageBarChart = await readFile(
      path.join(
        process.cwd(),
        'src/routes/(main)/settings/stats/features/components/UsageBarChart.tsx',
      ),
      'utf8',
    );

    expect(usagePage).toContain('<UsageTable dateStrings={month} mobile={mobile} />');
    expect(usageTable).toContain('mobile ? (');
    expect(usageTable).toContain('buildUsageRecord');
    expect(usageTable.match(/usageService\.findByMonth/g)).toHaveLength(1);
    expect(usageBarChart).toContain('({ showType, ...props }: UsageBarChartProps)');
    expect(usageBarChart).not.toContain('props.showType');
  });
});
