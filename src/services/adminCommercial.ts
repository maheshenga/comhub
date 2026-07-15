import type { AdminRole, Plans } from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';
import type { SubscriptionCycleType } from '@/types/business';

type AiProviderModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

type NewapiModelType = AiProviderModelType;

type AdminModelApiProviderType =
  | 'newapi'
  | 'openai-compatible'
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'aliyun'
  | 'opencode-go'
  | 'siliconflow';

type AdminAuditQueryParams = {
  action?: string;
  actorUserId?: string;
  from?: Date | string;
  resourceId?: string;
  resourceType?: string;
  targetUserId?: string;
  to?: Date | string;
};

const normalizeAdminAuditQueryParams = <T extends AdminAuditQueryParams>(params: T) => ({
  ...params,
  from: typeof params.from === 'string' ? new Date(params.from) : params.from,
  to: typeof params.to === 'string' ? new Date(params.to) : params.to,
});

class AdminCommercialService {
  // Users
  listUsers = async (params: {
    cursor?: number;
    limit?: number;
    plan?: string;
    query?: string;
    subscriptionStartedOrder?: 'asc' | 'desc';
  }) => {
    return lambdaClient.admin.users.list.query(params);
  };

  getUserDetail = async (userId: string) => {
    return lambdaClient.admin.users.detail.query({ userId });
  };

  getUserFullDetail = async (userId: string) => {
    return lambdaClient.admin.users.fullDetail.query({ userId });
  };

  banUser = async (params: { banReason?: string; userId: string }) => {
    return lambdaClient.admin.users.ban.mutate(params);
  };

  unbanUser = async (userId: string) => {
    return lambdaClient.admin.users.unban.mutate({ userId });
  };

  setUserRole = async (params: { role: AdminRole | 'user' | null; userId: string }) => {
    return lambdaClient.admin.users.setRole.mutate(params);
  };

  // Credits
  getUserBalance = async (userId: string) => {
    return lambdaClient.admin.credits.getBalance.query({ userId });
  };

  getUserLedger = async (params: { cursor?: number; limit?: number; userId: string }) => {
    return lambdaClient.admin.credits.ledger.query(params);
  };

  adjustCredits = async (params: { amount: number; reason: string; userId: string }) => {
    return lambdaClient.admin.credits.adjust.mutate(params);
  };

  // Subscriptions
  listSubscriptions = async (params: { cursor?: number; limit?: number; plan?: string }) => {
    return lambdaClient.admin.subscriptions.list.query(params);
  };

  getUserSubscription = async (userId: string) => {
    return lambdaClient.admin.subscriptions.getUserSubscription.query({ userId });
  };

  forceChangePlan = async (params: {
    cycle: SubscriptionCycleType;
    plan: string;
    reason: string;
    userId: string;
  }) => {
    return lambdaClient.admin.subscriptions.forceChange.mutate(params);
  };

  assignUserPlan = async (params: {
    cycle: SubscriptionCycleType;
    durationMonths: number;
    plan: string;
    reason: string;
    userId: string;
  }) => lambdaClient.admin.subscriptions.assignPlan.mutate(params);

  // Settings
  getAllSettings = async () => {
    return lambdaClient.admin.settings.getAll.query();
  };

  getAppSettingsGovernance = async () => {
    return lambdaClient.admin.settings.getGovernance.query();
  };

  deleteUnknownAppSetting = async (params: { confirmKey: string; key: string }) => {
    return lambdaClient.admin.settings.deleteUnknownSetting.mutate(params);
  };

  setAppSetting = async (params: { key: string; value: unknown }) => {
    return lambdaClient.admin.settings.setAppSetting.mutate(params as any);
  };

  setAppSettingsBatch = async (params: { updates: Array<{ key: string; value: unknown }> }) => {
    return lambdaClient.admin.settings.setAppSettingsBatch.mutate(params as any);
  };

  syncUserGlobalSettingsDefaultsToUsers = async (params?: { forceDefaultAgentMeta?: boolean }) => {
    return lambdaClient.admin.settings.syncUserGlobalSettingsDefaultsToUsers.mutate(params);
  };

  refreshRuntimeCaches = async () => {
    return lambdaClient.admin.settings.refreshRuntimeCaches.mutate();
  };

  testS3Storage = async () => {
    return lambdaClient.admin.settings.testS3Storage.mutate();
  };

  validateDefaultAgentSettings = async (params: {
    model?: string;
    modelType?: 'chat' | 'image' | 'video';
    provider?: string;
  }) => {
    return lambdaClient.admin.settings.validateDefaultAgentSettings.mutate(params);
  };

  getPublicRecommendations = async () => {
    return lambdaClient.admin.settings.getPublicRecommendations.query();
  };

  getPublicOperations = async () => {
    return lambdaClient.admin.settings.getPublicOperations.query();
  };

  getPublicGrowth = async () => {
    return lambdaClient.admin.settings.getPublicGrowth.query();
  };

  getPublicExpertPlaza = async () => {
    return lambdaClient.admin.settings.getPublicExpertPlaza.query();
  };

  getPublicProfileOptions = async () => {
    return lambdaClient.admin.settings.getPublicProfileOptions.query();
  };

  impersonateUser = async (userId: string) => {
    await this.recordImpersonationAttempt(userId);

    const response = await fetch('/api/auth/admin/impersonate-user', {
      body: JSON.stringify({ userId }),
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Impersonation failed: ${response.status}`);
    }

    return response.json();
  };

  getPublicNotificationConfig = async () => {
    return lambdaClient.admin.settings.getPublicNotificationConfig.query();
  };

  getPublicHelpMenu = async () => {
    return lambdaClient.admin.settings.getPublicHelpMenu.query();
  };

  getPublicAboutPage = async () => {
    return lambdaClient.admin.settings.getPublicAboutPage.query();
  };

  getPublicDesktopUpdate = async () => {
    return lambdaClient.admin.settings.getPublicDesktopUpdate.query();
  };

  getPptSettings = async () => lambdaClient.admin.ppt.getSettings.query();

  savePptSettings = async (params: {
    allowPdfExport?: boolean;
    allowPptxDownload?: boolean;
    apiKey?: string;
    auditEnabled?: boolean;
    baseUrl?: string;
    clearApiKey?: boolean;
    creatorVersion?: 'v1' | 'v2';
    dailyLimit?: null | number;
    enabled?: boolean;
    lang?: string;
    themeColor?: null | string;
    tokenTtlMinutes?: number;
  }) => lambdaClient.admin.ppt.saveSettings.mutate(params);

  // Module apps
  moduleApps = {
    createProduct: (input: {
      appId: string;
      licenseScope: 'personal' | 'workspace' | 'workspace_seat';
      moduleMultiplier?: string;
      price: {
        amount: number;
        billingPeriod?: 'monthly' | 'yearly';
        currency: string;
        promotion?: Record<string, unknown>;
        trialDays?: number;
      };
      productKey: string;
      productType: 'free' | 'one_time' | 'subscription';
      revenueShareRate?: string;
      seatCount?: number;
      termsVersion?: string;
    }) => lambdaClient.admin.moduleApps.createProduct.mutate(input as any),
    get: (input: { appId: string }) => lambdaClient.admin.moduleApps.get.query(input),
    approvePackage: (input: { packageId: string }) =>
      lambdaClient.admin.moduleApps.approvePackage.mutate(input),
    getPackage: (input: { packageId: string }) =>
      lambdaClient.admin.moduleApps.getPackage.query(input),
    list: (input?: {
      appId?: string;
      category?: string;
      cursor?: number | string;
      limit?: number;
      publisherId?: string;
      status?: string;
    }) =>
      lambdaClient.admin.moduleApps.list.query(input as any),
    listArtifacts: (input: { appId: string; cursor?: number | string; limit?: number }) =>
      lambdaClient.admin.moduleApps.listArtifacts.query(input as any),
    listAuditEvents: (input: { appId: string; cursor?: number | string; limit?: number }) =>
      lambdaClient.admin.moduleApps.listAuditEvents.query(input as any),
    listInstalls: (input: { appId: string; cursor?: number | string; limit?: number }) =>
      lambdaClient.admin.moduleApps.listInstalls.query(input as any),
    listPackages: (input?: {
      appId?: string;
      buildStatus?: 'building' | 'failed' | 'queued' | 'ready';
      cursor?: number | string;
      limit?: number;
      publisherId?: string;
      reviewStatus?: string;
      submittedByUserId?: string;
    }) => lambdaClient.admin.moduleApps.listPackages.query(input as any),
    listRevenue: (input?: {
      appId?: string;
      cursor?: number | string;
      limit?: number;
      publisherId?: string;
      publisherUserId?: string;
      status?: 'pending' | 'reversed' | 'settled';
    }) => lambdaClient.admin.moduleApps.listRevenue.query(input as any),
    listRecords: (input: { appId: string; cursor?: number | string; limit?: number }) =>
      lambdaClient.admin.moduleApps.listRecords.query(input as any),
    listRuns: (input: { appId: string; cursor?: number | string; limit?: number }) =>
      lambdaClient.admin.moduleApps.listRuns.query(input as any),
    listPublishers: (input?: {
      cursor?: number | string;
      limit?: number;
      status?: 'pending' | 'suspended' | 'verified';
      userId?: string;
    }) => lambdaClient.admin.moduleApps.listPublishers.query(input as any),
    listPayouts: (input?: {
      cursor?: number | string;
      limit?: number;
      publisherId?: string;
      status?: 'eligible' | 'failed' | 'paid' | 'pending' | 'processing' | 'reversed';
    }) => lambdaClient.admin.moduleApps.listPayouts.query(input as any),
    listPaymentDiagnostics: (input?: {
      appId?: string;
      cursor?: number | string;
      discrepancyStatus?: 'open' | 'resolved';
      limit?: number;
      orderId?: string;
      paymentStatus?: 'created' | 'failed' | 'paid' | 'pending' | 'refunded';
      refundStatus?: 'failed' | 'requested' | 'succeeded';
    }) => lambdaClient.admin.moduleApps.listPaymentDiagnostics.query(input as any),
    listProducts: (input: { appId: string }) =>
      lambdaClient.admin.moduleApps.listProducts.query(input),
    publish: (input: { appId: string }) => lambdaClient.admin.moduleApps.publish.mutate(input),
    rejectPackage: (input: { packageId: string; reason?: string }) =>
      lambdaClient.admin.moduleApps.rejectPackage.mutate(input),
    rescanPackage: (input: { packageId: string }) =>
      lambdaClient.admin.moduleApps.rescanPackage.mutate(input),
    settleRevenueBatch: (input: { entryIds: string[] }) =>
      lambdaClient.admin.moduleApps.settleRevenueBatch.mutate(input),
    unpublish: (input: { appId: string }) => lambdaClient.admin.moduleApps.unpublish.mutate(input),
    upsert: (input: unknown) => lambdaClient.admin.moduleApps.upsert.mutate(input as any),
    upsertActions: (input: { actions: unknown[]; appId: string }) =>
      lambdaClient.admin.moduleApps.upsertActions.mutate(input as any),
    upsertBilling: (input: { appId: string; billing: unknown }) =>
      lambdaClient.admin.moduleApps.upsertBilling.mutate(input as any),
    upsertEntitlements: (input: { appId: string; entitlements: unknown[] }) =>
      lambdaClient.admin.moduleApps.upsertEntitlements.mutate(input as any),
    upsertPages: (input: { appId: string; pages: unknown[] }) =>
      lambdaClient.admin.moduleApps.upsertPages.mutate(input as any),
    updateProduct: (input: {
      licenseScope: 'personal' | 'workspace' | 'workspace_seat';
      moduleMultiplier?: string;
      price: {
        amount: number;
        billingPeriod?: 'monthly' | 'yearly';
        currency: string;
        promotion?: Record<string, unknown>;
        trialDays?: number;
      };
      productId: string;
      productType: 'free' | 'one_time' | 'subscription';
      revenueShareRate?: string;
      seatCount?: number;
      status: 'active' | 'inactive';
      termsVersion?: string;
    }) => lambdaClient.admin.moduleApps.updateProduct.mutate(input as any),
  };

  // Orders
  listOrders = async (params: {
    cursor?: number;
    limit?: number;
    status?: 'pending' | 'paid' | 'canceled' | 'expired' | 'failed' | 'refunded';
    userId?: string;
  }) => lambdaClient.admin.orders.list.query(params);

  cancelOrder = async (orderId: string) => lambdaClient.admin.orders.cancel.mutate({ orderId });

  expireOrder = async (orderId: string) => lambdaClient.admin.orders.expire.mutate({ orderId });

  getOrderDetail = async (orderId: string) =>
    lambdaClient.admin.orders.getDetail.query({ orderId });

  settleOrder = async (params: { orderId: string; reason: string }) =>
    lambdaClient.admin.orders.settle.mutate(params);

  getReferralStats = async () => lambdaClient.admin.referral.getReferralStats.query();

  // Plan catalog
  listPlans = async () => lambdaClient.admin.plans.list.query();
  upsertPlan = async (params: {
    badge?: string;
    comparisonNote?: string;
    currency?: string;
    displayName: string;
    features?: string[];
    isActive?: boolean;
    lifetimePrice?: null | number;
    monthlyCredits: number;
    monthlyPrice: number;
    oneTimePrice?: null | number;
    plan: Plans;
    pptCreditCost?: number;
    pptEnabled?: boolean;
    pptMonthlyQuota?: null | number;
    purchaseUrl?: string;
    sortOrder?: number;
    storageQuotaMb?: null | number;
    vectorQuota?: null | number;
    yearlyDiscountLabel?: string;
    yearlyPrice: number;
  }) => lambdaClient.admin.plans.upsert.mutate(params);
  deletePlan = async (plan: string) => lambdaClient.admin.plans.delete.mutate({ plan });
  setPlanActive = async (params: { isActive: boolean; plan: string }) =>
    lambdaClient.admin.plans.setActive.mutate(params);

  // Top-up packages
  listPackages = async () => lambdaClient.admin.topupPackages.list.query();
  upsertPackage = async (params: {
    amount: number;
    credits: number;
    currency?: string;
    displayName: string;
    id: string;
    isActive?: boolean;
    originalAmount?: number;
    promotionEnabled?: boolean;
    promotionLabel?: string;
    promotionNote?: string;
    recommended?: boolean;
    sortOrder?: number;
    validityMonths?: number;
  }) => lambdaClient.admin.topupPackages.upsert.mutate(params);
  deletePackage = async (id: string) => lambdaClient.admin.topupPackages.delete.mutate({ id });
  setPackageActive = async (params: { id: string; isActive: boolean }) =>
    lambdaClient.admin.topupPackages.setActive.mutate(params);

  // Stats
  getStatsOverview = async () => {
    return lambdaClient.admin.stats.overview.query();
  };

  getStatsDauTrend = async () => lambdaClient.admin.stats.dauTrend.query();
  getStatsSubscriptionsByPlan = async () => lambdaClient.admin.stats.subscriptionsByPlan.query();
  getStatsRevenueByMonth = async () => lambdaClient.admin.stats.revenueByMonth.query();
  getStatsRedemptionOverview = async () => lambdaClient.admin.stats.redemptionOverview.query();

  // Audit log
  listAudit = async (
    params: AdminAuditQueryParams & {
      cursor?: number;
      limit?: number;
    },
  ) => lambdaClient.admin.audit.list.query(normalizeAdminAuditQueryParams(params));

  exportAudit = async (
    params: AdminAuditQueryParams & {
      limit?: number;
    },
  ) => lambdaClient.admin.audit.exportAll.query(normalizeAdminAuditQueryParams(params));

  // Subscription Change Requests
  listChangeRequests = async (params: {
    cursor?: number;
    limit?: number;
    status?: 'pending' | 'completed' | 'canceled' | 'rejected';
    userId?: string;
  }) => lambdaClient.admin.subscriptions.listChangeRequests.query(params);

  approveChangeRequest = async (requestId: string) =>
    lambdaClient.admin.subscriptions.approveChangeRequest.mutate({ requestId });

  rejectChangeRequest = async (params: { reason?: string; requestId: string }) =>
    lambdaClient.admin.subscriptions.rejectChangeRequest.mutate(params);

  bulkApproveChangeRequests = async (requestIds: string[]) =>
    lambdaClient.admin.subscriptions.bulkApproveChangeRequests.mutate({ requestIds });

  bulkRejectChangeRequests = async (params: { reason?: string; requestIds: string[] }) =>
    lambdaClient.admin.subscriptions.bulkRejectChangeRequests.mutate(params);

  // Credit accounts
  listCreditAccounts = async (params: {
    cursor?: number;
    limit?: number;
    negativeOnly?: boolean;
    order?: 'asc' | 'desc';
    sort?: 'balance' | 'totalCredited' | 'totalDebited' | 'updatedAt';
  }) => lambdaClient.admin.credits.listAccounts.query(params);

  // Users export
  exportUsers = async (params: { limit?: number; query?: string }) =>
    lambdaClient.admin.users.exportAll.query(params);

  resetAllUsersToFreePlan = async (params?: { reason?: string }) =>
    lambdaClient.admin.users.resetAllToFreePlan.mutate(params ?? {});

  getResetAllUsersToFreePlanPreview = async () =>
    lambdaClient.admin.users.getResetAllToFreePlanPreview.query();

  recordImpersonationAttempt = async (userId: string) =>
    lambdaClient.admin.users.recordImpersonationAttempt.mutate({ userId });

  // Content governance
  listAdminTopics = async (params: {
    cursor?: number;
    limit?: number;
    query?: string;
    status?: 'active' | 'completed' | 'archived';
    userId?: string;
  }) => lambdaClient.admin.content.listTopics.query(params);

  archiveAdminTopic = async (topicId: string) =>
    lambdaClient.admin.content.archiveTopic.mutate({ topicId });

  deleteAdminTopic = async (topicId: string) =>
    lambdaClient.admin.content.deleteTopic.mutate({ topicId });

  listAdminFiles = async (params: {
    cursor?: number;
    limit?: number;
    query?: string;
    userId?: string;
  }) => lambdaClient.admin.content.listFiles.query(params);

  deleteAdminFile = async (fileId: string) =>
    lambdaClient.admin.content.deleteFile.mutate({ fileId });

  listAdminDocuments = async (params: {
    cursor?: number;
    limit?: number;
    query?: string;
    sourceType?: 'file' | 'web' | 'api' | 'topic' | 'agent' | 'agent-signal';
    userId?: string;
  }) => lambdaClient.admin.content.listDocuments.query(params);

  deleteAdminDocument = async (documentId: string) =>
    lambdaClient.admin.content.deleteDocument.mutate({ documentId });

  // Maintenance
  runMaintenance = async (params?: {
    auditRetentionDays?: number;
    notificationRetentionDays?: number;
    pendingOrderExpiryDays?: number;
    skipAudit?: boolean;
    skipModuleAppUploads?: boolean;
    skipNotifications?: boolean;
    skipOrders?: boolean;
  }) => lambdaClient.admin.settings.runMaintenance.mutate(params ?? {});

  // Redemption codes
  generateRedemptionCodes = async (params: {
    batchId?: string;
    codeLength?: number;
    count?: number;
    creditsAmount?: number;
    expiresAt?: string;
    note?: string;
    planCycle?: 'monthly' | 'yearly';
    planDurationMonths?: number;
    planKey?: string;
    rewardType: 'plan' | 'credits' | 'topup_package';
    topupPackageId?: string;
  }) => lambdaClient.admin.redemption.generate.mutate(params as any);

  listRedemptionCodes = async (params: {
    batchId?: string;
    codeQuery?: string;
    cursor?: number;
    limit?: number;
    rewardType?: 'plan' | 'credits' | 'topup_package';
    status?: 'active' | 'redeemed' | 'disabled' | 'expired';
  }) => lambdaClient.admin.redemption.list.query(params);

  disableRedemptionCode = async (id: string) =>
    lambdaClient.admin.redemption.disable.mutate({ id });

  enableRedemptionCode = async (id: string) => lambdaClient.admin.redemption.enable.mutate({ id });

  expireOverdueRedemptionCodes = async () => lambdaClient.admin.redemption.expireOverdue.mutate();

  bulkDisableRedemptionCodes = async (ids: string[]) =>
    lambdaClient.admin.redemption.bulkDisable.mutate({ ids });

  bulkDeleteRedemptionCodes = async (params: { ids: string[]; reason?: string } | string[]) =>
    lambdaClient.admin.redemption.bulkDelete.mutate(
      Array.isArray(params) ? { ids: params } : params,
    );

  // AI service providers (TRPC route keeps its historical newapiProviders name for compatibility).
  listAiProviderInstances = async () => lambdaClient.admin.newapiProviders.listInstances.query();

  listNewapiInstances = this.listAiProviderInstances;

  listAllEnabledAiProviderModels = async (params?: { modelType?: AiProviderModelType }) =>
    lambdaClient.admin.newapiProviders.getAllEnabledModels.query(params);

  getAiProviderModelCatalogDiagnostics = async () =>
    lambdaClient.admin.newapiProviders.getModelCatalogDiagnostics.query();

  listAllEnabledNewapiModels = async (params?: {
    modelType?: NewapiModelType;
  }) => this.listAllEnabledAiProviderModels(params);

  createAiProviderInstance = async (params: {
    apiKey: string;
    baseUrl: string;
    description?: string;
    enabled?: boolean;
    fetchOnClient?: boolean;
    groupKey?: string;
    groupMultiplier?: number;
    groupName?: string;
    name: string;
    priority?: number;
    providerType?: AdminModelApiProviderType;
    usageScope?: AiProviderModelType[];
  }) => lambdaClient.admin.newapiProviders.createInstance.mutate(params);

  createNewapiInstance = this.createAiProviderInstance;

  updateAiProviderInstance = async (params: {
    data: {
      apiKey?: string;
      baseUrl?: string;
      description?: string;
      enabled?: boolean;
      fetchOnClient?: boolean;
      groupKey?: string;
      groupMultiplier?: number;
      groupName?: string;
      name?: string;
      priority?: number;
      providerType?: AdminModelApiProviderType;
      usageScope?: AiProviderModelType[];
    };
    id: string;
  }) => lambdaClient.admin.newapiProviders.updateInstance.mutate(params);

  updateNewapiInstance = this.updateAiProviderInstance;

  deleteAiProviderInstance = async (params: { id: string; reason?: string } | string) =>
    lambdaClient.admin.newapiProviders.deleteInstance.mutate(
      typeof params === 'string' ? { id: params } : params,
    );

  deleteNewapiInstance = this.deleteAiProviderInstance;

  toggleAiProviderInstance = async (params: { enabled: boolean; id: string }) =>
    lambdaClient.admin.newapiProviders.toggleInstanceEnabled.mutate(params);

  toggleNewapiInstance = this.toggleAiProviderInstance;

  testAiProviderInstanceConnection = async (id: string) =>
    lambdaClient.admin.newapiProviders.testInstanceConnection.query({ id });

  testNewapiInstanceConnection = this.testAiProviderInstanceConnection;

  syncAiProviderInstanceModels = async (id: string) =>
    lambdaClient.admin.newapiProviders.syncInstanceModels.mutate({ id });

  syncNewapiInstanceModels = this.syncAiProviderInstanceModels;

  refreshAiProviderRuntimeCache = async () =>
    lambdaClient.admin.newapiProviders.refreshRuntimeCache.mutate();

  listAiProviderInstanceModels = async (params: {
    instanceId: string;
    modelType?: AiProviderModelType;
  }) => lambdaClient.admin.newapiProviders.listModels.query(params);

  listNewapiInstanceModels = this.listAiProviderInstanceModels;

  addAiProviderInstanceModels = async (params: {
    instanceId: string;
    models: Array<{
      displayName?: string;
      enabled?: boolean;
      modelId: string;
      modelType: AiProviderModelType;
      sortOrder?: number;
    }>;
  }) => lambdaClient.admin.newapiProviders.addModels.mutate(params);

  addNewapiInstanceModels = this.addAiProviderInstanceModels;

  removeAiProviderInstanceModel = async (params: {
    instanceId: string;
    modelId: string;
    modelType: AiProviderModelType;
  }) => lambdaClient.admin.newapiProviders.removeModel.mutate(params);

  removeNewapiInstanceModel = this.removeAiProviderInstanceModel;

  updateAiProviderInstanceModel = async (params: {
    data: {
      displayName?: string;
      enabled?: boolean;
      metadata?: Record<string, unknown> | null;
      sortOrder?: number;
    };
    instanceId: string;
    modelId: string;
    modelType: AiProviderModelType;
  }) => lambdaClient.admin.newapiProviders.updateModel.mutate(params);

  updateNewapiInstanceModel = this.updateAiProviderInstanceModel;

  // Plan model rules (per-type allowlist/blocklist)
  setPlanModelRules = async (params: {
    modelRules?: Record<
      string,
      { allowlist?: string[]; blocklist?: string[]; mode: 'allowlist' | 'blocklist' }
    >;
    plan: string;
  }) => lambdaClient.admin.plans.setModelRules.mutate(params as any);
}

export const adminCommercialService = new AdminCommercialService();
