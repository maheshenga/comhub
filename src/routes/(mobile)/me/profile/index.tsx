'use client';

import { memo } from 'react';

import SettingsContent from '@/routes/(main)/settings/features/SettingsContent';
import { SettingsTabs } from '@/store/global/initialState';

const MeProfilePage = memo(() => {
  return <SettingsContent mobile activeTab={SettingsTabs.Profile} />;
});

MeProfilePage.displayName = 'MeProfilePage';

export default MeProfilePage;
