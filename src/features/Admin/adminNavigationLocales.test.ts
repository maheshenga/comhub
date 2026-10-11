import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ADMIN_CATALOG, ADMIN_CATALOG_GROUPS } from './adminCatalog';

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
const allNavKeys = [...navKeysForGroups, ...navKeysForItems];

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
        .filter((key): key is string => !!key && !groupKeys.includes(key));

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
