import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const composeFile = resolve(directory, 'compose.yml');
const envFile = resolve(directory, '.env');
const createdEnvFile = !existsSync(envFile);
const workerImage = 'example.invalid/comhub-module-worker:sha-0123456789ab';
const mutationFlags = [
  'MODULE_APP_EXECUTION_ENABLED',
  'MODULE_APP_RUNTIME_INVOCATION_ENABLED',
  'MODULE_APP_WORKFLOW_PRIVILEGED_EXECUTORS_ENABLED',
  'MODULE_APP_SCHEDULE_DISPATCH_ENABLED',
  'MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED',
  'MODULE_APP_ALIPAY_AUTO_SETTLEMENT_ENABLED',
  'MODULE_APP_PUBLISHER_PAYOUT_RECORDING_ENABLED',
  'MODULE_APP_PUBLIC_EXECUTION_ENABLED',
];
const exampleKeys = [
  'COMHUB_MODULE_WORKER_IMAGE',
  'MODULE_APP_ARTIFACT_ROOT',
  'COMHUB_PLATFORM_NETWORK',
  'DATABASE_URL',
  'S3_ACCESS_KEY_ID',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_SECRET_ACCESS_KEY',
];

if (createdEnvFile) writeFileSync(envFile, 'DATABASE_URL=postgresql://test:test@localhost:5432/test\n');

const parseDotenv = (source) =>
  Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        assert.notEqual(separator, -1, `invalid dotenv example entry: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );

const writeExecutable = (filePath, contents) => {
  writeFileSync(filePath, contents);
  chmodSync(filePath, 0o755);
};

const toBashPath = (windowsPath) =>
  windowsPath.replace(/^([A-Za-z]):\\/u, (_, drive) => `/${drive.toLowerCase()}/`).replace(/\\/gu, '/');

const runDeployWithFakes = ({ envContents, expectedArtifactRoot, home, user, markers = [] }) => {
  const fakeBinDir = mkdtempSync(join(tmpdir(), 'module-worker-compose-'));
  const dockerLog = join(fakeBinDir, 'docker.log');
  const psqlLog = join(fakeBinDir, 'psql.log');
  const nodeBin = 'node.exe';
  const nodePath = toBashPath(dirname(process.execPath));
  const fakeDockerScript = join(fakeBinDir, 'fake-docker.mjs').replace(/\\/gu, '/');
  const fakePsqlScript = join(fakeBinDir, 'fake-psql.mjs').replace(/\\/gu, '/');

  writeExecutable(
    join(fakeBinDir, 'fake-docker.mjs'),
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_DOCKER_LOG, \`\${args.join(' ')}\\n\`);

if (args[0] === 'compose') {
  const joined = \` \${args.join(' ')} \`;
  if (joined.includes(' config --format json ')) process.exit(0);
  if (joined.includes(' pull module-app-worker ')) process.exit(0);
  if (joined.includes(' up --no-deps --wait module-app-worker ')) process.exit(0);
  if (joined.includes(' ps -q module-app-worker ')) {
    process.stdout.write('worker-ctr\\n');
    process.exit(0);
  }
}

if (args[0] === 'ps') {
  const joined = args.join(' ');
  if (
    joined.includes('--filter status=running') &&
    joined.includes('--filter label=com.docker.compose.project') &&
    joined.includes('--filter label=com.docker.compose.service=module-runtime')
  ) {
    process.stdout.write('runtime-compose-1\\n');
    process.exit(0);
  }

  if (joined.includes('name=module-runtime')) {
    process.stdout.write('runtime-stopped\\nruntime-unrelated\\n');
    process.exit(0);
  }

  process.exit(0);
}

if (args[0] === 'inspect' && args[1] === '--format') {
  const format = args[2];
  const target = args[3];

  if (target === 'worker-ctr') {
    switch (format) {
      case '{{.Config.Image}}':
        process.stdout.write(process.env.EXPECTED_WORKER_IMAGE);
        process.exit(0);
      case '{{.Config.User}}':
        process.stdout.write('10001:10001');
        process.exit(0);
      case '{{.HostConfig.ReadonlyRootfs}}':
        process.stdout.write('true');
        process.exit(0);
      case '{{.HostConfig.Privileged}}':
        process.stdout.write('false');
        process.exit(0);
      case '{{json .HostConfig.CapDrop}}':
        process.stdout.write('["ALL"]');
        process.exit(0);
      case '{{json .HostConfig.CapAdd}}':
        process.stdout.write('[]');
        process.exit(0);
      case '{{json .HostConfig.SecurityOpt}}':
        process.stdout.write('["no-new-privileges:true"]');
        process.exit(0);
      case '{{json .NetworkSettings.Ports}}':
        process.stdout.write('{}');
        process.exit(0);
      case '{{with index .HostConfig.Tmpfs "/tmp"}}{{.}}{{end}}':
        process.stdout.write('size=64m,noexec,nosuid');
        process.exit(0);
      case '{{range .Mounts}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{"\\\\n"}}{{end}}':
        process.stdout.write(\`bind|\${process.env.EXPECTED_ARTIFACT_ROOT}|/runtime/artifacts|true\\n\`);
        process.exit(0);
      case '{{.State.Health.Status}}':
        process.stdout.write('healthy');
        process.exit(0);
      case '{{range .Config.Env}}{{println .}}{{end}}':
        process.stdout.write([
          'MODULE_APP_EXECUTION_ENABLED=false',
          'MODULE_APP_RUNTIME_INVOCATION_ENABLED=false',
          'MODULE_APP_WORKFLOW_PRIVILEGED_EXECUTORS_ENABLED=false',
          'MODULE_APP_SCHEDULE_DISPATCH_ENABLED=false',
          'MODULE_APP_ALIPAY_PAYMENT_CREATION_ENABLED=false',
          'MODULE_APP_ALIPAY_AUTO_SETTLEMENT_ENABLED=false',
          'MODULE_APP_PUBLISHER_PAYOUT_RECORDING_ENABLED=false',
          'MODULE_APP_PUBLIC_EXECUTION_ENABLED=false',
        ].join('\\n'));
        process.exit(0);
    }
  }

  if (
    target === 'runtime-compose-1' &&
    format === '{{range .Mounts}}{{if eq .Destination "/runtime/artifacts"}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{end}}{{end}}'
  ) {
    process.stdout.write(\`bind|\${process.env.EXPECTED_ARTIFACT_ROOT}|/runtime/artifacts|false\`);
    process.exit(0);
  }

  if (format === '{{range .Mounts}}{{if eq .Destination "/runtime/artifacts"}}{{.Type}}|{{.Source}}|{{.Destination}}|{{.RW}}{{end}}{{end}}') {
    process.stdout.write('bind|/tmp/unrelated-artifacts|/runtime/artifacts|false');
    process.exit(0);
  }
}

process.stderr.write(\`unexpected fake docker invocation: \${args.join(' ')}\\n\`);
process.exit(1);
`,
  );

  writeExecutable(
    join(fakeBinDir, 'fake-psql.mjs'),
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

appendFileSync(
  process.env.FAKE_PSQL_LOG,
  [
    \`DATABASE_URL=\${process.argv[2] ?? ''}\`,
    \`MODULE_APP_ARTIFACT_ROOT=\${process.env.MODULE_APP_ARTIFACT_ROOT ?? ''}\`,
    \`S3_ACCESS_KEY_ID=\${process.env.S3_ACCESS_KEY_ID ?? ''}\`,
    \`S3_SECRET_ACCESS_KEY=\${process.env.S3_SECRET_ACCESS_KEY ?? ''}\`,
  ].join('\\n') + '\\n',
);
process.stdout.write('4');
`,
  );

  const backupEnvSource = createdEnvFile ? null : readFileSync(envFile, 'utf8');
  writeFileSync(envFile, envContents);

  const result = spawnSync(
    'bash',
    [
      '-lc',
      `export PATH='${nodePath}':"$PATH"; export DOCKER_BIN='${nodeBin}'; export DOCKER_BIN_SCRIPT='${fakeDockerScript}'; export PSQL_BIN='${nodeBin}'; export PSQL_BIN_SCRIPT='${fakePsqlScript}'; exec ./deploy.sh '${workerImage}'`,
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPECTED_ARTIFACT_ROOT: expectedArtifactRoot,
        EXPECTED_WORKER_IMAGE: workerImage,
        FAKE_DOCKER_LOG: dockerLog,
        FAKE_PSQL_LOG: psqlLog,
        HOME: home,
        USER: user,
      },
    },
  );

  const dockerCalls = existsSync(dockerLog) ? readFileSync(dockerLog, 'utf8').trim() : '';
  const psqlCalls = existsSync(psqlLog) ? readFileSync(psqlLog, 'utf8').trim() : '';

  if (backupEnvSource === null) {
    rmSync(envFile, { force: true });
  } else {
    writeFileSync(envFile, backupEnvSource);
  }

  const markerState = Object.fromEntries(markers.map((marker) => [marker, existsSync(marker)]));
  rmSync(fakeBinDir, { force: true, recursive: true });

  return { dockerCalls, markerState, psqlCalls, result };
};

try {
  const output = execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'config', '--format', 'json'],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        COMHUB_MODULE_WORKER_IMAGE: workerImage,
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
  assert.equal(service.image, workerImage);
  assert.deepEqual(service.ports ?? [], []);
  assert.deepEqual(service.labels ?? {}, {});
  assert.deepEqual(service.cap_add ?? [], []);
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

  for (const flag of mutationFlags) assert.equal(service.environment?.[flag], 'false');

  const composeSource = readFileSync(composeFile, 'utf8');
  assert.match(composeSource, /\$\{COMHUB_MODULE_WORKER_IMAGE:\?immutable worker image required\}/);

  const exampleEnv = parseDotenv(readFileSync(resolve(directory, '.env.example'), 'utf8'));
  for (const key of exampleKeys) {
    assert.ok(exampleEnv[key], `.env.example must define ${key}`);
    assert.match(exampleEnv[key], /^<[^>]+>$/u, `${key} must remain a placeholder-only example value`);
  }

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
  assert.doesNotMatch(deploySource, /\bsource "\$ENV_FILE"\b/);
  assert.doesNotMatch(deploySource, /\beval\b/);
  assert.match(deploySource, /label=com\.docker\.compose\.project/);
  assert.match(deploySource, /label=com\.docker\.compose\.service=module-runtime/);
  assert.match(deploySource, /status=running/);
  assert.doesNotMatch(deploySource, /name=module-runtime/);

  const mutableImage = spawnSync('bash', ['deploy.sh', 'example.invalid/worker:latest'], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.notEqual(mutableImage.status, 0);
  assert.match(mutableImage.stderr, /non-empty sha-\* tag/);

  const commandMarkerName = '.compose-test-source-marker';
  const ignoredMarkerName = '.compose-test-ignored-marker';
  const commandMarker = resolve(directory, commandMarkerName);
  const ignoredMarker = resolve(directory, ignoredMarkerName);
  rmSync(commandMarker, { force: true });
  rmSync(ignoredMarker, { force: true });
  const missingSetting = runDeployWithFakes({
    envContents: [
      'DATABASE_URL=postgresql://test:test@localhost:5432/test',
      'MODULE_APP_ARTIFACT_ROOT=${HOME}/module-worker-artifacts',
      'S3_ACCESS_KEY_ID=${USER}-worker-access',
      'S3_ENDPOINT=https://s3.example.com',
      `S3_SECRET_ACCESS_KEY=$(touch ${commandMarkerName})`,
      `IGNORED_MALICIOUS=$(touch ${ignoredMarkerName})`,
    ].join('\n'),
    expectedArtifactRoot: '${HOME}/module-worker-artifacts',
    home: '/tmp/fake-home',
    markers: [commandMarker, ignoredMarker],
    user: 'fake-user',
  });
  assert.notEqual(missingSetting.result.status, 0);
  assert.match(missingSetting.result.stderr, /S3_BUCKET must be set in \.env/);
  assert.equal(missingSetting.dockerCalls, '');
  assert.equal(missingSetting.psqlCalls, '');
  assert.deepEqual(missingSetting.markerState, {
    [commandMarker]: false,
    [ignoredMarker]: false,
  });

  const rollbackSource = readFileSync(resolve(directory, 'rollback.sh'), 'utf8');
  assert.match(rollbackSource, /\.previous-image/);
  assert.match(rollbackSource, /COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE=true exec/);

  console.log('module worker Compose policy: PASS');
} finally {
  if (createdEnvFile) rmSync(envFile, { force: true });
}
