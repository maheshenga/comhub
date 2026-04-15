import { memo, useEffect } from 'react';

import { isDesktop } from '@/const/version';
import { useElectronStore } from '@/store/electron';
import { siteConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

const PageTitle = memo<{ title: string }>(({ title }) => {
  const setCurrentPageTitle = useElectronStore((s) => s.setCurrentPageTitle);
  const brandName = useServerConfigStore(siteConfigSelectors.brandName);

  useEffect(() => {
    document.title = title ? `${title} · ${brandName}` : brandName;

    // Sync title to electron store for navigation history
    if (isDesktop) {
      setCurrentPageTitle(title);
    }
  }, [title, setCurrentPageTitle, brandName]);

  return null;
});

export default PageTitle;
