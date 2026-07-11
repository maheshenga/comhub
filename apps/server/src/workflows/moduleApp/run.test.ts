// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trigger = vi.fn();

vi.mock('@/envs/app', () => ({
  appEnv: { APP_URL: 'https://app.example.com', INTERNAL_APP_URL: '' },
}));
vi.mock('@/libs/qstash', () => ({ workflowClient: { trigger } }));

describe('ModuleAppWorkflowDispatch', () => {
  beforeEach(() => {
    trigger.mockReset();
    trigger.mockResolvedValue({ workflowRunId: 'qstash-run-1' });
  });

  it('dispatches installation-scoped jobs with serial flow control', async () => {
    const { ModuleAppWorkflowDispatch } = await import('./index');
    await ModuleAppWorkflowDispatch.triggerRun({
      installationId: '00000000-0000-4000-8000-000000000001',
      runId: '00000000-0000-4000-8000-000000000002',
    });
    expect(trigger).toHaveBeenCalledWith({
      body: {
        installationId: '00000000-0000-4000-8000-000000000001',
        runId: '00000000-0000-4000-8000-000000000002',
      },
      flowControl: {
        key: 'module-app.run.00000000-0000-4000-8000-000000000001',
        parallelism: 1,
      },
      url: 'https://app.example.com/api/workflows/module-app/run',
    });
  });

  it('redispatches nonterminal jobs but stops at terminal state', async () => {
    const { runModuleAppWorkflowJob } = await import('./run');
    const dispatch = vi.fn();
    const engine = {
      executeClaimedNode: vi
        .fn()
        .mockResolvedValueOnce({ status: 'running' })
        .mockResolvedValueOnce({ status: 'succeeded' }),
    };
    const payload = {
      installationId: '00000000-0000-4000-8000-000000000001',
      runId: '00000000-0000-4000-8000-000000000002',
    };
    await runModuleAppWorkflowJob({ dispatch, engine: engine as never, payload, workerId: 'worker-1' });
    await runModuleAppWorkflowJob({ dispatch, engine: engine as never, payload, workerId: 'worker-2' });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(payload);
  });
});
