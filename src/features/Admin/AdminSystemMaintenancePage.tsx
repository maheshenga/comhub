'use client';

import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { ADMIN_SETTINGS_SWR_KEY } from '@/const/adminCacheKeys';
import {
  type MemoryUserMemoryTriggerMode,
  normalizeMemoryUserMemoryTriggerMode,
  normalizeText,
  SETTING_KEYS,
} from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const memoryTriggerModeOptions = [
  { label: '自动选择', value: 'auto' },
  { label: '直接执行（推荐单机 Node 部署）', value: 'direct' },
  { label: 'QStash 工作流优先（缺失 Token 时回退直接执行）', value: 'workflow' },
] satisfies Array<{ label: string; value: MemoryUserMemoryTriggerMode }>;

type MaintenanceFormValues = {
  cronAuditRetentionDays: number;
  cronPendingOrderExpiryDays: number;
  cronSecret: string;
  memoryUserMemoryTriggerMode: MemoryUserMemoryTriggerMode;
  notificationRetentionDays: number;
};

type MaintenanceResult = {
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

const buildInitialValues = (data: any): MaintenanceFormValues => ({
  cronAuditRetentionDays: data?.cronAuditRetentionDays ?? 365,
  cronPendingOrderExpiryDays: data?.cronPendingOrderExpiryDays ?? 7,
  cronSecret: '',
  memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
    data?.memoryUserMemoryTriggerMode,
  ),
  notificationRetentionDays: data?.notificationRetentionDays ?? 90,
});

const normalizeValues = (values: MaintenanceFormValues): MaintenanceFormValues => ({
  cronAuditRetentionDays:
    typeof values.cronAuditRetentionDays === 'number' ? values.cronAuditRetentionDays : 365,
  cronPendingOrderExpiryDays:
    typeof values.cronPendingOrderExpiryDays === 'number' ? values.cronPendingOrderExpiryDays : 7,
  cronSecret: normalizeText(values.cronSecret),
  memoryUserMemoryTriggerMode: normalizeMemoryUserMemoryTriggerMode(
    values.memoryUserMemoryTriggerMode,
  ),
  notificationRetentionDays:
    typeof values.notificationRetentionDays === 'number' ? values.notificationRetentionDays : 90,
});

const buildUpdates = (values: MaintenanceFormValues, initial: MaintenanceFormValues) => {
  const current = normalizeValues(values);
  const baseline = normalizeValues(initial);
  const updates: { key: string; value: unknown }[] = [];

  if (current.cronSecret) {
    updates.push({ key: SETTING_KEYS.cronSecret, value: current.cronSecret });
  }

  const fields: Array<keyof MaintenanceFormValues> = [
    'cronAuditRetentionDays',
    'cronPendingOrderExpiryDays',
    'notificationRetentionDays',
    'memoryUserMemoryTriggerMode',
  ];

  const keyMap: Record<keyof MaintenanceFormValues, string> = {
    cronAuditRetentionDays: SETTING_KEYS.cronAuditRetentionDays,
    cronPendingOrderExpiryDays: SETTING_KEYS.cronPendingOrderExpiryDays,
    cronSecret: SETTING_KEYS.cronSecret,
    memoryUserMemoryTriggerMode: SETTING_KEYS.memoryUserMemoryTriggerMode,
    notificationRetentionDays: SETTING_KEYS.notificationRetentionDays,
  };

  for (const field of fields) {
    if (current[field] !== baseline[field]) {
      updates.push({ key: keyMap[field], value: current[field] });
    }
  }

  return updates;
};

const AdminSystemMaintenancePage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm<MaintenanceFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [refreshingCaches, setRefreshingCaches] = useState(false);
  const [runResult, setRunResult] = useState<MaintenanceResult | null>(null);

  const initialValues = useMemo(() => buildInitialValues(data), [data]);

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(buildInitialValues(data));
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates = buildUpdates(values, initialValues);

      if (updates.length === 0) {
        message.info(t('admin.maintenance.noChanges', '没有需要保存的变更'));
        return;
      }

      setSubmitting(true);
      await adminCommercialService.setAppSettingsBatch({ updates });
      form.setFieldValue('cronSecret', '');
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      message.success(t('admin.maintenance.saveSuccess', '系统维护设置已保存'));
    } catch {
      message.error(t('admin.maintenance.saveFailed', '保存失败，请检查维护配置'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await adminCommercialService.runMaintenance();
      setRunResult(result);
      message.success(t('admin.maintenance.runSuccess', '维护任务已执行'));
    } catch {
      message.error(t('admin.maintenance.runFailed', '维护任务执行失败'));
    } finally {
      setRunning(false);
    }
  };

  const handleRefreshRuntimeCaches = async () => {
    setRefreshingCaches(true);
    try {
      const result = await adminCommercialService.refreshRuntimeCaches();
      message.success(
        t('admin.maintenance.refreshCachesSuccess', '已刷新 {{count}} 类运行时缓存', {
          count: result.refreshed.length,
        }),
      );
    } catch {
      message.error(t('admin.maintenance.refreshCachesFailed', '刷新运行时缓存失败'));
    } finally {
      setRefreshingCaches(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 820 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.maintenance.title', '系统维护')}
        </Title>
        <Text type="secondary">
          {t(
            'admin.maintenance.subtitle',
            '统一管理后台维护任务、数据保留策略和记忆分析任务执行方式。',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        type="info"
        message={t(
          'admin.maintenance.help',
          '维护任务会清理过期审计日志、过期待支付订单和已归档通知；立即执行会使用当前已保存配置。',
        )}
      />

      <Form disabled={isLoading} form={form} initialValues={initialValues} layout="vertical">
        <Card title={t('admin.maintenance.cronSection', '定时维护')}>
          <Form.Item
            extra={
              data?.cronSecretConfigured
                ? `${t('admin.maintenance.current', '当前值')}: ${data.cronSecretMasked}`
                : t('admin.maintenance.notSet', '未配置')
            }
            label={t('admin.maintenance.cronSecret', 'Cron Bearer 密钥')}
            name="cronSecret"
          >
            <Input.Password placeholder={t('admin.maintenance.leaveBlank', '留空则保持当前值')} />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.maintenance.auditRetentionHelp',
              '超过该天数的后台审计日志会被删除，范围 7-3650 天。',
            )}
            label={t('admin.maintenance.auditRetention', '审计日志保留天数')}
            name="cronAuditRetentionDays"
          >
            <InputNumber max={3650} min={7} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.maintenance.pendingOrderExpiryHelp',
              '超过该天数的待支付充值订单会自动过期，范围 1-365 天。',
            )}
            label={t('admin.maintenance.pendingOrderExpiry', '待支付订单过期天数')}
            name="cronPendingOrderExpiryDays"
          >
            <InputNumber max={365} min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            extra={t(
              'admin.maintenance.notificationRetentionHelp',
              '后台维护任务会按该天数删除已归档通知；未归档的收件箱通知不会被自动删除。',
            )}
            label={t('admin.maintenance.notificationRetention', '归档通知保留天数')}
            name="notificationRetentionDays"
          >
            <InputNumber max={3650} min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Button loading={running} onClick={handleRunNow}>
              {t('admin.maintenance.runNow', '立即执行维护')}
            </Button>
            <Button loading={refreshingCaches} onClick={handleRefreshRuntimeCaches}>
              {t('admin.maintenance.refreshCaches', '刷新用户端配置缓存')}
            </Button>
          </Space>
        </Card>

        <Card title={t('admin.maintenance.memorySection', '记忆系统')}>
          <Alert
            showIcon
            style={{ marginBottom: 16 }}
            type="info"
            message={t(
              'admin.maintenance.memoryReason',
              '记忆分析会扫描用户聊天主题并调用模型提取长期记忆，任务可能较慢。单机 Node 部署建议使用“直接执行”；多实例或云函数部署可切换到 QStash 工作流。',
            )}
          />
          <Form.Item
            extra={t(
              'admin.maintenance.memoryTriggerHelp',
              '自动选择：检测到 QSTASH_TOKEN 时优先使用 QStash 工作流，否则直接执行。环境变量 MEMORY_USER_MEMORY_TRIGGER_MODE 可作为运维级覆盖。',
            )}
            label={t('admin.maintenance.memoryTriggerMode', '记忆分析执行模式')}
            name="memoryUserMemoryTriggerMode"
          >
            <Select options={memoryTriggerModeOptions} />
          </Form.Item>
          <Text type="secondary">
            QSTASH_TOKEN：{data?.qstashTokenConfigured ? '已配置，可使用工作流模式' : '未配置'}
            ；环境变量 MEMORY_USER_MEMORY_TRIGGER_MODE：
            {data?.memoryUserMemoryTriggerModeEnv || '未设置'}
          </Text>
        </Card>

        <Space>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.maintenance.save', '保存系统维护设置')}
          </Button>
        </Space>
      </Form>

      <Modal
        footer={null}
        open={!!runResult}
        title={t('admin.maintenance.runResult', '维护结果')}
        onCancel={() => setRunResult(null)}
      >
        <Flexbox gap={8}>
          <div>已删除审计日志：{runResult?.auditLogsDeleted ?? 0}</div>
          <div>审计日志清理时间点：{runResult?.auditCutoff ?? '-'}</div>
          <div>已过期待支付订单：{runResult?.pendingOrdersExpired ?? 0}</div>
          <div>待支付订单过期时间点：{runResult?.pendingOrdersCutoff ?? '-'}</div>
          <div>已删除归档通知：{runResult?.notificationsDeleted ?? 0}</div>
          <div>归档通知清理时间点：{runResult?.notificationRetentionCutoff ?? '-'}</div>
          <div>已过期订阅快照：{runResult?.subscriptionSnapshotsExpired ?? 0}</div>
          <div>已补充免费套餐：{runResult?.freeSnapshotsCreated ?? 0}</div>
          <div>已清理模块应用上传：{runResult?.moduleAppUploadsExpired ?? 0}</div>
          <div>模块应用上传清理失败：{runResult?.moduleAppUploadCleanupFailed ?? 0}</div>
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

AdminSystemMaintenancePage.displayName = 'AdminSystemMaintenancePage';

export default AdminSystemMaintenancePage;
