'use client';

import { createStaticStyles } from 'antd-style';
import type { ReactNode } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    @media (width < 640px) {
      justify-content: flex-start;
      width: 100%;
    }
  `,
  description: css`
    max-width: 760px;
    margin: 0;

    font-size: ${cssVar.fontSize};
    line-height: ${cssVar.lineHeight};
    color: ${cssVar.colorTextSecondary};
  `,
  header: css`
    display: flex;
    gap: 20px;
    align-items: flex-start;
    justify-content: space-between;

    @media (width < 640px) {
      flex-direction: column;
      gap: 12px;
    }
  `,
  headerText: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,
  metric: css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px 12px;
    align-content: center;

    box-sizing: border-box;
    min-width: 0;
    min-height: 104px;
    padding: 16px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};

    &:first-of-type {
      border-inline-start: 0;
    }

    @media (width < 900px) {
      &:nth-of-type(odd) {
        border-inline-start: 0;
      }

      &:nth-of-type(n + 3) {
        border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      }
    }

    @media (width < 560px) {
      min-height: 92px;
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      border-inline-start: 0;

      &:first-of-type {
        border-block-start: 0;
      }
    }
  `,
  metricHint: css`
    overflow: hidden;

    font-size: ${cssVar.fontSizeSM};
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  metricIcon: css`
    display: grid;
    grid-row: 1 / span 3;
    place-items: center;

    width: 32px;
    height: 32px;
    border-radius: ${cssVar.borderRadiusSM};

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillSecondary};
  `,
  metricLabel: css`
    font-size: ${cssVar.fontSizeSM};
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextSecondary};
  `,
  metrics: css`
    overflow: hidden;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-block: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 900px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width < 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  metricValue: css`
    overflow: hidden;

    font-family: ${cssVar.fontFamilyCode};
    font-size: ${cssVar.fontSizeXL};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 28px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  page: css`
    display: flex;
    flex-direction: column;
    gap: 24px;

    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    margin-inline: auto;
    padding: 24px;

    @media (width < 640px) {
      gap: 20px;
      padding: 16px;
    }
  `,
  pageFull: css`
    max-width: none;
  `,
  pageLarge: css`
    max-width: 1280px;
  `,
  pageMedium: css`
    max-width: 1040px;
  `,
  pageSmall: css`
    max-width: 800px;
  `,
  responsiveTable: css`
    scrollbar-gutter: stable;

    overflow-x: auto;
    overscroll-behavior-inline: contain;

    width: 100%;
    min-width: 0;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  `,
  sectionDescription: css`
    margin-block: 2px 0;
    margin-inline: 0;

    font-size: ${cssVar.fontSize};
    line-height: ${cssVar.lineHeight};
    color: ${cssVar.colorTextSecondary};
  `,
  sectionHeader: css`
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;

    padding-block-end: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (width < 640px) {
      flex-direction: column;
      gap: 10px;
    }
  `,
  sectionTitle: css`
    margin: 0;

    font-size: ${cssVar.fontSizeLG};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 24px;
    color: ${cssVar.colorText};
  `,
  title: css`
    margin: 0;

    font-size: ${cssVar.fontSizeHeading3};
    font-weight: ${cssVar.fontWeightStrong};
    line-height: 32px;
    color: ${cssVar.colorText};
    letter-spacing: 0;

    @media (width < 640px) {
      font-size: ${cssVar.fontSizeHeading4};
      line-height: 28px;
    }
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    min-height: 44px;
    padding-block: 8px;
    border-block: 1px solid ${cssVar.colorBorderSecondary};
  `,
  toolbarSticky: css`
    position: sticky;
    z-index: 5;
    inset-block-start: 0;

    background: color-mix(in srgb, ${cssVar.colorBgLayout} 92%, transparent);
    backdrop-filter: blur(12px);
  `,
}));

export type AdminPageWidth = 'full' | 'large' | 'medium' | 'small';

const widthClassName: Record<AdminPageWidth, string> = {
  full: styles.pageFull,
  large: styles.pageLarge,
  medium: styles.pageMedium,
  small: styles.pageSmall,
};

export interface AdminPageShellProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
  width?: AdminPageWidth;
}

export const AdminPageShell = ({
  actions,
  children,
  className,
  description,
  title,
  width = 'large',
}: AdminPageShellProps) => (
  <main className={[styles.page, widthClassName[width], className].filter(Boolean).join(' ')}>
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
    {children}
  </main>
);

export interface AdminSectionProps {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}

export const AdminSection = ({ actions, children, description, title }: AdminSectionProps) => (
  <section className={styles.section}>
    {title ? (
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
    ) : null}
    {children}
  </section>
);

export interface AdminToolbarProps {
  children: ReactNode;
  sticky?: boolean;
}

export const AdminToolbar = ({ children, sticky }: AdminToolbarProps) => (
  <div
    className={[styles.toolbar, sticky && styles.toolbarSticky].filter(Boolean).join(' ')}
    role="toolbar"
  >
    {children}
  </div>
);

export type AdminMetric = {
  hint?: ReactNode;
  icon?: ReactNode;
  key: string;
  label: ReactNode;
  value: ReactNode;
};

export const AdminMetricStrip = ({ items, label }: { items: AdminMetric[]; label: string }) => (
  <section aria-label={label} className={styles.metrics}>
    {items.map((item) => (
      <div className={styles.metric} key={item.key}>
        {item.icon ? <span className={styles.metricIcon}>{item.icon}</span> : null}
        <span className={styles.metricLabel}>{item.label}</span>
        <strong className={styles.metricValue}>{item.value}</strong>
        {item.hint ? <span className={styles.metricHint}>{item.hint}</span> : null}
      </div>
    ))}
  </section>
);

export const AdminResponsiveTable = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <div aria-label={label} className={styles.responsiveTable} role="region" tabIndex={0}>
    {children}
  </div>
);
