import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(root, 'docker-compose', 'deploy', 'module-runtime.yml');
const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
const full = process.argv.includes('--full');
const keepInfrastructure = process.argv.includes('--keep-infrastructure');
const postgresPort = Number(process.env.MODULE_APP_TEST_POSTGRES_PORT ?? 55432);
const redisPort = Number(process.env.MODULE_APP_TEST_REDIS_PORT ?? 56379);
const artifactRoot = mkdtempSync(path.join(os.tmpdir(), 'module-app-runtime-artifacts-'));
const dockerGid =
  process.env.MODULE_APP_DOCKER_GID ??
  (process.platform === 'linux' ? String(statSync('/var/run/docker.sock').gid) : '0');
const composeEnv = {
  MODULE_APP_ARTIFACT_ROOT: artifactRoot,
  MODULE_APP_DOCKER_GID: dockerGid,
};
writeFileSync(path.join(artifactRoot, '.verification-marker'), 'module-runtime-artifact-mount');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
};

const waitForPort = (port, timeoutMs = 60_000) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      const retry = () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Port ${port} did not become reachable within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 1000);
      };
      socket.once('error', retry);
      socket.once('timeout', retry);
    };
    attempt();
  });

const runVitest = (files, options = {}) =>
  run(process.execPath, [vitest, 'run', '--silent=passed-only', ...files], options);

const resetDatabase = () =>
  run(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'module-app-postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'module_app_test',
      '-d',
      'module_app_test',
      '-c',
      'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    ],
    { env: composeEnv },
  );

const requireFullEnvironment = () => {
  const required = [
    'MODULE_APP_ALIPAY_APP_ID',
    'MODULE_APP_ALIPAY_SELLER_ID',
    'MODULE_APP_ALIPAY_MERCHANT_PRIVATE_KEY',
    'MODULE_APP_ALIPAY_PUBLIC_KEY',
    'MODULE_APP_ALIPAY_RETURN_URL',
    'MODULE_APP_ALIPAY_NOTIFY_URL',
    'MODULE_APP_E2E_APP_ID',
    'MODULE_APP_E2E_BASE_URL',
    'MODULE_APP_E2E_DENIED_WORKSPACE_ID',
    'MODULE_APP_E2E_PAID_APP_ID',
    'MODULE_APP_E2E_PENDING_APP_ID',
    'MODULE_APP_E2E_REFUNDED_APP_ID',
    'MODULE_APP_E2E_REVOKED_APP_ID',
    'MODULE_APP_E2E_RUN_ID',
    'MODULE_APP_E2E_TEAM_WORKSPACE_ID',
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Full Module App production gate requires: ${missing.join(', ')}`);
  }
};

const databaseTests = [
  'src/models/__tests__/moduleAppGateway.test.ts',
  'src/models/__tests__/moduleAppPayment.test.ts',
  'src/models/__tests__/moduleAppPublisher.test.ts',
  'src/models/__tests__/moduleAppPayout.test.ts',
];

try {
  if (full) requireFullEnvironment();
  run('docker', ['info', '--format', '{{.ServerVersion}}']);
  run('docker', [
    'compose',
    '-f',
    composeFile,
    'up',
    '-d',
    '--wait',
    'module-app-postgres',
    'module-app-redis',
  ], { env: composeEnv });
  await Promise.all([waitForPort(postgresPort), waitForPort(redisPort)]);

  runVitest(['apps/module-runtime/src/securityProbes.test.ts'], {
    env: {
      MODULE_APP_PRODUCTION_GATES_REQUIRED: 'true',
      MODULE_APP_REAL_CONTAINER_TESTS: 'true',
    },
  });
  runVitest(['apps/server/src/services/moduleAppSandbox/lease.test.ts'], {
    env: {
      MODULE_APP_PRODUCTION_GATES_REQUIRED: 'true',
      REDIS_TEST_URL: `redis://127.0.0.1:${redisPort}`,
    },
  });

  for (const testFile of databaseTests) {
    resetDatabase();
    runVitest([testFile], {
      cwd: path.join(root, 'packages', 'database'),
      env: {
        DATABASE_TEST_URL: `postgresql://module_app_test:module_app_test@127.0.0.1:${postgresPort}/module_app_test`,
        TEST_SERVER_DB: '1',
      },
    });
  }

  run(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      '--profile',
      'runtime',
      'up',
      '-d',
      '--build',
      '--wait',
      'module-runtime',
    ],
    { env: composeEnv },
  );
  run(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'module-runtime',
      'sh',
      '-ec',
      [
        'test "$(id -u)" = "10001"',
        'test -r /runtime/artifacts/.verification-marker',
        '! touch /runtime/artifacts/.write-probe',
        'docker version >/dev/null',
        `node -e "const http=require('http');const request=http.request({host:'127.0.0.1',port:3210,path:'/v1/invocations',method:'POST'},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>process.exit(response.statusCode===503&&body.includes('MODULE_APP_RUNTIME_INVOCATION_DISABLED')?0:1))});request.end('{}')"`,
      ].join(' && '),
    ],
    { env: composeEnv },
  );

  if (full) {
    runVitest(['apps/server/src/services/moduleAppPayments/alipay/sandbox.test.ts'], {
      env: {
        MODULE_APP_ALIPAY_SANDBOX_TESTS: 'true',
        MODULE_APP_PRODUCTION_GATES_REQUIRED: 'true',
      },
    });
    const cucumber = path.join(
      root,
      'e2e',
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'cucumber-js.CMD' : 'cucumber-js',
    );
    run(cucumber, ['--config', 'cucumber.config.js', '--tags', '@module-app-production'], {
      cwd: path.join(root, 'e2e'),
      env: {
        BASE_URL: process.env.MODULE_APP_E2E_BASE_URL,
        MODULE_APP_PRODUCTION_GATES_REQUIRED: 'true',
      },
    });
  }
} finally {
  if (!keepInfrastructure) {
    spawnSync('docker', ['compose', '-f', composeFile, '--profile', 'runtime', 'down'], {
      cwd: root,
      env: { ...process.env, ...composeEnv },
      stdio: 'inherit',
    });
    rmSync(artifactRoot, { force: true, recursive: true });
  }
}
