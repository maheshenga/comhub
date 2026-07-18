import { ProviderIcon } from '@lobehub/icons';
import { Flexbox, Tag, Text, Tooltip } from '@lobehub/ui';
import { type TableColumnType } from 'antd';
import { cssVar } from 'antd-style';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import BusinessMobileRecordList from '@/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList';
import {
  buildUsageRecord,
  type BusinessRecordFormatters,
} from '@/business/client/BusinessSettingPages/mobile/businessRecordBuilders';
import InlineTable from '@/components/InlineTable';
import { parseAsInteger, useQueryParam } from '@/hooks/useQueryParam';
import { useClientDataSWR } from '@/libs/swr';
import { statsKeys } from '@/libs/swr/keys';
import { usageService } from '@/services/usage';
import { formatDate, formatNumber } from '@/utils/format';

import { type UsageChartProps } from '../../types';

const formatUsageSpend = (value: number) =>
  new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 6,
    minimumFractionDigits: 6,
    style: 'currency',
  }).format(value);

const UsageTable = memo<UsageChartProps>(({ dateStrings, mobile }) => {
  const { t } = useTranslation('auth');

  const { data, error, isLoading, mutate } = useClientDataSWR(statsKeys.usageLogs(), async () =>
    usageService.findByMonth(dateStrings),
  );

  const [currentPage, setCurrentPage] = useQueryParam('current', parseAsInteger.withDefault(1), {
    clearOnDefault: true,
  });
  const [pageSize, setPageSize] = useQueryParam('pageSize', parseAsInteger.withDefault(5), {
    clearOnDefault: true,
  });

  useEffect(() => {
    if (dateStrings) {
      mutate();
    }
  }, [dateStrings, mutate]);

  const typeLabels: Record<string, string> = {
    chat: t('usage.type.chat', { defaultValue: '对话' }),
    embedding: t('usage.type.embedding', { defaultValue: '嵌入' }),
    image: t('usage.type.image', { defaultValue: '图片' }),
    ppt: t('usage.type.ppt', { defaultValue: 'PPT' }),
    structured_output: t('usage.type.structuredOutput', { defaultValue: '结构化输出' }),
    video: t('usage.type.video', { defaultValue: '视频' }),
  };

  const columns: TableColumnType<any>[] = [
    {
      hidden: true,
      key: 'id',
      title: 'ID',
    },
    {
      dataIndex: 'model',
      key: 'model',
      render: (value, record) => (
        <Flexbox horizontal align={'start'} gap={16}>
          <ProviderIcon
            provider={record.provider}
            size={18}
            style={{
              border: `2px solid ${cssVar.colorBgContainer}`,
              boxSizing: 'content-box',
              marginRight: -8,
            }}
          />
          <Tooltip title={value}>
            <Text>{value?.length > 12 ? `${value.slice(0, 12)}...` : value}</Text>
          </Tooltip>
        </Flexbox>
      ),
      title: t('usage.table.model'),
    },
    {
      dataIndex: 'type',
      filters: Object.entries(typeLabels).map(([value, text]) => ({ text, value })),
      key: 'type',
      onFilter: (value, record) => record.type === value,
      render: (value) => {
        return <Tag>{typeLabels[value] ?? value}</Tag>;
      },
      title: t('usage.table.type'),
    },
    {
      dataIndex: 'totalInputTokens',
      key: 'inputTokens',
      title: t('usage.table.inputTokens'),
    },
    {
      dataIndex: 'totalOutputTokens',
      key: 'outputTokens',
      title: t('usage.table.outputTokens'),
    },
    {
      dataIndex: 'tps',
      key: 'tps',
      render: (value) => formatNumber(value, 2),
      title: t('usage.table.tps'),
    },
    {
      dataIndex: 'ttft',
      key: 'ttft',
      render: (value) => formatNumber(value / 1000, 2),
      title: t('usage.table.ttft'),
    },
    {
      dataIndex: 'spend',
      key: 'spend',
      render: (value) => `$${formatNumber(value, 6)}`,
      title: t('usage.table.spend'),
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => {
        return formatDate(new Date(value));
      },
      sortDirections: ['descend'],
      sorter: (a, b) => a.createdAt - b.createdAt,
      title: t('usage.table.createdAt'),
    },
  ];

  const usageFormatters: Pick<
    BusinessRecordFormatters,
    'formatCurrency' | 'formatDate' | 'formatNumber' | 't'
  > = {
    formatCurrency: formatUsageSpend,
    formatDate: (value) => (value ? formatDate(new Date(value)) : '--'),
    formatNumber,
    t: (key, options) =>
      t((key.startsWith('mobile.') ? `subscription:${key}` : key) as any, options as any),
  };

  return mobile ? (
    <BusinessMobileRecordList
      emptyDescription={t('subscription:mobile.usage.records.empty')}
      error={error ? t('subscription:mobile.error.title') : undefined}
      isLoading={isLoading}
      onRetry={() => void mutate()}
      records={(data ?? []).map((item) => buildUsageRecord(item, usageFormatters))}
      sheetTitle={t('subscription:mobile.usage.records.details')}
    />
  ) : (
    <InlineTable
      columns={columns}
      dataSource={data}
      loading={isLoading}
      rowKey={(record) => record.id || `${record.model}-${record.createdAt}-${record.provider}`}
      size="small"
      pagination={{
        current: currentPage,
        onChange: (page) => {
          setCurrentPage(page);
        },
        onShowSizeChange: (current, size) => {
          setCurrentPage(current);
          setPageSize(size);
        },
        pageSize,
      }}
    />
  );
});

export default UsageTable;
