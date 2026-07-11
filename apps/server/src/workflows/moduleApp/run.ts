import type { ModuleAppWorkflowEngine } from '@/business/server/module-apps/workflows/engine';

import type { ModuleAppWorkflowJobPayload } from './index';

export const runModuleAppWorkflowJob = async (input: {
  assertEntitlement: () => Promise<unknown> | unknown;
  dispatch: (
    payload: ModuleAppWorkflowJobPayload,
    options?: { delayMs?: number },
  ) => Promise<unknown>;
  engine: Pick<ModuleAppWorkflowEngine, 'executeClaimedNode'>;
  payload: ModuleAppWorkflowJobPayload;
  workerId: string;
}) => {
  await input.assertEntitlement();

  const run = await input.engine.executeClaimedNode({
    ...input.payload,
    workerId: input.workerId,
  });
  if (
    run &&
    !run.workflowDispatchIdle &&
    (run.status === 'queued' || run.status === 'running')
  ) {
    if (run.workflowRetryAfterMs) {
      await input.dispatch(input.payload, { delayMs: run.workflowRetryAfterMs });
    } else {
      await input.dispatch(input.payload);
    }
  }
  return run;
};
