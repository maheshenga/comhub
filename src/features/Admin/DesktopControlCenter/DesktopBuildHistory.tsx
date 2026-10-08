'use client';

import type { DesktopReleaseStatus } from '@lobechat/types';
import { Button } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { message, Space, Table, Tag, Typography } from 'antd';
import { CheckCircle2, RefreshCw, RotateCcw } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminCommercialService } from '@/services/adminCommercial';

import AdminDangerousActionButton from '../AdminDangerousActionButton';
import { buildAdminDangerousActionEnvelope } from '../adminDangerousActions';
import { desktopControlCenterStyles } from './styles';

const formatDate = (value?: Date | string | null) =>
  value ? new Date(value).toLocaleString() : '-';

export interface DesktopReleaseHistoryItem {
  actorUserId?: null | string;
  artifacts?: Array<{ fileName?: string; storageKey?: string }>;
  channel: 'canary' | 'stable';
  completedAt?: Date | null | string;
  createdAt?: Date | null | string;
  createdByUserId?: null | string;
  dispatchedByUserId?: null | string;
  errorSummary?: null | string;
  frozenRevisionId: string;
  id: string;
  profileId: string;
  publishedDownloadUrl?: null | string;
  publishedServerUrl?: null | string;
  status: DesktopReleaseStatus;
  version: string;
  workflowRunUrl?: null | string;
}

interface DesktopBuildHistoryProps {
  currentRelease?: { channel: 'canary' | 'stable'; version: string };
  onActivated?: () => Promise<unknown> | unknown;
  onReconciled?: () => Promise<unknown> | unknown;
  releases?: DesktopReleaseHistoryItem[];
}

const DesktopBuildHistory = memo<DesktopBuildHistoryProps>(
  ({ currentRelease, onActivated, onReconciled, releases = [] }) => {
    const { t } = useTranslation('subscription');
    const [activatingReleaseId, setActivatingReleaseId] = useState<string>();
    const [reconcilingReleaseId, setReconcilingReleaseId] = useState<string>();
    const [retryingReleaseId, setRetryingReleaseId] = useState<string>();
    const actionPending = Boolean(activatingReleaseId || reconcilingReleaseId || retryingReleaseId);

    const refreshReleaseData = async (includePublication = false) => {
      const refreshers: Array<() => Promise<unknown> | unknown> = [];
      if (onReconciled) refreshers.push(onReconciled);
      if (includePublication && onActivated) refreshers.push(onActivated);

      const outcomes = await Promise.allSettled(
        refreshers.map((refresh) => Promise.resolve().then(refresh)),
      );
      if (outcomes.some(({ status }) => status === 'rejected')) {
        message.warning(t('admin.desktopBuild.history.refreshFailed'));
      }
    };

    const reconcileRelease = async (releaseId: string) => {
      setReconcilingReleaseId(releaseId);
      try {
        const result = await adminCommercialService.reconcileDesktopRelease(
          releaseId,
          buildAdminDangerousActionEnvelope('desktop.release.reconcile', { confirmed: true }),
        );
        if (result.state === 'matched') {
          message.success(t('admin.desktopBuild.history.reconcileMatched'));
        } else {
          message.warning(t('admin.desktopBuild.history.reconcileUnresolved'));
        }
      } catch {
        message.error(t('admin.desktopBuild.history.reconcileFailed'));
      } finally {
        await refreshReleaseData();
        setReconcilingReleaseId(undefined);
      }
    };

    const columns: TableColumnsType<DesktopReleaseHistoryItem> = [
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
      {
        ellipsis: true,
        render: (_, release) =>
          release.createdByUserId || release.dispatchedByUserId || release.actorUserId || '-',
        title: t('admin.desktopBuild.history.actor'),
      },
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
        render: (_, release) => {
          const isCurrent =
            release.status === 'succeeded' &&
            currentRelease?.channel === release.channel &&
            currentRelease.version === release.version;
          const hasPublication = Boolean(
            release.publishedDownloadUrl && release.publishedServerUrl,
          );

          return (
            <Space size={4}>
              {release.workflowRunUrl ? (
                <Button
                  href={release.workflowRunUrl}
                  rel="noreferrer"
                  size="small"
                  target="_blank"
                  type="link"
                >
                  {t('admin.desktopBuild.history.githubRun')}
                </Button>
              ) : null}
              {release.status === 'building' ? (
                <Button
                  disabled={actionPending}
                  icon={<RefreshCw size={14} />}
                  loading={reconcilingReleaseId === release.id}
                  size="small"
                  type="link"
                  onClick={() => void reconcileRelease(release.id)}
                >
                  {t('admin.desktopBuild.history.reconcile')}
                </Button>
              ) : null}
              {release.status === 'failed' ? (
                <AdminDangerousActionButton
                  actionId="desktop.release.retry"
                  disabled={actionPending}
                  icon={<RotateCcw size={14} />}
                  loading={retryingReleaseId === release.id}
                  size="small"
                  type="link"
                  onConfirm={async (envelope) => {
                    setRetryingReleaseId(release.id);
                    try {
                      await adminCommercialService.retryDesktopRelease(release.id, envelope);
                      message.success(t('admin.desktopBuild.history.retryStarted'));
                    } catch (error) {
                      message.error(t('admin.desktopBuild.history.retryFailed'));
                      throw error;
                    } finally {
                      await refreshReleaseData();
                      setRetryingReleaseId(undefined);
                    }
                  }}
                >
                  {t('admin.desktopBuild.history.retry')}
                </AdminDangerousActionButton>
              ) : null}
              {isCurrent ? (
                <Tag color="success" icon={<CheckCircle2 size={12} />}>
                  {t('admin.desktopBuild.history.current')}
                </Tag>
              ) : null}
              {release.status === 'succeeded' && !isCurrent ? (
                <AdminDangerousActionButton
                  actionId="desktop.release.activate"
                  disabled={actionPending || !hasPublication}
                  icon={<CheckCircle2 size={14} />}
                  loading={activatingReleaseId === release.id}
                  size="small"
                  title={hasPublication ? undefined : t('admin.desktopBuild.history.activateUnavailable')}
                  type="link"
                  onConfirm={async (envelope) => {
                    setActivatingReleaseId(release.id);
                    try {
                      await adminCommercialService.activateDesktopRelease(release.id, envelope);
                      message.success(t('admin.desktopBuild.history.activateSuccess'));
                    } catch (error) {
                      message.error(t('admin.desktopBuild.history.activateFailed'));
                      throw error;
                    } finally {
                      await refreshReleaseData(true);
                      setActivatingReleaseId(undefined);
                    }
                  }}
                >
                  {t('admin.desktopBuild.history.activate')}
                </AdminDangerousActionButton>
              ) : null}
              {!release.workflowRunUrl &&
              release.status !== 'building' &&
              release.status !== 'failed' &&
              release.status !== 'succeeded'
                ? '-'
                : null}
            </Space>
          );
        },
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
            pagination={{ defaultPageSize: 20, hideOnSinglePage: true, showSizeChanger: true }}
            rowKey="id"
            scroll={{ x: 1100 }}
            size="small"
          />
        </div>
      </section>
    );
  },
);

DesktopBuildHistory.displayName = 'DesktopBuildHistory';

export default DesktopBuildHistory;
