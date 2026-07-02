'use client';

import { Plans } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  formatCredits,
  useBusinessSubscriptionProfile,
} from '@/business/client/BusinessSettingPages/shared';
import WorkspaceLink from '@/features/Workspace/WorkspaceLink';

const styles = createStaticStyles(({ css }) => ({
  creditRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-inline: 8px;
    padding: 8px 10px;
    color: inherit;
    text-decoration: none;

    border-radius: 8px;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  planBadge: css`
    display: inline-flex;
    align-items: center;

    height: 22px;
    padding-inline: 8px;
    font-size: 12px;
    line-height: 22px;
    color: ${cssVar.colorTextSecondary};
    text-decoration: none;

    background: ${cssVar.colorFillTertiary};
    border-radius: 999px;
  `,
}));

export const BusinessPlanBadge = memo(() => {
  const { t } = useTranslation('subscription');
  const { currentPlan } = useBusinessSubscriptionProfile();
  const planTitle = t(`plans.plan.${currentPlan ?? Plans.Free}.title`);

  return (
    <WorkspaceLink className={styles.planBadge} to="/settings/plans">
      {planTitle}
    </WorkspaceLink>
  );
});

BusinessPlanBadge.displayName = 'BusinessPlanBadge';

const BusinessPanelContent = memo(() => {
  const { t } = useTranslation('subscription');
  const { subscriptionSummary, accountSummary } = useBusinessSubscriptionProfile();
  const subscriptionCredits = accountSummary?.breakdown?.subscription;
  const available = subscriptionCredits?.available ?? 0;
  const total = subscriptionSummary?.monthlyCredits ?? subscriptionCredits?.credited ?? 0;

  return (
    <Flexbox gap={2}>
      <WorkspaceLink className={styles.creditRow} to="/settings/credits">
        <Text type="secondary">
          {t('credits.account.breakdown.subscription', '免费积分')}
        </Text>
        <Text>
          {formatCredits(available)} / {formatCredits(total)}
        </Text>
      </WorkspaceLink>
    </Flexbox>
  );
});

BusinessPanelContent.displayName = 'BusinessPanelContent';

export default BusinessPanelContent;
