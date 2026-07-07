'use client';

import type { PlatformPluginListItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Tag, Typography } from 'antd';
import { memo } from 'react';
import { useNavigate } from 'react-router';

import {
  formatPlatformPluginRuntimeType,
  getPlatformPluginBillingSummary,
  getPlatformPluginRestrictionReason,
} from './helpers';

const { Paragraph, Text, Title } = Typography;

type PluginCardProps = {
  plugin: PlatformPluginListItem;
};

const PluginCard = memo<PluginCardProps>(({ plugin }) => {
  const navigate = useNavigate();
  const restrictionReason = getPlatformPluginRestrictionReason(plugin);

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
        <Tag color={plugin.installed ? 'green' : 'default'}>
          {plugin.installed ? '已安装' : '未安装'}
        </Tag>
      </Flexbox>

      <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
        {plugin.tags.length > 0 ? plugin.tags.join(' / ') : '平台插件'}
      </Paragraph>

      <Flexbox horizontal gap={4} wrap="wrap">
        <Tag>{formatPlatformPluginRuntimeType(plugin.runtimeType)}</Tag>
        <Tag>{getPlatformPluginBillingSummary(plugin)}</Tag>
        {restrictionReason ? <Tag color="orange">受限</Tag> : <Tag color="green">可运行</Tag>}
      </Flexbox>

      <Button style={{ marginTop: 'auto' }} type="primary" onClick={() => navigate(`/plugins/${plugin.slug}`)}>
        查看详情
      </Button>
    </Flexbox>
  );
});

PluginCard.displayName = 'PluginCard';

export default PluginCard;
