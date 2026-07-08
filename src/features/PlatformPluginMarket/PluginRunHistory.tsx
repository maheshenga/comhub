'use client';

import type { PlatformPluginRunHistoryItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Empty, Tag, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatPlatformPluginCredits } from './helpers';

const { Text } = Typography;

const statusColor: Record<PlatformPluginRunHistoryItem['status'], string> = {
  denied: 'orange',
  failed: 'red',
  queued: 'default',
  running: 'blue',
  succeeded: 'green',
};

type PluginRunHistoryProps = {
  items: PlatformPluginRunHistoryItem[];
};

const PluginRunHistory = memo<PluginRunHistoryProps>(({ items }) => {
  const { t } = useTranslation('subscription');

  if (items.length === 0) {
    return (
      <Empty
        description={t('platformPlugins.runHistory.empty')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Flexbox gap={8}>
      {items.map((item) => (
        <Flexbox
          gap={6}
          key={item.runId}
          padding={12}
          style={{ border: '1px solid var(--lobe-color-border-secondary)', borderRadius: 8 }}
        >
          <Flexbox horizontal align="center" justify="space-between" gap={8}>
            <Flexbox horizontal gap={6} wrap="wrap">
              <Tag color={statusColor[item.status]}>
                {t(`platformPlugins.runHistory.status.${item.status}`)}
              </Tag>
              <Tag>
                {t('platformPlugins.runHistory.credits', {
                  credits: formatPlatformPluginCredits(item.chargedCredits),
                })}
              </Tag>
              {item.fixedServiceFeeCharged ? (
                <Tag color="blue">{t('platformPlugins.runHistory.serviceFee')}</Tag>
              ) : null}
              {item.artifactIds.length > 0 ? (
                <Tag color="purple">
                  {t('platformPlugins.runHistory.artifacts', { count: item.artifactIds.length })}
                </Tag>
              ) : null}
            </Flexbox>
            <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
          </Flexbox>
          {item.preview ? <Text ellipsis>{item.preview}</Text> : null}
        </Flexbox>
      ))}
    </Flexbox>
  );
});

PluginRunHistory.displayName = 'PluginRunHistory';

export default PluginRunHistory;
