import type {
  ModuleAppActionConfig,
  ModuleAppAdminUpsertInput,
  ModuleAppBillingConfig,
  ModuleAppBuildStatus,
  ModuleAppOutboundHostPurpose,
  ModuleAppPackageReviewStatus,
  ModuleAppPackageScanStatus,
  ModuleAppPage,
  ModuleAppPlanEntitlement,
  ModuleAppRuntimeReadiness,
  ModuleAppSource,
  ModuleAppStatus,
  ModuleAppType,
} from '@lobechat/types';

export type AdminModuleAppItem = {
  appType: ModuleAppType;
  billing?: ModuleAppBillingConfig;
  category: string;
  description?: string;
  displayName: string;
  icon: string;
  id: string;
  slug: string;
  source?: ModuleAppSource;
  status: ModuleAppStatus;
  tags?: string[];
  updatedAt?: Date | string;
};

export type AdminModuleAppDetail = AdminModuleAppItem & {
  actions: ModuleAppActionConfig[];
  entitlements: ModuleAppPlanEntitlement[];
  pages: ModuleAppPage[];
  version?: string;
  versionId?: string;
};

export type AdminModuleAppUpsertResult = Pick<ModuleAppAdminUpsertInput, 'slug'> & {
  id: string;
};

export type AdminPlanOption = {
  displayName?: string;
  plan: string;
};

export type AdminModuleAppPackageRow = {
  appId?: null | string;
  buildFailureCode?: null | string;
  buildStatus?: ModuleAppBuildStatus | null;
  createdAt?: Date | string;
  id: string;
  manifestSnapshot?: {
    app?: {
      displayName?: string;
      slug?: string;
      source?: ModuleAppSource;
    };
    packageVersion?: string;
    runtime?: { outboundHosts?: string[] };
  };
  rejectionReason?: null | string;
  reviewStatus: ModuleAppPackageReviewStatus;
  scanStatus: ModuleAppPackageScanStatus;
  submittedByUserId?: null | string;
};

export type AdminModuleAppOutboundHostPurpose = ModuleAppOutboundHostPurpose;

export type ModuleAppRecordRow = {
  collectionKey: string;
  id: string;
  scopeType: string;
  status?: string;
  title?: null | string;
  updatedAt?: Date | string;
};

export type ModuleAppRunRow = {
  actionId?: null | string;
  createdAt?: Date | string;
  durationMs?: null | number;
  errorType?: null | string;
  id: string;
  status: string;
};

export type ModuleAppArtifactRow = {
  fileName?: null | string;
  id: string;
  mimeType?: null | string;
  scopeType?: null | string;
  sizeBytes?: null | number;
  storageKey?: null | string;
};

export type ModuleAppInstallRow = {
  id: string;
  installedAt?: Date | string;
  scopeType?: string;
  status?: string;
  userId?: null | string;
  workspaceId?: null | string;
};

export type ModuleAppRuntimeDiagnostics = {
  configuration: {
    internalTokenConfigured: boolean;
    internalUrlConfigured: boolean;
    publicOriginConfigured: boolean;
  };
  probe: ModuleAppRuntimeReadiness;
  switches: {
    executionEnabled: boolean;
    invocationEnabled: boolean;
    publicExecutionEnabled: boolean;
  };
};

export type ModuleAppAuditRow = {
  actorUserId?: null | string;
  createdAt?: Date | string;
  eventType: string;
  id: string;
};
