'use client';

import { BrandLoading, LobeHubText } from '@lobehub/ui/brand';

import { isCustomBranding } from '@/const/version';
import { useBrand } from '@/features/Brand';

import CircleLoading from '../CircleLoading';
import styles from './index.module.css';

interface BrandTextLoadingProps {
  debugId: string;
}

const BrandTextLoading = ({ debugId }: BrandTextLoadingProps) => {
  const brand = useBrand();

  if (isCustomBranding)
    return (
      <div className={styles.container}>
        <CircleLoading />
      </div>
    );

  const showDebug = process.env.NODE_ENV === 'development' && debugId;

  return (
    <div className={styles.container}>
      <div aria-label="Loading" className={styles.brand} role="status">
        {brand.name && brand.name !== 'LobeHub' ? (
          <span className={styles.name}>{brand.name}</span>
        ) : (
          <BrandLoading size={40} text={LobeHubText} />
        )}
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
