'use client';

import type { PlatformPluginDetail, PlatformPluginRunHistoryItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Descriptions, Empty, Input, message, Spin, Tag, Typography } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { platformPluginService } from '@/services/platformPlugin';

import {
  getPlatformPluginBillingSummaryValues,
  getPlatformPluginDetailActionErrorCopyKey,
  getPlatformPluginRestrictionReason,
  getPlatformPluginRuntimeLabelKey,
  isPlatformPluginRunnable,
  mergePlatformPluginRunHistoryItems,
} from './helpers';
import PluginRestrictionNotice from './PluginRestrictionNotice';
import PluginRunHistory from './PluginRunHistory';
import PluginRunPanel from './PluginRunPanel';

const { Paragraph, Text, Title } = Typography;

type PluginDetailViewProps = {
  initialAgentId?: string;
  plugin: PlatformPluginDetail;
};

const detailKey = (pluginIdOrSlug?: string) =>
  pluginIdOrSlug ? ['platform-plugin-detail', pluginIdOrSlug] : null;

const RUN_HISTORY_LIMIT = 20;
const availabilityColor = (available: boolean) => (available ? 'green' : 'orange');

const PluginDetailView = memo<PluginDetailViewProps>(({ initialAgentId = '', plugin }) => {
  const { t } = useTranslation('subscription');
  const [agentId, setAgentId] = useState(initialAgentId);
  const [loadingMoreRuns, setLoadingMoreRuns] = useState(false);
  const [nextRunCursor, setNextRunCursor] = useState<null | number>(null);
  const [runHistoryItems, setRunHistoryItems] = useState<PlatformPluginRunHistoryItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const restrictionReason = getPlatformPluginRestrictionReason(plugin);
  const action = plugin.actions[0];
  const runsKey = ['platform-plugin-runs', plugin.id];
  const billingSummary = getPlatformPluginBillingSummaryValues(plugin);
  const { data: runHistory } = useClientDataSWR(runsKey, () =>
    platformPluginService.listRuns({ limit: RUN_HISTORY_LIMIT, pluginId: plugin.id }),
  );

  useEffect(() => {
    setAgentId(initialAgentId);
  }, [initialAgentId]);

  useEffect(() => {
    setRunHistoryItems(runHistory?.items ?? []);
    setNextRunCursor(runHistory?.nextCursor ?? null);
  }, [runHistory]);

  const refresh = async () => {
    await Promise.all([
      mutate(['platform-plugin-detail', plugin.slug]),
      mutate(['platform-plugin-detail', plugin.id]),
      mutate(['platform-plugin-marketplace']),
      mutate(runsKey),
    ]);
  };

  const loadMoreRuns = async () => {
    if (nextRunCursor === null) return;
    setLoadingMoreRuns(true);
    try {
      const nextPage = await platformPluginService.listRuns({
        cursor: nextRunCursor,
        limit: RUN_HISTORY_LIMIT,
        pluginId: plugin.id,
      });
      setRunHistoryItems((items) => mergePlatformPluginRunHistoryItems(items, nextPage.items));
      setNextRunCursor(nextPage.nextCursor);
    } finally {
      setLoadingMoreRuns(false);
    }
  };

  const runAction = async (actionFn: () => Promise<unknown>, successMessage: string) => {
    try {
      setSubmitting(true);
      await actionFn();
      await refresh();
      message.success(successMessage);
    } catch (error) {
      message.error(t(getPlatformPluginDetailActionErrorCopyKey(error)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 960 }}>
      <Flexbox horizontal align="flex-start" justify="space-between" gap={16}>
        <Flexbox gap={6}>
          <Title level={3} style={{ margin: 0 }}>
            {plugin.displayName}
          </Title>
          <Text type="secondary">{plugin.category}</Text>
        </Flexbox>
        <Flexbox horizontal gap={8}>
          {plugin.installed ? (
            <Button
              loading={submitting}
              onClick={() =>
                runAction(
                  () => platformPluginService.uninstall({ pluginId: plugin.id }),
                  t('platformPlugins.detail.uninstalled'),
                )
              }
            >
              {t('platformPlugins.detail.uninstall')}
            </Button>
          ) : (
            <Button
              loading={submitting}
              type="primary"
              onClick={() =>
                runAction(
                  () => platformPluginService.install({ pluginId: plugin.id }),
                  t('platformPlugins.detail.installed'),
                )
              }
            >
              {t('platformPlugins.detail.install')}
            </Button>
          )}
        </Flexbox>
      </Flexbox>

      <Paragraph style={{ margin: 0 }}>{plugin.description}</Paragraph>

      {plugin.operations.useCase ? <Alert message={plugin.operations.useCase} showIcon type="info" /> : null}
      {restrictionReason && plugin.operations.upgradeCta ? (
        <Alert message={plugin.operations.upgradeCta} showIcon type="warning" />
      ) : null}
      {plugin.operations.planBenefitSummary ? (
        <Text type="secondary">{plugin.operations.planBenefitSummary}</Text>
      ) : null}

      <Flexbox horizontal gap={4} wrap="wrap">
        <Tag>{t(getPlatformPluginRuntimeLabelKey(plugin.runtimeType))}</Tag>
        <Tag>
          {t('platformPlugins.marketplace.billingSummary', {
            fixedCredits: billingSummary.fixedCredits,
            multiplier: billingSummary.multiplier,
          })}
        </Tag>
        <Tag color={availabilityColor(plugin.planState.visible)}>
          {t('platformPlugins.detail.available.visible')}
        </Tag>
        <Tag color={availabilityColor(plugin.planState.installable)}>
          {t('platformPlugins.detail.available.installable')}
        </Tag>
        <Tag color={availabilityColor(plugin.planState.runnable)}>
          {t('platformPlugins.detail.available.runnable')}
        </Tag>
      </Flexbox>

      <PluginRestrictionNotice reason={restrictionReason} />

      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label={t('platformPlugins.detail.slug')}>{plugin.slug}</Descriptions.Item>
        <Descriptions.Item label={t('platformPlugins.detail.version')}>
          {plugin.version}
        </Descriptions.Item>
        <Descriptions.Item label={t('platformPlugins.detail.tags')} span={2}>
          {plugin.tags.length > 0 ? plugin.tags.join(' / ') : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Flexbox gap={8}>
        <Text strong>{t('platformPlugins.detail.agentBinding')}</Text>
        <Flexbox horizontal gap={8}>
          <Input
            placeholder={t('platformPlugins.detail.agentIdPlaceholder')}
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
          />
          <Button
            disabled={!plugin.installed || !agentId.trim()}
            loading={submitting}
            onClick={() =>
              runAction(
                () =>
                  platformPluginService.setAgentBinding({
                    agentId: agentId.trim(),
                    enabled: true,
                    pluginId: plugin.id,
                  }),
                t('platformPlugins.detail.agentBindingEnabled'),
              )
            }
          >
            {t('platformPlugins.detail.enable')}
          </Button>
          <Button
            disabled={!agentId.trim()}
            loading={submitting}
            onClick={() =>
              runAction(
                () =>
                  platformPluginService.setAgentBinding({
                    agentId: agentId.trim(),
                    enabled: false,
                    pluginId: plugin.id,
                  }),
                t('platformPlugins.detail.agentBindingDisabled'),
              )
            }
          >
            {t('platformPlugins.detail.agentBindingDisabled')}
          </Button>
        </Flexbox>
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>{t('platformPlugins.detail.runPlugin')}</Text>
        {!plugin.installed ? (
          <Alert showIcon message={t('platformPlugins.detail.installRequired')} type="info" />
        ) : null}
        <PluginRunPanel
          action={action}
          agentId={agentId}
          disabled={!isPlatformPluginRunnable(plugin)}
          onRunComplete={refresh}
          pluginId={plugin.id}
        />
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>{t('platformPlugins.runHistory.title')}</Text>
        <PluginRunHistory
          hasMore={nextRunCursor !== null}
          items={runHistoryItems}
          loadingMore={loadingMoreRuns}
          onLoadMore={loadMoreRuns}
        />
      </Flexbox>
    </Flexbox>
  );
});

PluginDetailView.displayName = 'PluginDetailView';

export const PlatformPluginDetailPage = memo(() => {
  const { pluginId } = useParams();
  const [searchParams] = useSearchParams();
  const initialAgentId = searchParams.get('agentId') ?? '';
  const { t } = useTranslation('subscription');
  const { data, error, isLoading } = useClientDataSWR(detailKey(pluginId), () =>
    platformPluginService.getDetail({ pluginIdOrSlug: pluginId! }),
  );

  if (isLoading) {
    return (
      <Flexbox align="center" padding={48}>
        <Spin />
      </Flexbox>
    );
  }

  if (error) return <Alert showIcon message={t('platformPlugins.detail.loadError')} type="error" />;
  if (!data) return <Empty description={t('platformPlugins.detail.missing')} />;

  return <PluginDetailView initialAgentId={initialAgentId} plugin={data} />;
});

PlatformPluginDetailPage.displayName = 'PlatformPluginDetailPage';

export default PluginDetailView;
