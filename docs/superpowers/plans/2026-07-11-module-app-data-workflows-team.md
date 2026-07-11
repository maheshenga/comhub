# Module App Data, Workflows, And Team Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give installed applications isolated JSON and relational data APIs plus durable workflows, queues, schedules, webhooks, and complete team-scoped runs and artifacts.

**Architecture:** Keep `module_app_records` as the JSON collection store and add logical managed tables backed by platform-owned rows, not tenant-created SQL. Persist workflows and nodes in PostgreSQL, dispatch durable work through the existing QStash integration, and route every operation through installation and workspace authorization.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL JSONB, TRPC, Upstash QStash/Workflow, S3-compatible storage, React/SWR, Vitest.

## Global Constraints

- Execute after `2026-07-11-module-app-runtime-sdk-build.md` and migration `0136`.
- This plan owns migration `0137`; do not create later-numbered module migrations concurrently.
- Every data row, run, node, schedule, webhook, and artifact must bind to `installationId`.
- Preserve `personal` and `workspace` scope semantics and current workspace RBAC checks.
- Do not allow application SQL, DDL, arbitrary cron expressions, unsigned webhooks, or unbounded queries.
- Use cursor pagination with explicit limits for every list operation.
- Page navigation or browser closure must not cancel durable runs.
- Keep MCP and Skills outside this platform.
- Core authorization, idempotency, retry, and isolation paths require tests first.

---

## File Structure

- `packages/types/src/moduleAppData.ts`: collection, logical table, query, and transaction contracts.
- `packages/types/src/moduleAppWorkflow.ts`: workflow graph, run, node, schedule, and webhook contracts.
- `packages/database/migrations/0137_add_module_app_data_workflows.sql`: installation binding and workflow/data tables.
- `packages/database/src/models/moduleAppData.ts`: isolated collection and managed-row transactions.
- `packages/database/src/models/moduleAppWorkflow.ts`: durable run and node state transitions.
- `packages/business-server/src/module-apps/data/`: schema validation, query policy, and SDK handlers.
- `packages/business-server/src/module-apps/workflows/`: graph validation and node execution.
- `apps/server/src/workflows/moduleApp/`: QStash dispatch and durable resume behavior.
- `src/features/ModuleAppRuntime/`: records, workflow progress, team context, and artifacts.

### Task 1: Data And Workflow Contracts

**Files:**
- Create: `packages/types/src/moduleAppData.ts`
- Create: `packages/types/src/moduleAppData.test.ts`
- Create: `packages/types/src/moduleAppWorkflow.ts`
- Create: `packages/types/src/moduleAppWorkflow.test.ts`
- Modify: `packages/types/src/moduleAppRuntime.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `ModuleAppTableSchema`, `ModuleAppDataQuery`, `ModuleAppWorkflowDefinition`, `ModuleAppWorkflowNode`, and run-status schemas.
- Consumes: capability permissions from plan 1.

- [x] **Step 1: Add failing contract tests**

```ts
expect(moduleAppTableSchema.parse({
  fields: [{ key: 'email', required: true, type: 'string' }],
  indexes: [{ fields: ['email'], unique: true }],
  key: 'candidates',
})).toMatchObject({ key: 'candidates' });

expect(() => moduleAppDataQuerySchema.parse({ limit: 1001, tableKey: 'candidates' })).toThrow();
expect(() => moduleAppWorkflowDefinitionSchema.parse({ nodes: [{ key: 'a', type: 'unknown' }] })).toThrow();
```

- [x] **Step 2: Run contract tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppData.test.ts packages/types/src/moduleAppWorkflow.test.ts`

Expected: FAIL because the schemas do not exist.

- [x] **Step 3: Implement bounded contracts**

```ts
export const moduleAppWorkflowNodeTypeSchema = z.enum([
  'function', 'http', 'ai', 'condition', 'transform', 'parallel', 'wait', 'approval',
]);
export const moduleAppWorkflowRunStatusSchema = z.enum([
  'queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled',
]);
```

Table fields support string, number, boolean, date, JSON, and reference types. Queries support equality, range, prefix, declared sort keys, and cursor pagination only. Workflow definitions require unique node keys, valid edges, one start node, reachable nodes, bounded fan-out, and no unbounded cycles.

- [x] **Step 4: Run tests and commit**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppData.test.ts packages/types/src/moduleAppWorkflow.test.ts packages/types/src/moduleAppRuntime.test.ts`

Expected: PASS.

```bash
git add packages/types/src/moduleAppData.ts packages/types/src/moduleAppData.test.ts packages/types/src/moduleAppWorkflow.ts packages/types/src/moduleAppWorkflow.test.ts packages/types/src/moduleAppRuntime.ts packages/types/src/index.ts
git commit -m "feat: define module app data and workflow contracts"
```

### Task 2: Installation-Bound Data And Workflow Schema

**Files:**
- Create: `packages/database/migrations/0137_add_module_app_data_workflows.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`
- Create: `packages/database/src/models/moduleAppData.ts`
- Create: `packages/database/src/models/__tests__/moduleAppData.test.ts`
- Create: `packages/database/src/models/moduleAppWorkflow.ts`
- Create: `packages/database/src/models/__tests__/moduleAppWorkflow.test.ts`

**Interfaces:**
- Produces: `ModuleAppDataModel` and `ModuleAppWorkflowModel`.
- Adds mandatory installation identity to records, runs, and artifacts without deleting existing rows.

- [x] **Step 1: Add failing isolation and transition tests**

```ts
await model.insertRow({ installationId: installA, rowKey: 'one', tableKey: 'jobs', values });
await expect(model.getRow({ installationId: installB, rowKey: 'one', tableKey: 'jobs' })).resolves.toBeNull();

const claimed = await workflowModel.claimRunnableNode({ workerId: 'worker-a' });
expect(claimed?.status).toBe('running');
await expect(workflowModel.claimRunnableNode({ workerId: 'worker-b' })).resolves.toBeNull();
```

- [x] **Step 2: Run database tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppData.test.ts packages/database/src/models/__tests__/moduleAppWorkflow.test.ts packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: FAIL because migration `0137` and models are absent.

- [x] **Step 3: Add schema and backfill installation IDs**

Add `installation_id` to `module_app_records`, `module_app_runs`, and `module_app_artifacts`. Backfill only when one matching installation exists; quarantine ambiguous legacy rows in migration metadata and keep columns nullable for one release with model-level write enforcement.

Create:

- `module_app_data_schemas` for immutable schema versions;
- `module_app_data_rows` with installation, table, row key, JSONB values, status, actor, and timestamps;
- `module_app_workflow_runs` with installation, workflow key, version, status, idempotency key, and context;
- `module_app_workflow_nodes` with run, node key, attempts, lease, input/output summaries, usage, and error;
- `module_app_schedules` with validated schedule, timezone, next run, and enabled state;
- `module_app_webhooks` with hashed secret, replay window, status, and last delivery.

Use unique indexes for installation/table/row key and installation/workflow/idempotency key. Claim nodes with `FOR UPDATE SKIP LOCKED` and an expiring lease.

- [x] **Step 4: Verify migration and model behavior**

Run the command from Step 2.

Expected: PASS, including cross-installation denial, unique constraints, leases, and retry limits.

- [x] **Step 5: Commit**

```bash
git add packages/database/migrations/0137_add_module_app_data_workflows.sql packages/database/migrations/meta/_journal.json packages/database/src/schemas/moduleApp.ts packages/database/src/schemas/moduleApp.schema.test.ts packages/database/src/models/moduleAppData.ts packages/database/src/models/moduleAppWorkflow.ts packages/database/src/models/__tests__/moduleAppData.test.ts packages/database/src/models/__tests__/moduleAppWorkflow.test.ts
git commit -m "feat: persist isolated module app data and workflows"
```

### Task 3: Managed Data Service And SDK Gateway

**Files:**
- Create: `packages/business-server/src/module-apps/data/schemaValidator.ts`
- Create: `packages/business-server/src/module-apps/data/schemaValidator.test.ts`
- Create: `packages/business-server/src/module-apps/data/service.ts`
- Create: `packages/business-server/src/module-apps/data/service.test.ts`
- Modify: `packages/module-app-sdk/src/client.ts`
- Modify: `packages/module-app-sdk/src/client.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`

**Interfaces:**
- Produces: SDK methods `data.list`, `data.get`, `data.insert`, `data.update`, `data.archive`, and `data.transaction`.
- Consumes: verified installation capability and `ModuleAppDataModel`.

- [x] **Step 1: Add failing permission, constraint, and pagination tests**

```ts
await expect(service.insert({ capability: readOnly, tableKey: 'jobs', values })).rejects.toThrow('MODULE_APP_CAPABILITY_DENIED');
await expect(service.insert({ capability: writer, tableKey: 'jobs', values: { email: 'bad' } })).rejects.toThrow('MODULE_APP_DATA_SCHEMA_INVALID');
expect((await service.list({ capability: reader, limit: 20, tableKey: 'jobs' })).nextCursor).toBeDefined();
```

- [x] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/data/schemaValidator.test.ts packages/business-server/src/module-apps/data/service.test.ts packages/module-app-sdk/src/client.test.ts apps/server/src/routers/lambda/moduleApp.test.ts`

Expected: FAIL because managed data handlers are absent.

- [x] **Step 3: Implement logical relational enforcement**

```ts
export interface ModuleAppDataService {
  insert(input: AuthorizedDataInsert): Promise<ModuleAppDataRow>;
  list(input: AuthorizedDataQuery): Promise<{ items: ModuleAppDataRow[]; nextCursor: string | null }>;
  transaction(input: AuthorizedDataTransaction): Promise<ModuleAppDataMutationResult[]>;
}
```

Validate required fields, types, unique indexes, and references inside one database transaction. Reject undeclared fields unless the schema explicitly allows additional JSON. Apply maximum 100 operations per transaction, 100 rows per page, and bounded response bytes.

- [x] **Step 4: Verify data service behavior and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/business-server/src/module-apps/data packages/module-app-sdk/src/client.ts packages/module-app-sdk/src/client.test.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts
git commit -m "feat: expose managed module app data APIs"
```

### Task 4: Durable Workflow Engine

**Files:**
- Create: `packages/business-server/src/module-apps/workflows/graph.ts`
- Create: `packages/business-server/src/module-apps/workflows/graph.test.ts`
- Create: `packages/business-server/src/module-apps/workflows/engine.ts`
- Create: `packages/business-server/src/module-apps/workflows/engine.test.ts`
- Create: `packages/business-server/src/module-apps/workflows/executors.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.test.ts`

**Interfaces:**
- Produces: `ModuleAppWorkflowEngine.start`, `executeClaimedNode`, `resume`, and `cancel`.
- Node executors consume the runtime client, safe HTTP runner, AI runner, and managed data service.

- [x] **Step 1: Add failing persistence and retry tests**

```ts
const run = await engine.start({ idempotencyKey: 'install:action:request', installationId, workflow });
await engine.executeClaimedNode({ runId: run.id, workerId: 'w1' });
expect(await model.getRun(run.id)).toMatchObject({ status: 'waiting' });
await engine.resume({ nodeKey: 'approval', runId: run.id, value: { approved: true } });
expect(await engine.drain(run.id)).toMatchObject({ status: 'succeeded' });
```

- [x] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/workflows/graph.test.ts packages/business-server/src/module-apps/workflows/engine.test.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts`

Expected: FAIL because the workflow engine is absent.

- [x] **Step 3: Implement deterministic node execution**

Persist node input before execution and output after success. Use node idempotency `runId:nodeKey:attempt`, bounded exponential retry, explicit terminal failure, and optional compensation nodes. Parallel branches join only when all required parents succeed. Wait and approval nodes persist without holding a worker.

- [x] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS, including duplicate dispatch, crash-after-output, retry exhaustion, cancellation, and compensation.

```bash
git add packages/business-server/src/module-apps/workflows packages/business-server/src/module-apps/runModuleAppAction.ts packages/business-server/src/module-apps/runModuleAppAction.test.ts
git commit -m "feat: execute durable module app workflows"
```

### Task 5: QStash Dispatch, Schedules, And Signed Webhooks

**Files:**
- Create: `apps/server/src/workflows/moduleApp/index.ts`
- Create: `apps/server/src/workflows/moduleApp/run.ts`
- Create: `apps/server/src/workflows/moduleApp/run.test.ts`
- Create: `src/app/(backend)/api/workflows/module-app/run/route.ts`
- Create: `src/app/(backend)/api/webhooks/module-app/[webhookId]/route.ts`
- Create: `src/app/(backend)/api/webhooks/module-app/[webhookId]/route.test.ts`
- Modify: `packages/module-app-sdk/src/client.ts`

**Interfaces:**
- Produces: durable dispatch, signed webhook ingestion, schedule trigger, and `tasks.getRun`/`tasks.cancel` SDK methods.
- Consumes: existing `workflowClient`/QStash configuration and workflow engine from Task 4.

- [x] **Step 1: Add failing replay and resume tests**

```ts
await expect(postWebhook({ signature: oldSignature, timestamp: expired })).resolves.toMatchObject({ status: 401 });
await expect(postWebhook({ deliveryId: 'delivery-1', signature: valid })).resolves.toMatchObject({ status: 202 });
await expect(postWebhook({ deliveryId: 'delivery-1', signature: valid })).resolves.toMatchObject({ duplicate: true });
```

- [x] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' apps/server/src/workflows/moduleApp/run.test.ts 'src/app/(backend)/api/webhooks/module-app/[webhookId]/route.test.ts'`

Expected: FAIL because routes and workflow dispatch are absent.

- [x] **Step 3: Implement dispatch and verification**

Use QStash signature verification for internal workflow delivery and HMAC-SHA256 over timestamp plus raw body for application webhooks. Store only a hash of the webhook secret. Accept schedules only from a bounded five-field cron parser, require timezone, and compute the next run server-side.

- [x] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add apps/server/src/workflows/moduleApp src/app/'(backend)'/api/workflows/module-app src/app/'(backend)'/api/webhooks/module-app packages/module-app-sdk/src/client.ts
git commit -m "feat: dispatch module app jobs schedules and webhooks"
```

### Task 6: Team Runs, Artifacts, And Runtime Progress UI

**Files:**
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `src/services/moduleApp.ts`
- Modify: `src/services/moduleApp.test.ts`
- Create: `src/features/ModuleAppRuntime/WorkflowProgress.tsx`
- Create: `src/features/ModuleAppRuntime/WorkflowProgress.test.tsx`
- Modify: `src/features/ModuleAppRuntime/index.tsx`
- Modify: `src/features/ModuleAppRuntime/RunResultPanel.tsx`

**Interfaces:**
- Produces: cursor-paginated `listRuns`, `listArtifacts`, `getRun`, `cancelRun`, and progress polling for personal/team installations.
- Consumes: workspace membership and installation-bound data.

- [x] **Step 1: Add failing team isolation and progress tests**

```ts
await expect(router.listArtifacts({ appId, workspaceId: unauthorizedWorkspace })).rejects.toMatchObject({ code: 'FORBIDDEN' });
expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
expect(screen.getByText('2 / 5')).toBeVisible();
```

- [x] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleApp.marketplace.test.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.test.ts src/features/ModuleAppRuntime/WorkflowProgress.test.tsx`

Expected: FAIL because list APIs are app-only and progress UI is absent.

- [x] **Step 3: Complete installation and team scoping**

Change list inputs to installation plus cursor, verify workspace membership on every request, and return only artifacts from authorized runs. Poll persisted run state with SWR; stopping or navigating the page must not cancel the run. Add explicit cancel authorization and terminal-state handling.

- [x] **Step 4: Run plan verification**

Run the focused command from Step 2.

Expected: PASS.

Run: `bun run type-check`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [x] **Step 5: Update governance docs and commit**

Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md` with data modes, QStash dependency, team impact, and migration `0137`.

```bash
git add packages/database/src/models/moduleApp.ts packages/database/src/models/__tests__/moduleApp.marketplace.test.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.ts src/services/moduleApp.test.ts src/features/ModuleAppRuntime docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "feat: complete team module app execution history"
```

## Plan Acceptance Gate

- JSON collections and logical managed tables are isolated by installation.
- Applications cannot execute SQL or query undeclared fields.
- Workflows survive navigation, retries, duplicate delivery, waits, and process restarts.
- Webhooks reject invalid signatures, expired timestamps, and replays.
- Schedules are bounded and use the existing QStash infrastructure.
- Team members see only authorized records, runs, progress, and artifacts.
- All list operations are cursor-paginated and bounded.
- Targeted tests, type-check, and `git diff --check` pass.
