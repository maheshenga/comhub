'use client';

import type { PlatformPluginDetail } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Descriptions, Empty, Input, message, Spin, Tag, Typography } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { platformPluginService } from '@/services/platformPlugin';

import {
  formatPlatformPluginRuntimeType,
  getPlatformPluginBillingSummary,
  getPlatformPluginRestrictionReason,
  isPlatformPluginRunnable,
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

const PluginDetailView = memo<PluginDetailViewProps>(({ initialAgentId = '', plugin }) => {
  const { t } = useTranslation('subscription');
  const [agentId, setAgentId] = useState(initialAgentId);
  const [submitting, setSubmitting] = useState(false);
  const restrictionReason = getPlatformPluginRestrictionReason(plugin);
  const action = plugin.actions[0];
  const runsKey = ['platform-plugin-runs', plugin.id];
  const { data: runHistory } = useClientDataSWR(runsKey, () =>
    platformPluginService.listRuns({ pluginId: plugin.id }),
  );

  useEffect(() => {
    setAgentId(initialAgentId);
  }, [initialAgentId]);

  const refresh = async () => {
    await Promise.all([
      mutate(['platform-plugin-detail', plugin.slug]),
      mutate(['platform-plugin-detail', plugin.id]),
      mutate(['platform-plugin-marketplace']),
      mutate(runsKey),
    ]);
  };

  const runAction = async (actionFn: () => Promise<unknown>, success: string) => {
    try {
      setSubmitting(true);
      await actionFn();
      await refresh();
      message.success(success);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败');
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
                runAction(() => platformPluginService.uninstall({ pluginId: plugin.id }), '插件已卸载')
              }
            >
              卸载
            </Button>
          ) : (
            <Button
              loading={submitting}
              type="primary"
              onClick={() =>
                runAction(() => platformPluginService.install({ pluginId: plugin.id }), '插件已安装')
              }
            >
              安装
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
        <Tag>{formatPlatformPluginRuntimeType(plugin.runtimeType)}</Tag>
        <Tag>{getPlatformPluginBillingSummary(plugin)}</Tag>
        <Tag color={plugin.planState.visible ? 'green' : 'orange'}>可见</Tag>
        <Tag color={plugin.planState.installable ? 'green' : 'orange'}>可安装</Tag>
        <Tag color={plugin.planState.runnable ? 'green' : 'orange'}>可运行</Tag>
      </Flexbox>

      <PluginRestrictionNotice reason={restrictionReason} />

      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Slug">{plugin.slug}</Descriptions.Item>
        <Descriptions.Item label="版本">{plugin.version}</Descriptions.Item>
        <Descriptions.Item label="标签" span={2}>
          {plugin.tags.length > 0 ? plugin.tags.join(' / ') : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Flexbox gap={8}>
        <Text strong>Agent 绑定</Text>
        <Flexbox horizontal gap={8}>
          <Input
            placeholder="输入 Agent ID"
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
                'Agent 绑定已启用',
              )
            }
          >
            启用
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
                'Agent 绑定已关闭',
              )
            }
          >
            关闭
          </Button>
        </Flexbox>
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>运行插件</Text>
        {!plugin.installed ? <Alert showIcon message="安装后可配置 Agent 并运行插件" type="info" /> : null}
        <PluginRunPanel
          action={action}
          agentId={agentId}
          disabled={!isPlatformPluginRunnable(plugin)}
          pluginId={plugin.id}
        />
      </Flexbox>

      <Flexbox gap={8}>
        <Text strong>{t('platformPlugins.runHistory.title')}</Text>
        <PluginRunHistory items={runHistory?.items ?? []} />
      </Flexbox>
    </Flexbox>
  );
});

PluginDetailView.displayName = 'PluginDetailView';

export const PlatformPluginDetailPage = memo(() => {
  const { pluginId } = useParams();
  const [searchParams] = useSearchParams();
  const initialAgentId = searchParams.get('agentId') ?? '';
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

  if (error) return <Alert showIcon message="插件详情加载失败" type="error" />;
  if (!data) return <Empty description="插件不存在或当前套餐不可见" />;

  return <PluginDetailView initialAgentId={initialAgentId} plugin={data} />;
});

PlatformPluginDetailPage.displayName = 'PlatformPluginDetailPage';

export default PluginDetailView;
