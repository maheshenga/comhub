# Module App Production Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Complete the confirmed Module App production roadmap: disposable sandbox execution, executable actions, durable workflow triggers, Alipay computer website payments, publisher operations, scalable admin tooling, and production verification.

**Architecture:** Preserve the current Module App contracts and database ownership boundaries. Add a shared-state runtime orchestration layer, a fixed-policy disposable container engine, an explicit executable action path, provider-isolated Alipay payment services, stable Publisher records, and read-model-oriented admin operations. Keep existing public TRPC names compatible while moving implementation behind smaller services.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, Vitest, React/SWR, QStash, Redis/ioredis, S3-compatible storage, Node.js 22, Python 3.12, Docker Engine API/CLI, RSA2 signing, GitHub Actions, GHCR, and the existing Baota blue-green deployment.

## Global Constraints

- Do not repeat completed migrations `0136` through `0139`; inspect current schema before adding a new migration.
- Keep executable runtime and automatic Alipay settlement disabled until the acceptance gates pass.
- Do not accept user-selected images, commands, mounts, Dockerfiles, network modes, provider keys, raw prices, or settlement amounts.
- Use one disposable fixed-policy container per executable invocation.
- Use Redis for shared replay protection, mutation leases, notification limits, and scheduler leases; fail closed when required shared state is unavailable.
- Treat PostgreSQL as the source of truth for orders, payment events, runs, workflows, revenue, publishers, and payouts.
- `return_url` never changes payment state. Verified Alipay `notify_url` or server-side trade query is required.
- Historical order snapshots, revenue accruals, payment events, and payout records are append-only.
- Preserve current API names where possible; split implementation behind adapters before changing external routers.
- Use focused tests first: `bunx vitest run --silent='passed-only' <files>`; use `bun run type-check` and targeted ESLint at package gates.
- Do not claim production readiness without PostgreSQL, Redis, real container, Alipay sandbox, and browser E2E evidence.

## File Map

### Runtime And Shared State

- Create: `apps/server/src/services/moduleAppSandbox/contracts.ts`
- Create: `apps/server/src/services/moduleAppSandbox/engine.ts`
- Create: `apps/server/src/services/moduleAppSandbox/policy.ts`
- Create: `apps/server/src/services/moduleAppSandbox/lease.ts`
- Create: `apps/server/src/services/moduleAppSandbox/*.test.ts`
- Modify: `apps/server/src/services/moduleAppRuntime/client.ts`
- Modify: `apps/server/src/services/moduleAppRuntime/gateway.ts`
- Modify: `apps/server/src/modules/AgentRuntime/redis.ts` only through a reusable adapter, not by changing existing Agent Runtime behavior
- Create: `apps/module-runtime/src/containerEngine.ts`
- Create: `apps/module-runtime/src/containerEngine.test.ts`
- Modify: `apps/module-runtime/src/invocation.ts`
- Modify: `apps/module-runtime/src/server.ts`
- Modify: `apps/module-runtime/docker/Dockerfile.node22`
- Modify: `apps/module-runtime/docker/Dockerfile.python312`

### Execution And Workflow

- Modify: `packages/types/src/moduleApp.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Create: `packages/business-server/src/module-apps/runners/executableActionRunner.ts`
- Create: `packages/business-server/src/module-apps/runners/executableActionRunner.test.ts`
- Modify: `packages/business-server/src/module-apps/workflows/executors.ts`
- Create: `packages/business-server/src/module-apps/workflows/executors/*.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/workflows/moduleApp/run.ts`
- Create: `apps/server/src/workflows/moduleApp/scheduleDispatcher.ts`
- Create: `apps/server/src/workflows/moduleApp/scheduleDispatcher.test.ts`
- Modify: `src/app/(backend)/api/webhooks/module-app/[webhookId]/route.ts`
- Modify: `src/app/(backend)/api/workflows/module-app/run/route.ts`

### Alipay

- Create: `packages/types/src/moduleAppPayment.ts`
- Create: `packages/types/src/moduleAppPayment.test.ts`
- Create: `packages/database/migrations/0141_add_module_app_payments.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPayment.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPayment.test.ts`
- Create: `packages/business-server/src/module-apps/payments/contracts.ts`
- Create: `packages/business-server/src/module-apps/payments/service.ts`
- Create: `packages/business-server/src/module-apps/payments/service.test.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/client.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/client.test.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/signature.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/signature.test.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/mapper.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/reconcile.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Create: `src/app/(backend)/api/webhooks/alipay/module-app/route.ts`
- Create: `src/app/(backend)/api/webhooks/alipay/module-app/route.test.ts`
- Modify: `packages/env/src/app.ts`

### Publisher And Admin Operations

- Create: `packages/types/src/moduleAppPublisher.ts`
- Create: `packages/database/migrations/0142_add_module_app_publishers.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPublisher.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPublisher.test.ts`
- Create: `packages/database/migrations/0143_add_module_app_payouts.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPayout.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPayout.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Create: `src/features/Admin/moduleApps/PaymentReconciliationTable.tsx`
- Create: `src/features/Admin/moduleApps/PublisherTable.tsx`
- Create: `src/features/Admin/moduleApps/PayoutTable.tsx`

### Verification And Deployment

- Create: `apps/module-runtime/src/securityProbes.test.ts`
- Create: `e2e/src/features/module-app/production.feature`
- Create: `e2e/src/steps/module-app/production.ts`
- Modify: `.github/workflows/comhub-deploy.yml`
- Modify: `apps/module-runtime/docker/Dockerfile.node22`
- Modify: `apps/module-runtime/docker/Dockerfile.python312`
- Create: `docker-compose/deploy/module-runtime.yml`
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

---

## Task 1: Shared Runtime State And Policy Contracts

**Files:**
- Create: `apps/server/src/services/moduleAppSandbox/contracts.ts`
- Create: `apps/server/src/services/moduleAppSandbox/policy.ts`
- Create: `apps/server/src/services/moduleAppSandbox/policy.test.ts`
- Create: `apps/server/src/services/moduleAppSandbox/lease.ts`
- Create: `apps/server/src/services/moduleAppSandbox/lease.test.ts`

**Interfaces:**

```ts
export type ModuleAppSandboxPolicy = {
  cpuLimit: number;
  imageDigest: string;
  memoryLimitBytes: number;
  networkMode: 'none';
  pidsLimit: number;
  runtime: 'node22' | 'python312';
  timeoutMs: number;
};

export type ModuleAppSandboxLease = {
  invocationId: string;
  ownerId: string;
  expiresAt: Date;
};

export interface ModuleAppInvocationLeaseStore {
  acquire(input: { invocationId: string; ownerId: string; ttlMs: number }): Promise<boolean>;
  release(input: { invocationId: string; ownerId: string }): Promise<void>;
}
```

- [x] Write tests proving developer-provided image, command, mount, network, timeout, and resource overrides are rejected.
- [x] Write tests proving the Redis store uses `SET NX PX`, owner-checked release, and fails closed when Redis is absent.
- [x] Implement the pure policy parser and shared lease interface. Use existing Redis configuration and `ioredis`; do not alter Agent Runtime Redis behavior.
- [x] Run:

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppSandbox/policy.test.ts apps/server/src/services/moduleAppSandbox/lease.test.ts
```

- [x] Commit: `feat: add module app sandbox policy state`

## Task 2: Disposable Container Engine

**Files:**
- Create: `apps/module-runtime/src/containerEngine.ts`
- Create: `apps/module-runtime/src/containerEngine.test.ts`
- Modify: `apps/module-runtime/src/invocation.ts`
- Modify: `apps/module-runtime/src/server.ts`
- Modify: runtime Dockerfiles only for the orchestrator's fixed image and non-root runtime user.

**Interfaces:**

```ts
export interface ModuleAppContainerEngine {
  run(input: {
    artifactDirectory: string;
    command: string[];
    env: Record<string, string>;
    limits: { cpu: number; memoryBytes: number; pids: number; timeoutMs: number };
  }): Promise<{ exitCode: number; stderr: string; stdout: string }>;
}
```

- [x] Add failing engine tests with a fake engine for fixed command construction, read-only artifact mount, `/tmp` tmpfs, no network, non-root user, `no-new-privileges`, CPU/memory/PID limits, bounded logs, timeout cleanup, and non-zero exit handling.
- [x] Implement a Docker Engine adapter with an allowlisted image digest and runtime executable chosen only from the parsed runtime enum. The command must be constructed from server-owned values.
- [x] Keep Docker access behind `ModuleAppContainerEngine`; unit tests must never require Docker.
- [x] Change `FixedProcessModuleAppLauncher` to use the engine interface. Preserve public invocation response fields and stable error codes.
- [x] Run:

```powershell
bunx vitest run --silent='passed-only' apps/module-runtime/src/containerEngine.test.ts apps/module-runtime/src/invocation.test.ts apps/module-runtime/src/server.test.ts
```

- [x] Commit: `feat: isolate module app invocations in containers`

## Task 3: Executable Action Wiring

**Files:**
- Modify: `packages/types/src/moduleApp.ts`
- Create: `packages/business-server/src/module-apps/runners/executableActionRunner.ts`
- Create: `packages/business-server/src/module-apps/runners/executableActionRunner.test.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `apps/server/src/services/moduleAppRuntime/client.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`

**Interfaces:**

```ts
export const moduleAppRuntimeTypeSchema = z.enum([
  'none', 'record_create', 'record_update', 'record_archive', 'api_action',
  'server_action', 'content_generation', 'workflow_step', 'executable_action',
]);

export type ModuleAppExecutableActionInvoker = (input: {
  action: ModuleAppActionConfig;
  artifactSha256: string;
  input: Record<string, unknown>;
  invocationId: string;
}) => Promise<{ output?: Record<string, unknown>; stderr?: string; stdout?: string }>;
```

- [x] Add a failing routing test proving `executable_action` calls the runtime client, while `record_create`, `api_action`, and `content_generation` do not.
- [x] Validate that the action's entry, runtime, artifact hash, and timeout come from the ready server-side version snapshot, never from mutation input.
- [x] Add invocation and terminal run snapshots for runtime error, timeout, malformed output, and successful output.
- [x] Keep entitlement checks before creating the invocation and repeat them before committing terminal success.
- [x] Run focused business, router, runtime client, and type tests.
- [x] Commit: `feat: connect module app executable actions`

## Task 4: Workflow Executors, Schedules, And Webhook State

**Files:**
- Create: `packages/business-server/src/module-apps/workflows/executors/ai.ts`
- Create: `packages/business-server/src/module-apps/workflows/executors/http.ts`
- Create: `packages/business-server/src/module-apps/workflows/executors/function.ts`
- Create: tests beside each executor.
- Modify: `packages/business-server/src/module-apps/workflows/executors.ts`
- Create: `apps/server/src/workflows/moduleApp/scheduleDispatcher.ts`
- Create: `apps/server/src/workflows/moduleApp/scheduleDispatcher.test.ts`
- Modify: `src/app/(backend)/api/webhooks/module-app/[webhookId]/route.ts`
- Modify: `src/app/(backend)/api/workflows/module-app/run/route.ts`
- Modify: `apps/server/src/workflows/moduleApp/run.ts`

- [x] Write tests for each executor's capability and entitlement boundary, idempotency key, bounded output, and stable failure code.
- [x] Implement AI executor through the existing Module App text generator and usage snapshot. Implement HTTP through the reviewed-host gateway. Implement function through a fixed server registry keyed by reviewed function key.
- [x] Write scheduler tests for due-row claim, lease expiry, duplicate worker prevention, next-run calculation, failed dispatch, and bounded batch size.
- [x] Implement `scheduleDispatcher` with database claims and QStash dispatch. Do not use an in-memory timer as the source of truth.
- [x] Update webhook route to resolve entitlement before `start`, and update failed/denied deliveries and run state explicitly.
- [x] Represent authorization failure with the existing `failed` workflow status and stable `MODULE_APP_WORKFLOW_ENTITLEMENT_DENIED` error code; do not add another terminal status.
- [x] Apply review hardening for claim CAS ownership, deterministic QStash run identity, post-dispatch bookkeeping failures, and entitlement error classification.
- [x] Run workflow, trigger, router, and webhook tests.
- [x] Commit: `feat: complete module app workflow execution`

## Task 5: Payment Contracts And Persistence

**Files:**
- Create: `packages/types/src/moduleAppPayment.ts`
- Create: `packages/types/src/moduleAppPayment.test.ts`
- Create: `packages/database/migrations/0141_add_module_app_payments.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPayment.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPayment.test.ts`
- Create: `packages/business-server/src/module-apps/payments/contracts.ts`
- Create: `packages/business-server/src/module-apps/payments/service.ts`
- Create: `packages/business-server/src/module-apps/payments/service.test.ts`

**Interfaces:**

```ts
export type ModuleAppPaymentProvider = 'alipay';

export interface ModuleAppPaymentAdapter {
  create(input: { orderId: string; subject: string; totalAmount: string; returnUrl: string; notifyUrl: string }): Promise<{ body: string; outTradeNo: string }>;
  verifyNotification(input: { body: string; headers: Record<string, string> }): Promise<NormalizedPaymentEvent | null>;
  query(input: { outTradeNo: string }): Promise<NormalizedPaymentEvent | null>;
  refund(input: { outTradeNo: string; refundAmount: string; reason: string }): Promise<{ providerRefundId: string; status: string }>;
}
```

- [x] Add tables for payment attempts, normalized provider events, refunds, and reconciliation discrepancies with unique provider-scoped identifiers.
- [x] Add tests for valid transitions, duplicate events, amount mismatch, provider mismatch, refund replay, and row-lock idempotency.
- [x] Implement `ModuleAppPaymentService` so it persists the provider event before calling order settlement and never trusts browser input for amount or status.
- [x] Run type, schema, model, and service tests with PostgreSQL integration cases included but clearly reported when `DATABASE_TEST_URL` is absent.
- [x] Commit: `feat: add module app payment state`

## Task 6: Alipay Computer Website Adapter

**Files:**
- Create: `apps/server/src/services/moduleAppPayments/alipay/signature.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/signature.test.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/client.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/client.test.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/mapper.ts`
- Create: `apps/server/src/services/moduleAppPayments/alipay/reconcile.ts`
- Modify: `packages/env/src/app.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Create: `src/app/(backend)/api/webhooks/alipay/module-app/route.ts`
- Create: `src/app/(backend)/api/webhooks/alipay/module-app/route.test.ts`

- [x] Add environment parsing for sandbox/production gateway, app ID, merchant private key, Alipay public key or certificate mode, seller ID, return URL, notify URL, and feature flag.
- [x] Implement RSA2 signing with Node `crypto.sign('RSA-SHA256', ...)` over Alipay's sorted non-empty parameter string. Exclude `sign` from canonicalization and use URL encoding only at form/request boundaries.
- [x] Implement `alipay.trade.page.pay`, `alipay.trade.query`, `alipay.trade.refund`, and bill download query using a bounded HTTP client and strict response parsing.
- [x] Verify notification signature and compare app ID, seller ID, out trade number, total amount, trade status, and provider event identity before normalization.
- [x] Add callback route that returns Alipay's required success body only after the local event is durably accepted; return failure for invalid events without changing orders.
- [x] Add tests for signature vectors, duplicate notifications, amount mismatch, wrong seller, wrong app, delayed query, refund, and sandbox HTTP fixtures.
- [x] Commit: `feat: integrate alipay module app payments`

## Task 7: Reconciliation And Refund Operations

**Files:**
- Modify: `packages/business-server/src/module-apps/payments/service.ts`
- Modify: `apps/server/src/services/moduleAppPayments/alipay/reconcile.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Create: `packages/business-server/src/module-apps/payments/reconcile.test.ts`
- Create: `packages/business-server/src/lambda-routers/admin/moduleApps.payment.test.ts`

- [x] Add authenticated order payment initiation that returns a provider form only when the order is pending and the product/app is published.
- [x] Keep the existing purchaser cancel path and add a finance-authorized refund request path with reason and audit event.
- [x] Add server-side trade query for pending orders and bounded daily reconciliation jobs.
- [x] Persist discrepancy types: missing local order, amount mismatch, wrong seller, local paid/provider unpaid, local unpaid/provider paid, refund mismatch, and duplicate event.
- [x] Add admin actions for retry query, retry refund status, acknowledge discrepancy, and export a bounded reconciliation report.
- [x] Commit: `feat: reconcile module app alipay payments`

## Task 8: Publisher Ownership And Manual Payouts

**Files:**
- Create: `packages/types/src/moduleAppPublisher.ts`
- Create: `packages/database/migrations/0142_add_module_app_publishers.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPublisher.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPublisher.test.ts`
- Create: `packages/database/migrations/0143_add_module_app_payouts.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPayout.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPayout.test.ts`
- Modify: `packages/business-server/src/module-apps/revenue.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`

- [x] Add Publisher verification and suspension transitions with admin-only mutation permissions.
- [x] Link applications and approved packages to a stable publisher ID; preserve historical revenue publisher snapshots.
- [x] Replace fallback publisher inference for new revenue accruals while keeping legacy rows readable.
- [x] Add payout batch and payout entry transitions: `pending`, `eligible`, `processing`, `paid`, `failed`, `reversed`.
- [x] Add manual Alipay payout record with masked recipient metadata, amount, transaction number, evidence reference, actor, and audit event.
- [x] Enforce unique payout transaction identity and prevent payout above eligible unsettled revenue.
- [x] Commit: `feat: add module app publisher operations`

## Task 9: Admin Read Models And Pagination

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Create: `packages/business-server/src/lambda-routers/admin/moduleApps.readModels.ts`
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Create: `src/features/Admin/moduleApps/PaymentReconciliationTable.tsx`
- Create: `src/features/Admin/moduleApps/PublisherTable.tsx`
- Create: `src/features/Admin/moduleApps/PayoutTable.tsx`
- Modify or create focused component tests beside each table.

- [x] Replace fixed `limit: 100` and `limit: 200` admin fetches with cursor pagination and stable sort keys.
- [x] Add server filters for application, package, publisher, build status, payment status, refund status, discrepancy status, and payout status.
- [x] Add loading, empty, error, retry, and permission-denied states to each new table.
- [x] Link payment event, order, license, revenue, payout, runtime invocation, and audit IDs without exposing private keys, raw secrets, or full signatures.
- [x] Run admin router and component tests with a synthetic dataset larger than one page.
- [x] Commit: `feat: scale module app admin operations`

## Task 10: Observability And Feature Flags

**Files:**
- Create: `packages/observability-otel/src/modules/module-app/index.ts`
- Modify: `apps/server/src/services/moduleAppSandbox/*.ts`
- Modify: payment and workflow services from previous tasks.
- Modify: `packages/env/src/app.ts`
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

- [x] Emit bounded metrics for sandbox invocation count, latency, timeout, OOM, cleanup failure, replay rejection, workflow backlog, payment verification failure, reconciliation discrepancy age, refund age, and payout state.
- [x] Add independent flags for runtime invocation, privileged workflow executors, schedule dispatch, Alipay payment creation, Alipay automatic settlement, publisher payout recording, and public execution.
- [x] Ensure disabled flags stop new mutations but keep read, query, refund-status, reconciliation, and audit paths available.
- [x] Add allowlist checks for the initial runtime and publisher rollout.
- [x] Commit: `feat: add module app production controls`

## Task 11: Runtime And Payment Verification Gates

**Files:**
- Create: `apps/module-runtime/src/securityProbes.test.ts`
- Create: `e2e/src/features/module-app/production.feature`
- Create: `e2e/src/steps/module-app/production.ts`
- Modify: `.github/workflows/comhub-deploy.yml`
- Modify: runtime Docker and deployment files.

- [x] Add real-container probes for Node and Python fixtures, path traversal, forbidden network, process/PID exhaustion, memory limit, CPU limit, log flood, malformed JSON, timeout, and cleanup.
- [x] Add PostgreSQL and Redis integration setup that is reproducible in CI; do not silently skip required gates when environment variables are absent.
- [ ] Add Alipay sandbox E2E for payment creation, return-page polling, verified notification, duplicate notification, refund, delayed query, and reconciliation discrepancy.
- [ ] Add browser E2E for install, launch, executable action, workflow progress, team scope, denied workspace, revoked license, payment pending, paid confirmation, and refund state.
- [ ] Add deployment smoke checks for runtime health, artifact mount, internal authorization, feature flags, blue-green switch, rollback, and `/api/version` evidence.
- [ ] Commit: `test: verify module app production gates`

## Task 12: Incremental Model And Router Decomposition

**Files:**
- Create: `packages/database/src/models/moduleAppCatalog.ts`
- Create: `packages/database/src/models/moduleAppInstallation.ts`
- Create: `packages/database/src/models/moduleAppExecution.ts`
- Create: `packages/database/src/models/moduleAppAudit.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Create: `apps/server/src/routers/lambda/moduleApp/market.ts`
- Create: `apps/server/src/routers/lambda/moduleApp/runtime.ts`
- Create: `apps/server/src/routers/lambda/moduleApp/data.ts`
- Create: `apps/server/src/routers/lambda/moduleApp/workflow.ts`
- Create: `apps/server/src/routers/lambda/moduleApp/commerce.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`

- [ ] Move one responsibility at a time behind the existing model/router exports.
- [ ] Preserve existing TRPC procedure names and input/output schemas.
- [ ] Add contract tests that compare the root router record before and after decomposition.
- [ ] Run the complete targeted Module App test set after each moved boundary.
- [ ] Commit: `refactor: split module app ownership boundaries`

## Final Acceptance And Push

- [ ] Run all targeted Module App tests, package tests, type checking, targeted ESLint, locale validation, and `git diff --check`.
- [ ] Run PostgreSQL and Redis integration suites with `DATABASE_TEST_URL` and Redis enabled.
- [ ] Run real-container security probes and Alipay sandbox verification.
- [ ] Run browser E2E and deployment smoke checks against a staging blue-green deployment.
- [ ] Confirm production flags remain disabled until all gates have evidence.
- [ ] Update feature registry and internal changelog with actual verification status and blockers.
- [ ] Push branch and report commit SHAs, test commands, deployment probe results, and any remaining external credential or environment blockers.
