# Module App Trust, E2E, And Production Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify publishers, sign reproducible artifacts, expose complete developer/admin operations, prove isolation and commercial journeys in Browser E2E, and deploy the runtime through reversible production gates.

**Architecture:** Add a publisher trust domain and append-only provenance, then bind every public release to a verified publisher and signed build. Centralize runtime telemetry and kill switches in the admin surface. Production uses the established GitHub Actions and Baota blue-green flow with separate runtime images, bind-mounted state, feature flags, smoke tests, and rollback.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, Node crypto/JOSE, OpenTelemetry, Cucumber/Playwright, Docker Buildx/GHCR, Bash blue-green deployment.

## Global Constraints

- Execute after migration `0139`; this plan owns migration `0140`.
- Only verified users or verified organizations may submit executable public releases.
- Ordinary users may create drafts and test installations but cannot publish executable artifacts.
- Every published executable version must have source hash, artifact hash, SBOM hash, build identity, publisher identity, and signature.
- Signature verification is mandatory at launch and invocation, not only at review time.
- Logs must redact tokens, cookies, authorization headers, secrets, and declared sensitive fields before persistence.
- Runtime production enablement requires namespace/seccomp/resource-limit evidence; review alone is not a sandbox.
- Docker deployment uses bind mounts for state and must preserve the existing Baota blue-green traffic switch.
- External antivirus remains excluded; do not add an antivirus dependency.
- Each rollout phase has a feature flag, smoke gate, telemetry threshold, and rollback command.
- Security, billing, publisher, and production gates require tests before enablement.

---

## File Structure

- `packages/types/src/moduleAppPublisher.ts`: publisher, verification, provenance, signature, and rollout contracts.
- `packages/database/migrations/0140_add_module_app_trust.sql`: publishers, verification events, provenance, signatures, and runtime incidents.
- `packages/database/src/models/moduleAppPublisher.ts`: publisher verification and ownership.
- `apps/server/src/services/moduleAppSigning/`: artifact signing, verification, and public key rotation.
- `packages/observability-otel/src/modules/module-app/`: runtime/build/workflow/billing spans and metrics.
- `src/features/ModuleAppDeveloper/`: developer identity, builds, review, releases, sales, and diagnostics.
- `src/features/Admin/moduleApps/`: publisher review, runtime policy, kill switch, incidents, and rollout controls.
- `e2e/src/features/module-app/` and `e2e/src/steps/module-app/`: end-to-end journeys.
- `.github/workflows/comhub-deploy.yml`, `Dockerfile`, runtime Dockerfiles, and deployment scripts: build, deploy, smoke, and rollback.

### Task 1: Publisher Verification And Ownership

**Files:**
- Create: `packages/types/src/moduleAppPublisher.ts`
- Create: `packages/types/src/moduleAppPublisher.test.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/database/migrations/0140_add_module_app_trust.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/src/models/moduleAppPublisher.ts`
- Create: `packages/database/src/models/__tests__/moduleAppPublisher.test.ts`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`

**Interfaces:**
- Produces: `ModuleAppPublisherModel`, publisher status, verification event, ownership, and provenance contracts.
- Consumes: existing package submitter user identity and application source.

- [ ] **Step 1: Add failing publisher transition tests**

```ts
const publisher = await model.apply({ displayName: 'Acme', ownerUserId, type: 'organization' });
await expect(model.verify({ actorUserId: nonAdmin, publisherId: publisher.id })).rejects.toThrow('MODULE_APP_PUBLISHER_VERIFY_FORBIDDEN');
await model.verify({ actorUserId: adminId, publisherId: publisher.id });
expect(await model.canPublishExecutable({ publisherId: publisher.id })).toBe(true);
await model.suspend({ actorUserId: adminId, publisherId: publisher.id, reason: 'policy' });
expect(await model.canPublishExecutable({ publisherId: publisher.id })).toBe(false);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppPublisher.test.ts packages/database/src/models/__tests__/moduleAppPublisher.test.ts packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: FAIL because publisher trust tables and contracts are absent.

- [ ] **Step 3: Implement append-only verification history**

```ts
export const moduleAppPublisherStatusSchema = z.enum([
  'applied', 'verified', 'rejected', 'suspended', 'revoked',
]);
export const moduleAppPublisherTypeSchema = z.enum(['individual', 'organization', 'platform']);
```

Create `module_app_publishers`, `module_app_publisher_members`, `module_app_publisher_verification_events`, `module_app_release_provenance`, and `module_app_runtime_incidents`. Link apps and packages to publisher ID. Keep verification evidence metadata encrypted or redacted; never put identity documents into general audit JSON.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/types/src/moduleAppPublisher.ts packages/types/src/moduleAppPublisher.test.ts packages/types/src/index.ts packages/database/migrations/0140_add_module_app_trust.sql packages/database/migrations/meta/_journal.json packages/database/src/schemas/moduleApp.ts packages/database/src/models/moduleAppPublisher.ts packages/database/src/models/__tests__/moduleAppPublisher.test.ts packages/database/src/schemas/moduleApp.schema.test.ts
git commit -m "feat: verify module app publishers"
```

### Task 2: Artifact Provenance And Signing

**Files:**
- Create: `apps/server/src/services/moduleAppSigning/index.ts`
- Create: `apps/server/src/services/moduleAppSigning/index.test.ts`
- Create: `apps/server/src/services/moduleAppSigning/keyring.ts`
- Create: `apps/server/src/services/moduleAppSigning/keyring.test.ts`
- Modify: `apps/server/src/services/moduleAppBuild/service.ts`
- Modify: `apps/server/src/services/moduleAppBuild/service.test.ts`
- Modify: `apps/server/src/services/moduleAppRuntime/client.ts`
- Modify: `apps/server/src/services/moduleAppRuntime/client.test.ts`
- Modify: `apps/module-runtime/src/invocation.ts`
- Modify: `apps/module-runtime/src/invocation.test.ts`

**Interfaces:**
- Produces: `signModuleAppRelease`, `verifyModuleAppRelease`, and rotating keyring by `kid`.
- Consumes: source hash, artifact hash, SBOM hash, build profile, version, and verified publisher.

- [ ] **Step 1: Add failing tamper and rotation tests**

```ts
const signed = await signing.signRelease(provenance);
await expect(signing.verifyRelease(signed)).resolves.toEqual(provenance);
await expect(signing.verifyRelease({ ...signed, artifactSha256: otherHash })).rejects.toThrow('MODULE_APP_SIGNATURE_INVALID');
await keyring.rotate({ nextKeyId: '2026-q3' });
await expect(signing.verifyRelease(signed)).resolves.toEqual(provenance);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' apps/server/src/services/moduleAppSigning/index.test.ts apps/server/src/services/moduleAppSigning/keyring.test.ts apps/server/src/services/moduleAppBuild/service.test.ts apps/server/src/services/moduleAppRuntime/client.test.ts apps/module-runtime/src/invocation.test.ts`

Expected: FAIL because provenance is not signed or verified.

- [ ] **Step 3: Implement canonical signing**

```ts
export type ModuleAppReleaseProvenance = {
  appId: string;
  artifactSha256: string;
  buildId: string;
  buildProfile: string;
  manifestSha256: string;
  publisherId: string;
  sbomSha256: string;
  sourceSha256: string;
  versionId: string;
};
```

Canonicalize JSON field order, sign with Ed25519, include `kid`, and store signature plus provenance immutably. Load private keys only in the trusted server/build signer; runtime receives public keys. Verify publisher status at signing and signature at launch and invocation. Rotation retains old public keys while referenced versions exist.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add apps/server/src/services/moduleAppSigning apps/server/src/services/moduleAppBuild/service.ts apps/server/src/services/moduleAppBuild/service.test.ts apps/server/src/services/moduleAppRuntime/client.ts apps/server/src/services/moduleAppRuntime/client.test.ts apps/module-runtime/src/invocation.ts apps/module-runtime/src/invocation.test.ts
git commit -m "feat: sign and verify module app releases"
```

### Task 3: Developer Center And Publisher Administration

**Files:**
- Create: `src/features/ModuleAppDeveloper/index.tsx`
- Create: `src/features/ModuleAppDeveloper/index.test.tsx`
- Create: `src/features/ModuleAppDeveloper/BuildsTable.tsx`
- Create: `src/features/ModuleAppDeveloper/ReleasesTable.tsx`
- Create: `src/features/ModuleAppDeveloper/RevenueSummary.tsx`
- Create: `src/routes/(main)/apps/developer/index.tsx`
- Modify: `src/spa/router/desktopRouter.config.tsx`
- Modify: `src/spa/router/desktopRouter.config.desktop.tsx`
- Modify: `src/spa/router/desktopRouter.sync.test.tsx`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Create: `src/features/Admin/moduleApps/PublishersTable.tsx`
- Create: `src/features/Admin/moduleApps/PublishersTable.test.tsx`

**Interfaces:**
- Produces: developer application, build/review/release diagnostics, sales views, and admin verification controls.
- Consumes: publisher, build, package, release, and revenue services.

- [ ] **Step 1: Add failing route and authorization tests**

```tsx
expect(screen.getByText('完成开发者认证后才能提交可执行版本')).toBeVisible();
expect(screen.queryByRole('button', { name: '发布正式版' })).not.toBeInTheDocument();
expect(screen.getByText('构建失败')).toBeVisible();
expect(screen.getByText('MODULE_APP_BUILD_DEPENDENCY_DENIED')).toBeVisible();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' src/features/ModuleAppDeveloper/index.test.tsx src/features/Admin/moduleApps/PublishersTable.test.tsx packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/spa/router/desktopRouter.sync.test.tsx`

Expected: FAIL because developer and publisher surfaces are absent.

- [ ] **Step 3: Implement focused developer and admin surfaces**

Developer pages expose own publisher state, packages, builds, redacted logs, review feedback, channels, installs, sales, refunds, and settlement. Admin pages expose applications, publishers, builds, review, runtime, commerce, incidents, and audit as tabs within one Module App section; do not create another plugin admin domain.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS and both desktop route configs remain synchronized.

```bash
git add src/features/ModuleAppDeveloper src/routes/'(main)'/apps/developer src/spa/router/desktopRouter.config.tsx src/spa/router/desktopRouter.config.desktop.tsx src/spa/router/desktopRouter.sync.test.tsx packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts src/features/Admin/moduleApps
git commit -m "feat: add module app developer governance"
```

### Task 4: Observability, Redaction, And Emergency Controls

**Files:**
- Create: `packages/observability-otel/src/modules/module-app/index.ts`
- Create: `packages/observability-otel/src/modules/module-app/index.test.ts`
- Modify: `packages/business-server/src/module-apps/logRedaction.ts`
- Create: `packages/business-server/src/module-apps/logRedaction.test.ts`
- Modify: `packages/business-server/src/module-apps/runModuleAppAction.ts`
- Modify: `apps/server/src/workflows/moduleApp/run.ts`
- Modify: `apps/server/src/services/moduleAppBuild/service.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Create: `src/features/Admin/moduleApps/RuntimeControl.tsx`
- Create: `src/features/Admin/moduleApps/RuntimeControl.test.tsx`

**Interfaces:**
- Produces: module build/run/node/billing spans, metrics, incident records, and app/version kill switches.
- Consumes: existing OpenTelemetry package and audit procedures.

- [ ] **Step 1: Add failing telemetry and redaction tests**

```ts
expect(redactModuleAppLogValue({ Authorization: 'Bearer secret', cookie: 'sid=1', prompt: 'ok' })).toEqual({
  Authorization: '[REDACTED]', cookie: '[REDACTED]', prompt: 'ok',
});
expect(metric.attributes).toMatchObject({ appId, installationId, runtime: 'node22', versionId });
expect(metric.attributes).not.toHaveProperty('userPrompt');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/observability-otel/src/modules/module-app/index.test.ts packages/business-server/src/module-apps/logRedaction.test.ts src/features/Admin/moduleApps/RuntimeControl.test.tsx`

Expected: FAIL because telemetry and controls are incomplete.

- [ ] **Step 3: Implement bounded telemetry and kill switches**

Emit trace, run, node, application, version, installation, scope, worker class, duration, retry, resource limit, and billing outcome. Never use user IDs, prompts, request bodies, secrets, or arbitrary application labels as metric dimensions. Application suspension blocks new installs/runs; version revocation blocks launch/invocation and preserves export. Every switch writes an incident and audit event.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/observability-otel/src/modules/module-app packages/business-server/src/module-apps/logRedaction.ts packages/business-server/src/module-apps/logRedaction.test.ts packages/business-server/src/module-apps/runModuleAppAction.ts apps/server/src/workflows/moduleApp/run.ts apps/server/src/services/moduleAppBuild/service.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts src/features/Admin/moduleApps/index.tsx src/features/Admin/moduleApps/RuntimeControl.tsx src/features/Admin/moduleApps/RuntimeControl.test.tsx
git commit -m "feat: observe and stop module app execution"
```

### Task 5: Security Verification Suite

**Files:**
- Create: `apps/module-runtime/src/security.test.ts`
- Modify: `apps/module-runtime/src/policy.ts`
- Modify: `packages/business-server/src/module-apps/safeUrl.test.ts`
- Modify: `apps/server/src/services/moduleAppRuntime/capability.test.ts`
- Modify: `src/features/ModuleAppRuntime/SandboxFrame.test.tsx`
- Create: `scripts/module-app/verify-runtime-sandbox.sh`
- Create: `scripts/module-app/verify-runtime-sandbox.test.ts`

**Interfaces:**
- Produces: automated evidence for capability, iframe, filesystem, process, network, timeout, and resource isolation.
- Consumes: fixed runtime images from plan 1.

- [ ] **Step 1: Add failing adversarial tests**

```ts
await expect(runFixture('read-host-passwd')).rejects.toThrow('MODULE_APP_SANDBOX_DENIED');
await expect(runFixture('fork-bomb')).rejects.toThrow('MODULE_APP_RESOURCE_LIMIT');
await expect(runFixture('metadata-ssrf')).rejects.toThrow('MODULE_APP_NETWORK_DENIED');
await expect(runFixture('oversized-output')).rejects.toThrow('MODULE_APP_OUTPUT_LIMIT');
```

Also test capability replay, wrong audience, wrong installation, iframe wrong origin, symlink escape, `/proc` access, child-process timeout, DNS rebinding, private IP ranges, and environment leakage.

- [ ] **Step 2: Run security tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' apps/module-runtime/src/security.test.ts packages/business-server/src/module-apps/safeUrl.test.ts apps/server/src/services/moduleAppRuntime/capability.test.ts src/features/ModuleAppRuntime/SandboxFrame.test.tsx scripts/module-app/verify-runtime-sandbox.test.ts`

Expected: one or more adversarial fixtures fail until policy and launcher controls are complete.

- [ ] **Step 3: Harden fixed runtime policy**

Run as non-root with read-only root filesystem, no-new-privileges, dropped capabilities, seccomp allowlist, PID/memory/CPU/file/output limits, isolated temporary directory, no host mounts, no Docker socket, and deny-by-default egress. Enable approved egress through a policy proxy, not direct unrestricted networking. The shell verifier must fail closed when the host cannot provide required isolation.

- [ ] **Step 4: Re-run security suite**

Run the focused command from Step 2.

Expected: PASS with all denial fixtures producing stable error codes.

- [ ] **Step 5: Commit**

```bash
git add apps/module-runtime/src/security.test.ts apps/module-runtime/src/policy.ts packages/business-server/src/module-apps/safeUrl.test.ts apps/server/src/services/moduleAppRuntime/capability.test.ts src/features/ModuleAppRuntime/SandboxFrame.test.tsx scripts/module-app
git commit -m "test: prove module app runtime isolation"
```

### Task 6: Browser E2E Journeys

**Files:**
- Create: `e2e/src/features/module-app/developer-publish.feature`
- Create: `e2e/src/features/module-app/personal-lifecycle.feature`
- Create: `e2e/src/features/module-app/team-lifecycle.feature`
- Create: `e2e/src/features/module-app/commerce.feature`
- Create: `e2e/src/steps/module-app/developer.steps.ts`
- Create: `e2e/src/steps/module-app/runtime.steps.ts`
- Create: `e2e/src/steps/module-app/commerce.steps.ts`
- Create: `e2e/src/mocks/module-app/index.ts`
- Modify: `e2e/src/mocks/index.ts`

**Interfaces:**
- Produces: full-browser proof of submission, review, purchase, install, execution, background progress, upgrade, rollback, uninstall, restore, and team isolation.
- Consumes: deterministic package/build/payment/runtime mocks for CI and a real-runtime tag for staging.

- [ ] **Step 1: Write failing Gherkin journeys**

```gherkin
Scenario: A team workflow survives navigation and charges once
  Given a verified developer published the "Recruiting" application
  And my workspace owns an active license
  When I install the application for the workspace
  And I start the "Import candidates" workflow
  And I navigate away and return
  Then the same workflow run is still progressing
  And the workspace credit ledger contains one settlement for the run
```

- [ ] **Step 2: Run E2E tags and confirm RED**

Run: `pnpm --dir e2e test --tags '@module-app'`

Expected: FAIL because steps and deterministic mocks are absent.

- [ ] **Step 3: Implement reusable steps and mocks**

Cover denied unverified publishing, build failure, admin approval, pending payment, manual settlement, personal install, team RBAC, iframe launch, AI estimate/actual cost, background progress, upgrade consent, compatible rollback, retained uninstall, restore, and revoked-version blocking.

- [ ] **Step 4: Run E2E suite**

Run: `pnpm --dir e2e test --tags '@module-app'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/src/features/module-app e2e/src/steps/module-app e2e/src/mocks/module-app e2e/src/mocks/index.ts
git commit -m "test: cover module app platform journeys"
```

### Task 7: Blue-Green Runtime Deployment And Rollout Gates

**Files:**
- Modify: `.github/workflows/comhub-deploy.yml`
- Modify: `Dockerfile`
- Modify: `apps/module-runtime/docker/Dockerfile.node22`
- Modify: `apps/module-runtime/docker/Dockerfile.python312`
- Modify: `docker-compose/deploy/docker-compose.yml`
- Create: `scripts/deploy/module-app-smoke.sh`
- Create: `scripts/deploy/module-app-rollback.sh`
- Modify: `scripts/deploy/comhub-deploy-standalone.sh`
- Modify: `packages/env/src/app.ts`
- Create: `packages/env/src/moduleApp.ts`
- Create: `packages/env/src/moduleApp.test.ts`
- Modify: `packages/env/src/index.ts`

**Interfaces:**
- Produces: versioned web, runtime Node, and runtime Python images; environment validation; smoke and rollback commands.
- Consumes: current GHCR and `/www/compose/comhub` blue-green deployment.

- [ ] **Step 1: Add failing environment and script tests**

```ts
expect(() => moduleAppEnv.parse({ MODULE_APP_EXECUTION_ENABLED: 'true' })).toThrow('MODULE_APP_RUNTIME_ORIGIN');
expect(moduleAppEnv.parse({ MODULE_APP_EXECUTION_ENABLED: 'false' })).toMatchObject({ MODULE_APP_EXECUTION_ENABLED: false });
```

Shell tests must prove smoke failure exits non-zero and rollback restores the previous web/runtime image tuple.

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/env/src/moduleApp.test.ts`

Expected: FAIL because environment validation is absent.

- [ ] **Step 3: Add explicit deployment configuration**

Require and validate:

- `MODULE_APP_EXECUTION_ENABLED`;
- `MODULE_APP_RUNTIME_ORIGIN`;
- `MODULE_APP_RUNTIME_INTERNAL_URL`;
- `MODULE_APP_CAPABILITY_PRIVATE_KEY` and public key set;
- `MODULE_APP_RELEASE_SIGNING_PRIVATE_KEY` and public key set;
- build/runtime image refs and policy limits.

Build and push the three image refs as one release tuple. Deploy runtime services before enabling the web flag. Use bind mounts under `/www/compose/comhub/state/module-app/`; do not add named volumes. Never mount the Docker socket into the runtime.

- [ ] **Step 4: Add staged smoke and rollback**

`module-app-smoke.sh` verifies runtime health, public keys, signed fixture launch, denied unsigned fixture, one personal read-only run, queue progress, ledger idempotency, and kill switch. `module-app-rollback.sh` restores the prior web and runtime image tuple and leaves database forward-compatible.

Rollout flags progress through `admin_only`, `verified_test`, `free_canary`, `paid_canary`, and `team_general`. Each phase requires acceptable error rate, queue lag, settlement reconciliation, and no critical security incidents.

- [ ] **Step 5: Verify deployment files**

Run: `docker compose -f docker-compose/deploy/docker-compose.yml config`

Expected: exit 0 with no named module-app volumes and no Docker socket mount.

Run: `bash -n scripts/deploy/module-app-smoke.sh scripts/deploy/module-app-rollback.sh scripts/deploy/comhub-deploy-standalone.sh`

Expected: exit 0.

- [ ] **Step 6: Run final repository gates**

Run: `bun run type-check`

Expected: PASS.

Run: `pnpm --dir e2e test --tags '@module-app'`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 7: Update governance docs and commit**

Update `docs/FEATURE_REGISTRY.md`, `docs/CHANGELOG_INTERNAL.md`, and `docs/PROJECT_AUDIT.md` with publisher trust, signing, runtime environment variables, Docker services, S3/QStash dependencies, rollout state, and remaining external-antivirus non-goal.

```bash
git add .github/workflows/comhub-deploy.yml Dockerfile apps/module-runtime/docker docker-compose/deploy/docker-compose.yml scripts/deploy packages/env/src docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md docs/PROJECT_AUDIT.md
git commit -m "ops: gate module app production rollout"
```

## Plan Acceptance Gate

- Only verified publishers can release executable applications publicly.
- Every release has immutable source, artifact, manifest, SBOM, build, publisher, and signature provenance.
- Runtime verifies signatures and current revocation state before execution.
- Operators have redacted telemetry, incidents, and audited app/version kill switches.
- Adversarial tests prove filesystem, process, network, capability, iframe, timeout, and resource boundaries.
- Browser E2E proves developer, admin, personal, team, commerce, workflow, upgrade, rollback, and uninstall journeys.
- GHCR builds one versioned web/runtime image tuple and Baota deployment remains blue-green.
- Module state uses bind mounts and the runtime never receives the Docker socket.
- Production starts disabled and advances only through explicit rollout phases.
- External antivirus remains outside the delivered scope.
- Targeted tests, type-check, E2E, compose validation, shell validation, smoke, and rollback gates pass.
