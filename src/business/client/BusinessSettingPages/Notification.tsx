'use client';

import { isDesktop } from '@lobechat/const';
import { Alert, Button, Flexbox, Switch, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { buildNotificationPreferenceGroups } from '@/const/notificationPreferences';
import SettingHeader from '@/features/Settings/features/SettingHeader';
import { SettingsSearchAnchor } from '@/features/SettingsSearch/anchor';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { SubscriptionIframeWrapper } from './SubscriptionIframeWrapper';

/**
 * 通知搜索深链锚点：key 与 anchor 后缀一致。显式映射（而非模板串拼接）——
 * items.test.ts 的挂载点比对是静态扫描，模板串运行时才成形，会误报未挂载。
 */
const NOTIFICATION_ANCHOR_IDS: Record<string, string> = {
  email: 'notification-email',
  inbox: 'notification-inbox',
  push: 'notification-push',
};

type SystemAlertType = 'error' | 'info' | 'success' | 'warning';

const normalizeSystemAlertType = (type?: null | string): SystemAlertType =>
  type === 'error' || type === 'info' || type === 'success' || type === 'warning'
    ? type
    : 'warning';

const WebNotification = memo(() => {
  const { t } = useTranslation('setting');
  const { data } = useClientDataSWR('public-notification-config', () =>
    adminCommercialService.getPublicNotificationConfig(),
  );

  const groups = buildNotificationPreferenceGroups(data);

  return (
    <>
      <SettingHeader title={t('tab.notification')} />
      <Flexbox gap={16} padding={24}>
        <Alert
          showIcon
          type="info"
          message={t(
            'notification.adminManaged',
            '通知偏好由管理员统一配置；当前页面用于查看各通道默认策略和站内公告。',
          )}
        />
        {data?.system?.enabled && (data.system.title || data.system.content) ? (
          <Alert
            showIcon
            description={data.system.content}
            message={data.system.title || t('notification.system.title', '系统公告')}
            type={normalizeSystemAlertType(data.system.type)}
            action={
              data.system.actionUrl ? (
                <Button href={data.system.actionUrl} rel="noreferrer" size="small" target="_blank">
                  {data.system.actionLabel || t('notification.system.action', '查看详情')}
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {groups.map((group) => (
          <Card
            key={group.key}
            title={
              <Flexbox horizontal align="center" justify="space-between">
                <Flexbox gap={2}>
                  <Text strong>
                    <SettingsSearchAnchor id={NOTIFICATION_ANCHOR_IDS[group.key]}>
                      {group.title}
                    </SettingsSearchAnchor>
                  </Text>
                  <Text type="secondary">{group.description}</Text>
                </Flexbox>
                <Switch disabled aria-label={group.title} checked={group.enabled} />
              </Flexbox>
            }
          >
            <Flexbox gap={12}>
              {group.events.map((event) => (
                <Flexbox
                  horizontal
                  align="center"
                  justify="space-between"
                  key={`${group.key}-${event.key}`}
                >
                  <Text>{event.title}</Text>
                  <Switch
                    disabled
                    aria-label={`${group.title}：${event.title}`}
                    checked={group.enabled && event.enabled}
                  />
                </Flexbox>
              ))}
            </Flexbox>
          </Card>
        ))}
      </Flexbox>
    </>
  );
});

WebNotification.displayName = 'WebNotification';

const Notification = memo(() => {
  if (isDesktop) return <SubscriptionIframeWrapper page="notification" />;

  return <WebNotification />;
});

Notification.displayName = 'Notification';

export default Notification;
