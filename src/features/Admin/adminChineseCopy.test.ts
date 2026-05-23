import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import subscription from '@/locales/default/subscription';

import { ADMIN_NAV_GROUPS } from './adminNavigation';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

const filesWithAdminCopy = [
  'src/features/Admin/adminNavigation.ts',
  'src/features/Admin/AdminDesktopUpdatePage.tsx',
  'src/features/Admin/AdminUserDetailDrawer.tsx',
  'src/routes/(main)/admin/audit/index.tsx',
  'src/routes/(main)/admin/subscriptions/index.tsx',
  'src/routes/(main)/admin/topup/index.tsx',
  'src/routes/(main)/admin/redemption/index.tsx',
  'src/routes/(main)/admin/notifications/index.tsx',
  'src/routes/(main)/admin/users/index.tsx',
  'src/features/Admin/AdminContentPages.tsx',
  'src/features/Admin/AdminExpertPlazaPage.tsx',
  'src/features/Admin/AdminSystemDefaultsPage.tsx',
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
  it('does not ship corrupted fallback text in admin pages', () => {
    for (const file of filesWithAdminCopy) {
      const content = readRepoFile(file);
      for (const fragment of corruptedFragments) {
        expect(content, `${file} contains ${fragment}`).not.toContain(fragment);
      }
    }
  });

  it('uses readable Chinese navigation labels for billing pages', () => {
    const userPlanItems = ADMIN_NAV_GROUPS.find((group) => group.key === 'user-plan')?.items ?? [];

    expect(userPlanItems.find((item) => item.path.endsWith('/subscriptions'))).toMatchObject({
      label: '订阅管理',
    });
    expect(userPlanItems.find((item) => item.path.endsWith('/redemption'))).toMatchObject({
      label: '兑换码',
    });
    expect(userPlanItems.find((item) => item.path.endsWith('/orders'))).toMatchObject({
      label: '订单与充值',
    });
  });

  it('keeps legacy sidebar fallback labels aligned with the merged admin navigation', () => {
    expect(subscription['admin.sidebar.orders']).toBe('订单与充值');
    expect(subscription['admin.sidebar.topup']).toBe('充值入口已合并');
    expect(subscription['admin.sidebar.pricing']).toBe('模型与计费矩阵');
  });

  it('keeps subscription customer-facing business pages in Chinese', () => {
    expect(subscription['tab.plans']).toBe('套餐');
    expect(subscription['tab.usage']).toBe('用量');
    expect(subscription['tab.credits']).toBe('积分');
    expect(subscription['tab.billing']).toBe('账单');
    expect(subscription['tab.referral']).toBe('推荐奖励');

    expect(subscription['billing.history']).toBe('账单记录');
    expect(subscription['credits.ledger.empty']).toBe('暂无积分流水');
    expect(subscription['plans.current']).toBe('当前套餐');
    expect(subscription['payment.success.title']).toBe('订阅成功');
    expect(subscription['referral.stats.title']).toBe('推荐概览');
    expect(subscription['usage.title']).toBe('本月用量');

    for (const key of [
      'billing.history',
      'credits.ledger.empty',
      'plans.current',
      'referral.stats.title',
      'usage.title',
    ] as const) {
      expect(subscription[key]).not.toContain('????');
    }
  });

  it('keeps recommendation admin locale labels in Chinese', () => {
    expect(subscription['admin.recommendations.enabled']).toBe('启用推荐模块');
    expect(subscription['admin.recommendations.criteria']).toBe('推荐条件');
    expect(subscription['admin.recommendations.selectedTags']).toBe('用户选择标签');
    expect(subscription['admin.recommendations.assistantsEnabled']).toBe('显示推荐助手');
    expect(subscription['admin.recommendations.assistantTags']).toBe('助手标签/分类');
    expect(subscription['admin.recommendations.mcpsEnabled']).toBe('显示推荐 MCP/工具');
    expect(subscription['admin.recommendations.mcpCategories']).toBe('MCP 分类');
    expect(subscription['admin.recommendations.skillsEnabled']).toBe('显示推荐技能');
    expect(subscription['admin.recommendations.skillCategories']).toBe('推荐技能分类');
    expect(subscription['admin.recommendations.generalSkillsEnabled']).toBe('显示通用技能');
    expect(subscription['admin.recommendations.generalSkillCategories']).toBe('通用技能分类');
    expect(subscription['admin.recommendations.hotSkillsEnabled']).toBe('显示热门技能');
    expect(subscription['admin.recommendations.hotSkillSort']).toBe('热门技能排序');
    expect(subscription['admin.recommendations.saveSuccess']).toBe('推荐配置已保存');
    expect(subscription['admin.recommendations.saveFailed']).toBe('保存失败');
  });

  it('keeps operations growth orders and settings locale labels in Chinese', () => {
    expect(subscription['admin.orders.actionSuccess']).toBe('订单已更新');
    expect(subscription['admin.orders.cancel']).toBe('取消订单');
    expect(subscription['admin.orders.col.amount']).toBe('金额');
    expect(subscription['admin.orders.loadMore']).toBe('加载更多');

    expect(subscription['admin.operations.bannerSection']).toBe('社区横幅');
    expect(subscription['admin.operations.featuredSection']).toBe('精选模块');
    expect(subscription['admin.operations.saveSuccess']).toBe('运营配置已保存');

    expect(subscription['admin.growth.signupSection']).toBe('注册');
    expect(subscription['admin.growth.initialCredits']).toBe('初始积分');
    expect(subscription['admin.growth.uploadSection']).toBe('上传限制');

    expect(subscription['admin.settings']).toBe('设置');
    expect(subscription['admin.settings.title']).toBe('站点与 API 设置');
    expect(subscription['admin.settings.save']).toBe('保存');
    expect(subscription['admin.settings.noChanges']).toBe('没有需要保存的变更');
    expect(subscription['admin.settings.brandName.help']).toBe(
      '用于页面标题、导航、关于页面和站内品牌展示。',
    );
    expect(subscription['admin.settings.defaultSkillName.help']).toBe(
      '用于配置内置默认技能的显示名称；留空时使用品牌名称。',
    );
    expect(subscription['admin.settings.defaultProvider.help']).toBe(
      '使用服务商网关时填写对应供应商标识，例如 openai、deepseek、aliyun 或自定义兼容服务商。该值会写入后台默认助手配置。',
    );
    expect(subscription['admin.settings.defaultImageProvider.help']).toBe(
      '用于 image 页面初始化。请填写图像模型所属服务商标识，例如 openai、google、aliyun 或自定义兼容服务商。',
    );
    expect(subscription['admin.settings.defaultVideoProvider.help']).toBe(
      '用于 video 页面初始化。请填写视频模型所属服务商标识，例如 google、aliyun 或自定义兼容服务商。',
    );
  });

  it('keeps default admin desktop update labels in Chinese', () => {
    expect(subscription['admin.sidebar.desktopUpdate']).toBe('桌面端更新');
    expect(subscription['admin.desktopUpdate.serverSection']).toBe('更新服务器');
    expect(subscription['admin.desktopUpdate.channel']).toBe('默认更新渠道');
    expect(subscription['admin.desktopUpdate.save']).toBe('保存');
  });

  it('includes default Chinese copy for provider instance management', () => {
    expect(subscription['admin.providers.createInstance']).toBe('新建实例');
    expect(subscription['admin.providers.empty']).toBe('暂未配置服务商实例');
    expect(subscription['admin.providers.field.providerType']).toBe('服务商类型');
    expect(subscription['admin.providers.field.providerTypeNewapiHint']).toBe(
      '该类型支持同步模型和价格。',
    );
    expect(subscription['admin.providers.models.bulkAddHint']).toBe(
      '可批量添加模型 ID，使用换行或逗号分隔。',
    );
    expect(subscription['admin.providers.sync.success']).toBe(
      '同步完成：导入 {{count}} 个模型，新模型默认未启用',
    );
    expect(subscription['admin.providers.test.failed']).toBe('连接失败：{{error}}');
    expect(subscription['admin.providers.col.providerType']).toBe('服务商');
  });

  it('keeps redemption filters in Chinese', () => {
    const redemptionPage = readRepoFile('src/routes/(main)/admin/redemption/index.tsx');

    expect(redemptionPage).not.toContain("'Batch ID'");
    expect(redemptionPage).toContain("t('admin.redemption.filter.batch', '批次 ID')");
  });

  it('includes default Chinese copy for assigning user plans from the user list', () => {
    const usersPage = readRepoFile('src/routes/(main)/admin/users/index.tsx');

    expect(subscription['admin.assignPlan']).toBe('设置套餐');
    expect(subscription['admin.assignPlan.title']).toBe('设置用户套餐');
    expect(subscription['admin.assignPlan.durationMonths']).toBe('使用时长（月）');
    expect(usersPage).toContain("t('admin.assignPlan', '设置套餐')");
    expect(usersPage).toContain('adminCommercialService.assignUserPlan');
    expect(usersPage).toContain("t('admin.impersonate', '以用户身份登录')");
  });

  it('includes readable copy for content governance and system defaults pages', () => {
    const navigation = readRepoFile('src/features/Admin/adminNavigation.ts');
    const contentPages = readRepoFile('src/features/Admin/AdminContentPages.tsx');
    const expertPlazaPage = readRepoFile('src/features/Admin/AdminExpertPlazaPage.tsx');
    const systemDefaultsPage = readRepoFile('src/features/Admin/AdminSystemDefaultsPage.tsx');

    expect(navigation).toContain("label: '内容治理'");
    expect(navigation).toContain("label: '系统默认值'");
    expect(contentPages).toContain('话题管理');
    expect(contentPages).toContain('资源文件管理');
    expect(contentPages).toContain('用户文稿管理');
    expect(expertPlazaPage).toContain('专家广场配置已保存');
    expect(systemDefaultsPage).toContain('服务模型默认设置 JSON');
    expect(systemDefaultsPage).toContain('默认禁用的内置技能/工具');
  });

  it('refreshes public profile options after avatar presets are saved', () => {
    const systemDefaultsPage = readRepoFile('src/features/Admin/AdminSystemDefaultsPage.tsx');

    expect(systemDefaultsPage).toContain('PROFILE_OPTIONS_SWR_KEY');
  });

  it('keeps admin and public SWR cache keys centralized', () => {
    const systemDefaultsPage = readRepoFile('src/features/Admin/AdminSystemDefaultsPage.tsx');
    const expertPlazaAdminPage = readRepoFile('src/features/Admin/AdminExpertPlazaPage.tsx');
    const expertPlazaPage = readRepoFile('src/features/ExpertPlaza/index.tsx');
    const navLayout = readRepoFile('src/hooks/useNavLayout.ts');

    expect(systemDefaultsPage).toContain('ADMIN_SETTINGS_SWR_KEY');
    expect(expertPlazaAdminPage).toContain('PUBLIC_EXPERT_PLAZA_SWR_KEY');
    expect(expertPlazaPage).toContain('PUBLIC_EXPERT_PLAZA_SWR_KEY');
    expect(navLayout).toContain('PUBLIC_EXPERT_PLAZA_SWR_KEY');
    expect(navLayout).toContain('SidebarTabKey.Ppt');
    expect(navLayout).toContain('SidebarTabKey.Experts');
    expect(navLayout).toContain('expertPlaza.enabled');
  });

  it('keeps the user detail drawer labels in Chinese for plan assignment and history tables', () => {
    const userDetailDrawer = readRepoFile('src/features/Admin/AdminUserDetailDrawer.tsx');

    expect(userDetailDrawer).toContain("t('admin.userDetail.assignPlan', '给用户分配套餐')");
    expect(userDetailDrawer).toContain("t('admin.userDetail.endTime', '结束时间')");
    expect(userDetailDrawer).toContain("t('admin.userDetail.ledgerType', '类型')");
    expect(userDetailDrawer).toContain("t('admin.userDetail.orderId', 'ID')");
  });
});
