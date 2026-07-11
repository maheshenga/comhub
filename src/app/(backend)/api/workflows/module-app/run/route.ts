import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { ModuleAppWorkflowEngine } from '@/business/server/module-apps/workflows/engine';
import { createModuleAppWorkflowExecutor } from '@/business/server/module-apps/workflows/executors';
import { ModuleAppWorkflowModel } from '@/database/models/moduleAppWorkflow';
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
  const engine = new ModuleAppWorkflowEngine({
    execute: createModuleAppWorkflowExecutor({}),
    repository: new ModuleAppWorkflowModel(db),
  });
  const run = await runModuleAppWorkflowJob({
    dispatch: (input) => ModuleAppWorkflowDispatch.triggerRun(input),
    engine,
    payload: payload.data,
    workerId: `qstash-${randomUUID()}`,
  });
  return Response.json({ run });
};
