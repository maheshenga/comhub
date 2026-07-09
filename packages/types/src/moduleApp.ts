import { z } from 'zod';

const optionalTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;

    const text = value.trim();
    return text ? text : undefined;
  }, z.string().max(max).optional());

const stripUndefinedValues = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

export const moduleAppStatusSchema = z.enum(['draft', 'published', 'unpublished']);
export type ModuleAppStatus = z.infer<typeof moduleAppStatusSchema>;

export const moduleAppSourceSchema = z.enum(['system', 'admin', 'user', 'developer']);
export type ModuleAppSource = z.infer<typeof moduleAppSourceSchema>;

export const moduleAppTypeSchema = z.enum([
  'standard_app',
  'api_app',
  'ai_app',
  'workflow_app',
  'hybrid_app',
]);
export type ModuleAppType = z.infer<typeof moduleAppTypeSchema>;

export const moduleAppRuntimeTypeSchema = z.enum([
  'none',
  'record_create',
  'record_update',
  'record_archive',
  'api_action',
  'server_action',
  'content_generation',
  'workflow_step',
]);
export type ModuleAppRuntimeType = z.infer<typeof moduleAppRuntimeTypeSchema>;

export const moduleAppScopeTypeSchema = z.enum(['personal', 'workspace']);
export type ModuleAppScopeType = z.infer<typeof moduleAppScopeTypeSchema>;

export const moduleAppPageTypeSchema = z.enum([
  'overview',
  'form',
  'list',
  'detail',
  'result',
  'artifact',
  'custom',
]);
export type ModuleAppPageType = z.infer<typeof moduleAppPageTypeSchema>;

export const moduleAppInputFieldSchema = z.object({
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  helpText: z.string().max(500).optional(),
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  label: z.string().min(1).max(80),
  required: z.boolean().default(false),
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'select', 'date']),
  validationPattern: z.string().max(300).optional(),
});

export const moduleAppInputSchema = z.object({
  fields: z.array(moduleAppInputFieldSchema).max(80).default([]),
});
export type ModuleAppInputSchema = z.infer<typeof moduleAppInputSchema>;

export const moduleAppPageSchema = z.object({
  actionBindings: z.array(z.object({ actionKey: z.string(), event: z.string() })).default([]),
  dataSource: z.record(z.string(), z.unknown()).default({}),
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  layoutSchema: z.record(z.string(), z.unknown()).default({}),
  routePath: z.string().min(1).max(160),
  sortOrder: z.coerce.number().int().default(0),
  title: z.string().min(1).max(120),
  type: moduleAppPageTypeSchema,
});
export type ModuleAppPage = z.infer<typeof moduleAppPageSchema>;

export const moduleAppFailureFixedFeePolicySchema = z.enum(['do_not_charge']);
export const moduleAppChargeModeSchema = z.enum(['free', 'fixed', 'ai_usage', 'external_api', 'hybrid']);

export const moduleAppBillingConfigSchema = z
  .object({
    chargeMode: moduleAppChargeModeSchema.default('free'),
    defaultMultiplier: z.coerce.number().finite().min(0).default(1),
    externalApiCostCredits: z.coerce.number().finite().min(0).default(0),
    failureFixedFeePolicy: moduleAppFailureFixedFeePolicySchema.default('do_not_charge'),
    fixedServiceFeeCredits: z.coerce.number().finite().min(0).default(0),
  })
  .default({});
export type ModuleAppBillingConfig = z.infer<typeof moduleAppBillingConfigSchema>;

export const moduleAppActionConfigSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  inputSchema: moduleAppInputSchema.default({ fields: [] }),
  moduleMultiplier: z.coerce.number().finite().min(0).default(1),
  name: z.string().min(1).max(120),
  outputSchema: z.record(z.string(), z.unknown()).default({}),
  runtimeConfig: z.record(z.string(), z.unknown()).default({}),
  runtimeType: moduleAppRuntimeTypeSchema,
});
export type ModuleAppActionConfig = z.infer<typeof moduleAppActionConfigSchema>;

export const moduleAppPlanEntitlementSchema = z.object({
  discountPercent: z.coerce.number().finite().min(0).max(100).default(0),
  freeQuotaCredits: z.coerce.number().finite().min(0).default(0),
  installable: z.boolean().default(false),
  plan: z.string().min(1).max(80),
  runnable: z.boolean().default(false),
  visible: z.boolean().default(false),
});
export type ModuleAppPlanEntitlement = z.infer<typeof moduleAppPlanEntitlementSchema>;

export const moduleAppAdminUpsertSchema = z.object({
  actions: z.array(moduleAppActionConfigSchema).max(80).default([]),
  appType: moduleAppTypeSchema,
  billing: moduleAppBillingConfigSchema,
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(4000),
  displayName: z.string().min(1).max(120),
  icon: z.string().min(1).max(240),
  id: z.string().uuid().optional(),
  pages: z.array(moduleAppPageSchema).max(80).default([]),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  source: moduleAppSourceSchema.default('admin'),
  status: moduleAppStatusSchema.default('draft'),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});
export type ModuleAppAdminUpsertInput = z.infer<typeof moduleAppAdminUpsertSchema>;

export const moduleAppMarketplaceListInputSchema = z
  .object({
    appType: moduleAppTypeSchema.optional(),
    category: optionalTrimmedString(80),
    query: optionalTrimmedString(120),
  })
  .optional()
  .default({})
  .transform((value) => stripUndefinedValues(value));
export type ModuleAppMarketplaceListInput = z.infer<typeof moduleAppMarketplaceListInputSchema>;

export const moduleAppRecordInputSchema = z.object({
  appId: z.string().uuid(),
  collectionKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  data: z.record(z.string(), z.unknown()).default({}),
  recordId: z.string().uuid().optional(),
  scopeType: moduleAppScopeTypeSchema,
  title: z.string().max(240).optional(),
  workspaceId: z.string().optional(),
});
export type ModuleAppRecordInput = z.infer<typeof moduleAppRecordInputSchema>;

export const moduleAppRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'denied']);
export type ModuleAppRunStatus = z.infer<typeof moduleAppRunStatusSchema>;

export const moduleAppRunInputSchema = z.object({
  actionId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  appId: z.string().uuid(),
  input: z.record(z.string(), z.unknown()).default({}),
  recordId: z.string().uuid().optional(),
  scopeType: moduleAppScopeTypeSchema,
  workspaceId: z.string().optional(),
});
export type ModuleAppRunInput = z.infer<typeof moduleAppRunInputSchema>;

export const moduleAppPackageReviewStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
]);
export type ModuleAppPackageReviewStatus = z.infer<
  typeof moduleAppPackageReviewStatusSchema
>;

export const moduleAppPackageRuntimeKindSchema = z.enum([
  'manifest_only',
  'frontend_static',
  'external_api',
]);
export type ModuleAppPackageRuntimeKind = z.infer<
  typeof moduleAppPackageRuntimeKindSchema
>;

export const moduleAppPackageRuntimeSchema = z.object({
  entry: optionalTrimmedString(240),
  kind: moduleAppPackageRuntimeKindSchema.default('manifest_only'),
  permissions: z
    .array(z.string().regex(/^[a-z][a-z0-9_.:-]{1,79}$/))
    .max(80)
    .default([]),
});
export type ModuleAppPackageRuntime = z.infer<typeof moduleAppPackageRuntimeSchema>;

export const moduleAppPackageArchiveMetadataSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(240)
    .refine((value) => value.toLowerCase().endsWith('.zip'), {
      message: 'module_app_package_archive_must_be_zip',
    }),
  mimeType: z
    .enum(['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])
    .default('application/zip'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sizeBytes: z.coerce.number().int().min(1),
  storageKey: z.string().min(1).max(600),
});
export type ModuleAppPackageArchiveMetadata = z.infer<
  typeof moduleAppPackageArchiveMetadataSchema
>;

export const moduleAppPackageFileManifestItemSchema = z.object({
  path: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  sizeBytes: z.coerce.number().int().min(0),
});
export type ModuleAppPackageFileManifestItem = z.infer<
  typeof moduleAppPackageFileManifestItemSchema
>;

export const moduleAppPackageValidationIssueSchema = z.object({
  code: z.string().min(1).max(120),
  message: z.string().min(1).max(500),
  path: z.string().max(500).optional(),
  severity: z.enum(['error', 'warning']),
});
export type ModuleAppPackageValidationIssue = z.infer<
  typeof moduleAppPackageValidationIssueSchema
>;

export const moduleAppPackageManifestSchema = z.object({
  app: moduleAppAdminUpsertSchema.omit({ id: true }).extend({
    status: moduleAppStatusSchema.default('draft'),
  }),
  entitlements: z.array(moduleAppPlanEntitlementSchema).max(100).default([]),
  manifestVersion: z.literal(1),
  packageVersion: z.string().min(1).max(80),
  runtime: moduleAppPackageRuntimeSchema.default({ kind: 'manifest_only' }),
});
export type ModuleAppPackageManifest = z.infer<typeof moduleAppPackageManifestSchema>;

export const moduleAppPackageSubmitSchema = z.object({
  archive: moduleAppPackageArchiveMetadataSchema,
  fileManifest: z.array(moduleAppPackageFileManifestItemSchema).max(1000).default([]),
  manifest: moduleAppPackageManifestSchema,
});
export type ModuleAppPackageSubmitInput = z.infer<typeof moduleAppPackageSubmitSchema>;
