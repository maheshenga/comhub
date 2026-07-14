// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppArtifacts,
  moduleAppEntitlements,
  moduleAppInstallations,
  moduleAppRecordEvents,
  moduleApps,
  moduleAppVersions,
  users,
  workspaces,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppModel } from '../moduleApp';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new ModuleAppModel(serverDB);

const userId = 'module-app-user';
const otherUserId = 'module-app-other-user';
const workspaceId = 'module-app-workspace';
const baseBilling = {
  chargeMode: 'free' as const,
  defaultMultiplier: 1,
  externalApiCostCredits: 0,
  failureFixedFeePolicy: 'do_not_charge' as const,
  fixedServiceFeeCredits: 0,
};

beforeEach(async () => {
  await serverDB.delete(moduleApps);
  await serverDB.delete(workspaces);
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: otherUserId }]);
  await serverDB.insert(workspaces).values({
    id: workspaceId,
    name: 'Module App Team',
    primaryOwnerId: userId,
    slug: workspaceId,
  });
});

const createRecordDesk = async () => {
  const app = await model.upsertAppForAdmin({
    actions: [
      {
        id: 'create_record',
        inputSchema: { fields: [] },
        moduleMultiplier: 1.35,
        name: 'Create',
        outputSchema: {},
        runtimeConfig: {},
        runtimeType: 'record_create',
      },
    ],
    appType: 'standard_app',
    billing: baseBilling,
    category: 'productivity',
    description: 'A saved records app',
    displayName: 'Record Desk',
    icon: 'Notebook',
    pages: [
      {
        actionBindings: [],
        dataSource: {},
        key: 'overview',
        layoutSchema: {},
        routePath: '/',
        sortOrder: 0,
        title: 'Overview',
        type: 'overview',
      },
      {
        actionBindings: [],
        dataSource: {},
        key: 'records',
        layoutSchema: {},
        routePath: '/records',
        sortOrder: 1,
        title: 'Records',
        type: 'list',
      },
    ],
    slug: 'record-desk',
    source: 'admin',
    status: 'published',
    tags: ['records'],
  });

  await serverDB.insert(moduleAppEntitlements).values({
    appId: app.id,
    installable: true,
    plan: 'free',
    runnable: true,
    visible: true,
  });

  return app;
};

describe('ModuleAppModel marketplace behavior', () => {
  it('lists only published module apps visible to a plan', async () => {
    await createRecordDesk();

    const hidden = await model.upsertAppForAdmin({
      actions: [],
      appType: 'standard_app',
      billing: baseBilling,
      category: 'productivity',
      description: 'Hidden app',
      displayName: 'Hidden Desk',
      icon: 'Notebook',
      pages: [
        {
          actionBindings: [],
          dataSource: {},
          key: 'overview',
          layoutSchema: {},
          routePath: '/',
          sortOrder: 0,
          title: 'Overview',
          type: 'overview',
        },
      ],
      slug: 'hidden-desk',
      source: 'admin',
      status: 'published',
      tags: ['records'],
    });
    await serverDB.insert(moduleAppEntitlements).values({
      appId: hidden.id,
      plan: 'free',
      visible: false,
    });

    const rows = await model.listMarketplaceApps({ plan: 'free', userId });

    expect(rows.map((item) => item.slug)).toEqual(['record-desk']);
    expect(rows[0]).toMatchObject({
      appType: 'standard_app',
      installed: false,
      planState: { installable: true, runnable: true, visible: true },
      status: 'published',
    });

    await expect(
      model.listMarketplaceApps({ includeHidden: true, plan: 'free', userId }),
    ).resolves.toEqual([
      expect.objectContaining({ slug: 'hidden-desk' }),
      expect.objectContaining({ slug: 'record-desk' }),
    ]);
  });

  it('returns app detail with pages, actions, entitlements, and installation state', async () => {
    const app = await createRecordDesk();
    const [version] = await serverDB
      .select({ id: moduleAppVersions.id })
      .from(moduleAppVersions)
      .where(eq(moduleAppVersions.appId, app.id));

    await model.installApp({
      appId: app.id,
      scopeType: 'personal',
      userId,
      versionId: version!.id,
    });

    const detail = await model.getAppDetail({
      appIdOrSlug: 'record-desk',
      plan: 'free',
      userId,
    });

    expect(detail).toMatchObject({
      description: 'A saved records app',
      installed: true,
      slug: 'record-desk',
    });
    expect(detail?.pages.map((page) => page.key)).toEqual(['overview', 'records']);
    expect(detail?.actions).toEqual([
      expect.objectContaining({ id: 'create_record', moduleMultiplier: 1.35 }),
    ]);
    expect(detail?.entitlements).toEqual(
      expect.arrayContaining([expect.objectContaining({ plan: 'free', visible: true })]),
    );
  });

  it('lists and uninstalls personal module apps', async () => {
    const app = await createRecordDesk();
    const [version] = await serverDB
      .select({ id: moduleAppVersions.id })
      .from(moduleAppVersions)
      .where(eq(moduleAppVersions.appId, app.id));

    await model.installPersonalApp({ appId: app.id, userId });

    await expect(model.listInstalledApps({ scopeType: 'personal', userId })).resolves.toEqual([
      expect.objectContaining({ id: app.id, installed: true, slug: 'record-desk' }),
    ]);

    await model.uninstallPersonalApp({ appId: app.id, userId });

    await expect(model.listInstalledApps({ scopeType: 'personal', userId })).resolves.toEqual([]);
    await expect(
      serverDB.query.moduleAppInstallations.findFirst({
        where: eq(moduleAppInstallations.versionId, version!.id),
      }),
    ).resolves.toMatchObject({ status: 'uninstalled' });
  });

  it('returns admin list/detail data and updates status/entitlements', async () => {
    const app = await createRecordDesk();

    await expect(model.listAdminApps({ status: 'published' })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: app.id, slug: 'record-desk' })],
      nextCursor: null,
    });

    await expect(model.getAdminApp({ appId: app.id })).resolves.toMatchObject({
      actions: expect.arrayContaining([expect.objectContaining({ id: 'create_record' })]),
      entitlements: expect.arrayContaining([
        expect.objectContaining({ plan: 'free', runnable: true }),
      ]),
      id: app.id,
      pages: expect.arrayContaining([expect.objectContaining({ key: 'overview' })]),
      version: '1.0.0',
    });

    await model.setStatus({ appId: app.id, status: 'unpublished' });
    await expect(model.getAdminApp({ appId: app.id })).resolves.toMatchObject({
      status: 'unpublished',
    });

    await model.upsertEntitlementsForAdmin({
      appId: app.id,
      entitlements: [
        {
          discountPercent: 20,
          freeQuotaCredits: 100,
          installable: false,
          plan: 'premium',
          runnable: true,
          visible: true,
        },
      ],
    });

    await expect(model.getAdminApp({ appId: app.id })).resolves.toMatchObject({
      entitlements: expect.arrayContaining([
        expect.objectContaining({ discountPercent: 20, plan: 'premium' }),
      ]),
    });
  });

  it('isolates personal and workspace records and hides archived records', async () => {
    const app = await createRecordDesk();
    const version = await serverDB.query.moduleAppVersions.findFirst({
      where: eq(moduleAppVersions.appId, app.id),
    });
    if (!version) throw new Error('module_app_test_version_missing');
    await model.installPersonalApp({ appId: app.id, userId });
    await model.installPersonalApp({ appId: app.id, userId: otherUserId });
    await model.installApp({
      appId: app.id,
      scopeType: 'workspace',
      userId,
      versionId: version.id,
      workspaceId,
    });

    const personal = await model.createRecord({
      appId: app.id,
      collectionKey: 'records',
      data: { title: 'Personal A' },
      scopeType: 'personal',
      title: 'Personal A',
      userId,
    });
    await model.createRecord({
      appId: app.id,
      collectionKey: 'records',
      data: { title: 'Other Personal' },
      scopeType: 'personal',
      title: 'Other Personal',
      userId: otherUserId,
    });
    const workspace = await model.createRecord({
      appId: app.id,
      collectionKey: 'records',
      data: { title: 'Team A' },
      scopeType: 'workspace',
      title: 'Team A',
      userId,
      workspaceId,
    });

    await model.archiveRecord({ appId: app.id, recordId: personal.id, userId });

    await expect(model.getRecord({ appId: app.id, recordId: personal.id, userId })).resolves.toBeNull();
    await expect(
      model.getRecord({ appId: app.id, recordId: workspace.id, userId, workspaceId }),
    ).resolves.toMatchObject({ id: workspace.id, scopeType: 'workspace' });

    await expect(
      model.listRecords({
        appId: app.id,
        collectionKey: 'records',
        limit: 20,
        offset: 0,
        scopeType: 'personal',
        userId,
      }),
    ).resolves.toEqual({ items: [], total: 0 });

    await expect(
      model.listRecords({
        appId: app.id,
        collectionKey: 'records',
        limit: 20,
        offset: 0,
        scopeType: 'workspace',
        userId,
        workspaceId,
      }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: workspace.id, title: 'Team A' })],
      total: 1,
    });

    const events = await serverDB.query.moduleAppRecordEvents.findMany({
      where: eq(moduleAppRecordEvents.appId, app.id),
    });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      'archived',
      'created',
      'created',
      'created',
    ]);
  });

  it('persists run updates and lists artifacts by user scope', async () => {
    const app = await createRecordDesk();
    await model.installPersonalApp({ appId: app.id, userId });
    const run = await model.createRun({
      actionId: 'create_record',
      appId: app.id,
      input: { title: 'A' },
      scopeType: 'personal',
      userId,
    });

    await model.updateRun({
      billing: { chargedCredits: 0 },
      output: { preview: 'Created A' },
      runId: run.id,
      status: 'succeeded',
    });
    await serverDB.insert(moduleAppArtifacts).values({
      appId: app.id,
      fileName: 'result.txt',
      installationId: run.installationId,
      mimeType: 'text/plain',
      runId: run.id,
      scopeType: 'personal',
      sizeBytes: 12,
      storageKey: 'module-app/result.txt',
      userId,
    });

    const runs = await model.listRuns({ installationId: run.installationId!, userId });
    expect(runs.items).toEqual([
      expect.objectContaining({
        outputSnapshot: { preview: 'Created A' },
        status: 'succeeded',
      }),
    ]);

    const artifacts = await model.listArtifacts({ installationId: run.installationId!, userId });
    expect(artifacts.items).toEqual([
      expect.objectContaining({
        fileName: 'result.txt',
        runId: run.id,
      }),
    ]);
  });

  it('rejects new records when no active installation owns the scope', async () => {
    const app = await createRecordDesk();

    await expect(
      model.createRecord({
        appId: app.id,
        collectionKey: 'records',
        data: { title: 'Unowned' },
        scopeType: 'personal',
        userId,
      }),
    ).rejects.toThrow('MODULE_APP_INSTALLATION_REQUIRED');
  });
});
