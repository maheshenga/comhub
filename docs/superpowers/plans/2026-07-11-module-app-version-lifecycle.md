# Module App Version And Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make published versions immutable and provide safe install pinning, compatibility checks, canary upgrades, schema recovery, rollback, uninstall retention, restoration, cleanup, and paginated installed-app management.

**Architecture:** Treat each published artifact and manifest as immutable. Installation lifecycle transitions are persisted and audited; upgrades prepare a compatibility report and recovery point before switching version. Uninstall disables execution immediately but moves data into a leased retention/cleanup pipeline modeled after current package cleanup.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, S3-compatible storage, TRPC, React/SWR, Vitest.

## Global Constraints

- Execute after migration `0138`; this plan owns migration `0139`.
- Never mutate a published version, artifact hash, manifest, permission set, or price snapshot.
- Version selection is installation-specific and must not be inferred from the latest app row during execution.
- Automatic upgrades may apply patch versions only and cannot add permissions, raise price, or run destructive migrations.
- Rollback is automatic only when the active data schema is backward compatible.
- Uninstall revokes execution immediately but retains data for the configured period.
- Orders, ledger, revenue, and audit records are never deleted by uninstall cleanup.
- Cleanup claims use `FOR UPDATE SKIP LOCKED`, expiring leases, bounded batches, and idempotent object deletion.
- Core lifecycle transitions require tests before implementation.

---

## File Structure

- `packages/types/src/moduleAppLifecycle.ts`: version channel, policy, compatibility, upgrade, rollback, uninstall, and pagination contracts.
- `packages/database/migrations/0139_add_module_app_lifecycle.sql`: immutable version keys, lifecycle state, recovery points, and cleanup jobs.
- `packages/database/src/models/moduleAppLifecycle.ts`: lifecycle transitions and cleanup claims.
- `packages/business-server/src/module-apps/lifecycle/`: compatibility, upgrade, rollback, and retention services.
- `apps/server/src/services/moduleAppLifecycle/`: S3 recovery exports and cleanup orchestration.
- `src/features/ModuleAppMarket/MyAppsOverview.tsx`: paginated lifecycle management.
- `src/features/Admin/moduleApps/`: version channel, canary, and emergency lifecycle controls.

### Task 1: Lifecycle Contracts And Schema

**Files:**
- Create: `packages/types/src/moduleAppLifecycle.ts`
- Create: `packages/types/src/moduleAppLifecycle.test.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/database/migrations/0139_add_module_app_lifecycle.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`

**Interfaces:**
- Produces: lifecycle schemas and Drizzle tables for recovery and cleanup.
- Consumes: immutable artifact and schema versions from plans 1 and 2.

- [ ] **Step 1: Add failing contract and migration tests**

```ts
expect(moduleAppUpgradePolicySchema.parse({ channel: 'stable', mode: 'manual' })).toBeTruthy();
expect(() => moduleAppUpgradePolicySchema.parse({ channel: 'stable', mode: 'auto-major' })).toThrow();
expect(moduleAppInstallationStatusSchema.options).toEqual(expect.arrayContaining([
  'installed', 'upgrading', 'retained', 'cleanup_pending', 'removed', 'suspended',
]));
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/types/src/moduleAppLifecycle.test.ts packages/database/src/schemas/moduleApp.schema.test.ts`

Expected: FAIL because lifecycle contracts and migration `0139` do not exist.

- [ ] **Step 3: Implement contracts and migration**

```ts
export const moduleAppReleaseChannelSchema = z.enum(['test', 'stable']);
export const moduleAppUpgradeModeSchema = z.enum(['manual', 'auto_patch', 'pinned']);
export const moduleAppInstallationStatusSchema = z.enum([
  'installed', 'upgrading', 'retained', 'cleanup_pending', 'removed', 'suspended', 'revoked',
]);
```

Add unique `(app_id, version)` and `(app_id, artifact_sha256)` constraints, version channel and compatibility fields, installation upgrade policy and lifecycle timestamps, `module_app_recovery_points`, `module_app_upgrade_attempts`, and `module_app_cleanup_jobs`. Preserve existing installation rows as `installed` and `manual`.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/types/src/moduleAppLifecycle.ts packages/types/src/moduleAppLifecycle.test.ts packages/types/src/index.ts packages/database/migrations/0139_add_module_app_lifecycle.sql packages/database/migrations/meta/_journal.json packages/database/src/schemas/moduleApp.ts packages/database/src/schemas/moduleApp.schema.test.ts
git commit -m "feat: define module app lifecycle persistence"
```

### Task 2: Published Version Immutability And Channels

**Files:**
- Create: `packages/database/src/models/moduleAppLifecycle.ts`
- Create: `packages/database/src/models/__tests__/moduleAppLifecycle.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/database/src/models/moduleApp.package.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`

**Interfaces:**
- Produces: `publishVersion`, `promoteVersion`, `suspendVersion`, and installation version resolution.
- Replaces mutable publication assumptions in `ModuleAppModel.setStatus` for executable versions.

- [ ] **Step 1: Add failing immutability tests**

```ts
await lifecycle.publishVersion({ channel: 'test', versionId });
await expect(lifecycle.updatePublishedManifest({ manifest, versionId })).rejects.toThrow('MODULE_APP_VERSION_IMMUTABLE');
await lifecycle.promoteVersion({ from: 'test', to: 'stable', versionId });
expect(await lifecycle.resolveInstallVersion({ appId, channel: 'stable' })).toMatchObject({ id: versionId });
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleAppLifecycle.test.ts packages/database/src/models/moduleApp.package.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`

Expected: FAIL because versions are not fully immutable or channel-aware.

- [ ] **Step 3: Enforce immutable publication**

```ts
export interface PublishModuleAppVersionInput {
  actorUserId: string;
  channel: 'test' | 'stable';
  versionId: string;
}
```

Require successful build, approved package, artifact hash, manifest hash, and compatibility metadata. Promotion changes channel visibility only; it never rewrites the version. Block deletion of versions referenced by installations, orders, runs, recovery points, or audit records.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/database/src/models/moduleAppLifecycle.ts packages/database/src/models/__tests__/moduleAppLifecycle.test.ts packages/database/src/models/moduleApp.ts packages/database/src/models/moduleApp.package.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts
git commit -m "feat: enforce immutable module app releases"
```

### Task 3: Upgrade Compatibility And Recovery Points

**Files:**
- Create: `packages/business-server/src/module-apps/lifecycle/compatibility.ts`
- Create: `packages/business-server/src/module-apps/lifecycle/compatibility.test.ts`
- Create: `packages/business-server/src/module-apps/lifecycle/upgrade.ts`
- Create: `packages/business-server/src/module-apps/lifecycle/upgrade.test.ts`
- Create: `apps/server/src/services/moduleAppLifecycle/recovery.ts`
- Create: `apps/server/src/services/moduleAppLifecycle/recovery.test.ts`
- Modify: `packages/database/src/models/moduleAppLifecycle.ts`

**Interfaces:**
- Produces: `compareModuleAppVersions`, `prepareUpgrade`, `applyUpgrade`, and `createRecoveryPoint`.
- Consumes: managed data schema versions and FileS3.

- [ ] **Step 1: Add failing compatibility tests**

```ts
expect(compareModuleAppVersions(current, patchWithSamePermissions)).toMatchObject({ automatic: true });
expect(compareModuleAppVersions(current, versionWithNewPermission)).toMatchObject({ automatic: false, requiresConsent: true });
expect(compareModuleAppVersions(current, destructiveSchemaVersion)).toMatchObject({ destructive: true, automatic: false });
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/lifecycle/compatibility.test.ts packages/business-server/src/module-apps/lifecycle/upgrade.test.ts apps/server/src/services/moduleAppLifecycle/recovery.test.ts`

Expected: FAIL because compatibility and recovery services are absent.

- [ ] **Step 3: Implement upgrade preparation**

```ts
export type ModuleAppUpgradeReport = {
  automatic: boolean;
  destructive: boolean;
  fromVersionId: string;
  permissionChanges: string[];
  priceChanged: boolean;
  requiresConsent: boolean;
  schemaChanges: ModuleAppSchemaChange[];
  toVersionId: string;
};
```

Create a recovery manifest containing installation, current version, data schema versions, row counts, and S3 export keys before any schema change. Apply additive logical-schema changes transactionally, then atomically switch `installation.versionId`. Keep the old version active if preparation, export, migration, or switch fails.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS, including failed export, failed migration, and concurrent upgrade attempts.

```bash
git add packages/business-server/src/module-apps/lifecycle apps/server/src/services/moduleAppLifecycle/recovery.ts apps/server/src/services/moduleAppLifecycle/recovery.test.ts packages/database/src/models/moduleAppLifecycle.ts
git commit -m "feat: prepare recoverable module app upgrades"
```

### Task 4: Canary Upgrade And Rollback

**Files:**
- Create: `packages/business-server/src/module-apps/lifecycle/rollback.ts`
- Create: `packages/business-server/src/module-apps/lifecycle/rollback.test.ts`
- Modify: `packages/business-server/src/module-apps/lifecycle/upgrade.ts`
- Modify: `packages/business-server/src/module-apps/lifecycle/upgrade.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`
- Modify: `packages/database/src/models/moduleAppLifecycle.ts`

**Interfaces:**
- Produces: deterministic canary selection, `rollbackInstallation`, and `rollbackVersionCohort`.
- Consumes: recovery points from Task 3.

- [ ] **Step 1: Add failing canary and rollback tests**

```ts
expect(selectCanary({ installationId: 'stable-id', percentage: 10 })).toBe(selectCanary({ installationId: 'stable-id', percentage: 10 }));
await rollback.rollbackInstallation({ installationId, targetVersionId: oldVersionId });
expect(await installation()).toMatchObject({ versionId: oldVersionId, status: 'installed' });
await expect(rollback.rollbackInstallation({ installationId, targetVersionId: incompatibleId })).rejects.toThrow('MODULE_APP_ROLLBACK_RESTORE_REQUIRED');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/lifecycle/rollback.test.ts packages/business-server/src/module-apps/lifecycle/upgrade.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts`

Expected: FAIL because canary and rollback operations are absent.

- [ ] **Step 3: Implement safe rollback**

Use a stable hash of installation ID for canary selection. Automatic rollback switches code only when the target declares compatibility with the active schema. Otherwise require an explicit restore of the recovery point or an approved reverse migration. Persist attempt status, actor, reason, source/target versions, and recovery point.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/business-server/src/module-apps/lifecycle/rollback.ts packages/business-server/src/module-apps/lifecycle/rollback.test.ts packages/business-server/src/module-apps/lifecycle/upgrade.ts packages/business-server/src/module-apps/lifecycle/upgrade.test.ts packages/business-server/src/lambda-routers/admin/moduleApps.ts packages/business-server/src/lambda-routers/admin/moduleApps.test.ts packages/database/src/models/moduleAppLifecycle.ts
git commit -m "feat: canary and rollback module app upgrades"
```

### Task 5: Uninstall Retention, Restore, And Cleanup

**Files:**
- Create: `packages/business-server/src/module-apps/lifecycle/uninstall.ts`
- Create: `packages/business-server/src/module-apps/lifecycle/uninstall.test.ts`
- Create: `apps/server/src/services/moduleAppLifecycle/cleanup.ts`
- Create: `apps/server/src/services/moduleAppLifecycle/cleanup.test.ts`
- Modify: `packages/database/src/models/moduleAppLifecycle.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
- Modify: `src/app/(backend)/api/admin/maintenance/route.ts`
- Modify: `src/app/(backend)/api/admin/maintenance/route.test.ts`

**Interfaces:**
- Produces: `uninstall`, `restore`, `claimExpiredCleanup`, and `runModuleAppCleanup`.
- Consumes: FileS3 and current maintenance endpoint conventions.

- [ ] **Step 1: Add failing lifecycle and lease tests**

```ts
const retained = await service.uninstall({ actorUserId, installationId, retentionDays: 30 });
expect(retained.status).toBe('retained');
await expect(launch(installationId)).rejects.toThrow('MODULE_APP_INSTALLATION_INACTIVE');
await service.restore({ actorUserId, installationId });
expect((await installation()).status).toBe('installed');
```

Prove two cleanup workers cannot claim the same installation and a failed object deletion remains retryable.

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/business-server/src/module-apps/lifecycle/uninstall.test.ts apps/server/src/services/moduleAppLifecycle/cleanup.test.ts packages/business-server/src/lambda-routers/admin/settings.test.ts 'src/app/(backend)/api/admin/maintenance/route.test.ts'`

Expected: FAIL because retention and cleanup do not exist.

- [ ] **Step 3: Implement immediate revocation and deferred deletion**

Uninstall revokes capabilities, disables schedules/webhooks, rejects new jobs, marks queued nodes cancelled, and sets retention expiry. Cleanup deletes app-owned rows, files, artifact object copies, webhook secrets, and installation secrets in bounded stages. It must not delete orders, ledger, revenue, or audit rows. Restore is allowed only before cleanup starts and must not recreate expired licenses.

- [ ] **Step 4: Verify and commit**

Run the focused command from Step 2.

Expected: PASS.

```bash
git add packages/business-server/src/module-apps/lifecycle/uninstall.ts packages/business-server/src/module-apps/lifecycle/uninstall.test.ts apps/server/src/services/moduleAppLifecycle/cleanup.ts apps/server/src/services/moduleAppLifecycle/cleanup.test.ts packages/database/src/models/moduleAppLifecycle.ts packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/app/'(backend)'/api/admin/maintenance/route.ts src/app/'(backend)'/api/admin/maintenance/route.test.ts
git commit -m "feat: retain and clean uninstalled module apps"
```

### Task 6: Paginated Installation And Lifecycle UI

**Files:**
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/database/src/models/__tests__/moduleApp.marketplace.test.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.ts`
- Modify: `apps/server/src/routers/lambda/moduleApp.test.ts`
- Modify: `src/services/moduleApp.ts`
- Modify: `src/services/moduleApp.test.ts`
- Modify: `src/features/ModuleAppMarket/MyAppsOverview.tsx`
- Modify: `src/features/ModuleAppMarket/MyAppsOverview.test.tsx`
- Create: `src/features/ModuleAppMarket/UpgradeModal.tsx`
- Create: `src/features/ModuleAppMarket/UpgradeModal.test.tsx`
- Modify: `src/features/Admin/moduleApps/InstallsTable.tsx`
- Modify: `src/features/Admin/moduleApps/tables.test.tsx`

**Interfaces:**
- Produces: cursor-paginated installed apps plus upgrade, rollback, uninstall, restore, and policy controls.
- Consumes: lifecycle services from Tasks 2-5.

- [ ] **Step 1: Add failing pagination and confirmation tests**

```ts
expect(await service.listMyApps({ cursor: null, limit: 20, status: 'installed' })).toMatchObject({ items: expect.any(Array), nextCursor: expect.anything() });
expect(screen.getByText('新增权限')).toBeVisible();
expect(screen.getByRole('button', { name: '确认升级' })).toBeDisabled();
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/moduleApp.marketplace.test.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.test.ts src/features/ModuleAppMarket/MyAppsOverview.test.tsx src/features/ModuleAppMarket/UpgradeModal.test.tsx src/features/Admin/moduleApps/tables.test.tsx`

Expected: FAIL because installed lists are unpaginated and lifecycle UI is absent.

- [ ] **Step 3: Implement cursor pagination and explicit lifecycle states**

Use `(updatedAt, id)` opaque cursor ordering. Display installed version, available version, channel, policy, permission/price/schema changes, retention deadline, cleanup state, and last lifecycle error. Require explicit confirmation for new permissions, destructive migration, rollback with restore, and uninstall.

- [ ] **Step 4: Run plan verification**

Run the focused command from Step 2.

Expected: PASS.

Run: `bun run type-check`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Update governance docs and commit**

Update `docs/FEATURE_REGISTRY.md` and `docs/CHANGELOG_INTERNAL.md` with version immutability, migration `0139`, S3 recovery, cleanup scheduling, and rollback limits.

```bash
git add packages/database/src/models/moduleApp.ts packages/database/src/models/__tests__/moduleApp.marketplace.test.ts apps/server/src/routers/lambda/moduleApp.ts apps/server/src/routers/lambda/moduleApp.test.ts src/services/moduleApp.ts src/services/moduleApp.test.ts src/features/ModuleAppMarket src/features/Admin/moduleApps/InstallsTable.tsx src/features/Admin/moduleApps/tables.test.tsx docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
git commit -m "feat: manage module app lifecycle from installed apps"
```

## Plan Acceptance Gate

- Published versions and hashes cannot mutate or disappear while referenced.
- Every installation is pinned to one explicit version and channel policy.
- Upgrade reports cover SDK, permissions, price, entitlement, and schema compatibility.
- Failed upgrades leave the prior version active.
- Automatic rollback occurs only for compatible schemas; destructive rollback requires restore or reverse migration.
- Uninstall immediately blocks execution and defers data deletion through a leased cleanup job.
- Restore works only within retention and never recreates an expired license.
- Installed lists are cursor-paginated for personal, team, and admin views.
- Targeted tests, type-check, and `git diff --check` pass.
