import { ADMIN_BASE_PATH } from './adminNavigation';

export type AdminPlanModelRule = {
  allowlist?: string[];
  blocklist?: string[];
  mode: 'allowlist' | 'blocklist';
};

export type AdminPlanModelRules = Partial<Record<string, AdminPlanModelRule>>;

export const ADMIN_PLAN_MODEL_MATRIX_PATH = `${ADMIN_BASE_PATH}/model-billing-matrix`;

export const getPlanModelRulesSummary = (rules?: AdminPlanModelRules | null) => {
  const configuredTypes = Object.values(rules ?? {}).filter(Boolean).length;

  return configuredTypes > 0 ? `已配置 ${configuredTypes} 类模型权限` : '未限制模型权限';
};
