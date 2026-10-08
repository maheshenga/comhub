import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { scheduleDispatch } from '../scheduleDispatch';

const mocks = vi.hoisted(() => ({
  appEnv: { enableQueueAgentRuntime: false },
  dispatchDueModuleAppSchedules: vi.fn(),
  getScheduledTasks: vi.fn(),
  getServerDB: vi.fn(),
  publishJSON: vi.fn(),
  runScheduleTick: vi.fn(),
  swapDispatchedScheduleOccurrence: vi.fn(),
}));

vi.mock('@/database/server', () => ({ getServerDB: mocks.getServerDB }));

vi.mock('@/database/models/task', () => ({
  TaskModel: {
    getScheduledTasks: mocks.getScheduledTasks,
    swapDispatchedScheduleOccurrence: mocks.swapDispatchedScheduleOccurrence,
  },
}));

vi.mock('@/envs/app', () => ({ appEnv: mocks.appEnv }));

vi.mock('@/libs/qstash', () => ({ qstashClient: { publishJSON: mocks.publishJSON } }));

vi.mock('@/server/services/taskRunner/scheduleTick', () => ({
  runScheduleTick: mocks.runScheduleTick,
}));

vi.mock('@/server/workflows/moduleApp/scheduleDispatcher', () => ({
  dispatchDueModuleAppSchedules: mocks.dispatchDueModuleAppSchedules,
}));

const dispatch = async (dryRun: boolean) => {
  const app = new Hono();
  app.post('/schedule-dispatch', scheduleDispatch);
  const res = await app.request('/schedule-dispatch', {
    body: JSON.stringify({ dryRun }),
    method: 'POST',
  });
  return {
    status: res.status,
    ...((await res.json()) as { dispatched: number; due: number; total: number }),
  };
};

/** Same as {@link dispatch} but keeps the Response so tests can read extra fields. */
const rawDispatch = async (dryRun: boolean) => {
  const app = new Hono();
  app.post('/schedule-dispatch', scheduleDispatch);
  return app.request('/schedule-dispatch', {
    body: JSON.stringify({ dryRun }),
    method: 'POST',
  });
};

const dryRun = () => dispatch(true);

const dailyNineTask = (context: unknown) => ({
  context,
  createdByUserId: 'user-1',
  id: 'task-1',
  identifier: 'T-1',
  lastHeartbeatAt: null,
  schedulePattern: '0 9 * * *',
  scheduleTimezone: 'UTC',
});

describe('scheduleDispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The 09:10 tick, right after a 09:00 slot.
    vi.setSystemTime(new Date('2026-09-21T09:10:00Z'));
    mocks.getServerDB.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.appEnv.enableQueueAgentRuntime = false;
  });

  it('does not fire a slot that passed before the schedule was armed', async () => {
    mocks.getScheduledTasks.mockResolvedValue([
      dailyNineTask({ scheduler: { scheduleStartedAt: '2026-09-21T09:05:00.000Z' } }),
    ]);

    expect(await dryRun()).toMatchObject({ due: 0, total: 1 });
  });

  it('fires the slot when the schedule was armed before it', async () => {
    mocks.getScheduledTasks.mockResolvedValue([
      dailyNineTask({ scheduler: { scheduleStartedAt: '2026-09-21T08:55:00.000Z' } }),
    ]);

    expect(await dryRun()).toMatchObject({ due: 1, total: 1 });
  });

  it('keeps firing tasks that were armed before the stamp existed', async () => {
    mocks.getScheduledTasks.mockResolvedValue([dailyNineTask(null)]);

    expect(await dryRun()).toMatchObject({ due: 1, total: 1 });
  });

  describe('occurrence reservation', () => {
    const armed = { scheduleStartedAt: '2026-09-21T08:55:00.000Z' };

    beforeEach(() => {
      mocks.appEnv.enableQueueAgentRuntime = true;
      vi.stubEnv('APP_URL', 'https://app.test');
      mocks.publishJSON.mockResolvedValue({ messageId: 'msg-1' });
    });

    it('does not re-dispatch an occurrence whose delivery is still queued', async () => {
      // The 09:00 occurrence was published on the 09:00 tick but its run has
      // not started, so lastHeartbeatAt still predates it on the 09:10 tick.
      mocks.getScheduledTasks.mockResolvedValue([
        dailyNineTask({
          scheduler: { ...armed, lastDispatchedOccurrenceAt: '2026-09-21T09:00:00.000Z' },
        }),
      ]);

      expect(await dryRun()).toMatchObject({ due: 0, total: 1 });
    });

    it('reserves the occurrence before publishing it', async () => {
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);

      expect(await dispatch(false)).toMatchObject({ dispatched: 1, due: 1 });
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenCalledWith(
        {},
        'task-1',
        null,
        '2026-09-21T09:00:00.000Z',
      );
      expect(mocks.publishJSON).toHaveBeenCalledTimes(1);
    });

    it('does not publish when another dispatcher already reserved the occurrence', async () => {
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(false);

      expect(await dispatch(false)).toMatchObject({ dispatched: 0, due: 1 });
      expect(mocks.publishJSON).not.toHaveBeenCalled();
    });

    it('releases the reservation when publishing fails', async () => {
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);
      mocks.publishJSON.mockRejectedValue(new Error('qstash down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(await dispatch(false)).toMatchObject({ dispatched: 0, due: 1 });
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenLastCalledWith(
        {},
        'task-1',
        '2026-09-21T09:00:00.000Z',
        null,
      );
    });

    it('releases every reservation when APP_URL is missing', async () => {
      vi.stubEnv('APP_URL', '');
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(await dispatch(false)).toMatchObject({ status: 500 });
      expect(mocks.publishJSON).not.toHaveBeenCalled();
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenCalledTimes(2);
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenLastCalledWith(
        {},
        'task-1',
        '2026-09-21T09:00:00.000Z',
        null,
      );
    });
  });

  describe('inline dispatch', () => {
    const armed = { scheduleStartedAt: '2026-09-21T08:55:00.000Z' };

    it('keeps the reservation when the tick succeeds', async () => {
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);
      mocks.runScheduleTick.mockResolvedValue({ ran: true, taskIdentifier: 'T-1' });

      expect(await dispatch(false)).toMatchObject({ dispatched: 1, due: 1 });
      expect(mocks.runScheduleTick).toHaveBeenCalledWith('task-1', 'user-1');
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenCalledTimes(1);
    });

    it('releases the reservation when the tick fails', async () => {
      mocks.getScheduledTasks.mockResolvedValue([
        dailyNineTask({
          scheduler: { ...armed, lastDispatchedOccurrenceAt: '2026-09-20T09:00:00.000Z' },
        }),
      ]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);
      mocks.runScheduleTick.mockRejectedValue(new Error('transient'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(await dispatch(false)).toMatchObject({ dispatched: 0, due: 1 });
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenCalledTimes(2);
      // Compare-and-set back to the previous value: only succeeds while the row
      // still holds this reservation, so a newer one is never clobbered.
      expect(mocks.swapDispatchedScheduleOccurrence).toHaveBeenLastCalledWith(
        {},
        'task-1',
        '2026-09-21T09:00:00.000Z',
        '2026-09-20T09:00:00.000Z',
      );
    });
  });

  // ComHub fork: the production tick also runs the independently governed
  // Module App schedule dispatcher and reports its summary alongside.
  describe('Module App schedule hook', () => {
    const armed = { scheduleStartedAt: '2026-09-21T08:55:00.000Z' };

    it('dispatches Module App schedules from the same production tick', async () => {
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);
      mocks.runScheduleTick.mockResolvedValue({ ran: true, taskIdentifier: 'T-1' });
      mocks.dispatchDueModuleAppSchedules.mockResolvedValue({
        bookkeepingFailed: 0,
        claimed: 2,
        dispatched: 1,
        failed: 1,
      });

      const res = await rawDispatch(false);

      await expect(res.json()).resolves.toMatchObject({
        dispatched: 1,
        moduleApps: {
          bookkeepingFailed: 0,
          claimed: 2,
          dispatched: 1,
          failed: 1,
          status: 'completed',
        },
        success: true,
      });
      expect(mocks.dispatchDueModuleAppSchedules).toHaveBeenCalledWith({ db: {} });
    });

    it('still runs Module App scheduling when no ordinary task is due', async () => {
      mocks.getScheduledTasks.mockResolvedValue([]);
      mocks.dispatchDueModuleAppSchedules.mockResolvedValue({
        bookkeepingFailed: 0,
        claimed: 2,
        dispatched: 1,
        failed: 1,
      });

      const res = await rawDispatch(false);

      await expect(res.json()).resolves.toMatchObject({
        dispatched: 0,
        due: 0,
        moduleApps: { claimed: 2, status: 'completed' },
      });
      expect(mocks.runScheduleTick).not.toHaveBeenCalled();
      expect(mocks.dispatchDueModuleAppSchedules).toHaveBeenCalledOnce();
    });

    it('does not claim Module App schedules during a dry run', async () => {
      const res = await rawDispatch(true);

      await expect(res.json()).resolves.toMatchObject({
        dispatched: 0,
        dryRun: true,
        moduleApps: {
          claimed: 0,
          reason: 'dry-run',
          status: 'skipped',
        },
      });
      expect(mocks.dispatchDueModuleAppSchedules).not.toHaveBeenCalled();
    });

    it('keeps the central tick successful when Module App scheduling fails', async () => {
      mocks.getScheduledTasks.mockResolvedValue([dailyNineTask({ scheduler: armed })]);
      mocks.swapDispatchedScheduleOccurrence.mockResolvedValue(true);
      mocks.runScheduleTick.mockResolvedValue({ ran: true, taskIdentifier: 'T-1' });
      mocks.dispatchDueModuleAppSchedules.mockRejectedValue(new Error('database unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await rawDispatch(false);

      await expect(res.json()).resolves.toMatchObject({
        dispatched: 1,
        moduleApps: { error: 'database unavailable', status: 'failed' },
        success: true,
      });
      expect(mocks.runScheduleTick).toHaveBeenCalledOnce();
    });
  });
});
