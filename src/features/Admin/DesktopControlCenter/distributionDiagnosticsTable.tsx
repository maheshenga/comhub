'use client';

import { Icon } from '@lobehub/ui';
import { Button, Tag } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { Table, Tooltip, Typography } from 'antd';
import { ExternalLink } from 'lucide-react';

import { desktopControlCenterStyles } from './styles';
import {
  DESKTOP_CHANNEL_LABEL_KEYS,
  DESKTOP_PLATFORM_LABEL_KEYS,
  DESKTOP_REASON_LABEL_KEYS,
  type DesktopChannel,
  type DesktopDiagnosticReason,
  type DesktopOverviewResource,
  type DesktopPlatform,
} from './types';

export type DistributionRow = {
  asset?: string;
  channel: DesktopChannel;
  key: string;
  platform: DesktopPlatform;
  publishedAt?: string;
  reason?: DesktopDiagnosticReason;
  sha512?: string;
  size?: number;
  status: 'available' | 'missing' | 'unavailable';
  url?: string;
  version?: string;
};

const formatSize = (size?: number) => {
  if (!size || size < 1) return '-';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

export const getDistributionRows = (resource: DesktopOverviewResource): DistributionRow[] =>
  resource.data?.diagnostics.channels.flatMap((channel) =>
    Object.entries(channel.platforms).map(([type, artifact]) => ({
      asset: artifact.assetName,
      channel: channel.channel,
      key: `${channel.channel}:${type}`,
      platform: type as DesktopPlatform,
      publishedAt: artifact.publishedAt,
      reason: artifact.reason,
      sha512: artifact.sha512,
      size: artifact.size,
      status: artifact.status,
      url: artifact.url,
      version: artifact.version,
    })),
  ) || [];

/** 分发渠道诊断表（M5 拆页：从 DistributionPage 抽出）。 */
export const DistributionDiagnosticsTable = ({
  overview,
  t,
}: {
  overview: DesktopOverviewResource;
  t: (key: any, defaultValue?: any, values?: any) => any;
}) => {
  const columns: TableColumnsType<DistributionRow> = [
    {
      dataIndex: 'channel',
      render: (channel: DesktopChannel) => t(DESKTOP_CHANNEL_LABEL_KEYS[channel]),
      title: t('admin.desktopControl.status.channel'),
    },
    {
      dataIndex: 'platform',
      render: (platform: DesktopPlatform) => t(DESKTOP_PLATFORM_LABEL_KEYS[platform]),
      title: t('admin.desktopControl.platform'),
    },
    { dataIndex: 'version', title: t('admin.desktopControl.status.version') },
    {
      dataIndex: 'asset',
      ellipsis: true,
      title: t('admin.desktopControl.asset'),
    },
    {
      dataIndex: 'size',
      render: (size: number | undefined) => formatSize(size),
      title: t('admin.desktopControl.size'),
    },
    {
      dataIndex: 'publishedAt',
      render: (value: string | undefined) => formatDate(value),
      title: t('admin.desktopControl.publishedAt'),
    },
    {
      dataIndex: 'status',
      render: (status: DistributionRow['status']) => (
        <Tag color={status === 'available' ? 'success' : status === 'missing' ? 'warning' : 'error'}>
          {t(`admin.desktopControl.artifact.${status}`)}
        </Tag>
      ),
      title: t('admin.desktopControl.status.label'),
    },
    {
      key: 'action',
      render: (_value, row) =>
        row.url ? (
          <Tooltip title={t('admin.desktopControl.download')}>
            <Button
              aria-label={`${t('admin.desktopControl.download')}: ${row.asset || row.platform}`}
              href={row.url}
              icon={<Icon icon={ExternalLink} size={16} />}
              rel="noreferrer"
              target="_blank"
              type="text"
            />
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">
            {row.reason ? t(DESKTOP_REASON_LABEL_KEYS[row.reason]) : '-'}
          </Typography.Text>
        ),
      title: '',
    },
  ];

  return (
    <div className={desktopControlCenterStyles.tableWrapper}>
      <Table<DistributionRow>
        columns={columns}
        dataSource={getDistributionRows(overview)}
        pagination={false}
        rowKey="key"
        scroll={{ x: 900 }}
        size="small"
      />
    </div>
  );
};
