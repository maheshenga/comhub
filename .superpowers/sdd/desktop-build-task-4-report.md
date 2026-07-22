# Task 4: Audited Desktop Release Dispatch Report

## Scope

Implemented explicit, server-driven GitHub Actions dispatch for frozen desktop build releases. The implementation is limited to the Task 4 release path and its command/audit catalog support. Draft saving remains a separate operation and never invokes the dispatch service.

## Design And State Flow

1. `createDesktopRelease` requires `systemWrite` and validates Task 1's `desktopReleaseInputSchema`.
2. It loads the current draft, revalidates the complete asset manifest and payload, then calls `DesktopBuildModel.freezeDraftForRelease`. That existing model API owns the transactional immutable revision/release creation, stable-version uniqueness, and locked-identity recheck.
3. The queued release is then handled inside `runRequiredAdminAuditExternalEffect`.
4. The external effect invokes only `comhub-desktop-release.yml`, using the frozen release ID. A successful GitHub response is followed by the model's only `queued -> building` transition, `markReleaseDispatched`.
5. A GitHub dispatch failure is recorded as `failed` through `markReleaseResult` before it is rethrown to the required audit wrapper. A later persistence failure is intentionally not caught or transformed.

## GitHub Dispatch Contract

- Default endpoint: `https://api.github.com/repos/maheshenga/comhub/actions/workflows/comhub-desktop-release.yml/dispatches`
- Environment token: `DESKTOP_RELEASE_GITHUB_TOKEN`
- Repository/ref fallbacks: `maheshenga/comhub` and `main`
- Fixed request headers include GitHub API media/version headers, a service user agent, bearer authorization, and JSON content type.
- Request payload contains `ref` and `inputs.channel`, `inputs.release_id`, `inputs.release_notes`, and `inputs.version`.
- Uses an `AbortController` with a 10-second timeout and clears the timer in `finally`.
- Failures expose a bounded static summary containing only the HTTP status when available. Response bodies are not read, so GitHub error details, tokens, and release notes cannot enter errors or audits.
- The caller never dispatches a manual workflow payload without `release_id`; manual workflow dispatch compatibility remains in the workflow itself.

## Audit And Confidentiality

- Added catalogued `desktop.release.dispatch`, guarded by `systemWrite`, as a high-severity external effect.
- Start, success, and failure audit records contain only `profileId`, frozen `revisionId`, `releaseId`, `channel`, and `version`.
- Release notes, token values, storage credentials, signed URLs, and GitHub response bodies are omitted from audit payloads and dispatch error summaries.

## Test-Driven Development Evidence

### RED

`bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts`

Failed as intended before implementation: `Cannot find module './github' imported from .../github.test.ts`.

The command-catalog contract was also added before its catalog definition and failed as intended under the package config: `expected ... "desktop.release.dispatch" ... received` without that command ID.

### GREEN

Focused coverage verifies:

- Fixed workflow URL, default ref, exact input payload, headers, and repository/ref overrides.
- Missing token behavior, 10-second abort cleanup, non-2xx bounded redaction, and no token/release-note leakage.
- `systemWrite` authorization, strict release input validation, complete final-asset validation, transactional freeze before dispatch, identity-lock/duplicate-version rejection propagation, success transition, dispatch-failure persistence, and audit payload/status behavior.
- Client service forwarding and command-catalog/router parity.

## Final Verification

- `bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts src/services/adminCommercial.test.ts`: 30 passed.
- `bunx vitest run --config packages/types/vitest.config.mts --silent='passed-only' packages/types/src/adminCommand.test.ts`: 3 passed.
- `bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts`: 18 passed.
- `bunx tsgo --noEmit --pretty false`: passed.
- Targeted ESLint and Prettier checks: passed.
- `git diff --check`: passed.

## Self-Review

Reviewed the final diff against `.agents/skills/review-checklist/SKILL.md`. No console output, hardcoded credentials, user-facing localization changes, desktop route changes, migrations, or cloud public-route changes were introduced. The additional command-catalog files are required so the router's audit action is typed and parity-checked.

## Deliberate Non-Scope

- No workflow YAML changes, manual workflow behavior changes, build execution, deployment, push, merge, or Task 5 work.
- No full test suite was run.
