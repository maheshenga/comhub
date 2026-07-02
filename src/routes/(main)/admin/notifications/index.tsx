'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Form, Input, InputNumber, message, Select, Switch, Typography } from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_EVENTS,
  NOTIFICATION_EVENT_TITLES,
  type NotificationEventDefaults,
  normalizeNotificationEventDefaults,
} from '@/const/notificationPreferences';
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
  eventDefaults: NotificationEventDefaults;
  inboxEnabled: boolean;
  pushEnabled: boolean;
  systemActionLabel: string;
  retentionDays: number;
  systemActionUrl: string;
  systemContent: string;
  systemEnabled: boolean;
  systemTitle: string;
  systemType: 'error' | 'info' | 'success' | 'warning';
};

const buildInitialValues = (data: any): NotificationSettingsForm => ({
  desktopEnabled: data?.notificationDesktopEnabled ?? true,
  emailEnabled: data?.notificationEmailEnabled ?? false,
  eventDefaults: normalizeNotificationEventDefaults(data?.notificationEventDefaults),
  inboxEnabled: data?.notificationInboxEnabled ?? true,
  pushEnabled: data?.notificationPushEnabled ?? data?.notificationDesktopEnabled ?? true,
  retentionDays: data?.notificationRetentionDays ?? 90,
  systemActionLabel: data?.notificationSystemActionLabel ?? '',
  systemActionUrl: data?.notificationSystemActionUrl ?? '',
  systemContent: data?.notificationSystemContent ?? '',
  systemEnabled: data?.notificationSystemEnabled ?? false,
  systemTitle: data?.notificationSystemTitle ?? '',
  systemType: ['error', 'info', 'success', 'warning'].includes(data?.notificationSystemType)
    ? data.notificationSystemType
    : 'warning',
});

const buildUpdates = (
  values: NotificationSettingsForm,
  initial: NotificationSettingsForm,
): SettingUpdate[] => {
  const map: Array<[keyof NotificationSettingsForm, string]> = [
    ['inboxEnabled', SETTING_KEYS.notificationInboxEnabled],
    ['desktopEnabled', SETTING_KEYS.notificationDesktopEnabled],
    ['emailEnabled', SETTING_KEYS.notificationEmailEnabled],
    ['pushEnabled', SETTING_KEYS.notificationPushEnabled],
    ['retentionDays', SETTING_KEYS.notificationRetentionDays],
    ['systemEnabled', SETTING_KEYS.notificationSystemEnabled],
    ['systemTitle', SETTING_KEYS.notificationSystemTitle],
    ['systemContent', SETTING_KEYS.notificationSystemContent],
    ['systemActionLabel', SETTING_KEYS.notificationSystemActionLabel],
    ['systemActionUrl', SETTING_KEYS.notificationSystemActionUrl],
    ['systemType', SETTING_KEYS.notificationSystemType],
  ];

  const updates = map
    .filter(([key]) => values[key] !== initial[key])
    .map(([key, settingKey]) => ({ key: settingKey, value: values[key] }));

  const normalizedCurrent = normalizeNotificationEventDefaults(values.eventDefaults);
  const normalizedInitial = normalizeNotificationEventDefaults(initial.eventDefaults);
  if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedInitial)) {
    updates.push({ key: SETTING_KEYS.notificationEventDefaults, value: normalizedCurrent });
  }

  return updates;
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
      await Promise.all(updates.map((update) => adminCommercialService.setAppSetting(update)));
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
            '统一管理站内通知、桌面通知默认策略、邮件通道预留配置和通知保留时间。',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        type="info"
        message={t(
          'admin.notifications.analysis',
          '这里统一管理用户通知页展示的通道和事件默认开关。站内通知会影响收件箱入口；邮件和推送通道需要对应投递能力接入后才会实际发送。',
        )}
      />

      <Form disabled={isLoading} form={form} initialValues={initialValues} layout="vertical">
        <Flexbox gap={16}>
          {NOTIFICATION_CHANNELS.map((channel) => {
            const enabledField =
              channel.key === 'email'
                ? 'emailEnabled'
                : channel.key === 'inbox'
                  ? 'inboxEnabled'
                  : 'pushEnabled';

            return (
              <Card key={channel.key} title={channel.title}>
                <Form.Item
                  label={t(`admin.notifications.${channel.key}.enabled`, `启用${channel.title}`)}
                  name={enabledField}
                  valuePropName="checked"
                  extra={channel.description}
                >
                  <Switch />
                </Form.Item>
                <Flexbox gap={8}>
                  <Text strong>{t('admin.notifications.events', '事件默认开关')}</Text>
                  {NOTIFICATION_CHANNEL_EVENTS[channel.key].map((eventKey) => (
                    <Flexbox
                      horizontal
                      align="center"
                      justify="space-between"
                      key={`${channel.key}-${eventKey}`}
                    >
                      <Text>{NOTIFICATION_EVENT_TITLES[eventKey]}</Text>
                      <Form.Item
                        noStyle
                        name={['eventDefaults', channel.key, eventKey]}
                        valuePropName="checked"
                      >
                        <Switch
                          aria-label={`${channel.title}：${NOTIFICATION_EVENT_TITLES[eventKey]}`}
                        />
                      </Form.Item>
                    </Flexbox>
                  ))}
                </Flexbox>
              </Card>
            );
          })}

          <Card>
            <Form.Item
              label={t('admin.notifications.desktopEnabled', '兼容：默认启用桌面通知')}
              name="desktopEnabled"
              valuePropName="checked"
              extra={t(
                'admin.notifications.desktopEnabled.help',
                '保留给旧版桌面通知读取；新的用户通知页使用“移动推送通知”通道展示。',
              )}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('admin.notifications.retentionDays', '归档通知保留天数')}
              name="retentionDays"
              extra={t(
                'admin.notifications.retentionDays.help',
                '后台维护任务会按该天数删除已归档通知；未归档的收件箱通知不会被自动删除。',
              )}
            >
              <InputNumber max={3650} min={1} style={{ width: 180 }} />
            </Form.Item>
          </Card>
        </Flexbox>

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
          <Form.Item label={t('admin.notifications.systemType', '公告类型')} name="systemType">
            <Select
              options={[
                { label: '信息', value: 'info' },
                { label: '成功', value: 'success' },
                { label: '警告', value: 'warning' },
                { label: '错误', value: 'error' },
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
