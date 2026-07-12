import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recordModuleAppOperationalAge,
  recordModuleAppPaymentVerificationFailure,
  recordModuleAppPayoutState,
  recordModuleAppSandboxInvocation,
  recordModuleAppSandboxReplayRejection,
  recordModuleAppWorkflowBacklog,
} from './index';

const instruments = vi.hoisted(() => new Map<string, ReturnType<typeof vi.fn>>());

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createCounter: (name: string) => {
        const add = vi.fn();
        instruments.set(name, add);
        return { add };
      },
      createHistogram: (name: string) => {
        const record = vi.fn();
        instruments.set(name, record);
        return { record };
      },
    }),
  },
}));

describe('module app observability', () => {
  beforeEach(() => {
    for (const instrument of instruments.values()) instrument.mockClear();
  });

  it('records bounded sandbox and workflow dimensions without resource identifiers', () => {
    recordModuleAppSandboxInvocation({
      durationMs: 123,
      outcome: 'timeout',
      runtime: 'node22',
    });
    recordModuleAppSandboxReplayRejection();
    recordModuleAppWorkflowBacklog(42);

    expect(instruments.get('module_app_sandbox_invocations_total')).toHaveBeenCalledWith(1, {
      outcome: 'timeout',
      runtime: 'node22',
    });
    expect(instruments.get('module_app_sandbox_duration_ms')).toHaveBeenCalledWith(123, {
      outcome: 'timeout',
      runtime: 'node22',
    });
    expect(instruments.get('module_app_workflow_backlog')).toHaveBeenCalledWith(42);
  });

  it('bounds payment reasons, ages, and payout states', () => {
    recordModuleAppPaymentVerificationFailure('unexpected-provider-message');
    recordModuleAppOperationalAge('refund', 3_600_000);
    recordModuleAppPayoutState('paid');

    expect(instruments.get('module_app_payment_verification_failures_total')).toHaveBeenCalledWith(
      1,
      { reason: 'other' },
    );
    expect(instruments.get('module_app_operational_age_ms')).toHaveBeenCalledWith(3_600_000, {
      kind: 'refund',
    });
    expect(instruments.get('module_app_payout_state_total')).toHaveBeenCalledWith(1, {
      state: 'paid',
    });
  });
});
