'use client';

import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';

import AdminBulkActionFlow from '../AdminBulkActionFlow';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

export const BulkActionsToolbar = ({
  finishBulkAction,
  formatBulkApprove,
  formatBulkReject,
  handleBulkApprove,
  handleBulkReject,
  onClearSelection,
  selectedIds,
  t,
}: {
  finishBulkAction: () => void;
  formatBulkApprove: (value: unknown) => any;
  formatBulkReject: (value: unknown) => any;
  handleBulkApprove: (command: any) => Promise<unknown>;
  handleBulkReject: (command: any) => Promise<unknown>;
  onClearSelection: () => void;
  selectedIds: string[];
  t: TFn;
}) => (
  <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
    <AdminBulkActionFlow
      actionId="subscription.changeRequest.bulkApprove"
      count={selectedIds.length}
      size="small"
      summary={formatBulkApprove}
      type="primary"
      confirmTitle={t(
        'admin.changeRequests.confirmBulkApprove',
        `确认通过 ${selectedIds.length} 个套餐变更请求？`,
      )}
      progressDescription={t(
        'admin.changeRequests.bulkApproveProgress',
        '正在通过选中的套餐变更请求，请勿关闭页面。',
      )}
      onRun={handleBulkApprove}
      onSuccess={finishBulkAction}
    >
      {t('admin.changeRequests.bulkApprove', `批量通过（${selectedIds.length}）`)}
    </AdminBulkActionFlow>
    <AdminBulkActionFlow
      danger
      actionId="subscription.changeRequest.bulkReject"
      count={selectedIds.length}
      size="small"
      summary={formatBulkReject}
      confirmTitle={t(
        'admin.changeRequests.confirmBulkReject',
        `确认拒绝 ${selectedIds.length} 个套餐变更请求？`,
      )}
      progressDescription={t(
        'admin.changeRequests.bulkRejectProgress',
        '正在拒绝选中的套餐变更请求，请勿关闭页面。',
      )}
      onRun={handleBulkReject}
      onSuccess={finishBulkAction}
    >
      {t('admin.changeRequests.bulkReject', `批量拒绝（${selectedIds.length}）`)}
    </AdminBulkActionFlow>
    <Button size="small" onClick={onClearSelection}>
      {t('admin.changeRequests.clearSel', '清空选择')}
    </Button>
  </Flexbox>
);
