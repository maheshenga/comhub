import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LAB_FEATURES } from '@/features/Settings/labs/features';
import { SettingsTabs } from '@/store/global/initialState';

import {
  SETTINGS_SEARCH_ITEMS,
  type SettingsSearchContext,
  TAB_SEARCH_EN_KEYWORDS,
  TAB_SEARCH_KEYWORDS_KEYS,
} from './items';

/**
 * 收集设置域的挂载点源码。只扫这三棵：设置页、ServiceModel（service-model-*
 * anchor 挂在这里）、以及 business slot 渲染的计费页。anchor 不会出现在别处，
 * 全仓扫描要多读约 1 万个文件、并把一个 5s 超时的用例拖到必红（实测 5037ms）；
 * 收窄到这三棵后同步读完只要 ~40ms。
 *
 * 排除测试自身与 SettingsSearch 目录——后者是 anchor 的声明处（items.ts）
 * 与解析处（anchor.tsx），把它们算进来会让任何 anchor 都「有挂载点」，断言
 * 变成永真。
 */
const ANCHOR_MOUNT_ROOTS = [
  'src/features/Settings',
  'src/features/ServiceModel',
  'src/business',
];

const collectMountSources = async (root: string): Promise<string> => {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });

  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.test\./.test(entry.name) &&
        !(entry.parentPath ?? entry.path ?? '').includes(`${path.sep}SettingsSearch`),
    )
    .map((entry) => path.join(entry.parentPath ?? entry.path ?? '', entry.name));

  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));

  return sources.join('\n');
};
const webContext: SettingsSearchContext = {  disableEmailPassword: false,
  enableBusinessFeatures: true,
  enableComposio: true,
  enableGatewayMode: true,
  hasEmail: true,
  hideDocs: false,
  isDesktop: false,
  isLogin: true,
  isWindows: false,
  showAiImage: true,
};

describe('settings search index', () => {
  it('derives one search item per lab feature in catalog order', () => {
    const labsItems = SETTINGS_SEARCH_ITEMS.filter((item) => item.tab === SettingsTabs.Labs);

    expect(labsItems.map((item) => item.anchor)).toEqual(
      LAB_FEATURES.map(({ flag }) => `labs-${flag}`),
    );
  });

  it('hides desktop-only lab features from web search results', () => {
    const labsItems = SETTINGS_SEARCH_ITEMS.filter((item) => item.tab === SettingsTabs.Labs);

    for (const feature of LAB_FEATURES) {
      const item = labsItems.find(({ anchor }) => anchor === `labs-${feature.flag}`)!;
      expect(item.visible?.(webContext) ?? true).toBe(!feature.desktopOnly);
    }
  });

  it('indexes the inbox notification channel', () => {
    expect(SETTINGS_SEARCH_ITEMS.some((item) => item.anchor === 'notification-inbox')).toBe(true);
  });

  it('does not offer the retired TTS setting in search', () => {
    expect(SETTINGS_SEARCH_ITEMS.some((item) => item.anchor === 'service-model-tts')).toBe(false);
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.ServiceModel]).not.toContain('tts');
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.ServiceModel]).not.toContain('tts settings');
  });

  it('keeps an English floor for labs and oauth apps tabs', () => {
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.Labs]).toContain('experiment');
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.OAuthApps]).toContain('oauth');
    expect(TAB_SEARCH_KEYWORDS_KEYS[SettingsTabs.Labs]).toBe('settingsSearch.tabKeywords.labs');
    expect(TAB_SEARCH_KEYWORDS_KEYS[SettingsTabs.OAuthApps]).toBe(
      'settingsSearch.tabKeywords.oauthApps',
    );
  });

  it('covers the high-volume zero-result phrases as tab keywords', () => {
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.Provider]).toEqual(
      expect.arrayContaining(['api', 'model provider', 'language model', 'custom provider']),
    );
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.Messenger]).toEqual(
      expect.arrayContaining(['telegram', 'slack', 'discord', 'wechat']),
    );
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.ServiceModel]).toEqual(
      expect.arrayContaining(['search', 'model assignment']),
    );
    expect(TAB_SEARCH_EN_KEYWORDS[SettingsTabs.Storage]).toEqual(
      expect.arrayContaining(['knowledge base']),
    );
  });

  // 搜索深链是 `${tabUrl}#${anchor}`：tab 值定路由，anchor 只做页内定位。anchor
  // 一旦没有挂载点，scrollToSettingsAnchor 轮询 3 秒后静默 return —— 只完成 tab
  // 切换，不报错、不记日志，此前没有任何检查能发现。这条断言把「声明了却没挂载」
  // 变成可见缺口：新增 anchor 而忘了挂载点时测试即红。
  //
  // 白名单剩余 1 个：storage-account-deletion。本 fork 的
  // src/business/client/features/AccountDeletion/index.tsx 是 return null 的
  // 占位实现（Advanced.tsx:151 渲染的 slot 无真实 UI），anchor 无处可挂。
  // 其余 19 个（计费/推荐/通知/用量）已于 2026-10-12 全部补上
  // SettingsSearchAnchor 挂载点。白名单只减不增。
  const ANCHORS_WITHOUT_MOUNT_POINT = new Set(['storage-account-deletion']);

  it('mounts every declared search anchor somewhere in the app', async () => {
    const declared = new Set(
      SETTINGS_SEARCH_ITEMS.map((item) => item.anchor).filter((anchor): anchor is string =>
        Boolean(anchor),
      ),
    );

    const corpus = (
      await Promise.all(ANCHOR_MOUNT_ROOTS.map(collectMountSources))
    ).join('\n');

    // 裸 substring 比对会把 `id="billing-history-x"`（或任何更长的键）误判为
    // billing-history 的挂载点 —— 变异验证实证过这个假绿。按「完整引号 token」
    // 比对：锚点必须以成对引号独立出现（id="x"、id={'x'}、anchor: 'x'、映射表
    // key: 'x' 值皆命中；billing-history-x 的 -x 后缀不命中）。
    const isMounted = (anchor: string) => corpus.includes(`'${anchor}'`) || corpus.includes(`"${anchor}"`);

    const unmounted = [...declared]
      .filter((anchor) => !isMounted(anchor))
      // labs-* 由模板串 `labs-${flag}` 声明，运行时才成形，静态比对天然找不到。
      .filter((anchor) => !anchor.startsWith('labs-'))
      .sort();

    expect(unmounted).toEqual([...ANCHORS_WITHOUT_MOUNT_POINT].sort());
  });
});
