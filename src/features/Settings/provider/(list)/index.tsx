'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import DesktopLayout from '../_layout/Desktop';
import MobileLayout from '../_layout/Mobile';
import ProviderDetailPage from '../detail';

const Page = (props: { mobile?: boolean }) => {
  const [SearchParams, setSearchParams] = useSearchParams();
  const [provider, setProviderState] = useState(SearchParams.get('provider') || 'all');
  // setSearchParams / setProviderState are stable setters, so this callback identity is stable
  const setProvider = useCallback(
    (nextProvider: string) => {
      setSearchParams({ active: 'provider', provider: nextProvider });
      setProviderState(nextProvider);
    },
    [setSearchParams],
  );

  const { mobile } = props;
  const ProviderLayout = mobile ? MobileLayout : DesktopLayout;

  const ProviderListPage = useMemo(() => {
    return <ProviderDetailPage id={provider} onProviderSelect={setProvider} />;
  }, [provider, setProvider]);

  return <ProviderLayout onProviderSelect={setProvider}>{ProviderListPage}</ProviderLayout>;
};

export default Page;
