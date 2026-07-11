import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  moduleAppExecutableRuntimeSchema,
  type ModuleAppWorkflowDefinition,
} from '@lobechat/types';

import { ModuleAppWorkflowEngine } from '@/business/server/module-apps/workflows/engine';
import { createModuleAppWorkflowExecutor } from '@/business/server/module-apps/workflows/executors';
import { ModuleAppTriggerModel } from '@/database/models/moduleAppTrigger';
import { ModuleAppWorkflowModel } from '@/database/models/moduleAppWorkflow';
import { getServerDB } from '@/database/server';
import { ModuleAppWorkflowDispatch } from '@/server/workflows/moduleApp';

type WebhookContext = {
  installationId: string;
  replayWindowSeconds: number;
  secretHash: string;
  status: string;
  workflow: ModuleAppWorkflowDefinition;
};

type RouteContext = { params: Promise<{ webhookId: string }> };

const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });

const verifySignature = (input: {
  rawBody: string;
  secretHash: string;
  signature: string;
  timestamp: number;
}) => {
  if (!/^[a-f0-9]{64}$/i.test(input.secretHash)) return false;
  const expected = createHmac('sha256', Buffer.from(input.secretHash, 'hex'))
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest();
  const receivedHex = input.signature.replace(/^sha256=/, '');
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;
  const received = Buffer.from(receivedHex, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const createModuleAppWebhookHandler = (dependencies: {
  acceptDelivery: (input: {
    deliveryId: string;
    payloadSha256: string;
    receivedAt: Date;
    webhookId: string;
  }) => Promise<{ duplicate: boolean }>;
  dispatch: (input: { installationId: string; runId: string }) => Promise<unknown>;
  getWebhook: (webhookId: string) => Promise<null | WebhookContext>;
  now?: () => Date;
  start: (input: {
    idempotencyKey: string;
    input: Record<string, unknown>;
    installationId: string;
    workflow: ModuleAppWorkflowDefinition;
  }) => Promise<{ id: string }>;
  updateDelivery: (input: {
    deliveryId: string;
    status: 'failed' | 'processed';
    webhookId: string;
  }) => Promise<unknown>;
}) => async (request: Request, context: RouteContext) => {
  const { webhookId } = await context.params;
  const webhook = await dependencies.getWebhook(webhookId);
  if (!webhook || webhook.status !== 'active') return new Response(null, { status: 404 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }
  const timestamp = Number(request.headers.get('x-module-app-timestamp'));
  const signature = request.headers.get('x-module-app-signature') ?? '';
  const deliveryId = request.headers.get('x-module-app-delivery') ?? '';
  const now = dependencies.now?.() ?? new Date();
  if (
    !Number.isInteger(timestamp) ||
    !deliveryId ||
    deliveryId.length > 160 ||
    Math.abs(Math.floor(now.getTime() / 1000) - timestamp) > webhook.replayWindowSeconds ||
    !verifySignature({ rawBody, secretHash: webhook.secretHash, signature, timestamp })
  ) {
    return unauthorized();
  }
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('module app webhook payload must be an object');
    }
    payload = parsed;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const accepted = await dependencies.acceptDelivery({
    deliveryId,
    payloadSha256: createHash('sha256').update(rawBody).digest('hex'),
    receivedAt: now,
    webhookId,
  });
  if (accepted.duplicate) return Response.json({ duplicate: true }, { status: 202 });
  try {
    const run = await dependencies.start({
      idempotencyKey: `${webhookId}:${deliveryId}`,
      input: payload,
      installationId: webhook.installationId,
    workflow: webhook.workflow,
    });
    await dependencies.dispatch({ installationId: webhook.installationId, runId: run.id });
    await dependencies.updateDelivery({ deliveryId, status: 'processed', webhookId });
    return Response.json({ duplicate: false, runId: run.id }, { status: 202 });
  } catch {
    await dependencies.updateDelivery({ deliveryId, status: 'failed', webhookId });
    return Response.json({ error: 'dispatch_failed' }, { status: 500 });
  }
};

export const POST = createModuleAppWebhookHandler({
  acceptDelivery: async (input) => {
    const db = await getServerDB();
    return new ModuleAppTriggerModel(db).acceptWebhookDelivery(input);
  },
  dispatch: (input) => ModuleAppWorkflowDispatch.triggerRun(input),
  getWebhook: async (webhookId) => {
    const db = await getServerDB();
    const row = await new ModuleAppTriggerModel(db).getWebhookContext(webhookId);
    if (!row) return null;
    const runtime = moduleAppExecutableRuntimeSchema.safeParse(
      row.runtimeManifest && typeof row.runtimeManifest === 'object' && 'runtime' in row.runtimeManifest
        ? row.runtimeManifest.runtime
        : row.runtimeManifest,
    );
    if (!runtime.success) return null;
    const workflow = runtime.data.workflows?.find(
      (item) => item.key === row.workflowKey && item.version === row.workflowVersion,
    );
    if (!workflow) return null;
    return { ...row, workflow };
  },
  start: async (input) => {
    const db = await getServerDB();
    return new ModuleAppWorkflowEngine({
      execute: createModuleAppWorkflowExecutor({}),
      repository: new ModuleAppWorkflowModel(db),
    }).start(input);
  },
  updateDelivery: async (input) => {
    const db = await getServerDB();
    return new ModuleAppTriggerModel(db).updateWebhookDelivery(input);
  },
});
