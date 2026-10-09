'use client';

import { Descriptions, Modal } from 'antd';
import { useTranslation } from 'react-i18next';

import type { MaintenanceResult } from './shared';

const RunResultModal = ({ runResult, onClose }: { runResult: MaintenanceResult | null; onClose: () => void }) => {
  const { t } = useTranslation('subscription');

  return (
      <Modal
        footer={null}
        open={!!runResult}
        title={t('admin.maintenance.runResult', '维护结果')}
        onCancel={onClose}
      >
        <Descriptions
          column={1}
          size="small"
          items={[
            { children: runResult?.auditLogsDeleted ?? 0, label: '已删除审计日志' },
            { children: runResult?.auditCutoff ?? '-', label: '审计日志清理时间点' },
            { children: runResult?.pendingOrdersExpired ?? 0, label: '已过期待支付订单' },
            { children: runResult?.pendingOrdersCutoff ?? '-', label: '待支付订单过期时间点' },
            { children: runResult?.notificationsDeleted ?? 0, label: '已删除归档通知' },
            {
              children: runResult?.notificationRetentionCutoff ?? '-',
              label: '归档通知清理时间点',
            },
            { children: runResult?.subscriptionSnapshotsExpired ?? 0, label: '已过期订阅快照' },
            { children: runResult?.freeSnapshotsCreated ?? 0, label: '已补充免费套餐' },
            { children: runResult?.moduleAppUploadsExpired ?? 0, label: '已清理模块应用上传' },
            {
              children: runResult?.moduleAppUploadCleanupFailed ?? 0,
              label: '模块应用上传清理失败',
            },
          ]}
        />
      </Modal>
  );
};

RunResultModal.displayName = 'RunResultModal';

export default RunResultModal;
