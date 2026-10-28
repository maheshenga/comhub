'use client';

import { Flexbox, Switch, Text } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import {
  NOTIFICATION_CHANNEL_EVENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TITLES,
} from '@/const/notificationPreferences';

import { AdminFormGrid, AdminSection } from '../layout';

/**
 * Channel defaults live in their own component so the page stays under the
 * Admin 300-line budget. Fields bind to the page-owned FormKit instance via
 * context.
 */
const ChannelSettingsSection = () => {
  const { t } = useTranslation('subscription');

  return (
    <AdminSection
      carded
      title={t('admin.notifications.channels', '通知渠道')}
      description={t(
        'admin.notifications.channelsDescription',
        '为每个投递渠道设置默认启用状态和事件范围。',
      )}
    >
      <AdminFormGrid columns={3} label={t('admin.notifications.channels', '通知渠道')}>
        {NOTIFICATION_CHANNELS.map((channel) => {
          const enabledField =
            channel.key === 'email'
              ? 'emailEnabled'
              : channel.key === 'inbox'
                ? 'inboxEnabled'
                : 'pushEnabled';

          return (
            <Card key={channel.key} title={channel.title}>
              <Form.Field
                extra={channel.description}
                label={t(`admin.notifications.${channel.key}.enabled`, `启用${channel.title}`)}
                name={enabledField}
                valueProp="checked"
              >
                <Switch />
              </Form.Field>
              <Flexbox gap={8}>
                <Text strong>{t('admin.notifications.events', '默认事件开关')}</Text>
                {NOTIFICATION_CHANNEL_EVENTS[channel.key].map((eventKey) => (
                  <Flexbox
                    horizontal
                    align="center"
                    justify="space-between"
                    key={`${channel.key}-${eventKey}`}
                  >
                    <Text>{NOTIFICATION_EVENT_TITLES[eventKey]}</Text>
                    <Form.Field
                      bare
                      name={`eventDefaults.${channel.key}.${eventKey}`}
                      valueProp="checked"
                    >
                      <Switch
                        aria-label={`${channel.title}: ${NOTIFICATION_EVENT_TITLES[eventKey]}`}
                      />
                    </Form.Field>
                  </Flexbox>
                ))}
              </Flexbox>
            </Card>
          );
        })}
      </AdminFormGrid>
    </AdminSection>
  );
};

export default ChannelSettingsSection;
