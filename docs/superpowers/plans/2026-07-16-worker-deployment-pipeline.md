# ComHub Split Deployment Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate image publication, main application deployment, and Module App Worker deployment so production deploys reuse verified image digests without rebuilding unrelated images.

**Architecture:** Keep image verification and publication in a cancellable build-only workflow. Convert the existing deployment workflow to manual main deployment and add a manual Worker workflow; both resolve SHA lookup tags to registry digests and share the existing serialized production lock. Preserve all existing remote deployment bodies while changing orchestration and image identity only.

**Tech Stack:** GitHub Actions YAML, Node.js 22, `yaml`, Docker Buildx/GHCR, Bash, pnpm, existing Compose Worker tests.

## Global Constraints

- Main application deployment remains manual and disabled by default.
- Preserve `/www/compose/comhub` and `/www/compose/comhub/module-worker`.
- Preserve the Baota blue-green main deployment and independent Compose Worker release layout.
- Keep credentialed Module App probes disabled by default.
- Keep production deployments serialized with `cancel-in-progress: false`.
- Do not push, merge, or trigger a deployment during local implementation.
- Do not remove migration repair or Docker image pruning in phase 1.

---

### Task 1: Add Image Reference Resolver With Unit Tests

**Files:**
- Create: `.github/scripts/resolveImageReference.mjs`
- Create: `.github/scripts/resolveImageReference.test.mjs`

**Interfaces:**
- Consumes: one `ghcr.io/...:sha-<12>` lookup reference and Docker Buildx manifest JSON.
- Produces: one `ghcr.io/...@sha256:<64 hex>` deployment reference on stdout.

- [ ] **Step 1: Write failing resolver tests**

Cover a valid SHA tag, registry ports, missing tags, mutable tags, existing digest input, malformed JSON, and malformed digest. Inject a manifest inspector so tests do not access Docker or GHCR.

```javascript
const digest = `sha256:${'a'.repeat(64)}`;
assert.equal(
  resolveImageReference('ghcr.io/example/comhub-module-worker:sha-0123456789ab', () =>
    JSON.stringify({ digest }),
  ),
  `ghcr.io/example/comhub-module-worker@${digest}`,
);
assert.throws(() => parseTaggedImageReference('ghcr.io/example/worker:latest'), /sha tag/);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .github/scripts/resolveImageReference.test.mjs`

Expected: FAIL because `resolveImageReference.mjs` does not exist.

- [ ] **Step 3: Implement the resolver**

Export `parseTaggedImageReference`, `parseManifestDigest`, and `resolveImageReference`. The CLI path executes:

```javascript
docker buildx imagetools inspect <tag> --format '{{json .Manifest}}'
```

Validate `sha-[0-9a-f]{12}` and `sha256:[0-9a-f]{64}` exactly before printing the digest reference.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test .github/scripts/resolveImageReference.test.mjs`

Expected: all resolver tests pass without registry access.

### Task 2: Add Failing Workflow Contract Tests

**Files:**
- Create: `.github/workflows/comhubDeploymentWorkflows.test.mjs`

**Interfaces:**
- Consumes: `.github/workflows/comhub-build.yml`, `comhub-deploy.yml`, and `comhub-deploy-worker.yml`.
- Produces: structural guarantees for triggers, job dependencies, image reuse, verification target, and concurrency.

- [ ] **Step 1: Write the workflow contract test**

Parse YAML through the repository's direct `yaml` dependency and assert:

```javascript
assert.ok(build.on.push);
assert.equal(build.concurrency['cancel-in-progress'], true);
assert.ok(Object.values(build.jobs).every((job) => job.environment !== 'production'));
assert.deepEqual(Object.keys(mainDeploy.on), ['workflow_dispatch']);
assert.deepEqual(Object.keys(workerDeploy.on), ['workflow_dispatch']);
assert.ok(!mainSource.includes('docker/build-push-action'));
assert.ok(!workerSource.includes('docker/build-push-action'));
assert.ok(workerSource.includes('pnpm verify:module-app-worker'));
assert.ok(workerSource.includes('node docker-compose/deploy/module-worker/compose.test.mjs'));
assert.equal(mainDeploy.jobs.deploy.concurrency.group, 'comhub-production-deploy');
assert.equal(workerDeploy.jobs.deploy.concurrency.group, 'comhub-production-deploy');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .github/workflows/comhubDeploymentWorkflows.test.mjs`

Expected: FAIL because the build and Worker deployment workflow files do not exist and the current deployment workflow still contains image builds.

### Task 3: Split Build And Main Deployment Workflows

**Files:**
- Create: `.github/workflows/comhub-build.yml`
- Modify: `.github/workflows/comhub-deploy.yml`

**Interfaces:**
- Build produces GHCR tags `sha-<12>` for main, runtime, and Worker images.
- Main deploy consumes an optional full `source_sha`, resolves main/runtime tags to digests, then runs the existing blue-green remote body.

- [ ] **Step 1: Create the build-only workflow**

Move the existing required and optional production gates plus all three `docker/build-push-action` steps into `comhub-build.yml`. Retain existing branches and build arguments. Set:

```yaml
concurrency:
  group: comhub-build-${{ github.ref }}
  cancel-in-progress: true
```

Resolve `COMHUB_BUILD_AT` deterministically:

```bash
echo "build_at=$(git show -s --format=%cI "$GITHUB_SHA")" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 2: Convert `comhub-deploy.yml` to manual main deployment**

Add an optional `source_sha` input and keep `verify_module_app_full` defaulted to `false`. A `resolve-source` job checks a 40-character lowercase hexadecimal commit, fetches `origin/main`, and requires:

```bash
git cat-file -e "$requested_sha^{commit}"
git merge-base --is-ancestor "$requested_sha" origin/main
```

An image-resolution job logs into GHCR, resolves the main and runtime SHA tags through `resolveImageReference.mjs`, and exposes digest outputs. Missing images fail before SSH setup.

- [ ] **Step 3: Preserve the existing remote deployment body**

Keep the current blue-green invocation, runtime probes, smoke checks, mutation-flag checks, and pruning behavior. Replace live `ssh-keyscan` with the pinned `COMHUB_SSH_KNOWN_HOSTS` secret. Pass digest image references while retaining `sha-<12>` as `IMAGE_TAG` for `/api/version` evidence.

- [ ] **Step 4: Run the workflow contract test**

Run: `node --test .github/workflows/comhubDeploymentWorkflows.test.mjs`

Expected: main/build assertions pass; Worker assertions still fail because its workflow is not implemented.

### Task 4: Add Independent Worker Deployment And Digest Compatibility

**Files:**
- Create: `.github/workflows/comhub-deploy-worker.yml`
- Modify: `docker-compose/deploy/module-worker/deploy.sh`
- Modify: `docker-compose/deploy/module-worker/compose.test.mjs`

**Interfaces:**
- Worker deploy consumes an approved main-branch source SHA and existing Worker digest.
- `deploy.sh` accepts new digest references and historical `sha-*` tags so stored rollback state remains usable.

- [ ] **Step 1: Add a failing digest deployment test**

Parameterize `runDeployWithFakes` with `requestedWorkerImage`, then run the full fake deployment with:

```javascript
const digestWorkerImage = `example.invalid/comhub-module-worker@sha256:${'a'.repeat(64)}`;
const digestDeploy = runDeployWithFakes({
  requestedWorkerImage: digestWorkerImage,
  envContents: [
    'DATABASE_URL=postgresql://test:test@localhost:5432/test',
    'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
    'S3_ACCESS_KEY_ID=worker-access',
    'S3_BUCKET=module-artifacts',
    'S3_ENDPOINT=https://s3.example.com',
    'S3_SECRET_ACCESS_KEY=worker-secret',
  ].join('\n'),
  expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
  home: '/tmp/fake-home',
  user: 'fake-user',
});
assert.equal(digestDeploy.result.status, 0, digestDeploy.result.stderr);
```

Also retain the rejection test for `:latest`.

- [ ] **Step 2: Run Worker tests and verify RED**

Run: `node docker-compose/deploy/module-worker/compose.test.mjs`

Expected: FAIL with the current `image must use a non-empty sha-* tag` validation.

- [ ] **Step 3: Extend immutable reference validation**

Update `require_immutable_image` to accept either a legacy non-empty `sha-*` tag or an exact `@sha256:<64 lowercase hex>` digest. Reuse this validation when recording and rolling back the previous image.

- [ ] **Step 4: Create `comhub-deploy-worker.yml`**

Reuse the source validation and image-resolution pattern from main deployment. Before SSH access run:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm verify:module-app-worker
- run: bash -n docker-compose/deploy/module-worker/deploy.sh docker-compose/deploy/module-worker/rollback.sh
- run: node docker-compose/deploy/module-worker/compose.test.mjs
```

Move the current Worker release upload and remote promotion body without changing its release layout, migration repair, rollback, diagnostics, or hardening checks. Build `release_id` from the resolved source SHA rather than the workflow-definition SHA.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --test .github/scripts/resolveImageReference.test.mjs
node --test .github/workflows/comhubDeploymentWorkflows.test.mjs
node docker-compose/deploy/module-worker/compose.test.mjs
bash -n docker-compose/deploy/module-worker/deploy.sh docker-compose/deploy/module-worker/rollback.sh
```

Expected: all commands pass.

### Task 5: Verify, Review, And Commit

**Files:**
- Review all files changed by Tasks 1-4.

**Interfaces:**
- Produces a locally committed branch ready for explicit push/PR authorization.

- [ ] **Step 1: Parse all workflow YAML files**

Run a Node script using `yaml.parse` over `.github/workflows/comhub-build.yml`, `comhub-deploy.yml`, and `comhub-deploy-worker.yml`.

Expected: all three parse successfully.

- [ ] **Step 2: Run focused verification**

Run all Task 4 focused commands plus `git diff --check`.

Expected: zero failures and no whitespace errors.

- [ ] **Step 3: Review production boundaries**

Confirm the diff has no automatic deployment trigger, no main deployment step in the Worker workflow, no build step in either deployment workflow, pinned SSH known hosts in both deployment workflows, shared non-cancellable production concurrency, and no secret values.

- [ ] **Step 4: Commit implementation**

```bash
git add .github docker-compose/deploy/module-worker
git commit -m "ci: split image build from production deploys" \
  -m "Constraint: Keep main deployment manual and preserve existing production release layouts." \
  -m "Tested: focused workflow, image resolver, Worker Compose, shell syntax, YAML parse, and diff checks."
```
