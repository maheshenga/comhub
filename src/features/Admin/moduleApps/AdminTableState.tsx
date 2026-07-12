'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Alert, Button, Empty, Spin, Tooltip } from 'antd';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

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
}: {
  children: ReactNode;
  emptyLabel: string;
  error?: unknown;
  loading?: boolean;
  loadingLabel: string;
  onRetry?: () => void;
}) => {
  if (loading) {
    return (
      <Flexbox align="center" aria-label={loadingLabel} padding={32}>
        <Spin />
      </Flexbox>
    );
  }
  if (error) {
    return (
      <Alert
        showIcon
        message={isPermissionError(error) ? 'Permission denied' : 'Could not load data'}
        type="error"
        action={
          onRetry ? (
            <Tooltip title="Retry">
              <Button
                aria-label="Retry"
                icon={<Icon icon={RefreshCw} size={14} />}
                size="small"
                onClick={onRetry}
              />
            </Tooltip>
          ) : undefined
        }
      />
    );
  }
  if (!children) return <Empty description={emptyLabel} />;
  return children;
};
