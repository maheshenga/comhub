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
const workerClaimCounter = meter.createCounter('module_app_worker_claims_total', {
  description: 'Module App worker claim attempts by bounded outcome',
});
const workerLeaseRenewalCounter = meter.createCounter(
  'module_app_worker_lease_renewals_total',
  { description: 'Module App worker lease renewals by bounded outcome' },
);
const workerBuildOutcomeCounter = meter.createCounter(
  'module_app_worker_build_outcomes_total',
  { description: 'Module App worker build outcomes by bounded failure code' },
);
const workerBuildDurationHistogram = meter.createHistogram(
  'module_app_worker_build_duration_ms',
  { description: 'Module App worker build duration in milliseconds', unit: 'ms' },
);
const workerQueueDepthHistogram = meter.createHistogram('module_app_worker_queue_depth', {
  description: 'Module App worker eligible queue depth',
});
const workerQueueOldestAgeHistogram = meter.createHistogram(
  'module_app_worker_queue_oldest_eligible_age_ms',
  { description: 'Age of the oldest eligible Module App build', unit: 'ms' },
);
const workerArtifactBytesHistogram = meter.createHistogram('module_app_worker_artifact_bytes', {
  description: 'Module App worker artifact bytes',
  unit: 'By',
});
const workerMaterializationDurationHistogram = meter.createHistogram(
  'module_app_worker_materialization_duration_ms',
  { description: 'Module App worker materialization duration in milliseconds', unit: 'ms' },
);
const workerCleanupCounter = meter.createCounter('module_app_worker_cleanup_total', {
  description: 'Module App worker stale staging cleanup results',
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
const workerFailureCodes = new Set([
  'MODULE_APP_BUILD_ARTIFACT_HASH_MISMATCH',
  'MODULE_APP_BUILD_ARTIFACT_PROMOTION_FAILED',
  'MODULE_APP_BUILD_ARTIFACT_READ_FAILED',
  'MODULE_APP_BUILD_FILESYSTEM_UNAVAILABLE',
  'MODULE_APP_BUILD_INTERNAL_FAILED',
  'MODULE_APP_BUILD_LEASE_LOST',
  'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_INVALID',
  'MODULE_APP_BUILD_MATERIALIZED_ARTIFACT_MISMATCH',
  'MODULE_APP_BUILD_POSTGRESQL_UNAVAILABLE',
  'MODULE_APP_BUILD_RETRY_EXHAUSTED',
  'MODULE_APP_BUILD_S3_HEAD_FAILED',
  'MODULE_APP_BUILD_S3_READ_FAILED',
  'MODULE_APP_BUILD_S3_WRITE_FAILED',
  'MODULE_APP_BUILD_SOURCE_ARCHIVE_REJECTED',
  'MODULE_APP_BUILD_SOURCE_DOWNLOAD_FAILED',
  'MODULE_APP_BUILD_SOURCE_FRONTEND_OUTPUT_MISSING',
  'MODULE_APP_BUILD_SOURCE_FUNCTION_OUTPUT_MISSING',
  'MODULE_APP_BUILD_SOURCE_HASH_MISMATCH',
  'MODULE_APP_BUILD_SOURCE_MANIFEST_MISMATCH',
  'MODULE_APP_BUILD_SOURCE_MANIFEST_REJECTED',
  'MODULE_APP_BUILD_SOURCE_POLICY_REJECTED',
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

export const recordModuleAppWorkerClaim = (
  outcome: 'claimed' | 'conflict' | 'recovered',
) => workerClaimCounter.add(1, { outcome });

export const recordModuleAppWorkerLeaseRenewal = (
  outcome: 'lost' | 'succeeded',
) => workerLeaseRenewalCounter.add(1, { outcome });

export const recordModuleAppWorkerBuildOutcome = (input: {
  failureCode?: string;
  outcome: 'failed' | 'ready' | 'retry';
}) =>
  workerBuildOutcomeCounter.add(1, {
    ...(input.failureCode
      ? { failure_code: workerFailureCodes.has(input.failureCode) ? input.failureCode : 'other' }
      : {}),
    outcome: input.outcome,
  });

export const recordModuleAppWorkerBuildDuration = (durationMs: number) =>
  workerBuildDurationHistogram.record(boundedNumber(durationMs));

export const recordModuleAppWorkerQueue = (input: {
  depth: number;
  oldestEligibleAgeMs: number;
}) => {
  workerQueueDepthHistogram.record(Math.floor(boundedNumber(input.depth)));
  workerQueueOldestAgeHistogram.record(boundedNumber(input.oldestEligibleAgeMs));
};

export const recordModuleAppWorkerArtifactBytes = (bytes: number) =>
  workerArtifactBytesHistogram.record(boundedNumber(bytes));

export const recordModuleAppWorkerMaterializationDuration = (durationMs: number) =>
  workerMaterializationDurationHistogram.record(boundedNumber(durationMs));

export const recordModuleAppWorkerCleanup = (input: { failed: number; removed: number }) => {
  workerCleanupCounter.add(Math.floor(boundedNumber(input.removed)), { outcome: 'removed' });
  workerCleanupCounter.add(Math.floor(boundedNumber(input.failed)), { outcome: 'failed' });
};
