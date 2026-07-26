# Module App Developer Guide

## Lifecycle

1. Open `/apps/developer` and submit a publisher profile.
2. Wait for an administrator to verify the publisher.
3. Create and validate a project with the LobeHub CLI.
4. Preview the project with the local SDK bridge.
5. Package and submit the ZIP for review.
6. Follow scan, review, build, and publication state in the developer console.

An approved package can update only an application owned by the same verified publisher. Application slugs are globally unique and cannot be transferred through package submission.

## CLI

```bash
lh module-app init my-app --display-name "My App"
lh module-app validate my-app
lh module-app dev my-app
lh module-app pack my-app
lh module-app submit my-app/my-app-0.1.0.zip
```

`module-app.yaml` is validated against the same schema used by the server. `pack` excludes `.git`, `node_modules`, and platform metadata; rejects symbolic links, unsupported entries, and oversized content; and creates a bounded ZIP archive. `submit` accepts only a stable, regular ZIP file within the server upload limit.

## Manifest

Executable packages use a root `module-app.yaml` manifest with `manifestVersion: 2`. The supported build profiles are `node22-static` and `python312-assets`. Runtime functions, permissions, outbound hosts, data tables, workflows, pages, and actions must all be declared in the reviewed manifest.

Legacy manifest-only packages may use a root `manifest.json` with `manifestVersion: 1`. A package cannot contain both manifest formats.

## SDK

Install `@lobechat/module-app-sdk` in the application frontend. Wait for the signed host launch message before creating the SDK client. Runtime access is limited to the capability and installation scope issued by the host.

The local `dev` bridge supplies an in-memory data store and basic task responses. It is intended for UI and SDK integration checks; production authorization and container isolation remain server-side acceptance requirements.
