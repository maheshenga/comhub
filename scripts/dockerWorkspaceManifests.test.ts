import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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

  it('uses raw workflow-dispatch inputs for production deploy conditions', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'comhub-deploy.yml'),
      'utf8',
    );

    expect(workflow).toContain("github.event.inputs.deploy == 'true'");
    expect(workflow).toContain('github.event.inputs.deploy == true');
    expect(workflow).toContain("github.event.inputs.deploy_module_worker == 'true'");
    expect(workflow).toContain('github.event.inputs.deploy_module_worker == true');
    expect(workflow).toContain("github.event.inputs.verify_module_app_full == 'true'");
    expect(workflow).toContain('github.event.inputs.verify_module_app_full == true');
  });
});
