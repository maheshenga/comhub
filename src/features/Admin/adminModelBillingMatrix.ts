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
  groupKey?: string | null;
  groupName?: string | null;
  instanceId: string;
  instanceName: string;
  modelId: string;
  modelType: MatrixModelType;
  priority: number;
  providerType?: string | null;
};

export type MatrixPricingRule = {
  creditsPerDollar?: number;
  group?: string;
  instanceId?: string;
  model?: string;
  multiplier?: number;
  provider?: string;
  providerType?: string;
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
  groupKey?: string | null;
  groupName?: string | null;
  instanceIds: string[];
  instanceNames: string[];
  isDefault: boolean;
  key: string;
  modelId: string;
  modelType: MatrixModelType;
  planAccess: Record<string, boolean>;
  pricingInstanceId?: string;
  pricingMultiplier?: number;
  provider: string;
  providerType?: string | null;
  providerTypes: string[];
};

export type MatrixDefaultModelConflict = {
  displayName: string;
  modelId: string;
  modelType: MatrixModelType;
  provider: string;
};

export type MatrixDefaultModelType = Extract<MatrixModelType, 'chat' | 'image' | 'video'>;

export type MatrixDefaultModelHealthStatus =
  | 'ok'
  | 'not_configured'
  | 'not_enabled'
  | 'type_mismatch'
  | 'denied_by_free_plan';

export type MatrixDefaultModelHealth = {
  actualModelType?: MatrixModelType;
  displayName?: string;
  model?: string | null;
  modelType: MatrixDefaultModelType;
  provider: string;
  status: MatrixDefaultModelHealthStatus;
};

export type MatrixDefaultModelHealthInput = Partial<
  Record<MatrixDefaultModelType, { model?: string | null; provider?: string | null }>
>;

const escapeRegExp = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardMatch = (pattern: string, value: string) => {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;

  const regexp = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`, 'i');
  return regexp.test(value);
};

const normalizeGroupKey = (groupKey?: string | null) => groupKey?.trim().toLowerCase();
const normalizeTextKey = (value?: string | null) => value?.trim().toLowerCase();

const matchesEntry = (entry: string, modelId: string, groupKey?: string | null) => {
  const normalized = entry.trim().toLowerCase();
  if (!normalized) return false;

  const separatorIndex = normalized.indexOf(':');
  if (separatorIndex > -1) {
    const groupPattern = normalized.slice(0, separatorIndex).trim();
    const modelPattern = normalized.slice(separatorIndex + 1).trim();
    if (!groupPattern || !modelPattern) return false;

    return (
      wildcardMatch(groupPattern, normalizeGroupKey(groupKey) || 'default') &&
      wildcardMatch(modelPattern, modelId.toLowerCase())
    );
  }

  return wildcardMatch(normalized, modelId.toLowerCase());
};

const matchesList = (list: string[] | undefined, modelId: string, groupKey?: string | null) =>
  (list ?? []).some((item) => matchesEntry(item, modelId, groupKey));

const isAllowedByRule = (
  rule: MatrixPlanRule | undefined,
  modelId: string,
  groupKey?: string | null,
) => {
  if (!rule) return true;
  if (rule.mode === 'allowlist') return matchesList(rule.allowlist, modelId, groupKey);

  return !matchesList(rule.blocklist, modelId, groupKey);
};

const findPricingRule = ({
  groupKey,
  instanceId,
  modelId,
  pricingRules,
  provider,
  providerType,
}: {
  groupKey?: string | null;
  instanceId?: string | null;
  modelId: string;
  pricingRules: MatrixPricingRule[];
  provider: string;
  providerType?: string | null;
}) =>
  pricingRules
    .filter((rule) => {
      const normalizedGroup = normalizeGroupKey(groupKey);
      const normalizedInstanceId = normalizeTextKey(instanceId);
      const ruleGroup = rule.group?.trim().toLowerCase();
      const ruleInstanceId = rule.instanceId?.trim().toLowerCase();
      const ruleProvider = rule.provider?.trim().toLowerCase();
      const normalizedProviderType = normalizeTextKey(providerType);
      const ruleProviderType = rule.providerType?.trim().toLowerCase();
      const ruleModel = rule.model?.trim().toLowerCase();
      const groupMatched = ruleGroup ? ruleGroup === normalizedGroup : true;
      const instanceMatched = ruleInstanceId ? ruleInstanceId === normalizedInstanceId : true;
      const providerMatched = !ruleProvider || ruleProvider === '*' || ruleProvider === provider;
      const providerTypeMatched = ruleProviderType
        ? ruleProviderType === normalizedProviderType
        : true;
      const modelMatched = !ruleModel || ruleModel === '*' || ruleModel === modelId.toLowerCase();

      return (
        groupMatched && instanceMatched && providerMatched && providerTypeMatched && modelMatched
      );
    })
    .sort((a, b) => {
      const score = (rule: MatrixPricingRule) =>
        (rule.instanceId ? 8 : 0) +
        (rule.group ? 4 : 0) +
        (rule.providerType ? 3 : 0) +
        (rule.provider && rule.provider !== '*' ? 2 : 0) +
        (rule.model && rule.model !== '*' ? 2 : 0) +
        (Number.isFinite(rule.creditsPerDollar) ? 1 : 0);

      return score(b) - score(a);
    })[0];

export const buildMatrixRows = ({
  defaultModel,
  defaultModelsByType,
  defaultProvider = 'newapi',
  models,
  plans,
  pricingRules,
  planRulesByPlan,
}: {
  defaultModel?: string | null;
  defaultModelsByType?: Partial<
    Record<MatrixModelType, { model?: string | null; provider?: string | null }>
  >;
  defaultProvider?: string | null;
  models: MatrixSourceModel[];
  plans: MatrixPlan[];
  pricingRules: MatrixPricingRule[];
  planRulesByPlan: Record<string, MatrixPlanRules | null | undefined>;
}): MatrixRow[] => {
  const grouped = new Map<string, MatrixSourceModel[]>();

  for (const model of models) {
    const groupKey = normalizeGroupKey(model.groupKey);
    const providerType = normalizeTextKey(model.providerType);
    const key = groupKey
      ? providerType && providerType !== 'newapi'
        ? `newapi:${providerType}:${groupKey}:${model.modelType}:${model.modelId}`
        : `newapi:${groupKey}:${model.modelType}:${model.modelId}`
      : providerType && providerType !== 'newapi'
        ? `newapi:${providerType}:${model.modelType}:${model.modelId}`
        : `newapi:${model.modelType}:${model.modelId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), model]);
  }

  return Array.from(grouped.entries())
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.priority - b.priority);
      const first = sorted[0];
      const provider = 'newapi';
      const groupKey = normalizeGroupKey(first.groupKey);
      const providerTypes = Array.from(
        new Set(sorted.map((item) => normalizeTextKey(item.providerType)).filter(Boolean)),
      ) as string[];
      const providerType = providerTypes.length === 1 ? providerTypes[0] : undefined;
      const instanceIds = sorted.map((item) => item.instanceId);
      const instanceId = instanceIds.length === 1 ? instanceIds[0] : undefined;
      const pricingRule = findPricingRule({
        groupKey,
        instanceId,
        modelId: first.modelId,
        pricingRules,
        provider,
        providerType,
      });

      return {
        creditsPerDollar: pricingRule?.creditsPerDollar,
        displayName: first.displayName || first.modelId,
        groupKey,
        groupName: first.groupName,
        instanceIds,
        instanceNames: sorted.map((item) => item.instanceName),
        isDefault:
          first.modelType === 'chat'
            ? (defaultProvider || provider).toLowerCase() === provider &&
              defaultModel === first.modelId
            : (defaultModelsByType?.[first.modelType]?.provider || provider).toLowerCase() ===
                provider && defaultModelsByType?.[first.modelType]?.model === first.modelId,
        key,
        modelId: first.modelId,
        modelType: first.modelType,
        planAccess: Object.fromEntries(
          plans.map((plan) => [
            plan.plan,
            isAllowedByRule(planRulesByPlan[plan.plan]?.[first.modelType], first.modelId, groupKey),
          ]),
        ),
        pricingMultiplier: pricingRule?.multiplier,
        pricingInstanceId: pricingRule?.instanceId ?? (providerType ? instanceId : undefined),
        provider,
        providerType,
        providerTypes,
      };
    })
    .sort((a, b) => a.modelType.localeCompare(b.modelType) || a.modelId.localeCompare(b.modelId));
};

const rowModelRuleEntry = (row: MatrixRow) =>
  row.groupKey ? `${row.groupKey}:${row.modelId}` : row.modelId;

export const togglePlanAccess = (
  rows: MatrixRow[],
  rowKey: string,
  plan: string,
  allowed: boolean,
): MatrixRow[] =>
  rows.map((row) =>
    row.key === rowKey ? { ...row, planAccess: { ...row.planAccess, [plan]: allowed } } : row,
  );

export const findFreePlanDefaultModelConflict = (
  rows: MatrixRow[],
): MatrixDefaultModelConflict | null => {
  const defaultRows = rows.filter(
    (item) =>
      item.isDefault &&
      ['chat', 'image', 'video'].includes(item.modelType) &&
      sameProvider(item.provider, 'newapi'),
  );
  const row = defaultRows.find((item) => {
    const matchingRows = defaultRows.filter(
      (candidate) =>
        candidate.modelType === item.modelType &&
        sameProvider(candidate.provider, item.provider) &&
        sameModel(candidate.modelId, item.modelId),
    );

    return (
      matchingRows.length > 0 &&
      matchingRows.every((candidate) => candidate.planAccess.free === false)
    );
  });

  return row
    ? {
        displayName: row.displayName,
        modelId: row.modelId,
        modelType: row.modelType,
        provider: row.provider,
      }
    : null;
};

const defaultModelTypes = ['chat', 'image', 'video'] as const satisfies MatrixDefaultModelType[];

const sameProvider = (left?: string | null, right?: string | null) =>
  (normalizeTextKey(left) || 'newapi') === (normalizeTextKey(right) || 'newapi');

const sameModel = (left?: string | null, right?: string | null) =>
  normalizeTextKey(left) === normalizeTextKey(right);

export const getDefaultModelHealth = (
  rows: MatrixRow[],
  defaults: MatrixDefaultModelHealthInput,
): Record<MatrixDefaultModelType, MatrixDefaultModelHealth> =>
  Object.fromEntries(
    defaultModelTypes.map((modelType) => {
      const config = defaults[modelType];
      const model = config?.model?.trim();
      const provider = normalizeTextKey(config?.provider) || 'newapi';

      if (!model) {
        return [
          modelType,
          {
            model,
            modelType,
            provider,
            status: 'not_configured',
          },
        ];
      }

      const matchingRows = rows.filter(
        (item) =>
          item.modelType === modelType &&
          sameProvider(item.provider, provider) &&
          sameModel(item.modelId, model),
      );
      const availableRow = matchingRows.find((item) => item.planAccess.free !== false);
      const row = availableRow ?? matchingRows[0];

      if (row) {
        return [
          modelType,
          {
            displayName: row.displayName,
            model: row.modelId,
            modelType,
            provider,
            status: availableRow ? 'ok' : 'denied_by_free_plan',
          },
        ];
      }

      const typeMismatchRow = rows.find(
        (item) => sameProvider(item.provider, provider) && sameModel(item.modelId, model),
      );

      if (typeMismatchRow) {
        return [
          modelType,
          {
            actualModelType: typeMismatchRow.modelType,
            displayName: typeMismatchRow.displayName,
            model,
            modelType,
            provider,
            status: 'type_mismatch',
          },
        ];
      }

      return [
        modelType,
        {
          model,
          modelType,
          provider,
          status: 'not_enabled',
        },
      ];
    }),
  ) as Record<MatrixDefaultModelType, MatrixDefaultModelHealth>;

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
          .map(rowModelRuleEntry),
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
        ...(row.groupKey ? { group: row.groupKey } : {}),
        ...(row.pricingInstanceId ? { instanceId: row.pricingInstanceId } : {}),
        model: row.modelId,
        ...(hasMultiplier ? { multiplier: row.pricingMultiplier } : {}),
        provider: row.provider,
        ...(row.providerType ? { providerType: row.providerType } : {}),
      },
    ];
  });
