'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Input, Modal, Select, toast } from '@lobehub/ui/base-ui';
import TextArea from '@lobehub/ui/es/base-ui/Input/TextArea';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/validateFields）与 RedemptionGenerateFormFields 的受控表单契约绑定；base-ui Form 为非受控原生表单、base-ui/form 的 FormKit 是语义重写，均无法行为不变替换；FormKit 迁移另行立项。
import { Form } from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import AdminBulkActionFlow from '@/features/Admin/AdminBulkActionFlow';
import type { AdminDangerousActionEnvelope } from '@/features/Admin/adminDangerousActions';
import {
  AdminPageShell,
  AdminResponsiveTable,
  AdminSection,
  AdminToolbar,
} from '@/features/Admin/layout';
import {
  buildRedemptionGeneratePayload,
  RedemptionGenerateFormFields,
} from '@/features/Admin/Redemption/generateForm';
import { buildRedemptionColumns } from '@/features/Admin/Redemption/redemptionColumns';
import { exportRedemptionBatchCsv } from '@/features/Admin/Redemption/resultCsv';
import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

type RewardType = 'plan' | 'credits' | 'topup_package';
type Status = 'all' | 'active' | 'redeemed' | 'disabled' | 'expired';

const AdminRedemptionPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [status, setStatus] = useState<Status>('all');
  const [rewardType, setRewardType] = useState<RewardType | undefined>(undefined);
  const [batchId, setBatchId] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [genOpen, setGenOpen] = useState(false);
  const [genResult, setGenResult] = useState<{ batchId: string; codes: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genForm] = Form.useForm();

  const swrKey = useMemo(
    () => ['admin-redemption', status, rewardType, batchId, codeQuery, cursor] as const,
    [status, rewardType, batchId, codeQuery, cursor],
  );

  const { data, error, isLoading, mutate } = useClientDataSWR(swrKey, () =>
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

  const handleBulkDisable = async (
    command: AdminDangerousActionEnvelope<'redemption.bulkDisable'>,
  ) => adminCommercialService.bulkDisableRedemptionCodes(selectedIds, command);

  const handleBulkDelete = async (command: AdminDangerousActionEnvelope<'redemption.bulkDelete'>) =>
    adminCommercialService.bulkDeleteRedemptionCodes(
      {
        ids: selectedIds,
        reason: command.reason?.trim(),
      },
      command,
    );

  const finishBulkAction = async () => {
    setSelectedIds([]);
    await mutate();
  };

  const formatBulkDisableResult = (value: unknown) => {
    const result = value as { disabled: number; requested: number };

    return {
      requested: result.requested,
      succeeded: result.disabled,
      title: t(
        'admin.redemption.bulkDisableDone',
        `已停用 ${result.disabled}/${result.requested} 个`,
      ),
    };
  };

  const formatBulkDeleteResult = (value: unknown) => {
    const result = value as { deleted: number; requested: number };

    return {
      requested: result.requested,
      succeeded: result.deleted,
      title: t(
        'admin.redemption.bulkDeleteDone',
        `已删除 ${result.deleted}/${result.requested} 个`,
      ),
    };
  };

  const handleGenerate = async () => {
    try {
      const v = await genForm.validateFields();
      setGenerating(true);
      const payload = buildRedemptionGeneratePayload(v);
      const res = await adminCommercialService.generateRedemptionCodes(payload as any);
      setGenResult(res);
      setGenOpen(false);
      genForm.resetFields();
      await mutate();
      toast.success(t('admin.redemption.genSuccess', `已生成 ${res.codes.length} 个`));
    } catch (err: any) {
      if (err?.errorFields) return; // validation
      toast.error(t('admin.redemption.genFailed', '生成失败'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await adminCommercialService.disableRedemptionCode(id);
      toast.success(t('admin.redemption.disableSuccess', '已停用'));
      await mutate();
    } catch {
      toast.error(t('admin.redemption.actionFailed', '操作失败'));
    }
  };
  const handleEnable = async (id: string) => {
    try {
      await adminCommercialService.enableRedemptionCode(id);
      toast.success(t('admin.redemption.enableSuccess', '已启用'));
      await mutate();
    } catch {
      toast.error(t('admin.redemption.actionFailed', '操作失败'));
    }
  };

  const handleExportBatch = () => {
    if (!genResult) return;
    exportRedemptionBatchCsv(genResult);
  };

  const columns = buildRedemptionColumns({
    handleDisable,
    handleEnable,
    t: t as any,
  });

  return (
    <AdminPageShell
      description={t(
        'admin.redemption.description',
        '生成、筛选和维护兑换码；批量操作需要经过受控确认。',
      )}
      title={t('admin.redemption.title', '兑换码管理')}
      width="full"
      state={{
        error,
        errorDescription: t('admin.redemption.loadFailed', '兑换码加载失败，请重试。'),
        isEmpty: !isLoading && !error && items.length === 0,
        emptyDescription: t('admin.redemption.empty', '暂无兑换码'),
        loading: isLoading,
        onRetry: mutate,
      }}
    >
      <AdminSection
        description={t('admin.redemption.resultSummary', '按状态、奖励类型、批次或兑换码筛选。')}
        title={t('admin.redemption.listTitle', '兑换码列表')}
      >
        <AdminToolbar>
          <Flexbox
            horizontal
            align="center"
            gap={12}
            style={{ flex: '1 1 520px', flexWrap: 'wrap' }}
          >
            <Select
              style={{ width: 'min(140px, 100%)' }}
              value={status}
              options={[
                { label: t('admin.redemption.status.all', '全部'), value: 'all' },
                { label: t('admin.redemption.status.active', '可用'), value: 'active' },
                { label: t('admin.redemption.status.redeemed', '已兑换'), value: 'redeemed' },
                { label: t('admin.redemption.status.disabled', '已停用'), value: 'disabled' },
                { label: t('admin.redemption.status.expired', '已过期'), value: 'expired' },
              ]}
              onChange={(v: 'active' | 'all' | 'disabled' | 'expired' | 'redeemed') => {
                setStatus(v);
                setCursor(0);
              }}
            />
            <Select
              allowClear
              placeholder={t('admin.redemption.filter.type', '奖励类型')}
              style={{ width: 'min(180px, 100%)' }}
              value={rewardType}
              options={[
                { label: '套餐（Plan）', value: 'plan' },
                { label: '积分', value: 'credits' },
                { label: '充值套餐', value: 'topup_package' },
              ]}
              onChange={(v: RewardType | undefined) => {
                setRewardType(v);
                setCursor(0);
              }}
            />
            <Input
              allowClear
              placeholder={t('admin.redemption.filter.batch', '批次 ID')}
              style={{ width: 'min(200px, 100%)' }}
              value={batchId}
              onChange={(e: { target: { value: string } }) => {
                setBatchId(e.target.value);
                setCursor(0);
              }}
            />
            <Input
              allowClear
              placeholder={t('admin.redemption.filter.code', '搜索兑换码...')}
              style={{ width: 'min(200px, 100%)' }}
              value={codeQuery}
              onChange={(e: { target: { value: string } }) => {
                setCodeQuery(e.target.value);
                setCursor(0);
              }}
            />
            <Flexbox horizontal gap={8} wrap="wrap">
              <Button type="primary" onClick={() => setGenOpen(true)}>
                {t('admin.redemption.generate', '生成兑换码')}
              </Button>
              {selectedIds.length > 0 && (
                <>
                  <AdminBulkActionFlow
                    danger
                    actionId="redemption.bulkDisable"
                    count={selectedIds.length}
                    summary={formatBulkDisableResult}
                    confirmTitle={t(
                      'admin.redemption.confirmBulkDisable',
                      `确认停用 ${selectedIds.length} 个兑换码？`,
                    )}
                    progressDescription={t(
                      'admin.redemption.bulkDisableProgress',
                      '正在停用选中的兑换码，请勿关闭页面。',
                    )}
                    onRun={handleBulkDisable}
                    onSuccess={finishBulkAction}
                  >
                    {t('admin.redemption.bulkDisable', `停用 ${selectedIds.length} 个`)}
                  </AdminBulkActionFlow>
                  <AdminBulkActionFlow
                    danger
                    actionId="redemption.bulkDelete"
                    count={selectedIds.length}
                    summary={formatBulkDeleteResult}
                    confirmTitle={t(
                      'admin.redemption.confirmBulkDelete',
                      `确认删除 ${selectedIds.length} 个未兑换兑换码？`,
                    )}
                    progressDescription={t(
                      'admin.redemption.bulkDeleteProgress',
                      '正在删除选中的未兑换兑换码，请勿关闭页面。',
                    )}
                    onRun={handleBulkDelete}
                    onSuccess={finishBulkAction}
                  >
                    {t('admin.redemption.bulkDelete', `删除 ${selectedIds.length} 个`)}
                  </AdminBulkActionFlow>
                  <Button onClick={() => setSelectedIds([])}>
                    {t('admin.redemption.clearSel', '清空选择')}
                  </Button>
                </>
              )}
              <Button
                onClick={async () => {
                  try {
                    const r = await adminCommercialService.expireOverdueRedemptionCodes();
                    toast.success(t('admin.redemption.expireDone', `已过期 ${r.expired} 个兑换码`));
                    await mutate();
                  } catch {
                    toast.error(t('admin.redemption.actionFailed', '操作失败'));
                  }
                }}
              >
                {t('admin.redemption.sweepExpired', '扫描过期兑换码')}
              </Button>
            </Flexbox>
          </Flexbox>
        </AdminToolbar>

        {!error && (isLoading || items.length > 0) ? (
          <AdminResponsiveTable label={t('admin.redemption.tableLabel', '兑换码表')}>
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
          </AdminResponsiveTable>
        ) : null}

        {data?.nextCursor != null && (
          <Flexbox align="center">
            <Button loading={isLoading} onClick={() => setCursor(data.nextCursor!)}>
              {t('admin.redemption.loadMore', '加载更多')}
            </Button>
          </Flexbox>
        )}
      </AdminSection>

      <Modal
        confirmLoading={generating}
        open={genOpen}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        title={t('admin.redemption.genTitle', '生成兑换码')}
        width={560}
        onCancel={() => setGenOpen(false)}
        onOk={handleGenerate}
      >
        <RedemptionGenerateFormFields
          form={genForm}
          packageOptions={packageOptions}
          planOptions={planOptions}
          t={t as any}
        />
      </Modal>

      <Modal
        open={!!genResult}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        title={t('admin.redemption.generated', '兑换码已生成')}
        width={560}
        footer={[
          <Button key="csv" type="primary" onClick={handleExportBatch}>
            {t('admin.redemption.downloadCsv', '下载 CSV')}
          </Button>,
          <Button key="close" onClick={() => setGenResult(null)}>
            {t('admin.redemption.close', '关闭')}
          </Button>,
        ]}
        onCancel={() => setGenResult(null)}
      >
        {genResult && (
          <Flexbox gap={8}>
            <div>
              {t('admin.redemption.batch', '批次')}: <code>{genResult.batchId}</code>
            </div>
            <TextArea
              readOnly
              rows={Math.min(15, genResult.codes.length)}
              value={genResult.codes.join('\n')}
            />
          </Flexbox>
        )}
      </Modal>
    </AdminPageShell>
  );
});

AdminRedemptionPage.displayName = 'AdminRedemptionPage';

export default AdminRedemptionPage;
