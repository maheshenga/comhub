import { Center, Flexbox, Tooltip } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { CoinsIcon } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';

import ActionPopover from '../components/ActionPopover';

interface CreditsInfo {
  balance: number;
  totalConsumed: number;
  totalEarned: number;
}

const CreditBalance = memo(() => {
  const { t } = useTranslation('setting');
  const [credits, setCredits] = useState<CreditsInfo | null>(null);

  useEffect(() => {
    lambdaClient.vip.getMyCredits
      .query()
      .then((data) => setCredits(data as CreditsInfo))
      .catch(() => {});
  }, []);

  if (!credits) return null;

  const content = (
    <Flexbox gap={8} style={{ minWidth: 180 }}>
      <Flexbox horizontal align={'center'} gap={4} justify={'space-between'}>
        <div style={{ color: cssVar.colorTextDescription }}>{t('vip.credits.balance')}</div>
        <div style={{ fontWeight: 600 }}>{credits.balance.toLocaleString()}</div>
      </Flexbox>
      <Flexbox horizontal align={'center'} gap={4} justify={'space-between'}>
        <div style={{ color: cssVar.colorTextDescription }}>{t('vip.credits.totalEarned')}</div>
        <div style={{ color: '#52c41a' }}>{credits.totalEarned.toLocaleString()}</div>
      </Flexbox>
      <Flexbox horizontal align={'center'} gap={4} justify={'space-between'}>
        <div style={{ color: cssVar.colorTextDescription }}>{t('vip.credits.totalConsumed')}</div>
        <div style={{ color: '#ff4d4f' }}>{credits.totalConsumed.toLocaleString()}</div>
      </Flexbox>
    </Flexbox>
  );

  return (
    <ActionPopover content={content}>
      <Center
        horizontal
        gap={4}
        style={{
          cursor: 'pointer',
          fontSize: 12,
          color: credits.balance <= 500 ? cssVar.colorWarning : cssVar.colorTextSecondary,
          fontFamily: cssVar.fontFamilyCode,
        }}
      >
        <CoinsIcon size={14} />
        <span>{credits.balance.toLocaleString()}</span>
      </Center>
    </ActionPopover>
  );
});

export default CreditBalance;
