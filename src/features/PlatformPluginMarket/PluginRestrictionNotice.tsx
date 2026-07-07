'use client';

import { Alert } from 'antd';
import { memo } from 'react';

import { getPlatformPluginRestrictionCopy } from './helpers';

type PluginRestrictionNoticeProps = {
  reason?: null | string;
};

const PluginRestrictionNotice = memo<PluginRestrictionNoticeProps>(({ reason }) => {
  if (!reason) return null;

  return (
    <Alert
      showIcon
      description={getPlatformPluginRestrictionCopy(reason)}
      message="当前不可运行"
      type="warning"
    />
  );
});

PluginRestrictionNotice.displayName = 'PluginRestrictionNotice';

export default PluginRestrictionNotice;
