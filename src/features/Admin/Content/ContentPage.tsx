'use client';

import { Alert, Button, Select, toast } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- Input 为话题/文件/文档三个 tab 的筛选输入，迁 base-ui 属 B4 筛选器收敛批次统一处理。
import { Input } from 'antd';
import { RefreshCw } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import { AdminPageError, AdminPageShell, AdminSection, AdminToolbar } from '../layout';
import { AdminDataTable } from '../shared';
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
  const { t } = useTranslation('subscription');
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
        carded
        description={`当前加载 ${data?.items?.length ?? 0} 条记录`}
        title={copy.listTitle}
        actions={
          <Button
            icon={<RefreshCw aria-hidden size={14} />}
            loading={isLoading}
            onClick={() => void refresh()}
          >
            {t('admin.content.refresh', '刷新数据')}
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
              placeholder={t('admin.content.filter.userId', '按用户 ID 筛选')}
              onSearch={(value) => {
                setUserId(value.trim());
                resetFilters();
              }}
            />
            {mode === 'topics' ? (
              <Select
                allowClear
                className={contentStyles.select}
                placeholder={t('admin.content.filter.status', '话题状态')}
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
                placeholder={t('admin.content.filter.sourceType', '来源类型')}
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
          <AdminPageError
            retryLabel={t('admin.content.error.retry', '重试')}
            title={t('admin.content.error.title', '数据加载失败')}
            description={t(
              'admin.content.error.description',
              '请检查服务状态后重试，现有筛选条件会保留。',
            )}
            onRetry={() => void refresh()}
          />
        ) : null}

        <AdminDataTable
          columns={columns}
          dataSource={data?.items ?? []}
          isEmpty={!isLoading && !error && (data?.items?.length ?? 0) === 0}
          loading={isLoading}
          regionLabel={copy.tableLabel}
          // F10：话题/文件/文档三个 mode 的行主键字段不同，按 mode 取存在的那个（行内至少有一个 id）。
          rowKey={(row: any) => row.topic?.id || row.file?.id || row.document?.id}
          // F9：分页统一走 AdminDataTable 的 pager 插槽（原自绘「下一页」按钮）。
          pager={{
            hasNext: data?.nextCursor != null,
            hasPrevious: cursor > 0,
            onNext: () => {
              if (data?.nextCursor != null) setCursor(data.nextCursor);
            },
            onPrevious: () => setCursor((current) => Math.max(0, current - PAGE_SIZE)),
          }}
        />
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
