import type {
  PlatformPluginBillingConfig,
  PlatformPluginPlanEntitlement,
  PlatformPluginRunStatus,
  PlatformPluginRuntimeType,
  PlatformPluginStatus,
} from '@lobechat/types';

export type AdminPlatformPluginItem = {
  author?: string;
  billing: PlatformPluginBillingConfig;
  category: string;
  createdAt?: Date | string;
  description: string;
  displayName: string;
  icon: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  runtimeType: PlatformPluginRuntimeType;
  slug: string;
  sortOrder?: number;
  status: PlatformPluginStatus;
  tags: string[];
  updatedAt?: Date | string;
};

export type AdminPlatformPluginAction = {
  actionKey: string;
  id: string;
  inputSchema?: Record<string, unknown> | null;
  moduleMultiplier: number;
  name: string;
  outputSchema?: Record<string, unknown> | null;
  runtimeConfig?: Record<string, unknown> | null;
  runtimeType: PlatformPluginRuntimeType;
};

export type AdminPlatformPluginSecret = {
  configured: boolean;
  createdAt?: Date | string;
  id?: string;
  key: string;
  lastUsedAt?: Date | string | null;
  maskedValue: string;
  scope: string;
  updatedAt?: Date | string;
};

export type AdminPlatformPluginDetail = AdminPlatformPluginItem & {
  actions: AdminPlatformPluginAction[];
  entitlements: Array<PlatformPluginPlanEntitlement & { id?: string; pluginId?: string }>;
  secrets: AdminPlatformPluginSecret[];
  version: null | string;
};

export type AdminPlatformPluginRun = {
  actionId?: null | string;
  agentId?: null | string;
  billingSnapshot?: Record<string, unknown> | null;
  createdAt?: Date | string;
  durationMs?: null | number;
  errorMessage?: null | string;
  errorType?: null | string;
  id: string;
  inputSnapshot?: Record<string, unknown> | null;
  outputSnapshot?: Record<string, unknown> | null;
  pluginId: string;
  status: PlatformPluginRunStatus;
  updatedAt?: Date | string;
  userId?: null | string;
  versionId?: null | string;
};

export type AdminPlatformPluginArtifact = {
  createdAt?: Date | string;
  downloadCount?: number;
  expiresAt?: Date | string | null;
  fileName: string;
  id: string;
  mimeType: string;
  pluginId: string;
  runId: string;
  sizeBytes: number;
  storageKey: string;
  userId?: null | string;
};

export type AdminPlanOption = {
  displayName?: null | string;
  isActive?: boolean | null;
  plan: string;
};
