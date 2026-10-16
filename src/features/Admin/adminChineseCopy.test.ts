import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import subscription from '@/locales/default/subscription';

import { ADMIN_NAV_GROUPS } from './adminNavigation';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');
const zhCNSubscription = JSON.parse(readRepoFile('locales/zh-CN/subscription.json')) as Record<
  string,
  string
>;
const zhCNCommon = JSON.parse(readRepoFile('locales/zh-CN/common.json')) as Record<string, string>;

const filesWithAdminCopy = [
  'src/features/Admin/adminCatalog.ts',
  'src/features/Admin/adminNavigation.ts',
  'src/features/Admin/AdminDesktopUpdatePage.tsx',
  'src/features/Admin/AdminUserDetailDrawer.tsx',
  'src/features/Admin/Audit/AdminAuditPage.tsx',
  'src/routes/(main)/admin/subscriptions/index.tsx',
  'src/routes/(main)/admin/redemption/index.tsx',
  'src/routes/(main)/admin/users/index.tsx',
  'src/features/Admin/AdminFileStoragePage.tsx',
  'src/features/Admin/AdminNotificationsPage.tsx',
  'src/features/Admin/AdminSystemMaintenancePage.tsx',
  'src/features/Admin/Content/ContentPage.tsx',
  'src/features/Admin/AdminExpertPlazaPage.tsx',
  'src/features/Admin/AdminDefaultSettingsPage.tsx',
  'src/features/Admin/AdminPlanFaqCard.tsx',
];

const corruptedFragments = [
  '????',
  '???',
  '閳?',
  '閸忔娊鏁?',
  '缁狅紕鎮?',
  '濡楀矂娼?',
  '婵傛',
  '鐠併垽',
  '閹垮秳缍?',
  '閻劍鍩?',
];

describe('admin Chinese copy', () => {
  it('keeps Module Center navigation labels in Simplified Chinese', () => {
    expect(zhCNCommon['moduleApps.admin.center.navigation.label']).toBe('模块中心分区');
    expect(zhCNCommon['moduleApps.admin.center.navigation.apps']).toBe('应用');
    expect(zhCNCommon['moduleApps.admin.center.navigation.finance']).toBe('财务');
    expect(zhCNCommon['moduleApps.admin.center.navigation.operations']).toBe('运维');
    expect(zhCNCommon['moduleApps.admin.center.navigation.audit']).toBe('审计');
  });

  it('does not ship corrupted fallback text in admin pages', () => {
    for (const file of filesWithAdminCopy) {
      const content = readRepoFile(file);
      for (const fragment of corruptedFragments) {
        expect(content, `${file} contains ${fragment}`).not.toContain(fragment);
      }
    }
  });

  it('uses readable Chinese navigation labels for billing pages', () => {
    const commercialItems =
      ADMIN_NAV_GROUPS.find((group) => group.key === 'finance-commerce')?.items ?? [];

    expect(commercialItems.find((item) => item.path.endsWith('/subscriptions'))).toMatchObject({
      label: '订阅管理',
    });
    expect(commercialItems.find((item) => item.path.endsWith('/redemption'))).toMatchObject({
      label: '兑换码',
    });
    expect(commercialItems.find((item) => item.path.endsWith('/orders'))).toMatchObject({
      label: '订单与充值套餐',
    });
    // IA 重设计步骤 6：积分页无流水列表，标签与描述不得再承诺「流水」。
    expect(commercialItems.find((item) => item.path.endsWith('/credits'))).toMatchObject({
      description: '查看积分账户余额，支持排序、筛选与导出',
      label: '积分账户',
    });
  });

  it('keeps legacy sidebar fallback labels aligned with the merged admin navigation', () => {
    expect(subscription['admin.sidebar.orders']).toBe('Orders and top-up');
    expect(subscription['admin.sidebar.topup']).toBe('Top-up entry merged');
    expect(subscription['admin.sidebar.pricing']).toBe('Models and billing matrix');
  });

  it('keeps subscription customer-facing business pages in Chinese', () => {
    expect(zhCNSubscription['mobile.tabs.ariaLabel']).toBe('商业设置');
    expect(zhCNSubscription['tab.plans']).toBe('套餐');
    expect(zhCNSubscription['tab.usage']).toBe('用量');
    expect(zhCNSubscription['tab.credits']).toBe('积分');
    expect(zhCNSubscription['tab.billing']).toBe('账单');
    expect(zhCNSubscription['tab.referral']).toBe('推荐奖励');

    expect(zhCNSubscription['billing.history']).toBe('账单记录');
    expect(zhCNSubscription['credits.ledger.empty']).toBe('暂无积分流水');
    expect(zhCNSubscription['plans.current']).toBe('当前套餐');
    expect(zhCNSubscription['payment.success.title']).toBe('订阅成功');
    expect(zhCNSubscription['referral.stats.title']).toBe('推荐概览');
    expect(zhCNSubscription['usage.title']).toBe('本月用量');

    for (const key of [
      'billing.history',
      'credits.ledger.empty',
      'plans.current',
      'referral.stats.title',
      'usage.title',
    ] as const) {
      expect(zhCNSubscription[key]).not.toContain('????');
    }
  });

  it('keeps recommendation admin locale labels in Chinese', () => {
    expect(subscription['admin.recommendations.enabled']).toBe('Enable recommendation module');
    expect(subscription['admin.recommendations.criteria']).toBe('Recommendation criteria');
    expect(subscription['admin.recommendations.selectedTags']).toBe('Selected user tags');
    expect(subscription['admin.recommendations.assistantsEnabled']).toBe(
      'Show recommended assistants',
    );
    expect(subscription['admin.recommendations.assistantTags']).toBe('Assistant tags/categories');
    expect(subscription['admin.recommendations.mcpsEnabled']).toBe('Show recommended MCP/tools');
    expect(subscription['admin.recommendations.mcpCategories']).toBe('MCP categories');
    expect(subscription['admin.recommendations.skillsEnabled']).toBe('Show recommended skills');
    expect(subscription['admin.recommendations.skillCategories']).toBe(
      'Recommended skill categories',
    );
    expect(subscription['admin.recommendations.generalSkillsEnabled']).toBe('Show general skills');
    expect(subscription['admin.recommendations.generalSkillCategories']).toBe(
      'General skill categories',
    );
    expect(subscription['admin.recommendations.hotSkillsEnabled']).toBe('Show hot skills');
    expect(subscription['admin.recommendations.hotSkillSort']).toBe('Hot skills sort order');
    expect(subscription['admin.recommendations.saveSuccess']).toBe('Recommendation settings saved');
    expect(subscription['admin.recommendations.saveFailed']).toBe('Save failed');
  });

  it('keeps operations growth orders and settings locale labels in Chinese', () => {
    expect(subscription['admin.orders.actionSuccess']).toBe('Order updated');
    expect(subscription['admin.orders.cancel']).toBe('Cancel order');
    expect(subscription['admin.orders.col.amount']).toBe('Amount');
    expect(subscription['admin.orders.detail.title']).toBe('Order details');
    expect(subscription['admin.orders.detail.redemptionCode']).toBe('Linked redemption code');
    expect(subscription['admin.orders.detail.auditHint']).toBe(
      'To trace admin actions, search the audit log by order ID.',
    );
    expect(subscription['admin.orders.detail.viewAudit']).toBe('View audit log');
    expect(subscription['admin.orders.loadMore']).toBe('Load more');
    expect(subscription['admin.orders.settle']).toBe('Manual settle');
    expect(subscription['admin.orders.settleConfirm']).toBe('Manually settle this pending order?');
    expect(subscription['admin.orders.settleConfirmDescription']).toBe(
      'This marks the order as paid and grants credits. Please verify the details below.',
    );

    expect(subscription['admin.operations.bannerSection']).toBe('Community banner');
    expect(subscription['admin.operations.featuredSection']).toBe('Featured modules');
    expect(subscription['admin.operations.saveSuccess']).toBe('Operations settings saved');

    expect(subscription['admin.growth.signupSection']).toBe('Sign-up');
    expect(subscription['admin.growth.initialCredits']).toBe('Initial credits');
    expect(subscription['admin.growth.uploadSection']).toBe('Upload limits');

    expect(subscription['admin.settings']).toBe('Settings');
    expect(subscription['admin.settings.title']).toBe('Site settings');
    expect(subscription['admin.settings.save']).toBe('Save');
    expect(subscription['admin.settings.noChanges']).toBe('No changes to save');
    expect(subscription['admin.settings.brandName.help']).toBe(
      'Used for the page title, navigation, About page, and in-site brand display.',
    );
    expect(subscription['admin.settings.defaultSkillName.help']).toBe(
      'Display name of the built-in default skill; falls back to the brand name when left blank.',
    );
    expect(subscription['admin.settings.defaultModel.help']).toBe(
      'Maintain the default model, model plan access, and model billing in the model and billing matrix.',
    );
    expect(subscription['admin.settings.defaultProvider.help']).toBe(
      'The default model provider has been migrated to the model and billing matrix.',
    );
    expect(subscription['admin.settings.defaultImageProvider.help']).toBe(
      'The default image model provider has been migrated to the model and billing matrix.',
    );
    expect(subscription['admin.settings.defaultVideoProvider.help']).toBe(
      'The default video model provider has been migrated to the model and billing matrix.',
    );
  });

  it('keeps default admin desktop update labels in Chinese', () => {
    expect(subscription['admin.sidebar.desktopUpdate']).toBe('Desktop Control Center');
    expect(subscription['admin.desktopUpdate.businessSection']).toBe('Desktop Business Connection');
    expect(subscription['admin.desktopUpdate.serverSection']).toBe('Update Service');
    expect(subscription['admin.desktopUpdate.downloadSection']).toBe('Client Download Entry');
    expect(subscription['admin.desktopUpdate.channel']).toBe('Default update channel');
    expect(subscription['admin.desktopUpdate.save']).toBe('Save');
  });

  it('includes default Chinese copy for provider instance management', () => {
    expect(subscription['admin.providers.createInstance']).toBe('Create instance');
    expect(subscription['admin.providers.empty']).toBe('No provider instances configured yet');
    expect(subscription['admin.providers.field.providerType']).toBe('Provider type');
    expect(subscription['admin.providers.field.providerTypeNewapiHint']).toBe(
      'AI provider gateways support syncing models and pricing.',
    );
    expect(subscription['admin.providers.field.upstreamPricing']).toBe('Sync upstream pricing');
    expect(subscription['admin.providers.field.lobeHubOfficialPricing']).toBe(
      'Use LobeHub official pricing',
    );
    expect(subscription['admin.providers.field.modelBankFallback']).toBe(
      'Use system pricing by model name',
    );
    expect(subscription['admin.providers.models.bulkAddHint']).toBe(
      'You can add model IDs in bulk, separated by line breaks or commas.',
    );
    expect(subscription['admin.providers.sync.success']).toBe(
      'Sync complete: deleted {{deletedCount}} old models and imported {{count}} new models; synchronized {{pricingCount}} prices and capability data for {{abilitiesCount}} models. New models are disabled.',
    );
    expect(subscription['admin.providers.test.failed']).toBe('Connection failed: {{error}}');
    expect(subscription['admin.providers.col.providerType']).toBe('Provider');
  });

  it('keeps redemption filters in Chinese', () => {
    const redemptionPage = readRepoFile('src/routes/(main)/admin/redemption/index.tsx');

    expect(redemptionPage).not.toContain("'Batch ID'");
    expect(redemptionPage).toContain("t('admin.redemption.filter.batch', '批次 ID')");
  });

  it('includes default Chinese copy for redemption bulk action flow', () => {
    expect(subscription['admin.bulkAction.count']).toBe('{{count}} items will be processed.');
    expect(subscription['admin.bulkAction.progress']).toBe(
      'Running bulk action. Keep this page open.',
    );
    expect(subscription['admin.bulkAction.done']).toBe('Bulk action completed');
    expect(subscription['admin.redemption.bulkDisableProgress']).toBe(
      'Disabling selected redemption codes. Keep this page open.',
    );
    expect(subscription['admin.redemption.bulkDeleteProgress']).toBe(
      'Deleting selected unredeemed codes. Keep this page open.',
    );
    expect(subscription['admin.changeRequests.bulkApproveProgress']).toBe(
      'Approving selected subscription change requests. Keep this page open.',
    );
    expect(subscription['admin.changeRequests.bulkRejectProgress']).toBe(
      'Rejecting selected subscription change requests. Keep this page open.',
    );
  });

  it('includes default Chinese copy for the M5 three-domain batch actions', () => {
    expect(subscription['admin.orders.bulkExpire']).toBe('Bulk expire');
    expect(subscription['admin.orders.bulkExpireTitle']).toBe('Expire {{count}} pending orders?');
    expect(subscription['admin.orders.bulkCancel']).toBe('Bulk cancel');
    expect(subscription['admin.orders.bulkDryRun']).toBe('Dry run');
    expect(subscription['admin.users.bulkBan']).toBe('Bulk ban');
    expect(subscription['admin.users.bulkSetRole']).toBe('Bulk set role');
    expect(subscription['admin.users.clearSelection']).toBe('Clear selection');
    expect(subscription['admin.payments.topups.bulkRefund']).toBe('Bulk refund');
    expect(subscription['admin.payments.subscriptions.bulkRefund']).toBe('Bulk refund');
  });

  it('includes default Chinese copy for assigning user plans from the user list', () => {
    // B2 拆分：users 列定义（含 assignPlan/impersonate 文案）迁入 Users/ 域目录，
    // readRepoFile 直读路径与断言同 PR 成对迁移。
    const usersPage =
      readRepoFile('src/routes/(main)/admin/users/index.tsx') +
      readRepoFile('src/features/Admin/Users/userColumns.tsx');

    expect(subscription['admin.assignPlan']).toBe('Set plan');
    expect(subscription['admin.assignPlan.title']).toBe('Set User Plan');
    expect(subscription['admin.assignPlan.durationMonths']).toBe('Duration (months)');
    expect(usersPage).toContain("t('admin.assignPlan', '设置套餐')");
    expect(usersPage).toContain('adminCommercialService.assignUserPlan');
    expect(usersPage).toContain("t('admin.impersonate', '以用户身份登录')");
  });

  it('includes readable copy for content governance and system defaults pages', () => {
    const catalog = readRepoFile('src/features/Admin/adminCatalog.ts');
    const contentPages = readRepoFile('src/features/Admin/Content/shared.tsx');
    const expertPlazaPage = readRepoFile('src/features/Admin/AdminExpertPlazaPage.tsx');
    const systemDefaultsPage = readRepoFile('src/features/Admin/DefaultSettings/SectionFields.tsx');
    const systemDefaultsShared = readRepoFile('src/features/Admin/DefaultSettings/shared.ts');

    expect(catalog).toContain("label: '内容与曝光运营'");
    expect(catalog).toContain("label: 'AI 运行时默认值'");
    expect(contentPages).toContain('话题管理');
    expect(contentPages).toContain('资源文件管理');
    expect(contentPages).toContain('用户文稿管理');
    expect(expertPlazaPage).toContain('专家广场配置已保存');
    expect(systemDefaultsPage).toContain('服务模型默认设置 JSON');
    expect(systemDefaultsShared).toContain('默认助手模型');
    expect(systemDefaultsPage).toContain('提示词改写模型');
    expect(systemDefaultsPage).toContain('默认禁用的内置技能/工具');
  });

  it('refreshes public profile options after avatar presets are saved', () => {
    const systemDefaultsPage = readRepoFile('src/features/Admin/AdminDefaultSettingsPage.tsx');

    expect(systemDefaultsPage).toContain('PROFILE_OPTIONS_SWR_KEY');
  });

  it('keeps admin and public SWR cache keys centralized', () => {
    const systemDefaultsPage = readRepoFile('src/features/Admin/AdminDefaultSettingsPage.tsx');
    const expertPlazaAdminPage = readRepoFile('src/features/Admin/AdminExpertPlazaPage.tsx');
    const expertPlazaPage = readRepoFile('src/features/ExpertPlaza/index.tsx');
    const navLayout = readRepoFile('src/hooks/useNavLayout.ts');

    expect(systemDefaultsPage).toContain('ADMIN_SETTINGS_SECTION_SWR_KEY(scope)');
    expect(expertPlazaAdminPage).toContain('PUBLIC_EXPERT_PLAZA_SWR_KEY');
    expect(expertPlazaPage).toContain('PUBLIC_EXPERT_PLAZA_SWR_KEY');
    expect(navLayout).toContain('PUBLIC_EXPERT_PLAZA_SWR_KEY');
    expect(navLayout).toContain('SidebarTabKey.Ppt');
    expect(navLayout).toContain('SidebarTabKey.Experts');
    expect(navLayout).toContain('expertPlaza.enabled');
  });

  it('keeps the user detail drawer labels in Chinese for plan assignment and history tables', () => {
    const userDetailDrawer = readRepoFile('src/features/Admin/AdminUserDetailDrawer.tsx');
    const detailSections = readRepoFile('src/features/Admin/UserDetail/DetailSections.tsx');

    expect(userDetailDrawer).toContain("t('admin.userDetail.assignPlan', '给用户分配套餐')");
    expect(detailSections).toContain("t('admin.userDetail.endTime', '结束时间')");
    expect(detailSections).toContain("t('admin.userDetail.ledgerType', '类型')");
    expect(detailSections).toContain("t('admin.userDetail.orderId', 'ID')");
  });
});
