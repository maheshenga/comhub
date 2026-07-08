'use client';

import type { PlatformPluginListItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Tag, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  getPlatformPluginBillingSummaryValues,
  getPlatformPluginPlanStatusLabel,
  getPlatformPluginRuntimeLabelKey,
} from './helpers';

const { Paragraph, Text, Title } = Typography;

type PluginCardProps = {
  plugin: PlatformPluginListItem;
};

const PluginCard = memo<PluginCardProps>(({ plugin }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('subscription');
  const billingSummary = getPlatformPluginBillingSummaryValues(plugin);
  const installedStatusKey = plugin.installed
    ? 'platformPlugins.marketplace.status.installed'
    : 'platformPlugins.marketplace.status.uninstalled';
  const planStatus = getPlatformPluginPlanStatusLabel(plugin);

  return (
    <Flexbox
      gap={12}
      padding={16}
      style={{
        border: '1px solid var(--lobe-color-border-secondary)',
        borderRadius: 8,
        minHeight: 190,
      }}
    >
      <Flexbox horizontal align="flex-start" justify="space-between" gap={12}>
        <Flexbox gap={4}>
          <Title level={5} style={{ margin: 0 }}>
            {plugin.displayName}
          </Title>
          <Text type="secondary">{plugin.category}</Text>
        </Flexbox>
        <Tag color={plugin.installed ? 'green' : 'default'}>{t(installedStatusKey)}</Tag>
      </Flexbox>

      <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
        {plugin.tags.length > 0
          ? plugin.tags.join(' / ')
          : t('platformPlugins.marketplace.fallbackTag')}
      </Paragraph>

      <Flexbox horizontal gap={4} wrap="wrap">
        {plugin.operations.featured ? (
          <Tag color="gold">{t('platformPlugins.marketplace.featured')}</Tag>
        ) : null}
        {plugin.operations.promoLabel ? <Tag color="blue">{plugin.operations.promoLabel}</Tag> : null}
        <Tag>{t(getPlatformPluginRuntimeLabelKey(plugin.runtimeType))}</Tag>
        <Tag>
          {t('platformPlugins.marketplace.billingSummary', {
            fixedCredits: billingSummary.fixedCredits,
            multiplier: billingSummary.multiplier,
          })}
        </Tag>
        <Tag color={planStatus.color}>{t(planStatus.labelKey)}</Tag>
      </Flexbox>

      <Button style={{ marginTop: 'auto' }} type="primary" onClick={() => navigate(`/plugins/${plugin.slug}`)}>
        {t('platformPlugins.marketplace.action.viewDetails')}
      </Button>
    </Flexbox>
  );
});

PluginCard.displayName = 'PluginCard';

export default PluginCard;
