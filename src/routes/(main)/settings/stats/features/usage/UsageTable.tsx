import { ProviderIcon } from '@lobehub/icons';
import { Flexbox, Icon, Input, Text, Tooltip } from '@lobehub/ui';
import { Button, Select } from '@lobehub/ui/base-ui';
import { DatePicker, type TableColumnType } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import dayjs, { type Dayjs } from 'dayjs';
import { Braces, Database, FileImage, FileText, MessageSquareText, Video } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import BusinessMobileRecordList from '@/business/client/BusinessSettingPages/mobile/BusinessMobileRecordList';
import {
  buildUsageRecord,
  type BusinessRecordFormatters,
} from '@/business/client/BusinessSettingPages/mobile/businessRecordBuilders';
import { formatCredits } from '@/business/client/BusinessSettingPages/shared';
import InlineTable from '@/components/InlineTable';
import { parseAsInteger, useQueryParam } from '@/hooks/useQueryParam';
import { useClientDataSWR } from '@/libs/swr';
import { statsKeys } from '@/libs/swr/keys';
import { usageService } from '@/services/usage';
import { type UsageRecordItem } from '@/types/usage/usageRecord';
import { formatDate, formatNumber } from '@/utils/format';

import { type UsageChartProps } from '../../types';

const formatUsageSpend = (value: number) =>
  new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 6,
    minimumFractionDigits: 6,
    style: 'currency',
  }).format(value);

const styles = createStaticStyles(({ css }) => ({
  filterBar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    @media (width <= 768px) {
      display: grid;
      grid-template-columns: 1fr;
    }
  `,
  modelFilter: css`
    flex: 1 1 220px;
    min-width: 180px;

    @media (width <= 768px) {
      width: 100%;
    }
  `,
  typeFilter: css`
    flex: 0 1 160px;
    min-width: 140px;

    @media (width <= 768px) {
      width: 100%;
    }
  `,
  dateFilter: css`
    flex: 1 1 260px;
    min-width: 240px;

    @media (width <= 768px) {
      width: 100%;
    }
  `,
  tokenBreakdown: css`
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: baseline;
  `,
}));

type UsageDateRange = [Dayjs | null, Dayjs | null] | null;

const UsageTable = memo<UsageChartProps>(({ dateStrings, mobile }) => {
  const { t } = useTranslation('auth');
  const { t: tSubscription } = useTranslation('subscription');

  const [modelQuery, setModelQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>();
  const [dateRange, setDateRange] = useState<UsageDateRange>(null);
  const rangeStart = dateRange?.[0]?.format('YYYY-MM-DD');
  const rangeEnd = dateRange?.[1]?.format('YYYY-MM-DD');

  const { data, error, isLoading, mutate } = useClientDataSWR(
    [...statsKeys.usageLogs(), rangeStart ?? dateStrings ?? null, rangeEnd ?? null],
    async () =>
      rangeStart && rangeEnd
        ? usageService.findByDateRange(rangeStart, rangeEnd)
        : usageService.findByMonth(dateStrings),
  );

  const [currentPage, setCurrentPage] = useQueryParam('current', parseAsInteger.withDefault(1), {
    clearOnDefault: true,
  });
  const [pageSize, setPageSize] = useQueryParam('pageSize', parseAsInteger.withDefault(5), {
    clearOnDefault: true,
  });
  const typeLabels: Record<string, string> = {
    chat: t('usage.type.chat', { defaultValue: '对话' }),
    embedding: t('usage.type.embedding', { defaultValue: '嵌入' }),
    image: t('usage.type.image', { defaultValue: '图片' }),
    ppt: t('usage.type.ppt', { defaultValue: 'PPT' }),
    structured_output: t('usage.type.structuredOutput', { defaultValue: '结构化输出' }),
    video: t('usage.type.video', { defaultValue: '视频' }),
  };
  const triggerLabels: Record<string, string> = {
    chat: '聊天消息',
    embedding: '向量嵌入',
    image: '图片生成',
    ppt: 'PPT 生成',
    structured_output: '结构化输出',
    video: '视频生成',
  };
  const typeIcons = {
    chat: MessageSquareText,
    embedding: Database,
    image: FileImage,
    ppt: FileText,
    structured_output: Braces,
    video: Video,
  } as const;

  const filteredData = useMemo(() => {
    const normalizedQuery = modelQuery.trim().toLocaleLowerCase();
    const [from, to] = dateRange ?? [];

    return ((data ?? []) as UsageRecordItem[]).filter((record) => {
      if (
        normalizedQuery &&
        !`${record.model} ${record.provider}`.toLocaleLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }

      if (typeFilter && record.type !== typeFilter) return false;

      const createdAt = dayjs(record.createdAt);
      if (from && createdAt.isBefore(from, 'day')) return false;
      if (to && createdAt.isAfter(to, 'day')) return false;

      return true;
    });
  }, [data, dateRange, modelQuery, typeFilter]);

  const resetPage = () => {
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setModelQuery('');
    setTypeFilter(undefined);
    setDateRange(null);
    resetPage();
  };

  const hasFilters = Boolean(modelQuery || typeFilter || dateRange);

  const filterControls = (
    <Flexbox horizontal className={styles.filterBar} width="100%">
      <Input
        allowClear
        aria-label="搜索模型"
        className={styles.modelFilter}
        placeholder={t('usage.filter.model', { defaultValue: '搜索模型' })}
        value={modelQuery}
        onChange={(event) => {
          setModelQuery(event.target.value);
          resetPage();
        }}
      />
      <Select
        allowClear
        aria-label="类型"
        className={styles.typeFilter}
        options={Object.entries(typeLabels).map(([value, label]) => ({ label, value }))}
        placeholder={t('usage.filter.type', { defaultValue: '全部类型' })}
        value={typeFilter}
        onChange={(value) => {
          setTypeFilter(value);
          resetPage();
        }}
      />
      <DatePicker.RangePicker
        allowClear
        className={styles.dateFilter}
        format="YYYY/MM/DD"
        value={dateRange}
        placeholder={[
          t('usage.filter.startDate', { defaultValue: '开始日期' }),
          t('usage.filter.endDate', { defaultValue: '结束日期' }),
        ]}
        onChange={(values) => {
          setDateRange(values ? [values[0], values[1]] : null);
          resetPage();
        }}
      />
      <Button disabled={!hasFilters} onClick={resetFilters}>
        重置
      </Button>
    </Flexbox>
  );

  const columns: TableColumnType<UsageRecordItem>[] = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => dayjs(value).format('MM-DD HH:mm:ss'),
      sortDirections: ['descend'],
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      title: '时间',
    },
    {
      dataIndex: 'type',
      key: 'type',
      render: (value) => (
        <Tooltip title={typeLabels[value] ?? value}>
          <Icon icon={typeIcons[value as keyof typeof typeIcons] ?? MessageSquareText} size={16} />
        </Tooltip>
      ),
      title: '类型',
      width: 64,
    },
    {
      dataIndex: 'type',
      key: 'trigger',
      render: (value) => triggerLabels[value] ?? typeLabels[value] ?? value,
      title: '触发方式',
    },
    {
      dataIndex: 'model',
      key: 'model',
      render: (value, record) => (
        <Flexbox horizontal align={'center'} gap={8}>
          <ProviderIcon
            provider={record.provider}
            size={18}
            style={{
              border: `2px solid ${cssVar.colorBgContainer}`,
              boxSizing: 'content-box',
            }}
          />
          <Tooltip title={value}>
            <Text>{value}</Text>
          </Tooltip>
        </Flexbox>
      ),
      title: '模型',
    },
    {
      key: 'tokens',
      render: (_, record) => (
        <span className={styles.tokenBreakdown}>
          <strong>{formatNumber(record.totalTokens ?? 0)}</strong>
          <span>=</span>
          <span>{formatNumber(record.totalInputTokens ?? 0)}</span>
          <span>+</span>
          <span>{formatNumber(record.totalOutputTokens ?? 0)}</span>
        </span>
      ),
      title: 'Token 使用量',
    },
    {
      key: 'credits',
      render: (_, record) => formatNumber(record.credits ?? 0),
      title: '消耗积分',
    },
    {
      key: 'duration',
      render: (_, record: UsageRecordItem) => {
        const duration =
          record.metadata?.performance?.latency ?? record.metadata?.performance?.duration;

        if (!duration) return '--';

        return (
          <Tooltip
            title={`TTFT ${formatNumber((record.ttft ?? 0) / 1000, 2)}s · TPS ${formatNumber(record.tps ?? 0, 2)}`}
          >
            <span>{formatNumber(duration / 1000, 2)}s</span>
          </Tooltip>
        );
      },
      title: '耗时',
    },
  ];

  const usageFormatters: Pick<
    BusinessRecordFormatters,
    'formatCredits' | 'formatCurrency' | 'formatDate' | 'formatNumber' | 't'
  > = {
    formatCredits,
    formatCurrency: formatUsageSpend,
    formatDate: (value) => (value ? formatDate(new Date(value)) : '--'),
    formatNumber,
    t: (key, options) =>
      key.startsWith('mobile.')
        ? tSubscription(key as any, options as any)
        : t(key as any, options as any),
  };

  return (
    <Flexbox gap={12} width="100%">
      {filterControls}
      {mobile ? (
        <BusinessMobileRecordList
          emptyDescription={tSubscription('mobile.usage.records.empty')}
          error={error ? tSubscription('mobile.error.title') : undefined}
          isLoading={isLoading}
          records={filteredData.map((item) => buildUsageRecord(item, usageFormatters))}
          sheetTitle={tSubscription('mobile.usage.records.details')}
          onRetry={() => void mutate()}
        />
      ) : (
        <InlineTable
          columns={columns as any}
          dataSource={filteredData}
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
      )}
    </Flexbox>
  );
});

export default UsageTable;
