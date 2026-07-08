import {
  type PlatformPluginAdminUpsertInput,
  platformPluginAdminUpsertSchema,
  type PlatformPluginRuntimeType,
  type PlatformPluginStatus,
} from '@lobechat/types';

type NumericInput = number | string | undefined;

export type PlatformPluginFormInput = {
  actionId?: string;
  actionName?: string;
  apiBodyTemplate?: string;
  apiHeaders?: string;
  apiMethod?: 'GET' | 'POST' | string;
  apiResponsePath?: string;
  apiTimeoutMs?: NumericInput;
  apiUrl?: string;
  artifactMimeType?: string;
  artifactNameTemplate?: string;
  category?: string;
  defaultMultiplier?: NumericInput;
  description?: string;
  displayName?: string;
  externalApiCostCredits?: NumericInput;
  featured?: boolean;
  fixedServiceFeeCredits?: NumericInput;
  icon?: string;
  id?: string;
  model?: string;
  moduleMultiplier?: NumericInput;
  planBenefitSummary?: string;
  promptTemplate?: string;
  promoLabel?: string;
  provider?: string;
  runtimeType?: PlatformPluginRuntimeType | string;
  slug?: string;
  sortWeight?: NumericInput;
  status?: PlatformPluginStatus | string;
  tags?: string[] | string;
  upgradeCta?: string;
  useCase?: string;
};

export type PlatformPluginFormValues = Required<
  Pick<
    PlatformPluginFormInput,
    | 'actionId'
    | 'actionName'
    | 'apiMethod'
    | 'artifactMimeType'
    | 'artifactNameTemplate'
    | 'category'
    | 'description'
    | 'displayName'
    | 'featured'
    | 'icon'
    | 'runtimeType'
    | 'slug'
    | 'sortWeight'
    | 'status'
  >
> &
  Omit<
    PlatformPluginFormInput,
    | 'actionId'
    | 'actionName'
    | 'apiMethod'
    | 'artifactMimeType'
    | 'artifactNameTemplate'
    | 'category'
    | 'description'
    | 'displayName'
    | 'icon'
    | 'runtimeType'
    | 'slug'
    | 'status'
    | 'tags'
  > & {
    apiTimeoutMs: number;
    defaultMultiplier: number;
    externalApiCostCredits: number;
    fixedServiceFeeCredits: number;
    moduleMultiplier: number;
    runtimeType: PlatformPluginRuntimeType;
    sortWeight: number;
    status: PlatformPluginStatus;
    tags: string[];
  };

const toText = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: NumericInput, fallback: number) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

  const text = toText(value);
  if (!text) return fallback;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRuntimeType = (value: PlatformPluginFormInput['runtimeType']): PlatformPluginRuntimeType =>
  value === 'content_generation' ? 'content_generation' : 'api_action';

const toStatus = (value: PlatformPluginFormInput['status']): PlatformPluginStatus => {
  if (value === 'published' || value === 'unpublished') return value;
  return 'draft';
};

const toTags = (value: PlatformPluginFormInput['tags']) => {
  const tags = Array.isArray(value) ? value : toText(value).split(',');
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
};

const toActionId = (value: string, fallbackSlug: string) => {
  const source = value || fallbackSlug || 'platform-plugin';
  const normalized = source
    .trim()
    .toLowerCase()
    .replaceAll('-', '_')
    .replaceAll(/[^a-z0-9_]/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

  if (/^[a-z][a-z0-9_]{1,63}$/.test(normalized)) return normalized;
  return `plugin_${normalized || 'action'}`.slice(0, 64);
};

const parseJsonRecord = (value: string | undefined) => {
  const text = toText(value);
  if (!text) return undefined;

  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;

  return parsed as Record<string, unknown>;
};

export const normalizePlatformPluginFormValues = (
  values: PlatformPluginFormInput,
): PlatformPluginFormValues => {
  const runtimeType = toRuntimeType(values.runtimeType);
  const slug = toText(values.slug);

  return {
    actionId: toActionId(toText(values.actionId), slug),
    actionName: toText(values.actionName) || toText(values.displayName),
    apiBodyTemplate: toText(values.apiBodyTemplate),
    apiHeaders: toText(values.apiHeaders),
    apiMethod: values.apiMethod === 'GET' ? 'GET' : 'POST',
    apiResponsePath: toText(values.apiResponsePath),
    apiTimeoutMs: Math.round(toNumber(values.apiTimeoutMs, 30_000)),
    apiUrl: toText(values.apiUrl),
    artifactMimeType: toText(values.artifactMimeType) || 'text/markdown',
    artifactNameTemplate: toText(values.artifactNameTemplate) || 'plugin-result.md',
    category: toText(values.category),
    defaultMultiplier: toNumber(values.defaultMultiplier, 1),
    description: toText(values.description),
    displayName: toText(values.displayName),
    externalApiCostCredits: toNumber(values.externalApiCostCredits, 0),
    featured: values.featured === true,
    fixedServiceFeeCredits: toNumber(values.fixedServiceFeeCredits, 0),
    icon: toText(values.icon) || 'Plug',
    id: toText(values.id) || undefined,
    model: toText(values.model),
    moduleMultiplier: toNumber(values.moduleMultiplier, 1),
    planBenefitSummary: toText(values.planBenefitSummary),
    promptTemplate: toText(values.promptTemplate),
    promoLabel: toText(values.promoLabel),
    provider: toText(values.provider),
    runtimeType,
    slug,
    sortWeight: Math.round(toNumber(values.sortWeight, 0)),
    status: toStatus(values.status),
    tags: toTags(values.tags),
    upgradeCta: toText(values.upgradeCta),
    useCase: toText(values.useCase),
  };
};

export const buildPlatformPluginUpsertInput = (
  values: PlatformPluginFormValues,
): PlatformPluginAdminUpsertInput => {
  const actionConfig = {
    id: values.actionId,
    inputSchema: { fields: [] },
    moduleMultiplier: values.moduleMultiplier,
    name: values.actionName || values.displayName,
    runtimeType: values.runtimeType,
    ...(values.runtimeType === 'content_generation'
      ? {
          contentGeneration: {
            artifactMimeType: values.artifactMimeType,
            artifactNameTemplate: values.artifactNameTemplate,
            model: values.model || undefined,
            promptTemplate: values.promptTemplate || undefined,
            provider: values.provider || undefined,
          },
        }
      : {
          api: {
            bodyTemplate: parseJsonRecord(values.apiBodyTemplate),
            headers: parseJsonRecord(values.apiHeaders) as Record<string, string> | undefined,
            method: values.apiMethod,
            responsePath: values.apiResponsePath || undefined,
            timeoutMs: values.apiTimeoutMs,
            url: values.apiUrl || undefined,
          },
        }),
  };

  return platformPluginAdminUpsertSchema.parse({
    actionConfig,
    billing: {
      defaultMultiplier: values.defaultMultiplier,
      externalApiCostCredits: values.externalApiCostCredits,
      fixedServiceFeeCredits: values.fixedServiceFeeCredits,
    },
    category: values.category,
    description: values.description,
    displayName: values.displayName,
    icon: values.icon,
    id: values.id,
    operations: {
      featured: values.featured,
      planBenefitSummary: values.planBenefitSummary || undefined,
      promoLabel: values.promoLabel || undefined,
      sortWeight: values.sortWeight,
      upgradeCta: values.upgradeCta || undefined,
      useCase: values.useCase || undefined,
    },
    runtimeType: values.runtimeType,
    slug: values.slug,
    status: values.status,
    tags: values.tags,
  });
};
