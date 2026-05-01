'use client';

import { FormGroup } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { Empty, Tag } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import PlanIcon from '@/features/PlanIcon';
import { mutate, useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { commercialService } from '@/services/commercial';
import { type CreditLedgerEntryItem } from '@/types/business';

import RedemptionPanel from './RedemptionPanel';
import {
  formatBusinessDate,
  formatCredits,
  formatSignedCredits,
  getCreditLedgerTypeTranslationKey,
  getCreditSourceTranslationKey,
  SubscriptionPreviewNotice,
  subscriptionPageStyles,
  SummaryTile,
  useBusinessSubscriptionProfile,
} from './shared';

const Credits = memo<{ mobile?: boolean }>(() => {
  const { t } = useTranslation('subscription');
  const { accountSummary, currentPlan } = useBusinessSubscriptionProfile();
  const { data: ledgerResult, isLoading: isLedgerLoading } = useClientDataSWR(
    ['business-credit-ledger'],
    () => commercialService.listCreditLedger({ limit: 20 }),
  );
  const accountBreakdown = accountSummary?.breakdown;
  const shouldShowOtherBreakdown =
    (accountBreakdown?.other.available ?? 0) !== 0 ||
    (accountBreakdown?.other.credited ?? 0) !== 0 ||
    (accountBreakdown?.other.consumed ?? 0) !== 0;

  const getLedgerAllocationText = (record: CreditLedgerEntryItem) => {
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

    return t('credits.ledger.allocation', {
      sources: normalizedAllocations.join(' · '),
    });
  };

  const ledgerColumns = useMemo<TableColumnType<CreditLedgerEntryItem>[]>(
    () => [
      {
        dataIndex: 'title',
        key: 'title',
        render: (value, record) => value || record.referenceType || '--',
        title: t('credits.ledger.columns.title'),
      },
      {
        dataIndex: 'type',
        key: 'type',
        render: (value) => <Tag>{t(getCreditLedgerTypeTranslationKey(value))}</Tag>,
        title: t('credits.ledger.columns.type'),
      },
      {
        dataIndex: 'amount',
        key: 'amount',
        render: (value) => formatSignedCredits(value),
        title: t('credits.ledger.columns.amount'),
      },
      {
        dataIndex: 'balanceAfter',
        key: 'balanceAfter',
        render: (value) => formatCredits(value),
        title: t('credits.ledger.columns.balanceAfter'),
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
        title: t('credits.ledger.columns.description'),
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: t('credits.ledger.columns.createdAt'),
      },
    ],
    [t],
  );

  const refreshCreditData = () => {
    void Promise.all([
      mutate(['business-commercial-overview']),
      mutate(['business-credit-ledger']),
    ]);
  };

  return (
    <>
      <SettingHeader title={t('tab.credits')} />
      <FormGroup collapsible={false} gap={16} title={t('balance.title')} variant={'filled'}>
        <SubscriptionPreviewNotice />
        <div className={subscriptionPageStyles.cardGrid}>
          <SummaryTile
            caption={t('balance.plansUsageDesc')}
            title={t('balance.plansUsage')}
            value={<PlanIcon plan={currentPlan} type={'tag'} />}
          />
          <SummaryTile
            caption={formatBusinessDate(accountSummary?.updatedAt)}
            title={t('balance.creditBalance')}
            value={formatCredits(accountSummary?.balance ?? 0)}
          />
          <SummaryTile
            caption={t('credits.account.totalCreditedDesc')}
            title={t('credits.account.totalCredited')}
            value={formatCredits(accountSummary?.totalCredited ?? 0)}
          />
          <SummaryTile
            caption={t('credits.account.totalDebitedDesc')}
            title={t('credits.account.totalDebited')}
            value={formatCredits(accountSummary?.totalDebited ?? 0)}
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
      </FormGroup>
      <FormGroup
        collapsible={false}
        gap={16}
        title={t('billing.redeem.title', 'Redeem Code')}
        variant={'filled'}
      >
        <RedemptionPanel onSuccess={refreshCreditData} />
      </FormGroup>
      <FormGroup collapsible={false} gap={16} title={t('tab.spend')} variant={'filled'}>
        <div className={subscriptionPageStyles.caption}>{t('credits.ledger.desc')}</div>
        <InlineTable
          columns={ledgerColumns}
          dataSource={ledgerResult?.items || []}
          loading={isLedgerLoading}
          locale={{ emptyText: <Empty description={t('credits.ledger.empty')} /> }}
          rowKey={(record) => record.id}
        />
      </FormGroup>
    </>
  );
});

Credits.displayName = 'Credits';
export default Credits;
