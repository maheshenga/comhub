import type { ModuleAppPage } from '@lobechat/types';

type ModuleAppPageKey = Pick<ModuleAppPage, 'key'>;

export const getInitialModuleAppPageKey = (pages: ModuleAppPageKey[]) =>
  pages.find((page) => page.key === 'overview')?.key ?? pages[0]?.key ?? 'overview';

export const resolveModuleAppPagePath = (appId: string, pageKey: string) =>
  `/apps/${appId}/app/${pageKey}`;
