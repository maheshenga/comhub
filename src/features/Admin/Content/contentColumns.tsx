'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Tag } from '@lobehub/ui/base-ui';
import { Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import AdminDangerousActionButton from '../AdminDangerousActionButton';
import {
  compactId,
  type ContentDeleteCommand,
  EMPTY_TEXT,
  formatDate,
  formatSize,
  statusColor,
  type TopicStatus,
  userLabel,
} from './shared';

const { Text } = Typography;

type RunAction = (
  id: string,
  action: 'archive-topic' | 'delete-document' | 'delete-file' | 'delete-topic',
  command?: ContentDeleteCommand,
) => Promise<void>;

export const buildContentColumns = (
  mode: 'topics' | 'files' | 'documents',
  actingId: string | null,
  runAction: RunAction,
): ColumnsType<any> => {
  if (mode === 'topics') {
    return [
      {
        key: 'title',
        render: (_: unknown, row: any) => (
          <Flexbox gap={2}>
            <span>{row.topic.title || EMPTY_TEXT}</span>
            <Text type="secondary">{compactId(row.topic.id)}</Text>
          </Flexbox>
        ),
        title: '话题',
        width: 260,
      },
      {
        key: 'user',
        render: (_: unknown, row: any) => userLabel(row.user),
        title: '用户',
        width: 220,
      },
      {
        key: 'status',
        render: (_: unknown, row: any) => (
          <Tag color={statusColor[row.topic.status as TopicStatus] ?? 'default'}>
            {row.topic.status}
          </Tag>
        ),
        title: '状态',
        width: 100,
      },
      {
        key: 'mode',
        render: (_: unknown, row: any) => row.topic.mode || EMPTY_TEXT,
        title: '模式',
        width: 120,
      },
      {
        key: 'favorite',
        render: (_: unknown, row: any) =>
          row.topic.favorite ? <Tag color="gold">收藏</Tag> : EMPTY_TEXT,
        title: '标记',
        width: 100,
      },
      {
        key: 'updatedAt',
        render: (_: unknown, row: any) => formatDate(row.topic.updatedAt),
        title: '更新时间',
        width: 180,
      },
      {
        key: 'actions',
        render: (_: unknown, row: any) => (
          <Space>
            {row.topic.status !== 'archived' ? (
              <Button
                loading={actingId === row.topic.id}
                size="small"
                onClick={() => runAction(row.topic.id, 'archive-topic')}
              >
                归档
              </Button>
            ) : null}
            <AdminDangerousActionButton
              danger
              actionId="content.deleteTopic"
              confirmTitle="确认删除这个话题？"
              loading={actingId === row.topic.id}
              size="small"
              onConfirm={(command) => runAction(row.topic.id, 'delete-topic', command)}
            >
              删除
            </AdminDangerousActionButton>
          </Space>
        ),
        title: '操作',
        width: 160,
      },
    ];
  }

  if (mode === 'files') {
    return [
      {
        key: 'name',
        render: (_: unknown, row: any) => (
          <Flexbox gap={2}>
            <span>{row.file.name || EMPTY_TEXT}</span>
            <Text type="secondary">{compactId(row.file.id)}</Text>
          </Flexbox>
        ),
        title: '文件',
        width: 260,
      },
      {
        key: 'user',
        render: (_: unknown, row: any) => userLabel(row.user),
        title: '用户',
        width: 220,
      },
      {
        key: 'fileType',
        render: (_: unknown, row: any) => row.file.fileType || EMPTY_TEXT,
        title: '类型',
        width: 180,
      },
      {
        key: 'size',
        render: (_: unknown, row: any) => formatSize(row.file.size),
        title: '大小',
        width: 100,
      },
      {
        key: 'embeddingTaskId',
        render: (_: unknown, row: any) =>
          row.file.embeddingTaskId ? compactId(row.file.embeddingTaskId) : EMPTY_TEXT,
        title: '向量任务',
        width: 140,
      },
      {
        key: 'updatedAt',
        render: (_: unknown, row: any) => formatDate(row.file.updatedAt),
        title: '更新时间',
        width: 180,
      },
      {
        key: 'actions',
        render: (_: unknown, row: any) => (
          <AdminDangerousActionButton
            danger
            actionId="content.deleteFile"
            confirmTitle="确认删除这个文件记录？"
            loading={actingId === row.file.id}
            size="small"
            onConfirm={(command) => runAction(row.file.id, 'delete-file', command)}
          >
            删除
          </AdminDangerousActionButton>
        ),
        title: '操作',
        width: 100,
      },
    ];
  }

  return [
    {
      key: 'title',
      render: (_: unknown, row: any) => (
        <Flexbox gap={2}>
          <span>{row.document.title || row.document.filename || EMPTY_TEXT}</span>
          <Text type="secondary">{compactId(row.document.id)}</Text>
        </Flexbox>
      ),
      title: '文稿',
      width: 280,
    },
    {
      key: 'user',
      render: (_: unknown, row: any) => userLabel(row.user),
      title: '用户',
      width: 220,
    },
    {
      key: 'sourceType',
      render: (_: unknown, row: any) => <Tag>{row.document.sourceType}</Tag>,
      title: '来源类型',
      width: 110,
    },
    {
      key: 'fileType',
      render: (_: unknown, row: any) => row.document.fileType || EMPTY_TEXT,
      title: '文件类型',
      width: 160,
    },
    {
      key: 'chars',
      render: (_: unknown, row: any) => row.document.totalCharCount ?? EMPTY_TEXT,
      title: '字符数',
      width: 100,
    },
    {
      key: 'updatedAt',
      render: (_: unknown, row: any) => formatDate(row.document.updatedAt),
      title: '更新时间',
      width: 180,
    },
    {
      key: 'actions',
      render: (_: unknown, row: any) => (
        <AdminDangerousActionButton
          danger
          actionId="content.deleteDocument"
          confirmTitle="确认删除这个文稿？"
          loading={actingId === row.document.id}
          size="small"
          onConfirm={(command) => runAction(row.document.id, 'delete-document', command)}
        >
          删除
        </AdminDangerousActionButton>
      ),
      title: '操作',
      width: 100,
    },
  ];
};
