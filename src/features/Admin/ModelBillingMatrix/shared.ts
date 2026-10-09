import type {
  MatrixConfigHealthCheck,
  MatrixModelType,
  MatrixPlanRules,
  MatrixPricingSource,
  MatrixProviderPricingSource,
} from '@/features/Admin/adminModelBillingMatrix';
import { getAdminModelTypeLabel } from '@/features/Admin/adminModelTypeLabels';

export const MATRIX_KEY = ['admin-model-billing-matrix'];
export const PLANS_KEY = ['admin-plans'];

export const DEFAULT_HEALTH_STATUS = {
  denied_by_free_plan: { color: 'orange', label: '免费套餐未开放' },
  not_configured: { color: 'default', label: '未配置' },
  not_enabled: { color: 'red', label: '未启用' },
  ok: { color: 'green', label: '正常' },
  type_mismatch: { color: 'red', label: '类型不匹配' },
} as const;

export const CONFIG_HEALTH_STATUS = {
  error: { alertType: 'error', color: 'red', label: 'Error' },
  ok: { alertType: 'success', color: 'green', label: 'OK' },
  warning: { alertType: 'warning', color: 'orange', label: 'Warning' },
} as const;

export const CONFIG_HEALTH_CHECK_STATUS = {
  error: { color: 'red', label: 'Error' },
  info: { color: 'blue', label: 'Info' },
  ok: { color: 'green', label: 'OK' },
  warning: { color: 'orange', label: 'Warning' },
} as const;

export const PRICING_SOURCE_STATUS: Record<MatrixPricingSource, { color: string; label: string }> = {
  'database': { color: 'green', label: 'DB pricing' },
  'lobehub-official': { color: 'cyan', label: 'LobeHub Official' },
  'manual-override': { color: 'gold', label: 'Manual pricing' },
  'missing': { color: 'red', label: 'Missing pricing' },
  'model-bank': { color: 'blue', label: 'Model Bank' },
};

export type PlanItem = {
  displayName?: string | null;
  modelRules?: MatrixPlanRules | null;
  plan: string;
};

export type EnabledModelItem = {
  displayName?: string | null;
  groupKey?: string | null;
  groupName?: string | null;
  hasModelAbilities?: boolean | null;
  hasModelPricing?: boolean | null;
  instanceId: string;
  instanceName: string;
  modelId: string;
  modelType: MatrixModelType;
  pricingSource?: MatrixProviderPricingSource | null;
  priority: number;
  providerType?: string | null;
};

export const FILTERABLE_CONFIG_HEALTH_CHECKS = new Set([
  'blocked-models',
  'default-models',
  'global-pricing-multiplier',
  'healthy',
  'missing-model-abilities',
  'missing-model-pricing',
  'plans-without-models',
  'pricing-fallbacks',
]);

export const toFiniteNumber = (value: number | string | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const getDefaultModelErrorMessage = (error: any) => {
  if (error?.message === 'DEFAULT_MODEL_NOT_ENABLED') {
    return '默认模型未在已启用模型目录中，请先在服务商实例中启用该模型。';
  }

  if (error?.message === 'DEFAULT_MODEL_DENIED_BY_FREE_PLAN') {
    return '默认模型未被免费套餐允许，新注册用户将无法使用该模型。请调整免费套餐模型权限。';
  }

  return '保存默认模型失败';
};

export const getDefaultModelHealthMessage = (
  health: { actualModelType?: string; modelType: string; model?: string | null; provider?: string | null; status: string },
) => {
  if (health.status === 'ok') return '已启用，且免费套餐可用，新注册用户可直接使用。';
  if (health.status === 'not_configured') return '后台还没有设置该类型的默认模型。';
  if (health.status === 'not_enabled')
    return '该模型不在已启用模型目录中，请先启用对应服务商模型。';
  if (health.status === 'type_mismatch') {
    return `模型存在，但类型是 ${getAdminModelTypeLabelText(health.actualModelType || health.modelType)}，请重新选择 ${getAdminModelTypeLabelText(health.modelType)} 模型。`;
  }

  return '该模型已启用，但免费套餐未开放，新注册用户默认不可用。';
};

const getAdminModelTypeLabelText = (type: string) => getAdminModelTypeLabel(type as any);

export type { MatrixConfigHealthCheck };
