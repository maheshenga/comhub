import type {
  ModuleAppActionConfig,
  ModuleAppAdminUpsertInput,
  ModuleAppBillingConfig,
  ModuleAppPage,
  ModuleAppPackageReviewStatus,
  ModuleAppPlanEntitlement,
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
  createdAt?: Date | string;
  id: string;
  manifestSnapshot?: {
    app?: {
      displayName?: string;
      slug?: string;
      source?: ModuleAppSource;
    };
    packageVersion?: string;
  };
  rejectionReason?: null | string;
  reviewStatus: ModuleAppPackageReviewStatus;
  submittedByUserId?: null | string;
};
