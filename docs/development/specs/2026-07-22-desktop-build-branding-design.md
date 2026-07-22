# Desktop Build Branding Design

## Status

Approved on 2026-07-22. This specification extends the desktop control-center design with build-time application branding and installer customization.

## Context

The existing desktop control center manages runtime configuration such as desktop login copy, public download links, update channels, versions, and release health. Electron native identity is different: product name, executable name, application ID, protocol scheme, icon, and NSIS installer visuals are compiled into an installer.

The current Windows release workflow builds those values from repository defaults. The workflow writes the release version to `apps/desktop/package.json`, while `electron-builder.mjs` contains fixed LobeHub values for the application ID and executable name. An admin setting must never imply that it changes an installer when no new installer has been built.

## Goals

1. Let authorized administrators manage a desktop build profile from `/settings/admin/desktop-update`.
2. Separate editable runtime branding from build-time native branding in both UI and data contracts.
3. Build only from an explicit release action, not from saving a profile.
4. Bind every released artifact to an immutable, auditable build-profile revision.
5. Keep signing credentials, GitHub credentials, and object-storage credentials out of the browser and database.
6. Deliver complete Windows NSIS support first, while keeping the profile shape extensible for macOS and Linux.

## Non-Goals

- No arbitrary Electron Builder configuration, NSIS scripts, shell commands, or external asset URLs.
- No change to an existing published app identity in place. A deliberately incompatible desktop product requires a separate profile and release migration.
- No macOS or Linux artifacts in this phase. Their future fields must not appear as active publishing controls until their workflows are implemented and verified.
- No automatic release when a profile is saved.

## Control-Center Information Architecture

The existing desktop-control-center route remains unchanged. A new `Brand and Installer` tab contains the following sections.

### Profile Identity

- Profile name used only by administrators.
- Application display name and short description.
- Publisher and product website.
- Windows executable name.
- Installer artifact-name template.
- Desktop shortcut name and uninstall display name.
- Application ID and custom protocol scheme.

`applicationId` and `protocolScheme` are marked as protected identity fields. They are editable only before the first successful stable release for the profile. Afterwards the UI explains the update, uninstall, and single-instance compatibility impact and directs administrators to create a new profile instead.

### Visual Assets

- A square PNG preview image.
- A Windows multi-resolution `.ico` application icon.
- NSIS header and sidebar bitmaps validated against the supported NSIS formats and dimensions.

Assets are uploaded to the application-owned object store. The UI shows previews, checksum, size, and validation state. The profile stores immutable object references and content hashes, never an arbitrary remote URL. The release action is disabled until all Windows-required assets pass validation.

### Release Builder

The release form selects a draft profile revision, channel, semantic version, release notes, and publish target. It shows a read-only summary of the frozen values, including the eventual Windows artifact name. The primary action is `Create build`; it requires confirmation and creates a release record. Saving a profile only creates a draft revision.

### Build History

Each build row shows channel, version, profile revision, triggering administrator, GitHub run link, timestamps, status, artifacts, and error summary. A release cannot be edited after it has been queued. A later release may reuse a prior profile revision.

## Data Contract

The implementation introduces immutable revisioning instead of extending generic runtime settings with build-only fields.

### `desktop_build_profiles`

- `id`, `name`, `status`, `currentDraftRevisionId`.
- `firstStableReleaseAt` to enforce identity locking.
- `createdBy`, `createdAt`, and `updatedAt`.

### `desktop_build_profile_revisions`

- `id`, `profileId`, monotonically increasing `revision` number, `state` (`draft` or `frozen`).
- Typed `payload` for identity and installer metadata.
- `assetManifest` with object keys, media types, byte sizes, and SHA-256 hashes.
- `createdBy` and `createdAt`.

Revisions are append-only. Creating a release freezes an exact profile revision and associates it with the release record. Later edits create a new draft revision and cannot affect an in-flight or previously published artifact.

### `desktop_releases`

The existing release model receives `buildProfileRevisionId`. The release and its profile revision must belong to the same transaction. A unique channel/version constraint remains in force.

## Validation Rules

- Display, shortcut, and uninstall names are trimmed, required, and limited to safe Windows path lengths.
- Executable names use a restricted filename character set and do not contain extensions, path separators, reserved Windows names, or control characters.
- Artifact templates allow only `${productName}`, `${version}`, `${arch}`, and `${ext}`; path separators and arbitrary environment interpolation are rejected.
- `applicationId` and protocol schemes use a lowercase identifier format and cannot overlap a different published profile.
- The Windows icon must be an `.ico` with the required resolutions. A PNG preview does not substitute for a native icon.
- Installer assets must match the Electron Builder NSIS constraints. The server validates file type, dimensions, and maximum byte size before storing them.

## Build and Release Flow

1. An administrator saves a draft build-profile revision. This does not start CI and does not change any installed client.
2. The administrator creates a release from that draft. The server validates permissions, version, profile readiness, update configuration, and identity locks.
3. The server creates a `queued` release and freezes the selected revision in the same transaction, then dispatches the existing GitHub workflow with a `release_id`.
4. The GitHub workflow obtains the exact frozen profile through a CI-only authenticated endpoint using the existing desktop release token. It receives no signing or object-storage secrets from the API.
5. The workflow downloads the validated asset manifest to its temporary workspace, writes a temporary build-profile JSON file, and supplies its path through a build-only environment variable.
6. Desktop packaging reads that JSON file. It applies the profile to Electron Builder and versioning without modifying tracked `package.json`, icons, or build configuration in the checkout.
7. The existing artifact upload and S3 publishing steps run. The workflow reports the build result, artifact metadata, profile revision, and run URL back to the backend.
8. Only a successful publish updates the public desktop download and update configuration for the selected channel.

The release workflow must fail closed when the frozen profile, asset checksum, or required asset is unavailable. A failed build leaves the previous channel manifest and public download untouched.

## Build Integration

`apps/desktop/electron-builder.mjs` becomes a consumer of a validated build profile, with repository defaults retained only for local development. The profile controls the product name, executable name, Windows icon, NSIS shortcut/uninstall names, installer artwork, publisher metadata, application ID, protocol scheme, and artifact naming.

The version/channel script remains responsible for version and channel selection only. It must stop overwriting the product name. Channel-specific icon swapping is superseded by the selected immutable profile asset manifest; channel behavior must not silently replace an administrator-selected icon.

The workflow continues to build Windows installers first. macOS and Linux profile adapters will be added only together with platform-specific signing, packaging, artifact validation, and release workflows.

## Security and Permissions

- Read operations require `systemRead`; profile edits and release creation require `systemWrite`.
- The CI profile endpoint authenticates only the release workflow token, confirms the matching release state, and returns only that release's frozen revision.
- The endpoint returns short-lived object-store download URLs or streams the specific validated assets. It never lists buckets or returns storage credentials.
- GitHub dispatch credentials, signing certificates, and storage credentials remain in GitHub Secrets or server environment variables.
- All profile changes and releases write audit entries containing actor, profile revision, release identifier, and result. Secret values and signed URLs are not stored in audit payloads.
- The browser never receives a credential, a workflow-dispatch token, or a signing artifact.

## Failure Handling

- A missing profile, invalid asset, expired download URL, or checksum mismatch fails the release before publication.
- Duplicate CI callbacks are idempotent by release ID and terminal state.
- A profile cannot be deleted while a release references one of its revisions; it may instead be archived.
- A failed GitHub dispatch transitions the queued release to `failed` with an audit record, rather than leaving it indefinitely queued.
- The current profile draft remains editable after a failed release, but its frozen revision remains intact for diagnosis and reproducibility.

## Verification

One focused verification round covers:

1. Profile and revision validation, identity-locking, and immutable snapshot unit tests.
2. Permission tests for profile edits, release creation, and the CI-only frozen-profile endpoint.
3. Electron build-profile parsing tests for defaults, artifact names, executable names, icons, and NSIS configuration.
4. Workflow contract tests that confirm `release_id`, temporary asset staging, and callback payload compatibility.
5. A Windows packaging smoke build that verifies the packaged executable and installer artifact names and validates the selected icon resource.
6. `git diff --check` and targeted type checking for touched contracts.

## Acceptance Criteria

- An authorized administrator can create a draft profile with a custom app name, icon, installer visuals, and installer labels.
- Saving a profile does not rebuild, publish, or alter a previously installed desktop client.
- Creating a release explicitly freezes the selected revision and starts the Windows release workflow.
- A successful installer uses the selected product name, executable name, icon, installer visuals, shortcut name, and artifact filename.
- The release history identifies the exact profile revision used by every artifact.
- Signing and deployment credentials never appear in database rows, browser responses, workflow logs, or build-profile files.
