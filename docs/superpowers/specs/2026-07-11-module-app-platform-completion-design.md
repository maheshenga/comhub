# Module App Platform Completion Design

Date: 2026-07-11
Project: ComHub / LobeHub customization
Status: Approved design, pending user review and implementation plans

## 1. Decision

ComHub will complete Module App Platform as its single extensibility platform for
ordinary business applications, AI applications, workflow applications, admin-built
modules, system modules, and reviewed third-party applications.

Applications open directly inside the ComHub product shell, but third-party frontend
code executes in a sandboxed iframe on a separate origin. Server code executes in
platform-managed Node.js or Python workers built from fixed platform images. Uploaded
applications cannot supply a Dockerfile, arbitrary container image, or long-lived daemon.

The completed platform supports:

- personal and team installations;
- multi-page applications;
- JSON collections and managed relational tables;
- request/response functions, queue jobs, schedules, and webhooks;
- free, plan-entitled, one-time, and subscription applications;
- real credit ledger settlement and module-specific AI multipliers;
- immutable versions, upgrades, rollback, and uninstall retention;
- verified developer submission, platform builds, review, signing, and publishing.

External antivirus infrastructure is explicitly excluded from this design. Existing
archive validation, static package scanning, review gates, and cleanup controls remain
required.

## 2. Existing Baseline

The design extends the current Module App implementation instead of creating another
marketplace or runtime domain. The current baseline already includes:

- user marketplace, detail, personal, team, and runtime routes;
- personal installation and uninstall operations;
- personal and team record CRUD with permission checks;
- admin app, page, action, billing, entitlement, and publishing controls;
- run, artifact, installation, and audit views;
- persistent ZIP upload sessions, quotas, atomic claims, package validation, static
  scanning, admin rescan, clean-only review, and rejected-package cleanup;
- API Action HTTP execution with URL safety and secret redaction;
- run persistence and billing snapshots.

Uploaded packages remain non-executable until the isolated build and runtime work in
this design is delivered and enabled through production rollout controls.

## 3. Scope And Non-Goals

### 3.1 In scope

- Isolated frontend and server execution.
- A versioned developer SDK and capability gateway.
- Managed application data and workflow execution.
- AI Router integration and real credit settlement.
- Marketplace purchasing, plan entitlement, and developer revenue sharing.
- Immutable package versions, controlled upgrades, rollback, and uninstall lifecycle.
- Developer identity, package provenance, signing, observability, and production rollout.
- Browser E2E coverage for personal and team application journeys.

### 3.2 Non-goals

- External antivirus service integration.
- User-defined Dockerfiles or arbitrary container images.
- Arbitrary long-lived server processes.
- Direct access to ComHub databases, cookies, DOM, local storage, or provider secrets.
- Automatic migration of MCP or Skills into Module App Platform.
- Reintroduction of Platform Plugin Marketplace.
- A second AI provider, billing, identity, or notification stack dedicated to modules.

## 4. Architecture

The target architecture separates the trusted control plane from untrusted application
execution.

```text
ComHub shell
  -> sandboxed application frontend on a separate origin
     -> versioned Module SDK and capability gateway
        -> entitlement, policy, quota, and billing checks
           -> Node.js/Python request workers
           -> workflow, queue, schedule, and webhook workers
           -> JSON collections and managed relational data
           -> existing AI, file, notification, and credit services
```

### 4.1 Main-site shell

ComHub owns navigation, page title, installation context, plan state, team context,
loading, errors, and lifecycle actions. Proposed route families are:

- `/apps/:slug` for personal installations;
- `/workspace/:workspaceId/apps/:slug` for team installations;
- `/apps/:slug/:pageKey` for application pages.

The exact route registration must follow the existing SPA route conventions and remain
synchronized across desktop router configurations.

### 4.2 Isolated frontend origin

Application frontend assets are served from `MODULE_APP_RUNTIME_ORIGIN`. The iframe is
sandboxed and does not receive same-origin access to ComHub. Communication uses an
allowlisted `postMessage` bridge implemented by the Module SDK.

The runtime origin must apply application-specific CSP, frame ancestry, asset integrity,
and cache rules. Application code cannot read ComHub cookies, DOM, local storage, or
internal API credentials.

### 4.3 Capability gateway

The gateway accepts short-lived capabilities bound to:

- application and immutable version;
- installation;
- user and personal or team scope;
- declared permissions;
- allowed operations and resource ceilings;
- expiry and nonce.

Every call revalidates installation status, entitlement, membership, permission, quota,
and billing policy. Capabilities are not reusable across applications, installations,
users, or teams.

### 4.4 Execution plane

The platform provides fixed Node.js and Python runtime images. Separate ephemeral worker
pools execute synchronous functions and background work. Runtime policy limits CPU,
memory, execution time, concurrency, filesystem use, response size, and outbound network
access.

Long-lived daemons are not supported. Long-running work must use persisted workflow or
queue execution and return a run identifier to the frontend.

## 5. Application Package Contract

Every source ZIP contains a versioned `module-app.yaml` manifest. The manifest declares:

- stable application identity, semantic version, and minimum platform version;
- frontend build profile, output directory, and page routes;
- Node.js or Python functions;
- queue jobs, schedules, and webhooks;
- JSON collections and managed table schemas;
- system capabilities and outbound network hosts;
- plan requirements, purchase products, AI multipliers, and resource limits;
- data export, retention, and uninstall policies;
- SDK compatibility range and release channel.

The schema is versioned independently from the application. Unknown required fields,
unsupported schema versions, undeclared entrypoints, path traversal, symlinks, archive
bombs, and policy violations reject the package before building.

Frontend frameworks are not coupled to ComHub. React, Vue, Svelte, and plain web projects
are supported when their approved build profile produces static assets. Server code is
limited to supported Node.js and Python profiles.

## 6. Build, Provenance, And Publishing

Only verified developers or verified organizations may submit executable applications
for public review. Ordinary users may create drafts and test installations but cannot
publish executable packages.

The publishing pipeline is:

1. Claim an uploaded source archive atomically.
2. Validate archive structure and `module-app.yaml`.
3. Build in an ephemeral fixed image without platform credentials.
4. Restrict dependency access to approved package mirrors and require lock files.
5. Run package tests, current static scanning, and policy checks.
6. Generate an SBOM, source hash, build provenance, and artifact hash.
7. Sign the immutable artifact with platform and verified publisher identity.
8. Submit the version and its requested capabilities for administrator review.
9. Publish to a test or stable channel after approval.
10. Promote through installation-level canaries before broad release.

Build products use content-addressed storage. A published version cannot be overwritten,
rebuilt in place, or silently change permissions, pricing, or schema.

Version states are:

`draft -> uploaded -> validating -> building -> review -> approved -> published`

Terminal or exceptional states are `build_failed`, `rejected`, `suspended`, `deprecated`,
and `revoked`.

## 7. SDK And Controlled System APIs

The versioned SDK exposes capability-scoped namespaces:

- `context`: user, installation, locale, personal scope, and team scope;
- `data`: collections, managed tables, transactions, queries, and pagination;
- `ai`: existing AI Router calls, streaming, structured output, and generation;
- `files`: scoped upload, download, metadata, and temporary links;
- `notifications`: approved in-product and external delivery channels;
- `tasks`: queue jobs, schedules, webhooks, runs, cancellation, and progress;
- `http`: outbound requests to reviewed hosts only;
- `secrets`: server-only access to encrypted installation configuration;
- `billing`: entitlement, estimate, balance, and settled usage information;
- `ui`: theme, locale, navigation, modal, and shell messaging.

The SDK is the only supported system integration boundary. Applications cannot call
internal TRPC procedures, access raw SQL, receive provider API keys, or bypass policy and
billing services.

## 8. Data Model And Isolation

The platform supports two managed data modes through one authorization layer.

### 8.1 JSON collections

JSON collections support settings, form submissions, lightweight records, and evolving
schemas. They require cursor pagination, query limits, size limits, and indexed metadata.

### 8.2 Managed relational tables

Applications declare tables, columns, indexes, uniqueness, relationships, and permitted
operations. The platform owns physical schema management and exposes typed SDK access.
Applications cannot execute raw SQL.

### 8.3 Ownership and authorization

Every record, file, run, artifact, and secret is bound to an `installationId` and an
explicit `personal` or `team` scope. Team access combines installation role mapping with
current workspace membership. Removing a member immediately removes access without
changing ownership of shared records.

All list APIs use cursor pagination and enforce maximum row count, response size, and
execution time.

### 8.4 Schema migration

Schema changes are declarative and versioned. Upgrade preparation validates compatibility
and produces a migration plan. Migrations run transactionally after a recovery point is
created. Destructive operations require explicit administrator review and cannot be
introduced through an automatic patch update.

## 9. Execution And Workflow Model

The execution model supports:

- synchronous request/response functions;
- persisted queue jobs;
- schedules;
- signed webhooks;
- workflows composed of function, HTTP, AI, condition, transformation, parallel, wait,
  and human-approval nodes.

Each run and node stores status, timestamps, attempt count, input and output summaries,
usage, cost, artifacts, and a redacted error. Long work returns a run identifier and the
frontend subscribes to progress, so navigation or browser closure does not terminate the
operation.

Nodes define timeout, retry policy, idempotency key, and optional compensation behavior.
Webhook execution validates signatures, timestamps, and replay protection. Schedules and
background jobs pass the same entitlement, quota, permission, and billing checks as
interactive requests.

## 10. AI Router And Credit Ledger

Module AI calls use the existing user AI Router. They inherit user or team model access,
administrator model policy, provider availability, and plan limits. Modules cannot store
provider API keys or assign model base prices.

The charging sequence is:

1. Validate installation, entitlement, model access, and balance.
2. Create a credit reservation for estimated usage.
3. Execute the model or resource operation.
4. Settle actual token, runtime, storage, and network usage.
5. Release unused reservation.
6. Commit run, artifact, and ledger references consistently.

The idempotency identity includes installation, run, and node. The immutable ledger
records reservation, settlement, release, refund, grant, and administrator adjustment.

Effective AI charges begin with the platform model charge and then apply the reviewed
module multiplier. An application has a default multiplier and may declare action- or
workflow-node overrides within administrator-configured bounds. Billing snapshots retain
model, price, currency, exchange rate, multiplier, and token usage. The UI displays an
estimate before execution and actual usage afterward.

The existing unfinished AI content-generation path must be wired through the same user AI
Router and ledger contract instead of adding a separate execution path.

## 11. Marketplace And Commercial Model

An application may be:

- free;
- included in selected plans;
- sold once;
- subscribed monthly or yearly;
- licensed personally;
- licensed to a team by seat or whole workspace;
- offered with a trial, coupon, or time-limited promotion.

Entitlement Service is the only authority used by pages, APIs, jobs, and webhooks. Order,
price, promotion, entitlement, and billing rules are snapshotted so later catalog changes
do not rewrite historical agreements.

Developer revenue and platform resource charges are separate. Revenue-share percentage,
settlement period, refund reserve, and minimum payout are administrator settings. Refunds
reverse unsettled developer earnings. AI, runtime, storage, and network costs do not enter
developer revenue share unless a future explicit policy adds them.

The developer console shows sales, refunds, fees, pending settlement, and paid settlement
without granting any ability to mutate ledger history.

## 12. Installation Lifecycle

### 12.1 Install

Installation selects personal or team scope, validates purchase and plan entitlement,
shows capabilities and billing behavior, obtains consent, provisions data and secrets,
pins an immutable version, and exposes the main-site route.

Team installation and management require an administrator role. Role mappings control
who can run the application, edit shared data, or manage configuration.

### 12.2 Upgrade

Installations may choose manual upgrades, automatic patch upgrades, a test channel, or a
version lock. Upgrade preparation checks SDK compatibility, changed capabilities, price
changes, plan changes, and schema compatibility. New sensitive capabilities require new
consent. Installation-level canaries limit release impact.

### 12.3 Rollback

Code and static assets roll back by switching to an older immutable version. Automatic
rollback is allowed only when the active data schema remains compatible. Otherwise the
platform restores the pre-migration recovery point or runs an approved reverse migration.
Failed upgrades leave the previous version active.

### 12.4 Uninstall

Uninstall immediately disables routes, capabilities, webhooks, schedules, queue starts,
and new runs. Data, files, and secrets enter a configured retention period. During that
period an authorized owner may export data or restore the installation. Expiration queues
idempotent cleanup of data, files, artifact copies, and secrets.

Orders, ledger entries, settlements, and audit records are retained. Team uninstall logs
the actor and affected workspace.

### 12.5 Suspension and revocation

Suspension blocks new installs and runs while preserving data. Revocation immediately
blocks execution but retains owner export access. Administrators have application- and
version-level kill switches.

Installed-app views use cursor pagination and support scope, status, version, and update
time filters.

## 13. Administration And Developer Experience

The administrator information architecture groups Module App functionality under one
platform section:

- applications and verified publishers;
- versions, builds, review, signing, and channels;
- installations, orders, entitlements, and promotions;
- runtime images, SDK versions, capabilities, egress, and resource policies;
- queues, schedules, webhooks, runs, retries, and artifacts;
- credit multipliers, revenue share, settlement, and refunds;
- retention, cleanup, audit, and emergency controls.

High-risk operations require explicit confirmation and an audit record.

The developer center provides identity verification, application creation, manifest
validation, source upload, build logs, test reports, review feedback, release channels,
compatibility declarations, test installations, SDK documentation, examples, local
tooling, analytics, and settlement views.

Test installations use isolated test data and test credits. They cannot publish or bypass
administrator review.

## 14. Observability And Security Controls

Each request carries trace, run, and node identifiers. Operators can filter metrics and
logs by application, version, installation, user or team scope, and worker class.

Required metrics include build success, cold start, duration, failures, retries, queue
backlog, resource limits, credit settlement, refunds, webhook failures, and cleanup lag.
Secrets, tokens, cookies, headers, and declared sensitive fields are redacted before logs,
errors, audit payloads, or developer-visible diagnostics are persisted.

Alerts cover elevated failure rates, queue backlog, repeated limit violations, billing
inconsistency, worker health, webhook delivery, and cleanup failures. Developers can view
only redacted telemetry for applications they own.

Security verification includes capability isolation, authorization, SSRF prevention,
network egress policy, archive handling, dependency provenance, iframe boundaries, secret
handling, replay protection, and worker escape resistance.

## 15. Production Rollout

Production rollout is gated and reversible:

1. Deploy database migrations, runtime origin, TLS, CSP, object storage, queue, scheduler,
   signing, and worker infrastructure behind feature flags.
2. Run only administrator-maintained applications.
3. Enable verified developer test channels.
4. Canary a small set of free applications.
5. Enable paid purchasing and developer settlement after ledger reconciliation proves
   stable.
6. Enable team applications, automatic upgrades, and complex workflows last.

Each phase requires migration rehearsal, smoke tests, telemetry thresholds, a traffic or
feature-flag rollback, and confirmation that current installations remain usable.

Deployment must preserve the established GitHub Actions and Baota blue-green strategy.
Application state remains outside release images, and production migrations must have a
backup and documented rollback boundary.

## 16. Testing Strategy

Core behavior requires tests before implementation or refactoring:

- manifest schema and package contract tests;
- SDK and gateway contract tests across supported versions;
- personal and team authorization tests;
- worker policy, timeout, cancellation, and outbound network tests;
- workflow persistence, retry, idempotency, and compensation tests;
- AI Router and credit reservation/settlement concurrency tests;
- purchase, entitlement, promotion, refund, and revenue-share tests;
- schema migration, upgrade, rollback, uninstall, restore, and cleanup tests;
- provenance, signature, suspension, and revocation tests;
- browser E2E for developer submission, review, purchase, installation, execution,
  background progress, upgrade, rollback, and uninstall;
- production smoke tests for runtime origin, workers, queues, object storage, billing, and
  emergency controls.

## 17. Implementation Decomposition

This design is intentionally broader than one safe implementation plan. It must be
delivered as five independently reviewed and reversible plans:

1. Runtime, isolated frontend, build pipeline, capability gateway, and SDK.
2. Managed data, workflows, queues, schedules, webhooks, and team completeness.
3. AI Router, credit ledger, marketplace purchasing, entitlements, and settlement.
4. Immutable versions, upgrade, rollback, uninstall, retention, and pagination.
5. Publisher verification, provenance, signing, Browser E2E, production migration, and
   staged rollout.

Each plan must begin with contract or behavior tests for core paths, preserve existing
non-executable package review until its replacement is proven, and ship behind explicit
feature flags where execution or billing risk is introduced.

## 18. Acceptance Criteria

The platform completion program is successful when:

- reviewed applications open inside the main-site shell without gaining main-site origin
  access;
- source packages are reproducibly built and published as signed immutable versions;
- Node.js and Python functions run only in fixed, policy-limited workers;
- applications use versioned SDK capabilities instead of internal APIs or raw databases;
- personal and team data, runs, artifacts, permissions, and billing are complete;
- request functions, workflows, queues, schedules, and webhooks survive page navigation;
- AI calls use the existing user AI Router and settle through the real credit ledger;
- all supported purchase and plan models produce consistent entitlements and refunds;
- upgrades, rollback, uninstall retention, restoration, and cleanup are auditable;
- verified publishers can submit, diagnose, release, and receive settlement;
- administrators can review, suspend, revoke, inspect, and roll back applications;
- targeted tests, type checking, Browser E2E, migration rehearsal, smoke tests, and
  blue-green rollback gates pass before broad production enablement.
