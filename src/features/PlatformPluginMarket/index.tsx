'use client';

import type { PlatformPluginListItem } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Empty, Input, Select, Spin, Typography } from 'antd';
import { memo, useMemo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { platformPluginService } from '@/services/platformPlugin';

import PluginCard from './PluginCard';

const { Text, Title } = Typography;

const MARKETPLACE_KEY = ['platform-plugin-marketplace'];

const PlatformPluginMarket = memo(() => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const { data, error, isLoading } = useClientDataSWR(MARKETPLACE_KEY, () =>
    platformPluginService.listMarketplace(),
  );

  const plugins = (data ?? []) as PlatformPluginListItem[];
  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(plugins.map((plugin) => plugin.category).filter(Boolean))).sort();
    return [{ label: '全部分类', value: 'all' }, ...categories.map((item) => ({ label: item, value: item }))];
  }, [plugins]);
  const filteredPlugins = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const matchCategory = category === 'all' || plugin.category === category;
      const matchKeyword =
        !keyword ||
        plugin.displayName.toLowerCase().includes(keyword) ||
        plugin.slug.toLowerCase().includes(keyword) ||
        plugin.tags.some((tag) => tag.toLowerCase().includes(keyword));

      return matchCategory && matchKeyword;
    });
  }, [category, plugins, query]);

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" justify="space-between" gap={16}>
        <Flexbox gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            插件市场
          </Title>
          <Text type="secondary">安装由平台提供的功能插件，并按套餐权限在 Agent 中运行。</Text>
        </Flexbox>
        <Flexbox horizontal gap={8}>
          <Input.Search
            allowClear
            placeholder="搜索插件"
            style={{ width: 220 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            options={categoryOptions}
            style={{ width: 160 }}
            value={category}
            onChange={setCategory}
          />
        </Flexbox>
      </Flexbox>

      {error ? <Alert showIcon message="插件市场加载失败" type="error" /> : null}
      {isLoading ? (
        <Flexbox align="center" padding={48}>
          <Spin />
        </Flexbox>
      ) : filteredPlugins.length === 0 ? (
        <Empty description="暂无可用插件" />
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}
        >
          {filteredPlugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      )}
    </Flexbox>
  );
});

PlatformPluginMarket.displayName = 'PlatformPluginMarket';

export default PlatformPluginMarket;
