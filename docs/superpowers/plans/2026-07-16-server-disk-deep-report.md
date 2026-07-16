# ComHub Server Disk Deep Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and execute a fixed, read-only `report-deep` production maintenance action that explains the remaining disk usage under `/www` and other bounded roots.

**Architecture:** Extend the existing manual maintenance workflow rather than creating another production SSH entrypoint. The remote script keeps the current base report, then adds bounded mount, directory-depth, Docker, and large-file metadata when `report-deep` is selected; contract tests execute the embedded script with command stubs and enforce exact Docker call sequences.

**Tech Stack:** GitHub Actions YAML, Bash, OpenSSH, Docker CLI, Node.js contract tests.

## Global Constraints

- `report-deep` is strictly read-only and accepts no arbitrary paths or commands.
- Never print file contents, environment variables, credentials, container configuration, or database data.
- Never delete, truncate, rotate, compress, move, stop, restart, or modify production data or processes.
- Keep `report` and `cleanup-safe` behavior unchanged.
- Keep the production environment, `main` gate, strict known-host SSH, and `comhub-production-deploy` concurrency lock.
- Limit deep output to the largest 100 directory entries and 50 files over 100 MB.
- Keep recursive scans on their starting filesystem and bound expensive scans with `timeout`.
- Merge with `[skip ci]` and verify no image-build workflow starts.

---

### Task 1: Deep Report Contract

**Files:**
- Modify: `.github/workflows/comhubDeploymentWorkflows.test.mjs`
- Test: `.github/workflows/comhubDeploymentWorkflows.test.mjs`

**Interfaces:**
- Consumes: parsed `comhub-maintenance.yml` and its `Run bounded server maintenance` Bash block.
- Produces: a failing contract for the fixed `report-deep` input and its exact read-only Docker command sequence.

- [ ] **Step 1: Extend command tracing for command substitution and deep-report tools**

Change the trace prelude so records bypass command substitution on file descriptor 3, return a deterministic Docker root, and stub `findmnt` plus `timeout`:

```js
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
  if [ "${1:-}" = info ] && [ "${2:-}" = --format ]; then
    printf '/var/lib/docker\n'
  fi
}
findmnt() { record findmnt "$@"; }
journalctl() { record journalctl "$@"; }
apt-get() { record apt-get "$@"; }
dnf() { record dnf "$@"; }
yum() { record yum "$@"; }
du() { record du "$@"; }
find() { record find "$@"; }
timeout() {
  local duration="$1"
  shift
  record timeout "$duration" "$@"
  "$@"
}
sync() { record sync "$@"; }
`;
```

- [ ] **Step 2: Write the failing fixed-input and read-only behavior assertions**

Require the new option and exact Docker calls while retaining the zero-mutation assertions:

```js
assert.deepEqual(actionInput.options, ['report', 'report-deep', 'cleanup-safe']);

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
assert.deepEqual(
  selectMaintenanceCommands(deepReportCommands, ['apt-get', 'dnf', 'yum', 'sync']),
  [],
);
assert.deepEqual(
  selectMaintenanceCommands(deepReportCommands, ['journalctl']),
  [['journalctl', '--disk-usage']],
);
assert.match(run, /findmnt -rn -o TARGET,SOURCE,FSTYPE/);
assert.match(run, /--max-depth=2/);
assert.match(run, /-size '\+100M'/);
assert.match(run, /head -50/);
```

- [ ] **Step 3: Run the contract test and verify RED**

Run:

```powershell
node .github/workflows/comhubDeploymentWorkflows.test.mjs
```

Expected: FAIL because the workflow options do not include `report-deep` and the remote validator rejects that action.

- [ ] **Step 4: Commit only after Task 2 makes the contract green**

Do not commit the red state separately. Task 2 will supply the production behavior and the combined tested commit.

### Task 2: Bounded Read-Only Workflow

**Files:**
- Modify: `.github/workflows/comhub-maintenance.yml`
- Modify: `.github/workflows/comhubDeploymentWorkflows.test.mjs` only if formatting the completed Task 1 assertions requires it.

**Interfaces:**
- Consumes: fixed dispatch action `report-deep` and production SSH secrets already used by the workflow.
- Produces: `report_deep()` in the embedded remote Bash script and bounded metadata in the workflow log.

- [ ] **Step 1: Add `report-deep` to every fixed validator**

Add the option under `workflow_dispatch.inputs.action.options`, then change all three case patterns to:

```bash
report|report-deep|cleanup-safe) ;;
```

- [ ] **Step 2: Add a bounded directory reporter**

Add this helper after `report_disk()`:

```bash
report_tree() {
  local label="$1"
  local root="$2"

  echo "== ${label} depth-two totals (bytes, top 100) =="
  if [ ! -d "$root" ]; then
    echo "directory unavailable: $root"
    return
  fi
  timeout 12m du -x -B1 --max-depth=2 -- "$root" 2>/dev/null |
    sort -nr | head -100 || true
}
```

- [ ] **Step 3: Add the deep report function**

Add a function that validates the Docker-provided root and emits only bounded metadata:

```bash
report_deep() {
  local docker_root=''
  local -a large_file_roots=()

  echo '== Mount inventory =='
  if command -v findmnt >/dev/null 2>&1; then
    findmnt -rn -o TARGET,SOURCE,FSTYPE || true
  else
    echo 'findmnt unavailable'
  fi

  echo '== Docker detailed usage =='
  docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
  printf 'Docker root: %s\n' "${docker_root:-unavailable}"
  docker system df -v || true
  docker ps -a --no-trunc --size \
    --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Size}}' || true

  report_tree '/www' /www
  report_tree '/var/log' /var/log
  report_tree '/var/cache' /var/cache

  case "$docker_root" in
    /*)
      if [ "$docker_root" != / ] && [ -d "$docker_root" ]; then
        report_tree 'Docker root' "$docker_root"
      else
        echo 'Docker root is unavailable or unsafe to scan'
      fi
      ;;
    *) echo 'Docker root is unavailable or not absolute' ;;
  esac

  for root in /www /var/log; do
    [ ! -d "$root" ] || large_file_roots+=("$root")
  done
  if [ -n "$docker_root" ] && [ "$docker_root" != / ] &&
    [ -d "$docker_root/containers" ]; then
    large_file_roots+=("$docker_root/containers")
  fi

  echo '== Files over 100 MB (bytes, top 50) =='
  if [ "${#large_file_roots[@]}" -eq 0 ]; then
    echo 'no approved large-file roots available'
  else
    timeout 8m find "${large_file_roots[@]}" -xdev -type f -size '+100M' \
      -printf '%s\t%p\n' 2>/dev/null | sort -nr | head -50 || true
  fi
}
```

- [ ] **Step 4: Invoke only the deep-report supplement for the new action**

Preserve the existing base report and cleanup branch, adding only this branch before the final report-only message:

```bash
if [ "$action" = cleanup-safe ]; then
  cleanup_safe
  sync
  echo '### After maintenance'
  report_disk
else
  if [ "$action" = report-deep ]; then
    echo '### Deep disk report'
    report_deep
  fi
  echo '### After maintenance'
  echo 'report-only action; no cleanup performed'
fi
```

- [ ] **Step 5: Run the contract test and verify GREEN**

Run:

```powershell
node .github/workflows/comhubDeploymentWorkflows.test.mjs
```

Expected: all workflow contract tests pass, including Bash syntax validation.

- [ ] **Step 6: Run workflow lint and formatting gates**

Run:

```powershell
docker run --rm -v "${PWD}:/repo" -w /repo rhysd/actionlint:latest
bunx prettier --check .github/workflows/comhub-maintenance.yml .github/workflows/comhubDeploymentWorkflows.test.mjs
git diff --check
```

Expected: all commands exit 0 with no diagnostics.

- [ ] **Step 7: Commit the tested workflow**

```powershell
git add .github/workflows/comhub-maintenance.yml .github/workflows/comhubDeploymentWorkflows.test.mjs
git commit -m "ops: add read-only deep disk report [skip ci]" \
  -m "Constraint: Fixed production input and metadata-only scans." \
  -m "Tested: workflow contracts, actionlint, Prettier, diff check."
```

### Task 3: Review, Merge, And Inventory

**Files:**
- Review: `.github/workflows/comhub-maintenance.yml`
- Review: `.github/workflows/comhubDeploymentWorkflows.test.mjs`
- Review: `docs/superpowers/specs/2026-07-16-server-disk-deep-report-design.md`
- Review: `docs/superpowers/plans/2026-07-16-server-disk-deep-report.md`

**Interfaces:**
- Consumes: verified branch containing the fixed `report-deep` action.
- Produces: a merged workflow plus a read-only production disk attribution report.

- [ ] **Step 1: Request focused independent review**

Review for production branch gating, fixed inputs, strict SSH, command injection, metadata leakage,
unbounded scans, mutation commands, and whether the tests prove `report-deep` is read-only. Resolve
all high and medium findings before continuing.

- [ ] **Step 2: Re-run final verification after review changes**

Run the Task 2 Step 5 and Step 6 commands again. Expected: all exit 0.

- [ ] **Step 3: Push and create a PR to `main`**

```powershell
git push -u comhub ops/server-disk-deep-report
gh pr create --repo maheshenga/comhub --base main --head ops/server-disk-deep-report \
  --title "ops: add read-only deep disk report [skip ci]"
```

Expected: PR is mergeable with no blocking checks or review findings.

- [ ] **Step 4: Merge without image builds**

Use a merge commit whose subject contains `[skip ci]`. Verify the merge commit starts no
`ComHub Build Images` run.

- [ ] **Step 5: Dispatch the deep report from `main`**

```powershell
gh workflow run comhub-maintenance.yml --repo maheshenga/comhub --ref main -f action=report-deep
```

Wait for a successful conclusion and collect the workflow log.

- [ ] **Step 6: Attribute remaining disk use**

Summarize root filesystem usage, `/www` top-level and second-level consumers, Docker physical and
logical storage, log consumers, files over 100 MB, and separate safe cleanup candidates from
databases, backups, active logs, and current releases. Do not dispatch `cleanup-safe` in this task.
