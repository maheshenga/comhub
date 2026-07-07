import { z } from 'zod';

export const platformPluginStatusSchema = z.enum(['draft', 'published', 'unpublished']);
export type PlatformPluginStatus = z.infer<typeof platformPluginStatusSchema>;

export const platformPluginRuntimeTypeSchema = z.enum(['api_action', 'content_generation']);
export type PlatformPluginRuntimeType = z.infer<typeof platformPluginRuntimeTypeSchema>;

export const platformPluginActionRuntimeTypeSchema = platformPluginRuntimeTypeSchema;
export type PlatformPluginActionRuntimeType = z.infer<typeof platformPluginActionRuntimeTypeSchema>;

export const platformPluginPermissionLevelSchema = z.enum(['visible', 'installable', 'runnable']);
export type PlatformPluginPermissionLevel = z.infer<typeof platformPluginPermissionLevelSchema>;

export const platformPluginRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'denied',
]);
export type PlatformPluginRunStatus = z.infer<typeof platformPluginRunStatusSchema>;

export const platformPluginFailureFixedFeePolicySchema = z.enum(['do_not_charge']);

export const platformPluginBillingConfigSchema = z
  .object({
    defaultMultiplier: z.coerce.number().finite().min(0).default(1),
    externalApiCostCredits: z.coerce.number().finite().min(0).default(0),
    failureFixedFeePolicy: platformPluginFailureFixedFeePolicySchema.default('do_not_charge'),
    fixedServiceFeeCredits: z.coerce.number().finite().min(0).default(0),
  })
  .default({});
export type PlatformPluginBillingConfig = z.infer<typeof platformPluginBillingConfigSchema>;

export const platformPluginInputFieldSchema = z.object({
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  helpText: z.string().max(500).optional(),
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  label: z.string().min(1).max(80),
  required: z.boolean().default(false),
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'select']),
  validationPattern: z.string().max(300).optional(),
});

export const platformPluginInputSchema = z.object({
  fields: z.array(platformPluginInputFieldSchema).max(40).default([]),
});
export type PlatformPluginInputSchema = z.infer<typeof platformPluginInputSchema>;

export const platformPluginActionConfigSchema = z.object({
  api: z
    .object({
      bodyTemplate: z.record(z.string(), z.unknown()).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      method: z.enum(['GET', 'POST']).default('POST'),
      responsePath: z.string().max(200).optional(),
      timeoutMs: z.coerce.number().int().min(1000).max(60_000).default(30_000),
      url: z.string().url().optional(),
    })
    .optional(),
  contentGeneration: z
    .object({
      artifactMimeType: z.string().max(120).default('text/markdown'),
      artifactNameTemplate: z.string().max(160).default('plugin-result.md'),
      model: z.string().max(160).optional(),
      promptTemplate: z.string().min(1).max(20_000).optional(),
      provider: z.string().max(160).optional(),
    })
    .optional(),
  id: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  inputSchema: platformPluginInputSchema.default({ fields: [] }),
  moduleMultiplier: z.coerce.number().finite().min(0).default(1),
  name: z.string().min(1).max(120),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  runtimeType: platformPluginActionRuntimeTypeSchema,
});
export type PlatformPluginActionConfig = z.infer<typeof platformPluginActionConfigSchema>;

export const platformPluginPlanEntitlementSchema = z.object({
  discountPercent: z.coerce.number().finite().min(0).max(100).default(0),
  freeQuotaCredits: z.coerce.number().finite().min(0).default(0),
  installable: z.boolean().default(false),
  plan: z.string().min(1).max(80),
  runnable: z.boolean().default(false),
  visible: z.boolean().default(false),
});
export type PlatformPluginPlanEntitlement = z.infer<typeof platformPluginPlanEntitlementSchema>;

export const platformPluginAdminUpsertSchema = z.object({
  actionConfig: platformPluginActionConfigSchema.optional(),
  billing: platformPluginBillingConfigSchema,
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  displayName: z.string().min(1).max(120),
  icon: z.string().min(1).max(120),
  id: z.string().uuid().optional(),
  runtimeType: platformPluginRuntimeTypeSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: platformPluginStatusSchema.default('draft'),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});
export type PlatformPluginAdminUpsertInput = z.infer<typeof platformPluginAdminUpsertSchema>;

export type PlatformPluginListItem = {
  billing: PlatformPluginBillingConfig;
  category: string;
  displayName: string;
  icon: string;
  id: string;
  installed: boolean;
  planState: {
    installable: boolean;
    runnable: boolean;
    visible: boolean;
  };
  runtimeType: PlatformPluginRuntimeType;
  slug: string;
  status: PlatformPluginStatus;
  tags: string[];
};

export type PlatformPluginDetail = PlatformPluginListItem & {
  actions: PlatformPluginActionConfig[];
  description: string;
  entitlements: PlatformPluginPlanEntitlement[];
  version: string;
};

export type PlatformPluginRunResult = {
  artifactIds: string[];
  billing: {
    chargedCredits: number;
    fixedServiceFeeCharged: boolean;
  };
  preview: string;
  runId: string;
  status: PlatformPluginRunStatus;
};
