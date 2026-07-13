import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const composeFile = resolve(directory, 'compose.yml');
const envFile = resolve(directory, '.env');
const createdEnvFile = !existsSync(envFile);

if (createdEnvFile) writeFileSync(envFile, 'DATABASE_URL=postgresql://test:test@localhost:5432/test\n');

try {
  const output = execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'config', '--format', 'json'],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        COMHUB_MODULE_WORKER_IMAGE: 'example.invalid/comhub-module-worker:sha-0123456789ab',
        COMHUB_PLATFORM_NETWORK: 'comhub_default',
        MODULE_APP_ARTIFACT_ROOT: '/var/lib/comhub/module-worker-artifacts',
      },
    },
  );
  const config = JSON.parse(output);
  const services = config.services;

  assert.deepEqual(Object.keys(services), ['module-app-worker']);
  assert.equal(config.name, 'comhub-module-worker');

  const service = services['module-app-worker'];
  assert.equal(service.image, 'example.invalid/comhub-module-worker:sha-0123456789ab');
  assert.deepEqual(service.ports ?? [], []);
  assert.deepEqual(service.labels ?? {}, {});
  assert.notEqual(service.privileged, true);
  assert.equal(service.user, '10001:10001');
  assert.equal(service.read_only, true);
  assert.deepEqual(service.cap_drop, ['ALL']);
  assert.ok((service.security_opt ?? []).includes('no-new-privileges:true'));
  assert.equal(service.restart, 'unless-stopped');
  assert.equal(service.stop_grace_period, '45s');
  assert.ok(service.healthcheck?.test?.length);

  const tmpfs = service.tmpfs ?? [];
  assert.equal(tmpfs.length, 1);
  assert.match(String(tmpfs[0]), /^\/tmp:size=64m,.*noexec.*nosuid/);

  const mounts = service.volumes ?? [];
  assert.equal(mounts.length, 1);
  const artifactMount = mounts[0];
  assert.equal(artifactMount.type, 'bind');
  assert.equal(artifactMount.target, '/runtime/artifacts');
  assert.notEqual(artifactMount.read_only, true);
  assert.ok(!JSON.stringify(mounts).includes('/var/run/docker.sock'));

  assert.deepEqual(Object.keys(service.networks ?? {}), ['platform']);
  assert.equal(config.networks?.platform?.external, true);

  const disabledFlags = [
    'MODULE_APP_EXECUTION_ENABLED',
    'MODULE_APP_RUNTIME_INVOCATION_ENABLED',
    'MODULE_APP_WORKFLOW_PRIVILEGED_EXECUTORS_ENABLED',
    'MODULE_APP_SCHEDULE_DISPATCH_ENABLED',
    'MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED',
    'MODULE_APP_ALIPAY_AUTO_SETTLEMENT_ENABLED',
    'MODULE_APP_PUBLISHER_PAYOUT_RECORDING_ENABLED',
    'MODULE_APP_PUBLIC_EXECUTION_ENABLED',
  ];
  for (const flag of disabledFlags) assert.equal(service.environment?.[flag], 'false');

  const composeSource = readFileSync(composeFile, 'utf8');
  assert.match(composeSource, /\$\{COMHUB_MODULE_WORKER_IMAGE:\?immutable worker image required\}/);

  for (const script of ['deploy.sh', 'rollback.sh']) {
    const source = readFileSync(resolve(directory, script), 'utf8');
    assert.ok(!/nginx|upstream|traffic|deploy slot/i.test(source));
    assert.ok(!/docker compose.*(?:-f.*module-runtime|module-runtime\.yml)/i.test(source));
  }

  const deploySource = readFileSync(resolve(directory, 'deploy.sh'), 'utf8');
  assert.match(deploySource, /sha-\*/);
  assert.match(deploySource, /BEGIN READ ONLY/);
  assert.match(deploySource, /claim_token/);
  assert.match(deploySource, /claim_expires_at/);
  assert.match(deploySource, /attempt_count/);
  assert.match(deploySource, /next_attempt_at/);
  assert.match(deploySource, /compose pull "\$SERVICE"/);
  assert.match(deploySource, /compose up --no-deps --wait "\$SERVICE"/);

  const mutableImage = spawnSync('bash', ['deploy.sh', 'example.invalid/worker:latest'], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.notEqual(mutableImage.status, 0);
  assert.match(mutableImage.stderr, /non-empty sha-\* tag/);

  const rollbackSource = readFileSync(resolve(directory, 'rollback.sh'), 'utf8');
  assert.match(rollbackSource, /\.previous-image/);
  assert.match(rollbackSource, /COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE=true exec/);

  console.log('module worker Compose policy: PASS');
} finally {
  if (createdEnvFile) rmSync(envFile, { force: true });
}
