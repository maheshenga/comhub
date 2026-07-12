import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('server-services-module-app');

const sandboxInvocationCounter = meter.createCounter('module_app_sandbox_invocations_total', {
  description: 'Module App sandbox invocations by bounded outcome and runtime',
});
const sandboxDurationHistogram = meter.createHistogram('module_app_sandbox_duration_ms', {
  description: 'Module App sandbox invocation duration in milliseconds',
  unit: 'ms',
});
const sandboxCleanupFailureCounter = meter.createCounter(
  'module_app_sandbox_cleanup_failures_total',
  { description: 'Module App sandbox cleanup failures' },
);
const sandboxReplayRejectionCounter = meter.createCounter(
  'module_app_sandbox_replay_rejections_total',
  { description: 'Module App invocation replay rejections' },
);
const workflowBacklogHistogram = meter.createHistogram('module_app_workflow_backlog', {
  description: 'Module App workflow schedules waiting in a dispatcher pass',
});
const paymentVerificationFailureCounter = meter.createCounter(
  'module_app_payment_verification_failures_total',
  { description: 'Module App payment verification failures by bounded reason' },
);
const operationalAgeHistogram = meter.createHistogram('module_app_operational_age_ms', {
  description: 'Age of unresolved Module App discrepancies and refunds',
  unit: 'ms',
});
const payoutStateCounter = meter.createCounter('module_app_payout_state_total', {
  description: 'Module App payout state transitions',
});

export type ModuleAppSandboxOutcome =
  | 'cleanup_failed'
  | 'failed'
  | 'oom'
  | 'succeeded'
  | 'timeout';

const paymentReasons = new Set([
  'amount_mismatch',
  'currency_mismatch',
  'invalid_notification',
  'order_not_found',
  'provider_mismatch',
  'settlement_failed',
  'signature_invalid',
]);

const boundedNumber = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value)) : 0;

export const recordModuleAppSandboxInvocation = (input: {
  durationMs: number;
  outcome: ModuleAppSandboxOutcome;
  runtime: 'node22' | 'python312';
}) => {
  const attributes = { outcome: input.outcome, runtime: input.runtime };
  sandboxInvocationCounter.add(1, attributes);
  sandboxDurationHistogram.record(boundedNumber(input.durationMs), attributes);
};

export const recordModuleAppSandboxCleanupFailure = () =>
  sandboxCleanupFailureCounter.add(1);

export const recordModuleAppSandboxReplayRejection = () =>
  sandboxReplayRejectionCounter.add(1);

export const recordModuleAppWorkflowBacklog = (count: number) =>
  workflowBacklogHistogram.record(Math.floor(boundedNumber(count)));

export const recordModuleAppPaymentVerificationFailure = (reason: string) =>
  paymentVerificationFailureCounter.add(1, {
    reason: paymentReasons.has(reason) ? reason : 'other',
  });

export const recordModuleAppOperationalAge = (
  kind: 'discrepancy' | 'refund',
  ageMs: number,
) => operationalAgeHistogram.record(boundedNumber(ageMs), { kind });

export const recordModuleAppPayoutState = (
  state: 'eligible' | 'failed' | 'paid' | 'pending' | 'processing' | 'reversed',
) => payoutStateCounter.add(1, { state });
