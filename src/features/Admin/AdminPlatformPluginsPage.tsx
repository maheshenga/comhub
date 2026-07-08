'use client';

import type {
  PlatformPluginAdminUpsertInput,
  PlatformPluginBillingConfig,
  PlatformPluginOperationsMetadata,
  PlatformPluginPlanEntitlement,
  PlatformPluginStatus,
} from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Form,
  message,
  Select,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import ArtifactsTable from './platformPlugins/ArtifactsTable';
import BillingEditor from './platformPlugins/BillingEditor';
import EntitlementEditor from './platformPlugins/EntitlementEditor';
import PluginEditorModal from './platformPlugins/PluginEditorModal';
import RunRecordsTable from './platformPlugins/RunRecordsTable';
import SecretsPanel from './platformPlugins/SecretsPanel';
import type {
  AdminPlanOption,
  AdminPlatformPluginArtifact,
  AdminPlatformPluginDetail,
  AdminPlatformPluginItem,
  AdminPlatformPluginRun,
} from './platformPlugins/types';

const { Text, Title } = Typography;

type PluginListResponse = {
  items?: AdminPlatformPluginItem[];
  nextCursor?: null | number;
};

type RunsResponse = {
  items?: AdminPlatformPluginRun[];
  nextCursor?: null | number;
};

type ArtifactsResponse = {
  items?: AdminPlatformPluginArtifact[];
  nextCursor?: null | number;
};

type PlansResponse = {
  items?: AdminPlanOption[];
};

type StatusFilter = 'all' | PlatformPluginStatus;

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已下架', value: 'unpublished' },
];

const statusColor: Record<PlatformPluginStatus, string> = {
  draft: 'default',
  published: 'green',
  unpublished: 'orange',
};

const statusLabel: Record<PlatformPluginStatus, string> = {
  draft: '草稿',
  published: '已发布',
  unpublished: '已下架',
};

const runtimeLabel = {
  api_action: 'API Action',
  content_generation: '内容生成',
};

const formatDate = (value?: Date | string) => (value ? new Date(value).toLocaleString() : '-');
const formatStats = (value?: number) => Number(value ?? 0).toLocaleString();
const formatSuccessRate = (value?: number) => `${Number(value ?? 0).toFixed(1)}%`;

const normalizeOperations = (operations?: null | PlatformPluginOperationsMetadata) => ({
  featured: operations?.featured === true,
  planBenefitSummary: operations?.planBenefitSummary || undefined,
  promoLabel: operations?.promoLabel || undefined,
  sortWeight: Number(operations?.sortWeight ?? 0),
  upgradeCta: operations?.upgradeCta || undefined,
  useCase: operations?.useCase || undefined,
});

const areOperationsEqual = (
  next?: null | PlatformPluginOperationsMetadata,
  current?: null | PlatformPluginOperationsMetadata,
) => JSON.stringify(normalizeOperations(next)) === JSON.stringify(normalizeOperations(current));

const formatTags = (tags?: string[]) =>
  tags && tags.length > 0 ? (
    <Flexbox horizontal gap={4} wrap="wrap">
      {tags.map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
    </Flexbox>
  ) : (
    '-'
  );

const getBillingFormValues = (billing?: PlatformPluginBillingConfig) => ({
  defaultMultiplier: billing?.defaultMultiplier ?? 1,
  externalApiCostCredits: billing?.externalApiCostCredits ?? 0,
  fixedServiceFeeCredits: billing?.fixedServiceFeeCredits ?? 0,
});

const AdminPlatformPluginsPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPluginId, setSelectedPluginId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<AdminPlatformPluginDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [billingForm] = Form.useForm();
  const tt = (key: string) => t(key as never);

  const listKey = useMemo(() => ['admin-platform-plugins', statusFilter], [statusFilter]);
  const detailKey = useMemo(
    () => (selectedPluginId ? ['admin-platform-plugin-detail', selectedPluginId] : null),
    [selectedPluginId],
  );
  const runsKey = useMemo(
    () => (selectedPluginId ? ['admin-platform-plugin-runs', selectedPluginId] : null),
    [selectedPluginId],
  );
  const artifactsKey = useMemo(
    () => (selectedPluginId ? ['admin-platform-plugin-artifacts', selectedPluginId] : null),
    [selectedPluginId],
  );

  const { data: listData, error: listError, isLoading: listLoading } = useClientDataSWR(
    listKey,
    () =>
      adminCommercialService.platformPlugins.list({
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }) as Promise<PluginListResponse>,
  );
  const { data: detailData, isLoading: detailLoading } = useClientDataSWR(
    detailKey,
    () =>
      adminCommercialService.platformPlugins.get({
        pluginIdOrSlug: selectedPluginId!,
      }) as Promise<AdminPlatformPluginDetail>,
  );
  const { data: runsData, isLoading: runsLoading } = useClientDataSWR(
    runsKey,
    () =>
      adminCommercialService.platformPlugins.listRuns({
        limit: 100,
        pluginId: selectedPluginId!,
      }) as Promise<RunsResponse>,
  );
  const { data: artifactsData, isLoading: artifactsLoading } = useClientDataSWR(
    artifactsKey,
    () =>
      adminCommercialService.platformPlugins.listArtifacts({
        limit: 100,
        pluginId: selectedPluginId!,
      }) as Promise<ArtifactsResponse>,
  );
  const { data: plansData } = useClientDataSWR(
    ['admin-platform-plugin-plan-options'],
    () => adminCommercialService.listPlans() as Promise<PlansResponse>,
  );

  const items = listData?.items ?? [];
  const detail = detailData ?? null;
  const selectedListItem = items.find((item) => item.id === selectedPluginId);
  const selectedPlugin = detail ?? selectedListItem ?? null;
  const runs = runsData?.items ?? [];
  const artifacts = artifactsData?.items ?? [];
  const plans = plansData?.items ?? [];
  const runtimeLabel = {
    api_action: tt('admin.platformPlugins.apiAction'),
    content_generation: tt('admin.platformPlugins.contentGeneration'),
  };

  useEffect(() => {
    if (selectedPluginId || items.length === 0) return;
    setSelectedPluginId(items[0].id);
  }, [items, selectedPluginId]);

  useEffect(() => {
    if (!detail) return;
    billingForm.setFieldsValue(getBillingFormValues(detail.billing));
  }, [billingForm, detail]);

  const refreshPluginData = async (pluginId = selectedPluginId) => {
    await mutate(listKey);
    if (pluginId) {
      await Promise.all([
        mutate(['admin-platform-plugin-detail', pluginId]),
        mutate(['admin-platform-plugin-runs', pluginId]),
        mutate(['admin-platform-plugin-artifacts', pluginId]),
      ]);
    }
  };

  const runMutation = async (action: () => Promise<void>, success: string) => {
    try {
      setSubmitting(true);
      await action();
      message.success(success);
    } catch {
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingPlugin(null);
    setEditorOpen(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditingPlugin(detail);
    setEditorOpen(true);
  };

  const handleSavePlugin = async (input: PlatformPluginAdminUpsertInput) => {
    setSubmitting(true);
    try {
      const existingPlugin = editingPlugin;
      const result = await adminCommercialService.platformPlugins.upsert(input);
      if (existingPlugin && !areOperationsEqual(input.operations, existingPlugin.operations)) {
        await adminCommercialService.platformPlugins.updateOperations({
          operations: input.operations,
          pluginId: result.id,
        });
      }
      setEditorOpen(false);
      setEditingPlugin(null);
      setSelectedPluginId(result.id);
      await refreshPluginData(result.id);
      message.success('平台插件已保存');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = (pluginId: string) =>
    runMutation(async () => {
      await adminCommercialService.platformPlugins.publish({ pluginId });
      await refreshPluginData(pluginId);
    }, '平台插件已发布');

  const handleUnpublish = (pluginId: string) =>
    runMutation(async () => {
      await adminCommercialService.platformPlugins.unpublish({ pluginId });
      await refreshPluginData(pluginId);
    }, '平台插件已下架');

  const handleSaveEntitlements = async (entitlements: PlatformPluginPlanEntitlement[]) => {
    if (!detail) return;
    await runMutation(async () => {
      await adminCommercialService.platformPlugins.upsertEntitlements({
        entitlements,
        pluginSlug: detail.slug,
      });
      await refreshPluginData(detail.id);
    }, '套餐权限已保存');
  };

  const handleSaveBilling = async () => {
    if (!detail) return;
    const values = await billingForm.validateFields();
    await runMutation(async () => {
      await adminCommercialService.platformPlugins.upsertBilling({
        billing: getBillingFormValues(values),
        pluginId: detail.id,
      });
      await refreshPluginData(detail.id);
    }, '计费配置已保存');
  };

  const handleUpsertSecret = async (input: { key: string; scope?: string; value: string }) => {
    if (!detail) return;
    await runMutation(async () => {
      await adminCommercialService.platformPlugins.upsertSecret({
        ...input,
        pluginId: detail.id,
      });
      await refreshPluginData(detail.id);
    }, '密钥已保存');
  };

  const handleDeleteSecret = async (input: { key: string; scope?: string }) => {
    if (!detail) return;
    await runMutation(async () => {
      await adminCommercialService.platformPlugins.deleteSecret({
        ...input,
        pluginId: detail.id,
      });
      await refreshPluginData(detail.id);
    }, '密钥已删除');
  };

  const pluginColumns = [
    {
      dataIndex: 'displayName',
      key: 'displayName',
      render: (value: string, row: AdminPlatformPluginItem) => (
        <Button type="link" onClick={() => setSelectedPluginId(row.id)}>
          {value}
        </Button>
      ),
      title: '插件',
    },
    { dataIndex: 'slug', key: 'slug', render: (value: string) => <Text code>{value}</Text>, title: 'Slug' },
    {
      dataIndex: 'runtimeType',
      key: 'runtimeType',
      render: (value: keyof typeof runtimeLabel) => <Tag>{runtimeLabel[value]}</Tag>,
      title: '类型',
    },
    { dataIndex: 'category', key: 'category', title: '分类' },
    {
      dataIndex: 'status',
      key: 'status',
      render: (value: PlatformPluginStatus) => <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>,
      title: '状态',
    },
    {
      dataIndex: ['operations', 'featured'],
      key: 'featured',
      render: (value: boolean) => (value ? <Tag color="gold">{tt('admin.platformPlugins.featured')}</Tag> : '-'),
      title: tt('admin.platformPlugins.featured'),
    },
    {
      dataIndex: ['operations', 'sortWeight'],
      key: 'sortWeight',
      title: tt('admin.platformPlugins.sortWeight'),
    },
    {
      dataIndex: 'stats',
      key: 'stats',
      render: (stats: AdminPlatformPluginItem['stats']) =>
        tt('admin.platformPlugins.statsSummary', {
          runs: formatStats(stats?.runs),
          successRate: formatSuccessRate(stats?.successRate),
        }),
      title: tt('admin.platformPlugins.stats'),
    },
    {
      dataIndex: 'billing',
      key: 'billing',
      render: (value: PlatformPluginBillingConfig) => `${value?.defaultMultiplier ?? 1}x`,
      title: '默认倍率',
    },
    {
      key: 'actions',
      render: (_: unknown, row: AdminPlatformPluginItem) => (
        <Flexbox horizontal gap={8}>
          <Button size="small" onClick={() => setSelectedPluginId(row.id)}>
            查看
          </Button>
          {row.status === 'published' ? (
            <Button size="small" onClick={() => handleUnpublish(row.id)}>
              下架
            </Button>
          ) : (
            <Button size="small" type="primary" onClick={() => handlePublish(row.id)}>
              发布
            </Button>
          )}
        </Flexbox>
      ),
      title: '操作',
    },
  ];

  const actionColumns = [
    { dataIndex: 'actionKey', key: 'actionKey', render: (value: string) => <Text code>{value}</Text>, title: '动作 ID' },
    { dataIndex: 'name', key: 'name', title: '名称' },
    {
      dataIndex: 'runtimeType',
      key: 'runtimeType',
      render: (value: keyof typeof runtimeLabel) => <Tag>{runtimeLabel[value]}</Tag>,
      title: '类型',
    },
    { dataIndex: 'moduleMultiplier', key: 'moduleMultiplier', render: (value: number) => `${value}x`, title: '模块倍率' },
  ];

  const tabItems = [
    {
      children: selectedPlugin ? (
        <Flexbox gap={16}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="名称">{selectedPlugin.displayName}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColor[selectedPlugin.status]}>{statusLabel[selectedPlugin.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Slug">
              <Text code>{selectedPlugin.slug}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="运行类型">
              <Tag>{runtimeLabel[selectedPlugin.runtimeType]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="分类">{selectedPlugin.category}</Descriptions.Item>
            <Descriptions.Item label="版本">{detail?.version ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={tt('admin.platformPlugins.promotionLabel')}>
              {selectedPlugin.operations?.promoLabel || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={tt('admin.platformPlugins.sortWeight')}>
              {selectedPlugin.operations?.sortWeight ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="标签" span={2}>{formatTags(selectedPlugin.tags)}</Descriptions.Item>
            <Descriptions.Item label="更新时间" span={2}>{formatDate(selectedPlugin.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label={tt('admin.platformPlugins.useCase')} span={2}>
              {selectedPlugin.operations?.useCase || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={tt('admin.platformPlugins.planBenefit')} span={2}>
              {selectedPlugin.operations?.planBenefitSummary || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={tt('admin.platformPlugins.upgradeCta')} span={2}>
              {selectedPlugin.operations?.upgradeCta || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{selectedPlugin.description}</Descriptions.Item>
          </Descriptions>
          <InlineTable
            columns={actionColumns as any}
            dataSource={detail?.actions ?? []}
            loading={detailLoading}
            rowKey="id"
          />
        </Flexbox>
      ) : (
        <Empty description="请选择一个平台插件" />
      ),
      key: 'overview',
      label: '概览',
    },
    {
      children: detail ? (
        <EntitlementEditor
          entitlements={detail.entitlements}
          plans={plans}
          submitting={submitting}
          onSubmit={handleSaveEntitlements}
        />
      ) : (
        <Empty description="请选择一个平台插件" />
      ),
      key: 'entitlements',
      label: '套餐权限',
    },
    {
      children: detail ? (
        <Form form={billingForm} layout="vertical">
          <BillingEditor showModuleMultiplier={false} />
          <Button loading={submitting} type="primary" onClick={handleSaveBilling}>
            保存计费配置
          </Button>
        </Form>
      ) : (
        <Empty description="请选择一个平台插件" />
      ),
      key: 'billing',
      label: '计费',
    },
    {
      children: detail ? (
        <SecretsPanel
          secrets={detail.secrets}
          submitting={submitting}
          onDelete={handleDeleteSecret}
          onUpsert={handleUpsertSecret}
        />
      ) : (
        <Empty description="请选择一个平台插件" />
      ),
      key: 'secrets',
      label: '密钥',
    },
    {
      children: <RunRecordsTable loading={runsLoading} runs={runs} />,
      key: 'runs',
      label: '运行记录',
    },
    {
      children: <ArtifactsTable artifacts={artifacts} loading={artifactsLoading} />,
      key: 'artifacts',
      label: '产物',
    },
  ];

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 1180 }}>
      <Flexbox horizontal align="center" justify="space-between" gap={16}>
        <Flexbox gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            平台插件
          </Title>
          <Text type="secondary">
            管理独立平台插件、套餐权限、商业计费、密钥、运行记录和生成产物。
          </Text>
        </Flexbox>
        <Flexbox horizontal gap={8}>
          <Select<StatusFilter>
            options={statusOptions}
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Button onClick={() => refreshPluginData()}>刷新</Button>
          <Button disabled={!detail} onClick={openEdit}>
            编辑
          </Button>
          <Button type="primary" onClick={openCreate}>
            新增插件
          </Button>
        </Flexbox>
      </Flexbox>

      <Alert
        showIcon
        description="平台插件与现有 MCP、Skills 独立管理；P1 仅接入 API Action 与内容生成插件。"
        message="独立插件市场"
        type="info"
      />

      {listError ? (
        <Alert showIcon message="平台插件列表加载失败" type="error" />
      ) : listLoading ? (
        <Flexbox align="center" padding={32}>
          <Spin />
        </Flexbox>
      ) : items.length === 0 ? (
        <Empty description="暂无平台插件" />
      ) : (
        <InlineTable
          columns={pluginColumns as any}
          dataSource={items}
          loading={listLoading}
          rowKey="id"
        />
      )}

      <Tabs items={tabItems} />

      <PluginEditorModal
        initialPlugin={editingPlugin}
        open={editorOpen}
        submitting={submitting}
        onCancel={() => {
          setEditorOpen(false);
          setEditingPlugin(null);
        }}
        onSubmit={handleSavePlugin}
      />
    </Flexbox>
  );
});

AdminPlatformPluginsPage.displayName = 'AdminPlatformPluginsPage';

export default AdminPlatformPluginsPage;
