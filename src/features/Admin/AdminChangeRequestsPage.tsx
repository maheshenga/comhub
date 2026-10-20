'use client';

import { Flexbox, toast } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminCommercialService } from '@/services/adminCommercial';

import type { AdminDangerousActionEnvelope } from './adminDangerousActions';
import { BulkActionsToolbar } from './ChangeRequests/BulkActionsToolbar';
import { ChangeRequestFilters, CursorPagination } from './ChangeRequests/filterBar';
import { buildChangeRequestColumns, RejectReasonModal } from './ChangeRequests/requestColumns';
import {
  type ChangeRequestStatusFilter,
  formatBulkApproveChangeRequestResult,
  formatBulkRejectChangeRequestResult,
} from './ChangeRequests/shared';
import { AdminPageError, AdminPageShell, AdminSection, AdminToolbar } from './layout';
import { AdminDataTable } from './shared';
import { useAdminCursorQuery } from './shared/useAdminCursorQuery';

type AdminChangeRequestsPageProps = {
  embedded?: boolean;
};

const AdminChangeRequestsPage = memo<AdminChangeRequestsPageProps>(({ embedded = false }) => {
  const { t } = useTranslation('subscription');
  const [status, setStatus] = useState<ChangeRequestStatusFilter>('pending');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reason: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // T1 样板（AdminOrdersPage §useAdminCursorQuery）：手搓 cursorStack（[0] 起）
  // 与 status/userIdFilter 变化重置收编进 primitive；首页 fetch 序列化层保持
  // cursor ?? 0，limit 50 与 status==='all'/userIdFilter 空串映射逐字节不变。
  const crQuery = useAdminCursorQuery<number, { items: any[]; nextCursor: number | null }>({
    key: 'admin-change-requests',
    deps: [status, userIdFilter],
    fetcher: ({ cursor, limit }) =>
      adminCommercialService.listChangeRequests({
        cursor: cursor ?? 0,
        limit,
        status: status === 'all' ? undefined : status,
        userId: userIdFilter || undefined,
      }),
  });
  const { data, error, isLoading, mutate } = crQuery;
  const cursor = crQuery.state.cursor ?? 0;

  // 选中集跨页/改筛选清空是既有行为契约：旧实现依赖 [cursor, status,
  // userIdFilter]（cursorStack 首页值为 0）；迁移后 cursor 取 query.state.cursor
  // ?? 0 同一值域，契约不变。
  useEffect(() => {
    setSelectedIds([]);
  }, [cursor, status, userIdFilter]);

  const items = data?.items ?? [];

  const handleApprove = async (id: string) => {
    setSubmitting(id);
    try {
      await adminCommercialService.approveChangeRequest(id);
      toast.success(t('admin.changeRequests.approveSuccess', '已通过'));
      await mutate();
    } catch {
      toast.error(t('admin.changeRequests.approveFailed', '通过失败'));
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
      toast.success(t('admin.changeRequests.rejectSuccess', '已拒绝'));
      setRejectTarget(null);
      await mutate();
    } catch {
      toast.error(t('admin.changeRequests.rejectFailed', '拒绝失败'));
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

  const formatBulkApprove = (value: unknown) =>
    formatBulkApproveChangeRequestResult(t as any, value);

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
          onStatusChange={setStatus}
          onUserIdFilterChange={setUserIdFilter}
        />
      </AdminToolbar>

      {error ? null : (
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
            carded
            title={t('admin.changeRequests.tableTitle', '套餐变更请求')}
            description={t(
              'admin.changeRequests.tableDescription',
              '只允许对待处理请求执行审批或拒绝，批量操作会要求再次确认。',
            )}
          >
            <AdminDataTable
              columns={columns}
              dataSource={items}
              // 筛选无结果走 SearchX 空态 + 一键清除（原语 adminPageParts §filtered）。
              emptyKind={status === 'all' && !userIdFilter ? 'initial' : 'filtered'}
              isEmpty={!isLoading && items.length === 0}
              loading={isLoading}
              regionLabel={t('admin.changeRequests.tableTitle', '套餐变更请求')}
              rowKey="id"
              rowSelection={{
                getCheckboxProps: (row: any) => ({ disabled: row.status !== 'pending' }),
                onChange: (keys) => setSelectedIds(keys as string[]),
                selectedRowKeys: selectedIds,
              }}
              onClearFilters={() => {
                setStatus('all');
                setUserIdFilter('');
              }}
            />
          </AdminSection>
        </>
      )}

      {(crQuery.hasPrevious || crQuery.hasNext) && (
        <AdminToolbar>
          <CursorPagination
            hasNext={crQuery.hasNext}
            hasPrevious={crQuery.hasPrevious}
            isLoading={isLoading}
            t={t as any}
            onNext={crQuery.pager.onNext}
            onPrevious={crQuery.pager.onPrevious}
          />
        </AdminToolbar>
      )}

      <RejectReasonModal
        rejectTarget={rejectTarget}
        submitting={!!submitting}
        t={t as any}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        onReasonChange={(reason) => setRejectTarget((prev) => (prev ? { ...prev, reason } : prev))}
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
