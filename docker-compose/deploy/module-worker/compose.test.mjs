import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { dirname, join, resolve } = path;
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
  'COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL',
  'DATABASE_URL',
  'S3_ACCESS_KEY_ID',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_SECRET_ACCESS_KEY',
];
const exampleDefaults = {
  COMHUB_PLATFORM_COMPOSE_PROJECT: 'comhub',
};

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

const tempCleanupWaiter = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
const removeTempDirectory = (directoryPath) => {
  const deadline = Date.now() + 5_000;

  while (true) {
    try {
      rmSync(directoryPath, { recursive: true });
      return;
    } catch (error) {
      if (error?.code !== 'EBUSY') throw error;

      const remaining = deadline - Date.now();
      if (remaining <= 0) throw error;
      Atomics.wait(tempCleanupWaiter, 0, 0, Math.min(100, remaining));
    }
  }
};

const toBashPath = (windowsPath) =>
  windowsPath.replace(/^([A-Za-z]):\\/u, (_, drive) => `/${drive.toLowerCase()}/`).replaceAll('\\', '/');

const runDeployWithFakes = ({
  currentWorkerImage,
  deployCommand = './deploy.sh',
  deployDirectory = directory,
  envContents,
  envFilePath = envFile,
  expectedArtifactRoot,
  expectedPlatformProject = 'comhub',
  home,
  user,
  markers = [],
  skipPreviousImage = true,
}) => {
  const fakeBinDir = mkdtempSync(join(tmpdir(), 'module-worker-compose-'));
  const dockerLog = join(fakeBinDir, 'docker.log');
  const psqlLog = join(fakeBinDir, 'psql.log');
  const nodeBin = process.platform === 'win32' ? 'node.exe' : 'node';
  const nodePath = toBashPath(dirname(process.execPath));
  const fakeDockerScript = join(fakeBinDir, 'fake-docker.mjs').replaceAll('\\', '/');
  const fakeInstallScript = join(fakeBinDir, 'fake-install.mjs').replaceAll('\\', '/');
  const fakePsqlScript = join(fakeBinDir, 'fake-psql.mjs').replaceAll('\\', '/');
  const currentImageMarker = join(fakeBinDir, 'current-image-recorded');

  writeExecutable(
    join(fakeBinDir, 'fake-docker.mjs'),
    `#!/usr/bin/env node
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

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

if (args[0] === 'run') {
  const joined = \` \${args.join(' ')} \`;
  if (
    joined.includes(' --rm ') &&
    joined.includes(' --network host ') &&
    joined.includes(' postgres:17-alpine ') &&
    joined.includes(' psql ') &&
    joined.includes(' postgresql://test:test@127.0.0.1:15432/test ')
  ) {
    process.stdout.write('4');
    process.exit(0);
  }
}

if (args[0] === 'ps') {
  const joined = args.join(' ');
  if (
    joined.includes('--filter status=running') &&
    joined.includes(
      \`--filter label=com.docker.compose.project=\${process.env.EXPECTED_PLATFORM_PROJECT}\`,
    ) &&
    joined.includes('--filter label=com.docker.compose.service=module-runtime')
  ) {
    process.stdout.write('runtime-compose-1\\n');
    process.exit(0);
  }
}

if (args[0] === 'inspect' && args[1] === '--format') {
  const format = args[2];
  const target = args[3];

  if (target === 'worker-ctr') {
    switch (format) {
      case '{{.Config.Image}}':
        if (process.env.CURRENT_WORKER_IMAGE && !existsSync(process.env.CURRENT_IMAGE_MARKER)) {
          writeFileSync(process.env.CURRENT_IMAGE_MARKER, 'recorded');
          process.stdout.write(process.env.CURRENT_WORKER_IMAGE);
          process.exit(0);
        }
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
  writeExecutable(join(fakeBinDir, 'fake-install.mjs'), '#!/usr/bin/env node\nprocess.exit(0);\n');

  const hadEnvFile = existsSync(envFilePath);
  const backupEnvSource = hadEnvFile ? readFileSync(envFilePath, 'utf8') : null;
  const effectiveEnvContents = `${envContents.replaceAll(
    'postgresql://test:test@localhost:5432/test',
    'postgresql://test:test@comhub-paradedb:5432/test',
  )}\nCOMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL=postgresql://test:test@127.0.0.1:15432/test`;
  writeFileSync(envFilePath, effectiveEnvContents);

  const result = spawnSync(
    'bash',
    [
      '-lc',
      `export PATH='${nodePath}':"$PATH"; ${skipPreviousImage ? "export COMHUB_MODULE_WORKER_SKIP_PREVIOUS_IMAGE='true'; " : ''}export DOCKER_BIN='${nodeBin}'; export DOCKER_BIN_SCRIPT='${fakeDockerScript}'; export INSTALL_BIN='${nodeBin}'; export INSTALL_BIN_SCRIPT='${fakeInstallScript}'; export PSQL_BIN='${nodeBin}'; export PSQL_BIN_SCRIPT='${fakePsqlScript}'; exec '${deployCommand}' '${workerImage}'`,
    ],
    {
      cwd: deployDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPECTED_ARTIFACT_ROOT: expectedArtifactRoot,
        EXPECTED_PLATFORM_PROJECT: expectedPlatformProject,
        EXPECTED_WORKER_IMAGE: workerImage,
        CURRENT_IMAGE_MARKER: currentImageMarker,
        CURRENT_WORKER_IMAGE: currentWorkerImage ?? '',
        FAKE_DOCKER_LOG: dockerLog,
        FAKE_PSQL_LOG: psqlLog,
        HOME: home,
        USER: user,
      },
    },
  );

  const dockerCalls = existsSync(dockerLog) ? readFileSync(dockerLog, 'utf8').trim() : '';
  const psqlCalls = existsSync(psqlLog) ? readFileSync(psqlLog, 'utf8').trim() : '';

  if (!hadEnvFile) {
    rmSync(envFilePath, { force: true });
  } else {
    writeFileSync(envFilePath, backupEnvSource);
  }

  const markerState = Object.fromEntries(markers.map((marker) => [marker, existsSync(marker)]));
  rmSync(fakeBinDir, { force: true, recursive: true });

  return { dockerCalls, markerState, psqlCalls, result };
};

const assertExactRuntimeProjectFilter = (dockerCalls, project) => {
  const runtimeLookup = dockerCalls
    .split(/\r?\n/u)
    .find((line) => line.startsWith('ps --filter status=running '));
  assert.ok(runtimeLookup, 'deploy must query the running module-runtime container');
  assert.ok(
    runtimeLookup.includes(`--filter label=com.docker.compose.project=${project}`),
    `runtime lookup must filter the exact Compose project ${project}: ${runtimeLookup}`,
  );
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
        COMHUB_PLATFORM_NETWORK: 'paradedb_default',
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
  assert.equal(config.networks?.platform?.name, 'paradedb_default');

  for (const flag of mutationFlags) assert.equal(service.environment?.[flag], 'false');

  const composeSource = readFileSync(composeFile, 'utf8');
  assert.match(composeSource, /\$\{COMHUB_MODULE_WORKER_IMAGE:\?immutable worker image required\}/);
  assert.match(composeSource, /\$\{COMHUB_PLATFORM_NETWORK:-paradedb_default\}/);

  const exampleEnv = parseDotenv(readFileSync(resolve(directory, '.env.example'), 'utf8'));
  for (const key of exampleKeys) {
    assert.ok(exampleEnv[key], `.env.example must define ${key}`);
    assert.match(exampleEnv[key], /^<[^>]+>$/u, `${key} must remain a placeholder-only example value`);
  }
  for (const [key, value] of Object.entries(exampleDefaults)) {
    assert.equal(exampleEnv[key], value, `.env.example must default ${key} to ${value}`);
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
  assert.match(deploySource, /mv -Tf -- "\$temporary_file" "\$previous_image_target"/);
  assert.doesNotMatch(deploySource, /\bsource "\$ENV_FILE"\b/);
  assert.doesNotMatch(deploySource, /\beval\b/);
  assert.match(deploySource, /label=com\.docker\.compose\.project/);
  assert.match(deploySource, /label=com\.docker\.compose\.service=module-runtime/);
  assert.match(deploySource, /status=running/);
  assert.doesNotMatch(deploySource, /name=module-runtime/);
  assert.doesNotMatch(deploySource, /PSQL_BIN/);
  assert.match(deploySource, /run_docker run --rm --network host/);
  assert.match(deploySource, /COMHUB_MODULE_WORKER_PREFLIGHT_DATABASE_URL/);
  assert.match(deploySource, /run_install -d -o 10001 -g 10001/);

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
  const defaultPlatformProject = runDeployWithFakes({
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
  assert.equal(defaultPlatformProject.result.status, 0, defaultPlatformProject.result.stderr);
  assertExactRuntimeProjectFilter(defaultPlatformProject.dockerCalls, 'comhub');
  assert.match(defaultPlatformProject.dockerCalls, /run --rm --network host .*postgres:17-alpine.*psql/);
  assert.match(
    defaultPlatformProject.dockerCalls,
    /ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_token" text/s,
  );
  assert.match(
    defaultPlatformProject.dockerCalls,
    /CREATE INDEX IF NOT EXISTS "module_app_builds_claimable_idx"/s,
  );
  assert.match(
    defaultPlatformProject.dockerCalls,
    /module_app_builds_attempt_count_check/s,
  );
  assert.match(defaultPlatformProject.dockerCalls, /WHERE "status" = 'building'/s);
  assert.ok(
    defaultPlatformProject.dockerCalls.indexOf('ADD COLUMN IF NOT EXISTS "claim_token"') <
      defaultPlatformProject.dockerCalls.indexOf('BEGIN READ ONLY'),
    'deploy must repair migration 0144 before the read-only migration preflight',
  );
  assert.equal(defaultPlatformProject.psqlCalls, '');

  const configuredPlatformProject = runDeployWithFakes({
    envContents: [
      'COMHUB_PLATFORM_COMPOSE_PROJECT=comhub-production',
      'DATABASE_URL=postgresql://test:test@localhost:5432/test',
      'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
      'S3_ACCESS_KEY_ID=worker-access',
      'S3_BUCKET=module-artifacts',
      'S3_ENDPOINT=https://s3.example.com',
      'S3_SECRET_ACCESS_KEY=worker-secret',
    ].join('\n'),
    expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
    expectedPlatformProject: 'comhub-production',
    home: '/tmp/fake-home',
    user: 'fake-user',
  });
  assert.equal(configuredPlatformProject.result.status, 0, configuredPlatformProject.result.stderr);
  assertExactRuntimeProjectFilter(configuredPlatformProject.dockerCalls, 'comhub-production');

  const releaseStateRoot = mkdtempSync(join(tmpdir(), 'module-worker-release-state-'));
  try {
    const releaseDirectory = join(releaseStateRoot, 'releases', 'sha-test-release');
    const rootEnvFile = join(releaseStateRoot, '.env');
    const rootPreviousImage = join(releaseStateRoot, '.previous-image');
    mkdirSync(releaseDirectory, { recursive: true });
    copyFileSync(resolve(directory, 'compose.yml'), join(releaseDirectory, 'compose.yml'));
    copyFileSync(resolve(directory, 'deploy.sh'), join(releaseDirectory, 'deploy.sh'));
    chmodSync(join(releaseDirectory, 'deploy.sh'), 0o750);
    symlinkSync('../../.env', join(releaseDirectory, '.env'));
    symlinkSync('../../.previous-image', join(releaseDirectory, '.previous-image'));
    writeFileSync(rootPreviousImage, 'example.invalid/worker:sha-older-state\n');

    const releaseDeploy = runDeployWithFakes({
      currentWorkerImage: 'example.invalid/worker:sha-current-image',
      deployDirectory: releaseDirectory,
      envContents: [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
        'S3_ACCESS_KEY_ID=worker-access',
        'S3_BUCKET=module-artifacts',
        'S3_ENDPOINT=https://s3.example.com',
        'S3_SECRET_ACCESS_KEY=worker-secret',
      ].join('\n'),
      envFilePath: rootEnvFile,
      expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
      home: '/tmp/fake-home',
      skipPreviousImage: false,
      user: 'fake-user',
    });

    assert.equal(releaseDeploy.result.status, 0, releaseDeploy.result.stderr);
    assert.equal(lstatSync(join(releaseDirectory, '.previous-image')).isSymbolicLink(), true);
    assert.equal(
      readlinkSync(join(releaseDirectory, '.previous-image')).replaceAll('\\', '/'),
      '../../.previous-image',
    );
    assert.equal(
      readFileSync(rootPreviousImage, 'utf8'),
      'example.invalid/worker:sha-current-image\n',
    );
  } finally {
    removeTempDirectory(releaseStateRoot);
  }

  const currentStateRoot = mkdtempSync(join(tmpdir(), 'module-worker-current-state-'));
  try {
    const comhubDirectory = join(currentStateRoot, 'comhub');
    const workerDeployDirectory = join(comhubDirectory, 'module-worker');
    const releaseDirectory = join(workerDeployDirectory, 'releases', 'sha-test-release');
    const rootEnvFile = join(workerDeployDirectory, '.env');
    const rootPreviousImage = join(workerDeployDirectory, '.previous-image');
    const parentPreviousImage = join(comhubDirectory, '.previous-image');
    mkdirSync(releaseDirectory, { recursive: true });
    copyFileSync(resolve(directory, 'compose.yml'), join(releaseDirectory, 'compose.yml'));
    copyFileSync(resolve(directory, 'deploy.sh'), join(releaseDirectory, 'deploy.sh'));
    chmodSync(join(releaseDirectory, 'deploy.sh'), 0o750);
    symlinkSync('../../.env', join(releaseDirectory, '.env'));
    symlinkSync('../../.previous-image', join(releaseDirectory, '.previous-image'));
    symlinkSync('releases/sha-test-release', join(workerDeployDirectory, 'current'), 'dir');
    writeFileSync(rootPreviousImage, 'example.invalid/worker:sha-older-state\n');

    const currentDeploy = runDeployWithFakes({
      currentWorkerImage: 'example.invalid/worker:sha-current-image',
      deployCommand: './current/deploy.sh',
      deployDirectory: workerDeployDirectory,
      envContents: [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
        'S3_ACCESS_KEY_ID=worker-access',
        'S3_BUCKET=module-artifacts',
        'S3_ENDPOINT=https://s3.example.com',
        'S3_SECRET_ACCESS_KEY=worker-secret',
      ].join('\n'),
      envFilePath: rootEnvFile,
      expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
      home: '/tmp/fake-home',
      skipPreviousImage: false,
      user: 'fake-user',
    });

    assert.equal(currentDeploy.result.status, 0, currentDeploy.result.stderr);
    assert.equal(
      readFileSync(rootPreviousImage, 'utf8'),
      'example.invalid/worker:sha-current-image\n',
    );
    assert.equal(existsSync(parentPreviousImage), false);
    assert.equal(lstatSync(join(releaseDirectory, '.env')).isSymbolicLink(), true);
    assert.equal(readlinkSync(join(releaseDirectory, '.env')).replaceAll('\\', '/'), '../../.env');
    assert.equal(lstatSync(join(releaseDirectory, '.previous-image')).isSymbolicLink(), true);
    assert.equal(
      readlinkSync(join(releaseDirectory, '.previous-image')).replaceAll('\\', '/'),
      '../../.previous-image',
    );
  } finally {
    removeTempDirectory(currentStateRoot);
  }

  const absoluteStateRoot = mkdtempSync(join(tmpdir(), 'module-worker-absolute-state-'));
  try {
    const releaseDirectory = join(absoluteStateRoot, 'releases', 'sha-test-release');
    const rootEnvFile = join(absoluteStateRoot, '.env');
    const rootPreviousImage = join(absoluteStateRoot, '.previous-image');
    mkdirSync(releaseDirectory, { recursive: true });
    copyFileSync(resolve(directory, 'compose.yml'), join(releaseDirectory, 'compose.yml'));
    copyFileSync(resolve(directory, 'deploy.sh'), join(releaseDirectory, 'deploy.sh'));
    chmodSync(join(releaseDirectory, 'deploy.sh'), 0o750);
    symlinkSync('../../.env', join(releaseDirectory, '.env'));
    symlinkSync(rootPreviousImage, join(releaseDirectory, '.previous-image'));
    writeFileSync(rootPreviousImage, 'example.invalid/worker:sha-older-state\n');

    const absoluteStateDeploy = runDeployWithFakes({
      currentWorkerImage: 'example.invalid/worker:sha-current-image',
      deployDirectory: releaseDirectory,
      envContents: [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
        'S3_ACCESS_KEY_ID=worker-access',
        'S3_BUCKET=module-artifacts',
        'S3_ENDPOINT=https://s3.example.com',
        'S3_SECRET_ACCESS_KEY=worker-secret',
      ].join('\n'),
      envFilePath: rootEnvFile,
      expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
      home: '/tmp/fake-home',
      skipPreviousImage: false,
      user: 'fake-user',
    });

    assert.equal(absoluteStateDeploy.result.status, 0, absoluteStateDeploy.result.stderr);
    assert.equal(lstatSync(join(releaseDirectory, '.previous-image')).isSymbolicLink(), true);
    assert.equal(
      readFileSync(rootPreviousImage, 'utf8'),
      'example.invalid/worker:sha-current-image\n',
    );
  } finally {
    removeTempDirectory(absoluteStateRoot);
  }

  const standaloneStateRoot = mkdtempSync(join(tmpdir(), 'module-worker-standalone-state-'));
  try {
    const standaloneEnvFile = join(standaloneStateRoot, '.env');
    const standalonePreviousImage = join(standaloneStateRoot, '.previous-image');
    copyFileSync(resolve(directory, 'compose.yml'), join(standaloneStateRoot, 'compose.yml'));
    copyFileSync(resolve(directory, 'deploy.sh'), join(standaloneStateRoot, 'deploy.sh'));
    chmodSync(join(standaloneStateRoot, 'deploy.sh'), 0o750);

    const standaloneDeploy = runDeployWithFakes({
      currentWorkerImage: 'example.invalid/worker:sha-current-image',
      deployDirectory: standaloneStateRoot,
      envContents: [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
        'S3_ACCESS_KEY_ID=worker-access',
        'S3_BUCKET=module-artifacts',
        'S3_ENDPOINT=https://s3.example.com',
        'S3_SECRET_ACCESS_KEY=worker-secret',
      ].join('\n'),
      envFilePath: standaloneEnvFile,
      expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
      home: '/tmp/fake-home',
      skipPreviousImage: false,
      user: 'fake-user',
    });

    assert.equal(standaloneDeploy.result.status, 0, standaloneDeploy.result.stderr);
    assert.equal(lstatSync(standalonePreviousImage).isSymbolicLink(), false);
    assert.equal(
      readFileSync(standalonePreviousImage, 'utf8'),
      'example.invalid/worker:sha-current-image\n',
    );
  } finally {
    removeTempDirectory(standaloneStateRoot);
  }

  const chainedStateRoot = mkdtempSync(join(tmpdir(), 'module-worker-chained-state-'));
  try {
    const releaseDirectory = join(chainedStateRoot, 'releases', 'sha-test-release');
    const rootEnvFile = join(chainedStateRoot, '.env');
    const rootPreviousImage = join(chainedStateRoot, '.previous-image');
    const chainedStateTarget = join(chainedStateRoot, '.previous-image-target');
    mkdirSync(releaseDirectory, { recursive: true });
    copyFileSync(resolve(directory, 'compose.yml'), join(releaseDirectory, 'compose.yml'));
    copyFileSync(resolve(directory, 'deploy.sh'), join(releaseDirectory, 'deploy.sh'));
    chmodSync(join(releaseDirectory, 'deploy.sh'), 0o750);
    symlinkSync('../../.env', join(releaseDirectory, '.env'));
    symlinkSync('../../.previous-image', join(releaseDirectory, '.previous-image'));
    symlinkSync('.previous-image-target', rootPreviousImage);
    writeFileSync(chainedStateTarget, 'example.invalid/worker:sha-chained-state\n');

    const chainedStateDeploy = runDeployWithFakes({
      currentWorkerImage: 'example.invalid/worker:sha-current-image',
      deployDirectory: releaseDirectory,
      envContents: [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
        'S3_ACCESS_KEY_ID=worker-access',
        'S3_BUCKET=module-artifacts',
        'S3_ENDPOINT=https://s3.example.com',
        'S3_SECRET_ACCESS_KEY=worker-secret',
      ].join('\n'),
      envFilePath: rootEnvFile,
      expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
      home: '/tmp/fake-home',
      skipPreviousImage: false,
      user: 'fake-user',
    });

    assert.notEqual(chainedStateDeploy.result.status, 0);
    assert.match(chainedStateDeploy.result.stderr, /must not be another symlink/);
    assert.equal(lstatSync(join(releaseDirectory, '.previous-image')).isSymbolicLink(), true);
    assert.equal(
      readlinkSync(join(releaseDirectory, '.previous-image')).replaceAll('\\', '/'),
      '../../.previous-image',
    );
    assert.equal(lstatSync(rootPreviousImage).isSymbolicLink(), true);
    assert.equal(
      readFileSync(chainedStateTarget, 'utf8'),
      'example.invalid/worker:sha-chained-state\n',
    );
  } finally {
    removeTempDirectory(chainedStateRoot);
  }

  const escapedStateRoot = mkdtempSync(join(tmpdir(), 'module-worker-escaped-state-'));
  const escapedStateTarget = join(
    tmpdir(),
    `module-worker-outside-state-${process.pid}-${Date.now()}`,
  );
  try {
    const releaseDirectory = join(escapedStateRoot, 'releases', 'sha-test-release');
    const rootEnvFile = join(escapedStateRoot, '.env');
    mkdirSync(releaseDirectory, { recursive: true });
    copyFileSync(resolve(directory, 'compose.yml'), join(releaseDirectory, 'compose.yml'));
    copyFileSync(resolve(directory, 'deploy.sh'), join(releaseDirectory, 'deploy.sh'));
    chmodSync(join(releaseDirectory, 'deploy.sh'), 0o750);
    symlinkSync('../../.env', join(releaseDirectory, '.env'));
    symlinkSync(
      `../../../${escapedStateTarget.split(/[\\/]/u).at(-1)}`,
      join(releaseDirectory, '.previous-image'),
    );
    writeFileSync(escapedStateTarget, 'outside-state-must-not-change\n');

    const escapedStateDeploy = runDeployWithFakes({
      currentWorkerImage: 'example.invalid/worker:sha-current-image',
      deployDirectory: releaseDirectory,
      envContents: [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
        'S3_ACCESS_KEY_ID=worker-access',
        'S3_BUCKET=module-artifacts',
        'S3_ENDPOINT=https://s3.example.com',
        'S3_SECRET_ACCESS_KEY=worker-secret',
      ].join('\n'),
      envFilePath: rootEnvFile,
      expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
      home: '/tmp/fake-home',
      skipPreviousImage: false,
      user: 'fake-user',
    });

    assert.notEqual(escapedStateDeploy.result.status, 0);
    assert.match(escapedStateDeploy.result.stderr, /previous image target must remain within/);
    assert.equal(lstatSync(join(releaseDirectory, '.previous-image')).isSymbolicLink(), true);
    assert.equal(readFileSync(escapedStateTarget, 'utf8'), 'outside-state-must-not-change\n');
  } finally {
    removeTempDirectory(escapedStateRoot);
    rmSync(escapedStateTarget, { force: true });
  }

  const unsafePlatformProject = runDeployWithFakes({
    envContents: [
      'COMHUB_PLATFORM_COMPOSE_PROJECT=comhub,staging',
      'DATABASE_URL=postgresql://test:test@localhost:5432/test',
      'MODULE_APP_ARTIFACT_ROOT=/var/lib/comhub/module-worker-artifacts',
      'S3_ACCESS_KEY_ID=worker-access',
      'S3_BUCKET=module-artifacts',
      'S3_ENDPOINT=https://s3.example.com',
      'S3_SECRET_ACCESS_KEY=worker-secret',
    ].join('\n'),
    expectedArtifactRoot: '/var/lib/comhub/module-worker-artifacts',
    expectedPlatformProject: 'comhub,staging',
    home: '/tmp/fake-home',
    user: 'fake-user',
  });
  assert.notEqual(unsafePlatformProject.result.status, 0);
  assert.match(
    unsafePlatformProject.result.stderr,
    /COMHUB_PLATFORM_COMPOSE_PROJECT must match \[a-z0-9\]\[a-z0-9_-\]\*/,
  );
  assert.equal(unsafePlatformProject.dockerCalls, '');
  assert.equal(unsafePlatformProject.psqlCalls, '');

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

  console.info('module worker Compose policy: PASS');
} finally {
  if (createdEnvFile) rmSync(envFile, { force: true });
}
