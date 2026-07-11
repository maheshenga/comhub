// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  moduleAppInstallations,
  moduleApps,
  moduleAppVersions,
  moduleAppWorkflowNodes,
  moduleAppWorkflowRuns,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ModuleAppWorkflowModel } from '../moduleAppWorkflow';

const USER_ID = 'module-app-workflow-user';
let now = new Date('2026-07-11T02:00:00.000Z');
const serverDB: LobeChatDatabase = await getTestDB();

const createInstallation = async () => {
  const [app] = await serverDB
    .insert(moduleApps)
    .values({
      appType: 'workflow_app',
      category: 'business',
      description: 'Workflow test.',
      displayName: 'Workflow',
      icon: 'Workflow',
      slug: `workflow-${crypto.randomUUID()}`,
    })
    .returning();
  const [version] = await serverDB
    .insert(moduleAppVersions)
    .values({ appId: app.id, version: '1.0.0' })
    .returning();
  const [installation] = await serverDB
    .insert(moduleAppInstallations)
    .values({ appId: app.id, scopeType: 'personal', userId: USER_ID, versionId: version.id })
    .returning();
  return installation;
};

beforeEach(async () => {
  now = new Date('2026-07-11T02:00:00.000Z');
  await serverDB.delete(moduleAppWorkflowNodes);
  await serverDB.delete(moduleAppWorkflowRuns);
  await serverDB.delete(moduleAppInstallations);
  await serverDB.delete(moduleAppVersions);
  await serverDB.delete(moduleApps);
  await serverDB.delete(users);
  await serverDB.insert(users).values({ id: USER_ID });
});

describe('ModuleAppWorkflowModel', () => {
  it('claims one runnable node and keeps runs installation-bound', async () => {
    const installationA = await createInstallation();
    const installationB = await createInstallation();
    const model = new ModuleAppWorkflowModel(serverDB, { now: () => now });
    const run = await model.createRun({
      idempotencyKey: 'request-1',
      installationId: installationA.id,
      nodes: [{ key: 'load', maxAttempts: 2 }],
      workflowKey: 'candidate_review',
      workflowVersion: 1,
    });

    await expect(model.claimRunnableNode({ workerId: 'worker-a' })).resolves.toMatchObject({
      attempt: 1,
      nodeKey: 'load',
      runId: run.id,
      status: 'running',
      workerId: 'worker-a',
    });
    await expect(model.claimRunnableNode({ workerId: 'worker-b' })).resolves.toBeNull();
    await expect(
      model.getRun({ installationId: installationB.id, runId: run.id }),
    ).resolves.toBeNull();
    await expect(
      serverDB.insert(moduleAppWorkflowNodes).values({
        installationId: installationB.id,
        nodeKey: 'cross-installation',
        runId: run.id,
      }),
    ).rejects.toThrow();
  });

  it('reclaims an expired lease without exceeding the retry limit', async () => {
    const installation = await createInstallation();
    const model = new ModuleAppWorkflowModel(serverDB, { leaseMs: 1000, now: () => now });
    await model.createRun({
      idempotencyKey: 'request-2',
      installationId: installation.id,
      nodes: [{ key: 'load', maxAttempts: 2 }],
      workflowKey: 'candidate_review',
      workflowVersion: 1,
    });

    await expect(model.claimRunnableNode({ workerId: 'worker-a' })).resolves.toMatchObject({ attempt: 1 });
    now = new Date(now.getTime() + 1001);
    await expect(model.claimRunnableNode({ workerId: 'worker-b' })).resolves.toMatchObject({ attempt: 2 });
    now = new Date(now.getTime() + 1001);
    await expect(model.claimRunnableNode({ workerId: 'worker-c' })).resolves.toBeNull();
  });
});
