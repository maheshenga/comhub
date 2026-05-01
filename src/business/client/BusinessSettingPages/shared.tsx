'use client';

import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { Plans } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Card } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { memo, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OFFICIAL_URL } from '@/const/url';
import { useClientDataSWR } from '@/libs/swr';
import { commercialService } from '@/services/commercial';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/selectors';

export const subscriptionPageStyles = createStaticStyles(({ css }) => ({
  caption: css`
    color: ${cssVar.colorTextDescription};
    font-size: 13px;
    line-height: 1.6;
  `,
  cardGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  `,
  featureList: css`
    margin: 0;
    padding-left: 18px;
    color: ${cssVar.colorTextDescription};
    font-size: 13px;
    line-height: 1.7;

    li + li {
      margin-top: 6px;
    }
  `,
  tileTitle: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 13px;
    line-height: 1.5;
  `,
  tileValue: css`
    color: ${cssVar.colorText};
    font-size: 20px;
    font-weight: 700;
    line-height: 1.4;
    word-break: break-word;
  `,
}));

export const subscriptionPlanOrder = [
  Plans.Free,
  Plans.Hobby,
  Plans.Starter,
  Plans.Premium,
  Plans.Ultimate,
] as const;

export const isPaidPlan = (plan: Plans) => plan !== Plans.Free && plan !== Plans.Hobby;

export const resolveCurrentPlan = (subscriptionPlan?: Plans, isFreePlan?: boolean): Plans => {
  if (subscriptionPlan) return subscriptionPlan;
  if (isFreePlan === false) return Plans.Hobby;

  return Plans.Free;
};

const createReferralCode = (value?: string | null) => {
  const normalized = (value || '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toUpperCase()
    .slice(0, 8);

  if (normalized.length >= 2) return normalized;

  return `CH${Date.now().toString(36).slice(-6).toUpperCase()}`;
};

export const formatBusinessNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

export const DISPLAY_CREDITS_UNIT = CREDITS_PER_DOLLAR;

export const toDisplayCredits = (value: number) => value / DISPLAY_CREDITS_UNIT;

export const toRawCredits = (value: number) => Math.round(value * DISPLAY_CREDITS_UNIT);

export const formatCredits = (value: number) =>
  `${formatBusinessNumber(toDisplayCredits(value))} M`;

export const formatSignedCredits = (value: number) =>
  `${value > 0 ? '+' : ''}${formatBusinessNumber(toDisplayCredits(value))} M`;

export const formatCreditBreakdownStats = ({
  credited,
  consumed,
}: {
  consumed: number;
  credited: number;
}) => `${formatCredits(credited)} / ${formatCredits(consumed)}`;

export const formatCurrencyAmount = (value: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `${currency} ${formatBusinessNumber(value)}`;
  }
};

export const formatBusinessDate = (value?: Date | string | null, pattern = 'YYYY-MM-DD HH:mm') =>
  value ? dayjs(value).format(pattern) : '--';

export const getSubscriptionCycleTranslationKey = (cycle?: string) => {
  switch (cycle) {
    case 'monthly':
      return 'recurring.monthly';
    case 'yearly':
      return 'recurring.yearly';
    case 'one_time':
      return 'recurring.payonce';
    case 'lifetime':
      return 'recurring.fullYear';
    default:
      return 'recurring.monthly';
  }
};

export const getBillingStatusTranslationKey = (status?: string) => {
  switch (status) {
    case 'paid':
      return 'billing.paid';
    case 'pending':
      return 'billing.pending';
    case 'canceled':
      return 'billing.closed';
    case 'failed':
      return 'billing.unpaid';
    default:
      return 'billing.status';
  }
};

export const getCreditLedgerTypeTranslationKey = (type?: string) => {
  switch (type) {
    case 'adjustment':
      return 'credits.ledger.type.adjustment';
    case 'bonus':
      return 'credits.ledger.type.bonus';
    case 'consume':
      return 'credits.ledger.type.consume';
    case 'expire':
      return 'credits.ledger.type.expire';
    case 'referral_reward':
      return 'credits.ledger.type.referralReward';
    case 'refund':
      return 'credits.ledger.type.refund';
    case 'subscription_grant':
      return 'credits.ledger.type.subscriptionGrant';
    case 'topup':
      return 'credits.ledger.type.topUp';
    default:
      return 'credits.ledger.type.other';
  }
};

export const getCreditSourceTranslationKey = (type?: string) => {
  switch (type) {
    case 'subscription':
      return 'credits.account.breakdown.subscription';
    case 'referral':
      return 'credits.account.breakdown.referral';
    case 'topup':
      return 'credits.account.breakdown.topUp';
    default:
      return 'credits.account.breakdown.other';
  }
};

export const useBusinessSubscriptionProfile = () => {
  const [email, isFreePlan, referralStatus, subscriptionPlan, userId, username, fullName] =
    useUserStore((s) => [
      userProfileSelectors.email(s),
      authSelectors.isFreePlan(s),
      s.referralStatus,
      s.subscriptionPlan,
      userProfileSelectors.userId(s),
      userProfileSelectors.username(s),
      userProfileSelectors.fullName(s),
    ]);

  const { data: overview, isLoading: isOverviewLoading } = useClientDataSWR(
    ['business-commercial-overview'],
    () => commercialService.getOverview(),
  );

  const subscriptionSummary = overview?.subscription;
  const accountSummary = overview?.account;

  const currentPlan = useMemo(
    () => subscriptionSummary?.plan ?? resolveCurrentPlan(subscriptionPlan, isFreePlan),
    [isFreePlan, subscriptionPlan, subscriptionSummary?.plan],
  );

  const referralCode = useMemo(
    () => createReferralCode(username || fullName || email || userId),
    [email, fullName, userId, username],
  );

  const [siteOrigin, setSiteOrigin] = useState(OFFICIAL_URL);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  const referralLink = useMemo(
    () => `${siteOrigin}/signup?ref=${referralCode}`,
    [referralCode, siteOrigin],
  );

  return {
    accountSummary,
    currentPlan,
    email,
    fullName,
    isFreePlan: subscriptionSummary?.isFreePlan ?? Boolean(isFreePlan),
    isOverviewLoading,
    isPaidPlan: isPaidPlan(currentPlan),
    referralStatus,
    referralCode,
    referralLink,
    subscriptionSummary,
    subscriptionPlan,
    userId,
    username,
  };
};

interface SummaryTileProps {
  caption?: ReactNode;
  extra?: ReactNode;
  title: ReactNode;
  value: ReactNode;
}

export const SummaryTile = memo<SummaryTileProps>(({ title, value, caption, extra }) => {
  return (
    <Card size={'small'}>
      <Flexbox gap={10}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <div className={subscriptionPageStyles.tileTitle}>{title}</div>
          {extra}
        </Flexbox>
        <div className={subscriptionPageStyles.tileValue}>{value}</div>
        {caption ? <div className={subscriptionPageStyles.caption}>{caption}</div> : null}
      </Flexbox>
    </Card>
  );
});

SummaryTile.displayName = 'SummaryTile';

export const SubscriptionPreviewNotice = memo(() => {
  const { t } = useTranslation('subscription');

  return (
    <Alert
      description={t('nativePreview.desc')}
      message={t('nativePreview.title')}
      showIcon
      type={'info'}
    />
  );
});

SubscriptionPreviewNotice.displayName = 'SubscriptionPreviewNotice';
