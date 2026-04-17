'use client';

import { BrandLoading } from '@lobehub/ui/brand';
import { Authelia } from '@lobehub/ui/icons';

import { useServerConfigStore } from '@/store/serverConfig';
import { siteConfigSelectors } from '@/store/serverConfig/selectors';

import CircleLoading from '../CircleLoading';
import styles from './index.module.css';

interface BrandTextLoadingProps {
  debugId: string;
}

const BrandTextLoading = ({ debugId }: BrandTextLoadingProps) => {
  const hasCustomSiteIdentity = useServerConfigStore(siteConfigSelectors.hasCustomSiteIdentity);
  const serverConfigInit = useServerConfigStore((s) => s.serverConfigInit);

  if (!serverConfigInit || hasCustomSiteIdentity)
    return (
      <div className={styles.container}>
        <CircleLoading />
      </div>
    );

  const showDebug = process.env.NODE_ENV === 'development' && debugId;

  return (
    <div className={styles.container}>
      <div aria-label="Loading" className={styles.brand} role="status">
        <BrandLoading size={40} text={Authelia.Color} />
      </div>
      {showDebug && (
        <div className={styles.debug}>
          <div className={styles.debugRow}>
            <code>Debug ID:</code>
            <span className={styles.debugTag}>
              <code>{debugId}</code>
            </span>
          </div>
          <div className={styles.debugHint}>only visible in development</div>
        </div>
      )}
    </div>
  );
};

export default BrandTextLoading;
