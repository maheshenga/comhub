import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, '../..');

const readRepositoryFile = (filename) => readFileSync(path.join(repositoryRoot, filename), 'utf8');

const collectYamlFiles = (directoryPath) =>
  readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) return collectYamlFiles(entryPath);
    return /\.ya?ml$/u.test(entry.name) ? [entryPath] : [];
  });

const loadWorkflow = (filename) => {
  const source = readFileSync(path.join(directory, filename), 'utf8');
  return { source, workflow: parse(source) };
};

const assertManualOnly = (workflow) => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
};

const assertProductionLock = (job) => {
  assert.equal(job.environment, 'production');
  assert.equal(job.concurrency.group, 'comhub-production-deploy');
  assert.equal(job.concurrency['cancel-in-progress'], false);
};

const assertPinnedMainTooling = (source, workflow, jobName) => {
  assert.match(source, /GITHUB_REF.*refs\/heads\/main/su);
  assert.match(source, /refs\/heads\/main:refs\/remotes\/origin\/main/u);
  const checkout = workflow.jobs[jobName].steps.find(
    (step) => step.name === 'Checkout deployment tooling',
  );
  assert.equal(checkout?.with?.ref, '${{ github.sha }}');
};

const assertJobUsesSetupEnv = (workflow, jobName) => {
  const setupEnvironment = workflow.jobs[jobName].steps.find(
    (step) => step.uses === './.github/actions/setup-env',
  );

  assert.ok(setupEnvironment, `${jobName} must install Bun through the shared setup action`);
  assert.equal(setupEnvironment.with?.['node-version'], '${{ env.NODEJS_VERSION }}');
  assert.equal(setupEnvironment.with?.['package-manager-cache'], false);
};

test('build workflow publishes images without production access', () => {
  const { source, workflow } = loadWorkflow('comhub-build.yml');

  assert.ok(workflow.on.push);
  assert.ok(workflow.on.workflow_dispatch);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.ok(Object.values(workflow.jobs).every((job) => job.environment !== 'production'));
  assert.equal((source.match(/docker\/build-push-action@v7/gu) ?? []).length, 3);
  assert.match(source, /git show -s --format=%cI/);
  assert.doesNotMatch(source, /COMHUB_SSH_PRIVATE_KEY/);
  assert.doesNotMatch(source, /comhub-production-deploy/);
});

test('Module App verification jobs install Bun through the shared setup action', () => {
  const setupEnvironment = readRepositoryFile('.github/actions/setup-env/action.yml');
  assert.match(setupEnvironment, /oven-sh\/setup-bun@v2/u);

  for (const [filename, jobNames] of [
    ['comhub-build.yml', ['verify-module-app', 'verify-module-app-full']],
    ['comhub-deploy.yml', ['verify-module-app-full']],
    ['comhub-deploy-worker.yml', ['verify-worker']],
  ]) {
    const { workflow } = loadWorkflow(filename);
    for (const jobName of jobNames) assertJobUsesSetupEnv(workflow, jobName);
  }
});

test('PR checks validate main-bound changes without deployment capability', () => {
  const { source, workflow } = loadWorkflow('comhub-pr-check.yml');

  assert.deepEqual(workflow.on.pull_request.branches, ['main']);
  assert.equal(workflow.permissions.contents, 'read');
  assert.deepEqual(Object.keys(workflow.jobs), ['verify']);
  assert.equal(workflow.jobs.verify.environment, undefined);
  assert.match(source, /node --test .github\/workflows\/comhubDeploymentWorkflows\.test\.mjs/);
  assert.match(source, /pnpm type-check/);
  assert.doesNotMatch(source, /cache: pnpm/);
  assert.doesNotMatch(source, /docker\/build-push-action/);
  assert.doesNotMatch(source, /COMHUB_SSH_PRIVATE_KEY/);
  assert.doesNotMatch(source, /MODULE_APP_ALIPAY_/);
  assert.doesNotMatch(source, /deploy_module_worker/);
});

test('main deployment is manual and reuses existing digest images', () => {
  const { source, workflow } = loadWorkflow('comhub-deploy.yml');

  assertManualOnly(workflow);
  assert.ok(workflow.on.workflow_dispatch.inputs.source_sha);
  assert.doesNotMatch(source, /docker\/build-push-action/);
  assert.doesNotMatch(source, /deploy_module_worker/);
  assert.match(source, /resolveImageReference\.mjs/);
  assert.match(source, /git merge-base --is-ancestor/);
  assert.match(source, /COMHUB_SSH_KNOWN_HOSTS/);
  assert.doesNotMatch(source, /ssh-keyscan/);
  assertPinnedMainTooling(source, workflow, 'resolve-images');
  assertProductionLock(workflow.jobs.deploy);
});

test('main deployment relays immutable OCI images before the remote traffic switch', () => {
  const { workflow } = loadWorkflow('comhub-deploy.yml');
  const steps = workflow.jobs.deploy.steps;
  const relayIndex = steps.findIndex(
    (step) => step.name === 'Relay immutable images to production',
  );
  const deployIndex = steps.findIndex((step) => step.name === 'Run remote blue-green deploy');
  const relay = steps[relayIndex];
  const remoteDeploy = steps[deployIndex];

  assert.ok(relayIndex >= 0, 'expected an OCI image relay step');
  assert.ok(deployIndex > relayIndex, 'image relay must finish before the remote traffic switch');
  assert.match(relay?.run ?? '', /skopeo copy[\s\S]*--all[\s\S]*--preserve-digests/u);
  assert.match(relay?.run ?? '', /oci-archive:/u);
  assert.match(relay?.run ?? '', /ctr -n moby images import --all-platforms/u);
  assert.match(relay?.run ?? '', /docker image prune -af/u);
  assert.match(relay?.run ?? '', /ctr -n moby images pull --platform linux\/amd64/u);
  assert.doesNotMatch(
    remoteDeploy?.run ?? '',
    /COMHUB_CTR_PULL_TIMEOUT|Pre-pulling image through containerd/u,
  );
});

test('main deployment isolates remote Compose exec commands from the SSH script input', () => {
  const { workflow } = loadWorkflow('comhub-deploy.yml');
  const remoteDeploy = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Run remote blue-green deploy',
  );
  const composeExecLines = (remoteDeploy?.run ?? '')
    .split('\n')
    .filter((line) => line.includes('docker compose exec -T'));

  assert.ok(composeExecLines.length > 0, 'expected remote Compose exec commands');
  for (const line of composeExecLines) {
    assert.match(
      line,
      /<\s*\/dev\/null/u,
      `remote Compose exec must not consume the remaining SSH here-doc: ${line.trim()}`,
    );
  }
});

test('closed deployment skips the optional Module Runtime rollout', () => {
  const { workflow } = loadWorkflow('comhub-deploy.yml');
  const remoteDeploy = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Run remote blue-green deploy',
  );
  const script = remoteDeploy?.run ?? '';

  assert.match(
    script,
    /if \[ "\$REQUIRE_MODULE_RUNTIME" = "true" \]; then\s+docker pull "\$RUNTIME_IMAGE_REF"\s+docker compose up -d --no-deps --wait module-runtime\s+verify_module_runtime\s+verify_runtime_auth_boundary\s+else\s+echo "module-runtime rollout skipped; production mutation flags remain disabled"\s+fi/u,
  );
  assert.doesNotMatch(
    script,
    /if \[ "\$module_runtime_configured" = "true" \]; then\s+docker pull/u,
  );
});

test('Worker deployment is manual, targeted, and build-free', () => {
  const { source, workflow } = loadWorkflow('comhub-deploy-worker.yml');

  assertManualOnly(workflow);
  assert.ok(workflow.on.workflow_dispatch.inputs.source_sha);
  assert.doesNotMatch(source, /docker\/build-push-action/);
  assert.doesNotMatch(source, /Deploy Production/);
  assert.match(source, /pnpm install --no-frozen-lockfile/);
  assert.doesNotMatch(source, /pnpm install --frozen-lockfile/);
  assert.match(source, /pnpm verify:module-app-worker/);
  assert.match(source, /node docker-compose\/deploy\/module-worker\/compose\.test\.mjs/);
  assert.match(source, /resolveImageReference\.mjs/);
  assert.match(source, /COMHUB_SSH_KNOWN_HOSTS/);
  assert.match(source, /SOURCE_SHA/);
  assertPinnedMainTooling(source, workflow, 'deploy');
  assertProductionLock(workflow.jobs.deploy);

  const workerDeploy = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Deploy independent Module App worker',
  );
  assert.match(
    workerDeploy?.run ?? '',
    /if \[ "\$untracked_worker_health" = unhealthy \]; then[\s\S]*?rm --force --stop module-app-worker/,
  );
  assert.match(
    workerDeploy?.run ?? '',
    /if should_remove_failed_clean_host_worker[\s\S]*?"\$untracked_worker_preserved"; then[\s\S]*?rm --force --stop module-app-worker/,
  );

  const cleanupPredicate = (workerDeploy?.run ?? '').match(
    /^should_remove_failed_clean_host_worker\(\) \{\n[\s\S]*?^\}/mu,
  )?.[0];
  assert.ok(cleanupPredicate, 'Worker deployment must define a clean-host cleanup predicate');

  for (const scenario of [
    {
      expected: 0,
      preserved: 'false',
      previousImage: 'false',
      previousTargetPresent: 'false',
    },
    {
      expected: 1,
      preserved: 'false',
      previousImage: 'true',
      previousTargetPresent: 'false',
    },
    {
      expected: 1,
      preserved: 'false',
      previousImage: 'false',
      previousTargetPresent: 'true',
    },
    {
      expected: 1,
      preserved: 'true',
      previousImage: 'false',
      previousTargetPresent: 'false',
    },
  ]) {
    const result = spawnSync('bash', [], {
      encoding: 'utf8',
      input: `${cleanupPredicate}\nshould_remove_failed_clean_host_worker '${scenario.previousImage}' '${scenario.previousTargetPresent}' '${scenario.preserved}'`,
    });
    assert.equal(
      result.status,
      scenario.expected,
      `unexpected cleanup decision for ${JSON.stringify(scenario)}: ${result.stderr}`,
    );
  }

  const failedDeployDiagnostics = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Diagnose failed Worker deployment',
  );
  assert.equal(failedDeployDiagnostics?.if, '${{ failure() }}');
  assert.match(failedDeployDiagnostics?.run ?? '', /\.State\.Health\.Log/);
  assert.match(
    failedDeployDiagnostics?.run ?? '',
    /label=com\.docker\.compose\.project=comhub-module-worker/,
  );
  assert.match(failedDeployDiagnostics?.run ?? '', /health-file=/);
  assert.match(failedDeployDiagnostics?.run ?? '', /artifact-root=/);
  assert.match(failedDeployDiagnostics?.run ?? '', /database-tcp=/);
  assert.doesNotMatch(failedDeployDiagnostics?.run ?? '', /\.Config\.Env|printenv/);
});

test('deployment workflows never trigger from push', () => {
  for (const filename of ['comhub-deploy.yml', 'comhub-deploy-worker.yml']) {
    const { workflow } = loadWorkflow(filename);
    assert.equal(workflow.on.push, undefined, `${filename} must not deploy from push`);
  }
});

test('GitHub automation is valid YAML and does not use deprecated Node 20 actions', () => {
  for (const filename of collectYamlFiles(path.join(repositoryRoot, '.github'))) {
    const source = readFileSync(filename, 'utf8');
    assert.doesNotThrow(
      () => parse(source),
      `${path.relative(repositoryRoot, filename)} is invalid YAML`,
    );
    assert.doesNotMatch(
      source,
      /actions\/checkout@v4|actions\/setup-node@v4|pnpm\/action-setup@v4|docker\/(?:login-action|setup-buildx-action)@v3|docker\/build-push-action@v6/u,
      `${path.relative(repositoryRoot, filename)} still references a Node 20 action`,
    );
  }
});

test('ComHub build tooling uses Node 24 LTS while preserving the node22 module contract', () => {
  const nodeVersion = '24.18.0';

  assert.match(
    readRepositoryFile('Dockerfile'),
    new RegExp(`NODEJS_VERSION="${nodeVersion}"`, 'u'),
  );
  assert.match(
    readRepositoryFile('scripts/deploy/comhub-build-package.ps1'),
    new RegExp(`NodeVersion = '${nodeVersion}'`, 'u'),
  );

  for (const filename of [
    '.agents/resume',
    '.agents/setup',
    '.github/actions/setup-env/action.yml',
  ]) {
    assert.match(readRepositoryFile(filename), new RegExp(nodeVersion.replaceAll('.', '\\.'), 'u'));
  }

  for (const filename of [
    '.github/workflows/comhub-build.yml',
    '.github/workflows/comhub-deploy-worker.yml',
    '.github/workflows/comhub-deploy.yml',
    '.github/workflows/comhub-desktop-release.yml',
    '.github/workflows/comhub-pr-check.yml',
    '.github/workflows/comhub-upstream-sync.yml',
  ]) {
    const source = readRepositoryFile(filename);
    assert.match(source, new RegExp(nodeVersion.replaceAll('.', '\\.'), 'u'));
    const setupNodeCount = (
      source.match(/uses: (?:actions\/setup-node@v6|\.\/\.github\/actions\/setup-env)/gu) ?? []
    ).length;
    const disabledCacheCount = (source.match(/package-manager-cache: false/gu) ?? []).length;
    assert.equal(disabledCacheCount, setupNodeCount);
  }

  for (const filename of ['apps/module-runtime/Dockerfile', 'apps/module-worker/Dockerfile']) {
    const source = readRepositoryFile(filename);
    assert.match(
      source,
      new RegExp(`node:${nodeVersion.replaceAll('.', '\\.')}-alpine3\\.23`, 'u'),
    );
    assert.match(source, /--target=node24/u);
  }

  const composeSource = readRepositoryFile('docker-compose/deploy/module-runtime.yml');
  assert.doesNotMatch(composeSource, /\/var\/run\/docker\.sock/u);
  assert.match(
    composeSource,
    /MODULE_APP_RUNTIME_ROOTLESS_DOCKER_SOCKET:\?dedicated rootless Docker socket required/u,
  );
  assert.match(
    composeSource,
    /MODULE_APP_RUNTIME_DOCKER_ARTIFACT_ROOT:\?daemon-visible artifact root required/u,
  );
  assert.match(composeSource, /DOCKER_HOST: 'unix:\/\/\/run\/module-app-docker\/docker\.sock'/u);
  assert.match(composeSource, /127\.0\.0\.1:3210\/ready/u);
  assert.match(readRepositoryFile('apps/module-runtime/Dockerfile'), /127\.0\.0\.1:3210\/ready/u);
  const deploymentSource = readRepositoryFile('.github/workflows/comhub-deploy.yml');
  assert.match(deploymentSource, /test "\$docker_artifact_root" = "\$artifact_source"/u);
  assert.match(deploymentSource, /test "\$docker_socket_mount" = 'bind\|false'/u);
  assert.match(deploymentSource, /docker info --format.*name=rootless/u);
  assert.match(deploymentSource, /--health-cmd .*127\.0\.0\.1:3210\/health/u);
  assert.match(deploymentSource, /MODULE_APP_RUNTIME_DOCKER_ARTIFACT_ROOT=\/runtime\/artifacts/u);
  assert.doesNotMatch(deploymentSource, /MODULE_APP_RUNTIME_JWKS=\{"keys":\[\]\}/u);
  assert.match(deploymentSource, /MODULE_APP_RUNTIME_JWKS=.*"kty":"RSA".*"alg":"RS256"/u);
  assert.equal(
    (
      composeSource.match(
        new RegExp(`node:${nodeVersion.replaceAll('.', '\\.')}-alpine3\\.23`, 'gu'),
      ) ?? []
    ).length,
    2,
  );

  assert.match(
    readRepositoryFile('apps/module-runtime/docker/Dockerfile.node22'),
    /FROM node:22\.22\.0-alpine3\.23/u,
  );
  assert.match(
    readRepositoryFile('packages/types/src/moduleAppRuntime.ts'),
    /z\.enum\(\['node22', 'python312'\]\)/u,
  );
});

test('all workflow Bash run blocks pass syntax validation', () => {
  for (const filename of ['comhub-build.yml', 'comhub-deploy.yml', 'comhub-deploy-worker.yml']) {
    const { workflow } = loadWorkflow(filename);
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      for (const [stepIndex, step] of (job.steps ?? []).entries()) {
        if (typeof step.run !== 'string' || step.shell === 'pwsh') continue;
        const result = spawnSync('bash', ['-n', '-c', step.run], { encoding: 'utf8' });
        assert.equal(
          result.status,
          0,
          `${filename} ${jobName} step ${stepIndex + 1} has invalid Bash:\n${result.stderr}`,
        );
      }
    }
  }
});
