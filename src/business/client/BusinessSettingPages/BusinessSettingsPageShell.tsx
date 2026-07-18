'use client';

import { createStaticStyles, cx } from 'antd-style';
import { type FC, type ReactNode } from 'react';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import BusinessMobileActionBar, {
  type BusinessMobilePrimaryAction,
} from './mobile/BusinessMobileActionBar';
import BusinessMobileTabs from './mobile/BusinessMobileTabs';
import { subscriptionPageStyles } from './shared';

const styles = createStaticStyles(({ css }) => ({
  mobile: css`
    box-sizing: border-box;
    width: 100%;
    padding-block: 12px 64px;
    padding-inline: 16px;
  `,
  mobileWithAction: css`
    padding-block-end: calc(96px + env(safe-area-inset-bottom, 0px));
  `,
}));

export interface BusinessSettingsPageShellProps {
  children: ReactNode;
  className?: string;
  mobile?: boolean;
  mobileAction?: BusinessMobilePrimaryAction;
  title: ReactNode;
}

const BusinessSettingsPageShell: FC<BusinessSettingsPageShellProps> = ({
  children,
  className = subscriptionPageStyles.pageStack,
  mobile,
  mobileAction,
  title,
}) => (
  <>
    {mobile ? <BusinessMobileTabs /> : <SettingHeader title={title} />}
    <div
      className={cx(
        className,
        mobile && styles.mobile,
        mobile && mobileAction && styles.mobileWithAction,
      )}
    >
      {children}
    </div>
    {mobile && mobileAction ? <BusinessMobileActionBar action={mobileAction} /> : null}
  </>
);

export default BusinessSettingsPageShell;
