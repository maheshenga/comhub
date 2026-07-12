# Module App Production Platform Design

## Status

- Date: 2026-07-12
- Scope: complete the current Module App roadmap through production-safe runtime execution, durable workflows, Alipay computer website payments, publisher operations, admin scalability, and maintainability improvements.
- Delivery strategy: five independently deployable packages with feature flags and explicit acceptance gates.
- Production default: Module App executable runtime and automated payment settlement remain disabled until their respective gates pass.

## Objectives

1. Turn the existing Module App runtime protocol into a production execution path with one isolated container per invocation.
2. Connect executable actions, workflow executors, schedules, and webhooks to durable production paths.
3. Integrate Alipay Computer Website Payment for collection, asynchronous settlement, refunds, queries, and reconciliation.
4. Add stable publisher ownership and internal settlement operations while keeping actual developer payouts manual for the first release.
5. Make the admin and model boundaries scale beyond the current fixed-size lists and concentrated `ModuleAppModel` and router files.
6. Preserve the current security principles: immutable artifacts, server-owned prices, centralized entitlement, short-lived capabilities, and auditable state transitions.

## Non-Goals

- Pre-warmed runtime pools.
- Developer-selected container images, commands, mounts, or unrestricted network access.
- Additional payment providers.
- Automatic Alipay developer transfers before the merchant has the required product and compliance approval.
- Replacing QStash, PostgreSQL, Redis, S3-compatible storage, or the existing blue-green deployment strategy.
- A one-shot rewrite of `ModuleAppModel` or the user router.

## Delivery Packages

### Package 1: Runtime Security

Introduce a `ModuleAppSandboxLauncher` boundary that creates one disposable container for each executable invocation.

Each invocation must use:

- A fixed, platform-owned `node22` or `python312` image pinned by immutable image digest.
- A read-only artifact mount selected by the server-owned `artifactSha256`.
- A read-only container root filesystem and a writable temporary filesystem only at `/tmp`.
- UID/GID `10001`, no privileged mode, no added Linux capabilities, and `no-new-privileges`.
- Explicit CPU, memory, PID, log-size, input-size, output-size, and wall-clock limits.
- Network disabled by default. Reviewed external access continues through the main server SDK HTTP gateway.
- Guaranteed container cleanup after success, failure, timeout, cancellation, or orchestrator restart recovery.

Redis provides shared invocation leases, capability replay protection, and notification rate limiting. PostgreSQL remains the source of truth for invocation and run state.

The runtime service is deployed through the existing GHCR and Baota blue-green path. Baota remains responsible only for Nginx and certificates. The runtime receives a private internal origin and a public artifact origin, health checks, rollback hooks, and content-addressed artifact mounts.

### Package 2: Execution And Workflow

Connect `ModuleAppRuntimeClient` to a new explicit executable action type. Platform-managed actions remain separate:

- Record actions continue in the main business service.
- Content generation continues through the existing user ModelRuntime and credit settlement path.
- Reviewed API actions continue through the bounded server HTTP runner.
- Executable actions use `ModuleAppRuntimeClient` and the isolated sandbox only.

Workflow executors are registered as platform adapters:

- `ai`: existing ModelRuntime and Module App AI credit flow.
- `http`: reviewed-host HTTP gateway.
- `function`: fixed platform function registry; no arbitrary function names from package code.
- `transform`, `condition`, `parallel`, `wait`, and `approval`: existing workflow engine semantics.

Schedule creation validates bounded cron and timezone values, persists the next execution time, and uses a database lease with `FOR UPDATE SKIP LOCKED` to dispatch due schedules through QStash. The scheduler updates `nextRunAt` only after a durable dispatch result.

Webhook authorization is checked before a workflow run is created. Inactive applications, installations, licenses, plans, or workspace memberships reject the delivery without creating a queued run. Accepted deliveries remain idempotent by webhook and delivery ID.

### Package 3: Alipay Commerce

The first payment provider is Alipay Computer Website Payment.

The payment architecture keeps a provider-neutral interface in business-server and an Alipay adapter in the server application. The interface supports:

- Create payment.
- Verify and normalize asynchronous notification.
- Query trade status.
- Request refund.
- Query refund status.
- Download and parse daily reconciliation bills.

Payment creation uses the existing immutable Module App order snapshot. The server generates a unique `out_trade_no`; applications and browsers cannot submit prices, settlement amounts, revenue shares, or license terms.

`return_url` is display-only. It returns the user to the order page, which polls server state and never marks an order paid.

`notify_url` is the automatic settlement authority. Before settlement it verifies:

- Alipay signature.
- Application ID.
- Seller identity.
- `out_trade_no` and Alipay trade number.
- Amount and currency against the immutable order snapshot.
- Supported terminal trade status.
- Notification identity and replay state.

The normalized payment event is persisted before business settlement. A row-locked idempotent transaction settles the order, creates the license or subscription, accrues publisher revenue, and writes audit records. Duplicate notifications return success without repeating business effects.

Refunds use a durable local refund request. License revocation and revenue reversal occur only after Alipay confirms the refund. Timed reconciliation queries unresolved trades and compares daily bills with local payment, refund, and order state.

Configuration uses environment or secret-management values for the Alipay App ID, merchant private key, Alipay public key or certificates, gateway URL, seller identity, notify URL, and return URL. Secrets and full sensitive payloads are never logged.

### Package 4: Publisher Operations

Add a stable Publisher entity instead of inferring long-term revenue ownership from the latest approved package submission.

Publisher state includes:

- Owner user and organization metadata.
- Review status.
- Legal or display identity fields required by platform operations.
- Masked Alipay receiving identity metadata.
- Application ownership assignments and ownership history.
- Suspension state and audit history.

Revenue entries snapshot the publisher ID and revenue terms at accrual time. Ownership changes do not rewrite historical revenue.

Internal payout operations use `pending`, `eligible`, `processing`, `paid`, `failed`, and `reversed` states. The first release keeps actual developer payment manual: an authorized finance administrator records the Alipay transaction number, amount, payer, paid time, and evidence reference. The model reserves an adapter boundary for a future Alipay merchant-transfer product without enabling automatic transfers now.

### Package 5: Admin And Maintainability

Admin Module App lists move to server-side cursor pagination and filters for application state, package review, build state, runtime failures, payment state, refund state, publisher, and revenue settlement state.

The diagnostic view links:

- Application, version, build, installation, and immutable artifact.
- Invocation, container, run, workflow, node, and artifact.
- Order, Alipay trade, notification, refund, license, revenue entry, settlement batch, payout, and audit event.

`ModuleAppModel` is split incrementally by ownership boundaries such as catalog/publication, installation, records/runs/artifacts, package approval, and audit. The user router is split into market, runtime, managed data, workflow, package, and commerce routers while preserving the external TRPC namespace.

## Core Runtime Flow

1. The main server validates application publication, active installation, current entitlement, license, plan, and workspace membership.
2. It resolves the ready build and immutable artifact hash.
3. It signs a runtime-surface capability with a maximum five-minute TTL and artifact hash binding.
4. It creates an invocation record and acquires a Redis idempotency lease.
5. The runtime orchestrator creates a disposable container with the fixed policy.
6. The container receives bounded JSON on stdin and emits one bounded JSON result on stdout.
7. The orchestrator collects bounded logs and resource metadata, destroys the container, and persists the terminal state.
8. Credit settlement, output artifacts, and audit updates use existing idempotent business paths.

No Module App manifest can choose the container image, executable command, host mount, Docker socket, Linux capability, or direct network mode.

## Workflow And Trigger Flow

1. A user action, due schedule, or verified webhook creates a workflow run with an idempotency key.
2. QStash delivers a run request; the database workflow model atomically claims one runnable node.
3. The selected platform executor runs with a node-attempt idempotency key.
4. Success records bounded output and usage. Retry records the next eligible time. Wait and approval nodes enter durable waiting state.
5. The graph queues eligible descendants, skips unreachable descendants, or records a terminal run state.
6. Cancellation and entitlement failures produce explicit terminal states and never leave indefinite queued runs.

PostgreSQL is authoritative for workflow state. QStash is only a delivery mechanism.

## Alipay Payment Flow

1. The user creates a pending Module App order from a server-owned product and price.
2. The payment service creates an Alipay trade attempt and returns the signed computer website payment form or redirect data.
3. The browser transfers control to Alipay.
4. Alipay redirects the browser to `return_url`; the UI displays pending confirmation and polls the order.
5. Alipay calls `notify_url`; the server verifies, persists, and idempotently settles the order.
6. Reconciliation tasks query long-pending trades and process daily statements.
7. Refund requests are persisted before calling Alipay and reconciled until terminal.

The browser cannot transform a pending order into a paid order.

## Data Model Additions

New persistence should cover these concepts without modifying immutable historical snapshots:

- Payment attempts and provider trade identifiers.
- Normalized payment events with payload hashes and verification status.
- Refund requests and provider refund identifiers.
- Reconciliation jobs, bill rows, and detected discrepancies.
- Publishers, publisher reviews, and application ownership history.
- Payout batches and payout entries with manual Alipay evidence.
- Runtime invocations and sandbox execution metadata if existing run records cannot represent container lifecycle details cleanly.

All external identifiers require unique constraints appropriate to provider, merchant, and event scope. All payment, refund, settlement, and payout transitions use transactions and row locks.

## Error Handling

- Runtime policy errors fail before container creation.
- Container creation failures, timeouts, OOM exits, cancellation, and malformed output have stable public error codes and redacted internal diagnostics.
- Redis unavailability fails closed for mutation replay protection and payment/webhook idempotency.
- QStash delivery errors preserve runnable database state for retry.
- Alipay verification failures return failure without changing order state.
- Payment amount or seller mismatches create security audit events and reconciliation discrepancies.
- Refund uncertainty remains `processing`; it never revokes a license based only on a local request.
- Publisher payout failures remain retryable and never modify immutable revenue accrual entries.

## Feature Flags And Rollout

Use independent flags for runtime invocation, workflow privileged executors, schedule dispatch, Alipay payment creation, Alipay automatic settlement, publisher payouts, and public marketplace execution.

Rollout order:

1. Administrator allowlist.
2. Publisher allowlist.
3. Small production traffic with automatic rollback thresholds.
4. General availability after sustained runtime, payment, and reconciliation health.

Disabling a flag stops new operations but preserves query, reconciliation, refund, and audit access for existing records.

## Verification Strategy

### Runtime Gate

- Policy tests for image, command, entry path, mount, network, resource, and capability denial.
- Integration tests that execute real Node and Python fixtures in disposable containers.
- Escape, path traversal, fork/PID exhaustion, memory, CPU, timeout, log flood, malformed output, and cleanup probes.
- Multi-instance Redis replay and lease tests.
- Runtime image digest, health check, artifact mount, and rollback probes.

### Execution Gate

- Executable action routing tests proving platform actions never enter the uploaded-code sandbox.
- Real workflow tests for AI, HTTP, function, retry, compensation, wait, approval, cancellation, and idempotent charging.
- Schedule duplicate-dispatch and multi-worker lease tests.
- Webhook authorization, replay, rejected-delivery, and terminal-state tests.

### Payment Gate

- Alipay sandbox payment completion.
- Invalid signature, wrong App ID, wrong seller, amount mismatch, duplicate notification, and notification reordering tests.
- Trade query recovery when notification delivery is delayed.
- Full and partial refund tests, including repeated refund notifications.
- Daily bill reconciliation with missing, duplicate, and mismatched transactions.

### Operations Gate

- Publisher review and ownership-history tests.
- Revenue ownership snapshot tests.
- Manual payout recording, duplicate transaction number, reversal, and audit tests.
- Admin pagination, filtering, permissions, loading, empty, error, and large-data browser tests.

### Production Gate

- PostgreSQL, Redis, S3, QStash, Docker, and Alipay sandbox dependencies are reproducible in CI or a documented pre-production environment.
- Desktop and browser E2E cover purchase, notification confirmation, install, launch, executable action, workflow progress, refund, and revoked launch.
- Observability dashboards expose invocation count, latency, timeout, OOM, cleanup failure, workflow backlog, payment verification failure, reconciliation discrepancy, refund age, and payout state.

## Fast Execution Rules

- Build vertical slices that produce independently testable software and commit each slice separately.
- Run targeted Vitest and integration tests during development; expand type-check, lint, PostgreSQL, container, and browser verification at package gates.
- Start Runtime Security and Alipay adapter work in parallel.
- Start workflow integration after the sandbox launcher interface is stable.
- Start admin read-only payment and runtime diagnostics as soon as the new read models exist.
- Avoid pre-warmed pools, multi-provider payment abstraction beyond the required interface, automatic developer transfer, and unrelated refactors.
- Keep every production capability disabled until its acceptance gate passes.

## Completion Criteria

- `ModuleAppRuntimeClient` has a production executable-action caller.
- Uploaded code runs only in disposable policy-constrained containers.
- Replay protection, rate limiting, leases, schedules, and payment notifications use shared multi-instance state.
- AI, HTTP, and function workflow nodes have production adapters and explicit permission boundaries.
- Schedules and webhooks cannot create orphaned indefinite queued runs.
- Alipay asynchronous notification is the only automatic payment-settlement authority.
- Refund and reconciliation state is durable and auditable.
- Publisher ownership is stable and historical revenue ownership is immutable.
- Administrators can trace runtime, workflow, payment, refund, revenue, and payout records end to end.
- PostgreSQL integration, real container probes, and browser E2E run without manual developer setup.
- Production deployment includes runtime health checks, resource policies, artifact mounts, observability, blue-green switching, and rollback.
