'use client';

import type {
  ModuleAppActionConfig,
  ModuleAppAdminUpsertInput,
  ModuleAppPackageReviewStatus,
  ModuleAppPackageScanStatus,
  ModuleAppPage,
  ModuleAppPlanEntitlement,
  ModuleAppStatus,
} from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  message,
  Select,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { memo, useEffect, useMemo, useState } from 'react';

import InlineTable from '@/components/InlineTable';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

import AppEditorModal from './AppEditorModal';
import ArtifactsTable from './ArtifactsTable';
import AuditEventsTable from './AuditEventsTable';
import CommerceTable, { type ModuleAppRevenueRow } from './CommerceTable';
import { buildModuleAppPublishWarnings } from './formSchema';
import InstallsTable from './InstallsTable';
import RecordsTable from './RecordsTable';
import RunsTable from './RunsTable';
import type {
  AdminModuleAppDetail,
  AdminModuleAppItem,
  AdminModuleAppPackageRow,
  AdminModuleAppUpsertResult,
} from './types';

const { Text, Title } = Typography;

type ListResponse<T> = {
  items?: T[];
  nextCursor?: null | number;
};

type StatusFilter = 'all' | ModuleAppStatus;
type PackageStatusFilter = 'all' | ModuleAppPackageReviewStatus;
type RevenueStatusFilter = 'all' | 'pending' | 'reversed' | 'settled';

type ModuleAppRecordRow = {
  collectionKey: string;
  id: string;
  scopeType: string;
  status?: string;
  title?: null | string;
};

type ModuleAppRunRow = {
  actionId?: null | string;
  createdAt?: Date | string;
  durationMs?: null | number;
  errorType?: null | string;
  id: string;
  status: string;
};

type ModuleAppArtifactRow = {
  artifactType?: null | string;
  fileName?: null | string;
  id: string;
  mimeType?: null | string;
  sizeBytes?: null | number;
  storageUrl?: null | string;
};

type ModuleAppInstallRow = {
  id: string;
  installedAt?: Date | string;
  scopeType?: string;
  status?: string;
  userId?: null | string;
  workspaceId?: null | string;
};

type ModuleAppAuditRow = {
  actorUserId?: null | string;
  createdAt?: Date | string;
  eventType: string;
  id: string;
};

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Unpublished', value: 'unpublished' },
];

const packageStatusOptions: Array<{ label: string; value: PackageStatusFilter }> = [
  { label: 'All packages', value: 'all' },
  { label: 'Pending review', value: 'pending_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const revenueStatusOptions: Array<{ label: string; value: RevenueStatusFilter }> = [
  { label: 'All revenue', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Settled', value: 'settled' },
  { label: 'Reversed', value: 'reversed' },
];

const statusColor: Record<ModuleAppStatus, string> = {
  draft: 'default',
  published: 'green',
  unpublished: 'orange',
};

const statusLabel: Record<ModuleAppStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  unpublished: 'Unpublished',
};

const packageStatusColor: Record<ModuleAppPackageReviewStatus, string> = {
  approved: 'green',
  pending_review: 'gold',
  rejected: 'red',
};

const packageScanStatusColor: Record<ModuleAppPackageScanStatus, string> = {
  blocked: 'red',
  clean: 'green',
  error: 'orange',
  pending: 'default',
};

const packageBuildStatusColor: Record<string, string> = {
  building: 'blue',
  failed: 'red',
  queued: 'gold',
  ready: 'green',
};

const formatDate = (value?: Date | string) => {
  if (!value) return '-';

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
};

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

const isDetail = (app: AdminModuleAppDetail | AdminModuleAppItem): app is AdminModuleAppDetail =>
  Array.isArray((app as AdminModuleAppDetail).pages);

const AdminModuleAppsPage = memo(() => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [packageStatusFilter, setPackageStatusFilter] =
    useState<PackageStatusFilter>('pending_review');
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<RevenueStatusFilter>('pending');
  const [selectedAppId, setSelectedAppId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AdminModuleAppDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const listKey = useMemo(() => ['admin-module-apps', statusFilter], [statusFilter]);
  const packagesKey = useMemo(
    () => ['admin-module-app-packages', packageStatusFilter],
    [packageStatusFilter],
  );
  const revenueKey = useMemo(
    () => ['admin-module-app-revenue', revenueStatusFilter],
    [revenueStatusFilter],
  );
  const detailKey = useMemo(
    () => (selectedAppId ? ['admin-module-app-detail', selectedAppId] : null),
    [selectedAppId],
  );
  const recordsKey = useMemo(
    () => (selectedAppId ? ['admin-module-app-records', selectedAppId] : null),
    [selectedAppId],
  );
  const runsKey = useMemo(
    () => (selectedAppId ? ['admin-module-app-runs', selectedAppId] : null),
    [selectedAppId],
  );
  const artifactsKey = useMemo(
    () => (selectedAppId ? ['admin-module-app-artifacts', selectedAppId] : null),
    [selectedAppId],
  );
  const installsKey = useMemo(
    () => (selectedAppId ? ['admin-module-app-installs', selectedAppId] : null),
    [selectedAppId],
  );
  const auditKey = useMemo(
    () => (selectedAppId ? ['admin-module-app-audit-events', selectedAppId] : null),
    [selectedAppId],
  );

  const { data: listData, error: listError, isLoading: listLoading } = useClientDataSWR(
    listKey,
    () =>
      adminCommercialService.moduleApps.list({
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }) as Promise<ListResponse<AdminModuleAppItem>>,
  );
  const { data: packagesData, isLoading: packagesLoading } = useClientDataSWR(
    packagesKey,
    () =>
      adminCommercialService.moduleApps.listPackages({
        limit: 100,
        reviewStatus: packageStatusFilter === 'all' ? undefined : packageStatusFilter,
      }) as Promise<ListResponse<AdminModuleAppPackageRow>>,
  );
  const { data: revenueData, isLoading: revenueLoading } = useClientDataSWR(
    revenueKey,
    () =>
      adminCommercialService.moduleApps.listRevenue({
        limit: 200,
        status: revenueStatusFilter === 'all' ? undefined : revenueStatusFilter,
      }) as Promise<ListResponse<ModuleAppRevenueRow>>,
  );
  const { data: detailData, isLoading: detailLoading } = useClientDataSWR(
    detailKey,
    () =>
      adminCommercialService.moduleApps.get({
        appId: selectedAppId!,
      }) as Promise<AdminModuleAppDetail>,
  );
  const { data: recordsData, isLoading: recordsLoading } = useClientDataSWR(
    recordsKey,
    () =>
      adminCommercialService.moduleApps.listRecords({
        appId: selectedAppId!,
        limit: 100,
      }) as Promise<ListResponse<ModuleAppRecordRow>>,
  );
  const { data: runsData, isLoading: runsLoading } = useClientDataSWR(
    runsKey,
    () =>
      adminCommercialService.moduleApps.listRuns({
        appId: selectedAppId!,
        limit: 100,
      }) as Promise<ListResponse<ModuleAppRunRow>>,
  );
  const { data: artifactsData, isLoading: artifactsLoading } = useClientDataSWR(
    artifactsKey,
    () =>
      adminCommercialService.moduleApps.listArtifacts({
        appId: selectedAppId!,
        limit: 100,
      }) as Promise<ListResponse<ModuleAppArtifactRow>>,
  );
  const { data: installsData, isLoading: installsLoading } = useClientDataSWR(
    installsKey,
    () =>
      adminCommercialService.moduleApps.listInstalls({
        appId: selectedAppId!,
        limit: 100,
      }) as Promise<ListResponse<ModuleAppInstallRow>>,
  );
  const { data: auditData, isLoading: auditLoading } = useClientDataSWR(
    auditKey,
    () =>
      adminCommercialService.moduleApps.listAuditEvents({
        appId: selectedAppId!,
        limit: 100,
      }) as Promise<ListResponse<ModuleAppAuditRow>>,
  );

  const items = useMemo(() => listData?.items ?? [], [listData?.items]);
  const packages = packagesData?.items ?? [];
  const revenueEntries = revenueData?.items ?? [];
  const detail = detailData ?? null;
  const selectedListItem = items.find((item) => item.id === selectedAppId);
  const selectedApp = detail ?? selectedListItem ?? null;
  const records = recordsData?.items ?? [];
  const runs = runsData?.items ?? [];
  const artifacts = artifactsData?.items ?? [];
  const installs = installsData?.items ?? [];
  const auditEvents = auditData?.items ?? [];

  useEffect(() => {
    if (items.length === 0) {
      if (selectedAppId) setSelectedAppId(undefined);
      return;
    }

    if (!selectedAppId || !items.some((item) => item.id === selectedAppId)) {
      setSelectedAppId(items[0].id);
    }
  }, [items, selectedAppId]);

  const refreshAppData = async (appId = selectedAppId) => {
    await mutate(listKey);
    if (!appId) return;

    await Promise.all([
      mutate(['admin-module-app-detail', appId]),
      mutate(['admin-module-app-records', appId]),
      mutate(['admin-module-app-runs', appId]),
      mutate(['admin-module-app-artifacts', appId]),
      mutate(['admin-module-app-installs', appId]),
      mutate(['admin-module-app-audit-events', appId]),
    ]);
  };

  const refreshPackageData = async () => {
    await mutate(packagesKey);
  };

  const runMutation = async (action: () => Promise<void>, success: string) => {
    try {
      setSubmitting(true);
      await action();
      message.success(success);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Module app operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingApp(null);
    setEditorOpen(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditingApp(detail);
    setEditorOpen(true);
  };

  const handleSaveApp = async (input: ModuleAppAdminUpsertInput) => {
    setSubmitting(true);
    try {
      const result = (await adminCommercialService.moduleApps.upsert(
        input,
      )) as AdminModuleAppUpsertResult;
      const nextAppId = result.id || input.id;

      setEditorOpen(false);
      setEditingApp(null);
      if (nextAppId) setSelectedAppId(nextAppId);
      await refreshAppData(nextAppId);
      message.success('Module app saved');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = (app: AdminModuleAppDetail | AdminModuleAppItem) =>
    runMutation(async () => {
      const warningSource = isDetail(app) ? app : detail?.id === app.id ? detail : null;
      const warnings = warningSource ? buildModuleAppPublishWarnings(warningSource) : [];

      if (warnings.length > 0) {
        message.warning(`Publish warnings: ${warnings.join('; ')}`);
      }

      await adminCommercialService.moduleApps.publish({ appId: app.id });
      await refreshAppData(app.id);
    }, 'Module app published');

  const handleUnpublish = (app: AdminModuleAppDetail | AdminModuleAppItem) =>
    runMutation(async () => {
      await adminCommercialService.moduleApps.unpublish({ appId: app.id });
      await refreshAppData(app.id);
    }, 'Module app unpublished');

  const handleApprovePackage = (packageId: string) =>
    runMutation(async () => {
      await adminCommercialService.moduleApps.approvePackage({ packageId });
      await refreshPackageData();
      await refreshAppData();
    }, 'Package approved');

  const handleRejectPackage = (packageId: string) =>
    runMutation(async () => {
      await adminCommercialService.moduleApps.rejectPackage({
        packageId,
        reason: 'Rejected from admin review queue',
      });
      await refreshPackageData();
    }, 'Package rejected');

  const handleRescanPackage = (packageId: string) =>
    runMutation(async () => {
      await adminCommercialService.moduleApps.rescanPackage({ packageId });
      await refreshPackageData();
    }, 'Package scan completed');

  const handleSettleRevenue = (entryIds: string[]) =>
    runMutation(async () => {
      await adminCommercialService.moduleApps.settleRevenueBatch({ entryIds });
      await mutate(revenueKey);
    }, 'Revenue batch settled');

  const appColumns = [
    {
      dataIndex: 'displayName',
      key: 'displayName',
      render: (value: string, row: AdminModuleAppItem) => (
        <Button type="link" onClick={() => setSelectedAppId(row.id)}>
          {value}
        </Button>
      ),
      title: 'App',
    },
    {
      dataIndex: 'slug',
      key: 'slug',
      render: (value: string) => <Text code>{value}</Text>,
      title: 'Slug',
    },
    {
      dataIndex: 'appType',
      key: 'appType',
      render: (value: string) => <Tag>{value}</Tag>,
      title: 'Type',
    },
    {
      dataIndex: 'source',
      key: 'source',
      render: (value?: string) => <Tag>{value ?? 'admin'}</Tag>,
      title: 'Source',
    },
    { dataIndex: 'category', key: 'category', title: 'Category' },
    {
      dataIndex: 'status',
      key: 'status',
      render: (value: ModuleAppStatus) => (
        <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>
      ),
      title: 'Status',
    },
    {
      dataIndex: 'tags',
      key: 'tags',
      render: formatTags,
      title: 'Tags',
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: formatDate,
      title: 'Updated',
    },
    {
      key: 'actions',
      render: (_: unknown, row: AdminModuleAppItem) => (
        <Flexbox horizontal gap={8}>
          <Button size="small" onClick={() => setSelectedAppId(row.id)}>
            View
          </Button>
          {row.status === 'published' ? (
            <Button size="small" onClick={() => handleUnpublish(row)}>
              Unpublish
            </Button>
          ) : (
            <Button size="small" type="primary" onClick={() => handlePublish(row)}>
              Publish
            </Button>
          )}
        </Flexbox>
      ),
      title: 'Actions',
    },
  ];

  const pageColumns = [
    { dataIndex: 'key', key: 'key', render: (value: string) => <Text code>{value}</Text>, title: 'Key' },
    { dataIndex: 'title', key: 'title', title: 'Title' },
    { dataIndex: 'type', key: 'type', render: (value: string) => <Tag>{value}</Tag>, title: 'Type' },
    { dataIndex: 'routePath', key: 'routePath', render: (value: string) => <Text code>{value}</Text>, title: 'Route' },
    { dataIndex: 'sortOrder', key: 'sortOrder', title: 'Sort' },
  ];

  const actionColumns = [
    { dataIndex: 'id', key: 'id', render: (value: string) => <Text code>{value}</Text>, title: 'Action' },
    { dataIndex: 'name', key: 'name', title: 'Name' },
    {
      dataIndex: 'runtimeType',
      key: 'runtimeType',
      render: (value: string) => <Tag>{value}</Tag>,
      title: 'Runtime',
    },
    {
      dataIndex: 'moduleMultiplier',
      key: 'moduleMultiplier',
      render: (value: number) => `${value ?? 1}x`,
      title: 'Multiplier',
    },
  ];

  const entitlementColumns = [
    { dataIndex: 'plan', key: 'plan', render: (value: string) => <Text code>{value}</Text>, title: 'Plan' },
    {
      dataIndex: 'visible',
      key: 'visible',
      render: (value: boolean) => (value ? 'Yes' : 'No'),
      title: 'Visible',
    },
    {
      dataIndex: 'installable',
      key: 'installable',
      render: (value: boolean) => (value ? 'Yes' : 'No'),
      title: 'Installable',
    },
    {
      dataIndex: 'runnable',
      key: 'runnable',
      render: (value: boolean) => (value ? 'Yes' : 'No'),
      title: 'Runnable',
    },
    { dataIndex: 'freeQuotaCredits', key: 'freeQuotaCredits', title: 'Free quota' },
    { dataIndex: 'discountPercent', key: 'discountPercent', render: (value: number) => `${value ?? 0}%`, title: 'Discount' },
  ];

  const packageColumns = [
    {
      key: 'app',
      render: (_: unknown, row: AdminModuleAppPackageRow) =>
        row.manifestSnapshot?.app?.displayName ?? '-',
      title: 'App',
    },
    {
      key: 'slug',
      render: (_: unknown, row: AdminModuleAppPackageRow) => (
        <Text code>{row.manifestSnapshot?.app?.slug ?? '-'}</Text>
      ),
      title: 'Slug',
    },
    {
      key: 'source',
      render: (_: unknown, row: AdminModuleAppPackageRow) => (
        <Tag>{row.manifestSnapshot?.app?.source ?? 'developer'}</Tag>
      ),
      title: 'Source',
    },
    {
      key: 'packageVersion',
      render: (_: unknown, row: AdminModuleAppPackageRow) => (
        <Text code>{row.manifestSnapshot?.packageVersion ?? '-'}</Text>
      ),
      title: 'Version',
    },
    {
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      render: (value: ModuleAppPackageReviewStatus) => (
        <Tag color={packageStatusColor[value]}>{value}</Tag>
      ),
      title: 'Review status',
    },
    {
      dataIndex: 'scanStatus',
      key: 'scanStatus',
      render: (value: ModuleAppPackageScanStatus) => (
        <Tag color={packageScanStatusColor[value]}>{value}</Tag>
      ),
      title: 'Scan status',
    },
    {
      dataIndex: 'buildStatus',
      key: 'buildStatus',
      render: (value?: null | string, row?: AdminModuleAppPackageRow) =>
        value ? (
          <Tag color={packageBuildStatusColor[value]} title={row?.buildFailureCode ?? undefined}>
            {value}
          </Tag>
        ) : (
          '-'
        ),
      title: 'Build status',
    },
    {
      dataIndex: 'submittedByUserId',
      key: 'submittedByUserId',
      render: (value?: null | string) => <Text code>{value ?? '-'}</Text>,
      title: 'Submitter',
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDate,
      title: 'Submitted',
    },
    {
      key: 'actions',
      render: (_: unknown, row: AdminModuleAppPackageRow) => (
        <Flexbox horizontal gap={8}>
          <Button
            disabled={row.reviewStatus !== 'pending_review' || row.scanStatus !== 'clean'}
            loading={submitting}
            size="small"
            type="primary"
            onClick={() => handleApprovePackage(row.id)}
          >
            Approve
          </Button>
          {row.reviewStatus === 'pending_review' && row.scanStatus !== 'clean' && (
            <Button
              disabled={submitting}
              loading={submitting}
              size="small"
              onClick={() => handleRescanPackage(row.id)}
            >
              Scan
            </Button>
          )}
          <Button
            danger
            disabled={row.reviewStatus !== 'pending_review'}
            loading={submitting}
            size="small"
            onClick={() => handleRejectPackage(row.id)}
          >
            Reject
          </Button>
        </Flexbox>
      ),
      title: 'Actions',
    },
  ];

  const tabItems = [
    {
      children: selectedApp ? (
        <Flexbox gap={16}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Name">{selectedApp.displayName}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColor[selectedApp.status]}>{statusLabel[selectedApp.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Slug">
              <Text code>{selectedApp.slug}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag>{selectedApp.appType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Source">
              <Tag>{selectedApp.source ?? 'admin'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Category">{selectedApp.category}</Descriptions.Item>
            <Descriptions.Item label="Version">{detail?.version ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Tags" span={2}>
              {formatTags(selectedApp.tags)}
            </Descriptions.Item>
            <Descriptions.Item label="Updated" span={2}>
              {formatDate(selectedApp.updatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              {selectedApp.description || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Flexbox>
      ) : (
        <Empty description="Select a module app" />
      ),
      key: 'overview',
      label: 'Overview',
    },
    {
      children: (
        <Flexbox gap={12}>
          <Flexbox horizontal align="center" gap={8} justify="space-between">
            <Text type="secondary">
              Review user and developer submitted Module App packages before they become apps.
            </Text>
            <Select<PackageStatusFilter>
              options={packageStatusOptions}
              style={{ width: 180 }}
              value={packageStatusFilter}
              onChange={setPackageStatusFilter}
            />
          </Flexbox>
          <InlineTable
            columns={packageColumns as any}
            dataSource={packages}
            loading={packagesLoading}
            rowKey="id"
          />
        </Flexbox>
      ),
      key: 'packages',
      label: 'Package review',
    },
    {
      children: (
        <InlineTable
          columns={pageColumns as any}
          dataSource={(detail?.pages ?? []) as ModuleAppPage[]}
          loading={detailLoading}
          rowKey="key"
        />
      ),
      key: 'pages',
      label: 'Pages',
    },
    {
      children: (
        <InlineTable
          columns={actionColumns as any}
          dataSource={(detail?.actions ?? []) as ModuleAppActionConfig[]}
          loading={detailLoading}
          rowKey="id"
        />
      ),
      key: 'actions',
      label: 'Actions',
    },
    {
      children: (
        <InlineTable
          columns={entitlementColumns as any}
          dataSource={(detail?.entitlements ?? []) as ModuleAppPlanEntitlement[]}
          loading={detailLoading}
          rowKey="plan"
        />
      ),
      key: 'entitlements',
      label: 'Entitlements',
    },
    {
      children: selectedApp?.billing ? (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Charge mode">{selectedApp.billing.chargeMode}</Descriptions.Item>
          <Descriptions.Item label="Default multiplier">
            {selectedApp.billing.defaultMultiplier}x
          </Descriptions.Item>
          <Descriptions.Item label="Fixed service fee credits">
            {selectedApp.billing.fixedServiceFeeCredits}
          </Descriptions.Item>
          <Descriptions.Item label="External API cost credits">
            {selectedApp.billing.externalApiCostCredits}
          </Descriptions.Item>
          <Descriptions.Item label="Failure fixed fee policy" span={2}>
            {selectedApp.billing.failureFixedFeePolicy}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Empty description="No billing config" />
      ),
      key: 'billing',
      label: 'Billing',
    },
    {
      children: (
        <Flexbox gap={12}>
          <Flexbox horizontal justify="flex-end">
            <Select<RevenueStatusFilter>
              options={revenueStatusOptions}
              style={{ width: 160 }}
              value={revenueStatusFilter}
              onChange={setRevenueStatusFilter}
            />
          </Flexbox>
          <CommerceTable
            items={revenueEntries}
            loading={revenueLoading}
            onSettle={handleSettleRevenue}
          />
        </Flexbox>
      ),
      key: 'commerce',
      label: 'Commerce',
    },
    {
      children: <InstallsTable items={installs} loading={installsLoading} />,
      key: 'installs',
      label: 'Installs',
    },
    {
      children: <RecordsTable items={records} loading={recordsLoading} />,
      key: 'records',
      label: 'Records',
    },
    {
      children: <RunsTable items={runs} loading={runsLoading} />,
      key: 'runs',
      label: 'Runs',
    },
    {
      children: <ArtifactsTable items={artifacts} loading={artifactsLoading} />,
      key: 'artifacts',
      label: 'Artifacts',
    },
    {
      children: <AuditEventsTable items={auditEvents} loading={auditLoading} />,
      key: 'audit',
      label: 'Audit',
    },
  ];

  return (
    <Flexbox gap={16} padding={24} style={{ maxWidth: 1180 }}>
      <Flexbox horizontal align="center" gap={16} justify="space-between">
        <Flexbox gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            Module apps
          </Title>
          <Text type="secondary">
            Manage module apps, app pages, actions, plan entitlements, billing config,
            publish state, and operational inspection.
          </Text>
        </Flexbox>
        <Flexbox horizontal gap={8}>
          <Select<StatusFilter>
            options={statusOptions}
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Button onClick={() => refreshAppData()}>Refresh</Button>
          <Button disabled={!detail} onClick={openEdit}>
            Edit
          </Button>
          <Button type="primary" onClick={openCreate}>
            Create
          </Button>
        </Flexbox>
      </Flexbox>

      <Alert
        showIcon
        description="Module Apps are separate from Platform Plugins, MCP, and Skills. P2-A does not execute arbitrary frontend JavaScript, use iframe or remote modules, import MCP/Skills, or post real credit ledger transactions."
        message="Module App Platform boundary"
        type="info"
      />

      {listError ? (
        <Alert showIcon message="Module apps failed to load" type="error" />
      ) : listLoading ? (
        <Flexbox align="center" padding={32}>
          <Spin />
        </Flexbox>
      ) : items.length === 0 ? (
        <Empty description="No module apps" />
      ) : (
        <InlineTable
          columns={appColumns as any}
          dataSource={items}
          loading={listLoading}
          rowKey="id"
        />
      )}

      <Tabs items={tabItems} />

      <AppEditorModal
        initialApp={editingApp}
        open={editorOpen}
        submitting={submitting}
        onSubmit={handleSaveApp}
        onCancel={() => {
          setEditorOpen(false);
          setEditingApp(null);
        }}
      />
    </Flexbox>
  );
});

AdminModuleAppsPage.displayName = 'AdminModuleAppsPage';

export default AdminModuleAppsPage;
