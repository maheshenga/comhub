'use client';

import { memo, useEffect } from 'react';

import { isDesktop } from '@/const/version';
import { useBrandName } from '@/features/Brand';
import { useElectronStore } from '@/store/electron';

const PageTitle = memo<{ title: string }>(({ title }) => {
  const setCurrentPageTitle = useElectronStore((s) => s.setCurrentPageTitle);
  const brandingName = useBrandName();

  useEffect(() => {
    document.title = title ? `${title} · ${brandingName}` : brandingName;

    // Sync title to electron store for navigation history
    if (isDesktop) {
      setCurrentPageTitle(title);
    }
  }, [title, brandingName, setCurrentPageTitle]);

  return null;
});

export default PageTitle;
