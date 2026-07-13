# Module Worker Task 6 Report

## Status

Implemented Task 6 on `feat/module-app-compose-worker` using test-first red-green cycles.

## Delivered

- Added single-build polling with `failExpiredExhausted`, queue statistics, one claim, 60-second leases, and 20-second renewal.
- Added lease-loss abort propagation and a 40-second graceful shutdown limit.
- Added startup cleanup, ten-minute cleanup scheduling, five-second idle polling, and strict one-hour stale staging cleanup.
- Added atomic `/tmp/module-app-worker-health.json` writes and a no-port healthcheck covering 30-second freshness, `SELECT 1`, and create/fsync/remove artifact probes.
- Added read-only queue depth, oldest eligible age, and active-claim queries to the worker database adapter. Write transitions remain in `ModuleAppBuildModel`.
- Added bounded worker claim, renewal, build, duration, queue, artifact, materialization, and cleanup metrics without resource identifiers.
- Registered OpenTelemetry as `comhub-module-worker` before dynamically loading PostgreSQL or S3 client modules.
- Added `@lobechat/observability-otel` to `apps/module-worker/package.json` without running an install.

## Verification

Passing tests:

```text
apps/module-worker: 6 files, 36 tests passed
packages/observability-otel: 1 file, 4 tests passed
```

Commands:

```powershell
bunx vitest run --silent='passed-only' src/health.test.ts src/cleanup.test.ts src/worker.test.ts src/database.test.ts src/index.test.ts src/processor.test.ts
bunx vitest run --silent='passed-only' src/modules/module-app/index.test.ts
git diff --check
```

The brief's root Vitest command cannot discover `packages/**` because the root Vitest configuration excludes packages. The observability test was therefore run from `packages/observability-otel`.

## Concerns

- `bunx tsc --noEmit -p apps/module-worker/tsconfig.json` reaches `@lobechat/observability-otel/node` but this no-lockfile checkout does not currently link five declared OTel packages: `@opentelemetry/exporter-metrics-otlp-http`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/instrumentation-http`, `@opentelemetry/sdk-node`, and `@opentelemetry/semantic-conventions`. No install was run, per the task constraint.
- Prettier verification is blocked because `prettier-plugin-sh` is not linked. No install was run. `git diff --check` is clean.
