import { describe, expect, it } from 'vitest';

import {
  ADMIN_BASE_PATH,
  ADMIN_NAV_GROUPS,
  canAccessAdminPath,
  filterAdminNavGroups,
  filterAdminNavSections,
  getAdminActiveLeafKey,
  getAdminDefaultPath,
  getAdminNavGroupsForRole,
  getAdminNavigationContext,
  getAdminNavSectionsForRole,
  getAdminOpenKeys,
  getAdminSelectedKey,
  getAdminUnauthorizedFallbackPath,
} from './adminNavigation';

const collectPaths = () =>
  ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path));

describe('adminNavigation', () => {
  it('filters scoped admin navigation by domain capability', () => {
    const financePaths = getAdminNavGroupsForRole('finance_admin').flatMap((group) =>
      group.items.map((item) => item.path),
    );

    expect(financePaths).toEqual(
      expect.arrayContaining([
        `${ADMIN_BASE_PATH}/subscriptions`,
        `${ADMIN_BASE_PATH}/plans`,
        `${ADMIN_BASE_PATH}/orders`,
        `${ADMIN_BASE_PATH}/credits`,
        `${ADMIN_BASE_PATH}/stats`,
        `${ADMIN_BASE_PATH}/audit`,
        `${ADMIN_BASE_PATH}/modules`,
      ]),
    );
    expect(financePaths).not.toContain(`${ADMIN_BASE_PATH}/users`);
    expect(financePaths).not.toContain(`${ADMIN_BASE_PATH}/providers`);
    expect(financePaths).not.toContain(`${ADMIN_BASE_PATH}/settings`);
  });

  it('resolves safe default pages and rejects cross-domain direct navigation', () => {
    expect(getAdminDefaultPath('finance_admin')).toBe(`${ADMIN_BASE_PATH}/subscriptions`);
    expect(getAdminDefaultPath('support_admin')).toBe(`${ADMIN_BASE_PATH}/users`);
    expect(getAdminDefaultPath('model_ops')).toBe(`${ADMIN_BASE_PATH}/providers`);
    expect(getAdminDefaultPath('module_admin')).toBe(`${ADMIN_BASE_PATH}/modules`);
    expect(getAdminDefaultPath('system_admin')).toBe(`${ADMIN_BASE_PATH}/settings`);
    expect(canAccessAdminPath('finance_admin', `${ADMIN_BASE_PATH}/plans`)).toBe(true);
    expect(canAccessAdminPath('finance_admin', `${ADMIN_BASE_PATH}/settings`)).toBe(false);
    expect(canAccessAdminPath('admin', `${ADMIN_BASE_PATH}/settings`)).toBe(true);
    expect(canAccessAdminPath('user', `${ADMIN_BASE_PATH}/plans`)).toBe(false);
  });

  it.each([
    ['content_admin', `${ADMIN_BASE_PATH}/content-resources`, `${ADMIN_BASE_PATH}/plans`],
    ['finance_admin', `${ADMIN_BASE_PATH}/subscriptions`, `${ADMIN_BASE_PATH}/settings`],
    ['model_ops', `${ADMIN_BASE_PATH}/providers`, `${ADMIN_BASE_PATH}/users`],
    ['module_admin', `${ADMIN_BASE_PATH}/modules`, `${ADMIN_BASE_PATH}/subscriptions`],
    ['support_admin', `${ADMIN_BASE_PATH}/users`, `${ADMIN_BASE_PATH}/providers`],
    ['system_admin', `${ADMIN_BASE_PATH}/settings`, `${ADMIN_BASE_PATH}/credits`],
  ] as const)('keeps %s inside its default domain', (role, allowedPath, deniedPath) => {
    expect(getAdminDefaultPath(role)).toBe(allowedPath);
    expect(canAccessAdminPath(role, allowedPath)).toBe(true);
    expect(canAccessAdminPath(role, deniedPath)).toBe(false);
  });

  it('applies the most-specific Module Center policy to direct navigation', () => {
    expect(canAccessAdminPath('finance_admin', `${ADMIN_BASE_PATH}/modules`)).toBe(true);
    expect(canAccessAdminPath('finance_admin', `${ADMIN_BASE_PATH}/modules/finance/payments`)).toBe(
      true,
    );
    expect(canAccessAdminPath('finance_admin', `${ADMIN_BASE_PATH}/modules/apps`)).toBe(false);
    expect(canAccessAdminPath('content_admin', `${ADMIN_BASE_PATH}/modules`)).toBe(false);
    expect(canAccessAdminPath('module_admin', `${ADMIN_BASE_PATH}/modules/apps`)).toBe(true);
    expect(canAccessAdminPath('module_admin', `${ADMIN_BASE_PATH}/audit`)).toBe(false);
    expect(canAccessAdminPath('module_admin', `${ADMIN_BASE_PATH}/modules/finance/payments`)).toBe(
      false,
    );
  });

  it('returns a safe Module Center fallback for denied deep links', () => {
    expect(
      getAdminUnauthorizedFallbackPath(
        'finance_admin',
        `${ADMIN_BASE_PATH}/modules/apps/app-1/products`,
      ),
    ).toBe(`${ADMIN_BASE_PATH}/modules`);
    expect(
      getAdminUnauthorizedFallbackPath('content_admin', `${ADMIN_BASE_PATH}/modules/apps`),
    ).toBe(`${ADMIN_BASE_PATH}/content-resources`);
  });

  it('organizes admin pages into the planned management modules', () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.key)).toEqual([
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

  it('keeps all visible admin routes reachable without duplicate sidebar paths', () => {
    const paths = collectPaths();

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        ADMIN_BASE_PATH,
        `${ADMIN_BASE_PATH}/users`,
        `${ADMIN_BASE_PATH}/plans`,
        `${ADMIN_BASE_PATH}/orders`,
        `${ADMIN_BASE_PATH}/credits`,
        `${ADMIN_BASE_PATH}/content-operations`,
        `${ADMIN_BASE_PATH}/growth`,
        `${ADMIN_BASE_PATH}/model-policy`,
        `${ADMIN_BASE_PATH}/providers`,
        `${ADMIN_BASE_PATH}/model-billing-matrix`,
        `${ADMIN_BASE_PATH}/ppt`,
        `${ADMIN_BASE_PATH}/modules`,
        `${ADMIN_BASE_PATH}/subscriptions`,
        `${ADMIN_BASE_PATH}/redemption`,
        `${ADMIN_BASE_PATH}/settings`,
        `${ADMIN_BASE_PATH}/stats`,
        `${ADMIN_BASE_PATH}/content-resources`,
        `${ADMIN_BASE_PATH}/file-storage`,
        `${ADMIN_BASE_PATH}/ai-runtime-defaults`,
        `${ADMIN_BASE_PATH}/user-defaults`,
        `${ADMIN_BASE_PATH}/integrations`,
        `${ADMIN_BASE_PATH}/maintenance`,
        `${ADMIN_BASE_PATH}/audit`,
        `${ADMIN_BASE_PATH}/desktop-update`,
        `${ADMIN_BASE_PATH}/mobile`,
      ]),
    );
  });

  it('labels model pricing and policy tasks as part of the model center', () => {
    const modelApiItems =
      ADMIN_NAV_GROUPS.find((group) => group.key === 'ai-platform')?.items ?? [];

    expect(
      modelApiItems.find((item) => item.path === `${ADMIN_BASE_PATH}/model-billing-matrix`),
    ).toMatchObject({
      icon: 'pricing',
    });
    expect(
      modelApiItems.find((item) => item.path === `${ADMIN_BASE_PATH}/model-policy`),
    ).toMatchObject({
      icon: 'models',
    });
  });

  it('describes the model center using current admin concepts', () => {
    const modelApiGroup = ADMIN_NAV_GROUPS.find((group) => group.key === 'ai-platform');
    const providerItem = modelApiGroup?.items.find(
      (item) => item.path === `${ADMIN_BASE_PATH}/providers`,
    );

    expect(providerItem?.icon).toBe('providers');
    expect(ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.icon))).not.toContain(
      'newapi',
    );
    expect(providerItem?.description).not.toContain('NewAPI / OpenAI');
    expect(collectPaths()).not.toContain(`${ADMIN_BASE_PATH}/newapi-providers`);
  });

  it('keeps module apps in the extensibility admin module after platform plugin removal', () => {
    const pluginGroup = ADMIN_NAV_GROUPS.find((group) => group.key === 'module-ecosystem');

    expect(pluginGroup).toMatchObject({
      icon: 'plugins',
    });
    expect(pluginGroup?.items).toContainEqual(
      expect.objectContaining({
        icon: 'plugins',
        path: `${ADMIN_BASE_PATH}/modules`,
      }),
    );
    expect(pluginGroup?.items.map((item) => item.path)).not.toContain(
      `${ADMIN_BASE_PATH}/platform-plugins`,
    );
    expect(getAdminSelectedKey('/settings/admin/platform-plugins')).toBe(ADMIN_BASE_PATH);
    expect(getAdminOpenKeys('/settings/admin/platform-plugins')).toEqual(['workbench']);
    expect(getAdminSelectedKey('/settings/admin/modules')).toBe(`${ADMIN_BASE_PATH}/modules`);
    expect(getAdminSelectedKey('/settings/admin/modules/apps/app-1/products')).toBe(
      `${ADMIN_BASE_PATH}/modules`,
    );
    expect(getAdminSelectedKey('/settings/admin/module-apps')).toBe(ADMIN_BASE_PATH);
    expect(getAdminOpenKeys('/settings/admin/modules')).toEqual(['module-ecosystem']);
    expect(getAdminOpenKeys('/settings/admin/module-apps')).toEqual(['workbench']);
  });

  // 选中态此前只按 catalog 的顶层路径做前缀匹配，于是模块中心的真实路由
  // （深达 modules/finance/payments）一路回落到父级，侧栏看不出当前在哪个分区；
  // 而 payments 是 compatibility 条目、不在侧栏集合里，直达时整个侧栏无高亮。
  it('resolves module-center and compatibility routes to their own nav key', () => {
    expect(getAdminSelectedKey('/settings/admin/modules/finance/payments')).toBe(
      `${ADMIN_BASE_PATH}/modules/finance/payments`,
    );
    expect(getAdminOpenKeys('/settings/admin/modules/finance/payments')).toEqual([
      'module-ecosystem',
    ]);

    expect(getAdminSelectedKey('/settings/admin/payments')).toBe(`${ADMIN_BASE_PATH}/payments`);
    expect(getAdminOpenKeys('/settings/admin/payments')).toEqual(['finance-commerce']);
  });

  // 反向保护：应用详情页的页签按方案 §2.4 留在详情页内、**不入主侧栏**，
  // 选中态必须继续折叠在顶层 modules；findModuleAdminSectionByPath 对这些
  // 分区返回的是带 :appId 的 pattern，绝不能当作高亮路径泄漏出去。
  it('keeps app-detail tabs collapsed on the top-level modules entry', () => {
    expect(getAdminSelectedKey('/settings/admin/modules/apps/app-1/products')).toBe(
      `${ADMIN_BASE_PATH}/modules`,
    );
    expect(getAdminSelectedKey('/settings/admin/modules/apps/app-1/products')).not.toContain(':');
  });

  it('keeps storage and maintenance settings in their approved modules', () => {
    const platformItems =
      ADMIN_NAV_GROUPS.find((group) => group.key === 'platform-ops')?.items ?? [];

    expect(
      platformItems.find((item) => item.path === `${ADMIN_BASE_PATH}/file-storage`),
    ).toMatchObject({
      icon: 'file-storage',
    });
    expect(
      platformItems.find((item) => item.path === `${ADMIN_BASE_PATH}/maintenance`),
    ).toMatchObject({
      icon: 'maintenance',
    });
    expect(
      ADMIN_NAV_GROUPS.flatMap((group) => group.items).find(
        (item) => item.path === `${ADMIN_BASE_PATH}/content-operations`,
      )?.description,
    ).not.toContain('閫氱煡淇濈暀鏃堕棿');
  });

  it('moves desktop release into its standalone release group', () => {
    const releaseItems =
      ADMIN_NAV_GROUPS.find((group) => group.key === 'client-release')?.items ?? [];
    const platformItems =
      ADMIN_NAV_GROUPS.find((group) => group.key === 'platform-ops')?.items ?? [];

    expect(releaseItems).toContainEqual(
      expect.objectContaining({
        icon: 'desktop',
        label: '桌面端发版',
        path: `${ADMIN_BASE_PATH}/desktop-update`,
      }),
    );
    expect(platformItems.map((item) => item.path)).not.toContain(
      `${ADMIN_BASE_PATH}/desktop-update`,
    );
    expect(getAdminOpenKeys('/settings/admin/desktop-update')).toEqual(['client-release']);
  });

  it('adds mobile client settings to the platform operations group', () => {
    const clientItems = ADMIN_NAV_GROUPS.find((group) => group.key === 'platform-ops')?.items ?? [];

    expect(clientItems).toContainEqual(
      expect.objectContaining({
        icon: 'mobile',
        label: '移动端控制中心',
        path: `${ADMIN_BASE_PATH}/mobile`,
      }),
    );
    expect(getAdminSelectedKey('/settings/admin/mobile')).toBe(`${ADMIN_BASE_PATH}/mobile`);
    expect(getAdminOpenKeys('/settings/admin/mobile')).toEqual(['platform-ops']);
  });

  it('normalizes legacy root admin URLs before selecting the sidebar item', () => {
    expect(getAdminSelectedKey('/admin')).toBe(ADMIN_BASE_PATH);
    expect(getAdminSelectedKey('/admin/users')).toBe(`${ADMIN_BASE_PATH}/users`);
  });

  it('selects the nearest admin item for nested URLs and opens its module', () => {
    expect(getAdminSelectedKey('/settings/admin')).toBe(ADMIN_BASE_PATH);
    expect(getAdminSelectedKey('/settings/admin/users/abc')).toBe(`${ADMIN_BASE_PATH}/users`);
    expect(getAdminSelectedKey('/settings/admin/providers/edit')).toBe(
      `${ADMIN_BASE_PATH}/providers`,
    );
    expect(getAdminSelectedKey('/settings/admin/model-billing-matrix')).toBe(
      `${ADMIN_BASE_PATH}/model-billing-matrix`,
    );
    expect(getAdminSelectedKey('/settings/admin/ppt')).toBe(`${ADMIN_BASE_PATH}/ppt`);
    expect(getAdminSelectedKey('/settings/admin/modules')).toBe(`${ADMIN_BASE_PATH}/modules`);
    expect(getAdminSelectedKey('/settings/admin/file-storage')).toBe(
      `${ADMIN_BASE_PATH}/file-storage`,
    );
    expect(getAdminSelectedKey('/settings/admin/maintenance')).toBe(
      `${ADMIN_BASE_PATH}/maintenance`,
    );
    expect(getAdminSelectedKey('/settings/admin/desktop-update')).toBe(
      `${ADMIN_BASE_PATH}/desktop-update`,
    );

    expect(getAdminOpenKeys('/settings/admin/providers/edit')).toEqual(['ai-platform']);
    expect(getAdminOpenKeys('/settings/admin/model-billing-matrix')).toEqual(['ai-platform']);
    expect(getAdminOpenKeys('/settings/admin/ppt')).toEqual(['ai-platform']);
    expect(getAdminOpenKeys('/settings/admin/modules')).toEqual(['module-ecosystem']);
    expect(getAdminOpenKeys('/settings/admin/file-storage')).toEqual(['platform-ops']);
    expect(getAdminOpenKeys('/settings/admin/maintenance')).toEqual(['platform-ops']);
    expect(getAdminOpenKeys('/settings/admin/desktop-update')).toEqual(['client-release']);
  });

  it('resolves the visible group and item for the current admin route', () => {
    expect(getAdminNavigationContext('admin', `${ADMIN_BASE_PATH}/providers/edit`)).toMatchObject({
      group: { key: 'ai-platform', label: '模型与生成' },
      item: { path: `${ADMIN_BASE_PATH}/providers` },
    });
    expect(getAdminNavigationContext('finance_admin', `${ADMIN_BASE_PATH}/settings`)).toBeNull();
  });

  it('filters admin navigation by group, item label, and description', () => {
    const groups = getAdminNavGroupsForRole('admin');
    const providerMatches = filterAdminNavGroups(groups, '服务商');

    expect(providerMatches).toHaveLength(1);
    expect(providerMatches[0]).toMatchObject({ key: 'ai-platform' });
    expect(providerMatches[0].items.map((item) => item.path)).toContain(
      `${ADMIN_BASE_PATH}/providers`,
    );
    expect(filterAdminNavGroups(groups, '平台配置与运维')[0]).toMatchObject({
      key: 'platform-ops',
    });
    expect(filterAdminNavGroups(groups, '不存在的入口')).toEqual([]);
    expect(filterAdminNavGroups(groups, '  ')).toBe(groups);
  });

  // B8 接线（需求 1/2/4）：两级结构、模块分区上提、角色过滤与空组抑制。
  describe('B8 two-level sidebar wiring', () => {
    const sectionItems = (section: ReturnType<typeof getAdminNavSectionsForRole>[number]) =>
      section.subSections.flatMap((subSection) => subSection.items.map((item) => item.path));

    it('lifts module center sections under module-ecosystem as sub-section entries', () => {
      const sections = getAdminNavSectionsForRole('admin');
      const ecosystem = sections.find((section) => section.key === 'module-ecosystem');

      expect(ecosystem?.subSections.map((subSection) => subSection.key)).toEqual([
        'module-catalog',
        'module-finance',
        'module-operations',
        'module-audit',
      ]);

      // 模块分区全部上提为子栏目条目（与模块中心二级侧栏同路径、同策略）。
      const paths = sectionItems(ecosystem!);
      expect(paths).toEqual(
        expect.arrayContaining([
          `${ADMIN_BASE_PATH}/modules`,
          `${ADMIN_BASE_PATH}/modules/apps`,
          `${ADMIN_BASE_PATH}/modules/reviews`,
          `${ADMIN_BASE_PATH}/modules/publishers`,
          `${ADMIN_BASE_PATH}/modules/finance/revenue`,
          `${ADMIN_BASE_PATH}/modules/finance/payments`,
          `${ADMIN_BASE_PATH}/modules/finance/payouts`,
          `${ADMIN_BASE_PATH}/modules/operations/installs`,
          `${ADMIN_BASE_PATH}/modules/operations/records`,
          `${ADMIN_BASE_PATH}/modules/operations/runs`,
          `${ADMIN_BASE_PATH}/modules/operations/artifacts`,
          `${ADMIN_BASE_PATH}/modules/audit`,
        ]),
      );
      // module-overview 与顶层 modules 同页（index 路由别名），不得重复上提；
      // :appId 详情页签留在详情页内（方案 §2.4）。
      expect(paths).not.toContain(`${ADMIN_BASE_PATH}/modules/overview`);
      expect(paths.join('\n')).not.toContain(':appId');
    });

    it('filters sub-section entries by role and never renders an empty group', () => {
      // finance_admin：module-catalog 子栏目下还有顶层「模块生态」条目
      // （access=[moduleAppRead, financeRead]，financeRead 放行——顶层条目的
      // 旧行为如此，B8 原样继承），加上财务分区与模块审计；apps/reviews/
      // publishers/operations 均需 moduleAppRead，全部过滤掉。绝无空子栏目。
      const financeSections = getAdminNavSectionsForRole('finance_admin');
      const financeEcosystem = financeSections.find(
        (section) => section.key === 'module-ecosystem',
      );

      expect(financeEcosystem).toBeDefined();
      expect(financeEcosystem!.subSections.map((subSection) => subSection.key)).toEqual([
        'module-catalog',
        'module-finance',
        'module-audit',
      ]);
      expect(sectionItems(financeEcosystem!)).toEqual([
        `${ADMIN_BASE_PATH}/modules`,
        // publishers 走 anyOf[moduleAppRead, financeRead]（policy.ts PUBLISHER_READ_POLICY），
        // finance_admin 依 financeRead 可见。
        `${ADMIN_BASE_PATH}/modules/publishers`,
        `${ADMIN_BASE_PATH}/modules/finance/revenue`,
        `${ADMIN_BASE_PATH}/modules/finance/payments`,
        `${ADMIN_BASE_PATH}/modules/finance/payouts`,
        `${ADMIN_BASE_PATH}/modules/audit`,
      ]);
      expect(sectionItems(financeEcosystem!)).not.toContain(`${ADMIN_BASE_PATH}/modules/apps`);

      // module_admin：财务分区（financeRead）不可见，目录与运维分区保留。
      // finance_admin 与 module_admin 的可见子栏目几乎不相交（只共享
      // module-audit 之外的对端缺口）。
      const moduleSections = getAdminNavSectionsForRole('module_admin');
      const moduleEcosystem = moduleSections.find((section) => section.key === 'module-ecosystem');

      expect(moduleEcosystem!.subSections.map((subSection) => subSection.key)).toEqual([
        'module-catalog',
        'module-operations',
        'module-audit',
      ]);
      expect(sectionItems(moduleEcosystem!)).not.toContain(
        `${ADMIN_BASE_PATH}/modules/finance/revenue`,
      );

      // 其他角色（content_admin 无任何模块/财务能力）：模块组整体隐藏，
      // 不渲染只剩壳的 module-ecosystem。
      const contentKeys = getAdminNavSectionsForRole('content_admin').map((section) => section.key);
      expect(contentKeys).not.toContain('module-ecosystem');

      // 空组抑制总断言：任何角色的每个组要么有子栏目、要么有裸条目。
      for (const section of [...financeSections, ...moduleSections]) {
        expect(
          section.subSections.length > 0 || section.items.length > 0,
          `group ${section.key} renders empty`,
        ).toBe(true);
      }
    });

    it('highlights the sub-section representative key for leaf routes', () => {
      // B7 已把 /modules/finance/payments 解析到叶子；B8 把它映射到所属子栏目
      // （module-finance）的代表条目——顶层 payments 条目是 compatibility 隐
      // 藏且归属 finance-settlement 子栏目，module-finance 的代表是伪条目
      // modules/finance/revenue。
      expect(getAdminActiveLeafKey('admin', '/settings/admin/modules/finance/payments')).toBe(
        `${ADMIN_BASE_PATH}/modules/finance/revenue`,
      );
      // 模块运维分区 → module-operations 子栏目代表（installs）。
      expect(getAdminActiveLeafKey('module_admin', '/settings/admin/modules/operations/runs')).toBe(
        `${ADMIN_BASE_PATH}/modules/operations/installs`,
      );
      // 非模块路径保持旧行为：selectedKey 本身就是子栏目下的条目。
      expect(getAdminActiveLeafKey('admin', '/settings/admin/plans')).toBe(
        `${ADMIN_BASE_PATH}/plans`,
      );
      // 应用详情页签（:appId）仍折叠在顶层 modules 条目上（module-catalog 子
      // 栏目代表）。
      expect(getAdminActiveLeafKey('admin', '/settings/admin/modules/apps/app-1/products')).toBe(
        `${ADMIN_BASE_PATH}/modules`,
      );
    });

    it('resolves the navigation context with sub-section for breadcrumbs', () => {
      const context = getAdminNavigationContext(
        'admin',
        '/settings/admin/modules/finance/payments',
      );

      expect(context).toMatchObject({
        group: { key: 'module-ecosystem' },
        subSection: { key: 'module-finance' },
      });
      expect(context?.item.path).toBe(`${ADMIN_BASE_PATH}/modules/finance/payments`);

      // finance_admin 直达模块财务分区：exact miss（顶层条目不可见）也必须给
      // 出组 + 子栏目，面包屑不再回落「管理后台」。
      const scopedContext = getAdminNavigationContext(
        'finance_admin',
        '/settings/admin/modules/finance/payments',
      );
      expect(scopedContext).toMatchObject({
        group: { key: 'module-ecosystem' },
        subSection: { key: 'module-finance' },
      });

      // 跨域直达仍返回 null（_layout 守卫会先重定向，这里只锁解析语义）。
      expect(getAdminNavigationContext('finance_admin', `${ADMIN_BASE_PATH}/settings`)).toBeNull();
    });

    it('keeps groups without sub-sections in the flat legacy shape', () => {
      const sections = getAdminNavSectionsForRole('admin');
      const workbench = sections.find((section) => section.key === 'workbench');

      expect(workbench?.subSections).toHaveLength(1);
      expect(workbench?.subSections[0].items.map((item) => item.path)).toEqual([ADMIN_BASE_PATH]);
      // 组条目集合 = 子栏目条目的展平（计数口径一致）。
      expect(workbench!.items.map((item) => item.path)).toEqual(
        workbench!.subSections[0].items.map((item) => item.path),
      );
    });

    it('filters two-level sections by sub-section label and item label', () => {
      const sections = getAdminNavSectionsForRole('admin');

      // 子栏目名命中（catalog fallback，zh-CN label 与之一致）：保留该子栏目
      // 整枝。
      const financeHit = filterAdminNavSections(sections, '模块财务');
      const hitEcosystem = financeHit.find((section) => section.key === 'module-ecosystem');
      expect(hitEcosystem?.subSections.map((subSection) => subSection.key)).toEqual([
        'module-finance',
      ]);

      // 条目命中：连带所在子栏目（catalog label 为英文 'Payouts'，与顶层条目
      // 的旧行为一致——filterAdminNavGroups 同样按 catalog 文案匹配）。
      const payoutEcosystem = filterAdminNavSections(sections, 'payouts').find(
        (section) => section.key === 'module-ecosystem',
      );
      expect(sectionItems(payoutEcosystem!)).toContain(
        `${ADMIN_BASE_PATH}/modules/finance/payouts`,
      );

      // 无命中：空数组（空组抑制）。
      expect(filterAdminNavSections(sections, '不存在的入口')).toEqual([]);
      // 空查询：原样返回。
      expect(filterAdminNavSections(sections, '')).toBe(sections);
    });

    it('matches against displayed labels when a translate channel is provided', () => {
      // 复核发现 2：raw label 是混语言的（子栏目中文、伪条目英文），en 用户
      // 按显示的英文名搜索时拿 raw 中文匹配会让整组消失。传入 translate 后
      // 三级（组/子栏目/条目）都必须按显示值匹配。字典模拟 default
      // subscription 命名空间的两个真实键。
      const sections = getAdminNavSectionsForRole('admin');
      const dictionary: Record<string, string> = {
        'admin.navigation.groups.module-ecosystem.label': 'Module ecosystem',
        'admin.navigation.subSections.module-finance.label': 'Module finance',
        'admin.navigation.items.module-apps.label': 'Apps',
      };
      const translate = (key: string, fallback: string) => dictionary[key] ?? fallback;

      // en 显示名 'Module finance' 命中子栏目——修复前此查询整组清空。
      const enFinance = filterAdminNavSections(sections, 'module finance', translate);
      const enEcosystem = enFinance.find((section) => section.key === 'module-ecosystem');
      expect(enEcosystem?.subSections.map((subSection) => subSection.key)).toEqual([
        'module-finance',
      ]);

      // en 组名命中 → 保留整组（含全部子栏目）。
      const enGroup = filterAdminNavSections(sections, 'module ecosystem', translate);
      expect(enGroup.find((section) => section.key === 'module-ecosystem')?.subSections).toHaveLength(
        sections.find((section) => section.key === 'module-ecosystem')!.subSections.length,
      );

      // 伪条目显示值 'Apps' 命中条目（raw 同为英文，但走的是 translate 值）。
      const enApps = filterAdminNavSections(sections, 'apps', translate);
      expect(sectionItems(enApps.find((section) => section.key === 'module-ecosystem')!)).toContain(
        `${ADMIN_BASE_PATH}/modules/apps`,
      );

      // 译文通道下原 raw 中文不再命中（显示值已切换语言）。
      const zhQueryUnderEn = filterAdminNavSections(sections, '模块财务', translate);
      expect(zhQueryUnderEn.find((section) => section.key === 'module-ecosystem')).toBeUndefined();
    });
  });
});
