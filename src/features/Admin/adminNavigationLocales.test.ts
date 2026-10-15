import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ADMIN_CATALOG,
  ADMIN_CATALOG_GROUPS,
  type AdminNavGroupKey,
  type AdminSubSectionKey,
} from './adminCatalog';

const repoFile = (relative: string) =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), relative), 'utf8')) as Record<string, string>;

const defaultSubscription = (() => {
  const source = readFileSync(
    path.resolve(process.cwd(), 'packages/locales/src/default/subscription.ts'),
    'utf8',
  );
  // default namespace 是运行时英文的真实来源（lng === 'en-US' 时加载它，而非 locales/en-US/*.json）。
  const entries: Record<string, string> = {};
  const pattern = /^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm;
  let match = pattern.exec(source);
  while (match) {
    entries[match[1]] = match[2].replaceAll("\\'", "'").replaceAll('\\n', '\n');
    match = pattern.exec(source);
  }
  return entries;
})();

const enUS = repoFile('locales/en-US/subscription.json');
const zhCN = repoFile('locales/zh-CN/subscription.json');

const groupKeys = ADMIN_CATALOG_GROUPS.map((group) => group.key);
const navKeysForGroups = groupKeys.flatMap((key) => [
  `admin.navigation.groups.${key}.label`,
  `admin.navigation.groups.${key}.description`,
]);
const navKeysForItems = ADMIN_CATALOG.flatMap((item) => [
  `admin.navigation.items.${item.id}.label`,
  `admin.navigation.items.${item.id}.description`,
]);
// 子栏目标签（方案 §2.2）。B6 先备齐三源文案，B8 才渲染；缺一边英文用户就会
// 看到裸 key 或中文标签。取值范围含尚未被 catalog 引用的 4 个模块分区键
// （module-finance / module-operations / module-audit / workbench-quick）——
// 它们在 B7/B8 接线时才被引用，文案现在就位免得接线时再补三处。
const declaredSubSections = [
  'ai-catalog',
  'ai-generate',
  'ai-sources',
  'audit-log',
  'client-desktop',
  'content-growth',
  'content-operations',
  'content-resources',
  'finance-accounts',
  'finance-analytics',
  'finance-products',
  'finance-settlement',
  'module-audit',
  'module-catalog',
  'module-finance',
  'module-operations',
  'platform-brand',
  'platform-infra',
  'platform-maintenance',
  'platform-runtime',
  'user-support-defaults',
  'user-support-identity',
  'workbench-overview',
  'workbench-quick',
] as const satisfies readonly AdminSubSectionKey[];
const navKeysForSubSections = declaredSubSections.map(
  (key) => `admin.navigation.subSections.${key}.label`,
);
const allNavKeys = [...navKeysForGroups, ...navKeysForItems, ...navKeysForSubSections];

// 模块分区伪条目（B8 上提）。id 不在 ADMIN_CATALOG，键清单必须从 seeds 派生
// 而不是硬编码——否则 seeds 改名/增删时测试照着旧清单查三源，照样全绿。
const pseudoItemKeys = [
  'module-apps',
  'module-artifacts',
  'module-audit',
  'module-installs',
  'module-payments',
  'module-payouts',
  'module-publishers',
  'module-records',
  'module-revenue',
  'module-reviews',
  'module-runs',
] as const;
const navKeysForPseudoItems = pseudoItemKeys.flatMap((id) => [
  `admin.navigation.items.${id}.label`,
  `admin.navigation.items.${id}.description`,
]);

describe('adminNavigationLocales', () => {
  it('translates every catalog group key in all three locale sources', () => {
    for (const source of [
      ['default', defaultSubscription],
      ['en-US', enUS],
      ['zh-CN', zhCN],
    ] as const) {
      const [name, dictionary] = source;
      const missing = navKeysForGroups.filter((key) => !dictionary[key]);

      expect(missing, `${name} is missing admin group translations`).toEqual([]);
    }
  });

  it('translates every catalog item key in all three locale sources', () => {
    for (const source of [
      ['default', defaultSubscription],
      ['en-US', enUS],
      ['zh-CN', zhCN],
    ] as const) {
      const [name, dictionary] = source;
      const missing = navKeysForItems.filter((key) => !dictionary[key]);

      expect(missing, `${name} is missing admin item translations`).toEqual([]);
    }
  });

  it('derives the pseudo-item key list from the seeds and translates it in all three sources', async () => {
    // 双向锁定：seeds 里每个 id 必须出现在本测试的清单里（防 seeds 新增而清单
    // 漏跟），清单里每个 id 也必须在 seeds 里（防 seeds 删除留下死键）。标签值
    // 另与 seeds 的 fallback 字面量逐字一致（en 渲染链 translate(key,
    // {defaultValue: fallback})——locale 有值时 fallback 永不生效，两者漂移即
    // 静默无效）。缺这段覆盖时，11 键三源全 miss 也会全绿（2026-10-12 实证）。
    const { MODULE_SECTION_NAV_LABELS } = await import('./adminNavigation');

    const seedIds = Object.keys(MODULE_SECTION_NAV_LABELS).sort();
    expect(seedIds).toEqual([...pseudoItemKeys].sort());

    const drifted = Object.entries(MODULE_SECTION_NAV_LABELS)
      .flatMap(([id, label]) => {
        const labelKey = `admin.navigation.items.${id}.label`;
        return [
          [labelKey, enUS[labelKey], label],
          [labelKey, defaultSubscription[labelKey], label],
        ] as const;
      })
      .filter(([, actual, expected]) => actual !== undefined && actual !== expected)
      .map(([key, actual, expected]) => `${key}: locale=${actual} seed=${expected}`);
    expect(drifted, 'pseudo-item labels drifted from the seeds').toEqual([]);

    for (const source of [
      ['default', defaultSubscription],
      ['en-US', enUS],
      ['zh-CN', zhCN],
    ] as const) {
      const [name, dictionary] = source;
      const missing = navKeysForPseudoItems.filter((key) => !dictionary[key]);

      expect(missing, `${name} is missing module section pseudo-item translations`).toEqual([]);
    }
  });

  it('translates every sub-section key in all three locale sources', () => {
    for (const source of [
      ['default', defaultSubscription],
      ['en-US', enUS],
      ['zh-CN', zhCN],
    ] as const) {
      const [name, dictionary] = source;
      const missing = navKeysForSubSections.filter((key) => !dictionary[key]);

      expect(missing, `${name} is missing admin sub-section translations`).toEqual([]);
    }
  });

  it('has no orphaned admin navigation group keys left behind by a regroup', () => {
    const staleGroupKeyPattern = /^admin\.navigation\.groups\.([a-z-]+)\./;

    for (const source of [
      ['default', defaultSubscription],
      ['en-US', enUS],
      ['zh-CN', zhCN],
    ] as const) {
      const [name, dictionary] = source;
      const orphans = Object.keys(dictionary)
        .map((key) => staleGroupKeyPattern.exec(key)?.[1])
        .filter(
          (key): key is AdminNavGroupKey => !!key && !groupKeys.includes(key as AdminNavGroupKey),
        );

      expect([...new Set(orphans)], `${name} keeps renamed-away admin group keys`).toEqual([]);
    }
  });

  it('keeps the two locale JSON sources in step with the default namespace', () => {
    // default/subscription.ts 才是生产英文来源，en-US.json 与之保持镜像；
    // 不同步会让英文用户在生产看到与 zh-CN / catalog 不一致的文案。
    const drifted = allNavKeys.filter(
      (key) => defaultSubscription[key] !== undefined && enUS[key] !== defaultSubscription[key],
    );

    expect(drifted, 'en-US.json drifted from the default subscription namespace').toEqual([]);
  });

  it('keeps zh-CN navigation copy equal to the catalog labels it shadows', () => {
    // adminCatalog.ts 是中文文案的事实来源（adminChineseCopy.test.ts 即锁这一点），
    // 而 Sidebar 用 translate(key, fallback) 渲染：locale 有值时 fallback 永不生效。
    // 因此 zh-CN 若与 catalog 不同步，改 catalog 是静默无效的——这里双向锁死。
    const drifted = [
      ...ADMIN_CATALOG_GROUPS.map(
        (group) =>
          [
            `admin.navigation.groups.${group.key}.label`,
            group.label,
            `admin.navigation.groups.${group.key}.description`,
            group.description,
          ] as const,
      ),
      ...ADMIN_CATALOG.map(
        (item) =>
          [
            `admin.navigation.items.${item.id}.label`,
            item.label,
            `admin.navigation.items.${item.id}.description`,
            item.description,
          ] as const,
      ),
    ]
      .filter(([key, value]) => zhCN[key] !== undefined && zhCN[key] !== value)
      .map(([key, value]) => `${key}: zh-CN=${zhCN[key]} catalog=${value}`);

    expect(drifted, 'zh-CN navigation copy drifted from the catalog').toEqual([]);
  });

  it('keeps zh-CN and en-US sub-section labels in step with the sidebar fallbacks', async () => {
    // B8 起 subSections.*.label 被侧栏真实渲染：zh-CN 值必须与
    // adminNavigation.ts 的 SUB_SECTION_LABELS fallback 逐字一致（否则改
    // fallback 静默无效），en-US 必须与 default 命名空间镜像（否则英文用户
    // 看到两套文案）。B6 时该断言只锁「键存在」，这里升级为锁值。
    const { ADMIN_NAV_SUB_SECTIONS } = await import('./adminNavigation');

    const fallbacks = new Map<string, string>();
    for (const subSections of Object.values(ADMIN_NAV_SUB_SECTIONS)) {
      for (const subSection of subSections) {
        fallbacks.set(`admin.navigation.subSections.${subSection.key}.label`, subSection.label);
      }
    }

    // workbench-quick 无任何 catalog 条目归属，不进入侧栏结构（B8 设计：
    // 有归属才渲染），因此 fallback 表 = 24 键 - workbench-quick = 23。
    expect(fallbacks.size).toBe(declaredSubSections.length - 1);
    expect(fallbacks.has('admin.navigation.subSections.workbench-quick.label')).toBe(false);

    const zhDrifted = [...fallbacks].filter(
      ([key, value]) => zhCN[key] !== undefined && zhCN[key] !== value,
    );
    expect(zhDrifted, 'zh-CN sub-section labels drifted from sidebar fallbacks').toEqual([]);

    const enDrifted = [...fallbacks].filter(
      ([key]) => defaultSubscription[key] !== undefined && enUS[key] !== defaultSubscription[key],
    );
    expect(enDrifted, 'en-US sub-section labels drifted from default namespace').toEqual([]);
  });

  it('keeps the declared sub-section key list in step with its real consumers', async () => {
    // 子栏目键清单是硬编码的，改 catalog 的 subSection 归属或 seeds 时它会静默
    // 漂移——把 catalog 里的键改坏一字，本文件其余用例照着坏键查三源照样全绿
    //（2026-10-12 变异实证）。这里锁死：每个声明键必须被 catalog 条目或模块分
    // 区伪条目真实引用，workbench-quick 是唯一受控例外（刻意预留，见下）。
    const { ADMIN_NAV_SUB_SECTIONS } = await import('./adminNavigation');

    const declared = new Set(declaredSubSections.map((key) => key as AdminSubSectionKey));
    const consumers = new Set<string>([
      ...ADMIN_CATALOG.flatMap((item) => (item.subSection ? [item.subSection] : [])),
      // Set<string>.has 接受任意 string；先把键展平为 string 再过滤，避免把
      // 窄型 AdminSubSectionKey 直接喂给 has 触发 TS2345（该键来自动态 import
      // 的结构化数据，静态上不可收窄）。
      ...Object.values(ADMIN_NAV_SUB_SECTIONS).flatMap((subSections) =>
        subSections.map((s) => s.key as string),
      ),
    ]);

    const dangling = [...declared].filter((key) => !consumers.has(key));
    expect(dangling, 'declared sub-section keys nobody consumes').toEqual(['workbench-quick']);

    const undeclared = [...consumers].filter((key) => !declared.has(key as AdminSubSectionKey));
    expect(undeclared, 'consumed sub-section keys missing from the declared list').toEqual([]);

    // ADMIN_NAV_SUB_SECTIONS 的组键也必须落在声明清单内，防止两级表私自造键。
    const structural = Object.keys(ADMIN_NAV_SUB_SECTIONS).flatMap((groupKey) =>
      ADMIN_NAV_SUB_SECTIONS[groupKey as keyof typeof ADMIN_NAV_SUB_SECTIONS].map((s) => s.key),
    );
    const unknown = [...new Set(structural)].filter((key) => !declared.has(key));
    expect(unknown, 'ADMIN_NAV_SUB_SECTIONS invents keys outside the declared list').toEqual([]);
  });

  it('removes locale keys for retired navigation surfaces', () => {
    // IA 重设计 1c：支付中心删除 moduleApps 标签页后该键必须三份源同时消失，
    // 否则残留键会掩盖"双路径已收敛"这一事实。
    for (const source of [
      ['default', defaultSubscription],
      ['en-US', enUS],
      ['zh-CN', zhCN],
    ] as const) {
      const [name, dictionary] = source;

      expect(
        dictionary['admin.payments.tabs.moduleApps'],
        `${name} kept the retired tab key`,
      ).toBeUndefined();
    }
  });
});
