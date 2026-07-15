# ComHub Split Deployment Pipeline Design

**Status:** Approved on 2026-07-16

## Problem

The current `.github/workflows/comhub-deploy.yml` combines verification, three image builds, main application deployment, and Module App Worker deployment. A Worker-only deployment therefore waits for the main application and Module Runtime images even when a change only touches Worker deployment assets. A merge to `main` also starts a build run, while a later manual Worker deployment starts the same build graph again.

Recent Worker deployment fixes changed only `docker-compose/deploy/module-worker/deploy.sh` and its tests. Nevertheless, each production retry ran the full production gate and rebuilt all three images. Successful historical runs show that the main image dominates the build duration while the Worker image is normally served from cache in seconds.

## Goals

- Build each commit's production images once and reuse them for deployment.
- Keep main application deployment manual and disabled by default.
- Give main application and Worker deployments separate manual workflows.
- Deploy registry digests rather than relying on mutable `sha-*` tags.
- Run Worker-specific verification for Worker deployment.
- Preserve the existing Baota blue-green main deployment and independent Compose Worker release layout.
- Keep production deployments serialized and non-cancellable.
- Make build runs cancellable when a newer commit supersedes them.

## Non-Goals For Phase 1

- Do not change `/www/compose/comhub` or `/www/compose/comhub/module-worker`.
- Do not replace the existing main application blue-green deployment script.
- Do not enable credentialed Module App probes by default.
- Do not remove the current migration repair or Docker image pruning yet.
- Do not deploy, merge, or push as part of the local implementation.

## Workflow Architecture

### Build And Publish

`.github/workflows/comhub-build.yml` owns verification and image publication. It runs on pushes to the established build branches and by manual dispatch. It performs the existing required Module App production gate, optionally performs credentialed probes, and publishes the main, Module Runtime, and Module Worker images under deterministic `sha-<12>` tags.

The build timestamp embedded in the main image is derived from the commit timestamp, not the workflow start time. Rebuilding the same commit therefore does not intentionally create different application metadata.

Build concurrency is scoped by Git ref with `cancel-in-progress: true`. This workflow never changes production state.

### Main Application Deployment

`.github/workflows/comhub-deploy.yml` becomes a manual-only main deployment workflow. It accepts an optional full commit SHA, defaults to the selected workflow ref's SHA, and verifies that the requested commit belongs to `origin/main`.

The workflow resolves the existing main and Module Runtime `sha-*` tags to registry digests. Missing images fail before SSH access. The existing remote blue-green deployment, smoke checks, and production environment protection remain unchanged.

### Module App Worker Deployment

`.github/workflows/comhub-deploy-worker.yml` is manual-only. It validates the requested source commit, installs dependencies with the lockfile enforced, runs `pnpm verify:module-app-worker`, and executes the standalone Worker deployment contract tests.

The workflow resolves the existing Worker image tag to a registry digest before SSH access. It then uses the existing release-directory promotion, lock, rollback, health, and container-hardening checks. Main application deployment is not present in this workflow.

### Shared Deployment Rules

Both deployment workflows use the `production` environment and the shared `comhub-production-deploy` concurrency group with `cancel-in-progress: false`. Main and Worker releases therefore cannot mutate the shared host concurrently.

SSH host verification uses the pinned `COMHUB_SSH_KNOWN_HOSTS` secret in both workflows. Live `ssh-keyscan` output is not trusted for production deployment.

## Release Identity

The operator selects a source commit. The workflow derives `sha-<first 12 characters>` only as the registry lookup tag and release label. Before deployment, the tag is resolved to `repository@sha256:<64 hex characters>`. The digest reference is what Compose and the remote deployment scripts receive.

The Worker deployment script continues accepting historical `sha-*` references for rollback compatibility, but new deployments use digest references. The recorded previous image may therefore contain either legacy tag form or digest form during migration.

## Failure Handling

- Invalid or non-main source commits fail before verification and SSH access.
- Missing or malformed image manifests fail before SSH access.
- Failed Worker verification prevents deployment.
- Existing remote release locking, atomic `current` promotion, rollback, and diagnostics remain authoritative.
- A failed deployment can be retried with the same digest without rebuilding images.

## Test Strategy

- A workflow contract test parses all three YAML files and verifies trigger, dependency, concurrency, target-specific gate, and no-rebuild invariants.
- Unit tests cover image tag validation and digest resolution without registry access.
- Existing Worker Compose and shell tests cover tag and digest deployment references.
- YAML parsing, shell syntax, focused Node tests, `git diff --check`, and the existing Worker deployment tests form the local verification gate.

## Follow-Up Phases

After the split workflow is stable, move database migration to an explicit migration stage, move broad image pruning to threshold-based maintenance, retain the current and previous image digests deliberately, and narrow the Module Worker Docker build context. These changes are intentionally excluded from phase 1 because they alter production recovery behavior.
