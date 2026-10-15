'use client';

import { DISPLAY_CREDITS_UNIT, toAtomicCredits, toDisplayCredits } from '@lobechat/const/currency';
import { Plans } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { memo, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { OFFICIAL_URL } from '@/const/url';
import { useClientDataSWR } from '@/libs/swr';
import { commercialService } from '@/services/commercial';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/selectors';

import { formatCredits, formatCreditsAmount, formatSignedCredits } from './creditsDisplay';

export const subscriptionPageStyles = createStaticStyles(({ css }) => ({
  actionRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  `,
  caption: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${cssVar.colorTextDescription};
  `,
  cardGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  `,
  hero: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};

    .ant-card-body {
      padding: 22px;
    }
  `,
  heroDescription: css`
    max-width: 720px;
    font-size: 13px;
    line-height: 1.6;
    color: ${cssVar.colorTextDescription};
  `,
  heroTitle: css`
    margin: 0;

    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    color: ${cssVar.colorText};
  `,
  pageStack: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  featureList: css`
    margin: 0;
    padding-inline-start: 18px;

    font-size: 13px;
    line-height: 1.7;
    color: ${cssVar.colorTextDescription};

    li + li {
      margin-block-start: 6px;
    }
  `,
  formCard: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowTertiary};

    .ant-card-body {
      padding: 16px;
    }
  `,
  inlineValue: css`
    overflow: hidden;
    flex: 1;

    min-width: 0;
    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 14px;
    line-height: 1.5;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;

    background: ${cssVar.colorBgContainer};
  `,
  inlineValueRow: css`
    display: flex;
    gap: 8px;
    align-items: center;

    width: 100%;
    min-width: 0;

    @media (width <= 640px) {
      flex-wrap: wrap;

      > button,
      > .ant-btn {
        flex: 1;
      }
    }
  `,
  metricRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: center;
  `,
  monoBlock: css`
    overflow: hidden;

    width: 100%;
    padding: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 24px;
    line-height: 1.35;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;

    background: ${cssVar.colorBgContainer};
  `,
  summaryCard: css`
    height: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};

    .ant-card-body {
      height: 100%;
      padding: 16px;
    }
  `,
  tableSection: css`
    margin-block-start: 8px;
  `,
  tableError: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;

    padding-block: 20px;
  `,
  tileTitle: css`
    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  tileValue: css`
    font-size: 20px;
    font-weight: 700;
    line-height: 1.4;
    color: ${cssVar.colorText};
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

export const isPaidPlan = (plan: Plans) => plan !== Plans.Free;

export const resolveCurrentPlan = (subscriptionPlan?: Plans, isFreePlan?: boolean): Plans => {
  if (subscriptionPlan) return subscriptionPlan;
  if (isFreePlan === false) return Plans.Hobby;

  return Plans.Free;
};

export const formatBusinessNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

export { DISPLAY_CREDITS_UNIT, toDisplayCredits };

export const toRawCredits = toAtomicCredits;

// 积分格式化是纯函数，定义在 creditsDisplay.ts 以便单测直接覆盖精度契约；
// 这里只做再导出，既有调用点（shared / UsageTable 等）无需改路径。
export { formatCredits, formatCreditsAmount, formatSignedCredits };

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
    case 'monthly': {
      return 'recurring.monthly';
    }
    case 'yearly': {
      return 'recurring.yearly';
    }
    case 'one_time': {
      return 'recurring.payonce';
    }
    case 'lifetime': {
      return 'recurring.lifetime';
    }
    default: {
      return 'recurring.monthly';
    }
  }
};

export const getBillingStatusTranslationKey = (status?: string) => {
  switch (status) {
    case 'paid': {
      return 'billing.paid';
    }
    case 'pending': {
      return 'billing.pending';
    }
    case 'canceled': {
      return 'billing.closed';
    }
    case 'failed': {
      return 'billing.unpaid';
    }
    default: {
      return 'billing.status';
    }
  }
};

export const getCreditLedgerTypeTranslationKey = (type?: string) => {
  switch (type) {
    case 'adjustment': {
      return 'credits.ledger.type.adjustment';
    }
    case 'bonus': {
      return 'credits.ledger.type.bonus';
    }
    case 'consume': {
      return 'credits.ledger.type.consume';
    }
    case 'expire': {
      return 'credits.ledger.type.expire';
    }
    case 'referral_reward': {
      return 'credits.ledger.type.referralReward';
    }
    case 'refund': {
      return 'credits.ledger.type.refund';
    }
    case 'subscription_grant': {
      return 'credits.ledger.type.subscriptionGrant';
    }
    case 'topup': {
      return 'credits.ledger.type.topUp';
    }
    default: {
      return 'credits.ledger.type.other';
    }
  }
};

export const getCreditSourceTranslationKey = (type?: string) => {
  switch (type) {
    case 'subscription': {
      return 'credits.account.breakdown.subscription';
    }
    case 'referral': {
      return 'credits.account.breakdown.referral';
    }
    case 'topup': {
      return 'credits.account.breakdown.topUp';
    }
    default: {
      return 'credits.account.breakdown.other';
    }
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

  const referralCode = '';

  const [siteOrigin, setSiteOrigin] = useState(OFFICIAL_URL);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  const referralLink = useMemo(
    () => (referralCode ? `${siteOrigin}/signup?ref=${referralCode}` : `${siteOrigin}/signup`),
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

/**
 * 桌面端的加载失败态。桌面表格分支过去直接消费 data（失败时为空数组），
 * 于是「加载失败」与「真的没有记录」渲染成同一张空表，且没有重试入口。
 * 移动端早就有 role="alert" + 重试，这里让桌面端对齐同一套语义。
 */
export const BusinessTableError = ({
  description,
  onRetry,
}: {
  description?: ReactNode;
  onRetry?: () => void;
}) => {
  const { t } = useTranslation('subscription');

  return (
    <div className={subscriptionPageStyles.tableError} role="alert">
      <div>{description ?? t('mobile.error.title')}</div>
      {onRetry ? <Button onClick={onRetry}>{t('mobile.error.retry')}</Button> : null}
    </div>
  );
};

export const SummaryTile = memo<SummaryTileProps>(({ title, value, caption, extra }) => {
  return (
    <Card className={subscriptionPageStyles.summaryCard} size={'small'}>
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

interface OverviewPanelProps {
  children?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  title: ReactNode;
}

export const OverviewPanel = memo<OverviewPanelProps>(({ title, description, extra, children }) => {
  return (
    <Card className={subscriptionPageStyles.hero} size={'small'}>
      <Flexbox gap={18}>
        <Flexbox horizontal align={'flex-start'} gap={16} justify={'space-between'}>
          <Flexbox gap={8}>
            <h2 className={subscriptionPageStyles.heroTitle}>{title}</h2>
            {description ? (
              <div className={subscriptionPageStyles.heroDescription}>{description}</div>
            ) : null}
          </Flexbox>
          {extra}
        </Flexbox>
        {children}
      </Flexbox>
    </Card>
  );
});

OverviewPanel.displayName = 'OverviewPanel';
