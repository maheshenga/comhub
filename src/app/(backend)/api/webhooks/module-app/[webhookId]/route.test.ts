// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';

import { moduleAppWorkflowDefinitionSchema } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import { createModuleAppWebhookHandler } from './route';

const WEBHOOK_ID = '00000000-0000-4000-8000-000000000001';
const secret = 'module-app-webhook-secret';
const secretHash = createHash('sha256').update(secret).digest('hex');
const rawBody = JSON.stringify({ candidateId: 'candidate-1' });
const nowSeconds = 1_783_760_000;
const signature = (timestamp: number) =>
  createHmac('sha256', Buffer.from(secretHash, 'hex'))
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

const request = (timestamp: number, deliveryId = 'delivery-1') =>
  new Request(`https://app.example.com/api/webhooks/module-app/${WEBHOOK_ID}`, {
    body: rawBody,
    headers: {
      'content-type': 'application/json',
      'x-module-app-delivery': deliveryId,
      'x-module-app-signature': `sha256=${signature(timestamp)}`,
      'x-module-app-timestamp': String(timestamp),
    },
    method: 'POST',
  });

const createHandler = (duplicate = false) => {
  const acceptDelivery = vi.fn().mockResolvedValue({ duplicate });
  const dispatch = vi.fn().mockResolvedValue({ workflowRunId: 'qstash-run-1' });
  const start = vi.fn().mockResolvedValue({ id: 'workflow-run-1' });
  const updateDelivery = vi.fn().mockResolvedValue({ status: 'processed' });
  const handler = createModuleAppWebhookHandler({
    acceptDelivery,
    dispatch,
    getWebhook: vi.fn().mockResolvedValue({
      installationId: '00000000-0000-4000-8000-000000000010',
      replayWindowSeconds: 300,
      secretHash,
      status: 'active',
      workflow: moduleAppWorkflowDefinitionSchema.parse({
        edges: [],
        key: 'candidate_review',
        nodes: [{ config: {}, key: 'load', type: 'function' }],
        startNodeKey: 'load',
        version: 1,
      }),
    }),
    now: () => new Date(nowSeconds * 1000),
    start,
    updateDelivery,
  });
  return { acceptDelivery, dispatch, handler, start, updateDelivery };
};

describe('module app webhook route', () => {
  it('rejects expired timestamps', async () => {
    const { handler } = createHandler();
    const response = await handler(request(nowSeconds - 301), {
      params: Promise.resolve({ webhookId: WEBHOOK_ID }),
    });
    expect(response.status).toBe(401);
  });

  it('accepts one signed delivery and dispatches its workflow', async () => {
    const { dispatch, handler, start } = createHandler();
    const response = await handler(request(nowSeconds), {
      params: Promise.resolve({ webhookId: WEBHOOK_ID }),
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ duplicate: false, runId: 'workflow-run-1' });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `${WEBHOOK_ID}:delivery-1` }),
    );
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('acknowledges duplicate deliveries without dispatching twice', async () => {
    const { dispatch, handler, start } = createHandler(true);
    const response = await handler(request(nowSeconds), {
      params: Promise.resolve({ webhookId: WEBHOOK_ID }),
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true });
    expect(start).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
