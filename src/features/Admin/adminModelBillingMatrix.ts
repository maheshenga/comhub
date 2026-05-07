export type MatrixModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

export type MatrixPlan = {
  displayName: string;
  plan: string;
};

export type MatrixSourceModel = {
  displayName: string | null;
  instanceId: string;
  instanceName: string;
  modelId: string;
  modelType: MatrixModelType;
  priority: number;
};

export type MatrixPricingRule = {
  creditsPerDollar?: number;
  model?: string;
  multiplier?: number;
  provider?: string;
};

export type MatrixPlanRule = {
  allowlist?: string[];
  blocklist?: string[];
  mode: 'allowlist' | 'blocklist';
};

export type MatrixPlanRules = Partial<Record<MatrixModelType, MatrixPlanRule>>;

export type MatrixRow = {
  creditsPerDollar?: number;
  displayName: string;
  instanceNames: string[];
  isDefault: boolean;
  key: string;
  modelId: string;
  modelType: MatrixModelType;
  planAccess: Record<string, boolean>;
  pricingMultiplier?: number;
  provider: string;
};

const escapeRegExp = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardMatch = (pattern: string, value: string) => {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;

  const regexp = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`, 'i');
  return regexp.test(value);
};

const matchesList = (list: string[] | undefined, modelId: string) =>
  (list ?? []).some((item) => wildcardMatch(item.trim().toLowerCase(), modelId.toLowerCase()));

const isAllowedByRule = (rule: MatrixPlanRule | undefined, modelId: string) => {
  if (!rule) return true;
  if (rule.mode === 'allowlist') return matchesList(rule.allowlist, modelId);

  return !matchesList(rule.blocklist, modelId);
};

const findPricingRule = ({
  modelId,
  pricingRules,
  provider,
}: {
  modelId: string;
  pricingRules: MatrixPricingRule[];
  provider: string;
}) =>
  pricingRules
    .filter((rule) => {
      const ruleProvider = rule.provider?.trim().toLowerCase();
      const ruleModel = rule.model?.trim().toLowerCase();
      const providerMatched = !ruleProvider || ruleProvider === '*' || ruleProvider === provider;
      const modelMatched = !ruleModel || ruleModel === '*' || ruleModel === modelId.toLowerCase();

      return providerMatched && modelMatched;
    })
    .sort((a, b) => {
      const score = (rule: MatrixPricingRule) =>
        (rule.provider && rule.provider !== '*' ? 2 : 0) +
        (rule.model && rule.model !== '*' ? 2 : 0) +
        (Number.isFinite(rule.creditsPerDollar) ? 1 : 0);

      return score(b) - score(a);
    })[0];

export const buildMatrixRows = ({
  defaultModel,
  defaultProvider = 'newapi',
  models,
  plans,
  pricingRules,
  planRulesByPlan,
}: {
  defaultModel?: string | null;
  defaultProvider?: string | null;
  models: MatrixSourceModel[];
  plans: MatrixPlan[];
  pricingRules: MatrixPricingRule[];
  planRulesByPlan: Record<string, MatrixPlanRules | null | undefined>;
}): MatrixRow[] => {
  const grouped = new Map<string, MatrixSourceModel[]>();

  for (const model of models) {
    const key = `newapi:${model.modelType}:${model.modelId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), model]);
  }

  return Array.from(grouped.entries())
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.priority - b.priority);
      const first = sorted[0];
      const provider = 'newapi';
      const pricingRule = findPricingRule({
        modelId: first.modelId,
        pricingRules,
        provider,
      });

      return {
        creditsPerDollar: pricingRule?.creditsPerDollar,
        displayName: first.displayName || first.modelId,
        instanceNames: sorted.map((item) => item.instanceName),
        isDefault:
          (defaultProvider || provider).toLowerCase() === provider &&
          defaultModel === first.modelId,
        key,
        modelId: first.modelId,
        modelType: first.modelType,
        planAccess: Object.fromEntries(
          plans.map((plan) => [
            plan.plan,
            isAllowedByRule(planRulesByPlan[plan.plan]?.[first.modelType], first.modelId),
          ]),
        ),
        pricingMultiplier: pricingRule?.multiplier,
        provider,
      };
    })
    .sort((a, b) => a.modelType.localeCompare(b.modelType) || a.modelId.localeCompare(b.modelId));
};

export const togglePlanAccess = (
  rows: MatrixRow[],
  rowKey: string,
  plan: string,
  allowed: boolean,
): MatrixRow[] =>
  rows.map((row) =>
    row.key === rowKey ? { ...row, planAccess: { ...row.planAccess, [plan]: allowed } } : row,
  );

export const buildPlanModelRulesFromRows = (rows: MatrixRow[], plans: MatrixPlan[]) => {
  const result: Record<string, MatrixPlanRules | undefined> = {};

  for (const plan of plans) {
    const rules: MatrixPlanRules = {};
    const rowsByType = new Map<MatrixModelType, MatrixRow[]>();

    for (const row of rows) {
      rowsByType.set(row.modelType, [...(rowsByType.get(row.modelType) ?? []), row]);
    }

    for (const [modelType, typedRows] of rowsByType.entries()) {
      const hasDeniedRow = typedRows.some((row) => row.planAccess[plan.plan] === false);
      if (!hasDeniedRow) continue;

      rules[modelType] = {
        allowlist: typedRows
          .filter((row) => row.planAccess[plan.plan] !== false)
          .map((row) => row.modelId),
        mode: 'allowlist',
      };
    }

    result[plan.plan] = Object.keys(rules).length > 0 ? rules : undefined;
  }

  return result;
};

export const buildPricingRulesFromRows = (rows: MatrixRow[]): MatrixPricingRule[] =>
  rows.flatMap((row) => {
    const hasMultiplier = Number.isFinite(row.pricingMultiplier);
    const hasCreditsPerDollar = Number.isFinite(row.creditsPerDollar);
    if (!hasMultiplier && !hasCreditsPerDollar) return [];

    return [
      {
        ...(hasCreditsPerDollar ? { creditsPerDollar: row.creditsPerDollar } : {}),
        model: row.modelId,
        ...(hasMultiplier ? { multiplier: row.pricingMultiplier } : {}),
        provider: row.provider,
      },
    ];
  });
