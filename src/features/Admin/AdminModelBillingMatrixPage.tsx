'use client';

import { Flexbox } from '@lobehub/ui';
import { DEFAULT_PRICING_CREDIT_MULTIPLIER } from '@lobechat/const/currency';
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  message,
  Space,
  Switch,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from 'antd';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/antd-compat/Card';
import {
  MATRIX_ACCESS_SAVE_LABEL,
  MATRIX_DISCARD_LABEL,
  MATRIX_NOTICE,
  MATRIX_PRICING_SAVE_LABEL,
  MATRIX_SUBTITLE,
} from '@/features/Admin/adminMatrixCopy';
import {
  buildMatrixRows,
  buildPlanModelRulesFromRows,
  buildPricingRulesFromRows,
  findFreePlanDefaultModelConflict,
  getDefaultModelHealth,
  getMatrixConfigHealth,
  getMatrixConfigHealthFocus,
  type MatrixConfigHealthCheck,
  type MatrixModelType,
  type MatrixPlan,
  type MatrixPlanRules,
  type MatrixRow,
  type MatrixSourceModel,
  togglePlanAccess,
} from '@/features/Admin/adminModelBillingMatrix';
import { getAdminModelTypeLabel } from '@/features/Admin/adminModelTypeLabels';
import {
  ADMIN_SETTINGS_SWR_KEY,
  getAdminSettingsRefreshKeys,
  SETTING_KEYS,
} from '@/features/Admin/adminSettingsForm';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';

const { Text, Title } = Typography;

const MATRIX_KEY = ['admin-model-billing-matrix'];
const PLANS_KEY = ['admin-plans'];

const DEFAULT_HEALTH_STATUS = {
  denied_by_free_plan: { color: 'orange', label: '免费套餐未开放' },
  not_configured: { color: 'default', label: '未配置' },
  not_enabled: { color: 'red', label: '未启用' },
  ok: { color: 'green', label: '正常' },
  type_mismatch: { color: 'red', label: '类型不匹配' },
} as const;

const CONFIG_HEALTH_STATUS = {
  error: { alertType: 'error', color: 'red', label: 'Error' },
  ok: { alertType: 'success', color: 'green', label: 'OK' },
  warning: { alertType: 'warning', color: 'orange', label: 'Warning' },
} as const;

const CONFIG_HEALTH_CHECK_STATUS = {
  error: { color: 'red', label: 'Error' },
  info: { color: 'blue', label: 'Info' },
  ok: { color: 'green', label: 'OK' },
  warning: { color: 'orange', label: 'Warning' },
} as const;

type PlanItem = {
  displayName?: string | null;
  modelRules?: MatrixPlanRules | null;
  plan: string;
};

type EnabledModelItem = {
  displayName?: string | null;
  groupKey?: string | null;
  groupName?: string | null;
  instanceId: string;
  instanceName: string;
  modelId: string;
  modelType: MatrixModelType;
  priority: number;
  providerType?: string | null;
};

type BillingBasisValues = {
  ordersEnabled: boolean;
  pricingMultiplier: number;
};

const FILTERABLE_CONFIG_HEALTH_CHECKS = new Set([
  'blocked-models',
  'default-models',
  'global-pricing-multiplier',
  'healthy',
  'plans-without-models',
  'pricing-fallbacks',
]);

const toFiniteNumber = (value: number | string | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const buildBillingBasisValues = (settings?: {
  ordersManagementEnabled?: boolean | null;
  pricingCreditMultiplier?: number | null;
}): BillingBasisValues => ({
  ordersEnabled: settings?.ordersManagementEnabled ?? true,
  pricingMultiplier:
    typeof settings?.pricingCreditMultiplier === 'number' &&
    Number.isFinite(settings.pricingCreditMultiplier) &&
    settings.pricingCreditMultiplier > 0
      ? settings.pricingCreditMultiplier
      : DEFAULT_PRICING_CREDIT_MULTIPLIER,
});

const getDefaultModelErrorMessage = (error: any) => {
  if (error?.message === 'DEFAULT_MODEL_NOT_ENABLED') {
    return '默认模型未在已启用模型目录中，请先在服务商实例中启用该模型。';
  }

  if (error?.message === 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN') {
    return '默认模型未被免费套餐允许，新注册用户将无法使用该模型。请调整免费套餐模型权限。';
  }

  return '保存默认模型失败';
};

const AdminModelBillingMatrixPage = memo(() => {
  const { t } = useTranslation('subscription');
  const [billingBasisOverride, setBillingBasisOverride] = useState<BillingBasisValues | null>(null);
  const [focusedHealthCheckKey, setFocusedHealthCheckKey] = useState<string | null>(null);
  const [savingBillingBasis, setSavingBillingBasis] = useState(false);
  const [rowsOverride, setRowsOverride] = useState<MatrixRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: modelData, isLoading: modelsLoading } = useClientDataSWR(MATRIX_KEY, () =>
    adminCommercialService.listAllEnabledAiProviderModels(),
  );
  const { data: planData, isLoading: plansLoading } = useClientDataSWR(PLANS_KEY, () =>
    adminCommercialService.listPlans(),
  );
  const { data: settings, isLoading: settingsLoading } = useClientDataSWR(
    ADMIN_SETTINGS_SWR_KEY,
    () => adminCommercialService.getAllSettings(),
  );

  const plans = useMemo<MatrixPlan[]>(
    () =>
      ((planData?.items ?? []) as PlanItem[]).map((plan) => ({
        displayName: plan.displayName || plan.plan,
        plan: plan.plan,
      })),
    [planData?.items],
  );

  const sourceModels = useMemo<MatrixSourceModel[]>(
    () =>
      ((modelData?.items ?? []) as EnabledModelItem[]).map((item) => ({
        displayName: item.displayName ?? null,
        groupKey: item.groupKey,
        groupName: item.groupName,
        instanceId: item.instanceId,
        instanceName: item.instanceName,
        modelId: item.modelId,
        modelType: item.modelType,
        priority: item.priority,
        providerType: item.providerType,
      })),
    [modelData?.items],
  );

  const baseRows = useMemo(
    () =>
      buildMatrixRows({
        defaultModel: settings?.defaultAgentModel,
        defaultModelsByType: {
          image: {
            model: settings?.defaultImageModel,
            provider: settings?.defaultImageProvider,
          },
          video: {
            model: settings?.defaultVideoModel,
            provider: settings?.defaultVideoProvider,
          },
        },
        defaultProvider: settings?.defaultAgentProvider,
        models: sourceModels,
        planRulesByPlan: Object.fromEntries(
          ((planData?.items ?? []) as PlanItem[]).map((plan) => [plan.plan, plan.modelRules]),
        ),
        plans,
        pricingRules: settings?.pricingModelRules ?? [],
      }),
    [planData?.items, plans, settings, sourceModels],
  );

  const rows = rowsOverride ?? baseRows;
  const loading = modelsLoading || plansLoading || settingsLoading;
  const billingBasisInitial = useMemo(() => buildBillingBasisValues(settings), [settings]);
  const billingBasis = billingBasisOverride ?? billingBasisInitial;
  const defaultModelHealth = useMemo(
    () =>
      getDefaultModelHealth(rows, {
        chat: {
          model: settings?.defaultAgentModel,
          provider: settings?.defaultAgentProvider,
        },
        image: {
          model: settings?.defaultImageModel,
          provider: settings?.defaultImageProvider,
        },
        video: {
          model: settings?.defaultVideoModel,
          provider: settings?.defaultVideoProvider,
        },
      }),
    [rows, settings],
  );
  const hasDefaultModelRisk = Object.values(defaultModelHealth).some(
    (item) => item.status !== 'ok',
  );
  const configHealth = useMemo(
    () =>
      getMatrixConfigHealth({
        defaultModelHealth,
        globalPricingMultiplier: billingBasis.pricingMultiplier,
        plans,
        rows,
      }),
    [billingBasis.pricingMultiplier, defaultModelHealth, plans, rows],
  );
  const configHealthMeta = CONFIG_HEALTH_STATUS[configHealth.status];
  const focusedHealthCheck = configHealth.checks.find(
    (check) => check.key === focusedHealthCheckKey,
  );
  const focusedHealthCheckFocus = useMemo(
    () =>
      focusedHealthCheck
        ? getMatrixConfigHealthFocus({
            checkKey: focusedHealthCheck.key,
            defaultModelHealth,
            plans,
            rows,
          })
        : null,
    [defaultModelHealth, focusedHealthCheck, plans, rows],
  );
  const focusedRowKeySet = useMemo(
    () => new Set(focusedHealthCheckFocus?.rowKeys ?? []),
    [focusedHealthCheckFocus?.rowKeys],
  );
  const focusedPlanKeySet = useMemo(
    () => new Set(focusedHealthCheckFocus?.planKeys ?? []),
    [focusedHealthCheckFocus?.planKeys],
  );
  const displayRows = focusedHealthCheck
    ? rows.filter((row) => focusedRowKeySet.has(row.key))
    : rows;
  const canFocusConfigHealthCheck = (check: MatrixConfigHealthCheck) =>
    FILTERABLE_CONFIG_HEALTH_CHECKS.has(check.key);
  const handleFocusConfigHealthCheck = (check: MatrixConfigHealthCheck) => {
    if (!canFocusConfigHealthCheck(check)) return;

    setFocusedHealthCheckKey((current) => (current === check.key ? null : check.key));
  };

  const getDefaultModelHealthMessage = (health: (typeof defaultModelHealth)['chat']) => {
    if (health.status === 'ok') return '已启用，且免费套餐可用，新注册用户可直接使用。';
    if (health.status === 'not_configured') return '后台还没有设置该类型的默认模型。';
    if (health.status === 'not_enabled')
      return '该模型不在已启用模型目录中，请先启用对应服务商模型。';
    if (health.status === 'type_mismatch') {
      return `模型存在，但类型是 ${getAdminModelTypeLabel(health.actualModelType || health.modelType)}，请重新选择 ${getAdminModelTypeLabel(health.modelType)} 模型。`;
    }

    return '该模型已启用，但免费套餐未开放，新注册用户默认不可用。';
  };

  const updateRow = (rowKey: string, patch: Partial<MatrixRow>) => {
    setRowsOverride((current) =>
      (current ?? baseRows).map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
    );
  };

  const updateBillingBasis = (patch: Partial<BillingBasisValues>) => {
    setBillingBasisOverride((current) => ({
      ...billingBasisInitial,
      ...current,
      ...patch,
    }));
  };

  const handleSaveBillingBasis = async () => {
    const updates = [
      ...(billingBasis.pricingMultiplier !== billingBasisInitial.pricingMultiplier
        ? [{ key: SETTING_KEYS.pricingCreditMultiplier, value: billingBasis.pricingMultiplier }]
        : []),
      ...(billingBasis.ordersEnabled !== billingBasisInitial.ordersEnabled
        ? [{ key: SETTING_KEYS.ordersManagementEnabled, value: billingBasis.ordersEnabled }]
        : []),
    ];

    if (updates.length === 0) {
      message.info(t('admin.modelBillingMatrix.billingBasisNoChanges', '没有需要保存的变更'));
      return;
    }

    setSavingBillingBasis(true);

    try {
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      setBillingBasisOverride(null);
      message.success(t('admin.modelBillingMatrix.billingBasisSaved', '全局计费设置已保存'));
    } catch {
      message.error(t('admin.modelBillingMatrix.billingBasisSaveFailed', '保存全局计费设置失败'));
    } finally {
      setSavingBillingBasis(false);
    }
  };

  const handleSetDefault = async (target: MatrixRow) => {
    if (['chat', 'image', 'video'].includes(target.modelType) && target.planAccess.free === false) {
      message.error('该模型未对免费套餐开启，不能设为默认模型。请先开启免费套餐权限。');
      return;
    }

    setSaving(true);

    try {
      const updates =
        target.modelType === 'image'
          ? [
              { key: SETTING_KEYS.defaultImageProvider, value: target.provider },
              { key: SETTING_KEYS.defaultImageModel, value: target.modelId },
            ]
          : target.modelType === 'video'
            ? [
                { key: SETTING_KEYS.defaultVideoProvider, value: target.provider },
                { key: SETTING_KEYS.defaultVideoModel, value: target.modelId },
              ]
            : [
                { key: SETTING_KEYS.defaultAgentProvider, value: target.provider },
                { key: SETTING_KEYS.defaultAgentModel, value: target.modelId },
              ];

      await adminCommercialService.validateDefaultAgentSettings({
        model: target.modelId,
        modelType:
          target.modelType === 'image' || target.modelType === 'video' ? target.modelType : 'chat',
        provider: target.provider,
      });
      await adminCommercialService.setAppSettingsBatch({ updates });
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      await Promise.all(getAdminSettingsRefreshKeys(updates).map((key) => mutate(key)));
      setRowsOverride((current) =>
        (current ?? baseRows).map((row) => ({
          ...row,
          isDefault: row.modelType === target.modelType ? row.key === target.key : row.isDefault,
        })),
      );
      message.success(t('admin.modelBillingMatrix.defaultSaved', '默认模型已保存'));
    } catch (error: any) {
      message.error(
        t('admin.modelBillingMatrix.defaultSaveFailed', getDefaultModelErrorMessage(error)),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccess = async () => {
    const conflict = findFreePlanDefaultModelConflict(rows);
    if (conflict) {
      message.error(
        `默认模型 ${conflict.displayName}（${conflict.provider}/${conflict.modelId}）已被免费套餐关闭，新注册用户将无法使用。请先开启免费套餐权限或更换默认模型。`,
      );
      return;
    }

    setSaving(true);

    try {
      const rulesByPlan = buildPlanModelRulesFromRows(rows, plans);
      await Promise.all(
        Object.entries(rulesByPlan).map(([plan, modelRules]) =>
          adminCommercialService.setPlanModelRules({ modelRules, plan }),
        ),
      );
      await mutate(PLANS_KEY);
      message.success(t('admin.modelBillingMatrix.accessSaved', '套餐模型权限已保存'));
    } catch {
      message.error(t('admin.modelBillingMatrix.accessSaveFailed', '保存套餐模型权限失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);

    try {
      await adminCommercialService.setAppSetting({
        key: SETTING_KEYS.pricingModelRules,
        value: buildPricingRulesFromRows(rows),
      });
      await mutate(ADMIN_SETTINGS_SWR_KEY);
      message.success(t('admin.modelBillingMatrix.pricingSaved', '模型计费已保存'));
    } catch {
      message.error(t('admin.modelBillingMatrix.pricingSaveFailed', '保存模型计费失败'));
    } finally {
      setSaving(false);
    }
  };

  const planColumns: TableColumnsType<MatrixRow> = plans.map((plan) => ({
    key: `plan-${plan.plan}`,
    render: (_, row) => (
      <Switch
        checked={row.planAccess[plan.plan] !== false}
        size="small"
        onChange={(checked: boolean) =>
          setRowsOverride((current) =>
            togglePlanAccess(current ?? baseRows, row.key, plan.plan, checked),
          )
        }
      />
    ),
    title: (
      <Space size={4}>
        <span>{plan.displayName}</span>
        {focusedPlanKeySet.has(plan.plan) ? <Tag color="orange">问题</Tag> : null}
      </Space>
    ),
    width: 104,
  }));

  const columns: TableColumnsType<MatrixRow> = [
    {
      key: 'model',
      render: (_, row) => (
        <Flexbox gap={4}>
          <Space wrap size={6}>
            <Text strong>{row.displayName}</Text>
            {row.isDefault && <Tag color="green">默认</Tag>}
          </Space>
          <Text copyable type="secondary">
            {row.modelId}
          </Text>
          <Space wrap size={4}>
            <Tag>{row.provider}</Tag>
            {row.providerType ? <Tag color="cyan">{row.providerType}</Tag> : null}
            {row.groupKey ? <Tag color="purple">{row.groupName || row.groupKey}</Tag> : null}
            <Tag>{getAdminModelTypeLabel(row.modelType)}</Tag>
          </Space>
        </Flexbox>
      ),
      title: t('admin.modelBillingMatrix.col.model', '模型'),
      width: 280,
    },
    {
      dataIndex: 'instanceNames',
      key: 'instanceNames',
      render: (names: string[]) => (
        <Space wrap size={[4, 4]}>
          {names.map((name) => (
            <Tag key={name}>{name}</Tag>
          ))}
        </Space>
      ),
      title: t('admin.modelBillingMatrix.col.instances', '来源实例'),
      width: 220,
    },
    ...planColumns,
    {
      dataIndex: 'pricingMultiplier',
      key: 'pricingMultiplier',
      render: (value: number | undefined, row) => (
        <InputNumber
          min={0.0001}
          placeholder="默认"
          precision={4}
          size="small"
          step={0.1}
          style={{ width: 96 }}
          value={value}
          onChange={(next: number | null) =>
            updateRow(row.key, { pricingMultiplier: toFiniteNumber(next) })
          }
        />
      ),
      title: t('admin.modelBillingMatrix.col.multiplier', '倍率'),
      width: 120,
    },
    {
      dataIndex: 'creditsPerDollar',
      key: 'creditsPerDollar',
      render: (value: number | undefined, row) => (
        <InputNumber
          min={1}
          placeholder="默认"
          size="small"
          style={{ width: 132 }}
          value={value}
          onChange={(next: number | null) =>
            updateRow(row.key, { creditsPerDollar: toFiniteNumber(next) })
          }
        />
      ),
      title: t('admin.modelBillingMatrix.col.creditsPerDollar', '每美元积分'),
      width: 152,
    },
    {
      fixed: 'right',
      key: 'actions',
      render: (_, row) => (
        <Button
          disabled={row.isDefault}
          loading={saving}
          size="small"
          onClick={() => handleSetDefault(row)}
        >
          {row.isDefault ? '当前默认' : '设为默认'}
        </Button>
      ),
      title: t('admin.modelBillingMatrix.col.actions', '操作'),
      width: 124,
    },
  ];

  return (
    <Flexbox gap={16} padding={24}>
      <Flexbox gap={4}>
        <Title level={3} style={{ margin: 0 }}>
          {t('admin.modelBillingMatrix.title', '模型与计费矩阵')}
        </Title>
        <Text type="secondary">{t('admin.modelBillingMatrix.subtitle', MATRIX_SUBTITLE)}</Text>
      </Flexbox>

      <Alert showIcon message={t('admin.modelBillingMatrix.notice', MATRIX_NOTICE)} type="info" />

      <Card title={t('admin.modelBillingMatrix.configHealthSection', 'AI service health check')}>
        <Flexbox gap={12}>
          <Alert
            showIcon
            message={t(
              'admin.modelBillingMatrix.configHealthTitle',
              'Provider, model access, and billing configuration',
            )}
            type={configHealthMeta.alertType as 'error' | 'success' | 'warning'}
            description={
              <Flexbox gap={10}>
                <Space wrap size={[8, 8]}>
                  <Tag color={configHealthMeta.color}>{configHealthMeta.label}</Tag>
                  <Tag>
                    {t('admin.modelBillingMatrix.healthModels', 'Models')}:{' '}
                    {configHealth.summary.modelCount}
                  </Tag>
                  <Tag>
                    {t('admin.modelBillingMatrix.healthPlans', 'Plans')}:{' '}
                    {configHealth.summary.planCount}
                  </Tag>
                  <Tag>
                    {t('admin.modelBillingMatrix.healthDefaults', 'Defaults')}:{' '}
                    {configHealth.summary.defaultModelOkCount}/
                    {configHealth.summary.defaultModelTotal}
                  </Tag>
                  <Tag>
                    {t('admin.modelBillingMatrix.healthPricingOverrides', 'Pricing overrides')}:{' '}
                    {configHealth.summary.pricingOverrideCount}
                  </Tag>
                  <Tag>
                    {t('admin.modelBillingMatrix.healthPricingFallbacks', 'Provider pricing')}:{' '}
                    {configHealth.summary.pricingFallbackModelCount}
                  </Tag>
                </Space>

                <Flexbox gap={6}>
                  {configHealth.checks.map((check) => {
                    const meta = CONFIG_HEALTH_CHECK_STATUS[check.severity];

                    return (
                      <Space wrap align="start" key={check.key} size={6}>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <Text>{check.title}</Text>
                        {typeof check.count === 'number' ? <Tag>{check.count}</Tag> : null}
                        {check.detail ? <Text type="secondary">{check.detail}</Text> : null}
                        {canFocusConfigHealthCheck(check) ? (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => handleFocusConfigHealthCheck(check)}
                          >
                            {focusedHealthCheckKey === check.key ? '取消定位' : '定位'}
                          </Button>
                        ) : null}
                      </Space>
                    );
                  })}
                </Flexbox>
              </Flexbox>
            }
          />
        </Flexbox>
      </Card>

      <Card title={t('admin.modelBillingMatrix.billingBasisSection', '全局计费基线')}>
        <Flexbox gap={16}>
          <Text type="secondary">
            {t(
              'admin.modelBillingMatrix.billingBasisDescription',
              '这里维护订单入口和全局积分倍率；单模型倍率、每美元积分和套餐开放范围继续在下方矩阵维护。',
            )}
          </Text>

          <Space wrap align="start" size={24}>
            <Flexbox gap={8} style={{ minWidth: 220 }}>
              <Text strong>{t('admin.modelBillingMatrix.globalMultiplier', '全局积分倍率')}</Text>
              <InputNumber
                max={100}
                min={0.0001}
                precision={4}
                step={0.1}
                style={{ width: 180 }}
                value={billingBasis.pricingMultiplier}
                onChange={(next: number | null) =>
                  updateBillingBasis({
                    pricingMultiplier: toFiniteNumber(next) ?? DEFAULT_PRICING_CREDIT_MULTIPLIER,
                  })
                }
              />
              <Text type="secondary">
                {t(
                  'admin.modelBillingMatrix.globalMultiplierHelp',
                  '用于生成计费的默认倍率，单模型倍率会覆盖该值。',
                )}
              </Text>
            </Flexbox>

            <Flexbox gap={8} style={{ minWidth: 220 }}>
              <Text strong>{t('admin.modelBillingMatrix.ordersEnabled', '订单管理')}</Text>
              <Switch
                checked={billingBasis.ordersEnabled}
                checkedChildren={t('admin.modelBillingMatrix.enabled', '启用')}
                unCheckedChildren={t('admin.modelBillingMatrix.disabled', '停用')}
                onChange={(checked) => updateBillingBasis({ ordersEnabled: checked })}
              />
              <Text type="secondary">
                {t(
                  'admin.modelBillingMatrix.ordersEnabledHelp',
                  '控制前台订单与充值相关能力是否开放。',
                )}
              </Text>
            </Flexbox>
          </Space>

          <Space wrap>
            <Button loading={savingBillingBasis} type="primary" onClick={handleSaveBillingBasis}>
              {t('admin.modelBillingMatrix.saveBillingBasis', '保存全局计费设置')}
            </Button>
            {billingBasisOverride && (
              <Button disabled={savingBillingBasis} onClick={() => setBillingBasisOverride(null)}>
                {MATRIX_DISCARD_LABEL}
              </Button>
            )}
          </Space>
        </Flexbox>
      </Card>

      <Alert
        showIcon
        message="默认模型健康检查"
        type={hasDefaultModelRisk ? 'warning' : 'success'}
        description={
          <Flexbox gap={8}>
            {Object.values(defaultModelHealth).map((health) => {
              const meta = DEFAULT_HEALTH_STATUS[health.status];

              return (
                <Space wrap align="start" key={health.modelType} size={6}>
                  <Tag color="blue">{getAdminModelTypeLabel(health.modelType)}</Tag>
                  <Text>
                    {health.model
                      ? `${health.provider}/${health.model}`
                      : `${health.provider}/未配置`}
                  </Text>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  <Text type="secondary">{getDefaultModelHealthMessage(health)}</Text>
                </Space>
              );
            })}
          </Flexbox>
        }
      />

      <Space wrap>
        <Button loading={saving} type="primary" onClick={handleSaveAccess}>
          {MATRIX_ACCESS_SAVE_LABEL}
        </Button>
        <Button loading={saving} onClick={handleSavePricing}>
          {MATRIX_PRICING_SAVE_LABEL}
        </Button>
        {rowsOverride && (
          <Button onClick={() => setRowsOverride(null)}>{MATRIX_DISCARD_LABEL}</Button>
        )}
      </Space>

      {focusedHealthCheck ? (
        <Alert
          showIcon
          action={
            <Button size="small" onClick={() => setFocusedHealthCheckKey(null)}>
              显示全部
            </Button>
          }
          message={`已定位：${focusedHealthCheck.title}`}
          type="warning"
          description={`当前显示 ${displayRows.length}/${rows.length} 个相关模型。`}
        />
      ) : null}

      <Table
        columns={columns}
        dataSource={displayRows}
        loading={loading}
        locale={{ emptyText: <Empty description="暂无已启用的服务商模型" /> }}
        pagination={false}
        rowKey="key"
        scroll={{ x: 900 + plans.length * 104 }}
      />
    </Flexbox>
  );
});

AdminModelBillingMatrixPage.displayName = 'AdminModelBillingMatrixPage';

export default AdminModelBillingMatrixPage;
