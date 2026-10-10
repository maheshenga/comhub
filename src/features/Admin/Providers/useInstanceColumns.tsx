'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Tag } from '@lobehub/ui/base-ui';
import { Popconfirm, Switch, Tooltip } from 'antd';

import { getAdminModelTypeLabel } from '@/features/Admin/adminModelTypeLabels';
import { mutate } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AdminDangerousActionButton from '../AdminDangerousActionButton';
import type { AdminDangerousActionEnvelope } from '../adminDangerousActions';
import { type InstanceRow, INSTANCES_KEY, PROVIDER_TYPE_LABELS } from './shared';

type TFn = (key: any, defaultValue?: any, values?: any) => string;

interface BuildInstanceColumnsParams {
  handleDelete: (row: InstanceRow, command: AdminDangerousActionEnvelope<'newapiProvider.deleteInstance'>) => Promise<void>;
  handleSyncModels: (row: InstanceRow) => Promise<void>;
  handleTestConnection: (row: InstanceRow) => Promise<void>;
  handleToggle: (row: InstanceRow) => Promise<void>;
  setEditing: (row: InstanceRow) => void;
  setModelsTarget: (row: InstanceRow) => void;
  syncingId: string | null;
  t: TFn;
  testingId: string | null;
}

export const buildInstanceColumns = ({ ...params }: BuildInstanceColumnsParams) => {
  const {
    handleDelete,
    handleSyncModels,
    handleTestConnection,
    handleToggle,
    setEditing,
    setModelsTarget,
    syncingId,
    t,
    testingId,
  } = params;
  void adminCommercialService;
  void mutate;
  void INSTANCES_KEY;
  return [
    {
      dataIndex: 'name',
      key: 'name',
      title: t('admin.providers.col.name', '名称'),
    },
    {
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      render: (v: string) => (
        <Tooltip title={v}>
          <code style={{ fontSize: 12 }}>{v}</code>
        </Tooltip>
      ),
      title: t('admin.providers.col.baseUrl', '基础地址'),
    },
    {
      dataIndex: 'providerType',
      key: 'providerType',
      render: (value: InstanceRow['providerType'] | null) => (
        <Tag color={value === 'newapi' ? 'green' : 'blue'}>
          {PROVIDER_TYPE_LABELS[value || 'newapi']}
        </Tag>
      ),
      title: t('admin.providers.col.providerType', '服务商'),
      width: 150,
    },
    {
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (v: string | null, row: InstanceRow) =>
        row.apiKeyStatus === 'invalid' ? (
          <Tag color="red">{t('admin.providers.col.apiKeyInvalid', '密钥无效，需重置')}</Tag>
        ) : (
          <code style={{ fontSize: 12 }}>{v ?? '-'}</code>
        ),
      title: t('admin.providers.col.apiKey', 'API 密钥'),
      width: 160,
    },
    {
      dataIndex: 'priority',
      key: 'priority',
      title: t('admin.providers.col.priority', '优先级'),
      width: 90,
    },
    {
      key: 'group',
      render: (_: unknown, row: InstanceRow) => (
        <Flexbox gap={4}>
          <Tag color="purple">{row.groupKey || 'default'}</Tag>
          {row.groupName ? <span style={{ fontSize: 12 }}>{row.groupName}</span> : null}
          {row.groupMultiplier ? (
            <span style={{ fontSize: 12, opacity: 0.7 }}>x{row.groupMultiplier}</span>
          ) : null}
        </Flexbox>
      ),
      title: t('admin.providers.col.group', '分组'),
      width: 160,
    },
    {
      dataIndex: 'usageScope',
      key: 'usageScope',
      render: (value: InstanceRow['usageScope']) =>
        value?.length ? (
          <Flexbox horizontal gap={4} wrap="wrap">
            {value.map((type) => (
              <Tag key={type}>
                {t(`admin.providers.modelType.${type}`, getAdminModelTypeLabel(type))}
              </Tag>
            ))}
          </Flexbox>
        ) : (
          <Tag color="default">{t('admin.providers.col.usageScopeAll', '不限')}</Tag>
        ),
      title: t('admin.providers.col.usageScope', '用途'),
      width: 220,
    },
    {
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean, r: InstanceRow) => (
        <Switch checked={v} size="small" onChange={() => handleToggle(r)} />
      ),
      title: t('admin.providers.col.enabled', '启用'),
      width: 90,
    },
    {
      dataIndex: 'fetchOnClient',
      hidden: true,
      key: 'fetchOnClient',
      render: (v: boolean) =>
        v ? <Tag color="blue">客户端（Client）</Tag> : <Tag color="default">服务端（Server）</Tag>,
      title: t('admin.providers.col.fetchMode', '拉取方式'),
      width: 140,
    },
    {
      key: 'actions',
      render: (_: unknown, row: InstanceRow) => (
        <Flexbox horizontal gap={8}>
          <Button
            loading={testingId === row.id}
            size="small"
            onClick={() => handleTestConnection(row)}
          >
            {t('admin.providers.action.test', '测试')}
          </Button>
          <Popconfirm
            okText={t('admin.providers.action.sync', '同步')}
            title={t(
              'admin.providers.sync.confirm',
              '同步将删除该实例的全部现有模型、启用状态及手工价格/能力设置，并用最新上游模型、价格和能力重新创建。是否继续？',
            )}
            onConfirm={() => handleSyncModels(row)}
          >
            <Button loading={syncingId === row.id} size="small">
              {t('admin.providers.action.sync', '同步')}
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setModelsTarget(row)}>
            {t('admin.providers.action.models', '模型')}
          </Button>
          <Button size="small" onClick={() => setEditing(row)}>
            {t('admin.providers.action.edit', '编辑')}
          </Button>
          <AdminDangerousActionButton
            danger
            actionId="newapiProvider.deleteInstance"
            confirmDescription={t('admin.providers.confirmDelete', '删除这个实例及其全部模型？')}
            loadPreflight={() => adminCommercialService.getAiProviderInstanceDeleteImpact(row.id)}
            size="small"
            onConfirm={(command) => handleDelete(row, command)}
          >
            {t('admin.providers.action.delete', '删除')}
          </AdminDangerousActionButton>
        </Flexbox>
      ),
      title: t('admin.providers.col.actions', '操作'),
      width: 240,
    },
  ];

};
