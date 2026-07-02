import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (filePath: string) => readFileSync(path.resolve(repoRoot, filePath), 'utf8');

describe('workspace audit log settings flow', () => {
  it('keeps the audit log tab wired through workspace settings navigation and routes', () => {
    const tabs = readRepoFile('src/types/workspaceSettings.ts');
    const category = readRepoFile('src/features/WorkspaceSetting/hooks/useCategory.tsx');
    const exports = readRepoFile('src/features/WorkspaceSetting/index.ts');
    const route = readRepoFile('src/routes/(main)/[workspaceSlug]/settings/audit-log/index.tsx');
    const asyncRouter = readRepoFile('src/spa/router/desktopRouter.config.tsx');
    const syncRouter = readRepoFile('src/spa/router/desktopRouter.config.desktop.tsx');
    const mobileRouter = readRepoFile('src/spa/router/mobileRouter.config.tsx');

    expect(tabs).toContain("AuditLog = 'audit-log'");
    expect(category).toContain('ScrollText');
    expect(category).toContain('WorkspaceSettingsTabs.AuditLog');
    expect(category).toContain("t('workspaceSetting.tab.auditLog')");
    expect(exports).toContain('WorkspaceAdminOnly');
    expect(route).toContain('<WorkspaceAdminOnly>');
    expect(route).toContain('<WorkspaceAuditLog />');
    expect(asyncRouter).toContain("@/routes/(main)/[workspaceSlug]/settings/audit-log");
    expect(syncRouter).toContain("@/routes/(main)/[workspaceSlug]/settings/audit-log");
    expect(mobileRouter).toContain("@/routes/(main)/[workspaceSlug]/settings/audit-log");
  });

  it('ships default, English, and Chinese labels for the audit log page', () => {
    const defaults = readRepoFile('packages/locales/src/default/setting.ts');
    const enUS = readRepoFile('locales/en-US/setting.json');
    const zhCN = readRepoFile('locales/zh-CN/setting.json');

    for (const source of [defaults, enUS, zhCN]) {
      expect(source).toContain('workspaceSetting.tab.auditLog');
      expect(source).toContain('workspaceSetting.auditLog.empty');
      expect(source).toContain('workspaceSetting.auditLog.title');
    }
  });

  it('keeps audit log pagination and filters wired in the page', () => {
    const page = readRepoFile('src/business/client/BusinessSettingPages/WorkspaceAuditLog.tsx');

    expect(page).toContain('nextCursor');
    expect(page).toContain('cursor');
    expect(page).toContain('actionFilter');
    expect(page).toContain('startDate');
    expect(page).toContain('endDate');
    expect(page).toContain('workspaceSetting.auditLog.loadMore');
  });
});
