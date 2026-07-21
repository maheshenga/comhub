# Desktop Build Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auditable desktop build-profile system that lets administrators manage the Windows application name, icon, native identity, installer visuals, and package naming, then explicitly create a release from an immutable profile revision.

**Architecture:** Runtime desktop settings stay in `app_settings`; build-time branding moves into append-only profile revisions linked to desktop release records. The admin API validates and snapshots profiles, a CI-only API exposes one frozen snapshot through short-lived asset URLs, and GitHub Actions stages those assets before Electron Builder consumes a temporary JSON profile.

**Tech Stack:** Next.js 16, React 19, TypeScript, tRPC, Zod, Drizzle/PostgreSQL, S3-compatible object storage, Electron Builder 26, GitHub Actions, Vitest.

## Global Constraints

- Preserve `/settings/admin/desktop-update`, Phase 1 diagnostics, and runtime login branding.
- Saving a profile never starts CI, publishes an artifact, or changes an installed client.
- Build Windows NSIS only; do not expose active macOS/Linux publishing controls.
- Freeze an immutable profile revision before dispatching a release.
- Lock `applicationId` and `protocolScheme` after the first successful stable release.
- Reject custom scripts, shell commands, arbitrary Electron Builder keys, and external asset URLs.
- Keep signing material, GitHub tokens, storage credentials, and signed URLs out of database payloads, browser responses, and audit logs.
- Restrict installer templates to `${productName}`, `${version}`, `${arch}`, and `${ext}`.
- Require a 1024x1024 PNG preview, a Windows ICO containing 16/32/48/256 pixel entries, a 150x57 NSIS header BMP, and a 164x314 NSIS sidebar BMP.
- Use `systemRead` for reads and `systemWrite` plus required audit records for writes and dispatch.
- Preserve manual workflow dispatch compatibility when `release_id` is absent.
- Run focused tests only; never run the full repository suite.

---

### Task 1: Define the Shared Build-Profile Contract

**Files:**
- Create: `packages/types/src/desktopBuild.ts`
- Create: `packages/business-server/src/desktopBuild/contract.ts`
- Create: `packages/business-server/src/desktopBuild/contract.test.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `DesktopBuildProfilePayload`, `DesktopBuildAsset`, `DesktopBuildAssetManifest`, `DesktopBuildProfileRevisionState`, `DesktopReleaseChannel`, and `DesktopReleaseStatus`.
- Produces: `desktopBuildProfilePayloadSchema`, `desktopReleaseInputSchema`, and `parseDesktopBuildProfilePayload(input)`.

- [ ] **Step 1: Write failing contract tests**

```ts
it('accepts the supported Windows profile fields', () => {
  expect(parseDesktopBuildProfilePayload(validPayload)).toEqual(validPayload);
});

it.each(['CON', '../ComHub', 'ComHub.exe', 'ComHub/Setup'])('rejects executable %s', (name) => {
  expect(() => parseDesktopBuildProfilePayload({ ...validPayload, executableName: name })).toThrow();
});

it('rejects unapproved artifact interpolation', () => {
  expect(() => parseDesktopBuildProfilePayload({
    ...validPayload,
    installerArtifactName: '${env.HOME}-${version}.${ext}',
  })).toThrow();
});
```

- [ ] **Step 2: Confirm the test is red**

Run `bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/desktopBuild/contract.test.ts`.

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement the public types and strict parser**

```ts
export type DesktopBuildAssetKind = 'appPreview' | 'nsisHeader' | 'nsisSidebar' | 'windowsIcon';
export type DesktopBuildProfileRevisionState = 'draft' | 'frozen';
export type DesktopReleaseChannel = 'canary' | 'stable';
export type DesktopReleaseStatus = 'building' | 'failed' | 'publishing' | 'queued' | 'succeeded';

export interface DesktopBuildAsset {
  contentType: string;
  height?: number;
  key: string;
  kind: DesktopBuildAssetKind;
  sha256: string;
  size: number;
  width?: number;
}

export type DesktopBuildAssetManifest = Record<DesktopBuildAssetKind, DesktopBuildAsset>;

export interface DesktopBuildProfilePayload {
  applicationId: string;
  applicationName: string;
  description: string;
  executableName: string;
  homepage: string;
  installerArtifactName: string;
  protocolScheme: string;
  publisher: string;
  shortcutName: string;
  uninstallDisplayName: string;
}
```

Make the Zod schema `.strict()`. Reject Windows reserved names, separators and extensions in `executableName`; require HTTPS `homepage`; and scan every `${...}` token against the four-token allowlist.

- [ ] **Step 4: Confirm green and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/types/src/desktopBuild.ts packages/types/src/index.ts packages/business-server/src/desktopBuild
git commit -m "feat(desktop): define build profile contract" -m "Constraint: Reject arbitrary installer interpolation and unsafe Windows identity values." -m "Tested: Focused desktop build contract tests."
```

### Task 2: Persist Immutable Profiles, Revisions, and Releases

**Files:**
- Create: `packages/database/src/schemas/desktopBuild.ts`
- Create: `packages/database/src/schemas/desktopBuild.schema.test.ts`
- Create: `packages/database/src/models/desktopBuild.ts`
- Create: `packages/database/src/models/desktopBuild.test.ts`
- Modify: `packages/database/src/schemas/index.ts`
- Create: `packages/database/migrations/0149_add_desktop_build_branding.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Create: `packages/database/migrations/meta/0149_snapshot.json`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `desktopBuildProfiles`, `desktopBuildProfileRevisions`, `desktopReleases`.
- Produces `DesktopBuildModel` methods: `listProfiles`, `getProfile`, `getRevision`, `saveDraft`, `freezeDraftForRelease`, `listReleases`, `markReleaseDispatched`, and `markReleaseResult`.

- [ ] **Step 1: Write failing model tests**

```ts
it('appends a revision without updating the prior payload', async () => {
  const first = await model.saveDraft({ actorUserId: 'admin-1', name: 'ComHub', payload, assets });
  const second = await model.saveDraft({
    actorUserId: 'admin-1', assets, name: 'ComHub', profileId: first.profileId,
    payload: { ...payload, applicationName: 'ComHub Pro' },
  });
  expect(second.revision).toBe(first.revision + 1);
  expect(await model.getRevision(first.revisionId)).toMatchObject({ payload });
});

it('freezes the revision and creates a release atomically', async () => {
  const result = await model.freezeDraftForRelease({
    actorUserId: 'admin-1', channel: 'stable', profileId,
    releaseNotes: 'First branded build', version: '2.4.0',
  });
  expect(result.revision.state).toBe('frozen');
  expect(result.release).toMatchObject({ status: 'queued', version: '2.4.0' });
});
```

- [ ] **Step 2: Confirm database tests are red**

Run `bunx vitest run --config packages/database/vitest.config.mts --silent='passed-only' packages/database/src/schemas/desktopBuild.schema.test.ts packages/database/src/models/desktopBuild.test.ts`.

Expected: FAIL because the schema and model do not exist.

- [ ] **Step 3: Implement schema invariants**

```ts
uniqueIndex('desktop_build_profile_revisions_profile_revision_unique').on(table.profileId, table.revision);
uniqueIndex('desktop_releases_channel_version_unique').on(table.channel, table.version);
check('desktop_build_profile_revisions_state_check', sql`${table.state} IN ('draft', 'frozen')`);
check('desktop_releases_status_check', sql`${table.status} IN ('queued', 'building', 'publishing', 'succeeded', 'failed')`);
```

Use JSONB for typed payload, asset manifest, and artifacts. Administrator references use `onDelete: 'set null'`; release-to-frozen-revision uses `onDelete: 'restrict'`.

- [ ] **Step 4: Generate migration 0149**

Run `bunx drizzle-kit generate --name=add_desktop_build_branding`.

Expected: migration, journal entry 149, and snapshot contain all three tables, checks, indexes, and foreign keys.

- [ ] **Step 5: Implement transaction and state rules**

`saveDraft` always inserts. `freezeDraftForRelease` copies the selected draft to a frozen revision and creates `queued` in one transaction. `markReleaseResult` permits only forward transitions and sets `firstStableReleaseAt` only after successful stable publication.

- [ ] **Step 6: Confirm green and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/database/src/schemas/desktopBuild.ts packages/database/src/schemas/desktopBuild.schema.test.ts packages/database/src/schemas/index.ts packages/database/src/models/desktopBuild.ts packages/database/src/models/desktopBuild.test.ts packages/database/migrations/0149_add_desktop_build_branding.sql packages/database/migrations/meta/_journal.json packages/database/migrations/meta/0149_snapshot.json
git commit -m "feat(desktop): persist immutable build profiles" -m "Constraint: Freeze every release profile and preserve published identity history." -m "Tested: Focused desktop build schema and model tests."
```

### Task 3: Add Protected Asset and Profile Administration APIs

**Files:**
- Create: `apps/server/src/services/desktopBuild/assets.ts`
- Create: `apps/server/src/services/desktopBuild/assets.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/desktop.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/desktop.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`

**Interfaces:**
- Consumes: Task 1 contract, Task 2 model, `FileS3`, required admin audits.
- Produces tRPC methods: `listBuildProfiles`, `getBuildProfile`, `createBuildAssetUpload`, `completeBuildAssetUpload`, `saveBuildProfileDraft`, `archiveBuildProfile`, and `listDesktopReleases`.

- [ ] **Step 1: Write failing binary-inspection tests**

```ts
it('accepts an ico containing all required sizes', () => {
  expect(inspectDesktopBuildAsset('windowsIcon', validIco)).toMatchObject({ kind: 'windowsIcon' });
});

it.each([
  ['appPreview', png(1024, 1024)],
  ['nsisHeader', bmp(150, 57)],
  ['nsisSidebar', bmp(164, 314)],
] as const)('validates %s dimensions', (kind, body) => {
  expect(inspectDesktopBuildAsset(kind, body)).toMatchObject({ kind });
});
```

- [ ] **Step 2: Confirm asset tests are red**

Run `bunx vitest run --silent='passed-only' apps/server/src/services/desktopBuild/assets.test.ts`.

Expected: FAIL because the inspector does not exist.

- [ ] **Step 3: Implement bounded asset inspection**

Cap PNG at 4 MiB, ICO at 2 MiB, and each BMP at 1 MiB. Parse PNG IHDR, ICO directory entries, and BMP DIB dimensions. Reject truncation, signature/MIME mismatch, invalid dimensions, and missing ICO sizes; return trusted dimensions, type, SHA-256, and byte size.

- [ ] **Step 4: Add tRPC profile and upload procedures**

`createBuildAssetUpload` generates `desktop-build-assets/<profile-id>/<uuid>.<ext>` and a private presigned PUT. `completeBuildAssetUpload` reads and validates the object before returning a trusted `DesktopBuildAsset`. `saveBuildProfileDraft` accepts only this key prefix and rechecks metadata. `archiveBuildProfile` changes status without deleting referenced revisions. Use required audited transactions for `desktop.buildProfile.saveDraft`, `desktop.buildProfile.archive`, and `desktop.buildAsset.complete` and add all three to command-parity coverage. Never return credentials, bucket listings, or signed GET URLs.

- [ ] **Step 5: Run focused API tests and commit**

Run `bunx vitest run --silent='passed-only' apps/server/src/services/desktopBuild/assets.test.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts src/services/adminCommercial.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts`.

Expected: PASS including permission denials and audit assertions.

```powershell
git add apps/server/src/services/desktopBuild packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts packages/business-server/src/lambda-routers/admin/adminCommandParity.test.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts
git commit -m "feat(admin): manage desktop build profiles" -m "Constraint: Validate private build assets server-side and expose no storage credentials." -m "Tested: Focused asset, admin router, service, and command parity tests."
```

### Task 4: Create Audited Release Dispatch and History

**Files:**
- Create: `apps/server/src/services/desktopRelease/github.ts`
- Create: `apps/server/src/services/desktopRelease/github.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/desktop.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/desktop.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/services/adminCommercial.test.ts`

**Interfaces:**
- Consumes: Task 2 release model and `runRequiredAdminAuditExternalEffect`.
- Produces `dispatchDesktopReleaseWorkflow({ channel, releaseId, releaseNotes, version })` and tRPC `createDesktopRelease`.

- [ ] **Step 1: Write a failing fixed-target dispatch test**

```ts
it('dispatches the fixed workflow with the frozen release id', async () => {
  await dispatchDesktopReleaseWorkflow(
    { channel: 'stable', releaseId: 'release-1', releaseNotes: 'notes', version: '2.4.0' },
    { fetcher, token: 'secret' },
  );
  expect(fetcher).toHaveBeenCalledWith(
    'https://api.github.com/repos/maheshenga/comhub/actions/workflows/comhub-desktop-release.yml/dispatches',
    expect.objectContaining({ method: 'POST' }),
  );
});
```

- [ ] **Step 2: Confirm red, then implement dispatch**

Run `bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts`.

Expected: FAIL. Implement the fixed workflow filename with `DESKTOP_RELEASE_GITHUB_TOKEN`, repository fallback `maheshenga/comhub`, ref fallback `main`, GitHub headers, a 10-second timeout, and response-body redaction.

- [ ] **Step 3: Implement explicit release creation**

Validate semantic version and complete assets, reject locked identity changes, freeze and queue transactionally, then dispatch through required external-effect audit. On dispatch failure persist `failed` with a bounded summary. Audit only profile/revision/release IDs, channel, and version.

- [ ] **Step 4: Confirm green and commit**

Run `bunx vitest run --silent='passed-only' apps/server/src/services/desktopRelease/github.test.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts src/services/adminCommercial.test.ts`.

Expected: PASS for dispatch, permissions, identity lock, duplicate version, failure state, and audit behavior.

```powershell
git add apps/server/src/services/desktopRelease/github.ts apps/server/src/services/desktopRelease/github.test.ts packages/business-server/src/lambda-routers/admin/desktop.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts src/services/adminCommercial.ts src/services/adminCommercial.test.ts
git commit -m "feat(desktop): dispatch branded release builds" -m "Constraint: Freeze releases before the external GitHub effect and audit every terminal outcome." -m "Tested: Focused GitHub dispatch, admin router, and client service tests."
```

### Task 5: Expose Frozen Profiles to CI and Extend Release Callbacks

**Files:**
- Create: `src/app/(backend)/api/admin/desktop-release/auth.ts`
- Create: `src/app/(backend)/api/admin/desktop-release/[releaseId]/profile/route.ts`
- Create: `src/app/(backend)/api/admin/desktop-release/[releaseId]/profile/__tests__/route.test.ts`
- Modify: `src/app/(backend)/api/admin/desktop-release/route.ts`
- Modify: `src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts`
- Create: `scripts/electronWorkflow/fetchDesktopBuildProfile.ts`
- Create: `scripts/electronWorkflow/fetchDesktopBuildProfile.test.ts`
- Modify: `.github/workflows/comhub-desktop-release.yml`

**Interfaces:**
- Consumes: frozen release/profile rows and `FileS3.createPreSignedUrlForPreview`.
- Produces authenticated `GET /api/admin/desktop-release/:releaseId/profile`.
- Produces `stageDesktopBuildProfile({ appUrl, outputDir, releaseId, token })`.
- Extends callback input with `releaseId`, `profileRevisionId`, `status`, `workflowRunId`, and `workflowRunUrl`.

- [ ] **Step 1: Extract constant-time release-token authentication**

Move `resolveDesktopReleaseToken` to `auth.ts` and compare equal-length token buffers with `timingSafeEqual`. Preserve the opt-in legacy cron-secret bridge and all existing precedence tests.

- [ ] **Step 2: Write a failing frozen-profile endpoint test**

```ts
it('returns one frozen revision and short-lived asset URLs', async () => {
  const response = await GET(request('release-1', 'dedicated-secret'), context('release-1'));
  const body = await response.json();
  expect(body.releaseId).toBe('release-1');
  expect(body.profileRevision.state).toBe('frozen');
  expect(JSON.stringify(body)).not.toContain('accessKey');
  expect(JSON.stringify(body)).not.toContain('secretAccessKey');
});
```

- [ ] **Step 3: Implement the endpoint and callback state machine**

The GET route rejects non-queued/building releases and revision mismatches, then returns checksums and one short-lived GET URL per asset. The POST callback verifies the revision, applies idempotent forward transitions, and updates public settings only for `succeeded`. Requests without `releaseId` preserve the current manual callback.

- [ ] **Step 4: Implement and test the CI staging helper**

Fetch the profile, download each asset with redirect and byte limits, verify SHA-256, and write a local JSON file containing `{ assets, profile, profileRevisionId, releaseId }`, where asset values are absolute staged paths. Tests cover checksum mismatch, oversized response, missing asset, and success.

- [ ] **Step 5: Update the workflow lifecycle**

Add optional `release_id`. When present, stage assets under `${RUNNER_TEMP}` and export `DESKTOP_BUILD_PROFILE_PATH`; when absent, use defaults. Report `building`, `publishing`, `succeeded`, and `failed` with run ID and run URL. Keep `version` and `channel` inputs for compatibility and concurrency.

- [ ] **Step 6: Run focused tests and commit**

```powershell
bunx vitest run --silent='passed-only' "src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts" "src/app/(backend)/api/admin/desktop-release/[releaseId]/profile/__tests__/route.test.ts" scripts/electronWorkflow/fetchDesktopBuildProfile.test.ts
```

Expected: PASS including manual dispatch compatibility and secret non-disclosure.

```powershell
git add "src/app/(backend)/api/admin/desktop-release" scripts/electronWorkflow/fetchDesktopBuildProfile.ts scripts/electronWorkflow/fetchDesktopBuildProfile.test.ts .github/workflows/comhub-desktop-release.yml
git commit -m "feat(desktop): bind CI to frozen build profiles" -m "Constraint: CI may read only one queued release snapshot through short-lived asset URLs." -m "Tested: Focused release callback, profile endpoint, and staging tests."
```

### Task 6: Make Electron Builder Consume the Temporary Profile

**Files:**
- Create: `apps/desktop/desktop-build-profile.mjs`
- Create: `apps/desktop/desktop-build-profile.test.ts`
- Modify: `apps/desktop/electron-builder.mjs`
- Modify: `scripts/electronWorkflow/setDesktopVersion.ts`
- Create: `scripts/electronWorkflow/setDesktopVersion.test.ts`

**Interfaces:**
- Consumes: `DESKTOP_BUILD_PROFILE_PATH` created by Task 5.
- Produces: `loadDesktopBuildProfile(path, defaults)` and `applyDesktopBuildProfile(config, stagedProfile)`.
- Preserves repository-default local builds when no profile path is supplied.

- [ ] **Step 1: Write failing configuration tests**

```ts
it('maps the staged profile into Windows and NSIS config', async () => {
  const result = await loadDesktopBuildProfile(profilePath, defaults);
  expect(result).toMatchObject({
    appId: 'com.qingyouai.comhub', productName: 'ComHub',
    win: { executableName: 'ComHub', icon: windowsIconPath },
    nsis: {
      artifactName: '${productName}-${version}-setup.${ext}',
      installerHeader: headerPath, installerSidebar: sidebarPath,
      shortcutName: 'ComHub', uninstallDisplayName: 'ComHub',
    },
  });
});

it('does not overwrite productName in setDesktopVersion', () => {
  expect(updatedPackage.productName).toBe(originalPackage.productName);
});
```

- [ ] **Step 2: Confirm red**

Run `bunx vitest run --silent='passed-only' apps/desktop/desktop-build-profile.test.ts scripts/electronWorkflow/setDesktopVersion.test.ts`.

Expected: FAIL because loading is absent and versioning overwrites product name.

- [ ] **Step 3: Implement fail-closed profile loading**

Resolve only `DESKTOP_BUILD_PROFILE_PATH`. Require all staged paths to exist inside the staging directory with expected extensions. Use defaults only when no path is supplied; an invalid supplied profile terminates the build.

- [ ] **Step 4: Apply native metadata without tracked-file mutation**

Map to top-level `productName`, `appId`, `extraMetadata.description/homepage/author`, `protocols`, `win.executableName`, `win.icon`, and NSIS artifact/shortcut/uninstall/header/sidebar. Leave signing configuration untouched. Refactor versioning to update version and channel package `name` only; staged-profile mode never copies repository icons.

- [ ] **Step 5: Confirm green, evaluate config, and commit**

```powershell
bunx vitest run --silent='passed-only' apps/desktop/desktop-build-profile.test.ts scripts/electronWorkflow/setDesktopVersion.test.ts
node -e "import('./apps/desktop/electron-builder.mjs').then(m => { if (!m.default.win.executableName) process.exit(1) })"
```

Expected: tests PASS and config evaluation exits 0 with defaults.

```powershell
git add apps/desktop/desktop-build-profile.mjs apps/desktop/desktop-build-profile.test.ts apps/desktop/electron-builder.mjs scripts/electronWorkflow/setDesktopVersion.ts scripts/electronWorkflow/setDesktopVersion.test.ts
git commit -m "feat(desktop): apply branded installer profiles" -m "Constraint: Read branding from an untracked staged file and fail closed when supplied input is invalid." -m "Tested: Focused profile, versioning, and Electron config tests."
```

### Task 7: Build the Brand, Installer, Release, and History UI

**Files:**
- Create: `src/features/Admin/DesktopControlCenter/BuildProfilePage.tsx`
- Create: `src/features/Admin/DesktopControlCenter/BuildProfileForm.tsx`
- Create: `src/features/Admin/DesktopControlCenter/DesktopBuildAssetUpload.tsx`
- Create: `src/features/Admin/DesktopControlCenter/CreateDesktopReleaseModal.tsx`
- Create: `src/features/Admin/DesktopControlCenter/DesktopBuildHistory.tsx`
- Create: `src/features/Admin/DesktopControlCenter/buildProfileForm.ts`
- Create: `src/features/Admin/DesktopControlCenter/buildProfileForm.test.ts`
- Modify: `src/features/Admin/DesktopControlCenter/index.tsx`
- Modify: `src/features/Admin/DesktopControlCenter/types.ts`
- Modify: `src/features/Admin/DesktopControlCenter/styles.ts`
- Modify: `src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx`
- Modify: `packages/locales/src/default/subscription.ts`
- Modify: `locales/en-US/subscription.json`
- Modify: `locales/zh-CN/subscription.json`

**Interfaces:**
- Consumes: Task 3 profile/asset services and Task 4 release/history services.
- Produces: `build-profile` tab, draft editor, protected uploader, create-build modal, and release table.

- [ ] **Step 1: Write failing form and interaction tests**

```ts
it('saves a draft without creating a release', async () => {
  renderControlCenter({ search: 'tab=build-profile' });
  fireEvent.change(screen.getByLabelText('admin.desktopBuild.applicationName'), {
    target: { value: 'ComHub' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'admin.desktopBuild.saveDraft' }));
  await waitFor(() => expect(adminCommercialService.saveBuildProfileDraft).toHaveBeenCalled());
  expect(adminCommercialService.createDesktopRelease).not.toHaveBeenCalled();
});

it('requires confirmation before creating a build', () => {
  fireEvent.click(screen.getByRole('button', { name: 'admin.desktopBuild.createBuild' }));
  expect(screen.getByRole('dialog', { name: 'admin.desktopBuild.release.title' })).toBeVisible();
});
```

- [ ] **Step 2: Confirm UI tests are red**

Run `bunx vitest run --silent='passed-only' src/features/Admin/DesktopControlCenter/buildProfileForm.test.ts src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx`.

Expected: FAIL because the tab and components do not exist.

- [ ] **Step 3: Implement the form and tab**

Keep runtime login branding in `brand`; add `build-profile` labeled `Brand and installer`. Separate protected identity fields, disable them when `identityLocked`, and explain that publisher text does not change certificate identity. Use an unframed form with stable layout and no nested cards. `Save draft` is the only profile mutation; `Create build` opens the modal and remains disabled until Windows assets are complete.

- [ ] **Step 4: Implement the private upload lifecycle**

Request an upload descriptor, PUT with returned headers, call completion validation, and store only the trusted returned asset. Accept extensions by kind. Show upload, validation, retry, and replacement states; discard the presigned URL after PUT. The profile selector provides an archive action with confirmation and never offers deletion for a referenced profile.

- [ ] **Step 5: Implement release confirmation and history**

The modal accepts channel, semantic version, and notes. Confirmation shows profile/revision, app name, executable, final artifact, and first-stable identity warning. Disable duplicate submissions while queued. History shows status, channel, version, revision, actor, times, artifact, bounded error, and GitHub run link.

- [ ] **Step 6: Add English and Chinese copy, confirm green, and commit**

Edit the default locale plus hand-maintained `en-US` and `zh-CN`. Run the Step 2 command.

Expected: PASS for draft-only saving, asset state, identity lock, confirmation, dispatch failure retention, query preservation, and history.

```powershell
git add src/features/Admin/DesktopControlCenter packages/locales/src/default/subscription.ts locales/en-US/subscription.json locales/zh-CN/subscription.json
git commit -m "feat(admin): manage branded desktop installers" -m "Constraint: Separate draft saving from explicit release creation and keep native identity locks visible." -m "Tested: Focused build profile form and desktop control center tests."
```

### Task 8: Perform the Single Integrated Verification and Review

**Files:**
- Modify only files required by review findings.

**Interfaces:**
- Consumes Tasks 1-7.
- Produces a reviewed branch ready for a later push or deployment request.

- [ ] **Step 1: Run the focused combined verification once**

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/desktopBuild/contract.test.ts packages/database/src/schemas/desktopBuild.schema.test.ts packages/database/src/models/desktopBuild.test.ts apps/server/src/services/desktopBuild/assets.test.ts apps/server/src/services/desktopRelease/github.test.ts packages/business-server/src/lambda-routers/admin/desktop.test.ts src/services/adminCommercial.test.ts "src/app/(backend)/api/admin/desktop-release/__tests__/route.test.ts" "src/app/(backend)/api/admin/desktop-release/[releaseId]/profile/__tests__/route.test.ts" scripts/electronWorkflow/fetchDesktopBuildProfile.test.ts apps/desktop/desktop-build-profile.test.ts scripts/electronWorkflow/setDesktopVersion.test.ts src/features/Admin/DesktopControlCenter/buildProfileForm.test.ts src/features/Admin/DesktopControlCenter/DesktopControlCenter.test.tsx
bun run type-check
git diff --check
```

Expected: focused tests PASS, type-check exits 0, and diff check prints nothing.

- [ ] **Step 2: Run a Windows package smoke build**

```powershell
$env:DESKTOP_BUILD_PROFILE_PATH=(Resolve-Path '.tmp/desktop-build-profile.json')
npm.cmd run package:win --prefix=./apps/desktop
Remove-Item Env:DESKTOP_BUILD_PROFILE_PATH
```

Expected: branded setup EXE and unpacked executable names match the staged profile; Electron Builder logs use staged icon and NSIS assets. This does not prove production signing or publication.

- [ ] **Step 3: Review the complete diff**

Check permission enforcement, audit coverage, transactions, SSRF/signed-URL handling, byte limits, revision immutability, identity locks, workflow failure callbacks, secret redaction, SPA routing, loading/empty/error states, and English/Chinese copy. Fix every finding before completion.

- [ ] **Step 4: Commit review fixes only when needed**

```powershell
git add -u
git commit -m "fix(desktop): close branded release review findings" -m "Constraint: Preserve profile immutability, release auditability, and credential isolation." -m "Tested: Focused desktop branding verification, type-check, diff check, and Windows package smoke build."
```

Skip this commit when review finds no changes. Do not push, merge, or deploy without a separate explicit request.
