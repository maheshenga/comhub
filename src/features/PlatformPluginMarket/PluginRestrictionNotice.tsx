'use client';

import { Alert } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { getPlatformPluginRestrictionCopyKey } from './helpers';

type PluginRestrictionNoticeProps = {
  reason?: null | string;
};

const PluginRestrictionNotice = memo<PluginRestrictionNoticeProps>(({ reason }) => {
  const { t } = useTranslation('subscription');

  if (!reason) return null;

  return (
    <Alert
      showIcon
      description={t(getPlatformPluginRestrictionCopyKey(reason))}
      message={t('platformPlugins.detail.unavailable')}
      type="warning"
    />
  );
});

PluginRestrictionNotice.displayName = 'PluginRestrictionNotice';

export default PluginRestrictionNotice;
