import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { assertModuleAppEntitlement } from '@/business/server/module-apps/entitlement';
import { ModuleAppWorkflowEngine } from '@/business/server/module-apps/workflows/engine';
import { createModuleAppWorkflowExecutor } from '@/business/server/module-apps/workflows/executors';
import { getSubscriptionPlan } from '@/business/server/user';
import { ModuleAppModel } from '@/database/models/moduleApp';
import { ModuleAppWorkflowModel } from '@/database/models/moduleAppWorkflow';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { getServerDB } from '@/database/server';
import { verifyQStashSignature } from '@/libs/qstash';
import { ModuleAppWorkflowDispatch } from '@/server/workflows/moduleApp';
import { runModuleAppWorkflowJob } from '@/server/workflows/moduleApp/run';

const payloadSchema = z.object({
  installationId: z.string().uuid(),
  runId: z.string().uuid(),
});

export const POST = async (request: Request) => {
  const rawBody = await request.text();
  if (!(await verifyQStashSignature(request, rawBody))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const payload = payloadSchema.safeParse(json);
  if (!payload.success) return Response.json({ error: 'invalid_payload' }, { status: 400 });
  const db = await getServerDB();
  const moduleAppModel = new ModuleAppModel(db);
  const engine = new ModuleAppWorkflowEngine({
    execute: createModuleAppWorkflowExecutor({}),
    repository: new ModuleAppWorkflowModel(db),
  });
  const run = await runModuleAppWorkflowJob({
    assertEntitlement: async () => {
      const subject = await moduleAppModel.getInstallationEntitlementSubject({
        installationId: payload.data.installationId,
      });
      if (!subject?.userId) throw new Error('MODULE_APP_INSTALLATION_REQUIRED');

      const plan = await getSubscriptionPlan(db, subject.userId);
      const detail = await moduleAppModel.getAppDetail({
        appIdOrSlug: subject.appId,
        includeHidden: true,
        plan,
        userId: subject.userId,
        workspaceId: subject.workspaceId ?? undefined,
      });
      if (!detail) throw new Error('MODULE_APP_ENTITLEMENT_SUSPENDED');

      const membership = subject.workspaceId
        ? await new WorkspaceMemberModel(db, subject.userId).getMember(
            subject.workspaceId,
            subject.userId,
          )
        : undefined;
      assertModuleAppEntitlement({
        appStatus: detail.status,
        installation: { active: detail.installed },
        operation: 'job',
        planIncluded: detail.planState.runnable,
        teamMembership: subject.workspaceId ? { active: Boolean(membership) } : undefined,
        workspaceScoped: Boolean(subject.workspaceId),
      });
    },
    dispatch: (input) => ModuleAppWorkflowDispatch.triggerRun(input),
    engine,
    payload: payload.data,
    workerId: `qstash-${randomUUID()}`,
  });
  return Response.json({ run });
};
