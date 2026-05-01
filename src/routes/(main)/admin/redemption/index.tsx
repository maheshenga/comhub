'use client';

import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  message,
} from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import InlineTable from '@/components/InlineTable';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type RewardType = 'plan' | 'credits' | 'topup_package';
type Status = 'all' | 'active' | 'redeemed' | 'disabled' | 'expired';

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  disabled: 'default',
  expired: 'warning',
  redeemed: 'blue',
};

const REWARD_COLORS: Record<RewardType, string> = {
  credits: 'gold',
  plan: 'purple',
  topup_package: 'cyan',
};

const escapeCsv = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

const AdminRedemptionPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [status, setStatus] = useState<Status>('all');
  const [rewardType, setRewardType] = useState<RewardType | undefined>(undefined);
  const [batchId, setBatchId] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genResult, setGenResult] = useState<{ batchId: string; codes: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genForm] = Form.useForm();

  const swrKey = useMemo(
    () => ['admin-redemption', status, rewardType, batchId, codeQuery, cursor] as const,
    [status, rewardType, batchId, codeQuery, cursor],
  );

  const { data, isLoading, mutate } = useClientDataSWR(swrKey, () =>
    adminCommercialService.listRedemptionCodes({
      batchId: batchId || undefined,
      codeQuery: codeQuery || undefined,
      cursor,
      limit: 50,
      rewardType,
      status: status === 'all' ? undefined : status,
    }),
  );
  const { data: plansData } = useClientDataSWR(['admin-redemption-plan-options'], () =>
    adminCommercialService.listPlans(),
  );
  const { data: packagesData } = useClientDataSWR(['admin-redemption-package-options'], () =>
    adminCommercialService.listPackages(),
  );

  const items = (data?.items ?? []) as any[];
  const planOptions = useMemo(() => {
    return ((plansData?.items ?? []) as any[])
      .filter((item) => item.isActive !== false)
      .map((item) => ({
        label: `${item.displayName || item.plan} (${item.plan})`,
        value: item.plan,
      }));
  }, [plansData?.items]);
  const packageOptions = useMemo(
    () =>
      ((packagesData?.items ?? []) as any[])
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          label: `${item.displayName || item.id} (${item.id})`,
          value: item.id,
        })),
    [packagesData?.items],
  );

  const handleBulkDisable = async () => {
    if (selectedIds.length === 0) return;
    setBulkRunning(true);
    try {
      const r = await adminCommercialService.bulkDisableRedemptionCodes(selectedIds);
      message.success(
        t('admin.redemption.bulkDisableDone', `Disabled ${r.disabled}/${r.requested}`),
      );
      setSelectedIds([]);
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', 'Action failed'));
    } finally {
      setBulkRunning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkRunning(true);
    try {
      const r = await adminCommercialService.bulkDeleteRedemptionCodes(selectedIds);
      message.success(
        t('admin.redemption.bulkDeleteDone', `Deleted ${r.deleted}/${r.requested}`),
      );
      setSelectedIds([]);
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', 'Action failed'));
    } finally {
      setBulkRunning(false);
    }
  };

  const handleGenerate = async () => {
    try {
      const v = await genForm.validateFields();
      setGenerating(true);
      const payload: any = {
        codeLength: v.codeLength,
        count: v.count,
        batchId: v.batchId || undefined,
        expiresAt: v.expiresAt ? v.expiresAt.toISOString() : undefined,
        note: v.note || undefined,
        rewardType: v.rewardType,
      };
      if (v.rewardType === 'plan') {
        payload.planCycle = v.planCycle;
        payload.planDurationMonths = v.planDurationMonths;
        payload.planKey = v.planKey;
      } else if (v.rewardType === 'credits') {
        payload.creditsAmount = v.creditsAmount;
      } else {
        payload.topupPackageId = v.topupPackageId;
      }
      const res = await adminCommercialService.generateRedemptionCodes(payload);
      setGenResult(res);
      setGenOpen(false);
      genForm.resetFields();
      await mutate();
      message.success(t('admin.redemption.genSuccess', `Generated ${res.codes.length}`));
    } catch (err: any) {
      if (err?.errorFields) return; // validation
      message.error(t('admin.redemption.genFailed', 'Generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await adminCommercialService.disableRedemptionCode(id);
      message.success(t('admin.redemption.disableSuccess', 'Disabled'));
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', 'Action failed'));
    }
  };
  const handleEnable = async (id: string) => {
    try {
      await adminCommercialService.enableRedemptionCode(id);
      message.success(t('admin.redemption.enableSuccess', 'Enabled'));
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', 'Action failed'));
    }
  };

  const handleExportBatch = () => {
    if (!genResult) return;
    const blob = new Blob(
      [`code\n${genResult.codes.map((c) => escapeCsv(c)).join('\n')}\n`],
      { type: 'text/csv;charset=utf-8' },
    );
    const a = document.createElement('a');
    a.download = `redemption-${genResult.batchId}.csv`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const columns = [
    {
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <code>{v}</code>,
      title: t('admin.redemption.col.code', 'Code'),
    },
    {
      dataIndex: 'rewardType',
      key: 'rewardType',
      render: (v: RewardType) => <Tag color={REWARD_COLORS[v]}>{v}</Tag>,
      title: t('admin.redemption.col.type', 'Type'),
    },
    {
      key: 'reward',
      render: (_: unknown, r: any) =>
        r.rewardType === 'plan'
          ? `${r.planKey} · ${r.planCycle}${r.planDurationMonths ? ` · ${r.planDurationMonths}m` : ''}`
          : r.rewardType === 'credits'
            ? `${r.creditsAmount} credits`
            : r.topupPackageId,
      title: t('admin.redemption.col.reward', 'Reward'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.redemption.col.status', 'Status'),
    },
    {
      dataIndex: 'batchId',
      key: 'batchId',
      render: (v: string | null) => (v ? <code style={{ fontSize: 11 }}>{v}</code> : '—'),
      title: t('admin.redemption.col.batch', 'Batch'),
    },
    {
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—'),
      title: t('admin.redemption.col.expires', 'Expires'),
    },
    {
      dataIndex: 'redeemedByUserId',
      key: 'redeemedByUserId',
      render: (v: string | null) => (v ? <code>{v.slice(0, 8)}</code> : '—'),
      title: t('admin.redemption.col.redeemedBy', 'Redeemed By'),
    },
    {
      dataIndex: 'redeemedAt',
      key: 'redeemedAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '—'),
      title: t('admin.redemption.col.redeemedAt', 'Redeemed At'),
    },
    {
      key: 'actions',
      render: (_: unknown, r: any) =>
        r.status === 'active' ? (
          <Button danger onClick={() => handleDisable(r.id)} size="small">
            {t('admin.redemption.disable', 'Disable')}
          </Button>
        ) : r.status === 'disabled' ? (
          <Button onClick={() => handleEnable(r.id)} size="small" type="primary">
            {t('admin.redemption.enable', 'Enable')}
          </Button>
        ) : (
          '—'
        ),
      title: t('admin.redemption.col.actions', 'Actions'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox align="center" gap={12} horizontal wrap="wrap">
        <Select<Status>
          onChange={(v) => {
            setStatus(v);
            setCursor(0);
          }}
          options={[
            { label: t('admin.redemption.status.all', 'All'), value: 'all' },
            { label: t('admin.redemption.status.active', 'Active'), value: 'active' },
            { label: t('admin.redemption.status.redeemed', 'Redeemed'), value: 'redeemed' },
            { label: t('admin.redemption.status.disabled', 'Disabled'), value: 'disabled' },
            { label: t('admin.redemption.status.expired', 'Expired'), value: 'expired' },
          ]}
          style={{ width: 140 }}
          value={status}
        />
        <Select<RewardType | undefined>
          allowClear
          onChange={(v) => {
            setRewardType(v);
            setCursor(0);
          }}
          options={[
            { label: 'Plan', value: 'plan' },
            { label: 'Credits', value: 'credits' },
            { label: 'Top-Up Package', value: 'topup_package' },
          ]}
          placeholder={t('admin.redemption.filter.type', 'Reward type')}
          style={{ width: 180 }}
          value={rewardType}
        />
        <Input
          allowClear
          onChange={(e) => {
            setBatchId(e.target.value);
            setCursor(0);
          }}
          placeholder={t('admin.redemption.filter.batch', 'Batch ID')}
          style={{ width: 200 }}
          value={batchId}
        />
        <Input
          allowClear
          onChange={(e) => {
            setCodeQuery(e.target.value);
            setCursor(0);
          }}
          placeholder={t('admin.redemption.filter.code', 'Code contains...')}
          style={{ width: 200 }}
          value={codeQuery}
        />
        <Space>
          <Button onClick={() => setGenOpen(true)} type="primary">
            {t('admin.redemption.generate', 'Generate Codes')}
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Popconfirm
                onConfirm={handleBulkDisable}
                title={t(
                  'admin.redemption.confirmBulkDisable',
                  `Disable ${selectedIds.length} active codes?`,
                )}
              >
                <Button danger loading={bulkRunning}>
                  {t('admin.redemption.bulkDisable', `Disable (${selectedIds.length})`)}
                </Button>
              </Popconfirm>
              <Popconfirm
                onConfirm={handleBulkDelete}
                title={t(
                  'admin.redemption.confirmBulkDelete',
                  `Permanently delete ${selectedIds.length} unredeemed codes?`,
                )}
              >
                <Button danger loading={bulkRunning}>
                  {t('admin.redemption.bulkDelete', `Delete (${selectedIds.length})`)}
                </Button>
              </Popconfirm>
              <Button onClick={() => setSelectedIds([])}>
                {t('admin.redemption.clearSel', 'Clear')}
              </Button>
            </>
          )}
          <Button
            onClick={async () => {
              try {
                const r = await adminCommercialService.expireOverdueRedemptionCodes();
                message.success(
                  t('admin.redemption.expireDone', `Expired ${r.expired} codes`),
                );
                await mutate();
              } catch {
                message.error(t('admin.redemption.actionFailed', 'Action failed'));
              }
            }}
          >
            {t('admin.redemption.sweepExpired', 'Sweep Expired')}
          </Button>
        </Space>
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.redemption.empty', 'No codes')} />
      ) : (
        <InlineTable
          columns={columns as any}
          dataSource={items}
          loading={isLoading}
          rowKey="id"
          rowSelection={{
            getCheckboxProps: (row: any) => ({ disabled: row.status === 'redeemed' }),
            onChange: (keys) => setSelectedIds(keys as string[]),
            selectedRowKeys: selectedIds,
          }}
        />
      )}

      {data?.nextCursor != null && (
        <Flexbox align="center">
          <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
            {t('admin.redemption.loadMore', 'Load More')}
          </Button>
        </Flexbox>
      )}

      <Modal
        confirmLoading={generating}
        onCancel={() => setGenOpen(false)}
        onOk={handleGenerate}
        open={genOpen}
        title={t('admin.redemption.genTitle', 'Generate Redemption Codes')}
        width={560}
      >
        <Form form={genForm} initialValues={{ codeLength: 16, count: 10, rewardType: 'credits' }} layout="vertical">
          <Form.Item label={t('admin.redemption.field.rewardType', 'Reward Type')} name="rewardType" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Credits', value: 'credits' },
                { label: 'Plan', value: 'plan' },
                { label: 'Top-Up Package', value: 'topup_package' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.rewardType !== c.rewardType}>
            {({ getFieldValue }) => {
              const rt = getFieldValue('rewardType') as RewardType;
              if (rt === 'plan')
                return (
                  <>
                    <Form.Item
                      extra={
                        planOptions.length === 0
                          ? t(
                              'admin.redemption.field.planKey.empty',
                              'Create and activate a plan in the admin plan catalog before generating plan redemption codes.',
                            )
                          : undefined
                      }
                      label={t('admin.redemption.field.planKey', 'Plan Key')}
                      name="planKey"
                      rules={[{ required: true }]}
                    >
                      <Select
                        disabled={planOptions.length === 0}
                        notFoundContent={t(
                          'admin.redemption.field.planKey.notFound',
                          'No active plans',
                        )}
                        options={planOptions}
                        placeholder={t(
                          'admin.redemption.field.planKey.placeholder',
                          'Select an active plan from the plan catalog',
                        )}
                      />
                    </Form.Item>
                    <Form.Item label={t('admin.redemption.field.planCycle', 'Cycle')} name="planCycle" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { label: 'Monthly', value: 'monthly' },
                          { label: 'Yearly', value: 'yearly' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label={t('admin.redemption.field.planDuration', 'Duration (months, optional)')} name="planDurationMonths">
                      <InputNumber max={60} min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                );
              if (rt === 'credits')
                return (
                  <Form.Item label={t('admin.redemption.field.creditsAmount', 'Credits per code')} name="creditsAmount" rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                );
              return (
                <Form.Item
                  extra={
                    packageOptions.length === 0
                      ? t(
                          'admin.redemption.field.topupPackageId.empty',
                          'Create and activate a top-up package before generating package codes.',
                        )
                      : undefined
                  }
                  label={t('admin.redemption.field.topupPackageId', 'Top-Up Package')}
                  name="topupPackageId"
                  rules={[{ required: true }]}
                >
                  <Select
                    disabled={packageOptions.length === 0}
                    notFoundContent={t(
                      'admin.redemption.field.topupPackageId.notFound',
                      'No active top-up packages',
                    )}
                    options={packageOptions}
                    placeholder={t(
                      'admin.redemption.field.topupPackageId.placeholder',
                      'Select an active package',
                    )}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.count', 'How many codes')} name="count">
            <InputNumber max={1000} min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.codeLength', 'Code length')} name="codeLength">
            <InputNumber max={32} min={8} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.expiresAt', 'Expires at (optional)')} name="expiresAt">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.batchId', 'Batch ID (optional)')} name="batchId">
            <Input />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.note', 'Note (optional)')} name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        footer={[
          <Button key="csv" onClick={handleExportBatch} type="primary">
            {t('admin.redemption.downloadCsv', 'Download CSV')}
          </Button>,
          <Button key="close" onClick={() => setGenResult(null)}>
            {t('admin.redemption.close', 'Close')}
          </Button>,
        ]}
        onCancel={() => setGenResult(null)}
        open={!!genResult}
        title={t('admin.redemption.generated', 'Generated Codes')}
        width={560}
      >
        {genResult && (
          <Flexbox gap={8}>
            <div>
              {t('admin.redemption.batch', 'Batch')}: <code>{genResult.batchId}</code>
            </div>
            <Input.TextArea
              readOnly
              rows={Math.min(15, genResult.codes.length)}
              value={genResult.codes.join('\n')}
            />
          </Flexbox>
        )}
      </Modal>
    </Flexbox>
  );
});

AdminRedemptionPage.displayName = 'AdminRedemptionPage';

export default AdminRedemptionPage;
