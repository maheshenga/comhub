'use client';

import { createStaticStyles, cx } from 'antd-style';
import { type FC, type ReactNode } from 'react';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import BusinessMobileTabs from './mobile/BusinessMobileTabs';
import { subscriptionPageStyles } from './shared';

const styles = createStaticStyles(({ css }) => ({
  mobile: css`
    box-sizing: border-box;
    width: 100%;
    padding-block: 12px 64px;
    padding-inline: 16px;
  `,
}));

interface BusinessSettingsPageShellProps {
  children: ReactNode;
  className?: string;
  mobile?: boolean;
  title: ReactNode;
}

const BusinessSettingsPageShell: FC<BusinessSettingsPageShellProps> = ({
  children,
  className = subscriptionPageStyles.pageStack,
  mobile,
  title,
}) => (
  <>
    {mobile ? <BusinessMobileTabs /> : <SettingHeader title={title} />}
    <div className={cx(className, mobile && styles.mobile)}>{children}</div>
  </>
);

export default BusinessSettingsPageShell;
