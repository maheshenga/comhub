# ComHub Server Disk Deep Report Design

## Context

The bounded maintenance report showed that the production root filesystem is 96% full and that
`/www` accounts for about 46.79 GB. The known ComHub deployment directory and Nginx logs account
for less than 0.2 GB, so the existing report cannot explain roughly 46.6 GB under `/www`.

## Goal

Add a reusable, strictly read-only `report-deep` maintenance action that identifies the major
directories, mounts, Docker storage, and large files responsible for production disk usage.

## Non-Goals

- Do not delete, truncate, rotate, compress, move, or modify files.
- Do not stop, restart, remove, or inspect container configuration.
- Do not query databases or read application data.
- Do not print file contents, environment variables, credentials, or arbitrary configuration.
- Do not accept arbitrary paths or shell commands as workflow inputs.

## Chosen Design

Extend the existing manual `ComHub Server Maintenance` workflow with one fixed choice:
`report-deep`. It keeps the existing `main` branch gate, `production` environment, strict SSH host
verification, 30-minute job timeout, and shared production deployment concurrency lock.

The remote script validates `report-deep` at every dispatch boundary and calls a dedicated
read-only function. Existing `report` and `cleanup-safe` behavior remains unchanged.

## Report Scope

The deep report emits bounded metadata only:

1. Filesystem and mount inventory using `df` and `findmnt`.
2. Docker root directory and detailed logical usage using `docker info --format`,
   `docker system df -v`, and `docker ps --no-trunc` with ID, name, status, and writable size.
3. Byte totals for `/www` to depth two, limited to the largest 100 entries.
4. Byte totals for `/var/log`, `/var/cache`, and the Docker root to depth two, limited to the
   largest 100 entries per root.
5. The largest 50 files over 100 MB under `/www`, `/var/log`, and the Docker container-log
   directory. Only size and path are printed.

All recursive scans stay on their starting filesystem with `-x` or `-xdev`. Individual expensive
scans use `timeout`, and missing tools or paths produce a diagnostic instead of broadening scope.

## Safety Boundaries

- The workflow input remains a fixed choice with exactly `report`, `report-deep`, and
  `cleanup-safe`.
- `report-deep` has zero mutation commands.
- Docker commands are an exact read-only allowlist for report modes.
- The existing cleanup allowlist remains unchanged.
- The script continues to reject `docker inspect`, environment output, file-content commands,
  volume/system prune, removal commands, truncation, and `find -delete`.
- Production environment branch policy remains restricted to `main` outside the workflow.

## Error Handling

Failure to establish SSH or validate the action fails the job. A missing optional reporting tool
or a timed-out subtree scan is reported and skipped so one large directory does not suppress the
rest of the inventory. The workflow never falls back to a broader path.

## Verification

Contract tests will be written first and observed failing before implementation. They will require
the new fixed input, trace `report-deep` with command stubs, assert zero mutation commands, assert
the exact Docker read-only command sequence, and retain all dangerous-command exclusions.

Final gates:

- Workflow contract tests and Bash syntax validation.
- Dockerized `actionlint`.
- Prettier formatting check.
- `git diff --check`.
- Independent focused review before merge.

The merge commit will contain `[skip ci]`. After merge, `report-deep` will be dispatched from
`main`, and its output will be summarized by directory, file class, reclaimability, and risk. No
cleanup will be performed as part of this task.
