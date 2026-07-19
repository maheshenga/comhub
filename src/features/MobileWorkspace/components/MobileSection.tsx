'use client';

import { cx, createStaticStyles } from 'antd-style';
import { type HTMLAttributes, type ReactNode } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  title: css`
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    color: ${cssVar.colorText};
  `,
}));

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface MobileSectionProps extends HTMLAttributes<HTMLElement> {
  action?: ReactNode;
  children: ReactNode;
  headingLevel?: HeadingLevel;
  title: ReactNode;
}

const MobileSection = ({
  action,
  children,
  className,
  headingLevel = 2,
  title,
  ...rest
}: MobileSectionProps) => {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <section {...rest} className={cx(styles.section, className)}>
      <div className={styles.header}>
        <Heading className={styles.title}>{title}</Heading>
        {action}
      </div>
      {children}
    </section>
  );
};

export default MobileSection;
