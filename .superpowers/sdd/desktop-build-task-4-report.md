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

## Review Remediation: Lifecycle And Frozen-Draft Binding

### Lifecycle Correction

The durable `queued -> building` transition now occurs inside the required external-effect audit callback before the GitHub dispatch call. A transition failure prevents GitHub from being called, leaving the release queued and retryable. Once GitHub accepts the request, there is no further release-state write: the pre-existing durable `building` record remains authoritative even if the process exits immediately afterward. GitHub failures after the transition are still persisted as `failed` with the bounded dispatch summary; a failure while persisting that terminal state is not caught or replaced inside the external effect.

### Frozen-Draft Binding

`DesktopBuildModel.freezeDraftForRelease` now requires `expectedDraftRevisionId`. Under its existing profile lock and database transaction, it rejects a current-draft mismatch with `DESKTOP_BUILD_DRAFT_CHANGED` before it creates a frozen revision or queued release. The router passes the exact revision ID whose payload and assets it revalidated, preventing a concurrent draft save from dispatching an unvalidated revision.

### RED Evidence

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts
bunx vitest run --config packages/database/vitest.config.mts --silent='passed-only' packages/database/src/models/desktopBuild.test.ts
```

Result before implementation: router test file had 4 expected failures (missing expected revision ID, GitHub called after a transition failure, incorrect lifecycle order, and missing pre-dispatch transition); the PGlite model test had 1 expected failure because a stale expected draft ID still froze the newer draft.

### GREEN Evidence

The same commands after implementation passed: router 19/19 and PGlite model 20/20. Coverage includes `freeze -> building -> GitHub`, transition-failure no-dispatch, GitHub-failure-after-building persisted as failed, terminal persistence failure propagation, audit `started`/`succeeded`/`failed` status checks without secret/release-note leakage, and a real PGlite stale-draft mismatch with no release created.

### Final Verification Commands And Results

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts src/services/adminCommercial.test.ts
# Result: 30 passed.

bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts
# Result: 21 passed.

bunx vitest run --config packages/database/vitest.config.mts --silent='passed-only' packages/database/src/models/desktopBuild.test.ts
# Result: 20 passed (real PGlite model test).

bunx tsgo --noEmit --pretty false
# Result: passed.

bunx eslint packages/database/src/models/desktopBuild.ts packages/database/src/models/desktopBuild.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts
# Result: passed.

bunx prettier --check packages/database/src/models/desktopBuild.ts packages/database/src/models/desktopBuild.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts
# Result: passed after mechanical formatting.

git diff --check
# Result: passed.
```

## Re-Review Remediation: Ambiguous GitHub Delivery

`DesktopReleaseDispatchError` now carries a typed `delivery` classification. Missing-token validation and received non-2xx GitHub responses are `definitive`; timeout/abort and transport/no-response failures are `ambiguous`. All error summaries remain static and bounded. The dispatcher never reads response bodies or propagates raw transport messages.

The router preserves the durable `building` release for ambiguous errors and rethrows to the required audit wrapper, which records the failed/unknown outcome without terminalizing the release. It persists `failed` only for errors explicitly classified as definitive. Unknown error shapes are treated as ambiguous by default.

### RED Evidence

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts
```

Result before implementation: GitHub dispatch had 4 expected failures because no error carried a delivery classification. Router coverage had 2 expected failures because timeout and transport errors incorrectly called `markReleaseResult({ status: 'failed' })` after the durable building transition.

### GREEN Evidence

The same focused tests passed after implementation: GitHub dispatch 6/6 and router 22/22. Coverage proves timeout abort cleanup and generic transport failure retain `building` and do not call `markReleaseResult`; received non-2xx and missing-token errors are definitive and persist a bounded `failed` result. Tests also retain the frozen-draft binding, `freeze -> building -> GitHub` ordering, required terminal audit records, and token/release-note exclusion from error and audit assertions.

### Final Verification Commands And Results

```powershell
bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts src/services/adminCommercial.test.ts
# Result: 31 passed.

bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts
# Result: 24 passed.

bunx tsgo --noEmit --pretty false
# Result: passed.

bunx eslint apps/server/src/services/desktopRelease/github.ts apps/server/src/services/desktopRelease/github.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts
# Result: passed.

bunx prettier --check apps/server/src/services/desktopRelease/github.ts apps/server/src/services/desktopRelease/github.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts
# Result: passed.

git diff --check
# Result: passed.
```

## Final Review Remediation: Audit-Gated Release Creation

`createDesktopRelease` now generates the frozen revision and release UUIDs on the server after validating the current draft and before any effect is entered. It starts the required `desktop.release.dispatch` external-effect audit before any durable release mutation. The effect then runs `DesktopBuildModel.freezeDraftForRelease` inside `runRequiredAdminAuditMutation` under the new high-severity `desktop.release.create` action. The creation audit and frozen-revision/queued-release inserts share one transaction, including the profile lock, exact expected draft revision check, identity lock, and unique version enforcement.

The creation and dispatch audits use the same final IDs and contain only `profileId`, `revisionId`, `releaseId`, `channel`, and `version`. They contain no release notes, tokens, URLs, asset manifests, credentials, or error bodies. The durable ordering is now `dispatch audit started -> creation audit transaction/freeze+queue -> building -> GitHub`. Definitive GitHub failures still persist `failed`; ambiguous delivery remains durable `building` for callback reconciliation.

### RED Evidence

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts
# Result before implementation: 5 failed, 19 passed. The new regressions showed freeze occurring before external audit start, no creation audit transaction, and no server-generated IDs.

bunx vitest run --config packages/database/vitest.config.mts --silent='passed-only' packages/database/src/models/desktopBuild.test.ts -t "rolls back a frozen revision and queued release when the required creation audit transaction fails"
# Result with transaction-scoped freeze intentionally removed: 1 failed, 20 skipped. The PGlite test timed out at 5 seconds due to the nested independent transaction, proving the freeze must use the supplied transaction.
```

### GREEN Evidence

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts packages/business-server/src/lambda-routers/admin/audit.test.ts
# Result: 43 passed.

bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts src/services/adminCommercial.test.ts
# Result: 31 passed.

bunx vitest run --config packages/database/vitest.config.mts --silent='passed-only' packages/database/src/models/desktopBuild.test.ts
# Result: 21 passed, including the real PGlite rollback assertion.

bunx vitest run --config packages/types/vitest.config.mts --silent='passed-only' packages/types/src/adminCommand.test.ts
# Result: 3 passed.

bunx vitest run --config packages/database/vitest.config.mts --silent='passed-only' packages/database/src/models/desktopBuild.test.ts -t "rolls back a frozen revision and queued release when the required creation audit transaction fails"
# Result: 1 passed, 20 skipped.
```

### Final Verification And Self-Review

```powershell
bunx tsgo --noEmit --pretty false
# Result: passed.

bunx eslint packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts packages/database/src/models/desktopBuild.ts packages/database/src/models/desktopBuild.test.ts packages/types/src/adminCommand.ts packages/types/src/adminCommand.test.ts
# Result: passed.

bunx prettier --check packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts packages/database/src/models/desktopBuild.ts packages/database/src/models/desktopBuild.test.ts packages/types/src/adminCommand.ts packages/types/src/adminCommand.test.ts
# Result: passed.

git diff --check
# Result: passed.
```

Self-review against `.agents/skills/review-checklist/SKILL.md` found no debug logging, secrets, user-facing strings, migration work, router-pair changes, dependency changes, or cloud-facing boundary changes. The sole duplicated command boundary is explicitly asserted as the `desktop.release.create` nested audit companion to `desktop.release.dispatch`.
