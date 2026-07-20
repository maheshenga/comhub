'use client';

import { memo, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';

import SettingsContextProvider from '../../../(main)/settings/_layout/ContextProvider';
import Header from './Header';

const MobileSettingsWrapper = memo(() => {
  const location = useLocation();

  useEffect(() => {
    const container = document.getElementById('lobe-mobile-scroll-container');
    container?.scrollTo?.({ behavior: 'auto', top: 0 });
  }, [location.pathname, location.search]);

  return (
    <SettingsContextProvider
      value={{
        showOpenAIApiKey: true,
        showOpenAIProxyUrl: true,
      }}
    >
      <MobileContentLayout header={<Header />}>
        <Outlet />
      </MobileContentLayout>
    </SettingsContextProvider>
  );
});

MobileSettingsWrapper.displayName = 'MobileSettingsWrapper';

export default MobileSettingsWrapper;
