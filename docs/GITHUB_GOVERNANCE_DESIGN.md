# ComHub GitHub Governance Design

**Date:** 2026-07-21

## Context

`maheshenga/comhub` is the public source of truth for ComHub. The repository
already has manual production and Worker deployment workflows, image builds,
and a scheduled upstream-sync workflow. Its GitHub governance is incomplete:
`main` is unprotected, there is no PR validation workflow or ruleset, only the
`production` environment exists, Dependabot security updates are disabled, and
the public repository entry documents are still upstream-oriented. The current
README contains only `comhub`.

## Goals

1. Require validated pull requests for ordinary changes to `main` while letting
   a repository administrator bypass the rule for a documented emergency.
2. Keep production deployment manual and separate from image builds; do not
   change deployment targets, server access, image tags, or payment behavior.
3. Give public contributors an accurate ComHub project, contribution, and
   vulnerability-reporting entry point.
4. Enable security feedback without exposing, reading, moving, or creating
   secret values.
5. Preserve the LobeHub upstream relationship as a reviewable sync workflow,
   not a second source of truth for ComHub issues or releases.

## Non-Goals

- No production deployment, database migration, secret rotation, or server
  modification.
- No automatic merge, automatic production deployment, preview environment, or
  replacement of the existing manual deployment workflows.
- No change to application runtime behavior, mobile behavior, billing, or
  Alipay integration.
- No mandatory independent approval, because the repository currently has a
  single administrator and that rule would block emergency maintenance.

## Options Considered

### Minimal Repository Documentation

Add a README and CODEOWNERS only. This is low effort, but direct pushes and
unverified merges remain possible. It does not establish a reliable public
contribution or release boundary.

### Governed Public Repository (Selected)

Add a fast PR validation workflow, configure a `main` branch protection rule,
create the missing staging environment, enable security feedback, and correct
the public project documents. Existing manual deployment workflows remain the
only production entry points. This protects the release branch without making
the single maintainer unable to respond to an incident.

### Strict Multi-Team Governance

Require one or more independent reviewers, code-owner approval, signed commits,
and environment reviewers. This becomes appropriate after ComHub has an
organization and a separate release team, but it would deadlock the current
single-maintainer repository.

## Design

### Pull Request Validation

Create `.github/workflows/comhub-pr-check.yml` with the workflow name
`ComHub PR Checks` and a `verify` job. It runs only for pull requests targeting
`main`, has `contents: read` permission, and uses a per-PR concurrency group.
It must not build or publish images, deploy, access environments, or reference
SSH, Alipay, or other production secrets.

The job installs dependencies with the lockfile, runs the existing deployment
workflow contract suite, and runs `bun run type-check`. The stable check name
is `ComHub PR Checks / verify`; the branch rule uses that exact name. The
workflow contract test gains assertions that the PR workflow has the intended
trigger, permissions, and no production credential references.

### Main Branch Rule

Configure GitHub branch protection for `main` through the GitHub REST API:

- Require a pull request before merging.
- Require `ComHub PR Checks / verify` to pass and be up to date.
- Require all review conversations to be resolved.
- Require linear history.
- Disallow force pushes and deletion.
- Keep restrictions unset so external contributors can open PRs.
- Keep administrator enforcement disabled so `maheshenga` retains an emergency
  bypass. Normal changes still follow the PR path.

The implementation creates the workflow and pushes its branch before applying
the required-status rule, so the protected branch never waits on a nonexistent
check.

### Environments and Secrets

Preserve `production` as a manually dispatched deployment environment and
restrict it to protected branches. Create `module-app-staging` with the same
protected-branch policy for credentialed staging probes. Neither environment
gets a reviewer requirement because the current sole maintainer cannot approve
their own deployment.

The implementation may list secret and variable names only to document missing
configuration. It never reads secret values, writes blank values, copies values
between repository and environment scopes, or prints credential material.

### Security Feedback

Enable Dependabot security updates in repository settings. Keep existing secret
scanning and push protection enabled. Add these repository workflows:

- `.github/workflows/codeql.yml`: CodeQL analysis for JavaScript/TypeScript on
  pull requests to `main`, pushes to `main`, and a weekly schedule.
- `.github/workflows/dependency-review.yml`: dependency-change review on pull
  requests to `main`.

CodeQL and dependency review report findings but are not initial required
checks. This makes their first scan observable without unexpectedly stopping
all maintenance work. They can become required after the baseline is reviewed.

### Ownership and Public Documents

Replace the upstream-only CODEOWNERS entry with ComHub ownership. The default
owner is `@maheshenga`; `.github/`, deployment configuration, database
migrations, and the upstream-sync scripts have explicit ownership entries for
clarity.

Replace the one-line README with a concise public ComHub entry page containing:

- ComHub's purpose and its independent-maintainer relationship to LobeHub.
- Feature areas that are maintained in this fork: assistant workspace, mobile
  workspace, design, community, applications, and administration.
- Supported local development commands from the existing package scripts.
- The GitHub build-to-GHCR and manual deployment boundary, without host names
  or secrets.
- Contribution, security, upstream-sync, and license links.

Update `CONTRIBUTING.md` to use `maheshenga/comhub`, the PR-to-`main` flow,
focused checks, and the retained `upstream` remote. Update `SECURITY.md` to
send reports to this repository's GitHub Security Advisory page and remove
LobeHub-specific contact and scope text.

## Delivery Flow

1. Start from `origin/main` in the isolated `codex/worktree-setup` worktree.
2. Add workflow contract coverage before the PR workflow, observe the expected
   failure, then add the smallest compliant workflow.
3. Add security workflows, ownership, and public documents.
4. Run focused workflow tests, the type check, and `git diff --check` once.
5. Commit the changes, push `codex/worktree-setup`, and open a PR to `main`.
6. Apply and re-read GitHub branch protection, environment policies, and the
   Dependabot security-update setting. Do not merge the PR or deploy.

## Acceptance Criteria

- `main` cannot be updated through an ordinary direct push, but the repository
  administrator has an explicit emergency bypass.
- A PR to `main` exposes and passes `ComHub PR Checks / verify` before merge.
- Production and staging credentialed workflows are limited to protected
  branches and remain manually initiated.
- Dependabot security updates, secret scanning, and push protection are
  enabled; CodeQL and dependency review workflows exist.
- GitHub's public README, contribution guide, security policy, and CODEOWNERS
  identify ComHub and `@maheshenga`, not LobeHub as the maintainer endpoint.
- No secret values, deployment host details, runtime application behavior, or
  production state are changed.

## Verification

Run exactly one focused verification round:

```powershell
node --test .github/workflows/comhubDeploymentWorkflows.test.mjs
bun run type-check
git diff --check
```

Then use authenticated read-only GitHub API calls to confirm the branch rule,
both environment policies, Dependabot security updates, and workflow presence.
