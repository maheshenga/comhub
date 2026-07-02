'use client';

import { isDesktop } from '@lobechat/const';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button, List, Tag, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { adminCommercialService } from '@/services/adminCommercial';

import { SubscriptionIframeWrapper } from './SubscriptionIframeWrapper';

const { Text } = Typography;

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

  const rows = [
    {
      desc: t('notification.inbox.desc'),
      enabled: data?.inboxEnabled !== false,
      title: t('notification.inbox.title'),
    },
    {
      desc: t(
        'notification.desktop.desc',
        '桌面端在系统授权后，可在任务完成或模型回复结束时弹出系统通知。',
      ),
      enabled: data?.desktopEnabled !== false,
      title: t('notification.desktop.title', '桌面通知'),
    },
    {
      desc: t('notification.email.desc'),
      enabled: data?.emailEnabled === true,
      title: t('notification.email.title'),
    },
  ];

  return (
    <>
      <SettingHeader title={t('tab.notification')} />
      <Flexbox gap={16} padding={24}>
        <Alert
          showIcon
          type="info"
          message={t(
            'notification.adminManaged',
            '通知渠道由管理员统一配置；个人侧当前用于查看各渠道状态和站内公告。',
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
        <Card>
          <List
            dataSource={rows}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Tag color={item.enabled ? 'success' : 'default'} key="status">
                    {item.enabled ? t('notification.enabled') : t('disabled', '已关闭')}
                  </Tag>,
                ]}
              >
                <List.Item.Meta
                  description={<Text type="secondary">{item.desc}</Text>}
                  title={item.title}
                />
              </List.Item>
            )}
          />
        </Card>
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
