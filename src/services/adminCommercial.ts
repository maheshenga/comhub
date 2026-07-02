import type { Plans } from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';

type NewapiModelType =
  | 'chat'
  | 'embedding'
  | 'tts'
  | 'stt'
  | 'image'
  | 'video'
  | 'text2music'
  | 'realtime';

type AdminModelApiProviderType = 'newapi' | 'openai-compatible' | 'openai' | 'deepseek' | 'aliyun';

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

  setUserRole = async (params: { role: 'admin' | 'user' | null; userId: string }) => {
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
    cycle: 'monthly' | 'yearly';
    plan: string;
    reason: string;
    userId: string;
  }) => {
    return lambdaClient.admin.subscriptions.forceChange.mutate(params);
  };

  assignUserPlan = async (params: {
    cycle: 'monthly' | 'yearly';
    durationMonths: number;
    plan: string;
    reason: string;
    userId: string;
  }) => lambdaClient.admin.subscriptions.assignPlan.mutate(params);

  // Settings
  getAllSettings = async () => {
    return lambdaClient.admin.settings.getAll.query();
  };

  setAppSetting = async (params: { key: string; value: unknown }) => {
    return lambdaClient.admin.settings.setAppSetting.mutate(params as any);
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

  settleOrder = async (orderId: string) => lambdaClient.admin.orders.settle.mutate({ orderId });

  getReferralStats = async () => lambdaClient.admin.referral.getReferralStats.query();

  // Plan catalog
  listPlans = async () => lambdaClient.admin.plans.list.query();
  upsertPlan = async (params: {
    currency?: string;
    displayName: string;
    features?: string[];
    isActive?: boolean;
    monthlyCredits: number;
    monthlyPrice: number;
    plan: Plans;
    pptCreditCost?: number;
    pptEnabled?: boolean;
    pptMonthlyQuota?: null | number;
    purchaseUrl?: string;
    sortOrder?: number;
    storageQuotaMb?: null | number;
    vectorQuota?: null | number;
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
  listAudit = async (params: {
    action?: string;
    actorUserId?: string;
    cursor?: number;
    limit?: number;
    targetUserId?: string;
  }) => lambdaClient.admin.audit.list.query(params);

  exportAudit = async (params: {
    action?: string;
    actorUserId?: string;
    limit?: number;
    targetUserId?: string;
  }) => lambdaClient.admin.audit.exportAll.query(params);

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

  bulkDeleteRedemptionCodes = async (ids: string[]) =>
    lambdaClient.admin.redemption.bulkDelete.mutate({ ids });

  // NewAPI Providers (multi-instance)
  listNewapiInstances = async () => lambdaClient.admin.newapiProviders.listInstances.query();

  listAllEnabledNewapiModels = async (params?: {
    modelType?:
      | 'chat'
      | 'embedding'
      | 'tts'
      | 'stt'
      | 'image'
      | 'video'
      | 'text2music'
      | 'realtime';
  }) => lambdaClient.admin.newapiProviders.getAllEnabledModels.query(params);

  createNewapiInstance = async (params: {
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
    usageScope?: NewapiModelType[];
  }) => lambdaClient.admin.newapiProviders.createInstance.mutate(params);

  updateNewapiInstance = async (params: {
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
      usageScope?: NewapiModelType[];
    };
    id: string;
  }) => lambdaClient.admin.newapiProviders.updateInstance.mutate(params);

  deleteNewapiInstance = async (id: string) =>
    lambdaClient.admin.newapiProviders.deleteInstance.mutate({ id });

  toggleNewapiInstance = async (params: { enabled: boolean; id: string }) =>
    lambdaClient.admin.newapiProviders.toggleInstanceEnabled.mutate(params);

  testNewapiInstanceConnection = async (id: string) =>
    lambdaClient.admin.newapiProviders.testInstanceConnection.query({ id });

  syncNewapiInstanceModels = async (id: string) =>
    lambdaClient.admin.newapiProviders.syncInstanceModels.mutate({ id });

  listNewapiInstanceModels = async (params: {
    instanceId: string;
    modelType?:
      | 'chat'
      | 'embedding'
      | 'tts'
      | 'stt'
      | 'image'
      | 'video'
      | 'text2music'
      | 'realtime';
  }) => lambdaClient.admin.newapiProviders.listModels.query(params);

  addNewapiInstanceModels = async (params: {
    instanceId: string;
    models: Array<{
      displayName?: string;
      enabled?: boolean;
      modelId: string;
      modelType:
        | 'chat'
        | 'embedding'
        | 'tts'
        | 'stt'
        | 'image'
        | 'video'
        | 'text2music'
        | 'realtime';
      sortOrder?: number;
    }>;
  }) => lambdaClient.admin.newapiProviders.addModels.mutate(params);

  removeNewapiInstanceModel = async (params: {
    instanceId: string;
    modelId: string;
    modelType: 'chat' | 'embedding' | 'tts' | 'stt' | 'image' | 'video' | 'text2music' | 'realtime';
  }) => lambdaClient.admin.newapiProviders.removeModel.mutate(params);

  updateNewapiInstanceModel = async (params: {
    data: { displayName?: string; enabled?: boolean; sortOrder?: number };
    instanceId: string;
    modelId: string;
    modelType: 'chat' | 'embedding' | 'tts' | 'stt' | 'image' | 'video' | 'text2music' | 'realtime';
  }) => lambdaClient.admin.newapiProviders.updateModel.mutate(params);

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
