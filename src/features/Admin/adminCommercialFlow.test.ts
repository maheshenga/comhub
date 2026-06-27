import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

describe('admin commercial flow pages', () => {
  it('keeps recharge package management inside the orders management surface', () => {
    const ordersPage = readRepoFile('src/features/Admin/AdminOrdersPage.tsx');
    const topupRoute = readRepoFile('src/routes/(main)/admin/topup/index.tsx');

    expect(ordersPage).toContain('AdminTopUpPackagesPage');
    expect(ordersPage).toContain("key: 'orders'");
    expect(ordersPage).toContain("key: 'topup'");
    expect(topupRoute).toContain(
      "import AdminMergedRoutePage from '@/features/Admin/AdminMergedRoutePage'",
    );
    expect(topupRoute).toContain('`${ADMIN_BASE_PATH}/orders`');
    expect(topupRoute).not.toContain('AdminTopUpPackagesPage');
  });

  it('keeps plan change request handling inside the subscriptions management surface', () => {
    const subscriptionsPage = readRepoFile('src/features/Admin/AdminSubscriptionsPage.tsx');
    const subscriptionsRoute = readRepoFile('src/routes/(main)/admin/subscriptions/index.tsx');
    const changeRequestsRoute = readRepoFile('src/routes/(main)/admin/change-requests/index.tsx');

    expect(subscriptionsPage).toContain('AdminChangeRequestsPage');
    expect(subscriptionsPage).toContain("key: 'subscriptions'");
    expect(subscriptionsPage).toContain("key: 'changeRequests'");
    expect(subscriptionsRoute).toContain(
      "import AdminSubscriptionsPage from '@/features/Admin/AdminSubscriptionsPage'",
    );
    expect(changeRequestsRoute).toContain(
      "import AdminMergedRoutePage from '@/features/Admin/AdminMergedRoutePage'",
    );
    expect(changeRequestsRoute).toContain('`${ADMIN_BASE_PATH}/subscriptions`');
    expect(changeRequestsRoute).not.toContain('AdminChangeRequestsPage');
  });

  it('uses one shared assign-plan modal for user list and user detail operations', () => {
    const usersPage = readRepoFile('src/routes/(main)/admin/users/index.tsx');
    const userDetailDrawer = readRepoFile('src/features/Admin/AdminUserDetailDrawer.tsx');

    expect(usersPage).toContain(
      "import AdminAssignPlanModal from '@/features/Admin/AdminAssignPlanModal'",
    );
    expect(userDetailDrawer).toContain("import AdminAssignPlanModal from './AdminAssignPlanModal'");
    expect(usersPage).toContain('<AdminAssignPlanModal');
    expect(userDetailDrawer).toContain('<AdminAssignPlanModal');
  });

  it('does not keep the removed standalone pricing settings helper', () => {
    expect(existsSync(path.resolve(repoRoot, 'src/features/Admin/adminPricingSettings.ts'))).toBe(
      false,
    );
    expect(
      existsSync(path.resolve(repoRoot, 'src/features/Admin/adminPricingSettings.test.ts')),
    ).toBe(false);
  });

  it('does not keep the old generic admin placeholder page', () => {
    expect(existsSync(path.resolve(repoRoot, 'src/features/Admin/AdminPagePlaceholder.tsx'))).toBe(
      false,
    );

    const adminIndex = readRepoFile('src/features/Admin/index.ts');
    expect(adminIndex).not.toContain('AdminPagePlaceholder');
  });

  it('lets admin configure public recommendation section titles', () => {
    const appSettings = readRepoFile('src/server/services/appSettings/index.ts');
    const settingsRouter = readRepoFile('packages/business-server/src/lambda-routers/admin/settings.ts');
    const adminRecommendations = readRepoFile('src/features/Admin/AdminRecommendationsPage.tsx');
    const publicRecommendations = readRepoFile('src/features/CommunityRecommendations/index.tsx');

    for (const key of [
      'recommendationAssistantTitle',
      'recommendationMcpTitle',
      'recommendationSkillTitle',
      'recommendationGeneralSkillTitle',
      'recommendationHotSkillTitle',
    ]) {
      expect(appSettings).toContain(key);
      expect(settingsRouter).toContain(`SETTING_KEYS.${key}`);
    }

    expect(adminRecommendations).toContain('name="assistantTitle"');
    expect(adminRecommendations).toContain('name="mcpTitle"');
    expect(adminRecommendations).toContain('name="skillTitle"');
    expect(adminRecommendations).toContain('name="generalSkillTitle"');
    expect(adminRecommendations).toContain('name="hotSkillTitle"');

    expect(publicRecommendations).toContain('config.assistantTitle');
    expect(publicRecommendations).toContain('config.mcpTitle');
    expect(publicRecommendations).toContain('config.skillTitle');
    expect(publicRecommendations).toContain('config.generalSkillTitle');
    expect(publicRecommendations).toContain('config.hotSkillTitle');
  });

  it('uses provider-neutral copy for shared model center surfaces', () => {
    const matrixPage = readRepoFile('src/features/Admin/AdminModelBillingMatrixPage.tsx');
    const providersPage = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');
    const settingsPage = readRepoFile('src/features/Admin/AdminSettingsPage.tsx');
    const modelPolicyPage = readRepoFile('src/features/Admin/AdminModelPolicyPage.tsx');

    expect(matrixPage).not.toContain('暂无已启用的 NewAPI 模型');
    expect(providersPage).not.toContain('配置多个 NewAPI 上游实例');
    expect(settingsPage).not.toContain('LobeHub 品牌名称');
    expect(settingsPage).not.toContain('LobeHub 显示名称');
    expect(settingsPage).not.toContain('使用 NewAPI 转站');
    expect(settingsPage).not.toContain('使用 NewAPI 图像模型');
    expect(settingsPage).not.toContain('使用 NewAPI 视频模型');
    expect(settingsPage).not.toContain('例如 newapi');
    expect(settingsPage).not.toContain('placeholder="newapi"');
    expect(modelPolicyPage).not.toContain("placeholder={'newapi:");
    expect(providersPage).not.toContain('NewAPI 支持同步模型和价格');
    expect(matrixPage).toContain('暂无已启用的服务商模型');
    expect(providersPage).toContain('配置多个服务商上游实例');
    expect(settingsPage).toContain('使用服务商网关时填写对应供应商标识');
    expect(settingsPage).toContain('选择或输入服务商标识');
  });

  it('uses provider-neutral i18n keys for the admin provider page', () => {
    const providersPage = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');

    expect(providersPage).toContain('admin.providers.');
    expect(providersPage).not.toContain('admin.newapi.');
  });

  it('uses AI service provider service helpers as the provider page primary API', () => {
    const providersPage = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');
    const service = readRepoFile('src/services/adminCommercial.ts');

    for (const method of [
      'listAiProviderInstances',
      'createAiProviderInstance',
      'updateAiProviderInstance',
      'deleteAiProviderInstance',
      'toggleAiProviderInstance',
      'testAiProviderInstanceConnection',
      'syncAiProviderInstanceModels',
      'listAiProviderInstanceModels',
      'addAiProviderInstanceModels',
      'removeAiProviderInstanceModel',
      'updateAiProviderInstanceModel',
    ]) {
      expect(service).toContain(method);
      expect(providersPage).toContain(`adminCommercialService.${method}`);
    }

    for (const legacyMethod of [
      'listNewapiInstances',
      'createNewapiInstance',
      'updateNewapiInstance',
      'deleteNewapiInstance',
      'toggleNewapiInstance',
      'testNewapiInstanceConnection',
      'syncNewapiInstanceModels',
      'listNewapiInstanceModels',
      'addNewapiInstanceModels',
      'removeNewapiInstanceModel',
      'updateNewapiInstanceModel',
    ]) {
      expect(providersPage).not.toContain(`adminCommercialService.${legacyMethod}`);
    }
  });

  it('uses AI service provider model helpers in shared model billing surfaces', () => {
    const matrixPage = readRepoFile('src/features/Admin/AdminModelBillingMatrixPage.tsx');
    const service = readRepoFile('src/services/adminCommercial.ts');

    expect(service).toContain('listAllEnabledAiProviderModels');
    expect(matrixPage).toContain('adminCommercialService.listAllEnabledAiProviderModels');
    expect(matrixPage).not.toContain('adminCommercialService.listAllEnabledNewapiModels');
  });

  it('uses provider-neutral file names for the admin provider page', () => {
    expect(existsSync(path.resolve(repoRoot, 'src/features/Admin/AdminProvidersPage.tsx'))).toBe(
      true,
    );
    expect(
      existsSync(path.resolve(repoRoot, 'src/features/Admin/AdminNewapiProvidersPage.tsx')),
    ).toBe(false);
    expect(
      existsSync(path.resolve(repoRoot, 'src/features/Admin/adminProviderInstanceForm.ts')),
    ).toBe(true);
    expect(
      existsSync(path.resolve(repoRoot, 'src/features/Admin/adminNewapiInstanceForm.ts')),
    ).toBe(false);
  });

  it('uses the provider-neutral admin route for service provider management', () => {
    const desktopRouteRegistry = readRepoFile('src/business/client/adminSettingsRouteRegistry.ts');

    expect(existsSync(path.resolve(repoRoot, 'src/routes/(main)/admin/providers/index.tsx'))).toBe(
      true,
    );
    expect(
      existsSync(path.resolve(repoRoot, 'src/routes/(main)/admin/newapi-providers/index.tsx')),
    ).toBe(false);
    expect(desktopRouteRegistry).toContain("import('@/routes/(main)/admin/providers')");
    expect(desktopRouteRegistry).toContain("segment: 'providers'");
    expect(desktopRouteRegistry).not.toContain('newapi-providers');
  });

  it('wires centralized dangerous action confirmations into high-risk admin surfaces', () => {
    const creditsPage = readRepoFile('src/routes/(main)/admin/credits/index.tsx');
    const providersPage = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');
    const redemptionPage = readRepoFile('src/routes/(main)/admin/redemption/index.tsx');
    const usersPage = readRepoFile('src/routes/(main)/admin/users/index.tsx');
    const userDetailDrawer = readRepoFile('src/features/Admin/AdminUserDetailDrawer.tsx');
    const contentPages = readRepoFile('src/features/Admin/AdminContentPages.tsx');
    const ordersPage = readRepoFile('src/features/Admin/AdminOrdersPage.tsx');

    expect(creditsPage).toContain('AdminDangerousActionButton');
    expect(creditsPage).toContain('actionId="credits.adjust"');

    expect(providersPage).toContain('AdminDangerousActionButton');
    expect(providersPage).toContain('actionId="newapiProvider.deleteInstance"');

    expect(usersPage).toContain('AdminDangerousActionButton');
    expect(usersPage).toContain('actionId="user.resetAllToFreePlan"');
    expect(usersPage).toContain('actionId="credits.adjust"');

    expect(userDetailDrawer).toContain('AdminDangerousActionButton');
    expect(userDetailDrawer).toContain('actionId="credits.adjust"');

    for (const actionId of [
      'content.deleteTopic',
      'content.deleteFile',
      'content.deleteDocument',
    ]) {
      expect(contentPages).toContain(`actionId="${actionId}"`);
    }

    expect(ordersPage).toContain('actionId="order.expire"');
    expect(ordersPage).toContain('actionId="order.cancel"');
    expect(ordersPage).toContain('actionId="order.settle"');
    expect(ordersPage).toContain('adminCommercialService.settleOrder');

    expect(redemptionPage).toContain('AdminBulkActionFlow');
    expect(redemptionPage).toContain('actionId="redemption.bulkDisable"');
    expect(redemptionPage).toContain('actionId="redemption.bulkDelete"');
  });

  it('localizes centralized dangerous action confirmation microcopy', () => {
    const dangerousButton = readRepoFile('src/features/Admin/AdminDangerousActionButton.tsx');
    const enSubscription = readRepoFile('locales/en-US/subscription.json');
    const zhSubscription = readRepoFile('locales/zh-CN/subscription.json');

    expect(dangerousButton).toContain("useTranslation('subscription')");
    expect(dangerousButton).toContain('admin.dangerousAction.typedConfirm');
    expect(dangerousButton).toContain('admin.dangerousAction.reasonPlaceholder');
    expect(dangerousButton).toContain('admin.dangerousAction.errors.');
    expect(dangerousButton).not.toContain("setError(result.errors.join(', '))");
    expect(dangerousButton).not.toContain('placeholder="Reason"');
    expect(dangerousButton).not.toContain('Type <Typography.Text code>');

    for (const locale of [enSubscription, zhSubscription]) {
      for (const key of [
        'admin.dangerousAction.typedConfirm',
        'admin.dangerousAction.reasonPlaceholder',
        'admin.dangerousAction.errors.confirmation_required',
        'admin.dangerousAction.errors.confirmation_text_mismatch',
        'admin.dangerousAction.errors.reason_required',
        'admin.dangerousAction.errors.unknown_action',
        'admin.bulkAction.cancel',
        'admin.bulkAction.confirm',
        'admin.bulkAction.close',
        'admin.bulkAction.progress',
        'admin.bulkAction.done',
        'admin.bulkAction.error',
        'admin.bulkAction.errorFallback',
      ]) {
        expect(locale).toContain(`"${key}"`);
      }
    }
  });

  it('uses a modal state machine for redemption bulk operations', () => {
    const bulkActionFlow = readRepoFile('src/features/Admin/AdminBulkActionFlow.tsx');
    const redemptionPage = readRepoFile('src/routes/(main)/admin/redemption/index.tsx');

    expect(bulkActionFlow).toContain("type AdminBulkActionFlowStep = 'confirm' | 'progress' | 'done' | 'error'");
    expect(bulkActionFlow).toContain("closable={step !== 'progress'}");
    expect(bulkActionFlow).toContain("maskClosable={step !== 'progress'}");
    expect(bulkActionFlow).toContain('NeuralNetworkLoading');
    expect(bulkActionFlow).toContain('validateAdminDangerousActionConfirmation');

    expect(redemptionPage).toContain('AdminBulkActionFlow');
    expect(redemptionPage).toContain('actionId="redemption.bulkDisable"');
    expect(redemptionPage).toContain('actionId="redemption.bulkDelete"');
    expect(redemptionPage).toContain('summary={formatBulkDisableResult}');
    expect(redemptionPage).toContain('summary={formatBulkDeleteResult}');
    expect(redemptionPage).not.toContain('message.success(\n        t(\'admin.redemption.bulkDisableDone\'');
    expect(redemptionPage).not.toContain('message.success(\n        t(\'admin.redemption.bulkDeleteDone\'');
  });

  it('uses a modal state machine for change request bulk operations', () => {
    const changeRequestsPage = readRepoFile('src/features/Admin/AdminChangeRequestsPage.tsx');
    const bulkActionFlow = readRepoFile('src/features/Admin/AdminBulkActionFlow.tsx');

    expect(changeRequestsPage).toContain('AdminBulkActionFlow');
    expect(changeRequestsPage).toContain('actionId="subscription.changeRequest.bulkApprove"');
    expect(changeRequestsPage).toContain('actionId="subscription.changeRequest.bulkReject"');
    expect(changeRequestsPage).toContain('summary={formatBulkApproveChangeRequestResult}');
    expect(changeRequestsPage).toContain('summary={formatBulkRejectChangeRequestResult}');
    expect(changeRequestsPage).toContain("progressDescription={t(");
    expect(changeRequestsPage).toContain("'admin.changeRequests.bulkApproveProgress'");
    expect(changeRequestsPage).toContain("'admin.changeRequests.bulkRejectProgress'");
    expect(changeRequestsPage).not.toContain('bulkRunning');
    expect(changeRequestsPage).not.toContain('bulkRejectOpen');
    expect(changeRequestsPage).not.toContain("t('admin.changeRequests.bulkApproveDone'");
    expect(changeRequestsPage).not.toContain("t('admin.changeRequests.bulkRejectDone'");

    expect(bulkActionFlow).toContain('reasonOptional?: boolean');
    expect(bulkActionFlow).toContain('requirement?.requiresReason || reasonOptional');
    expect(changeRequestsPage).toContain('reasonOptional');
    expect(changeRequestsPage).toContain('onRun={({ reason }) => handleBulkReject(reason)}');
  });

  it('keeps all selected-row admin bulk mutations on the shared state machine', () => {
    const redemptionPage = readRepoFile('src/routes/(main)/admin/redemption/index.tsx');
    const changeRequestsPage = readRepoFile('src/features/Admin/AdminChangeRequestsPage.tsx');
    const providersPage = readRepoFile('src/features/Admin/AdminProvidersPage.tsx');

    for (const page of [redemptionPage, changeRequestsPage]) {
      expect(page).toContain('rowSelection={{');
      expect(page).toContain('selectedIds');
      expect(page).toContain('AdminBulkActionFlow');
      expect(page).not.toContain('bulkRunning');
      expect(page).not.toContain('confirmLoading={bulkRunning}');
    }

    expect(providersPage).toContain('bulkText');
    expect(providersPage).toContain('admin.providers.models.bulkAddHint');
    expect(providersPage).not.toContain('rowSelection={{');
  });

  it('adds an order detail drawer for P2 operations review', () => {
    const ordersPage = readRepoFile('src/features/Admin/AdminOrdersPage.tsx');
    const service = readRepoFile('src/services/adminCommercial.ts');

    expect(ordersPage).toContain('orderDetailId');
    expect(ordersPage).toContain('adminCommercialService.getOrderDetail(orderDetailId');
    expect(ordersPage).toContain("t('admin.orders.viewDetail'");
    expect(ordersPage).toContain("t('admin.orders.detail.redemptionCode'");
    expect(ordersPage).toContain("t('admin.orders.detail.auditHint'");
    expect(service).toContain('getOrderDetail = async (orderId: string)');
  });

  it('deep links order details into filtered audit logs', () => {
    const ordersPage = readRepoFile('src/features/Admin/AdminOrdersPage.tsx');
    const auditPage = readRepoFile('src/routes/(main)/admin/audit/index.tsx');

    expect(ordersPage).toContain("import { Link } from 'react-router'");
    expect(ordersPage).toContain('const buildOrderAuditUrl = (orderId: string) => {');
    expect(ordersPage).toContain("searchParams.set('resourceType', 'top_up_order')");
    expect(ordersPage).toContain("searchParams.set('resourceId', orderId)");
    expect(ordersPage).toContain('to={buildOrderAuditUrl(orderDetail.id)}');
    expect(ordersPage).toContain("t('admin.orders.detail.viewAudit'");

    expect(auditPage).toContain("import { useSearchParams } from 'react-router'");
    expect(auditPage).toContain('const [searchParams] = useSearchParams();');
    expect(auditPage).toContain('const [resourceTypeFilter, setResourceTypeFilter] = useState(');
    expect(auditPage).toContain("searchParams.get('resourceType') ?? ''");
    expect(auditPage).toContain('const [resourceIdFilter, setResourceIdFilter] = useState(');
    expect(auditPage).toContain("searchParams.get('resourceId') ?? ''");
  });
});
