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
    const settingsRouter = readRepoFile('src/business/server/lambda-routers/admin/settings.ts');
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
    const providersPage = readRepoFile('src/features/Admin/AdminNewapiProvidersPage.tsx');
    const settingsPage = readRepoFile('src/features/Admin/AdminSettingsPage.tsx');

    expect(matrixPage).not.toContain('暂无已启用的 NewAPI 模型');
    expect(providersPage).not.toContain('配置多个 NewAPI 上游实例');
    expect(settingsPage).not.toContain('使用 NewAPI 转站');
    expect(settingsPage).not.toContain('使用 NewAPI 图像模型');
    expect(settingsPage).not.toContain('使用 NewAPI 视频模型');
    expect(matrixPage).toContain('暂无已启用的服务商模型');
    expect(providersPage).toContain('配置多个服务商上游实例');
    expect(settingsPage).toContain('使用服务商网关时填写对应供应商标识');
  });
});
