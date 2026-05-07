'use client';

import { Flexbox } from '@lobehub/ui';
import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
} from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
      message.success(t('admin.redemption.bulkDisableDone', `??? ${r.disabled}/${r.requested} ?`));
      setSelectedIds([]);
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', '????'));
    } finally {
      setBulkRunning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkRunning(true);
    try {
      const r = await adminCommercialService.bulkDeleteRedemptionCodes(selectedIds);
      message.success(t('admin.redemption.bulkDeleteDone', `??? ${r.deleted}/${r.requested} ?`));
      setSelectedIds([]);
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', '????'));
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
      message.success(t('admin.redemption.genSuccess', `??? ${res.codes.length} ?`));
    } catch (err: any) {
      if (err?.errorFields) return; // validation
      message.error(t('admin.redemption.genFailed', '????'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await adminCommercialService.disableRedemptionCode(id);
      message.success(t('admin.redemption.disableSuccess', '???'));
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', '????'));
    }
  };
  const handleEnable = async (id: string) => {
    try {
      await adminCommercialService.enableRedemptionCode(id);
      message.success(t('admin.redemption.enableSuccess', '???'));
      await mutate();
    } catch {
      message.error(t('admin.redemption.actionFailed', '????'));
    }
  };

  const handleExportBatch = () => {
    if (!genResult) return;
    const blob = new Blob([`code\n${genResult.codes.map((c) => escapeCsv(c)).join('\n')}\n`], {
      type: 'text/csv;charset=utf-8',
    });
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
      title: t('admin.redemption.col.code', '???'),
    },
    {
      dataIndex: 'rewardType',
      key: 'rewardType',
      render: (v: RewardType) => <Tag color={REWARD_COLORS[v]}>{v}</Tag>,
      title: t('admin.redemption.col.type', '??'),
    },
    {
      key: 'reward',
      render: (_: unknown, r: any) =>
        r.rewardType === 'plan'
          ? `${r.planKey} · ${r.planCycle}${r.planDurationMonths ? ` · ${r.planDurationMonths}m` : ''}`
          : r.rewardType === 'credits'
            ? `${r.creditsAmount} credits`
            : r.topupPackageId,
      title: t('admin.redemption.col.reward', '??'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
      title: t('admin.redemption.col.status', '??'),
    },
    {
      dataIndex: 'batchId',
      key: 'batchId',
      render: (v: string | null) => (v ? <code style={{ fontSize: 11 }}>{v}</code> : '—'),
      title: t('admin.redemption.col.batch', '??'),
    },
    {
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—'),
      title: t('admin.redemption.col.expires', '????'),
    },
    {
      dataIndex: 'redeemedByUserId',
      key: 'redeemedByUserId',
      render: (v: string | null) => (v ? <code>{v.slice(0, 8)}</code> : '—'),
      title: t('admin.redemption.col.redeemedBy', '????'),
    },
    {
      dataIndex: 'redeemedAt',
      key: 'redeemedAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '—'),
      title: t('admin.redemption.col.redeemedAt', '????'),
    },
    {
      key: 'actions',
      render: (_: unknown, r: any) =>
        r.status === 'active' ? (
          <Button danger size="small" onClick={() => handleDisable(r.id)}>
            {t('admin.redemption.disable', '??')}
          </Button>
        ) : r.status === 'disabled' ? (
          <Button size="small" type="primary" onClick={() => handleEnable(r.id)}>
            {t('admin.redemption.enable', '??')}
          </Button>
        ) : (
          '—'
        ),
      title: t('admin.redemption.col.actions', '??'),
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox horizontal align="center" gap={12} wrap="wrap">
        <Select<Status>
          style={{ width: 140 }}
          value={status}
          options={[
            { label: t('admin.redemption.status.all', '??'), value: 'all' },
            { label: t('admin.redemption.status.active', '??'), value: 'active' },
            { label: t('admin.redemption.status.redeemed', '???'), value: 'redeemed' },
            { label: t('admin.redemption.status.disabled', '???'), value: 'disabled' },
            { label: t('admin.redemption.status.expired', '???'), value: 'expired' },
          ]}
          onChange={(v) => {
            setStatus(v);
            setCursor(0);
          }}
        />
        <Select<RewardType | undefined>
          allowClear
          placeholder={t('admin.redemption.filter.type', '????')}
          style={{ width: 180 }}
          value={rewardType}
          options={[
            { label: '???Plan?', value: 'plan' },
            { label: '??', value: 'credits' },
            { label: '???', value: 'topup_package' },
          ]}
          onChange={(v) => {
            setRewardType(v);
            setCursor(0);
          }}
        />
        <Input
          allowClear
          placeholder={t('admin.redemption.filter.batch', 'Batch ID')}
          style={{ width: 200 }}
          value={batchId}
          onChange={(e) => {
            setBatchId(e.target.value);
            setCursor(0);
          }}
        />
        <Input
          allowClear
          placeholder={t('admin.redemption.filter.code', '?????...')}
          style={{ width: 200 }}
          value={codeQuery}
          onChange={(e) => {
            setCodeQuery(e.target.value);
            setCursor(0);
          }}
        />
        <Space>
          <Button type="primary" onClick={() => setGenOpen(true)}>
            {t('admin.redemption.generate', '?????')}
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Popconfirm
                title={t(
                  'admin.redemption.confirmBulkDisable',
                  `???? ${selectedIds.length} ???????`,
                )}
                onConfirm={handleBulkDisable}
              >
                <Button danger loading={bulkRunning}>
                  {t('admin.redemption.bulkDisable', `???${selectedIds.length}?`)}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t(
                  'admin.redemption.confirmBulkDelete',
                  `?????? ${selectedIds.length} ????????`,
                )}
                onConfirm={handleBulkDelete}
              >
                <Button danger loading={bulkRunning}>
                  {t('admin.redemption.bulkDelete', `???${selectedIds.length}?`)}
                </Button>
              </Popconfirm>
              <Button onClick={() => setSelectedIds([])}>
                {t('admin.redemption.clearSel', '????')}
              </Button>
            </>
          )}
          <Button
            onClick={async () => {
              try {
                const r = await adminCommercialService.expireOverdueRedemptionCodes();
                message.success(t('admin.redemption.expireDone', `??? ${r.expired} ????`));
                await mutate();
              } catch {
                message.error(t('admin.redemption.actionFailed', '????'));
              }
            }}
          >
            {t('admin.redemption.sweepExpired', '???????')}
          </Button>
        </Space>
      </Flexbox>

      {!isLoading && items.length === 0 ? (
        <Empty description={t('admin.redemption.empty', '?????')} />
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
            {t('admin.redemption.loadMore', '????')}
          </Button>
        </Flexbox>
      )}

      <Modal
        confirmLoading={generating}
        open={genOpen}
        title={t('admin.redemption.genTitle', '?????')}
        width={560}
        onCancel={() => setGenOpen(false)}
        onOk={handleGenerate}
      >
        <Form
          form={genForm}
          initialValues={{ codeLength: 16, count: 10, rewardType: 'credits' }}
          layout="vertical"
        >
          <Form.Item
            label={t('admin.redemption.field.rewardType', '????')}
            name="rewardType"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: '??', value: 'credits' },
                { label: '???Plan?', value: 'plan' },
                { label: '???', value: 'topup_package' },
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
                      label={t('admin.redemption.field.planKey', '????')}
                      name="planKey"
                      rules={[{ required: true }]}
                      extra={
                        planOptions.length === 0
                          ? t('admin.redemption.field.planKey.empty', '??????????????????????????')
                          : undefined
                      }
                    >
                      <Select
                        disabled={planOptions.length === 0}
                        options={planOptions}
                        notFoundContent={t('admin.redemption.field.planKey.notFound', '??????')}
                        placeholder={t('admin.redemption.field.planKey.placeholder', '??????????')}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('admin.redemption.field.planCycle', '??')}
                      name="planCycle"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { label: '??', value: 'monthly' },
                          { label: '??', value: 'yearly' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('admin.redemption.field.planDuration', '??????????')}
                      name="planDurationMonths"
                    >
                      <InputNumber max={60} min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                );
              if (rt === 'credits')
                return (
                  <Form.Item
                    label={t('admin.redemption.field.creditsAmount', '???????')}
                    name="creditsAmount"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                );
              return (
                <Form.Item
                  label={t('admin.redemption.field.topupPackageId', '???')}
                  name="topupPackageId"
                  rules={[{ required: true }]}
                  extra={
                    packageOptions.length === 0
                      ? t('admin.redemption.field.topupPackageId.empty', '?????????????????????')
                      : undefined
                  }
                >
                  <Select
                    disabled={packageOptions.length === 0}
                    options={packageOptions}
                    notFoundContent={t('admin.redemption.field.topupPackageId.notFound', '???????')}
                    placeholder={t(
                      'admin.redemption.field.topupPackageId.placeholder',
                      '???????????',
                    )}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.count', '????')} name="count">
            <InputNumber max={1000} min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.codeLength', '?????')} name="codeLength">
            <InputNumber max={32} min={8} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.expiresAt', '????????')} name="expiresAt">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.batchId', '?? ID????')} name="batchId">
            <Input />
          </Form.Item>
          <Form.Item label={t('admin.redemption.field.note', '??????')} name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!genResult}
        title={t('admin.redemption.generated', '??????')}
        width={560}
        footer={[
          <Button key="csv" type="primary" onClick={handleExportBatch}>
            {t('admin.redemption.downloadCsv', '?? CSV')}
          </Button>,
          <Button key="close" onClick={() => setGenResult(null)}>
            {t('admin.redemption.close', '??')}
          </Button>,
        ]}
        onCancel={() => setGenResult(null)}
      >
        {genResult && (
          <Flexbox gap={8}>
            <div>
              {t('admin.redemption.batch', '??')}: <code>{genResult.batchId}</code>
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
