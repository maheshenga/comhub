import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const directory = path.dirname(fileURLToPath(import.meta.url));

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

test('build workflow publishes images without production access', () => {
  const { source, workflow } = loadWorkflow('comhub-build.yml');

  assert.ok(workflow.on.push);
  assert.ok(workflow.on.workflow_dispatch);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.ok(Object.values(workflow.jobs).every((job) => job.environment !== 'production'));
  assert.equal((source.match(/docker\/build-push-action@v6/gu) ?? []).length, 3);
  assert.match(source, /git show -s --format=%cI/);
  assert.doesNotMatch(source, /COMHUB_SSH_PRIVATE_KEY/);
  assert.doesNotMatch(source, /comhub-production-deploy/);
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

test('all workflow Bash run blocks pass syntax validation', () => {
  for (const filename of [
    'comhub-build.yml',
    'comhub-deploy.yml',
    'comhub-deploy-worker.yml',
  ]) {
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
