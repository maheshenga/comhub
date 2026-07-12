# P0 Deployment Version Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/version` expose safe deployment metadata so production can be verified against the expected commit and image tag after deploy.

**Architecture:** Reuse the existing public `/api/version` route and extend its response with non-secret build metadata from environment variables. Inject those variables into the Docker image through GitHub Actions build args and Dockerfile `ENV` values. Do not change auth, database, traffic switching, or deploy scripts in this slice.

**Tech Stack:** Next.js App Router route handler, TypeScript, Vitest, Docker, GitHub Actions.

## Global Constraints

- Do not use subagents for this execution.
- Use TDD for the route response and metadata normalization.
- Only expose non-secret metadata: package version, commit SHA, short SHA, branch, build timestamp, image tag, image ref, deployment id.
- Do not expose tokens, registry credentials, SSH host/user, or runtime secrets.
- Do not deploy or push unless explicitly requested after commit.
- Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md`.

---

## File Structure

- Modify `src/app/(backend)/api/version/route.ts`: add safe metadata resolver and extend response.
- Create `src/app/(backend)/api/version/route.test.ts`: cover metadata priority, fallback, and GET response.
- Modify `Dockerfile`: accept `COMHUB_*` build args in final image and persist them as environment variables.
- Modify `.github/workflows/comhub-deploy.yml`: pass GitHub SHA/ref/image tag/build timestamp into Docker build args.
- Modify `docs/DEPLOYMENT_VERSION_PROBE.md`: document the live `/api/version` evidence.
- Modify `docs/CHANGELOG_INTERNAL.md` and `docs/FEATURE_REGISTRY.md`: record GOV-027.

## Task 1: Red Test For Version Metadata

**Files:**
- Create: `src/app/(backend)/api/version/route.test.ts`

**Interfaces:**
- Consumes: `getVersionMetadata(env)` and `GET()` from `route.ts`.
- Produces: failing tests requiring deployment metadata in `/api/version`.

- [ ] **Step 1: Add the failing test file**

```ts
import { describe, expect, it, vi } from 'vitest';

import { GET, getVersionMetadata } from './route';

describe('/api/version', () => {
  it('normalizes safe ComHub deployment metadata', () => {
    expect(
      getVersionMetadata({
        COMHUB_BUILD_AT: ' 2026-07-07T01:02:03Z ',
        COMHUB_BUILD_BRANCH: ' feat/p1-commercial-ai-admin-hardening ',
        COMHUB_COMMIT_SHA: 'abcdef1234567890',
        COMHUB_IMAGE_REF: 'ghcr.io/example/comhub:sha-abcdef123456',
        COMHUB_IMAGE_TAG: 'sha-abcdef123456',
      }),
    ).toEqual({
      branch: 'feat/p1-commercial-ai-admin-hardening',
      buildAt: '2026-07-07T01:02:03Z',
      commitSha: 'abcdef1234567890',
      commitShortSha: 'abcdef123456',
      deploymentId: null,
      imageRef: 'ghcr.io/example/comhub:sha-abcdef123456',
      imageTag: 'sha-abcdef123456',
    });
  });

  it('falls back to GitHub and Vercel metadata names', () => {
    expect(
      getVersionMetadata({
        GITHUB_REF_NAME: 'main',
        GITHUB_SHA: '1234567890abcdef',
        VERCEL_DEPLOYMENT_ID: 'dpl_123',
      }),
    ).toMatchObject({
      branch: 'main',
      commitSha: '1234567890abcdef',
      commitShortSha: '1234567890ab',
      deploymentId: 'dpl_123',
    });
  });

  it('returns package version with deployment metadata from GET', async () => {
    vi.stubEnv('COMHUB_COMMIT_SHA', 'fedcba9876543210');
    vi.stubEnv('COMHUB_BUILD_BRANCH', 'canary');
    vi.stubEnv('COMHUB_IMAGE_TAG', 'sha-fedcba987654');

    const response = await GET();
    const data = await response.json();

    expect(data).toMatchObject({
      branch: 'canary',
      commitSha: 'fedcba9876543210',
      commitShortSha: 'fedcba987654',
      imageTag: 'sha-fedcba987654',
      version: expect.any(String),
    });

    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bunx vitest run --silent='passed-only' "src/app/(backend)/api/version/route.test.ts"
```

Expected: FAIL because `getVersionMetadata` is not exported and `/api/version` only returns `version`.

## Task 2: Implement Version Metadata

**Files:**
- Modify: `src/app/(backend)/api/version/route.ts`

**Interfaces:**
- Produces: `getVersionMetadata(env?: NodeJS.ProcessEnv | Record<string, string | undefined>)`.
- Produces: `VersionResponseData` with `version` and safe deployment metadata fields.

- [ ] **Step 1: Add metadata resolver and extend GET**

```ts
type MetadataEnv = Record<string, string | undefined>;

const clean = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const getVersionMetadata = (env: MetadataEnv = process.env) => {
  const commitSha =
    clean(env.COMHUB_COMMIT_SHA) ||
    clean(env.GITHUB_SHA) ||
    clean(env.VERCEL_GIT_COMMIT_SHA) ||
    clean(env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA);

  return {
    branch:
      clean(env.COMHUB_BUILD_BRANCH) ||
      clean(env.GITHUB_REF_NAME) ||
      clean(env.VERCEL_GIT_COMMIT_REF),
    buildAt: clean(env.COMHUB_BUILD_AT),
    commitSha,
    commitShortSha: commitSha ? commitSha.slice(0, 12) : null,
    deploymentId: clean(env.COMHUB_DEPLOYMENT_ID) || clean(env.VERCEL_DEPLOYMENT_ID),
    imageRef: clean(env.COMHUB_IMAGE_REF),
    imageTag: clean(env.COMHUB_IMAGE_TAG),
  };
};
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
bunx vitest run --silent='passed-only' "src/app/(backend)/api/version/route.test.ts"
```

Expected: PASS.

## Task 3: Inject Build Metadata Into Docker Image

**Files:**
- Modify: `Dockerfile`
- Modify: `.github/workflows/comhub-deploy.yml`

**Interfaces:**
- Consumes GitHub Actions values: `github.sha`, `github.ref_name`, `steps.image.outputs.image_tag`, `steps.image.outputs.image_ref`, and a UTC build timestamp.
- Produces runtime env vars: `COMHUB_COMMIT_SHA`, `COMHUB_BUILD_BRANCH`, `COMHUB_BUILD_AT`, `COMHUB_IMAGE_TAG`, `COMHUB_IMAGE_REF`.

- [ ] **Step 1: Add Dockerfile final-stage args and env**

```dockerfile
ARG COMHUB_COMMIT_SHA=""
ARG COMHUB_BUILD_BRANCH=""
ARG COMHUB_BUILD_AT=""
ARG COMHUB_IMAGE_TAG=""
ARG COMHUB_IMAGE_REF=""

ENV COMHUB_COMMIT_SHA="${COMHUB_COMMIT_SHA}" \
    COMHUB_BUILD_BRANCH="${COMHUB_BUILD_BRANCH}" \
    COMHUB_BUILD_AT="${COMHUB_BUILD_AT}" \
    COMHUB_IMAGE_TAG="${COMHUB_IMAGE_TAG}" \
    COMHUB_IMAGE_REF="${COMHUB_IMAGE_REF}"
```

- [ ] **Step 2: Add workflow build metadata step and build args**

```yaml
- name: Resolve build metadata
  id: build_meta
  shell: bash
  run: |
    set -euo pipefail
    echo "build_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> "$GITHUB_OUTPUT"
```

Add to `docker/build-push-action` `build-args`:

```yaml
COMHUB_COMMIT_SHA=${{ github.sha }}
COMHUB_BUILD_BRANCH=${{ github.ref_name }}
COMHUB_BUILD_AT=${{ steps.build_meta.outputs.build_at }}
COMHUB_IMAGE_TAG=${{ steps.image.outputs.image_tag }}
COMHUB_IMAGE_REF=${{ steps.image.outputs.image_ref }}
```

## Task 4: Governance Docs

**Files:**
- Modify: `docs/DEPLOYMENT_VERSION_PROBE.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

- [ ] **Step 1: Document `/api/version` fields**

Add a section describing `version`, `commitSha`, `commitShortSha`, `branch`, `buildAt`, `imageTag`, `imageRef`, and `deploymentId`.

- [ ] **Step 2: Add GOV-027 changelog and registry notes**

Record the route test and `git diff --check` verification.

## Task 5: Verification, Review, And Commit

- [ ] **Step 1: Run focused test**

```bash
bunx vitest run --silent='passed-only' "src/app/(backend)/api/version/route.test.ts"
```

- [ ] **Step 2: Run diff check**

```bash
git diff --check
```

- [ ] **Step 3: Review diff**

```bash
git diff -- src/app/(backend)/api/version/route.ts src/app/(backend)/api/version/route.test.ts Dockerfile .github/workflows/comhub-deploy.yml docs/DEPLOYMENT_VERSION_PROBE.md docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(backend)/api/version/route.ts src/app/(backend)/api/version/route.test.ts Dockerfile .github/workflows/comhub-deploy.yml docs/DEPLOYMENT_VERSION_PROBE.md docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git add -f docs/superpowers/plans/2026-07-07-p0-deployment-version-probe.md
git commit -m ":mag: expose deployment version metadata"
```

## Self-Review

- Spec coverage: Covers the P0 deployment observability slice without changing deploy strategy.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: `VersionResponseData`, `getVersionMetadata`, and Docker/GitHub env names match across route, tests, Dockerfile, and workflow.
