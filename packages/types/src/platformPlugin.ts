import { isIP } from 'node:net';

import { z } from 'zod';

function parseIpv4Octets(hostname: string) {
  const octets = hostname.split('.').map((value) => Number(value));

  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }

  return octets;
}

function isPrivateOrReservedIpv4(hostname: string) {
  const octets = parseIpv4Octets(hostname);

  if (!octets) {
    return false;
  }

  const [a, b] = octets;

  if (a === 0 || a === 10 || a === 127) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a >= 224) {
    return true;
  }

  return false;
}

function parseIpv6Address(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  const ipv4TailMatch = normalizedHostname.match(/(\d+\.\d+\.\d+\.\d+)$/);
  let expandedHostname = normalizedHostname;

  if (ipv4TailMatch) {
    const octets = parseIpv4Octets(ipv4TailMatch[1]);

    if (!octets) {
      return null;
    }

    const [a, b, c, d] = octets;
    const hextet1 = ((a << 8) | b).toString(16);
    const hextet2 = ((c << 8) | d).toString(16);
    expandedHostname = `${normalizedHostname.slice(0, ipv4TailMatch.index)}${hextet1}:${hextet2}`;
  }

  const parts = expandedHostname.split('::');

  if (parts.length > 2) {
    return null;
  }

  const leftParts = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const rightParts = parts[1] ? parts[1].split(':').filter(Boolean) : [];
  const hextetCount = leftParts.length + rightParts.length;

  if (parts.length === 1) {
    if (hextetCount !== 8) {
      return null;
    }
  } else if (hextetCount >= 8) {
    return null;
  }

  const hextets = [
    ...leftParts,
    ...Array.from({ length: 8 - hextetCount }, () => '0'),
    ...rightParts,
  ];

  if (hextets.length !== 8) {
    return null;
  }

  let value = 0n;

  for (const hextet of hextets) {
    if (!/^[0-9a-f]{1,4}$/.test(hextet)) {
      return null;
    }

    value = (value << 16n) + BigInt(Number.parseInt(hextet, 16));
  }

  return value;
}

function isPrivateOrReservedIpv6(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  const strippedHostname =
    normalizedHostname.startsWith('[') && normalizedHostname.endsWith(']')
      ? normalizedHostname.slice(1, -1)
      : normalizedHostname;

  if (strippedHostname === '::' || strippedHostname === '::1') {
    return true;
  }

  const mappedIpv4 = strippedHostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mappedIpv4) {
    return isPrivateOrReservedIpv4(mappedIpv4[1]);
  }

  const value = parseIpv6Address(strippedHostname);

  if (value === null) {
    return false;
  }

  const ranges = [
    [0n, 0n],
    [0x0000_0000_0000_0000_0000_0000_0000_0001n, 0x0000_0000_0000_0000_0000_0000_0000_0001n],
    [0xfc00_0000_0000_0000_0000_0000_0000_0000n, 0xfdff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn],
    [0xfe80_0000_0000_0000_0000_0000_0000_0000n, 0xfebf_ffff_ffff_ffff_ffff_ffff_ffff_ffffn],
    [0xff00_0000_0000_0000_0000_0000_0000_0000n, 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn],
  ] as const;

  return ranges.some(([start, end]) => value >= start && value <= end);
}

function isSafePlatformPluginApiUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const normalizedHostname =
      hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false;
    }

    if (normalizedHostname === '0.0.0.0') {
      return false;
    }

    if (isIP(normalizedHostname) === 4) {
      return !isPrivateOrReservedIpv4(normalizedHostname);
    }

    if (isIP(normalizedHostname) === 6) {
      return !isPrivateOrReservedIpv6(normalizedHostname);
    }

    return true;
  } catch {
    return false;
  }
}

const platformPluginApiUrlSchema = z.string().url().refine(isSafePlatformPluginApiUrl, {
  message: 'API URL must use a public http(s) host',
});

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
      url: platformPluginApiUrlSchema.optional(),
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
