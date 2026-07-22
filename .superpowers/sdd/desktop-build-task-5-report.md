# Task 5 Report: Frozen CI Profiles and Release Callbacks

## Scope

- Extracted desktop release authentication into `auth.ts` with dedicated-token precedence, opt-in legacy bridging, and constant-time equal-length comparison.
- Added authenticated frozen-profile reads that return only the release-bound frozen revision, validated manifest metadata, and short-lived signed GET URLs.
- Extended release callbacks with release/revision matching, forward-only lifecycle handling, bounded failure summaries, durable GitHub workflow run metadata, and succeeded-only atomic public-setting updates.
- Added idempotent `0150_add_desktop_release_workflow_run.sql` migration for bounded `workflow_run_id` and `workflow_run_url` columns.
- Added CI profile staging with redirect, content-length, stream-size, checksum, required-asset, fixed-name, confinement, and cleanup checks.
- Bound the desktop workflow to optional `release_id`, `${RUNNER_TEMP}` staging, `DESKTOP_BUILD_PROFILE_PATH`, lifecycle callbacks, and GitHub run links while retaining the manual path.

## TDD Evidence

RED:

1. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism --dir "src/app/(backend)/api/admin/desktop-release"`
   - Failed because `auth.ts` and the profile route did not exist.
2. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism --dir scripts/electronWorkflow`
   - Failed because `fetchDesktopBuildProfile.ts` did not exist.
3. Callback compatibility regression: the new manual callback test failed with `expected 400 to be 200` before release-field validation was limited to `releaseId` callbacks.
4. Profile ownership regression: the frozen-profile test failed with `expected 200 to be 409` before revision `profileId` was checked against the release.

GREEN:

1. Desktop-release route/auth/profile tests: 24 tests passed.
2. Staging and workflow contract tests: 5 tests passed.
3. Database schema/model tests: 27 tests passed, including replay of migration `0150` twice on PGlite and idempotent building callback metadata persistence.

## Verification

- `bun run type-check` passed (`tsgo --noEmit`).
- Targeted ESLint passed for all changed TypeScript, tests, and workflow YAML.
- Targeted Prettier check passed.
- Workflow YAML parses through `yaml.parseDocument` with no errors in the focused contract test.
- `git diff --check` passed.

## Review

- Reviewed against the repository review checklist: no secret logging, no credential or signed-URL persistence, no new user-facing strings, idempotent migration, and no desktop route changes.
- No full suite, hosted GitHub Actions execution, push, merge, or deployment was performed.

## Review Remediation Evidence

RED:

1. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism --dir "src/app/(backend)/api/admin/desktop-release"`
   - Failed the new pre-staging failure callback regression: `expected 400 to be 200` because failed release callbacks without `profileRevisionId` were rejected.
2. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism --dir scripts/electronWorkflow`
   - Failed the new redirect regression because cancellation had not completed before the redirected fetch.
   - Failed the parsed workflow contract because a `run:` script contained `${{ inputs.version }}`.

GREEN:

1. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir "src/app/(backend)/api/admin/desktop-release"`
   - 27 tests passed: constant-time auth/legacy bridge, exact 300-second profile URLs, frozen binding, failed callback inference, terminal/idempotent behavior, and manual compatibility.
2. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir scripts/electronWorkflow`
   - 6 tests passed: awaited chunked redirect cancellation, staging limits/checksums/cleanup, and parsed workflow lifecycle structure.
3. `node ..\\..\\node_modules\\vitest\\vitest.mjs run --config vitest.config.mts --silent=passed-only "src/schemas/desktopBuild.schema.test.ts" "src/models/desktopBuild.test.ts"` from `packages/database`
   - 27 tests passed, including idempotent migration coverage and lifecycle/workflow metadata persistence.
4. `bun run type-check`
   - Passed (`tsgo --noEmit`).
5. `node .\\node_modules\\eslint\\bin\\eslint.js ...` for the seven changed TypeScript/test files and workflow YAML
   - Passed.
6. `node .\\node_modules\\prettier\\bin\\prettier.cjs --check ...` for the changed TypeScript/test files and workflow YAML
   - Passed.
7. Parsed YAML structural contract: `scripts/electronWorkflow/desktopReleaseWorkflow.test.ts`
   - Passed; all `run:` blocks reject `${{` interpolation, callback/staging inputs are env-bound, the server-managed unpublished path has one terminal failure callback, manual `publish=false` remains unassociated, and succeeded remains after publication.
8. `git diff --check`
   - Passed.

## Review Remediation

- Failed server-release callbacks may omit `profileRevisionId` only for `status=failed`; the route loads the release and accepts no alternate revision. All other server lifecycle callbacks still require the exact frozen revision.
- The workflow now reports bounded static failed summaries with run metadata for pre-staging, build, unpublished server-release, and publish failures. Failed callbacks omit the revision so profile-staging failure cannot strand a release in `building`.
- Every shell `run:` value is passed through step environment variables; no GitHub expressions are interpolated in shell code. Redirect responses are awaited-cancelled before a permitted follow.
- Review checklist re-run: no token/signed-URL logging, no credential persistence, no migration change, no desktop route change, and no new user-facing strings.
- Remaining limitation: no hosted Actions execution or live S3/GitHub callback validation was performed.

## Callback Binding Re-Review

RED:

1. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism "src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts" scripts/electronWorkflow/desktopReleaseWorkflow.test.ts`
   - Failed the persisted-run negative callback case with `expected 200 to be 400`: a release carrying `workflowRunId` and `workflowRunUrl` still accepted `status=failed` without `profileRevisionId`.
   - Failed the parsed workflow assertion because the post-staging build failure callback had no `PROFILE_REVISION_ID` binding.

GREEN:

1. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism "src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts" scripts/electronWorkflow/desktopReleaseWorkflow.test.ts`
   - 19 tests passed: persisted workflow binding rejects revisionless failure; the exact frozen revision succeeds; parsed workflow verifies revisionless pre-staging and revision-bound post-staging failures.
2. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir "src/app/(backend)/api/admin/desktop-release"`
   - 28 API/auth/profile tests passed.
3. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir scripts/electronWorkflow`
   - 6 staging/workflow tests passed.
4. `bun run type-check`
   - Passed (`tsgo --noEmit`).
5. `node .\\node_modules\\eslint\\bin\\eslint.js ...`, `node .\\node_modules\\prettier\\bin\\prettier.cjs --check ...`, and `git diff --check`
   - Passed for the changed callback route, workflow, and focused tests.

## Callback Binding Fix

- Revisionless `failed` callbacks are accepted only when the loaded release has no durable workflow run ID or URL. Once binding exists, the server rejects a missing revision before transition processing; a supplied revision must still match the frozen revision exactly.
- Post-staging build and publish failure callbacks now send `PROFILE_REVISION_ID` from their stage/job outputs through env-bound quoted shell variables. The deliberate unpublished server-release path remains revisionless and does not bind a profile variable.
- Self-review: no direct GitHub-expression shell interpolation, raw failure output, secrets, or `electron-builder.mjs` changes; manual callbacks and terminal transition handling remain unchanged.

## Authentication Comparator Re-Review

RED:

1. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism "src/app/(backend)/api/admin/desktop-release/auth.test.ts"`
   - Failed with `expected true to be false` for distinct equal-length `incorrect-secret` and `dedicated-secret` values while the legacy mock returned `true` for every comparator call. This proves the new assertion fails for an unconditional-true or equal-length-only authorization implementation.

GREEN:

1. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir "src/app/(backend)/api/admin/desktop-release"`
   - 28 API/auth/profile tests passed. The auth regression retains equal-buffer call-shape checks and length-mismatch rejection, while an explicit false comparator result rejects a distinct equal-length bearer token.
2. `bun run type-check`
   - Passed (`tsgo --noEmit`) after typing the two-buffer comparator mock.
3. `node .\\node_modules\\eslint\\bin\\eslint.js "src/app/(backend)/api/admin/desktop-release/auth.test.ts"`, `node .\\node_modules\\prettier\\bin\\prettier.cjs --check "src/app/(backend)/api/admin/desktop-release/auth.test.ts"`, and `git diff --check`
   - Passed.

## Authentication Comparator Fix

- Self-review: the test-only change proves an equal-length wrong token is rejected when the constant-time comparator returns false, preserves buffer call-shape and safe length-mismatch coverage, and introduces no secret output or production behavior change.

## Provenance And Staging Re-Review

RED:

1. `node .\\node_modules\\vitest\\vitest.mjs run --reporter=verbose --pool=threads --maxWorkers=1 --no-file-parallelism "src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts" scripts/electronWorkflow/fetchDesktopBuildProfile.test.ts`
   - Failed with `expected 200 to be 400` for a server-managed failed callback missing both workflow run fields.
   - Failed redirect cleanup regressions: missing-location cancellation was false and exhausted redirects cancelled 3 rather than 4 response bodies.
   - Failed the no-content-length oversized chunk regression because cancellation did not occur before the byte-limit error.

GREEN:

1. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism "src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts" scripts/electronWorkflow/fetchDesktopBuildProfile.test.ts`
   - 29 callback/staging tests passed.
2. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir "src/app/(backend)/api/admin/desktop-release"`
   - 31 API/auth/profile tests passed.
3. `node .\\node_modules\\vitest\\vitest.mjs run --silent=passed-only --pool=threads --maxWorkers=1 --no-file-parallelism --dir scripts/electronWorkflow`
   - 9 staging/workflow tests passed.
4. `bun run type-check`, targeted ESLint, targeted Prettier, and `git diff --check`
   - Passed.

## Provenance And Staging Fix

- Every callback with `releaseId` now requires both bounded workflow run fields and the validated GitHub Actions URL before any release mutation. Manual callbacks remain untouched.
- Redirect bodies are awaited-cancelled before all redirect outcomes, including missing location and redirect exhaustion; non-success profile/asset responses and discarded oversized streams are also cancelled.
- Later-asset checksum and chunked-overflow tests prove previously written assets and the profile output are removed. Self-review found no changes to workflow shell binding, release revision rules, migration, or secret handling.
