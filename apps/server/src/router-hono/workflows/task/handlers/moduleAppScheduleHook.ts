import { dispatchDueModuleAppSchedules } from '@/server/workflows/moduleApp/scheduleDispatcher';

export type ModuleAppDispatchStatus = 'completed' | 'disabled' | 'failed' | 'skipped';

export interface ModuleAppDispatchSummary {
  bookkeepingFailed: number;
  claimed: number;
  dispatched: number;
  error?: string;
  failed: number;
  reason?: 'dry-run';
  status: ModuleAppDispatchStatus;
}

const emptyModuleAppDispatchSummary = (
  status: ModuleAppDispatchStatus,
  extra: Pick<ModuleAppDispatchSummary, 'error' | 'reason'> = {},
): ModuleAppDispatchSummary => ({
  bookkeepingFailed: 0,
  claimed: 0,
  dispatched: 0,
  failed: 0,
  status,
  ...extra,
});

/**
 * Run the independently governed Module App schedule dispatcher as part of
 * the central cron tick. Never throws — a Module App failure must not fail
 * the ordinary task sweep; it is reported in the summary instead.
 */
export const dispatchModuleAppSchedules = async (
  db: Awaited<ReturnType<(typeof import('@/database/server'))['getServerDB']>>,
  dryRun: boolean,
): Promise<ModuleAppDispatchSummary> => {
  if (dryRun) return emptyModuleAppDispatchSummary('skipped', { reason: 'dry-run' });

  try {
    const result = await dispatchDueModuleAppSchedules({ db });
    return { ...result, status: 'completed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'MODULE_APP_SCHEDULE_DISPATCH_DISABLED') {
      return emptyModuleAppDispatchSummary('disabled');
    }

    console.error('[task/schedule-dispatch] Module App dispatch failed:', error);
    return emptyModuleAppDispatchSummary('failed', { error: message });
  }
};
