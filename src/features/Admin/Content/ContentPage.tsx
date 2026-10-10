'use client';

import { Alert, Button, Select, toast } from '@lobehub/ui/base-ui';
import { Empty, Input } from 'antd';
import { RefreshCw } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageShell, AdminResponsiveTable, AdminSection, AdminToolbar } from '../layout';
import { buildContentColumns } from './contentColumns';
import {
  type ContentDeleteCommand,
  type ContentMode,
  type DocumentSourceType,
  getModeCopy,
  PAGE_SIZE,
  sourceTypeOptions,
  type TopicStatus,
} from './shared';
import { contentStyles } from './styles';

const AdminContentPage = memo<{ mode: ContentMode }>(({ mode }) => {
  const copy = getModeCopy(mode);
  const [cursor, setCursor] = useState(0);
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState<TopicStatus | undefined>();
  const [sourceType, setSourceType] = useState<DocumentSourceType | undefined>();
  const [actingId, setActingId] = useState<string | null>(null);

  const swrKey = useMemo(
    () => ['admin-content', mode, cursor, query, userId, status ?? '', sourceType ?? ''] as const,
    [cursor, mode, query, sourceType, status, userId],
  );

  const { data, error, isLoading } = useClientDataSWR(swrKey, () => {
    const common = {
      cursor,
      limit: PAGE_SIZE,
      query: query || undefined,
      userId: userId || undefined,
    };

    if (mode === 'topics') {
      return adminCommercialService.listAdminTopics({ ...common, status });
    }
    if (mode === 'files') {
      return adminCommercialService.listAdminFiles(common);
    }
    return adminCommercialService.listAdminDocuments({ ...common, sourceType });
  });

  const resetFilters = () => {
    setCursor(0);
  };

  const refresh = useCallback(async () => mutate(swrKey), [swrKey]);

  const runAction = useCallback(
    async (
      id: string,
      action: 'archive-topic' | 'delete-document' | 'delete-file' | 'delete-topic',
      command?: ContentDeleteCommand,
    ) => {
      setActingId(id);
      try {
        if (action === 'archive-topic') await adminCommercialService.archiveAdminTopic(id);
        if (action === 'delete-topic' && command?.actionId === 'content.deleteTopic') {
          await adminCommercialService.deleteAdminTopic(id, command);
        }
        if (action === 'delete-file' && command?.actionId === 'content.deleteFile') {
          await adminCommercialService.deleteAdminFile(id, command);
        }
        if (action === 'delete-document' && command?.actionId === 'content.deleteDocument') {
          await adminCommercialService.deleteAdminDocument(id, command);
        }
        toast.success('操作已完成');
        await refresh();
      } catch {
        toast.error('操作失败，请稍后重试');
      } finally {
        setActingId(null);
      }
    },
    [refresh],
  );

  const columns = useMemo(
    () => buildContentColumns(mode, actingId, runAction),
    [actingId, mode, runAction],
  );

  return (
    <AdminPageShell description={copy.subtitle} title={copy.title} width="full">
      <Alert showIcon title={copy.actionHint} type="info" />
      <AdminSection
        description={`当前加载 ${data?.items?.length ?? 0} 条记录`}
        title={copy.listTitle}
        actions={
          <Button
            icon={<RefreshCw aria-hidden size={14} />}
            loading={isLoading}
            onClick={() => void refresh()}
          >
            刷新数据
          </Button>
        }
      >
        <AdminToolbar>
          <div className={contentStyles.filters}>
            <Input.Search
              allowClear
              className={contentStyles.search}
              placeholder={copy.searchPlaceholder}
              onSearch={(value) => {
                setQuery(value.trim());
                resetFilters();
              }}
            />
            <Input.Search
              allowClear
              className={contentStyles.userSearch}
              placeholder="按用户 ID 筛选"
              onSearch={(value) => {
                setUserId(value.trim());
                resetFilters();
              }}
            />
            {mode === 'topics' ? (
              <Select
                allowClear
                className={contentStyles.select}
                placeholder="话题状态"
                value={status}
                options={[
                  { label: '活跃', value: 'active' },
                  { label: '已完成', value: 'completed' },
                  { label: '已归档', value: 'archived' },
                ]}
                onChange={(value) => {
                  setStatus(value as TopicStatus | undefined);
                  resetFilters();
                }}
              />
            ) : null}
            {mode === 'documents' ? (
              <Select
                allowClear
                className={contentStyles.select}
                options={sourceTypeOptions}
                placeholder="来源类型"
                value={sourceType}
                onChange={(value) => {
                  setSourceType(value as DocumentSourceType | undefined);
                  resetFilters();
                }}
              />
            ) : null}
          </div>
        </AdminToolbar>

        {error ? (
          <Alert
            showIcon
            action={<Button onClick={() => void refresh()}>重试</Button>}
            description="请检查服务状态后重试，现有筛选条件会保留。"
            title="数据加载失败"
            type="error"
          />
        ) : null}

        <AdminResponsiveTable label={copy.tableLabel}>
          <InlineTable
            columns={columns}
            dataSource={data?.items ?? []}
            loading={isLoading}
            locale={{ emptyText: <Empty description="暂无数据" /> }}
            rowKey={(row: any) => row.topic?.id || row.file?.id || row.document?.id}
          />
        </AdminResponsiveTable>
        {data?.nextCursor != null ? (
          <div className={contentStyles.pagination}>
            <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
              加载更多
            </Button>
          </div>
        ) : null}
      </AdminSection>
    </AdminPageShell>
  );
});

AdminContentPage.displayName = 'AdminContentPage';

export const AdminTopicsPage = memo(() => <AdminContentPage mode="topics" />);
export const AdminFilesPage = memo(() => <AdminContentPage mode="files" />);
export const AdminDocumentsPage = memo(() => <AdminContentPage mode="documents" />);

AdminTopicsPage.displayName = 'AdminTopicsPage';
AdminFilesPage.displayName = 'AdminFilesPage';
AdminDocumentsPage.displayName = 'AdminDocumentsPage';
