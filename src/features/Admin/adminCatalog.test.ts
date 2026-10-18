import { ADMIN_CAPABILITIES } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  getAdminCatalogAccessCapabilities,
} from './adminCatalog';

describe('adminCatalog', () => {
  it('defines the approved nine admin groups in order', () => {
    expect(ADMIN_CATALOG_GROUPS.map((group) => group.key)).toEqual([
      'workbench',
      'user-support',
      'finance-commerce',
      'ai-platform',
      'module-ecosystem',
      'content-ops',
      'client-release',
      'platform-ops',
      'audit-compliance',
    ]);
  });

  it('keeps route IDs, segments, and paths unique', () => {
    expect(new Set(ADMIN_CATALOG.map((item) => item.id)).size).toBe(ADMIN_CATALOG.length);
    expect(new Set(ADMIN_CATALOG.map((item) => item.segment)).size).toBe(ADMIN_CATALOG.length);
    expect(new Set(ADMIN_CATALOG.map((item) => item.path)).size).toBe(ADMIN_CATALOG.length);
  });

  it('assigns default-setting pages to the responsible admin domains', () => {
    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(byId['ai-runtime-defaults']).toMatchObject({
      group: 'platform-ops',
      segment: 'ai-runtime-defaults',
    });
    expect(byId['user-defaults']).toMatchObject({
      group: 'user-support',
      segment: 'user-defaults',
    });
    expect(byId.integrations).toMatchObject({
      group: 'platform-ops',
      segment: 'integrations',
    });
    expect(byId.mobile).toMatchObject({
      backendDomains: ['settings'],
      description: '统一管理移动端品牌、底部导航、发现内容、应用入口与配置发布',
      group: 'platform-ops',
      label: '移动端控制中心',
      owner: 'client',
      path: '/settings/admin/mobile',
      readCapability: ADMIN_CAPABILITIES.systemRead,
      segment: 'mobile',
      status: 'active',
      writeCapabilities: [ADMIN_CAPABILITIES.systemWrite],
    });
  });

  it('publishes the desktop release surface as an active standalone group entry', () => {
    const desktop = ADMIN_CATALOG.find(({ id }) => id === 'desktop-update');
    expect(desktop).toMatchObject({
      description: '统一管理桌面安装、版本、客户端状态和更新设置',
      label: '桌面端发版',
      status: 'active',
    });
    expect(ADMIN_CATALOG_GROUPS.find(({ key }) => key === 'client-release')?.label).toBe(
      '桌面端发版',
    );
  });

  // 方案 §2.2 的 25 个子栏目归属表。B6 只加数据不改渲染，但归属一旦写错，
  // B7 的选中态解析与 B8 的接线都会指错地方，因此在此逐条锁定。
  it('assigns every catalog item to the sub-section agreed in the IA plan', () => {
    const EXPECTED: Record<string, string> = {
      'ai-runtime-defaults': 'platform-runtime',
      'audit': 'audit-log',
      'content-operations': 'content-operations',
      'content-resources': 'content-resources',
      'credits': 'finance-accounts',
      'desktop-update': 'client-desktop',
      'file-storage': 'platform-infra',
      'growth': 'content-growth',
      'integrations': 'platform-infra',
      'maintenance': 'platform-maintenance',
      'mobile': 'platform-brand',
      'model-billing-matrix': 'ai-catalog',
      'model-defaults': 'ai-catalog',
      'model-policy': 'ai-catalog',
      'modules': 'module-catalog',
      'orders': 'finance-products',
      // payments 是 compatibility 状态、不进侧栏，但仍归属 finance-settlement。
      'payments': 'finance-settlement',
      'plans': 'finance-products',
      'ppt': 'ai-generate',
      'providers': 'ai-sources',
      'redemption': 'finance-settlement',
      'settings': 'platform-brand',
      'stats': 'finance-analytics',
      'subscriptions': 'finance-accounts',
      'user-defaults': 'user-support-defaults',
      'users': 'user-support-identity',
    };

    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(ADMIN_CATALOG.every((item) => Boolean(item.subSection))).toBe(true);

    for (const [id, subSection] of Object.entries(EXPECTED)) {
      expect(byId[id]?.subSection).toBe(subSection);
    }
  });

  // 编译期只保证 iconMap 满足 Record<AdminNavIcon, …>，反向（联合类型里有、
  // map 里漏了）不会报错，只会在 B8 渲染时静默取到 undefined。把这条双向零
  // 差集变成可回归的运行时断言。
  it('keeps the nav icon union and the icon map in exact agreement', async () => {
    const { iconMap } = await import('./Sidebar/navigation');
    const declaredIcons = [
      'audit',
      'billing',
      'credits',
      'desktop',
      'documents',
      'expert-plaza',
      'file-storage',
      'files',
      'growth',
      'maintenance',
      'mobile',
      'models',
      'notifications',
      'orders',
      'overview',
      'plans',
      'plugins',
      'ppt',
      'pricing',
      'providers',
      'redemption',
      'recommendations',
      'settings',
      'stats',
      'subscriptions',
      'system-defaults',
      'topup',
      'topics',
      'users',
      'module-catalog',
      'module-finance',
      'module-operations',
      'module-audit',
      'content-growth',
    ];

    expect(Object.keys(iconMap).sort()).toEqual([...declaredIcons].sort());
  });

  it('assigns read capabilities to high-risk domains', () => {
    const byId = Object.fromEntries(ADMIN_CATALOG.map((item) => [item.id, item]));

    expect(byId.users.readCapability).toBe(ADMIN_CAPABILITIES.userRead);
    expect(byId.providers.readCapability).toBe(ADMIN_CAPABILITIES.modelOpsRead);
    expect(byId['content-resources'].readCapability).toBe(ADMIN_CAPABILITIES.contentRead);
    expect(byId['content-operations'].readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId.settings.readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId['model-policy'].readCapability).toBe(ADMIN_CAPABILITIES.systemRead);
    expect(byId['model-policy'].writeCapabilities).toEqual([ADMIN_CAPABILITIES.systemWrite]);
    expect(getAdminCatalogAccessCapabilities(byId['model-billing-matrix'])).toEqual([
      ADMIN_CAPABILITIES.modelOpsRead,
      ADMIN_CAPABILITIES.financeRead,
      ADMIN_CAPABILITIES.systemRead,
    ]);
    expect(getAdminCatalogAccessCapabilities(byId.payments)).toEqual([
      ADMIN_CAPABILITIES.systemRead,
      ADMIN_CAPABILITIES.financeRead,
    ]);
    expect(byId.payments.writeCapabilities).toEqual([
      ADMIN_CAPABILITIES.systemWrite,
      ADMIN_CAPABILITIES.financeWrite,
    ]);
    const moduleApps = ADMIN_CATALOG.find((item) => item.id === 'modules');
    expect(moduleApps?.readCapability).toBe(ADMIN_CAPABILITIES.moduleAppRead);
    expect(moduleApps?.segment).toBe('modules');
    expect(moduleApps?.accessCapabilities).toEqual([
      ADMIN_CAPABILITIES.moduleAppRead,
      ADMIN_CAPABILITIES.financeRead,
    ]);
    // IA 重设计步骤 2：模块生态转 active，写能力剔除只读的 auditRead。
    expect(moduleApps?.status).toBe('active');
    expect(moduleApps?.writeCapabilities).toEqual([
      ADMIN_CAPABILITIES.moduleAppWrite,
      ADMIN_CAPABILITIES.financeWrite,
    ]);
  });
});
