'use client';

import type { PlatformPluginRunHistoryItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Empty, Tag, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatPlatformPluginCredits, getPlatformPluginRunPreviewCopyKey } from './helpers';

const { Text } = Typography;

const statusColor: Record<PlatformPluginRunHistoryItem['status'], string> = {
  denied: 'orange',
  failed: 'red',
  queued: 'default',
  running: 'blue',
  succeeded: 'green',
};

type PluginRunHistoryProps = {
  hasMore?: boolean;
  items: PlatformPluginRunHistoryItem[];
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

const PluginRunHistory = memo<PluginRunHistoryProps>(
  ({ hasMore = false, items, loadingMore = false, onLoadMore }) => {
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
        {items.map((item) => {
          const previewCopyKey = item.preview ? getPlatformPluginRunPreviewCopyKey(item) : null;
          const previewText = previewCopyKey ? t(previewCopyKey) : item.preview;

          return (
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
                      {t('platformPlugins.runHistory.artifacts', {
                        count: item.artifactIds.length,
                      })}
                    </Tag>
                  ) : null}
                </Flexbox>
                <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
              </Flexbox>
              {previewText ? <Text ellipsis>{previewText}</Text> : null}
            </Flexbox>
          );
        })}
        {hasMore ? (
          <Button loading={loadingMore} onClick={onLoadMore}>
            {t(
              loadingMore
                ? 'platformPlugins.runHistory.loadingMore'
                : 'platformPlugins.runHistory.loadMore',
            )}
          </Button>
        ) : null}
      </Flexbox>
    );
  },
);

PluginRunHistory.displayName = 'PluginRunHistory';

export default PluginRunHistory;
