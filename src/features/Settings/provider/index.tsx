'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { Outlet, useParams } from 'react-router';

import { useProviderSettingsNavigate } from '@/features/ProviderSettings/useProviderSettingsNavigate';

import DesktopLayoutContainer from './_layout/Desktop/Container';
import ProviderDetailPageComponent from './detail';
import ProviderMenu from './ProviderMenu';

// Layout component that wraps provider pages with navigation
export const ProviderLayout = memo(() => {
  const handleProviderSelect = useProviderSettingsNavigate();

  return (
    <Flexbox
      horizontal
      width={'100%'}
      style={{
        maxHeight: '100%',
      }}
    >
      <ProviderMenu mobile={false} onProviderSelect={handleProviderSelect} />
      <DesktopLayoutContainer>
        <Outlet />
      </DesktopLayoutContainer>
    </Flexbox>
  );
});

ProviderLayout.displayName = 'ProviderLayout';

// Detail page component that receives providerId from route params
export const ProviderDetailPage = memo(() => {
  const params = useParams<{ providerId: string }>();
  const handleProviderSelect = useProviderSettingsNavigate();

  return (
    <ProviderDetailPageComponent
      id={params.providerId ?? ''}
      onProviderSelect={handleProviderSelect}
    />
  );
});

ProviderDetailPage.displayName = 'ProviderDetailPage';

export { default } from './(list)';
