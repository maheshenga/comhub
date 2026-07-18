'use client';

import Footer from '@/features/Setting/Footer';
import { parseAsString, useQueryState } from '@/hooks/useQueryParam';
import { SettingsTabs } from '@/store/global/initialState';

import SettingsContent from '../../(main)/settings/features/SettingsContent';

const Layout = () => {
  const [activeTab] = useQueryState('active', parseAsString.withDefault(SettingsTabs.Profile));

  return (
    <>
      <SettingsContent activeTab={activeTab} mobile={true} />
      <Footer />
    </>
  );
};

export default Layout;
