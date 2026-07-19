import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readMobileRouterSource = () =>
  readFile(path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'), 'utf8');

describe('mobileRouter workspace roots', () => {
  it('registers design, discover, and apps before the workspace slug route', async () => {
    const source = await readMobileRouterSource();
    const workspaceSlugIndex = source.indexOf("path: ':workspaceSlug'");

    for (const route of ['design', 'discover', 'apps']) {
      const routeIndex = source.indexOf(`path: '${route}'`);
      expect(routeIndex).toBeGreaterThan(-1);
      expect(routeIndex).toBeLessThan(workspaceSlugIndex);
      expect(source).toContain(`import('@/routes/(mobile)/${route}')`);
    }
  });

  it('registers the app market, detail, and runtime routes before the workspace slug route', async () => {
    const source = await readMobileRouterSource();
    const workspaceSlugIndex = source.indexOf("path: ':workspaceSlug'");

    for (const route of ['market', ':appId', ':appId/app', ':appId/app/:pageKey']) {
      const routeIndex = source.indexOf(`path: '${route}'`);
      expect(routeIndex).toBeGreaterThan(-1);
      expect(routeIndex).toBeLessThan(workspaceSlugIndex);
    }

    expect(source).toContain("import('@/routes/(main)/apps')");
    expect(source).toContain("import('@/routes/(main)/apps/[appId]')");
    expect(source).toContain("import('@/routes/(main)/apps/[appId]/app')");
    expect(source).toContain("import('@/routes/(main)/apps/[appId]/app/[pageKey]')");
  });

  it('keeps AI group conversations and group topics reachable on mobile', async () => {
    const source = await readMobileRouterSource();

    expect(source).toContain("import('@/routes/(main)/group')");
    expect(source).toContain("import('@/routes/(main)/group/_layout')");
    expect(source).toContain("path: 'group'");
    expect(source).toContain("path: ':gid'");
  });
});

describe('mobileRouter task routes', () => {
  it('registers task list and detail routes under the shared workspace layout', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("import('@/routes/(main)/(task-workspace)/_layout')");
    expect(source).toContain("import('@/routes/(main)/tasks')");
    expect(source).toContain("import('@/routes/(main)/task/[taskId]')");
    expect(source).toContain("import('@/routes/(main)/agent/task/[taskId]')");
    expect(source).toContain("path: 'tasks'");
    expect(source).toContain("path: 'task'");
    expect(source).toContain("path: ':taskId'");
    expect(source).toContain("path: ':aid/task/:taskId'");
    expect(source).not.toContain("import('@/routes/(main)/tasks/_layout')");
  });
});

describe('mobileRouter community routes', () => {
  it('registers skill list and detail routes', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("import('@/routes/(main)/community/(list)/skill')");
    expect(source).toContain("import('@/routes/(main)/community/(detail)/skill')");
    expect(source).toContain('(m) => m.MobileSkillPage');
    expect(source).toContain("path: 'skill'");
    expect(source).toContain("path: 'skill/:slug'");
  });

  it('registers group agent detail routes', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("import('@/routes/(main)/community/(detail)/group_agent')");
    expect(source).toContain('(m) => m.MobileGroupAgentPage');
    expect(source).toContain("path: 'group_agent/:slug'");
  });
});

describe('mobileRouter settings routes', () => {
  it('loads mobile settings content for dynamic tabs', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("import('@/routes/(mobile)/settings/[tab]')");
    expect(source).not.toContain("import('@/routes/(main)/settings')");
    expect(source).toContain("path: ':tab'");
  });

  it('keeps the mobile header and scroll container in the route layout only', async () => {
    const [layoutSource, indexSource] = await Promise.all([
      readFile(path.join(process.cwd(), 'src/routes/(mobile)/settings/_layout/index.tsx'), 'utf8'),
      readFile(path.join(process.cwd(), 'src/routes/(mobile)/settings/index.tsx'), 'utf8'),
    ]);

    expect(layoutSource).toContain('MobileContentLayout');
    expect(indexSource).not.toContain('MobileContentLayout');
    expect(indexSource).not.toContain("import Header from './_layout/Header'");
  });

  it('keeps nested personal settings navigation outside the active workspace', async () => {
    const [providerLayoutSource, meSettingsHeaderSource] = await Promise.all([
      readFile(
        path.join(process.cwd(), 'src/routes/(mobile)/settings/provider/_layout/index.tsx'),
        'utf8',
      ),
      readFile(
        path.join(process.cwd(), 'src/routes/(mobile)/me/settings/features/Header.tsx'),
        'utf8',
      ),
    ]);

    expect(providerLayoutSource).toContain(
      'navigate(`/settings/provider/${providerKey}`, { escape: true })',
    );
    expect(meSettingsHeaderSource).toContain("navigate('/me', { escape: true })");
  });
});
