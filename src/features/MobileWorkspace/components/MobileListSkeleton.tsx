'use client';

import { createStaticStyles } from 'antd-style';

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: ${cssVar.colorFillTertiary};
  `,
  body: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  `,
  line: css`
    height: 14px;
    border-radius: 4px;
    background: ${cssVar.colorFillTertiary};
  `,
  row: css`
    display: flex;
    gap: 12px;
    align-items: center;
    min-height: 64px;
    padding-block: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  trailing: css`
    flex: 0 0 20px;
    width: 20px;
    height: 14px;
    border-radius: 4px;
    background: ${cssVar.colorFillTertiary};
  `,
}));

interface MobileListSkeletonProps {
  label?: string;
  rows?: number;
}

const MobileListSkeleton = ({ label = 'Loading', rows = 4 }: MobileListSkeletonProps) => {
  const rowCount = Math.max(0, Math.trunc(rows));

  return (
    <div aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rowCount }, (_, index) => (
        <div
          aria-hidden="true"
          className={styles.row}
          data-testid="mobile-list-skeleton-row"
          key={index}
        >
          <div className={styles.avatar} />
          <div className={styles.body}>
            <div className={styles.line} style={{ width: index === rowCount - 1 ? '56%' : '72%' }} />
            <div className={styles.line} style={{ width: '40%' }} />
          </div>
          <div className={styles.trailing} />
        </div>
      ))}
    </div>
  );
};

export default MobileListSkeleton;
