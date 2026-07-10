import { z } from 'zod';

const moduleAppPackagePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.startsWith('\\') &&
      !/^[a-z]:[\\/]/i.test(value) &&
      !value.includes('\\') &&
      !value.split('/').some((segment) => !segment || segment === '..'),
    'module_app_package_path_invalid',
  );

export const moduleAppRuntimeLanguageSchema = z.enum(['node22', 'python312']);
export type ModuleAppRuntimeLanguage = z.infer<typeof moduleAppRuntimeLanguageSchema>;

export const moduleAppBuildProfileSchema = z.enum(['node22-static', 'python312-assets']);
export type ModuleAppBuildProfile = z.infer<typeof moduleAppBuildProfileSchema>;

export const moduleAppBuildStatusSchema = z.enum([
  'queued',
  'building',
  'ready',
  'failed',
]);
export type ModuleAppBuildStatus = z.infer<typeof moduleAppBuildStatusSchema>;

export const moduleAppBuildConfigSchema = z
  .object({
    frontend: z
      .object({
        output: moduleAppPackagePathSchema,
        profile: moduleAppBuildProfileSchema,
      })
      .strict(),
  })
  .strict();
export type ModuleAppBuildConfig = z.infer<typeof moduleAppBuildConfigSchema>;

export const moduleAppRuntimeFunctionSchema = z
  .object({
    entry: moduleAppPackagePathSchema,
    key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    runtime: moduleAppRuntimeLanguageSchema,
  })
  .strict();

export const moduleAppExecutableRuntimeSchema = z
  .object({
    functions: z.array(moduleAppRuntimeFunctionSchema).max(80).default([]),
    kind: z.literal('sandboxed_app').default('sandboxed_app'),
    outboundHosts: z.array(z.string().min(1).max(253)).max(80).default([]),
    permissions: z
      .array(z.string().regex(/^[a-z][a-z0-9_.:-]{1,79}$/))
      .max(80)
      .default([]),
  })
  .strict();
export type ModuleAppExecutableRuntime = z.infer<typeof moduleAppExecutableRuntimeSchema>;

export const moduleAppCapabilityClaimsSchema = z
  .object({
    appId: z.string().uuid(),
    aud: z.literal('module-runtime'),
    exp: z.number().int().positive(),
    iat: z.number().int().positive(),
    installationId: z.string().uuid(),
    nonce: z.string().min(16).max(128),
    permissions: z.array(z.string()).max(80),
    userId: z.string().min(1),
    versionId: z.string().uuid(),
    workspaceId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((claims, ctx) => {
    if (claims.exp <= claims.iat || claims.exp - claims.iat > 300) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'module_app_capability_ttl_invalid' });
    }
  });
export type ModuleAppCapabilityClaims = z.infer<typeof moduleAppCapabilityClaimsSchema>;

export const moduleAppLaunchContextSchema = z
  .object({
    capability: z.string().min(1),
    expiresAt: z.string().datetime(),
    iframeUrl: z.string().url(),
    installationId: z.string().uuid(),
    nonce: z.string().min(16).max(128),
    runtimeOrigin: z.string().url(),
  })
  .strict();
export type ModuleAppLaunchContext = z.infer<typeof moduleAppLaunchContextSchema>;

export const moduleAppInvocationSchema = z
  .object({
    artifactSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    capability: z.string().min(1),
    entry: moduleAppPackagePathSchema,
    input: z.unknown(),
    invocationId: z.string().uuid(),
    runtime: moduleAppRuntimeLanguageSchema,
    timeoutMs: z.number().int().min(100).max(60_000),
  })
  .strict();
export type ModuleAppInvocation = z.infer<typeof moduleAppInvocationSchema>;
