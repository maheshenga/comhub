'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Input, message, Modal, Select, Tag } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setBulkRunning(true);
    try {
      const res = await adminCommercialService.bulkApproveChangeRequests(selectedIds);
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      message.success(
        t('admin.changeRequests.bulkApproveDone', `已通过 ${ok} 个，失败 ${fail} 个`),
      );
      setSelectedIds([]);
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.bulkFailed', '批量操作失败'));
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
      message.success(t('admin.changeRequests.bulkRejectDone', `已拒绝 ${ok} 个，失败 ${fail} 个`));
      setSelectedIds([]);
      setBulkReason('');
      setBulkRejectOpen(false);
      await mutate();
    } catch {
      message.error(t('admin.changeRequests.bulkFailed', '批量操作失败'));
    } finally {
      setBulkRunning(false);
    }
  };

  const columns = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: Date) => new Date(v).toLocaleString(),
      title: t('admin.changeRequests.col.created', '创建时间'),
      width: 170,
    },
    {
      dataIndex: 'userId',
      key: 'userId',
      render: (v: string) => <code>{v?.slice(0, 8)}</code>,
      title: t('admin.changeRequests.col.user', '用户'),
    },
    {
      dataIndex: 'fromPlan',
      key: 'fromPlan',
      render: (v: string) => <Tag>{v}</Tag>,
      title: t('admin.changeRequests.col.from', '原套餐'),
    },
    {
      dataIndex: 'toPlan',
      key: 'toPlan',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
      title: t('admin.changeRequests.col.to', '目标套餐'),
    },
    {
      dataIndex: 'cycle',
      key: 'cycle',
      title: t('admin.changeRequests.col.cycle', '周期'),
    },
    {
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Tag color={REASON_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.changeRequests.col.reason', '原因'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.changeRequests.col.status', '状态'),
    },
    {
      key: 'actions',
      render: (_: unknown, row: any) =>
        row.status === 'pending' ? (
          <Flexbox horizontal gap={6}>
            <Button
              loading={submitting === row.id}
              size="small"
              type="primary"
              onClick={() => handleApprove(row.id)}
            >
              {t('admin.changeRequests.approve', '通过')}
            </Button>
            <Button
              danger
              loading={submitting === row.id}
              size="small"
              onClick={() => setRejectTarget({ id: row.id, reason: '' })}
            >
              {t('admin.changeRequests.reject', '拒绝')}
            </Button>
          </Flexbox>
        ) : (
          '—'
        ),
      title: t('admin.changeRequests.col.actions', '操作'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" gap={12}>
        <Select<StatusFilter>
          style={{ width: 160 }}
          value={status}
          options={[
            { label: t('admin.changeRequests.status.all', '全部'), value: 'all' },
            { label: t('admin.changeRequests.status.pending', '待处理'), value: 'pending' },
            { label: t('admin.changeRequests.status.completed', '已完成'), value: 'completed' },
            { label: t('admin.changeRequests.status.canceled', '已取消'), value: 'canceled' },
            { label: t('admin.changeRequests.status.rejected', '已拒绝'), value: 'rejected' },
          ]}
          onChange={(v) => {
            setStatus(v);
            setCursor(0);
          }}
        />
        <Input
          allowClear
          placeholder={t('admin.changeRequests.filter.user', '用户 ID')}
          style={{ width: 240 }}
          value={userIdFilter}
          onChange={(e) => {
            setUserIdFilter(e.target.value);
            setCursor(0);
          }}
        />
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.changeRequests.empty', '暂无变更请求')} />
      ) : (
        <>
          {selectedIds.length > 0 && (
            <Flexbox horizontal gap={8}>
              <Button loading={bulkRunning} size="small" type="primary" onClick={handleBulkApprove}>
                {t('admin.changeRequests.bulkApprove', `批量通过（${selectedIds.length}）`)}
              </Button>
              <Button
                danger
                loading={bulkRunning}
                size="small"
                onClick={() => setBulkRejectOpen(true)}
              >
                {t('admin.changeRequests.bulkReject', `批量拒绝（${selectedIds.length}）`)}
              </Button>
              <Button size="small" onClick={() => setSelectedIds([])}>
                {t('admin.changeRequests.clearSel', '清空选择')}
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
            {t('admin.changeRequests.loadMore', '加载更多')}
          </Button>
        </Flexbox>
      )}

      <Modal
        confirmLoading={!!submitting}
        open={!!rejectTarget}
        title={t('admin.changeRequests.rejectTitle', '拒绝变更请求')}
        onCancel={() => setRejectTarget(null)}
        onOk={handleRejectConfirm}
      >
        <Flexbox gap={8}>
          <div>{t('admin.changeRequests.rejectReason', '原因（可选）')}</div>
          <Input.TextArea
            placeholder={t('admin.changeRequests.rejectPlaceholder', '请输入拒绝原因')}
            rows={3}
            value={rejectTarget?.reason ?? ''}
            onChange={(e) =>
              setRejectTarget((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
            }
          />
        </Flexbox>
      </Modal>

      <Modal
        confirmLoading={bulkRunning}
        open={bulkRejectOpen}
        title={t('admin.changeRequests.bulkRejectTitle', '批量拒绝')}
        onCancel={() => setBulkRejectOpen(false)}
        onOk={handleBulkReject}
      >
        <Flexbox gap={8}>
          <div>
            {t('admin.changeRequests.bulkRejectCount', `将拒绝 ${selectedIds.length} 个请求`)}
          </div>
          <Input.TextArea
            placeholder={t('admin.changeRequests.rejectPlaceholder', '请输入拒绝原因')}
            rows={3}
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminChangeRequestsPage.displayName = 'AdminChangeRequestsPage';

export default AdminChangeRequestsPage;
