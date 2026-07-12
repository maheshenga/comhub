// @vitest-environment node
import { moduleAppWorkflowDefinitionSchema } from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import {
  dispatchDueModuleAppSchedules,
  runModuleAppScheduleDispatcher,
} from './scheduleDispatcher';

const workflow = moduleAppWorkflowDefinitionSchema.parse({
  edges: [],
  key: 'candidate_review',
  nodes: [{ config: { functionKey: 'load_candidate' }, key: 'load', type: 'function' }],
  startNodeKey: 'load',
  version: 1,
});

const claim = {
  claimToken: 'claim-token-1',
  claimExpiresAt: new Date('2026-07-12T00:00:30.000Z'),
  id: 'schedule-1',
  installationId: '00000000-0000-4000-8000-000000000001',
  schedule: '*/15 * * * *',
  scheduledFor: new Date('2026-07-12T00:00:00.000Z'),
  timezone: 'UTC',
  workflow,
  workflowKey: 'candidate_review',
  workflowVersion: 1,
};

describe('runModuleAppScheduleDispatcher', () => {
  it('fails before claiming work when schedule dispatch is disabled', async () => {
    await expect(
      dispatchDueModuleAppSchedules({ db: {} as any, enabled: false }),
    ).rejects.toThrow('MODULE_APP_SCHEDULE_DISPATCH_DISABLED');
  });

  it('claims a bounded batch, starts idempotently, dispatches, and advances next run', async () => {
    const repository = {
      claimDueSchedules: vi.fn().mockResolvedValue([claim]),
      completeScheduleClaim: vi.fn().mockResolvedValue({ ok: true }),
      releaseScheduleClaim: vi.fn(),
    };
    const start = vi.fn().mockResolvedValue({ id: 'run-1' });
    const dispatch = vi.fn().mockResolvedValue({ workflowRunId: 'qstash-1' });
    const recordBacklog = vi.fn();

    await expect(
      runModuleAppScheduleDispatcher({
        batchSize: 500,
        dispatch,
        now: new Date('2026-07-12T00:00:00.000Z'),
        recordBacklog,
        repository,
        start,
      }),
    ).resolves.toEqual({ claimed: 1, dispatched: 1, failed: 0, bookkeepingFailed: 0 });
    expect(repository.claimDueSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
    expect(recordBacklog).toHaveBeenCalledWith(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'module-app-schedule:schedule-1:2026-07-12T00:00:00.000Z',
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      installationId: claim.installationId,
      runId: 'run-1',
    }, { workflowRunId: 'run-1' });
    expect(repository.completeScheduleClaim).toHaveBeenCalledWith({
      claimToken: claim.claimToken,
      claimExpiresAt: claim.claimExpiresAt,
      nextRunAt: new Date('2026-07-12T00:15:00.000Z'),
      scheduleId: claim.id,
    });
  });

  it('releases a claim after failed dispatch so it can be retried', async () => {
    const repository = {
      claimDueSchedules: vi.fn().mockResolvedValue([claim]),
      completeScheduleClaim: vi.fn(),
      releaseScheduleClaim: vi.fn().mockResolvedValue({ ok: true }),
    };

    await expect(
      runModuleAppScheduleDispatcher({
        dispatch: vi.fn().mockRejectedValue(new Error('qstash unavailable')),
        now: new Date('2026-07-12T00:00:00.000Z'),
        repository,
        start: vi.fn().mockResolvedValue({ id: 'run-1' }),
      }),
    ).resolves.toEqual({ claimed: 1, dispatched: 0, failed: 1, bookkeepingFailed: 0 });
    expect(repository.releaseScheduleClaim).toHaveBeenCalledWith({
      claimToken: claim.claimToken,
      claimExpiresAt: claim.claimExpiresAt,
      retryAt: new Date('2026-07-12T00:00:00.000Z'),
      scheduleId: claim.id,
    });
  });

  it('does not release a claim after dispatch succeeds but completion bookkeeping fails', async () => {
    const repository = {
      claimDueSchedules: vi.fn().mockResolvedValue([claim]),
      completeScheduleClaim: vi.fn().mockRejectedValue(new Error('database unavailable')),
      releaseScheduleClaim: vi.fn(),
    };

    await expect(
      runModuleAppScheduleDispatcher({
        dispatch: vi.fn().mockResolvedValue({ workflowRunId: 'qstash-1' }),
        now: new Date('2026-07-12T00:00:00.000Z'),
        repository,
        start: vi.fn().mockResolvedValue({ id: 'run-1' }),
      }),
    ).resolves.toEqual({ claimed: 1, dispatched: 1, failed: 0, bookkeepingFailed: 1 });
    expect(repository.releaseScheduleClaim).not.toHaveBeenCalled();
  });
});
