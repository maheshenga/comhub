'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Tabs, Typography } from 'antd';
import { Laptop } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import {
  ADMIN_DESKTOP_OVERVIEW_SWR_KEY,
  ADMIN_SETTINGS_SECTION_SWR_KEY,
} from '@/const/adminCacheKeys';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import BrandPage from './BrandPage';
import BuildProfilePage from './BuildProfilePage';
import DistributionPage from './DistributionPage';
import OverviewPage from './OverviewPage';
import { desktopControlCenterStyles } from './styles';
import { resolveDesktopControlCenterTab } from './types';
import UpdateSettingsPage from './UpdateSettingsPage';

const DesktopControlCenter = memo(() => {
  const { t } = useTranslation('subscription');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = resolveDesktopControlCenterTab(searchParams.get('tab'));
  const settings = useClientDataSWR(ADMIN_SETTINGS_SECTION_SWR_KEY('desktop-update'), () =>
    adminCommercialService.getSettingsSection('desktop-update'),
  );
  const overview = useClientDataSWR(ADMIN_DESKTOP_OVERVIEW_SWR_KEY, () =>
    adminCommercialService.getDesktopOverview(),
  );

  const changeTab = (tab: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (tab === 'overview') nextSearchParams.delete('tab');
    else nextSearchParams.set('tab', tab);
    setSearchParams(nextSearchParams);
  };

  return (
    <Flexbox className={desktopControlCenterStyles.page} gap={16}>
      <div className={desktopControlCenterStyles.header}>
        <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={2}>
          <Icon icon={Laptop} size={22} /> {t('admin.desktopControl.title')}
        </Typography.Title>
      </div>
      <Tabs
        activeKey={activeKey}
        className={desktopControlCenterStyles.tabs}
        items={[
          {
            children: <OverviewPage resource={overview} onConfigure={() => changeTab('updates')} />,
            key: 'overview',
            label: t('admin.desktopControl.tabs.overview'),
          },
          {
            children: <DistributionPage overview={overview} settings={settings} />,
            key: 'distribution',
            label: t('admin.desktopControl.tabs.distribution'),
          },
          {
            children: <UpdateSettingsPage settings={settings} />,
            key: 'updates',
            label: t('admin.desktopControl.tabs.updates'),
          },
          {
            children: <BrandPage settings={settings} />,
            key: 'brand',
            label: t('admin.desktopControl.tabs.brand'),
          },
          {
            children: (
              <BuildProfilePage
                currentRelease={
                  settings.data?.desktopUpdateConfig.currentVersion
                    ? {
                        channel:
                          settings.data.desktopUpdateConfig.channel === 'canary'
                            ? 'canary'
                            : 'stable',
                        version: settings.data.desktopUpdateConfig.currentVersion,
                      }
                    : undefined
                }
                onReleaseActivated={() => Promise.all([settings.mutate(), overview.mutate()])}
              />
            ),
            key: 'build-profile',
            label: t('admin.desktopControl.tabs.buildProfile'),
          },
        ]}
        onChange={changeTab}
      />
    </Flexbox>
  );
});

DesktopControlCenter.displayName = 'DesktopControlCenter';

export default DesktopControlCenter;
