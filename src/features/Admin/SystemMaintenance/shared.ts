import {
  type MemoryUserMemoryTriggerMode,
  normalizeMemoryUserMemoryTriggerMode,
  normalizeText,
  SETTING_KEYS,
} from '@/features/Admin/adminSettingsForm';

export const memoryTriggerModeOptions = [
  { label: '自动选择', value: 'auto' },
  { label: '直接执行（推荐单机 Node 部署）', value: 'direct' },
  { label: 'QStash 工作流优先（缺失 Token 时回退直接执行）', value: 'workflow' },
] satisfies Array<{ label: string; value: MemoryUserMemoryTriggerMode }>;

export type MaintenanceFormValues = {
  cronAuditRetentionDays: number;
  cronPendingOrderExpiryDays: number;
  cronSecret: string;
  memoryUserMemoryTriggerMode: MemoryUserMemoryTriggerMode;
};

export type MaintenanceResult = {
  auditCutoff?: string;
  auditLogsDeleted?: number;
  freeSnapshotsCreated?: number;
  moduleAppUploadCleanupFailed?: number;
  moduleAppUploadsExpired?: number;
  notificationRetentionCutoff?: string;
  notificationsDeleted?: number;
  pendingOrdersCutoff?: string;
  pendingOrdersExpired?: number;
  subscriptionSnapshotsExpired?: number;
};

export const buildInitialValues = (data: any): MaintenanceFormValues => ({
  cronAuditRetentionDays: data?.cronAuditRetentionDays ?? 365,
  cronPendingOrderExpiryDays: data?.cronPendingOrderExpiryDays ?? 7,
  cronSecret: '',
  memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
    data?.memoryUserMemoryTriggerMode,
  ),
});

export const normalizeValues = (values: MaintenanceFormValues): MaintenanceFormValues => ({
  cronAuditRetentionDays:
    typeof values.cronAuditRetentionDays === 'number' ? values.cronAuditRetentionDays : 365,
  cronPendingOrderExpiryDays:
    typeof values.cronPendingOrderExpiryDays === 'number' ? values.cronPendingOrderExpiryDays : 7,
  cronSecret: normalizeText(values.cronSecret),
  memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
    values.memoryUserMemoryTriggerMode,
  ),
});

export const buildUpdates = (values: MaintenanceFormValues, initial: MaintenanceFormValues) => {
  const current = normalizeValues(values);
  const baseline = normalizeValues(initial);
  const updates: { key: string; value: unknown }[] = [];

  if (current.cronSecret) {
    updates.push({ key: SETTING_KEYS.cronSecret, value: current.cronSecret });
  }

  const fields: Array<keyof MaintenanceFormValues> = [
    'cronAuditRetentionDays',
    'cronPendingOrderExpiryDays',
    'memoryUserMemoryTriggerMode',
  ];

  const keyMap: Record<keyof MaintenanceFormValues, string> = {
    cronAuditRetentionDays: SETTING_KEYS.cronAuditRetentionDays,
    cronPendingOrderExpiryDays: SETTING_KEYS.cronPendingOrderExpiryDays,
    cronSecret: SETTING_KEYS.cronSecret,
    memoryUserMemoryTriggerMode: SETTING_KEYS.memoryUserMemoryTriggerMode,
  };

  for (const field of fields) {
    if (current[field] !== baseline[field]) {
      updates.push({ key: keyMap[field], value: current[field] });
    }
  }

  return updates;
};
