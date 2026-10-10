'use client';

import { Alert, Button } from '@lobehub/ui/base-ui';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { AdminPageState } from '../shared/AdminPageState';
import { adminPageStyles as styles } from './adminPageStyles';

export type AdminPageWidth = 'full' | 'large' | 'medium' | 'small';

const widthClassName: Record<AdminPageWidth, string> = {
  full: styles.pageFull,
  large: styles.pageLarge,
  medium: styles.pageMedium,
  small: styles.pageSmall,
};

/** Whole-page three-state pass-through (ux-redesign-spec §3.1). */
export interface AdminPageShellStateSlot {
  error?: unknown;
  errorDescription?: ReactNode;
  errorTitle?: ReactNode;
  isEmpty?: boolean;
  loading?: boolean;
  onRetry?: () => void;
}

export interface AdminPageShellProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  footer?: ReactNode;
  /** Group-eyebrow caption above the h1 (spec §3.1); breadcrumb stays layout-owned. */
  kicker?: ReactNode;
  /** Metric band rendered between header and children via AdminMetricStrip. */
  metrics?: AdminMetric[];
  /** Metrics band aria-label; defaults to the contract label 关键指标. */
  metricsLabel?: string;
  state?: AdminPageShellStateSlot;
  title: ReactNode;
  width?: AdminPageWidth;
}

export const AdminPageShell = ({
  actions,
  children,
  className,
  description,
  footer,
  kicker,
  metrics,
  metricsLabel = '关键指标',
  state,
  title,
  width = 'large',
}: AdminPageShellProps) => (
  <main className={[styles.page, widthClassName[width], className].filter(Boolean).join(' ')}>
    <header className={styles.header}>
      <div className={styles.headerText}>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
    {state ? (
      <AdminPageStateBridge
        error={state.error}
        errorDescription={state.errorDescription}
        errorTitle={state.errorTitle}
        isEmpty={state.isEmpty}
        loading={state.loading}
        onRetry={state.onRetry}
      />
    ) : null}
    {metrics && metrics.length > 0 && !(state && (state.loading || state.error)) ? (
      <AdminMetricStrip items={metrics} label={metricsLabel} />
    ) : null}
    {children}
    {footer ? <div className={styles.footerSlot}>{footer}</div> : null}
  </main>
);

export interface AdminSectionProps {
  actions?: ReactNode;
  carded?: boolean;
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}

export const AdminSection = ({ actions, children, description, title, carded }: AdminSectionProps) => (
  <section
    className={[styles.section, carded ? styles.sectionCarded : null].filter(Boolean).join(' ')}
  >
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
  // base-ui Alert renders with role="alert" by default, keeping the
  // AdminPage.test.tsx `getByRole('alert')` anchor intact (`title` is the
  // non-deprecated spelling of the antd `message` prop).
  <Alert
    showIcon
    description={description}
    title={title}
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

/**
 * Bridges the shell `state` slot onto the unified three-state primitive
 * (loading skeleton → error retry → empty). Only rendered when a state object
 * is provided, so existing pages keep byte-identical rendering.
 */const AdminPageStateBridge = ({
  error,
  errorDescription,
  errorTitle,
  isEmpty,
  loading,
  onRetry,
}: AdminPageShellStateSlot) => (
  <AdminPageState
    error={error}
    errorDescription={errorDescription}
    errorTitle={errorTitle}
    isEmpty={Boolean(isEmpty)}
    loading={loading}
    skeletonVariant="list"
    onRetry={onRetry}
  >
    {null}
  </AdminPageState>
);
