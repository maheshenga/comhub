'use client';

import { Button, Empty, Input, Modal, Select, Tag, message } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type StatusFilter = 'all' | 'pending' | 'completed' | 'canceled' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  canceled: 'default',
  completed: 'success',
  pending: 'processing',
  rejected: 'error',
};

const REASON_COLORS: Record<string, string> = {
  cycle_change: 'cyan',
  downgrade: 'orange',
  upgrade: 'gold',
};

const AdminChangeRequestsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [cursor, setCursor] = useState(0);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reason: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);

  const swrKey = useMemo(
    () => ['admin-change-requests', status, userIdFilter, cursor] as const,
    [status, userIdFilter, cursor],
  );

  const { data, isLoading, mutate } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listChangeRequests({
      cursor,
      limit: 50,
      status: status === 'all' ? undefined : status,
      userId: userIdFilter || undefined,
    }),
  );

  const items = data?.items ?? [];

  const handleApprove = async (id: string) => {
    setSubmitting(id);
    try {
      await adminCommercialService.approveChangeRequest(id);
      message.success(t('admin.changeRequests.approveSuccess', 'Approved'));
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.approveFailed', 'Approve failed'));
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
      message.success(t('admin.changeRequests.rejectSuccess', 'Rejected'));
      setRejectTarget(null);
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.rejectFailed', 'Reject failed'));
    } finally {
      setSubmitting(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setBulkRunning(true);
    try {
      const res = await adminCommercialService.bulkApproveChangeRequests(selectedIds);
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      message.success(
        t('admin.changeRequests.bulkApproveDone', `Approved ${ok}, failed ${fail}`),
      );
      setSelectedIds([]);
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.bulkFailed', 'Bulk action failed'));
    } finally {
      setBulkRunning(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    setBulkRunning(true);
    try {
      const res = await adminCommercialService.bulkRejectChangeRequests({
        reason: bulkReason || undefined,
        requestIds: selectedIds,
      });
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      message.success(t('admin.changeRequests.bulkRejectDone', `Rejected ${ok}, failed ${fail}`));
      setSelectedIds([]);
      setBulkReason('');
      setBulkRejectOpen(false);
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.bulkFailed', 'Bulk action failed'));
    } finally {
      setBulkRunning(false);
    }
  };

  const columns = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: Date) => new Date(v).toLocaleString(),
      title: t('admin.changeRequests.col.created', 'Created'),
      width: 170,
    },
    {
      dataIndex: 'userId',
      key: 'userId',
      render: (v: string) => <code>{v?.slice(0, 8)}</code>,
      title: t('admin.changeRequests.col.user', 'User'),
    },
    {
      dataIndex: 'fromPlan',
      key: 'fromPlan',
      render: (v: string) => <Tag>{v}</Tag>,
      title: t('admin.changeRequests.col.from', 'From'),
    },
    {
      dataIndex: 'toPlan',
      key: 'toPlan',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
      title: t('admin.changeRequests.col.to', 'To'),
    },
    {
      dataIndex: 'cycle',
      key: 'cycle',
      title: t('admin.changeRequests.col.cycle', 'Cycle'),
    },
    {
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Tag color={REASON_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.changeRequests.col.reason', 'Reason'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.changeRequests.col.status', 'Status'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: any) =>
        row.status === 'pending' ? (
          <Flexbox gap={6} horizontal>
            <Button
              loading={submitting === row.id}
              onClick={() => handleApprove(row.id)}
              size="small"
              type="primary"
            >
              {t('admin.changeRequests.approve', 'Approve')}
            </Button>
            <Button
              danger
              loading={submitting === row.id}
              onClick={() => setRejectTarget({ id: row.id, reason: '' })}
              size="small"
            >
              {t('admin.changeRequests.reject', 'Reject')}
            </Button>
          </Flexbox>
        ) : (
          '—'
        ),
      title: t('admin.changeRequests.col.actions', 'Actions'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox align="center" gap={12} horizontal>
        <Select<StatusFilter>
          onChange={(v) => {
            setStatus(v);
            setCursor(0);
          }}
          options={[
            { label: t('admin.changeRequests.status.all', 'All'), value: 'all' },
            { label: t('admin.changeRequests.status.pending', 'Pending'), value: 'pending' },
            { label: t('admin.changeRequests.status.completed', 'Completed'), value: 'completed' },
            { label: t('admin.changeRequests.status.canceled', 'Canceled'), value: 'canceled' },
            { label: t('admin.changeRequests.status.rejected', 'Rejected'), value: 'rejected' },
          ]}
          style={{ width: 160 }}
          value={status}
        />
        <Input
          allowClear
          onChange={(e) => {
            setUserIdFilter(e.target.value);
            setCursor(0);
          }}
          placeholder={t('admin.changeRequests.filter.user', 'User ID')}
          style={{ width: 240 }}
          value={userIdFilter}
        />
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.changeRequests.empty', 'No change requests')} />
      ) : (
        <>
          {selectedIds.length > 0 && (
            <Flexbox gap={8} horizontal>
              <Button
                loading={bulkRunning}
                onClick={handleBulkApprove}
                size="small"
                type="primary"
              >
                {t('admin.changeRequests.bulkApprove', `Approve (${selectedIds.length})`)}
              </Button>
              <Button
                danger
                loading={bulkRunning}
                onClick={() => setBulkRejectOpen(true)}
                size="small"
              >
                {t('admin.changeRequests.bulkReject', `Reject (${selectedIds.length})`)}
              </Button>
              <Button onClick={() => setSelectedIds([])} size="small">
                {t('admin.changeRequests.clearSel', 'Clear')}
              </Button>
            </Flexbox>
          )}
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
        </>
      )}

      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
            {t('admin.changeRequests.loadMore', 'Load More')}
          </Button>
        </Flexbox>
      )}

      <Modal
        confirmLoading={!!submitting}
        onCancel={() => setRejectTarget(null)}
        onOk={handleRejectConfirm}
        open={!!rejectTarget}
        title={t('admin.changeRequests.rejectTitle', 'Reject Change Request')}
      >
        <Flexbox gap={8}>
          <div>{t('admin.changeRequests.rejectReason', 'Reason (optional)')}</div>
          <Input.TextArea
            onChange={(e) =>
              setRejectTarget((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
            }
            placeholder={t('admin.changeRequests.rejectPlaceholder', 'Why is this rejected?')}
            rows={3}
            value={rejectTarget?.reason ?? ''}
          />
        </Flexbox>
      </Modal>

      <Modal
        confirmLoading={bulkRunning}
        onCancel={() => setBulkRejectOpen(false)}
        onOk={handleBulkReject}
        open={bulkRejectOpen}
        title={t('admin.changeRequests.bulkRejectTitle', 'Bulk Reject')}
      >
        <Flexbox gap={8}>
          <div>
            {t('admin.changeRequests.bulkRejectCount', `Reject ${selectedIds.length} requests`)}
          </div>
          <Input.TextArea
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder={t('admin.changeRequests.rejectPlaceholder', 'Why is this rejected?')}
            rows={3}
            value={bulkReason}
          />
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminChangeRequestsPage.displayName = 'AdminChangeRequestsPage';

export default AdminChangeRequestsPage;
