'use client';

import type { PlatformPluginListItem, PlatformPluginMarketplaceListInput } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Alert, Empty, Input, Select, Spin, Typography } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { platformPluginService } from '@/services/platformPlugin';

import { filterAndSortPlatformPlugins } from './helpers';
import PluginCard from './PluginCard';

const { Text, Title } = Typography;

const MARKETPLACE_KEY = ['platform-plugin-marketplace'];

const PlatformPluginMarket = memo(() => {
  const { t } = useTranslation('subscription');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [runtimeType, setRuntimeType] = useState<'all' | PlatformPluginListItem['runtimeType']>('all');

  const marketplaceFilters = useMemo<PlatformPluginMarketplaceListInput>(
    () => ({
      category: category === 'all' ? undefined : category,
      query: query.trim() || undefined,
      runtimeType: runtimeType === 'all' ? undefined : runtimeType,
    }),
    [category, query, runtimeType],
  );

  const { data, error, isLoading } = useClientDataSWR([...MARKETPLACE_KEY, marketplaceFilters], () =>
    platformPluginService.listMarketplace(marketplaceFilters),
  );

  const plugins = (data ?? []) as PlatformPluginListItem[];
  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(plugins.map((plugin) => plugin.category).filter(Boolean))).sort();

    return [
      { label: t('platformPlugins.marketplace.filters.allCategories'), value: 'all' },
      ...categories.map((item) => ({ label: item, value: item })),
    ];
  }, [plugins, t]);

  const filteredPlugins = useMemo(
    () => filterAndSortPlatformPlugins(plugins, marketplaceFilters),
    [marketplaceFilters, plugins],
  );

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" justify="space-between" gap={16}>
        <Flexbox gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            {t('platformPlugins.marketplace.title')}
          </Title>
          <Text type="secondary">{t('platformPlugins.marketplace.description')}</Text>
        </Flexbox>
        <Flexbox horizontal gap={8}>
          <Input.Search
            allowClear
            placeholder={t('platformPlugins.marketplace.searchPlaceholder')}
            style={{ width: 220 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            aria-label={t('platformPlugins.marketplace.filters.category')}
            options={categoryOptions}
            style={{ width: 160 }}
            value={category}
            onChange={setCategory}
          />
          <Select
            aria-label={t('platformPlugins.marketplace.filters.runtime')}
            options={[
              { label: t('platformPlugins.marketplace.filters.allRuntimeTypes'), value: 'all' },
              { label: t('platformPlugins.marketplace.runtime.apiAction'), value: 'api_action' },
              {
                label: t('platformPlugins.marketplace.runtime.contentGeneration'),
                value: 'content_generation',
              },
            ]}
            style={{ width: 160 }}
            value={runtimeType}
            onChange={setRuntimeType}
          />
        </Flexbox>
      </Flexbox>

      {error ? (
        <Alert showIcon message={t('platformPlugins.marketplace.loadError')} type="error" />
      ) : null}
      {isLoading ? (
        <Flexbox align="center" padding={48}>
          <Spin />
        </Flexbox>
      ) : filteredPlugins.length === 0 ? (
        <Empty description={t('platformPlugins.marketplace.empty')} />
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
