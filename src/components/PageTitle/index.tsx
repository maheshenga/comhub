import { memo, useEffect } from 'react';

import { isDesktop } from '@/const/version';
import { useElectronStore } from '@/store/electron';
import { siteConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

const PageTitle = memo<{ title: string }>(({ title }) => {
  const setCurrentPageTitle = useElectronStore((s) => s.setCurrentPageTitle);
  const siteTitle = useServerConfigStore(siteConfigSelectors.siteTitle);

  useEffect(() => {
    document.title = title ? `${title} · ${siteTitle}` : siteTitle;

    // Sync title to electron store for navigation history
    if (isDesktop) {
      setCurrentPageTitle(title);
    }
  }, [title, setCurrentPageTitle, siteTitle]);

  return null;
});

export default PageTitle;
