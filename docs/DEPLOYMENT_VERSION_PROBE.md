# Deployment Version Probe

Date: 2026-07-07

Purpose: prevent production from appearing to roll back or miss newly deployed features.

## Required Evidence Before Deploy

- Git commit SHA to deploy.
- Git branch.
- CI workflow run URL.
- Container image tag and digest.
- Build artifact timestamp.
- Expected public behavior changes.
- Rollback target SHA and image digest.

## Required Evidence After Deploy

- `/health` or equivalent application health endpoint responds from the active container.
- `/api/version` returns the expected `commitSha`, `commitShortSha`, `branch`, `buildAt`, `imageTag`, and `imageRef`.
- Production container image digest matches the CI output.
- SPA HTML references the new asset hash.
- Admin app settings page loads.
- `/settings/plans`, `/settings/credits`, `/settings/billing`, `/settings/usage`, and `/settings/referral` load for a test account.
- Brand loading SVG/fav icon/brand name are checked after a hard refresh.
- Desktop public update config is checked without exposing OSS credentials.

## Baota Deployment Boundary

Production should keep the established blue-green scheme:

- GitHub Actions builds and pushes GHCR images.
- Production host deploy directory: `/www/compose/comhub`.
- Baota handles only Nginx and certificates.
- Application state is separated from images.
- Traffic switching goes through `deploy.sh`.
- Rollback goes through `rollback.sh`.

Do not replace this with direct Baota file upload or ad hoc manual traffic switching unless the deployment strategy is explicitly changed.

## `/api/version` Probe

The public `/api/version` route is safe for post-deploy verification. It must not expose secrets.

Expected fields:

| Field | Meaning |
| --- | --- |
| `version` | `package.json` app version. |
| `commitSha` | Full Git commit SHA injected at image build time, or fallback CI/Vercel commit env. |
| `commitShortSha` | First 12 characters of `commitSha`, matching the default `sha-*` image tag length. |
| `branch` | Git branch/ref name injected at build time. |
| `buildAt` | UTC image build timestamp from GitHub Actions. |
| `imageTag` | Docker image tag selected by the workflow, for example `sha-abcdef123456`. |
| `imageRef` | Full image reference selected by the workflow. |
| `deploymentId` | Optional platform deployment id, when provided by the runtime environment. |

Example:

```bash
curl -k -sS https://chat.qingyouai.com/api/version
```

## Smoke Record Template

```text
Date:
Operator:
Branch:
Commit SHA:
API version result:
Image digest:
Deploy script output:
Active container:
SPA asset hash:
Health result:
Brand smoke:
Commercial pages smoke:
Admin settings smoke:
Rollback target:
Notes:
```

## Failure Triage

If production still shows old behavior:

1. Compare the active container digest with the CI digest.
2. Check whether Nginx points to the expected blue or green upstream.
3. Hard refresh and bypass browser cache.
4. Check whether the SPA asset hash changed.
5. Check whether the runtime setting cache needs refresh.
6. Verify database values for app settings that drive the feature.
7. Roll back only after recording the active SHA/digest mismatch or runtime error evidence.
