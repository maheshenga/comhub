'use client';

import { Button } from '@lobehub/ui/base-ui';
import { Alert } from 'antd';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { adminPageStyles as styles } from './adminPageStyles';

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

export interface AdminFormGridProps {
  children: ReactNode;
  columns?: 2 | 3;
  label?: string;
}

export const AdminFormGrid = ({
  children,
  columns = 2,
  label = '表单字段',
}: AdminFormGridProps) => (
  <div
    aria-label={label}
    role="group"
    className={[styles.formGrid, columns === 3 ? styles.formGridThree : styles.formGridTwo].join(
      ' ',
    )}
  >
    {children}
  </div>
);

export interface AdminFormActionsProps {
  children: ReactNode;
  label?: string;
}

export const AdminFormActions = ({ children, label = '表单操作' }: AdminFormActionsProps) => (
  <div aria-label={label} className={styles.formActions} role="toolbar">
    {children}
  </div>
);

export interface AdminPageErrorProps {
  description?: ReactNode;
  onRetry: () => Promise<unknown> | unknown;
  retryLabel?: string;
  title?: ReactNode;
}

export const AdminPageError = ({
  description,
  onRetry,
  retryLabel = '重试',
  title = '数据加载失败',
}: AdminPageErrorProps) => (
  <Alert
    showIcon
    description={description}
    message={title}
    type="error"
    action={
      <Button size="small" onClick={() => void onRetry()}>
        <RefreshCw aria-hidden size={14} />
        {retryLabel}
      </Button>
    }
  />
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
