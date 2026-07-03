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
  retentionDays: number;
  systemActionLabel: string;
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
      message.info(t('admin.notifications.noChanges', 'No changes to save'));
      return;
    }

    setSubmitting(true);
    try {
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      await mutate('public-notification-config');
      message.success(t('admin.notifications.saveSuccess', 'Notification settings saved'));
    } catch {
      message.error(t('admin.notifications.saveFailed', 'Failed to save notification settings'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 920 }}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.notifications.title', 'Notification management')}
        </Title>
        <Text type="secondary">
          {t(
            'admin.notifications.subtitle',
            'Manage inbox, email, push notification defaults, system announcements, and notification retention.',
          )}
        </Text>
      </Flexbox>

      <Alert
        showIcon
        type="info"
        message={t(
          'admin.notifications.analysis',
          'Inbox notifications affect the user notification center. Email and push switches are default delivery policies and require their delivery channels to be configured.',
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
                  label={t(`admin.notifications.${channel.key}.enabled`, `Enable ${channel.title}`)}
                  name={enabledField}
                  valuePropName="checked"
                  extra={channel.description}
                >
                  <Switch />
                </Form.Item>
                <Flexbox gap={8}>
                  <Text strong>{t('admin.notifications.events', 'Default event switches')}</Text>
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
                          aria-label={`${channel.title}: ${NOTIFICATION_EVENT_TITLES[eventKey]}`}
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
              label={t('admin.notifications.desktopEnabled', 'Legacy desktop notification default')}
              name="desktopEnabled"
              valuePropName="checked"
              extra={t(
                'admin.notifications.desktopEnabled.help',
                'Kept for older desktop notification readers. New user-facing defaults are controlled by the push channel.',
              )}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('admin.notifications.retentionDays', 'Archived notification retention days')}
              name="retentionDays"
              extra={t(
                'admin.notifications.retentionDays.help',
                'The maintenance job deletes archived notifications older than this value.',
              )}
            >
              <InputNumber max={3650} min={1} style={{ width: 180 }} />
            </Form.Item>
          </Card>
        </Flexbox>

        <Card style={{ marginTop: 16 }}>
          <Form.Item
            label={t('admin.notifications.systemEnabled', 'Enable system announcement')}
            name="systemEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item label={t('admin.notifications.systemTitle', 'Announcement title')} name="systemTitle">
            <Input placeholder="Service upgrade notice" />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemContent', 'Announcement content')}
            name="systemContent"
          >
            <Input.TextArea autoSize={{ minRows: 3 }} placeholder="Content shown to users" />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemActionUrl', 'Announcement action URL')}
            name="systemActionUrl"
          >
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item
            label={t('admin.notifications.systemActionLabel', 'Announcement action label')}
            name="systemActionLabel"
          >
            <Input placeholder="View details" />
          </Form.Item>
          <Form.Item label={t('admin.notifications.systemType', 'Announcement type')} name="systemType">
            <Select
              options={[
                { label: 'Info', value: 'info' },
                { label: 'Success', value: 'success' },
                { label: 'Warning', value: 'warning' },
                { label: 'Error', value: 'error' },
              ]}
            />
          </Form.Item>
        </Card>

        <Flexbox horizontal justify="flex-end" style={{ marginTop: 16 }}>
          <Button loading={submitting} type="primary" onClick={handleSave}>
            {t('admin.notifications.save', 'Save notification settings')}
          </Button>
        </Flexbox>
      </Form>
    </Flexbox>
  );
});

AdminNotificationsPage.displayName = 'AdminNotificationsPage';

export default AdminNotificationsPage;
