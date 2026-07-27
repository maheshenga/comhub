import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const moduleWorkerRequire = createRequire(path.join(root, 'apps', 'module-worker', 'package.json'));

describe('Docker workspace manifests', () => {
  it('loads the module worker fixture through runtime package exports', () => {
    const tsxCli = require.resolve('tsx/cli');
    const fixture = path.join(root, 'scripts', 'fixtures', 'moduleAppWorkerFixture.mts');
    const result = spawnSync(process.execPath, [tsxCli, fixture], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status, result.stderr || result.error?.message).toBe(0);
  }, 30_000);

  it('bundles model-bank compatibility exports without static import warnings', () => {
    const { buildSync } = moduleWorkerRequire('esbuild');
    const result = buildSync({
      bundle: true,
      entryPoints: [path.join(root, 'packages', 'types', 'src', 'aiProvider.ts')],
      format: 'esm',
      logLevel: 'silent',
      platform: 'node',
      target: 'node24',
      write: false,
    });

    expect(result.warnings).toEqual([]);
  });

  it('copies the server manifest before installing workspace dependencies', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const installIndex = dockerfile.indexOf('pnpm i');

    expect(installIndex).toBeGreaterThan(-1);
    expect(dockerfile.slice(0, installIndex)).toMatch(
      /^COPY apps\/server\/package\.json \.\/apps\/server\/package\.json$/m,
    );
  });

  it('copies only tracked sources from the local build context', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const localCopySources = dockerfile
      .split(/\r?\n/)
      .filter((line) => line.startsWith('COPY ') && !line.startsWith('COPY --from='))
      .flatMap((line) => line.trim().split(/\s+/).slice(1, -1));

    for (const source of localCopySources) {
      const trackedFiles = spawnSync('git', ['ls-files', '--', source], {
        cwd: root,
        encoding: 'utf8',
      });

      expect(trackedFiles.status, trackedFiles.stderr).toBe(0);
      expect(trackedFiles.stdout.trim(), `Docker COPY source is not tracked: ${source}`).not.toBe(
        '',
      );
    }
  });

  it('builds the linked Module App SDK before the application bundle', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const sourceCopyIndex = dockerfile.indexOf('COPY . .');
    const sdkBuildIndex = dockerfile.indexOf('RUN pnpm --filter @lobechat/module-app-sdk build');
    const applicationBuildIndex = dockerfile.indexOf('pnpm run build:docker');

    expect(sdkBuildIndex).toBeGreaterThan(sourceCopyIndex);
    expect(applicationBuildIndex).toBeGreaterThan(sdkBuildIndex);
  });

  it('uses pnpm for container build scripts', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const wslBuildScript = readFileSync(
      path.join(root, 'scripts', 'deploy', 'comhub-build-package-wsl.sh'),
      'utf8',
    );

    expect(dockerfile).toMatch(/^\s+pnpm run build:docker$/m);
    expect(dockerfile).not.toContain('RUN npm run build:docker');
    expect(wslBuildScript).toMatch(/^pnpm run build:docker$/m);
    expect(wslBuildScript).not.toMatch(/^npm run build:docker$/m);
  });

  it('keeps sensitive values out of Docker ARG and ENV instructions', () => {
    const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const instructions = dockerfile.replaceAll(/\\\r?\n\s*/g, ' ').split(/\r?\n/);
    const sensitiveName =
      /^(?:AUTH_|API_KEY_SELECT_MODE$)|_API_KEY$|_TOKEN$|_ACCESS_KEY_ID$|_SECRET(?:_|$)|_PASSWORD$|_CREDENTIALS$|_AUTH_TYPE$|_SIGNING_KEY$/;
    const sensitiveDeclarations = instructions.flatMap((instruction) => {
      const normalized = instruction.trimStart();
      const separator = normalized.indexOf(' ');
      if (separator < 0) return [];

      const instructionName = normalized.slice(0, separator);
      if (instructionName !== 'ARG' && instructionName !== 'ENV') return [];

      const instructionValue = normalized.slice(separator + 1).trimStart();

      const names =
        instructionName === 'ARG'
          ? [instructionValue.split(/[=\s]/, 1)[0]]
          : [...instructionValue.matchAll(/(?:^|\s)([A-Z][A-Z0-9_]*)=/g)].map(
              (variable) => variable[1],
            );

      return names.filter((name) => sensitiveName.test(name));
    });
    const ephemeralBuildSecrets = instructions.filter(
      (instruction) =>
        instruction.startsWith('RUN ') &&
        instruction.includes('KEY_VAULTS_SECRET=') &&
        instruction.includes('AUTH_SECRET='),
    );

    expect(sensitiveDeclarations).toEqual([]);
    expect(ephemeralBuildSecrets).toHaveLength(2);
    expect(ephemeralBuildSecrets.every((instruction) => instruction.includes('pnpm'))).toBe(true);
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
    expect(buildWorkflow).toContain(
      "USE_CN_MIRROR=${{ github.event_name == 'workflow_dispatch' && inputs.use_cn_mirror == 'true' }}",
    );
    expect(buildWorkflow).not.toContain("inputs.use_cn_mirror || 'true'");
    expect(Object.keys(main.on)).toEqual(['workflow_dispatch']);
    expect(Object.keys(worker.on)).toEqual(['workflow_dispatch']);
    expect(buildWorkflow.match(/docker\/build-push-action@v7/g)).toHaveLength(3);
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
    expect(verification).toContain("MODULE_APP_EXECUTION_ENABLED: 'false'");
    expect(verification).toContain("MODULE_APP_RUNTIME_INVOCATION_ENABLED: 'false'");
    expect(verification).toContain("'volume',\n    'inspect'");
    expect(verification).toContain(
      'composeEnv.MODULE_APP_RUNTIME_DOCKER_ARTIFACT_ROOT = artifactDockerRoot',
    );
    expect(verification).toContain('assert.equal(dockerArtifactRoot, artifactMount?.Source)');
    expect(verification).toContain(
      "MODULE_APP_WORKER_INTEGRATION_REQUIRED: 'true',\n      ...composeEnv,\n      ...s3Environment",
    );
  });
});
