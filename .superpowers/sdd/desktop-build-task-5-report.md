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
