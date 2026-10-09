'use client';

import { Flexbox } from '@lobehub/ui';
import { Empty, message } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import type { AdminDangerousActionEnvelope } from './adminDangerousActions';
import { BulkActionsToolbar } from './ChangeRequests/BulkActionsToolbar';
import { ChangeRequestFilters, CursorPagination } from './ChangeRequests/filterBar';
import {
  buildChangeRequestColumns,
  RejectReasonModal,
} from './ChangeRequests/requestColumns';
import {
  type ChangeRequestStatusFilter,
  formatBulkApproveChangeRequestResult,
  formatBulkRejectChangeRequestResult,
} from './ChangeRequests/shared';
import {
  AdminPageError,
  AdminPageShell,
  AdminResponsiveTable,
  AdminSection,
  AdminToolbar,
} from './layout';

type AdminChangeRequestsPageProps = {
  embedded?: boolean;
};

const AdminChangeRequestsPage = memo<AdminChangeRequestsPageProps>(({ embedded = false }) => {
  const { t } = useTranslation('subscription');
  const [status, setStatus] = useState<ChangeRequestStatusFilter>('pending');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [cursorStack, setCursorStack] = useState([0]);
  const cursor = cursorStack.at(-1) ?? 0;
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reason: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const swrKey = useMemo(
    () => ['admin-change-requests', status, userIdFilter, cursor] as const,
    [status, userIdFilter, cursor],
  );

  const { data, error, isLoading, mutate } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listChangeRequests({
      cursor,
      limit: 50,
      status: status === 'all' ? undefined : status,
      userId: userIdFilter || undefined,
    }),
  );

  useEffect(() => {
    setSelectedIds([]);
  }, [cursor, status, userIdFilter]);

  const items = data?.items ?? [];

  const handleApprove = async (id: string) => {
    setSubmitting(id);
    try {
      await adminCommercialService.approveChangeRequest(id);
      message.success(t('admin.changeRequests.approveSuccess', '已通过'));
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.approveFailed', '通过失败'));
    } finally {
      setSubmitting(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    setSubmitting(rejectTarget.id);
    try {
      await adminCommercialService.rejectChangeRequest({
        reason: rejectTarget.reason || undefined,
        requestId: rejectTarget.id,
      });
      message.success(t('admin.changeRequests.rejectSuccess', '已拒绝'));
      setRejectTarget(null);
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.rejectFailed', '拒绝失败'));
    } finally {
      setSubmitting(null);
    }
  };

  const handleBulkApprove = async (
    command: AdminDangerousActionEnvelope<'subscription.changeRequest.bulkApprove'>,
  ) => {
    return adminCommercialService.bulkApproveChangeRequests(selectedIds, command);
  };

  const handleBulkReject = async (
    command: AdminDangerousActionEnvelope<'subscription.changeRequest.bulkReject'>,
  ) => {
    return adminCommercialService.bulkRejectChangeRequests(
      {
        reason: command.reason?.trim() || undefined,
        requestIds: selectedIds,
      },
      command,
    );
  };

  const finishBulkAction = async () => {
    setSelectedIds([]);
    await mutate();
  };

  const formatBulkApprove = (value: unknown) => formatBulkApproveChangeRequestResult(t as any, value);

  const formatBulkReject = (value: unknown) => formatBulkRejectChangeRequestResult(t as any, value);

  const columns = buildChangeRequestColumns({
    handleApprove,
    setRejectTarget,
    submitting,
    t: t as any,
  });

  const content = (
    <Flexbox gap={24}>
      {error ? (
        <AdminPageError
          description={t('admin.changeRequests.loadFailed', '套餐变更请求加载失败，请重试。')}
          onRetry={mutate}
        />
      ) : null}

      <AdminToolbar>
        <ChangeRequestFilters
          status={status}
          t={t as any}
          userIdFilter={userIdFilter}
          onStatusChange={(value) => {
            setStatus(value);
            setCursorStack([0]);
          }}
          onUserIdFilterChange={(value) => {
            setUserIdFilter(value);
            setCursorStack([0]);
          }}
        />
      </AdminToolbar>

      {!error && !isLoading && items.length === 0 ? (
        <Empty description={t('admin.changeRequests.empty', '暂无变更请求')} />
      ) : (
        <>
          {selectedIds.length > 0 && (
            <AdminToolbar>
              <BulkActionsToolbar
                finishBulkAction={finishBulkAction}
                formatBulkApprove={formatBulkApprove}
                formatBulkReject={formatBulkReject}
                handleBulkApprove={handleBulkApprove}
                handleBulkReject={handleBulkReject}
                selectedIds={selectedIds}
                t={t as any}
                onClearSelection={() => setSelectedIds([])}
              />
            </AdminToolbar>
          )}
          <AdminSection
            title={t('admin.changeRequests.tableTitle', '套餐变更请求')}
            description={t(
              'admin.changeRequests.tableDescription',
              '只允许对待处理请求执行审批或拒绝，批量操作会要求再次确认。',
            )}
          >
            <AdminResponsiveTable label="套餐变更请求表格">
              <InlineTable
                columns={columns}
                dataSource={items}
                loading={isLoading}
                rowKey="id"
                rowSelection={{
                  getCheckboxProps: (row: any) => ({ disabled: row.status !== 'pending' }),
                  onChange: (keys) => setSelectedIds(keys as string[]),
                  selectedRowKeys: selectedIds,
                }}
              />
            </AdminResponsiveTable>
          </AdminSection>
        </>
      )}

      {(cursorStack.length > 1 || data?.nextCursor != null) && (
        <AdminToolbar>
          <CursorPagination
            cursorStack={cursorStack}
            isLoading={isLoading}
            t={t as any}
            onNext={() => setCursorStack((current) => [...current, data!.nextCursor!])}
            onPrevious={() =>
              setCursorStack((current) => (current.length > 1 ? current.slice(0, -1) : current))
            }
          />
        </AdminToolbar>
      )}

      <RejectReasonModal
        rejectTarget={rejectTarget}
        submitting={!!submitting}
        t={t as any}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        onReasonChange={(reason) =>
          setRejectTarget((prev) => (prev ? { ...prev, reason } : prev))
        }
      />
    </Flexbox>
  );

  return embedded ? (
    content
  ) : (
    <AdminPageShell
      description={t('admin.changeRequests.subtitle', '集中处理套餐升级、降级和周期变更请求。')}
      title={t('admin.changeRequests.title', '套餐变更请求')}
      width="full"
    >
      {content}
    </AdminPageShell>
  );
});

AdminChangeRequestsPage.displayName = 'AdminChangeRequestsPage';

export default AdminChangeRequestsPage;
