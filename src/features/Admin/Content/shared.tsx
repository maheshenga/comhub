'use client';

import { Flexbox } from '@lobehub/ui';
import { Typography } from 'antd';

import type { AdminDangerousActionEnvelope } from '../adminDangerousActions';

const { Text } = Typography;

export type ContentMode = 'documents' | 'files' | 'topics';
export type TopicStatus = 'active' | 'archived' | 'completed';
export type DocumentSourceType = 'agent' | 'agent-signal' | 'api' | 'file' | 'topic' | 'web';

export const EMPTY_TEXT = '-';

export type ContentDeleteCommand =
  | AdminDangerousActionEnvelope<'content.deleteDocument'>
  | AdminDangerousActionEnvelope<'content.deleteFile'>
  | AdminDangerousActionEnvelope<'content.deleteTopic'>;

export const PAGE_SIZE = 50;

export const formatDate = (value?: Date | string | null) =>
  value ? new Date(value).toLocaleString() : EMPTY_TEXT;

export const formatSize = (value?: number | null) => {
  if (!value) return EMPTY_TEXT;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

export const compactId = (value?: string | null) =>
  value ? <code>{value.slice(0, 12)}</code> : EMPTY_TEXT;

export const userLabel = (
  user?: {
    email?: string | null;
    fullName?: string | null;
    id?: string | null;
    username?: string | null;
  } | null,
) => (
  <Flexbox gap={2}>
    <span>{user?.fullName || user?.username || user?.email || EMPTY_TEXT}</span>
    {user?.id ? <Text type="secondary">{compactId(user.id)}</Text> : null}
  </Flexbox>
);

export const statusColor: Record<TopicStatus, string> = {
  active: 'green',
  archived: 'default',
  completed: 'blue',
};

export const sourceTypeOptions: Array<{ label: string; value: DocumentSourceType }> = [
  { label: '文件', value: 'file' },
  { label: '网页', value: 'web' },
  { label: 'API', value: 'api' },
  { label: '话题', value: 'topic' },
  { label: '助理', value: 'agent' },
  { label: '助理信号', value: 'agent-signal' },
];

export const getModeCopy = (mode: ContentMode) => {
  if (mode === 'topics') {
    return {
      actionHint: '归档会保留数据但隐藏活跃状态；删除会直接移除话题记录。',
      listTitle: '话题列表',
      searchPlaceholder: '搜索标题、描述、内容或用户',
      subtitle: '统一查看所有用户的话题，支持按状态筛选、归档和删除异常话题。',
      tableLabel: '话题数据表',
      title: '话题管理',
    };
  }

  if (mode === 'files') {
    return {
      actionHint: '删除会移除文件记录，请先确认该资源不再需要。',
      listTitle: '文件列表',
      searchPlaceholder: '搜索文件名、类型、地址或用户',
      subtitle: '查看所有用户上传或生成的资源文件，定位体积、类型和归属用户。',
      tableLabel: '文件数据表',
      title: '资源文件管理',
    };
  }

  return {
    actionHint: '删除会移除文稿/知识文档记录，请确认不会影响用户资料与知识库。',
    listTitle: '文档列表',
    searchPlaceholder: '搜索标题、文件名、来源或用户',
    subtitle: '查看用户文稿、网页、文件解析文档和助理相关文档，支持按来源类型筛选。',
    tableLabel: '文档数据表',
    title: '用户文稿管理',
  };
};
