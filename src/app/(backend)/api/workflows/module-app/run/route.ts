import { randomUUID } from 'node:crypto';

import type { ModuleAppCapabilityClaims } from '@lobechat/types';
import { z } from 'zod';

import { ModuleAppHttpGateway } from '@/business/server/module-apps/sdk/http';
import { ModuleAppWorkflowEngine } from '@/business/server/module-apps/workflows/engine';
import { createModuleAppWorkflowExecutor } from '@/business/server/module-apps/workflows/executors';
import { createModuleAppAiWorkflowExecutor } from '@/business/server/module-apps/workflows/executors/ai';
import { createModuleAppFunctionWorkflowExecutor } from '@/business/server/module-apps/workflows/executors/function';
import { createModuleAppHttpWorkflowExecutor } from '@/business/server/module-apps/workflows/executors/http';
import { ModuleAppWorkflowModel } from '@/database/models/moduleAppWorkflow';
import { getServerDB } from '@/database/server';
import { verifyQStashSignature } from '@/libs/qstash';
import { createModuleAppTextGenerator } from '@/server/services/moduleAppAi';
import { ModuleAppWorkflowDispatch } from '@/server/workflows/moduleApp';
import { resolveModuleAppWorkflowEntitlement } from '@/server/workflows/moduleApp/entitlement';
import { runModuleAppWorkflowJob } from '@/server/workflows/moduleApp/run';

const payloadSchema = z.object({
  installationId: z.string().uuid(),
  runId: z.string().uuid(),
});

const workflowFunctionRegistry = Object.freeze({
  passthrough: async (context: { input: Record<string, unknown> }) => context.input,
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
  let entitlement: Awaited<ReturnType<typeof resolveModuleAppWorkflowEntitlement>> | undefined;
  const assertEntitlement = async () => {
    entitlement = await resolveModuleAppWorkflowEntitlement({
      db,
      installationId: payload.data.installationId,
    });
    return entitlement;
  };
  const httpGateway = new ModuleAppHttpGateway();
  const engine = new ModuleAppWorkflowEngine({
    execute: async (context) => {
      const current = entitlement ?? (await assertEntitlement());
      const now = Math.floor(Date.now() / 1000);
      const capability: ModuleAppCapabilityClaims = {
        appId: current.subject.appId,
        aud: 'module-runtime',
        exp: now + 300,
        iat: now,
        installationId: current.installation.installationId,
        nonce: randomUUID(),
        permissions: ['http.fetch'],
        surface: 'browser',
        userId: current.subject.userId!,
        versionId: current.installation.versionId,
        workspaceId: current.subject.workspaceId ?? undefined,
      };
      return createModuleAppWorkflowExecutor({
        ai: createModuleAppAiWorkflowExecutor({
          appMultiplier: current.detail.billing.defaultMultiplier,
          assertEntitlement,
          textGenerator: createModuleAppTextGenerator({
            db,
            workspaceId: current.subject.workspaceId ?? undefined,
          }),
          userId: current.subject.userId!,
        }),
        function: createModuleAppFunctionWorkflowExecutor({
          assertEntitlement,
          registry: workflowFunctionRegistry,
        }),
        http: createModuleAppHttpWorkflowExecutor({
          assertEntitlement,
          request: (input) =>
            httpGateway.request(
              capability,
              {
                appId: current.subject.appId,
                displayName: current.installation.displayName,
                installationId: current.installation.installationId,
                outboundHosts: current.runtime.outboundHosts,
                scopeType: current.subject.scopeType,
                userId: current.subject.userId,
                versionId: current.installation.versionId,
                workspaceId: current.subject.workspaceId,
              },
              input,
            ),
        }),
      })(context);
    },
    repository: new ModuleAppWorkflowModel(db),
  });
  const run = await runModuleAppWorkflowJob({
    assertEntitlement,
    dispatch: (input) => ModuleAppWorkflowDispatch.triggerRun(input),
    engine,
    payload: payload.data,
    workerId: `qstash-${randomUUID()}`,
  });
  return Response.json({ run });
};
