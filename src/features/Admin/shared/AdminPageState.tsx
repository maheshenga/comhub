'use client';

import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { AlertTriangle, FilterX, Inbox, RefreshCw, SearchX } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  `,
  description: css`
    max-width: 440px;
    margin: 0;

    font-size: 14px;
    line-height: 22px;
    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
  icon: css`
    color: ${cssVar.colorTextTertiary};
  `,
  line: css`
    height: 14px;
    border-radius: ${cssVar.borderRadiusSM};
    background: ${cssVar.colorFillSecondary};
  `,
  list: css`
    display: grid;
    gap: 8px;
    min-height: 320px;
  `,
  listRow: css`
    display: grid;
    grid-template-columns: minmax(140px, 2fr) minmax(80px, 1fr) 96px;
    gap: 16px;
    align-items: center;

    box-sizing: border-box;
    min-height: 48px;
    padding-block: 10px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  skeleton: css`
    width: 100%;
    padding: 16px;
  `,
  state: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;

    box-sizing: border-box;
    min-height: 280px;
    padding-block: 32px;
    padding-inline: 20px;
  `,
  title: css`
    margin: 0;

    font-size: 18px;
    font-weight: 600;
    line-height: 26px;
    color: ${cssVar.colorText};
    text-align: center;
  `,
}));

export type AdminPageStateAction = {
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
};

export interface AdminPageStateProps {
  children: ReactNode;
  emptyDescription?: ReactNode;
  /** `'filtered'` swaps the icon and defaults for a cleared-filter empty state. */
  emptyKind?: 'filtered' | 'initial';
  emptyTitle?: ReactNode;
  /**
   * Truthy error renders the error state. The blueprint mandates that every
   * `useClientDataSWR` in the Admin domain destructures `error` and feeds it
   * here (or to `AdminDataTable.error`) — the silent-drop shape is banned.
   */
  error?: unknown;
  errorDescription?: ReactNode;
  errorTitle?: ReactNode;
  isEmpty?: boolean;
  loading?: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
  /** Primary action as a config object (rendered as a primary Button). */
  primaryAction?: AdminPageStateAction;
  retryLabel?: ReactNode;
  skeletonVariant?: 'detail' | 'list';
}

const AdminListSkeleton = ({ label }: { label: string }) => (
  <section
    aria-busy="true"
    aria-label={label}
    className={styles.skeleton}
    data-testid="admin-list-skeleton"
  >
    <div className={styles.list}>
      {Array.from({ length: 6 }, (_, index) => (
        <div className={styles.listRow} key={index}>
          <div className={styles.line} />
          <div className={styles.line} />
          <div className={styles.line} />
        </div>
      ))}
    </div>
  </section>
);

/**
 * Unified three-state primitive for Admin pages (blueprint §4.2-3). One
 * component renders the loading skeleton, the error retry state and the
 * empty/filtered-empty state; children pass through when none applies.
 * Successor of AdminPageError (error-only) and ModulePageState (moduleApps).
 */
export const AdminPageState = ({
  children,
  emptyDescription,
  emptyKind = 'initial',
  emptyTitle,
  error,
  errorDescription,
  errorTitle,
  isEmpty,
  loading,
  onClearFilters,
  onRetry,
  primaryAction,
  retryLabel,
  skeletonVariant = 'list',
}: AdminPageStateProps) => {
  const { t } = useTranslation('common');
  const translate = (key: string, fallback: string) => t(key, fallback) || fallback;

  if (loading) {
    return skeletonVariant === 'detail' ? (
      <section
        aria-busy="true"
        aria-label={translate('admin.shared.state.loading', '数据加载中')}
        className={styles.skeleton}
        data-testid="admin-detail-skeleton"
      >
        <div className={styles.list}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className={styles.listRow} key={index}>
              <div className={styles.line} style={{ maxWidth: 260 }} />
              <div className={styles.line} style={{ maxWidth: 420 }} />
              <div className={styles.line} />
            </div>
          ))}
        </div>
      </section>
    ) : (
      <AdminListSkeleton label={translate('admin.shared.state.loading', '数据加载中')} />
    );
  }

  if (error) {
    return (
      <section className={styles.state} data-testid="admin-error-state">
        <AlertTriangle aria-hidden className={styles.icon} size={32} />
        <h2 className={styles.title}>
          {errorTitle ?? translate('admin.shared.state.loadErrorTitle', '数据加载失败')}
        </h2>
        <p className={styles.description}>
          {errorDescription ??
            translate(
              'admin.shared.state.loadErrorDescription',
              '请重试，若持续失败请联系管理员。',
            )}
        </p>
        {onRetry ? (
          <Button htmlType="button" onClick={onRetry}>
            <RefreshCw aria-hidden size={16} />
            {retryLabel ?? translate('admin.shared.state.retry', '重试')}
          </Button>
        ) : null}
      </section>
    );
  }

  if (isEmpty) {
    const filtered = emptyKind === 'filtered';

    return (
      <section className={styles.state} data-testid={`admin-empty-${emptyKind}`}>
        {filtered ? (
          <SearchX aria-hidden className={styles.icon} size={32} />
        ) : (
          <Inbox aria-hidden className={styles.icon} size={32} />
        )}
        <h2 className={styles.title}>
          {emptyTitle ??
            translate(
              filtered
                ? 'admin.shared.state.emptyFilteredTitle'
                : 'admin.shared.state.emptyInitialTitle',
              filtered ? '没有符合条件的结果' : '暂无数据',
            )}
        </h2>
        <p className={styles.description}>
          {emptyDescription ??
            translate(
              filtered
                ? 'admin.shared.state.emptyFilteredDescription'
                : 'admin.shared.state.emptyInitialDescription',
              filtered ? '调整或清除筛选条件后重试。' : '当前还没有任何数据。',
            )}
        </p>
        {primaryAction || (filtered && onClearFilters) ? (
          <div className={styles.actions}>
            {primaryAction ? (
              <Button
                disabled={primaryAction.disabled}
                htmlType="button"
                type="primary"
                onClick={primaryAction.onClick}
              >
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
            ) : null}
            {filtered && onClearFilters ? (
              <Button htmlType="button" onClick={onClearFilters}>
                <FilterX aria-hidden size={16} />
                {translate('admin.shared.state.clearFilters', '清除筛选')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return children;
};

/**
 * Compact error banner — the drop-in replacement for the AdminPageError shape
 * (inline Alert + retry) used by page containers that handle loading/empty
 * themselves and only need the error branch.
 */
export const AdminPageError = ({
  description,
  onRetry,
  retryLabel,
  title,
}: {
  description?: ReactNode;
  onRetry: () => Promise<unknown> | unknown;
  retryLabel?: ReactNode;
  title?: ReactNode;
}) => (
  <AdminPageState
    error={true}
    errorDescription={description}
    errorTitle={title}
    isEmpty={false}
    retryLabel={retryLabel}
    onRetry={() => void onRetry()}
  >
    {null}
  </AdminPageState>
);

export default AdminPageState;
