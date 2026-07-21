'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Alert, Button, Empty, Result, Skeleton, Tag, Typography } from 'antd';
import { RefreshCw, Settings2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { desktopControlCenterStyles } from './styles';
import {
  DESKTOP_CHANNEL_LABEL_KEYS,
  DESKTOP_PLATFORM_LABEL_KEYS,
  DESKTOP_REASON_LABEL_KEYS,
  type DesktopOverviewResource,
} from './types';

const statusColor = (status: 'degraded' | 'healthy' | 'unavailable') => {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  return 'error';
};

interface OverviewPageProps {
  onConfigure: () => void;
  resource: DesktopOverviewResource;
}

const OverviewPage = memo<OverviewPageProps>(({ onConfigure, resource }) => {
  const { t } = useTranslation('subscription');

  if (resource.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

  if (resource.error) {
    return (
      <Result
        extra={
          <Button icon={<Icon icon={RefreshCw} size={16} />} onClick={() => void resource.mutate()}>
            {t('admin.desktopControl.retry')}
          </Button>
        }
        status="error"
        title={t('admin.desktopControl.error.title')}
      />
    );
  }

  const data = resource.data;
  if (!data?.diagnostics.configured) {
    return (
      <Empty
        description={t('admin.desktopControl.unconfigured.title')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <Button icon={<Icon icon={Settings2} size={16} />} type="primary" onClick={onConfigure}>
          {t('admin.desktopControl.configure')}
        </Button>
      </Empty>
    );
  }

  const statusItems = [
    {
      label: t('admin.desktopControl.status.configuredVersion'),
      value: data.configuredVersion || '-',
    },
    {
      label: t('admin.desktopControl.status.stable'),
      value: data.diagnostics.channels.find(({ channel }) => channel === 'stable')?.version || '-',
    },
    {
      label: t('admin.desktopControl.status.canary'),
      value: data.diagnostics.channels.find(({ channel }) => channel === 'canary')?.version || '-',
    },
    {
      label: t('admin.desktopControl.status.checkedAt'),
      value: new Date(data.diagnostics.checkedAt).toLocaleString(),
    },
  ];

  return (
    <Flexbox gap={24}>
      <div className={desktopControlCenterStyles.statusBand}>
        {statusItems.map((item) => (
          <div className={desktopControlCenterStyles.statusItem} key={item.label}>
            <Typography.Text className={desktopControlCenterStyles.statusLabel}>
              {item.label}
            </Typography.Text>
            <Typography.Text strong ellipsis>
              {item.value}
            </Typography.Text>
          </div>
        ))}
      </div>

      {data.diagnostics.channels.map((channel) => (
        <section className={desktopControlCenterStyles.channelSection} key={channel.channel}>
          <Flexbox align="center" horizontal justify="space-between">
            <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={4}>
              {t(DESKTOP_CHANNEL_LABEL_KEYS[channel.channel])}
            </Typography.Title>
            <Tag color={statusColor(channel.status)}>
              {t(`admin.desktopControl.channel.${channel.status}`)}
            </Tag>
          </Flexbox>
          {channel.status === 'unavailable' &&
          Object.values(channel.platforms).some(({ reason }) => reason) ? (
            <Alert
              showIcon
              message={t(
                DESKTOP_REASON_LABEL_KEYS[
                  Object.values(channel.platforms).find(({ reason }) => reason)?.reason ||
                    'manifest-request-failed'
                ],
              )}
              type="warning"
            />
          ) : null}
          <div className={desktopControlCenterStyles.channelGrid}>
            {Object.entries(channel.platforms).map(([type, artifact]) => (
              <div className={desktopControlCenterStyles.platformSummary} key={type}>
                <Typography.Text strong>
                  {t(DESKTOP_PLATFORM_LABEL_KEYS[type as keyof typeof DESKTOP_PLATFORM_LABEL_KEYS])}
                </Typography.Text>
                <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                  {artifact.assetName ||
                    (artifact.reason ? t(DESKTOP_REASON_LABEL_KEYS[artifact.reason]) : '-')}
                </Typography.Paragraph>
                <Tag color={artifact.status === 'available' ? 'success' : 'default'}>
                  {t(`admin.desktopControl.artifact.${artifact.status}`)}
                </Tag>
              </div>
            ))}
          </div>
        </section>
      ))}
    </Flexbox>
  );
});

OverviewPage.displayName = 'OverviewPage';

export default OverviewPage;
