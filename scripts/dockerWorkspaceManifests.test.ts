import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

describe('Docker workspace manifests', () => {
  it('loads the module worker fixture through runtime package exports', () => {
    const tsxCli = require.resolve('tsx/cli');
    const fixture = path.join(root, 'scripts', 'fixtures', 'moduleAppWorkerFixture.mts');
    const result = spawnSync(process.execPath, [tsxCli, fixture], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status, result.stderr || result.error?.message).toBe(0);
  });

  it('copies the server manifest before installing workspace dependencies', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const installIndex = dockerfile.indexOf('pnpm i');

    expect(installIndex).toBeGreaterThan(-1);
    expect(dockerfile.slice(0, installIndex)).toMatch(
      /^COPY apps\/server\/package\.json \.\/apps\/server\/package\.json$/m,
    );
  });

  it('separates image publication from manual production deployments', () => {
    const buildWorkflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-build.yml'),
      'utf8',
    );
    const mainWorkflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy.yml'),
      'utf8',
    );
    const workerWorkflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy-worker.yml'),
      'utf8',
    );

    const build = parse(buildWorkflow) as {
      concurrency: { 'cancel-in-progress': boolean };
      jobs: Record<string, unknown>;
      on: Record<string, unknown>;
    };
    const main = parse(mainWorkflow) as {
      jobs: Record<string, { if?: string; needs?: string[] }>;
      on: Record<string, unknown>;
    };
    const worker = parse(workerWorkflow) as {
      jobs: Record<string, { needs?: string[] }>;
      on: Record<string, unknown>;
    };

    expect(build.on.push).toBeDefined();
    expect(build.concurrency['cancel-in-progress']).toBe(true);
    expect(Object.keys(main.on)).toEqual(['workflow_dispatch']);
    expect(Object.keys(worker.on)).toEqual(['workflow_dispatch']);
    expect(buildWorkflow.match(/docker\/build-push-action@v6/g)).toHaveLength(3);
    expect(mainWorkflow).not.toContain('docker/build-push-action');
    expect(workerWorkflow).not.toContain('docker/build-push-action');
    expect(main.jobs.deploy.needs).toEqual([
      'resolve-source',
      'resolve-images',
      'verify-module-app-full',
    ]);
    expect(main.jobs.deploy.if).toContain('always()');
    expect(worker.jobs.deploy.needs).toEqual(['resolve-source', 'verify-worker', 'resolve-image']);
    expect(workerWorkflow).toContain('pnpm verify:module-app-worker');
  });

  it('bootstraps an absent worker environment from the running production app', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy-worker.yml'),
      'utf8',
    );

    expect(workflow).toContain('bootstrap_worker_environment()');
    expect(workflow).toContain('docker inspect comhub-app');
    expect(workflow).toContain('COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL');
    expect(workflow).toContain('DATABASE_URL=$worker_database_url');
    expect(workflow).toContain('COMHUB_PLATFORM_NETWORK=paradedb_default');
    expect(workflow).toContain(
      'MODULE_APP_ARTIFACT_ROOT=/www/compose/comhub/module-worker/artifacts',
    );
    expect(workflow).toContain('chmod 0600 "$worker_deploy_dir/.env"');
    expect(workflow).toContain('[ -f "$worker_deploy_dir/.env" ] || bootstrap_worker_environment');
  });

  it('keeps every Module App mutation flag closed in the main post-deploy gate', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy.yml'),
      'utf8',
    );
    const gateStart = workflow.indexOf('Running post-deploy runtime smoke checks');
    const gateEnd = workflow.indexOf('if docker compose config --services', gateStart);
    const gate = workflow.slice(gateStart, gateEnd);

    expect(gate).toContain('MODULE_APP_EXECUTION_ENABLED');
    expect(gate).toContain('MODULE_APP_RUNTIME_INVOCATION_ENABLED');
    expect(gate.match(/MODULE_APP_[A-Z_]+_ENABLED/g)).toHaveLength(8);
  });

  it('requires commercial and certificate-aware production verification gates', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy.yml'),
      'utf8',
    );
    const verification = readFileSync(
      path.join(root, 'scripts', 'verifyModuleAppProduction.mjs'),
      'utf8',
    );

    expect(workflow).toContain('MODULE_APP_ALIPAY_APP_CERT_SN');
    expect(workflow).toContain('MODULE_APP_ALIPAY_ROOT_CERT_SN');
    expect(verification).toContain("'src/commercialBilling.test.ts'");
    expect(verification).toContain("'src/models/__tests__/commercial.test.ts'");
    expect(verification).toContain("'src/models/__tests__/moduleAppCommerce.test.ts'");
    expect(verification).toContain("TEST_SERVER_DB: '1'");
  });
});
