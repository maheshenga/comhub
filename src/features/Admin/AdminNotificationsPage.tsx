'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, Input, message, Select, Switch, Typography } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import {
  ADMIN_SETTINGS_SWR_KEY,
  SETTING_KEYS,
  type SettingUpdate,
} from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

type NotificationSettingsForm = {
  desktopEnabled: boolean;
  emailEnabled: boolean;
  inboxEnabled: boolean;
  systemActionLabel: string;
  systemActionUrl: string;
  systemContent: string;
  systemEnabled: boolean;
  systemTitle: string;
  systemType: 'error' | 'info' | 'success' | 'warning';
};

const normalizeSystemType = (value: unknown): NotificationSettingsForm['systemType'] =>
  value === 'error' || value === 'info' || value === 'success' || value === 'warning'
    ? value
    : 'warning';

const buildInitialValues = (data: any): NotificationSettingsForm => ({
  desktopEnabled: data?.notificationDesktopEnabled ?? true,
  emailEnabled: data?.notificationEmailEnabled ?? false,
  inboxEnabled: data?.notificationInboxEnabled ?? true,
  systemActionLabel: data?.notificationSystemActionLabel ?? '',
  systemActionUrl: data?.notificationSystemActionUrl ?? '',
  systemContent: data?.notificationSystemContent ?? '',
  systemEnabled: data?.notificationSystemEnabled ?? false,
  systemTitle: data?.notificationSystemTitle ?? '',
  systemType: normalizeSystemType(data?.notificationSystemType),
});

const buildUpdates = (
  values: NotificationSettingsForm,
  initial: NotificationSettingsForm,
): SettingUpdate[] => {
  const map: Array<[keyof NotificationSettingsForm, string]> = [
    ['inboxEnabled', SETTING_KEYS.notificationInboxEnabled],
    ['desktopEnabled', SETTING_KEYS.notificationDesktopEnabled],
    ['emailEnabled', SETTING_KEYS.notificationEmailEnabled],
    ['systemEnabled', SETTING_KEYS.notificationSystemEnabled],
    ['systemTitle', SETTING_KEYS.notificationSystemTitle],
    ['systemContent', SETTING_KEYS.notificationSystemContent],
    ['systemActionLabel', SETTING_KEYS.notificationSystemActionLabel],
    ['systemActionUrl', SETTING_KEYS.notificationSystemActionUrl],
    ['systemType', SETTING_KEYS.notificationSystemType],
  ];

  return map
    .filter(([key]) => values[key] !== initial[key])
    .map(([key, settingKey]) => ({ key: settingKey, value: values[key] }));
};

const AdminNotificationsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useClientDataSWR(ADMIN_SETTINGS_SWR_KEY, () =>
    adminCommercialService.getAllSettings(),
  );
  const [form] = Form.useForm<NotificationSettingsForm>();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => buildInitialValues(data), [data]);

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(buildInitialValues(data));
  }, [data, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const updates = buildUpdates(values, initialValues);

    if (updates.length === 0) {
      message.info(t('admin.notifications.noChanges', '没有需要保存的变更'));
      return;
    }

    setSubmitting(true);
    try {
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      await mutate('public-notification-config');
      message.success(t('admin.notifications.saveSuccess', '通知设置已保存'));
    } catch {
      message.error(t('admin.notifications.saveFailed', '保存失败，请检查配置'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 920 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.notifications.title', '通知管理')}
        </Title>
        <Text type="secondary">
          {t(
            'admin.notifications.subtitle',
            '统一管理站内通知、桌面通知默认策略、邮件通道预留配置和系统公告。',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        type="info"
        message={t(
          'admin.notifications.analysis',
          '当前 settings/notification 页面在桌面端仍是订阅通知嵌入页；网页端主要通过右上角通知收件箱展示站内通知。这里的“站内通知”开关会直接影响收件箱列表和未读数。归档通知保留时间已移至系统维护。',
        )}
      />

      <Form disabled={isLoading} form={form} initialValues={initialValues} layout="vertical">
        <Card>
          <Form.Item
            label={t('admin.notifications.inboxEnabled', '启用站内通知收件箱')}
            name="inboxEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.desktopEnabled', '默认启用桌面通知')}
            name="desktopEnabled"
            valuePropName="checked"
            extra={t(
              'admin.notifications.desktopEnabled.help',
              '桌面端仍需要用户授予系统通知权限；该项作为平台默认策略记录。',
            )}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.emailEnabled', '启用邮件通知通道')}
            name="emailEnabled"
            valuePropName="checked"
            extra={t(
              'admin.notifications.emailEnabled.help',
              '当前邮件投递服务尚未接入时建议保持关闭，后续接入邮件服务后可直接复用该开关。',
            )}
          >
            <Switch />
          </Form.Item>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Form.Item
            label={t('admin.notifications.systemEnabled', '启用系统公告配置')}
            name="systemEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item label={t('admin.notifications.systemTitle', '公告标题')} name="systemTitle">
            <Input placeholder="例如：服务升级通知" />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemContent', '公告内容')}
            name="systemContent"
          >
            <Input.TextArea autoSize={{ minRows: 3 }} placeholder="填写需要展示给用户的公告内容" />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemActionUrl', '公告跳转链接')}
            name="systemActionUrl"
          >
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemActionLabel', '公告按钮文案')}
            name="systemActionLabel"
          >
            <Input placeholder="查看详情" />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemType', '公告类型')}
            name="systemType"
          >
            <Select
              options={[
                { label: t('admin.notifications.systemType.info', '信息'), value: 'info' },
                { label: t('admin.notifications.systemType.success', '成功'), value: 'success' },
                { label: t('admin.notifications.systemType.warning', '警告'), value: 'warning' },
                { label: t('admin.notifications.systemType.error', '错误'), value: 'error' },
              ]}
            />
          </Form.Item>
        </Card>

        <Flexbox horizontal justify="flex-end" style={{ marginTop: 16 }}>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.notifications.save', '保存通知设置')}
          </Button>
        </Flexbox>
      </Form>
    </Flexbox>
  );
});

AdminNotificationsPage.displayName = 'AdminNotificationsPage';

export default AdminNotificationsPage;
