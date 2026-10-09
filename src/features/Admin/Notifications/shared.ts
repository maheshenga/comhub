import {
  normalizeNotificationEventDefaults,
  type NotificationEventDefaults,
} from '@/const/notificationPreferences';
import { SETTING_KEYS, type SettingUpdate } from '@/features/Admin/adminSettingsForm';

export type NotificationSettingsForm = {
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

export const buildInitialValues = (data: any): NotificationSettingsForm => ({
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

export const NOTIFICATION_SETTING_MAP: Array<[keyof NotificationSettingsForm, string]> = [
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

export const buildUpdates = (
  values: NotificationSettingsForm,
  initial: NotificationSettingsForm,
): SettingUpdate[] => {
  const updates = NOTIFICATION_SETTING_MAP.filter(([key]) => values[key] !== initial[key]).map(
    ([key, settingKey]) => ({ key: settingKey, value: values[key] }),
  );

  const normalizedCurrent = normalizeNotificationEventDefaults(values.eventDefaults);
  const normalizedInitial = normalizeNotificationEventDefaults(initial.eventDefaults);
  if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedInitial)) {
    updates.push({ key: SETTING_KEYS.notificationEventDefaults, value: normalizedCurrent });
  }

  return updates;
};

export const buildNotificationMaterializationUpdates = (
  values: NotificationSettingsForm,
): SettingUpdate[] => [
  ...NOTIFICATION_SETTING_MAP.map(([key, settingKey]) => ({ key: settingKey, value: values[key] })),
  {
    key: SETTING_KEYS.notificationEventDefaults,
    value: normalizeNotificationEventDefaults(values.eventDefaults),
  },
];
