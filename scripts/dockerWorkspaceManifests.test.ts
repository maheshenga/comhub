import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Docker workspace manifests', () => {
  it('copies the server manifest before installing workspace dependencies', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const installIndex = dockerfile.indexOf('pnpm i');

    expect(installIndex).toBeGreaterThan(-1);
    expect(dockerfile.slice(0, installIndex)).toMatch(
      /^COPY apps\/server\/package\.json \.\/apps\/server\/package\.json$/m,
    );
  });

  it('normalizes workflow-dispatch inputs before production job conditions', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy.yml'),
      'utf8',
    );

    expect(workflow).toContain('resolve_deployment:');
    expect(workflow).toContain("needs.resolve_deployment.outputs.deploy == 'true'");
    expect(workflow).toContain(
      "needs.resolve_deployment.outputs.deploy_module_worker == 'true'",
    );
    expect(workflow).toContain(
      "needs.resolve_deployment.outputs.verify_module_app_full == 'true'",
    );

    const jobs = parse(workflow).jobs as Record<string, { if?: string }>;
    expect(jobs.deploy.if).toContain('always()');
    expect(jobs.deploy.if).toContain("needs.build.result == 'success'");
    expect(jobs['deploy-module-worker'].if).toContain('always()');
    expect(jobs['deploy-module-worker'].if).toContain("needs.build.result == 'success'");
  });

  it('bootstraps an absent worker environment from the running production app', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy.yml'),
      'utf8',
    );

    expect(workflow).toContain('bootstrap_worker_environment()');
    expect(workflow).toContain('docker inspect comhub-app');
    expect(workflow).toContain('COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL');
    expect(workflow).toContain('DATABASE_URL=$worker_database_url');
    expect(workflow).toContain('COMHUB_PLATFORM_NETWORK=paradedb_default');
    expect(workflow).toContain('MODULE_APP_ARTIFACT_ROOT=/www/compose/comhub/module-worker/artifacts');
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
});
