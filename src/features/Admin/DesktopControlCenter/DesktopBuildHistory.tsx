'use client';

import { Button, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { desktopControlCenterStyles } from './styles';

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '-');

interface DesktopBuildHistoryProps {
  releases?: any[];
}

const DesktopBuildHistory = memo<DesktopBuildHistoryProps>(({ releases = [] }) => {
  const { t } = useTranslation('subscription');
  const columns: TableColumnsType<any> = [
    {
      dataIndex: 'status',
      render: (status: string) => <Tag>{status}</Tag>,
      title: t('admin.desktopBuild.history.status'),
    },
    { dataIndex: 'channel', title: t('admin.desktopBuild.history.channel') },
    { dataIndex: 'version', title: t('admin.desktopBuild.history.version') },
    {
      dataIndex: 'frozenRevisionId',
      ellipsis: true,
      title: t('admin.desktopBuild.history.revision'),
    },
    { dataIndex: 'actorUserId', ellipsis: true, title: t('admin.desktopBuild.history.actor') },
    {
      dataIndex: 'createdAt',
      render: formatDate,
      title: t('admin.desktopBuild.history.createdAt'),
    },
    {
      dataIndex: 'artifacts',
      render: (artifacts?: Array<{ fileName?: string }>) => artifacts?.[0]?.fileName || '-',
      title: t('admin.desktopBuild.history.artifact'),
    },
    {
      dataIndex: 'errorSummary',
      ellipsis: true,
      render: (value?: string | null) => value || '-',
      title: t('admin.desktopBuild.history.error'),
    },
    {
      dataIndex: 'workflowRunUrl',
      render: (url?: string | null) =>
        url ? (
          <Button href={url} rel="noreferrer" size="small" target="_blank" type="link">
            {t('admin.desktopBuild.history.githubRun')}
          </Button>
        ) : (
          '-'
        ),
      title: t('admin.desktopBuild.history.run'),
    },
  ];

  return (
    <section>
      <Typography.Title className={desktopControlCenterStyles.sectionTitle} level={4}>
        {t('admin.desktopBuild.history.title')}
      </Typography.Title>
      <div className={desktopControlCenterStyles.tableWrapper}>
        <Table
          columns={columns}
          dataSource={releases}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1100 }}
          size="small"
        />
      </div>
    </section>
  );
});

DesktopBuildHistory.displayName = 'DesktopBuildHistory';

export default DesktopBuildHistory;
