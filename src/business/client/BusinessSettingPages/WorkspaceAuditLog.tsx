'use client';

import { type TableColumnType } from 'antd';
import { Alert, Button, DatePicker, Empty, Select, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspace } from '@/business/client/hooks/useActiveWorkspace';
import { Card } from '@/components/antd-compat/Card';
import InlineTable from '@/components/InlineTable';
import { lambdaQuery } from '@/libs/trpc/client';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import { formatBusinessDate, subscriptionPageStyles } from './shared';

type WorkspaceAuditLogRow = {
  action: string;
  createdAt?: Date | string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  resourceId?: string | null;
  resourceType?: string | null;
  userId?: string | null;
};

const AUDIT_ACTIONS = [
  'workspace.created',
  'workspace.updated',
  'workspace.upgraded',
  'workspace.downgraded',
  'workspace.primary_ownership_transferred',
  'workspace.deleted',
  'workspace.cleanup_triggered',
  'workspace.account_upgraded',
  'workspace.data_cleared',
  'workspace.settings_reset',
  'member.invited',
  'member.removed',
  'member.role_updated',
  'member.joined',
  'member.left',
  'member.promoted_to_owner',
  'member.demoted_from_owner',
  'invitation.revoked',
  'invitation.resent',
  'subscription.activated',
  'subscription.updated',
  'subscription.cancelled',
  'subscription.cancellation_scheduled',
  'subscription.cancellation_resumed',
  'subscription.grace_period_started',
  'billing.portal_session_created',
  'billing.payment_method_added',
  'billing.payment_method_removed',
  'billing.default_payment_method_changed',
].map((value) => ({ label: value, value }));

const formatMetadata = (metadata?: Record<string, unknown> | null) => {
  if (!metadata || Object.keys(metadata).length === 0) return '--';

  return JSON.stringify(metadata);
};

const startOfDay = (value?: string) => (value ? dayjs(value).startOf('day').toDate() : undefined);
const endOfDay = (value?: string) => (value ? dayjs(value).endOf('day').toDate() : undefined);

export default function WorkspaceAuditLog() {
  const { t } = useTranslation('setting');
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [rows, setRows] = useState<WorkspaceAuditLogRow[]>([]);
  const [startDate, setStartDate] = useState<string | undefined>();

  useEffect(() => {
    setCursor(undefined);
    setRows([]);
  }, [actionFilter, endDate, startDate, workspaceId]);

  const queryInput = useMemo(
    () => ({
      action: actionFilter,
      cursor: cursor ? new Date(cursor) : undefined,
      endDate: endOfDay(endDate),
      limit: 50,
      startDate: startOfDay(startDate),
      workspaceId: workspaceId ?? '',
    }),
    [actionFilter, cursor, endDate, startDate, workspaceId],
  );

  const { data, error, isFetching, isLoading } = lambdaQuery.workspaceAuditLog.list.useQuery(
    queryInput,
    { enabled: Boolean(workspaceId), refetchOnWindowFocus: false },
  );
  const nextCursor = data?.nextCursor ?? null;

  useEffect(() => {
    if (!data?.items) return;

    setRows((previous) =>
      cursor
        ? [...previous, ...((data.items ?? []) as WorkspaceAuditLogRow[])]
        : ((data.items ?? []) as WorkspaceAuditLogRow[]),
    );
  }, [cursor, data?.items]);

  const columns = useMemo<TableColumnType<any>[]>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => formatBusinessDate(value),
        title: t('workspaceSetting.auditLog.columns.createdAt'),
      },
      {
        dataIndex: 'action',
        key: 'action',
        render: (value) => <Tag>{value}</Tag>,
        title: t('workspaceSetting.auditLog.columns.action'),
      },
      {
        key: 'resource',
        render: (_, record) => record.resourceType || record.resourceId || '--',
        title: t('workspaceSetting.auditLog.columns.resource'),
      },
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (value) => value || '--',
        title: t('workspaceSetting.auditLog.columns.actor'),
      },
      {
        dataIndex: 'metadata',
        key: 'metadata',
        render: (value) => (
          <Typography.Text code style={{ whiteSpace: 'normal' }}>
            {formatMetadata(value)}
          </Typography.Text>
        ),
        title: t('workspaceSetting.auditLog.columns.metadata'),
      },
    ],
    [t],
  );

  const handleClearFilters = () => {
    setActionFilter(undefined);
    setEndDate(undefined);
    setStartDate(undefined);
  };

  const handleLoadMore = () => {
    if (!nextCursor) return;
    setCursor(nextCursor);
  };

  return (
    <div className={subscriptionPageStyles.pageStack}>
      <SettingHeader title={t('workspaceSetting.auditLog.title')} />
      <Typography.Paragraph style={{ margin: 0 }} type="secondary">
        {t('workspaceSetting.auditLog.desc')}
      </Typography.Paragraph>
      {!workspaceId && (
        <Alert
          message={t('workspaceSetting.auditLog.noWorkspace')}
          showIcon
          type={'info'}
        />
      )}
      {error && (
        <Alert
          message={t('workspaceSetting.auditLog.loadError')}
          showIcon
          type={'error'}
        />
      )}
      <Card className={subscriptionPageStyles.formCard} variant={'borderless'}>
        <Space wrap style={{ marginBlockEnd: 16 }}>
          <Select
            allowClear
            onChange={(value) => setActionFilter(value)}
            options={AUDIT_ACTIONS}
            placeholder={t('workspaceSetting.auditLog.filters.action')}
            showSearch
            style={{ minWidth: 280 }}
            value={actionFilter}
          />
          <DatePicker
            onChange={(_, value) => setStartDate(Array.isArray(value) ? value[0] : value)}
            placeholder={t('workspaceSetting.auditLog.filters.startDate')}
            value={startDate ? dayjs(startDate) : null}
          />
          <DatePicker
            onChange={(_, value) => setEndDate(Array.isArray(value) ? value[0] : value)}
            placeholder={t('workspaceSetting.auditLog.filters.endDate')}
            value={endDate ? dayjs(endDate) : null}
          />
          <Button onClick={handleClearFilters}>
            {t('workspaceSetting.auditLog.filters.clear')}
          </Button>
        </Space>
        <InlineTable
          columns={columns}
          dataSource={rows}
          loading={isLoading && rows.length === 0}
          locale={{ emptyText: <Empty description={t('workspaceSetting.auditLog.empty')} /> }}
          rowKey={'id'}
        />
        {nextCursor && (
          <Space style={{ justifyContent: 'center', marginBlockStart: 16, width: '100%' }}>
            <Button loading={isFetching} onClick={handleLoadMore}>
              {t('workspaceSetting.auditLog.loadMore')}
            </Button>
          </Space>
        )}
      </Card>
    </div>
  );
}
