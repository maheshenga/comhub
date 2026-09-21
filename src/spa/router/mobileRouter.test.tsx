import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ReactElement } from 'react';
import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { mobileRoutes } from './mobileRouter.config';

const readMobileRouterSource = () =>
  readFile(path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'), 'utf8');
const readMobileWorkspaceRoutesSource = () =>
  readFile(path.join(process.cwd(), 'src/spa/router/mobileWorkspaceRoutes.tsx'), 'utf8');

describe('mobileRouter workspace roots', () => {
  it('registers design, discover, and apps before the workspace slug route', async () => {
    const [routerSource, workspaceRoutesSource] = await Promise.all([
      readMobileRouterSource(),
      readMobileWorkspaceRoutesSource(),
    ]);
    const workspaceSlugIndex = routerSource.indexOf("path: ':workspaceSlug'");
    const personalFeatureRoutesIndex = routerSource.indexOf('includeDeveloper: true');

    for (const route of ['design', 'discover', 'apps']) {
      expect(workspaceRoutesSource).toContain(`path: '${route}'`);
      expect(workspaceRoutesSource).toContain(`import('@/routes/(mobile)/${route}')`);
    }
    expect(personalFeatureRoutesIndex).toBeGreaterThan(-1);
    expect(personalFeatureRoutesIndex).toBeLessThan(workspaceSlugIndex);
  });

  it('mirrors the four mobile roots and required design/app deep routes inside a workspace', async () => {
    const [source, featureSource] = await Promise.all([
      readMobileRouterSource(),
      readMobileWorkspaceRoutesSource(),
    ]);

    for (const route of ['design', 'discover', 'apps', 'page', 'image', 'ppt']) {
      expect(featureSource).toContain(`path: '${route}'`);
    }
    expect(source).toContain('...workspaceMobileRootChildren');
    expect(source).toContain("import('@/routes/(mobile)/(home)/')");
    expect(source).toContain('includeDeveloper: false');
    expect(featureSource).toContain("import('@/routes/(mobile)/design')");
    expect(featureSource).toContain("import('@/routes/(mobile)/discover')");
    expect(featureSource).toContain("import('@/routes/(mobile)/apps')");
    expect(featureSource).toContain("import('@/features/MobileWorkspace/MobileDeepPageGuard')");
  });

  it('registers the app market, detail, and runtime routes before the workspace slug route', async () => {
    const source = await readMobileWorkspaceRoutesSource();

    for (const route of ['market', ':appId', 'app', 'app/:pageKey']) {
      const routeIndex = source.indexOf(`path: '${route}'`);
      expect(routeIndex).toBeGreaterThan(-1);
    }

    expect(source).toContain("import('@/routes/(main)/apps')");
    expect(source).toContain("import('@/routes/(main)/apps/[appId]')");
    expect(source).toContain("import('@/routes/(main)/apps/[appId]/app')");
    expect(source).toContain("import('@/routes/(main)/apps/[appId]/app/[pageKey]')");
    expect(source).toContain("import('@/features/MobileWorkspace/MobileDeepPageGuard')");
  });

  it('registers design document, image, and PPT workspaces before the workspace slug route', async () => {
    const source = await readMobileWorkspaceRoutesSource();

    for (const route of ['page', 'image', 'ppt']) {
      const routeIndex = source.indexOf(`path: '${route}'`);
      expect(routeIndex).toBeGreaterThan(-1);
    }

    expect(source).toContain("import('@/routes/(main)/page/[id]')");
    expect(source).toContain("import('@/routes/(main)/page/_layout')");
    expect(source).toContain("import('@/routes/(main)/(create)/image')");
    expect(source).toContain("import('@/routes/(main)/(create)/image/_layout')");
    expect(source).toContain("import('@/routes/(main)/(create)/ppt')");
    expect(source).toContain("label('Pages > Mobile Layout')");
    expect(source).toContain("label('Image > Deep Page Guard')");
    expect(source).toContain("label('PPT > Deep Page Guard')");
  });

  it('keeps AI group conversations and group topics reachable on mobile', async () => {
    const source = await readMobileRouterSource();

    expect(source).toContain("import('@/routes/(mobile)/group')");
    expect(source).toContain("import('@/routes/(mobile)/group/_layout')");
    expect(source).toContain("path: 'group'");
    expect(source).toContain("path: ':gid'");
  });
});

describe('mobileRouter agent share route', () => {
  it('serves the agent-share visitor surface on mobile through the shared /agent/:aid route', () => {
    const matches = matchRoutes(mobileRoutes, '/agent/my-agent');

    // Visitor and creator surfaces share this route; `AgentRouteSwitch` picks.
    expect(matches?.some((match) => match.route.path === ':aid')).toBe(true);
    expect(matches?.at(-1)?.params).toMatchObject({ aid: 'my-agent' });
  });

  it('redirects legacy /share/agent links instead of bouncing to the catch-all', () => {
    const matches = matchRoutes(mobileRoutes, '/share/agent/my-agent');
    const element = matches?.at(-1)?.route.element as ReactElement;

    expect(matches?.at(-1)?.route.path).toBe('/share/agent/:slugOrId');
    expect(matches?.at(-1)?.params).toMatchObject({ slugOrId: 'my-agent' });
    expect((element.type as { displayName?: string }).displayName).toBe('AgentShareLegacyRedirect');
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
    expect(source).toContain("import('@/routes/(main)/settings')");
    expect(source).toContain("path: ':tab'");
    expect(source).toContain("path: ':tab/:sub'");
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

describe('mobileRouter workspace provider routes', () => {
  it('registers workspace provider list and path-shaped deep-link redirect', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    // Without these, workspace-aware provider links (`/:slug/settings/provider/:id`)
    // fall through to the mobile `*` route and kick the user out of the workspace.
    expect(source).toContain("import('@/routes/(main)/[workspaceSlug]/settings/provider')");
    // The mobile route must use the mobile variant, otherwise the page renders
    // the desktop 280px provider menu layout on phones.
    expect(source).toContain('m.WorkspaceProviderSettingMobile');
    // The redirect is statically imported: lazy-loading it would flash the
    // generic brand loader before redirecting.
    expect(source).toContain("from '@/features/WorkspaceSetting/ProviderRedirect'");
    expect(source).toContain("path: 'provider'");
    expect(source).toContain("path: 'provider/:providerId'");
  });
});

describe('mobile community route layouts', () => {
  it('wraps shared community list and detail pages in SWR suspense boundaries', async () => {
    const readLayout = (layoutPath: string) =>
      readFile(path.join(process.cwd(), layoutPath), 'utf8');

    const [listLayout, detailLayout] = await Promise.all([
      readLayout('src/routes/(mobile)/community/(list)/_layout/index.tsx'),
      readLayout('src/routes/(mobile)/community/(detail)/_layout/index.tsx'),
    ]);

    for (const source of [listLayout, detailLayout]) {
      expect(source).toContain("import { SWRConfig } from 'swr'");
      expect(source).toContain(
        "import SuspenseRouteBoundary from '@/components/SuspenseRouteBoundary'",
      );
      expect(source).toContain('<SWRConfig value={{ suspense: true }}>');
      expect(source).toContain('<SuspenseRouteBoundary>');
      expect(source).toContain('<Outlet />');
    }
  });
});
