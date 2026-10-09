'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Modal } from '@lobehub/ui/base-ui';
import { Input, Tag } from 'antd';

import { REASON_COLORS, STATUS_COLORS } from './shared';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export interface BuildChangeRequestColumnsParams {
  handleApprove: (id: string) => void;
  setRejectTarget: (target: { id: string; reason: string }) => void;
  submitting: string | null;
  t: TFn;
}

export const buildChangeRequestColumns = ({
  handleApprove,
  setRejectTarget,
  submitting,
  t,
}: BuildChangeRequestColumnsParams) => [
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (value: Date) => new Date(value).toLocaleString(),
    title: t('admin.changeRequests.col.created', '创建时间'),
    width: 170,
  },
  {
    dataIndex: 'userId',
    key: 'userId',
    render: (value: string) => <code>{value?.slice(0, 8)}</code>,
    title: t('admin.changeRequests.col.user', '用户'),
  },
  {
    dataIndex: 'fromPlan',
    key: 'fromPlan',
    render: (value: string) => <Tag>{value}</Tag>,
    title: t('admin.changeRequests.col.from', '原套餐'),
  },
  {
    dataIndex: 'toPlan',
    key: 'toPlan',
    render: (value: string) => <Tag color="blue">{value}</Tag>,
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
    render: (value: string) => <Tag color={REASON_COLORS[value] ?? 'default'}>{value}</Tag>,
    title: t('admin.changeRequests.col.reason', '原因'),
  },
  {
    dataIndex: 'status',
    key: 'status',
    render: (value: string) => <Tag color={STATUS_COLORS[value] ?? 'default'}>{value}</Tag>,
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
        '-'
      ),
    title: t('admin.changeRequests.col.actions', '操作'),
  },
];

export const RejectReasonModal = ({
  onCancel,
  onConfirm,
  onReasonChange,
  rejectTarget,
  submitting,
  t,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
  rejectTarget: { id: string; reason: string } | null;
  submitting: boolean;
  t: TFn;
}) => (
  <Modal
    confirmLoading={submitting}
    open={!!rejectTarget}
    title={t('admin.changeRequests.rejectTitle', '拒绝变更请求')}
    onCancel={onCancel}
    onOk={onConfirm}
  >
    <Flexbox gap={8}>
      <div>{t('admin.changeRequests.rejectReason', '原因（可选）')}</div>
      <Input.TextArea
        placeholder={t('admin.changeRequests.rejectPlaceholder', '请输入拒绝原因')}
        rows={3}
        value={rejectTarget?.reason ?? ''}
        onChange={(event: { target: { value: string } }) => onReasonChange(event.target.value)}
      />
    </Flexbox>
  </Modal>
);
