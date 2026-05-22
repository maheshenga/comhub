// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workflowUnavailablePayload = {
  error: 'workflow_unavailable',
  message: 'QSTASH_TOKEN is required to run this workflow endpoint.',
};

const mockWorkflowRuntime = () => {
  const serve = vi.fn(() => vi.fn(() => new Response('workflow')));
  const serveMany = vi.fn(() => vi.fn(() => new Response('workflow')));

  vi.doMock('@upstash/workflow/hono', () => ({
    createWorkflow: vi.fn((routeFunction, options) => ({ options, routeFunction })),
    serve,
    serveMany,
  }));

  vi.doMock('../qstashClient', () => ({
    createWorkflowQstashClient: vi.fn(),
    isWorkflowQstashAvailable: vi.fn(() => false),
    workflowUnavailableResponse: vi.fn(() => (c: any) => c.json(workflowUnavailablePayload, 503)),
  }));

  return { serve, serveMany };
};

describe('workflow route registration without QSTASH_TOKEN', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('QSTASH_TOKEN', '');
  });

  afterEach(() => {
    vi.doUnmock('@upstash/workflow/hono');
    vi.doUnmock('../qstashClient');
    vi.doUnmock('../memory-user-memory/workflows/hourly');
    vi.doUnmock('../memory-user-memory/workflows/personaUpdate');
    vi.doUnmock('../memory-user-memory/workflows/processUsers');
    vi.doUnmock('../memory-user-memory/workflows/processUserTopics');
    vi.doUnmock('../memory-user-memory/workflows/processTopics');
    vi.doUnmock('../memory-user-memory/workflows/processTopic');
    vi.doUnmock('../middlewares/qstashAuth');
    vi.doUnmock('../agent-signal/handlers/scheduleNightlyReview');
    vi.doUnmock('@/server/workflows/agentSignal/run');
    vi.unstubAllEnvs();
  });

  it('does not register memory extraction Upstash handlers when QSTASH_TOKEN is missing', async () => {
    const { serve, serveMany } = mockWorkflowRuntime();

    vi.doMock('../memory-user-memory/workflows/hourly', () => ({
      hourlyWorkflowHandler: vi.fn(),
      hourlyWorkflowOptions: {},
    }));
    vi.doMock('../memory-user-memory/workflows/personaUpdate', () => ({
      personaUpdateHandler: vi.fn(),
    }));
    vi.doMock('../memory-user-memory/workflows/processUsers', () => ({
      processUsersHandler: vi.fn(),
    }));
    vi.doMock('../memory-user-memory/workflows/processUserTopics', () => ({
      processUserTopicsHandler: vi.fn(),
    }));
    vi.doMock('../memory-user-memory/workflows/processTopics', () => ({
      processTopicsHandler: vi.fn(),
    }));
    vi.doMock('../memory-user-memory/workflows/processTopic', () => ({
      processTopicWorkflow: { workflowId: 'process-topic' },
    }));

    const { default: app } = await import('../memory-user-memory');
    const response = await app.request('http://localhost/pipelines/chat-topic/process-users', {
      method: 'POST',
    });

    expect(serve).not.toHaveBeenCalled();
    expect(serveMany).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(workflowUnavailablePayload);
  });

  it('does not register agent signal Upstash handlers when QSTASH_TOKEN is missing', async () => {
    const { serve } = mockWorkflowRuntime();

    vi.doMock('../middlewares/qstashAuth', () => ({
      qstashAuth: () => async (_c: any, next: () => Promise<void>) => next(),
    }));
    vi.doMock('../agent-signal/handlers/scheduleNightlyReview', () => ({
      scheduleNightlyReview: vi.fn(),
    }));
    vi.doMock('@/server/workflows/agentSignal/run', () => ({
      runAgentSignalWorkflow: vi.fn(),
    }));

    const { default: app } = await import('../agent-signal');
    const response = await app.request('http://localhost/run', {
      method: 'POST',
    });

    expect(serve).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(workflowUnavailablePayload);
  });
});
