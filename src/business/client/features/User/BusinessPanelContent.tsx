import { Flexbox, Icon } from '@lobehub/ui';
import { Button } from 'antd';
import { cssVar } from 'antd-style';
import { Crown, WalletCards } from 'lucide-react';

import {
  formatCredits,
  useBusinessSubscriptionProfile,
} from '@/business/client/BusinessSettingPages/shared';
import PlanIcon from '@/features/PlanIcon';
import WorkspaceLink from '@/features/Workspace/WorkspaceLink';

export default function BusinessPanelContent() {
  const { accountSummary, currentPlan, subscriptionSummary } = useBusinessSubscriptionProfile();
  const subscription = accountSummary?.breakdown?.subscription;

  return (
    <Flexbox
      gap={10}
      style={{
        border: `1px solid ${cssVar.colorBorderSecondary}`,
        borderRadius: 8,
        marginBlock: 4,
        padding: 12,
      }}
    >
      <Flexbox horizontal align="center" justify="space-between">
        <Flexbox horizontal align="center" gap={8}>
          <PlanIcon plan={currentPlan} size={22} type="combine" />
        </Flexbox>
        <WorkspaceLink to="/settings/plans">
          <Button icon={<Icon icon={Crown} />} size="small" type="primary">
            升级
          </Button>
        </WorkspaceLink>
      </Flexbox>
      <Flexbox horizontal align="center" gap={8} style={{ color: cssVar.colorTextSecondary }}>
        <Icon icon={WalletCards} size={15} />
        <span>订阅积分 {formatCredits(subscription?.available ?? 0)}</span>
        <span>/</span>
        <span>{formatCredits(subscriptionSummary?.monthlyCredits ?? 0)}</span>
      </Flexbox>
      <div style={{ color: cssVar.colorTextSecondary, fontSize: 13 }}>
        充值积分余额 {formatCredits(accountSummary?.balance ?? 0)}
      </div>
    </Flexbox>
  );
}
