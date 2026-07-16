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

const traceMaintenanceCommands = (run, action, options = {}) => {
  const heredoc = run.match(/<<'REMOTE_MAINTENANCE'\n(?<script>[\s\S]*?)\nREMOTE_MAINTENANCE\s*$/u);
  assert.ok(heredoc?.groups?.script, 'maintenance workflow must embed the remote script');
  const dockerRoot = options.dockerRoot ?? '/var/lib/docker';
  assert.match(dockerRoot, /^\/[./\dA-Z_-]+$/iu);

  let remoteScript = heredoc.groups.script;
  const blueFixtureSetup = options.blueFixture
    ? String.raw`
TEST_MKTEMP_BIN="$(command -v mktemp)"
TEST_BLUE_ROOT="$("$TEST_MKTEMP_BIN" -d)"
TEST_MKDIR_BIN="$(command -v mkdir)"
TEST_LN_BIN="$(command -v ln)"
TEST_TOUCH_BIN="$(command -v touch)"
TEST_DU_BIN="$(command -v du)"
TEST_FIND_BIN="$(command -v find)"
TEST_REALPATH_BIN="$(command -v realpath)"
TEST_RM_BIN="$(command -v rm)"
cleanup_blue_fixture() { "$TEST_RM_BIN" -rf -- "$TEST_BLUE_ROOT"; }
trap cleanup_blue_fixture EXIT
"$TEST_MKDIR_BIN" -p \
  "$TEST_BLUE_ROOT/releases/current-release/.next/cache" \
  "$TEST_BLUE_ROOT/releases/old-release/.next/cache" \
  "$TEST_BLUE_ROOT/releases/recent-release/.next/cache" \
  "$TEST_BLUE_ROOT/releases/old-no-cache"
printf 'current\n' > "$TEST_BLUE_ROOT/releases/current-release/.next/cache/current.txt"
printf 'old\n' > "$TEST_BLUE_ROOT/releases/old-release/.next/cache/old.txt"
printf 'recent\n' > "$TEST_BLUE_ROOT/releases/recent-release/.next/cache/recent.txt"
printf '0\n' > "$TEST_BLUE_ROOT/.current-realpath-count"
"$TEST_LN_BIN" -s 'releases/current-release' "$TEST_BLUE_ROOT/current"
"$TEST_TOUCH_BIN" -d '10 days ago' \
  "$TEST_BLUE_ROOT/releases/current-release" \
  "$TEST_BLUE_ROOT/releases/old-release" \
  "$TEST_BLUE_ROOT/releases/old-no-cache"
"$TEST_TOUCH_BIN" -d '2 days ago' "$TEST_BLUE_ROOT/releases/recent-release"
`
    : "TEST_BLUE_ROOT=''";

  if (options.blueFixture) {
    const fixedRoot = "fixed_releases_root='/www/wwwroot/blue/releases'";
    const fixedCurrent = "fixed_current_link='/www/wwwroot/blue/current'";
    assert.match(remoteScript, new RegExp(fixedRoot.replaceAll('/', '\\/'), 'u'));
    assert.match(remoteScript, new RegExp(fixedCurrent.replaceAll('/', '\\/'), 'u'));
    remoteScript = remoteScript
      .replace(fixedRoot, 'fixed_releases_root="$TEST_BLUE_ROOT/releases"')
      .replace(fixedCurrent, 'fixed_current_link="$TEST_BLUE_ROOT/current"');
  }

  const unsafeBlueFixtureSetup = options.unsafeBlueFixture
    ? String.raw`
"$TEST_MKDIR_BIN" -p \
  "$TEST_BLUE_ROOT/outside-cache" \
  "$TEST_BLUE_ROOT/releases/unsafe-release/.next"
"$TEST_LN_BIN" -s "$TEST_BLUE_ROOT/outside-cache" \
  "$TEST_BLUE_ROOT/releases/unsafe-release/.next/cache"
"$TEST_TOUCH_BIN" -d '10 days ago' "$TEST_BLUE_ROOT/releases/unsafe-release"
`
    : '';
  const switchCurrentSetup = options.switchCurrentDuringCleanup
    ? "TEST_SWITCH_CURRENT='1'"
    : "TEST_SWITCH_CURRENT='0'";

  const commandStubs = String.raw`
exec 3>&1
record() {
  printf 'MAINTENANCE_TRACE' >&3
  printf '\t%s' "$@" >&3
  printf '\n' >&3
}
df() { record df "$@"; }
docker() {
  record docker "$@"
  if [ "$#" -ge 2 ] && [ "$1" = info ] && [ "$2" = --format ]; then
    printf '%s\n' '${dockerRoot}'
  fi
}
findmnt() { record findmnt "$@"; }
journalctl() { record journalctl "$@"; }
apt-get() { record apt-get "$@"; }
dnf() { record dnf "$@"; }
yum() { record yum "$@"; }
du() {
  record du "$@"
  local target=''
  for target in "$@"; do :; done
  if [ -n "$TEST_BLUE_ROOT" ] && [[ "$target" = "$TEST_BLUE_ROOT"/* ]]; then
    "$TEST_DU_BIN" "$@"
  fi
}
find() {
  record find "$@"
  if [ -n "$TEST_BLUE_ROOT" ] && [[ "$1" = "$TEST_BLUE_ROOT"/* ]]; then
    "$TEST_FIND_BIN" "$@"
  fi
}
bash() {
  record bash "$@"
  if [ "$#" -lt 2 ] || [ "$1" != -c ]; then
    record UNAPPROVED bash "$@"
    return 0
  fi
  local child_script="$2"
  shift 2
  if [ "$#" -gt 0 ]; then
    shift
  fi
  (eval "$child_script")
}
sort() { record sort "$@"; }
head() { record head "$@"; }
realpath() {
  record realpath "$@"
  local target=''
  for target in "$@"; do :; done
  if [ -n "$TEST_BLUE_ROOT" ] && [[ "$target" = "$TEST_BLUE_ROOT"/* ]]; then
    if [ "$TEST_SWITCH_CURRENT" = 1 ] && [ "$target" = "$TEST_BLUE_ROOT/current" ]; then
      local resolve_count=0
      IFS= read -r resolve_count < "$TEST_BLUE_ROOT/.current-realpath-count"
      resolve_count=$((resolve_count + 1))
      printf '%s\n' "$resolve_count" > "$TEST_BLUE_ROOT/.current-realpath-count"
      if [ "$resolve_count" -eq 3 ]; then
        "$TEST_RM_BIN" -f -- "$TEST_BLUE_ROOT/current"
        "$TEST_LN_BIN" -s 'releases/old-release' "$TEST_BLUE_ROOT/current"
      fi
    fi
    "$TEST_REALPATH_BIN" "$@"
  else
    case "$target" in
      /./) printf '/\n' ;;
      *) printf '%s\n' "$target" ;;
    esac
  fi
}
rm() {
  record rm "$@"
  local target=''
  for target in "$@"; do :; done
  if [ -n "$TEST_BLUE_ROOT" ] && [[ "$target" = "$TEST_BLUE_ROOT"/* ]]; then
    "$TEST_RM_BIN" "$@"
  else
    record UNAPPROVED rm "$@"
    return 1
  fi
}
timeout() {
  record timeout "$@"
  if [ "$1" = --kill-after=10s ]; then
    shift
  fi
  local duration="$1"
  shift
  "$@"
}
sync() { record sync "$@"; }
command_not_found_handle() {
  record UNAPPROVED "$@"
  return 0
}
PATH=/maintenance-test-no-external-commands
`;
  const result = spawnSync('bash', ['-s', '--', action], {
    encoding: 'utf8',
    input: `${blueFixtureSetup}\n${unsafeBlueFixtureSetup}\n${switchCurrentSetup}\n${commandStubs}\n${remoteScript}\n`,
  });
  if (options.expectFailure) {
    assert.notEqual(result.status, 0, 'maintenance command unexpectedly succeeded');
  } else {
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  }

  return result.stdout
    .split('\n')
    .filter((line) => line.startsWith('MAINTENANCE_TRACE\t'))
    .map((line) => line.split('\t').slice(1));
};

const selectMaintenanceCommands = (commands, names) =>
  commands.filter(([command]) => names.includes(command));

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

test('server disk maintenance is manual, production-locked, and bounded', () => {
  const { source, workflow } = loadWorkflow('comhub-maintenance.yml');

  assertManualOnly(workflow);
  const maintenanceInputs = workflow.on.workflow_dispatch.inputs;
  assert.deepEqual(Object.keys(maintenanceInputs), ['action']);
  const actionInput = maintenanceInputs.action;
  assert.equal(actionInput.required, true);
  assert.equal(actionInput.type, 'choice');
  assert.equal(actionInput.default, 'report');
  assert.deepEqual(actionInput.options, [
    'report',
    'report-deep',
    'report-blue-release-caches',
    'cleanup-safe',
    'cleanup-blue-release-caches',
  ]);
  assert.equal(workflow.permissions.contents, 'read');
  assertProductionLock(workflow.jobs.maintenance);
  assert.equal(workflow.jobs.maintenance.if, "${{ github.ref == 'refs/heads/main' }}");

  const checkout = workflow.jobs.maintenance.steps.find(
    (step) => step.name === 'Checkout maintenance tooling',
  );
  assert.equal(checkout?.with?.ref, '${{ github.sha }}');
  assert.match(source, /GITHUB_REF.*refs\/heads\/main/su);
  assert.match(source, /COMHUB_SSH_KNOWN_HOSTS/);
  assert.match(source, /COMHUB_SSH_PRIVATE_KEY/);
  assert.doesNotMatch(source, /ssh-keyscan/);

  const maintenance = workflow.jobs.maintenance.steps.find(
    (step) => step.name === 'Run bounded server maintenance',
  );
  const run = maintenance?.run ?? '';
  const otherRunBlocks = workflow.jobs.maintenance.steps
    .filter((step) => step !== maintenance && typeof step.run === 'string')
    .map((step) => step.run)
    .join('\n');
  assert.doesNotMatch(otherRunBlocks, /\bdocker\b/);
  assert.match(run, /-o StrictHostKeyChecking=yes/);
  assert.match(run, /-o "UserKnownHostsFile=\$HOME\/\.ssh\/known_hosts"/);
  assert.match(run, /Before maintenance/);
  assert.match(run, /After maintenance/);
  assert.match(run, /docker container prune -f --filter 'until=168h'/);
  assert.match(run, /docker network prune -f --filter 'until=168h'/);
  assert.match(run, /docker image prune -af/);
  assert.match(run, /docker builder prune -af/);
  assert.match(run, /journalctl --vacuum-time=14d/);
  assert.match(run, /journalctl --vacuum-size=512M/);
  assert.doesNotMatch(run, /docker\s+(?:volume\s+(?:prune|rm)|system\s+prune)/);
  assert.doesNotMatch(run, /docker\s+(?:container|image)\s+rm/);
  assert.doesNotMatch(run, /docker\s+compose\s+down[^\n]*\s-v/);
  assert.doesNotMatch(run, /truncate|shred|wipefs|find[^\n]*-delete/);
  assert.deepEqual(
    (run.match(/^\s*rm\b.*$/gmu) ?? []).map((line) => line.trim()),
    ['rm -rf --one-file-system -- "$cache_path"'],
  );
  assert.doesNotMatch(run, /\.Config\.Env|printenv|docker inspect/);
  assert.doesNotMatch(run, /\b(?:cat|tail|less|more|xxd|base64)\b/);
  assert.doesNotMatch(
    run,
    /\b(?:chmod|chown|chgrp|cp|dd|fstrim|logrotate|mount|mv|pkill|podman|service|systemctl|tee|touch|umount)\b|(?<!-)\bkill\b/,
  );
  assert.doesNotMatch(run, /(?:^|[\s;(])\/(?:usr\/)?s?bin\//mu);
  assert.match(run, /findmnt -rn -o TARGET,SOURCE,FSTYPE/);
  assert.match(run, /--max-depth=2/);
  assert.match(run, /-size ['"]?\+100M['"]?/);
  assert.match(run, /head -50/);
  assert.match(run, /timeout --kill-after=10s "\$duration" bash -c/);
  assert.match(run, /timeout --kill-after=10s 1m docker info/);
  assert.match(run, /timeout --kill-after=10s 2m docker system df -v/);
  assert.match(run, /timeout --kill-after=10s 1m docker ps -a --no-trunc/);
  assert.match(run, /timeout --kill-after=10s 5m bash -c/);
  assert.match(run, /report_tree '\/www' \/www 5m/);
  assert.match(run, /report_tree '\/var\/log' \/var\/log 2m/);
  assert.match(run, /report_tree '\/var\/cache' \/var\/cache 1m/);
  assert.match(run, /report_tree 'Docker root' "\$docker_root" 4m/);
  assert.match(run, /mapfile -d '' -t old_release_paths/);
  assert.doesNotMatch(run, /\bcoproc\b/);

  const reportCommands = traceMaintenanceCommands(run, 'report');
  assert.deepEqual(selectMaintenanceCommands(reportCommands, ['docker']), [
    ['docker', 'system', 'df'],
    [
      'docker',
      'ps',
      '-a',
      '--size',
      '--format',
      String.raw`table {{.Names}}\t{{.Status}}\t{{.Size}}`,
    ],
  ]);
  assert.deepEqual(selectMaintenanceCommands(reportCommands, ['journalctl']), [
    ['journalctl', '--disk-usage'],
  ]);
  assert.deepEqual(
    selectMaintenanceCommands(reportCommands, ['apt-get', 'dnf', 'yum', 'sync']),
    [],
  );

  const deepReportCommands = traceMaintenanceCommands(run, 'report-deep');
  assert.deepEqual(selectMaintenanceCommands(deepReportCommands, ['docker']), [
    ['docker', 'system', 'df'],
    [
      'docker',
      'ps',
      '-a',
      '--size',
      '--format',
      String.raw`table {{.Names}}\t{{.Status}}\t{{.Size}}`,
    ],
    ['docker', 'info', '--format', '{{.DockerRootDir}}'],
    ['docker', 'system', 'df', '-v'],
    [
      'docker',
      'ps',
      '-a',
      '--no-trunc',
      '--size',
      '--format',
      String.raw`table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Size}}`,
    ],
  ]);
  assert.deepEqual(selectMaintenanceCommands(deepReportCommands, ['findmnt']), [
    ['findmnt', '-rn', '-o', 'TARGET,SOURCE,FSTYPE'],
  ]);
  assert.deepEqual(selectMaintenanceCommands(deepReportCommands, ['realpath']), [
    ['realpath', '-e', '--', '/var/lib/docker'],
  ]);
  assert.deepEqual(selectMaintenanceCommands(deepReportCommands, ['journalctl']), [
    ['journalctl', '--disk-usage'],
  ]);
  assert.deepEqual(
    selectMaintenanceCommands(deepReportCommands, ['apt-get', 'dnf', 'yum', 'sync']),
    [],
  );
  const deepTimeoutCommands = selectMaintenanceCommands(deepReportCommands, ['timeout']);
  assert.ok(deepTimeoutCommands.length >= 3);
  for (const [, killAfter, duration] of deepTimeoutCommands) {
    assert.equal(killAfter, '--kill-after=10s');
    assert.ok(['1m', '2m', '4m', '5m'].includes(duration));
  }
  const deepReportAllowlist = new Set([
    'bash',
    'df',
    'docker',
    'du',
    'find',
    'findmnt',
    'head',
    'journalctl',
    'realpath',
    'sort',
    'timeout',
  ]);
  for (const [command] of deepReportCommands) {
    assert.ok(deepReportAllowlist.has(command), `unexpected deep-report command: ${command}`);
  }

  const probeRun = run.replace(
    "    echo '### Deep disk report'\n    report_deep",
    "    echo '### Deep disk report'\n    maintenance_forbidden_probe --all || true\n    report_deep",
  );
  assert.notEqual(probeRun, run, 'the forbidden-command probe must be injected');
  const probeCommands = traceMaintenanceCommands(probeRun, 'report-deep');
  assert.deepEqual(selectMaintenanceCommands(probeCommands, ['UNAPPROVED']), [
    ['UNAPPROVED', 'maintenance_forbidden_probe', '--all'],
  ]);

  const pipelineProbeRun = run.replace(
    /^(\s*)set -o pipefail\n(\s*du -x)/mu,
    '$1set -o pipefail\n$1maintenance_pipeline_probe --all || true\n$2',
  );
  assert.notEqual(pipelineProbeRun, run, 'the pipeline command probe must be injected');
  const pipelineProbeCommands = traceMaintenanceCommands(pipelineProbeRun, 'report-deep');
  const pipelineProbeDetections = selectMaintenanceCommands(pipelineProbeCommands, ['UNAPPROVED']);
  assert.ok(pipelineProbeDetections.length >= 1);
  for (const detection of pipelineProbeDetections) {
    assert.deepEqual(detection, ['UNAPPROVED', 'maintenance_pipeline_probe', '--all']);
  }

  const escapedRootCommands = traceMaintenanceCommands(run, 'report-deep', {
    dockerRoot: '/./',
  });
  assert.equal(
    escapedRootCommands.some(
      ([command, ...args]) =>
        ['bash', 'du', 'find', 'timeout'].includes(command) && args.includes('/./'),
    ),
    false,
    'root-equivalent Docker paths must be canonicalized before scanning',
  );

  const cleanupCommands = traceMaintenanceCommands(run, 'cleanup-safe');
  assert.deepEqual(selectMaintenanceCommands(cleanupCommands, ['docker']), [
    ['docker', 'system', 'df'],
    [
      'docker',
      'ps',
      '-a',
      '--size',
      '--format',
      String.raw`table {{.Names}}\t{{.Status}}\t{{.Size}}`,
    ],
    ['docker', 'container', 'prune', '-f', '--filter', 'until=168h'],
    ['docker', 'network', 'prune', '-f', '--filter', 'until=168h'],
    ['docker', 'image', 'prune', '-af'],
    ['docker', 'builder', 'prune', '-af'],
    ['docker', 'system', 'df'],
    [
      'docker',
      'ps',
      '-a',
      '--size',
      '--format',
      String.raw`table {{.Names}}\t{{.Status}}\t{{.Size}}`,
    ],
  ]);
  assert.deepEqual(selectMaintenanceCommands(cleanupCommands, ['journalctl']), [
    ['journalctl', '--disk-usage'],
    ['journalctl', '--vacuum-time=14d'],
    ['journalctl', '--vacuum-size=512M'],
    ['journalctl', '--disk-usage'],
  ]);
  assert.deepEqual(selectMaintenanceCommands(cleanupCommands, ['apt-get', 'dnf', 'yum', 'sync']), [
    ['apt-get', 'clean'],
    ['sync'],
  ]);

  const blueReportCommands = traceMaintenanceCommands(run, 'report-blue-release-caches', {
    blueFixture: true,
  });
  assert.deepEqual(selectMaintenanceCommands(blueReportCommands, ['rm']), []);
  assert.ok(
    blueReportCommands.some(
      ([command, ...args]) =>
        command === 'find' &&
        args.includes('-mindepth') &&
        args.includes('1') &&
        args.includes('-maxdepth') &&
        args.includes('-mmin') &&
        args.includes('+10080') &&
        args.includes('-print0'),
    ),
  );

  const blueCleanupCommands = traceMaintenanceCommands(run, 'cleanup-blue-release-caches', {
    blueFixture: true,
  });
  const blueCleanupRemovals = selectMaintenanceCommands(blueCleanupCommands, ['rm']);
  assert.equal(blueCleanupRemovals.length, 1);
  assert.deepEqual(blueCleanupRemovals[0].slice(0, -1), ['rm', '-rf', '--one-file-system', '--']);
  assert.match(blueCleanupRemovals[0].at(-1), /\/releases\/old-release\/\.next\/cache$/u);

  const unsafeBlueCleanupCommands = traceMaintenanceCommands(run, 'cleanup-blue-release-caches', {
    blueFixture: true,
    expectFailure: true,
    unsafeBlueFixture: true,
  });
  assert.deepEqual(selectMaintenanceCommands(unsafeBlueCleanupCommands, ['rm']), []);

  const switchedCurrentCleanupCommands = traceMaintenanceCommands(
    run,
    'cleanup-blue-release-caches',
    {
      blueFixture: true,
      expectFailure: true,
      switchCurrentDuringCleanup: true,
    },
  );
  assert.deepEqual(selectMaintenanceCommands(switchedCurrentCleanupCommands, ['rm']), []);
});

test('deployment workflows never trigger from push', () => {
  for (const filename of [
    'comhub-deploy.yml',
    'comhub-deploy-worker.yml',
    'comhub-maintenance.yml',
  ]) {
    const { workflow } = loadWorkflow(filename);
    assert.equal(workflow.on.push, undefined, `${filename} must not deploy from push`);
  }
});

test('all workflow Bash run blocks pass syntax validation', () => {
  for (const filename of [
    'comhub-build.yml',
    'comhub-deploy.yml',
    'comhub-deploy-worker.yml',
    'comhub-maintenance.yml',
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
