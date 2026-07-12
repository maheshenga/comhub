# Module App Independent Compose Worker Design

## Status

- Date: 2026-07-13
- Scope: close the reviewed Module App v2 package path from queued build to verified S3 artifact and atomically materialized runtime files.
- Deployment: one independent Compose worker under the existing `/www/compose/comhub` production layout.
- Production default: all Module App public execution, runtime invocation, privileged workflow, payment creation, automatic settlement, and payout recording switches remain disabled.

## Objective

Deploy a dedicated `module-app-worker` service that can safely and idempotently turn an approved manifest v2 package into a ready, content-addressed runtime artifact without executing package-provided code.

The completed path is:

1. An administrator approves a clean manifest v2 package.
2. Approval creates a queued build in PostgreSQL.
3. The worker leases the build, downloads the reviewed ZIP from S3, and verifies the source digest.
4. The worker performs an offline deterministic artifact assembly.
5. The worker uploads a deterministic `.tgz` artifact to the existing build staging key.
6. Existing server-side artifact verification promotes it to a content-addressed S3 key.
7. The worker safely materializes the artifact at `<artifactRoot>/<artifactSha256>`.
8. Only after S3 promotion and local materialization succeed does the build become `ready`.

This phase deploys module artifacts to the server but does not publish or publicly execute them.

## Non-Goals

- Enabling any Module App production mutation or execution flag.
- Installing npm, PyPI, or system dependencies during a build.
- Running `package.json` scripts, shell commands, Python setup hooks, or package-selected commands.
- Supporting package-selected images, build containers, mounts, or network policies.
- Adding a public Worker API.
- Implementing immutable application version upgrades or rollback.
- Completing personal/workspace installation or Alipay browser flows.
- Replacing S3, PostgreSQL, GHCR, Baota, or the existing main application blue-green deployment.

## Deployment Boundary

The worker is an independent Compose project:

- Production directory: `/www/compose/comhub/module-worker`
- Compose project name: `comhub-module-worker`
- Image: `ghcr.io/<owner>/comhub-module-worker:sha-<commit>`
- Initial replica count: one
- Public ports: none
- Nginx routing: none
- Main application traffic switching: none

GitHub Actions builds and pushes the worker image. Deployment requires an explicit `workflow_dispatch` input and never runs on a normal push to `main`.

The worker may be deployed or rolled back independently from the main application and `module-runtime`. Its additive database migration must remain backward-compatible with the previous application and worker images.

## Architecture

The single worker process contains four bounded components.

### Build Claimer

The claimer uses PostgreSQL as the authoritative queue. It atomically leases one eligible build with `FOR UPDATE SKIP LOCKED` and records:

- `workerId`
- `claimToken`
- `claimExpiresAt`
- `attemptCount`
- `nextAttemptAt`

The worker renews the lease while processing. A different worker may reclaim the build only after lease expiry. All heartbeat, completion, retry, and failure mutations must match the active `claimToken`.

### Offline Artifact Builder

The builder downloads only the reviewed package object referenced by the claimed build. It must:

- Verify the ZIP SHA-256 against `sourceSha256`.
- Re-run archive metadata, path, size, file-count, compression-ratio, encryption, symlink, executable-content, nested-archive, and malware-signature checks.
- Parse exactly one root `module-app.yaml` manifest v2 file.
- Verify that the declared `build.frontend.output` exists and contains an `index.html`, or is an HTML file itself.
- Verify every declared Node.js and Python function entry exists as a regular file.
- Reject symbolic links, hard links, device files, sockets, FIFOs, absolute paths, empty path segments, and parent traversal.
- Refuse all dependency installation and package-defined scripts.

The builder performs no package-controlled network request and starts no package-controlled process.

### Artifact Publisher

The publisher creates a deterministic `.tgz`:

- Entries use normalized POSIX paths and lexical ordering.
- User and group IDs are zeroed.
- User and group names are empty.
- Timestamps use a fixed epoch.
- Directories use mode `0555`; regular files use mode `0444`.
- Gzip metadata is deterministic.

The SHA-256 of the exact `.tgz` bytes is the artifact identity. The worker uploads only to the build-scoped staging key already enforced by `ModuleAppBuildStorageService`. The server re-reads the staging object, verifies bounded size and SHA-256, and promotes it to the existing content-addressed S3 key.

### Local Materializer

The materializer downloads the promoted `.tgz`, verifies its SHA-256, and extracts it under:

```text
<artifactRoot>/.staging/<buildId>-<claimToken>
```

Extraction repeats the path and file-type checks. The worker verifies the declared frontend output and function entries in the extracted tree, applies read-only permissions, fsyncs files and directories where supported, and atomically renames the staging directory to:

```text
<artifactRoot>/<artifactSha256>
```

If the destination already exists, the worker validates its marker and manifest metadata and reuses it. A partial or mismatched destination fails closed. `module-runtime` mounts `<artifactRoot>` read-only.

## Build State And Retry Model

The existing public build states remain:

```text
queued -> building -> ready
                   -> failed
```

The migration adds lease and retry metadata without adding a new public status.

Retry policy:

- Maximum attempts: 3.
- Retry delays: 30 seconds, 2 minutes, then 10 minutes.
- Retryable: temporary PostgreSQL, S3, upload, download, or filesystem availability failures.
- Permanent: invalid archive, source hash mismatch, manifest mismatch, missing declared output, unsafe file type, artifact hash mismatch, or policy violation.

A retryable failure clears the active lease, sets `nextAttemptAt`, and returns the build to `queued`. A permanent error or exhausted retry budget records a bounded failure code and moves the build to `failed`.

The design is idempotent across these crash points:

- Source downloaded but not assembled.
- Artifact uploaded but not promoted.
- Artifact promoted but not materialized.
- Artifact materialized but build completion not committed.

Content-addressed S3 keys and local directories are reused after successful verification.

## Container Security

The worker container must use:

- UID/GID `10001:10001`.
- `read_only: true`.
- `cap_drop: [ALL]`.
- `security_opt: [no-new-privileges:true]`.
- A bounded `/tmp` tmpfs with `noexec` and `nosuid`.
- No Docker Socket.
- No privileged mode.
- A single read-write artifact-root bind mount.

The worker requires PostgreSQL and configured S3 access for platform operations. Package contents cannot choose destinations, URLs, commands, credentials, or network requests.

Secrets are supplied through the existing production environment management and are never included in image layers, logs, build failure messages, or artifact metadata.

## Health And Operations

The worker exposes no network health endpoint. Its container health command checks:

- The worker event loop is alive.
- PostgreSQL is reachable.
- The artifact root exists and permits a create/fsync/remove probe under `.health`.
- The last successful queue poll is within a bounded interval.

Operational metrics must cover:

- Queue depth and oldest queued age.
- Claims, lease renewals, lease recoveries, and lease conflicts.
- Build duration and outcome.
- Retry count and permanent failure code.
- Artifact bytes and materialization duration.
- Stale staging cleanup count and failure count.

The worker periodically removes stale staging directories that are older than their build lease and not referenced by an active claim. It never deletes content-addressed ready artifacts in this phase.

## Deployment And Rollback

GitHub Actions must:

1. Run the worker unit and integration tests.
2. Build the worker image for `linux/amd64`.
3. Push immutable SHA tags to GHCR.
4. Run container security probes against the built image.
5. Leave deployment skipped unless explicitly requested.

Manual deployment must:

1. Pull the exact worker image reference.
2. Render and validate the independent Compose configuration.
3. Start or replace only `module-app-worker`.
4. Verify UID, read-only root, dropped capabilities, no Docker Socket, artifact mount mode, database access, and health status.
5. Verify every Module App production mutation flag remains false.

Rollback replaces only the worker image. It does not switch application traffic and does not delete S3 or local content-addressed artifacts.

## Testing Strategy

### Unit Tests

- Identical input produces byte-identical `.tgz` output and SHA-256.
- Unsafe paths and non-regular file types are rejected.
- Missing frontend output, `index.html`, or function entries are rejected.
- Package scripts and dependency declarations are never executed.
- Retry classification and bounded failure codes are stable.
- Existing materialized artifacts are reused only after verification.

### PostgreSQL Integration Tests

- Concurrent workers claim a build exactly once.
- Active leases renew only with the correct token.
- Expired leases are reclaimable.
- Stale workers cannot complete or fail a reclaimed build.
- Attempts stop after the configured limit.
- Ready builds remain immutable.

### Storage And Materialization Tests

- The reviewed source key is the only accepted source.
- The staging artifact key is build-scoped.
- Source, staging, promoted, and materialized SHA-256 values agree.
- Tampered source or artifact bytes fail without publishing a runtime directory.
- Extraction cannot escape the staging directory.
- Final files and directories are read-only.
- Crash recovery reuses verified content-addressed artifacts.

### Real Container Gate

- Run a real worker container against isolated PostgreSQL and S3-compatible test services.
- Process a representative manifest v2 ZIP from `queued` to `ready`.
- Confirm `<artifactRoot>/<sha>/dist/index.html` exists and is read-only.
- Confirm `module-runtime` can serve the materialized static asset through its existing artifact route.
- Confirm the worker runs as UID 10001 with read-only root and no Docker Socket.
- Confirm all Module App execution and payment mutation flags remain disabled.

## Acceptance Criteria

- An approved clean v2 package progresses automatically from `queued` to `ready`.
- The source ZIP, promoted S3 artifact, database artifact identity, and local materialized artifact are cryptographically linked.
- The runtime can read the artifact while remaining unable to modify it.
- Worker crashes, duplicate workers, stale leases, duplicate callbacks, and retries do not create conflicting ready artifacts.
- Tampered or structurally unsafe packages fail closed.
- Pushes to `main` build and verify the worker but never deploy it automatically.
- Deploying the worker does not enable public Module App launch, runtime invocation, privileged workflows, Alipay payment creation, automatic settlement, or payout recording.
- Existing Module App production verification remains green.
