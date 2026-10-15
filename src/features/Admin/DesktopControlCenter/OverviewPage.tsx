'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Alert, Button, Tag, Text } from '@lobehub/ui/base-ui';
import { Settings2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type AdminMetric, AdminMetricStrip, AdminPageError } from '../layout';
import { AdminInlineSkeleton } from '../shared';
import { desktopControlCenterStyles } from './styles';
import {
  DESKTOP_CHANNEL_LABEL_KEYS,
  DESKTOP_PLATFORM_LABEL_KEYS,
  DESKTOP_REASON_LABEL_KEYS,
  type DesktopChannel,
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

  if (resource.isLoading) return <AdminInlineSkeleton rows={4} />;

  if (resource.error) {
    return (
      <AdminPageError
        retryLabel={t('admin.desktopControl.retry')}
        title={t('admin.desktopControl.error.title')}
        description={t(
          'admin.desktopControl.error.description',
          '无法读取桌面端诊断信息，请重试。',
        )}
        onRetry={() => void resource.mutate()}
      />
    );
  }

  const data = resource.data;
  if (!data) return null;

  const statusItems: AdminMetric[] = [
    {
      key: 'configuredVersion',
      label: t('admin.desktopControl.status.configuredVersion'),
      value: data.configuredVersion || '-',
    },
    {
      key: 'stable',
      label: t('admin.desktopControl.status.stable'),
      value: data.diagnostics.channels.find(({ channel }) => channel === 'stable')?.version || '-',
    },
    {
      key: 'canary',
      label: t('admin.desktopControl.status.canary'),
      value: data.diagnostics.channels.find(({ channel }) => channel === 'canary')?.version || '-',
    },
    {
      key: 'checkedAt',
      label: t('admin.desktopControl.status.checkedAt'),
      value: new Date(data.diagnostics.checkedAt).toLocaleString(),
    },
  ];

  return (
    <Flexbox gap={24}>
      {!data.diagnostics.configured ? (
        <Alert
          showIcon
          description={t('admin.desktopControl.unconfigured.description')}
          message={t('admin.desktopControl.unconfigured.title')}
          type="warning"
          action={
            <Button icon={<Icon icon={Settings2} size={16} />} onClick={onConfigure}>
              {t('admin.desktopControl.configure')}
            </Button>
          }
        />
      ) : null}

      <AdminMetricStrip items={statusItems} label={t('admin.desktopControl.status.label')} />

      <section className={desktopControlCenterStyles.channelSection}>
        <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
          {t('admin.desktopControl.policy.title')}
        </Text>
        <AdminMetricStrip
          label={t('admin.desktopControl.policy.title')}
          items={[
            {
              key: 'autoCheck',
              label: t('admin.desktopControl.policy.autoCheck'),
              value: (
                <Tag color={data.runtimePolicy.autoCheck ? 'success' : 'default'}>
                  {t(
                    data.runtimePolicy.autoCheck
                      ? 'admin.desktopControl.policy.enabled'
                      : 'admin.desktopControl.policy.disabled',
                  )}
                </Tag>
              ),
            },
            {
              key: 'defaultChannel',
              label: t('admin.desktopControl.policy.defaultChannel'),
              value: t(DESKTOP_CHANNEL_LABEL_KEYS[data.runtimePolicy.channel as DesktopChannel]),
            },
            {
              key: 'checkInterval',
              label: t('admin.desktopControl.policy.checkInterval'),
              value: `${data.runtimePolicy.checkInterval} ${t('admin.desktopControl.policy.minutes')}`,
            },
          ]}
        />
      </section>

      <section className={desktopControlCenterStyles.channelSection}>
        <Flexbox horizontal align="center" justify="space-between">
          <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
            {t('admin.desktopControl.automation.title')}
          </Text>
          <Tag color={data.automation.configured ? 'success' : 'warning'}>
            {t(
              data.automation.configured
                ? 'admin.desktopControl.automation.configured'
                : 'admin.desktopControl.automation.unconfigured',
            )}
          </Tag>
        </Flexbox>
        {!data.automation.configured ? (
          <Alert
            showIcon
            message={t('admin.desktopControl.automation.unconfiguredDescription')}
            type="warning"
          />
        ) : null}
        <AdminMetricStrip
          label={t('admin.desktopControl.automation.title')}
          items={[
            {
              key: 'repository',
              label: t('admin.desktopControl.automation.repository'),
              value: data.automation.repository || '-',
            },
            {
              key: 'ref',
              label: t('admin.desktopControl.automation.ref'),
              value: data.automation.ref || '-',
            },
            {
              key: 'workflow',
              label: t('admin.desktopControl.automation.workflow'),
              value: data.automation.workflowFile,
            },
            {
              key: 'token',
              label: t('admin.desktopControl.automation.token'),
              value: t(
                data.automation.tokenConfigured
                  ? 'admin.desktopControl.automation.tokenConfigured'
                  : 'admin.desktopControl.automation.tokenMissing',
              ),
            },
          ]}
        />
      </section>

      {data.diagnostics.channels.map((channel) => (
        <section className={desktopControlCenterStyles.channelSection} key={channel.channel}>
          <Flexbox horizontal align="center" justify="space-between">
            <Text as={'h4'} className={desktopControlCenterStyles.sectionTitle}>
              {t(DESKTOP_CHANNEL_LABEL_KEYS[channel.channel])}
            </Text>
            <Tag color={statusColor(channel.status)}>
              {t(`admin.desktopControl.channel.${channel.status}`)}
            </Tag>
          </Flexbox>
          {channel.status === 'unavailable' &&
          Object.values(channel.platforms).some(({ reason }) => reason) ? (
            <Alert
              showIcon
              type="warning"
              message={t(
                DESKTOP_REASON_LABEL_KEYS[
                  Object.values(channel.platforms).find(({ reason }) => reason)?.reason ||
                    'manifest-request-failed'
                ],
              )}
            />
          ) : null}
          <div className={desktopControlCenterStyles.channelGrid}>
            {Object.entries(channel.platforms).map(([type, artifact]) => (
              <div className={desktopControlCenterStyles.platformSummary} key={type}>
                <Text strong>
                  {t(DESKTOP_PLATFORM_LABEL_KEYS[type as keyof typeof DESKTOP_PLATFORM_LABEL_KEYS])}
                </Text>
                <Text ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                  {artifact.assetName ||
                    (artifact.reason ? t(DESKTOP_REASON_LABEL_KEYS[artifact.reason]) : '-')}
                </Text>
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
