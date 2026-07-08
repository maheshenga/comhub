// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppArtifacts,
  moduleAppEntitlements,
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
        moduleMultiplier: 1,
        name: 'Create',
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
        key: 'overview',
        routePath: '/',
        title: 'Overview',
        type: 'overview',
      },
      {
        key: 'records',
        routePath: '/records',
        title: 'Records',
        type: 'list',
      },
    ],
    slug: 'record-desk',
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
      pages: [{ key: 'overview', routePath: '/', title: 'Overview', type: 'overview' }],
      slug: 'hidden-desk',
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
    expect(detail?.actions.map((action) => action.id)).toEqual(['create_record']);
    expect(detail?.entitlements).toEqual(
      expect.arrayContaining([expect.objectContaining({ plan: 'free', visible: true })]),
    );
  });

  it('isolates personal and workspace records and hides archived records', async () => {
    const app = await createRecordDesk();

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

    await expect(
      model.listRecords({
        appId: app.id,
        collectionKey: 'records',
        scopeType: 'personal',
        userId,
      }),
    ).resolves.toEqual([]);

    await expect(
      model.listRecords({
        appId: app.id,
        collectionKey: 'records',
        scopeType: 'workspace',
        userId,
        workspaceId,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: workspace.id, title: 'Team A' })]);

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
      mimeType: 'text/plain',
      runId: run.id,
      scopeType: 'personal',
      sizeBytes: 12,
      storageKey: 'module-app/result.txt',
      userId,
    });

    const runs = await model.listRuns({ appId: app.id, userId });
    expect(runs.items).toEqual([
      expect.objectContaining({
        outputSnapshot: { preview: 'Created A' },
        status: 'succeeded',
      }),
    ]);

    const artifacts = await model.listArtifacts({ appId: app.id, userId });
    expect(artifacts.items).toEqual([
      expect.objectContaining({
        fileName: 'result.txt',
        runId: run.id,
      }),
    ]);
  });
});
