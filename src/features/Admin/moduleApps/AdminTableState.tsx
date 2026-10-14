'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ModulePageState } from './shared/ModulePageState';

const isPermissionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /FORBIDDEN|UNAUTHORIZED|permission denied/i.test(message);
};

export const AdminTableState = ({
  children,
  emptyLabel,
  error,
  loading,
  loadingLabel,
  onRetry,
  retryLabel,
}: {
  children: ReactNode;
  emptyLabel: string;
  error?: unknown;
  loading?: boolean;
  loadingLabel: string;
  onRetry?: () => void;
  retryLabel?: string;
}) => {
  const { t } = useTranslation('common');

  return (
    <ModulePageState
      emptyDescription={emptyLabel}
      error={error}
      isEmpty={!children}
      loading={loading}
      loadingLabel={loadingLabel}
      retryLabel={retryLabel ?? t('moduleApps.admin.center.state.retry')}
      errorTitle={
        error
          ? isPermissionError(error)
            ? t('moduleApps.admin.center.state.permissionDenied')
            : t('moduleApps.admin.center.state.loadErrorTitle')
          : undefined
      }
      onRetry={onRetry}
    >
      {children}
    </ModulePageState>
  );
};
