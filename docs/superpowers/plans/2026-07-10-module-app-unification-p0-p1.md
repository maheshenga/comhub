# Module App Platform Unification P0/P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze Platform Plugin Marketplace as a deprecated product track and move the missing source/review governance pieces into Module App Platform.

**Architecture:** Keep Module App Platform as the sole extensibility domain while leaving old Platform Plugin code compiling until a later removal slice. P0 updates governance and changelog state. P1 adds a typed `source` field to Module Apps, stores it in `module_apps`, preserves it in version snapshots, exposes it in admin list/detail responses, and adds an admin package review queue to `/settings/admin/module-apps`.

**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, TRPC lambda routers, React 19, Ant Design, SWR, Vitest.

## Global Constraints

- Internal Module App domain stays stable: `module_app_*`, `ModuleAppModel`, `lambda.moduleApp`, `admin.moduleApps`, `ModuleAppMarket`, `ModuleAppRuntime`, `Admin/moduleApps`.
- Supported Module App sources are exactly `system`, `admin`, `user`, and `developer`.
- Platform Plugin Marketplace is deprecated and must not receive new product features.
- MCP and Skills remain unchanged.
- No uploaded code execution, iframe, remote module, Docker runtime, MCP runtime, or Skill runtime is introduced in this slice.
- Do not drop or rename production `platform_plugin_*` tables in P0/P1.
- Database drops for Platform Plugin are deferred until backup and explicit production safety confirmation.

---

## File Structure

- Modify `docs/FEATURE_REGISTRY.md`: mark Platform Plugin Marketplace as deprecated and Module App Platform as the target extensibility platform.
- Modify `docs/CHANGELOG_INTERNAL.md`: record this P0/P1 unification slice.
- Modify `packages/types/src/moduleApp.ts`: add `moduleAppSourceSchema`, export `ModuleAppSource`, add `source` to admin upsert/package manifest app schemas.
- Modify `packages/types/src/moduleApp.test.ts`: prove source defaults to `admin`, accepts `system/user/developer`, and rejects invalid sources.
- Modify `packages/database/src/schemas/moduleApp.ts`: add `source` column to `moduleApps` with default `admin`.
- Create `packages/database/migrations/0133_add_module_app_source.sql`: add source column and check constraint.
- Modify `packages/database/migrations/meta/_journal.json`: register `0133_add_module_app_source`.
- Modify `packages/database/src/schemas/moduleApp.schema.test.ts`: assert migration and journal registration.
- Modify `packages/database/src/models/moduleApp.ts`: persist source, include source in list/detail items and manifest snapshots, default package approvals to `developer`.
- Modify `packages/database/src/models/moduleApp.package.test.ts`: assert approved package-created apps are stored with `source: 'developer'`.
- Modify `src/features/Admin/moduleApps/types.ts`: include source and package row types for admin UI.
- Modify `src/features/Admin/moduleApps/index.tsx`: add source column, source overview row, and package review queue tab with approve/reject actions.
- Modify `src/features/Admin/moduleApps/tables.test.tsx` or create `src/features/Admin/moduleApps/packageReview.test.tsx`: render package review table and interaction surface.
- Modify `src/features/Admin/adminNavigation.ts`: update the Module App admin group descriptions so new extensibility work points at Module Apps. Keep current labels and Platform Plugin route visible for this P0/P1 slice; visible removal/renaming is saved for P3.

## Task 1: Governance Freeze

**Files:**
- Modify: `docs/FEATURE_REGISTRY.md`
- Modify: `docs/CHANGELOG_INTERNAL.md`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-07-10-module-app-platform-unification-design.md`
- Produces: documented P0 state that Platform Plugin Marketplace is deprecated and Module App Platform is the only target extensibility domain.

- [ ] **Step 1: Update feature registry status**

Change the Platform Plugin Marketplace summary row from:

```markdown
| Platform Plugin Marketplace | `experimental` | ...
```

to:

```markdown
| Platform Plugin Marketplace | `deprecated` | ...
```

Add a short note under the Platform Plugin Marketplace section:

```markdown
#### Platform Plugin Marketplace Deprecation Freeze

- Status: deprecated
- Decision: New extensibility, app marketplace, module factory, package submission, billing, and runtime work must target Module App Platform.
- Compatibility: Existing code remains only until Module App parity and product surface cutover are complete.
- Safety: Do not drop `platform_plugin_*` tables until backup and production safety confirmation are complete.
- Boundary: MCP and Skills are not part of this removal.
```

- [ ] **Step 2: Update Module App Platform registry note**

Append this note under the Module App Platform section:

```markdown
#### Module App Platform Unification P0/P1

- Status: experimental
- Decision: Module App Platform is the sole long-term extensibility platform for system, admin-created, user-uploaded, and developer-submitted apps/modules.
- Source model: Apps must identify one source: `system`, `admin`, `user`, or `developer`.
- Review model: Submitted package review continues through `module_app_packages`; approval converts reviewed manifests into Module App records.
- Boundary: P0/P1 does not execute uploaded code and does not remove MCP or Skills.
```

- [ ] **Step 3: Update internal changelog**

Add a `2026-07-10` section above the current first dated section:

```markdown
## 2026-07-10

### Module App Platform Unification

- MODULE-APP-UNIFY-P0-001: Deprecated Platform Plugin Marketplace as a product track and redirected new extensibility work to Module App Platform.
- MODULE-APP-UNIFY-P1-001: Added Module App source ownership design for `system`, `admin`, `user`, and `developer` app sources.
- Boundary: Platform Plugin code and `platform_plugin_*` tables remain in place for later staged removal; MCP and Skills are unchanged.
```

- [ ] **Step 4: Review docs diff**

Run:

```bash
git diff -- docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md
```

Expected: only governance/changelog text changes.

## Task 2: Module App Source Contracts

**Files:**
- Modify: `packages/types/src/moduleApp.ts`
- Modify: `packages/types/src/moduleApp.test.ts`

**Interfaces:**
- Produces: `moduleAppSourceSchema`, `ModuleAppSource`, and `source` on `ModuleAppAdminUpsertInput`.
- Consumes in later tasks: `ModuleAppSource` in database schema and admin UI types.

- [ ] **Step 1: Write failing contract tests**

Add `moduleAppSourceSchema` to the imports in `packages/types/src/moduleApp.test.ts`, then add:

```typescript
it('defaults admin-created apps to admin source and accepts reviewed sources', () => {
  expect(moduleAppSourceSchema.options).toEqual(['system', 'admin', 'user', 'developer']);

  expect(
    moduleAppAdminUpsertSchema.parse({
      actions: [],
      appType: 'standard_app',
      billing: {},
      category: 'office',
      description: 'Admin-created module.',
      displayName: 'Admin Module',
      icon: 'Blocks',
      pages: [],
      slug: 'admin-module',
      status: 'draft',
      tags: [],
    }).source,
  ).toBe('admin');

  expect(
    moduleAppAdminUpsertSchema.parse({
      actions: [],
      appType: 'standard_app',
      billing: {},
      category: 'developer',
      description: 'Developer submitted module.',
      displayName: 'Developer Module',
      icon: 'Package',
      pages: [],
      slug: 'developer-module',
      source: 'developer',
      status: 'draft',
      tags: [],
    }).source,
  ).toBe('developer');

  expect(() =>
    moduleAppAdminUpsertSchema.parse({
      actions: [],
      appType: 'standard_app',
      billing: {},
      category: 'bad',
      description: 'Invalid source.',
      displayName: 'Invalid Source',
      icon: 'Package',
      pages: [],
      slug: 'invalid-source',
      source: 'plugin',
      status: 'draft',
      tags: [],
    }),
  ).toThrow();
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd packages/types && bunx vitest run --silent='passed-only' src/moduleApp.test.ts
```

Expected: FAIL because `moduleAppSourceSchema` and `source` do not exist yet.

- [ ] **Step 3: Implement source schema**

In `packages/types/src/moduleApp.ts`, add after `moduleAppStatusSchema`:

```typescript
export const moduleAppSourceSchema = z.enum(['system', 'admin', 'user', 'developer']);
export type ModuleAppSource = z.infer<typeof moduleAppSourceSchema>;
```

Add `source` to `moduleAppAdminUpsertSchema`:

```typescript
source: moduleAppSourceSchema.default('admin'),
```

Keep `moduleAppPackageManifestSchema` using `moduleAppAdminUpsertSchema.omit({ id: true })` so package manifests may declare source, but model approval can force `developer` when absent.

- [ ] **Step 4: Run passing type contract test**

Run:

```bash
cd packages/types && bunx vitest run --silent='passed-only' src/moduleApp.test.ts
```

Expected: PASS.

## Task 3: Database Source Persistence

**Files:**
- Modify: `packages/database/src/schemas/moduleApp.ts`
- Create: `packages/database/migrations/0133_add_module_app_source.sql`
- Modify: `packages/database/migrations/meta/_journal.json`
- Modify: `packages/database/src/schemas/moduleApp.schema.test.ts`
- Modify: `packages/database/src/models/moduleApp.ts`
- Modify: `packages/database/src/models/moduleApp.package.test.ts`

**Interfaces:**
- Consumes: `ModuleAppSource` from `@lobechat/types`.
- Produces: `module_apps.source` persisted with default `admin`.

- [ ] **Step 1: Write migration guard tests**

In `packages/database/src/schemas/moduleApp.schema.test.ts`, add:

```typescript
it('registers the module app source migration', () => {
  const migration = readFileSync(
    resolve(__dirname, '../../migrations/0133_add_module_app_source.sql'),
    'utf8',
  );
  const journal = JSON.parse(
    readFileSync(resolve(__dirname, '../../migrations/meta/_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> };

  expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'admin' NOT NULL`);
  expect(migration).toContain('module_apps_source_check');
  expect(migration).toContain(`IN ('system', 'admin', 'user', 'developer')`);
  expect(journal.entries.some(({ tag }) => tag === '0133_add_module_app_source')).toBe(true);
});
```

- [ ] **Step 2: Write model expectation**

In `packages/database/src/models/moduleApp.package.test.ts`, update the approval assertion:

```typescript
expect(insertValuesByTable.get(moduleApps)).toEqual(
  expect.objectContaining({
    displayName: 'Package App',
    slug: 'package-app',
    source: 'developer',
  }),
);
```

- [ ] **Step 3: Run failing database tests**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' src/schemas/moduleApp.schema.test.ts src/models/moduleApp.package.test.ts
```

Expected: FAIL because migration, schema column, and model source persistence are missing.

- [ ] **Step 4: Add schema column**

In `packages/database/src/schemas/moduleApp.ts`, import `ModuleAppSource` and add to `moduleApps`:

```typescript
source: text('source').$type<ModuleAppSource>().default('admin').notNull(),
```

- [ ] **Step 5: Add migration and journal entry**

Create `packages/database/migrations/0133_add_module_app_source.sql`:

```sql
ALTER TABLE "module_apps"
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'admin' NOT NULL;

DO $$ BEGIN
 ALTER TABLE "module_apps"
  ADD CONSTRAINT "module_apps_source_check"
  CHECK ("source" IN ('system', 'admin', 'user', 'developer'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
```

Append a journal entry with `idx: 133`, `tag: "0133_add_module_app_source"`, `breakpoints: true`, and a current `when` timestamp matching existing journal style.

- [ ] **Step 6: Persist source in model**

In `packages/database/src/models/moduleApp.ts`:

Add `ModuleAppSource` import only if the compiler needs explicit helper typing.

Include `source` in `toListItem`:

```typescript
source: app.source,
```

Include `source` in `ensureVersionSnapshot`:

```typescript
source: input.source,
```

Set `source` in `appValues`:

```typescript
source: input.source,
```

Force approved packages to developer unless the reviewed manifest explicitly uses `system`, `admin`, or `user` and later policy decides otherwise. For this slice, use:

```typescript
const normalized = normalizePackageManifestForApproval(submission.manifestSnapshot);
const appInput = { ...normalized.app, source: 'developer' as const };
const app = await this.upsertAppForAdminWithExecutor(appInput, tx);
```

Pass `appInput` to `publishedAt` checks:

```typescript
publishedAt: appInput.status === 'published' ? (version.publishedAt ?? now) : null,
```

- [ ] **Step 7: Run passing database tests**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' src/schemas/moduleApp.schema.test.ts src/models/moduleApp.package.test.ts
```

Expected: PASS.

## Task 4: Admin Review Queue UI

**Files:**
- Modify: `src/features/Admin/moduleApps/types.ts`
- Modify: `src/features/Admin/moduleApps/index.tsx`
- Create: `src/features/Admin/moduleApps/packageReview.test.tsx`

**Interfaces:**
- Consumes: `adminCommercialService.moduleApps.listPackages`, `approvePackage`, `rejectPackage`.
- Produces: a "Package review" tab in `/settings/admin/module-apps` that lists pending submissions and lets admins approve/reject from the Module App surface.

- [ ] **Step 1: Add failing UI test**

Create `src/features/Admin/moduleApps/packageReview.test.tsx` with mocks for `useClientDataSWR`, `mutate`, and `adminCommercialService`, then render the page and assert:

```typescript
expect(screen.getByText('Package review')).toBeInTheDocument();
expect(screen.getByText('pending_review')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
```

Click approve and assert:

```typescript
expect(adminCommercialService.moduleApps.approvePackage).toHaveBeenCalledWith({
  packageId: '00000000-0000-4000-8000-000000000011',
});
```

- [ ] **Step 2: Run failing UI test**

Run:

```bash
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/packageReview.test.tsx
```

Expected: FAIL because the package review tab does not exist.

- [ ] **Step 3: Add package/source types**

In `src/features/Admin/moduleApps/types.ts`, import `ModuleAppPackageReviewStatus` and `ModuleAppSource`, add `source` to `AdminModuleAppItem`, and export:

```typescript
export type AdminModuleAppPackageRow = {
  appId?: null | string;
  createdAt?: Date | string;
  id: string;
  manifestSnapshot?: {
    app?: {
      displayName?: string;
      slug?: string;
      source?: ModuleAppSource;
    };
    packageVersion?: string;
  };
  rejectionReason?: null | string;
  reviewStatus: ModuleAppPackageReviewStatus;
  submittedByUserId?: null | string;
};
```

- [ ] **Step 4: Add admin page package state and SWR key**

In `src/features/Admin/moduleApps/index.tsx`, import `ModuleAppPackageReviewStatus` and `AdminModuleAppPackageRow`.

Add:

```typescript
type PackageStatusFilter = 'all' | ModuleAppPackageReviewStatus;

const packageStatusOptions: Array<{ label: string; value: PackageStatusFilter }> = [
  { label: 'All packages', value: 'all' },
  { label: 'Pending review', value: 'pending_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];
```

Inside the component:

```typescript
const [packageStatusFilter, setPackageStatusFilter] =
  useState<PackageStatusFilter>('pending_review');
const packagesKey = useMemo(
  () => ['admin-module-app-packages', packageStatusFilter],
  [packageStatusFilter],
);
```

Fetch:

```typescript
const { data: packagesData, isLoading: packagesLoading } = useClientDataSWR(
  packagesKey,
  () =>
    adminCommercialService.moduleApps.listPackages({
      limit: 100,
      reviewStatus: packageStatusFilter === 'all' ? undefined : packageStatusFilter,
    }) as Promise<ListResponse<AdminModuleAppPackageRow>>,
);
```

- [ ] **Step 5: Add approve/reject handlers**

Add:

```typescript
const refreshPackageData = async () => {
  await mutate(packagesKey);
};

const handleApprovePackage = (packageId: string) =>
  runMutation(async () => {
    await adminCommercialService.moduleApps.approvePackage({ packageId });
    await refreshPackageData();
    await refreshAppData();
  }, 'Package approved');

const handleRejectPackage = (packageId: string) =>
  runMutation(async () => {
    await adminCommercialService.moduleApps.rejectPackage({
      packageId,
      reason: 'Rejected from admin review queue',
    });
    await refreshPackageData();
  }, 'Package rejected');
```

- [ ] **Step 6: Add columns and tab**

Add a package table with columns for app name, slug, package version, review status, submitted user, created time, and approve/reject actions. Add it as a tab item:

```typescript
{
  children: (
    <Flexbox gap={12}>
      <Flexbox horizontal gap={8} justify="space-between">
        <Text type="secondary">
          Review user and developer submitted Module App packages before they become apps.
        </Text>
        <Select<PackageStatusFilter>
          options={packageStatusOptions}
          style={{ width: 180 }}
          value={packageStatusFilter}
          onChange={setPackageStatusFilter}
        />
      </Flexbox>
      <InlineTable
        columns={packageColumns as any}
        dataSource={packagesData?.items ?? []}
        loading={packagesLoading}
        rowKey="id"
      />
    </Flexbox>
  ),
  key: 'packages',
  label: 'Package review',
}
```

- [ ] **Step 7: Add source display**

Add `source` column to app list and overview:

```typescript
{
  dataIndex: 'source',
  key: 'source',
  render: (value: string) => <Tag>{value ?? 'admin'}</Tag>,
  title: 'Source',
}
```

Overview description:

```tsx
<Descriptions.Item label="Source">
  <Tag>{selectedApp.source ?? 'admin'}</Tag>
</Descriptions.Item>
```

- [ ] **Step 8: Run passing UI test**

Run:

```bash
bunx vitest run --silent='passed-only' src/features/Admin/moduleApps/packageReview.test.tsx src/features/Admin/moduleApps/tables.test.tsx
```

Expected: PASS.

## Task 5: Navigation Copy And Final Verification

**Files:**
- Modify: `src/features/Admin/adminNavigation.ts`
- Modify tests only if existing assertions depend on old copy.

**Interfaces:**
- Produces: admin navigation copy that treats Module App Platform as the target extensibility surface while Platform Plugin remains compatibility-only in this slice.

- [ ] **Step 1: Update admin navigation copy**

In the group with `key: 'plugins'`, update the group and item descriptions to say Module App Platform is the target app/module marketplace. Keep current labels and the `platform-plugins` item until P3 product surface removal.

- [ ] **Step 2: Run navigation tests**

Run:

```bash
bunx vitest run --silent='passed-only' src/features/Admin/adminNavigation.test.ts src/business/client/BusinessDesktopRoutes.test.ts
```

Expected: PASS after updating any copy-only assertions.

- [ ] **Step 3: Run full targeted verification**

Run:

```bash
cd packages/types && bunx vitest run --silent='passed-only' src/moduleApp.test.ts
cd ../database && bunx vitest run --silent='passed-only' src/schemas/moduleApp.schema.test.ts src/models/moduleApp.package.test.ts
cd ../business-server && bunx vitest run --silent='passed-only' src/lambda-routers/admin/moduleApps.test.ts
cd ..\\.. && bunx vitest run --silent='passed-only' src/services/adminCommercial.test.ts src/features/Admin/moduleApps/packageReview.test.tsx src/features/Admin/moduleApps/tables.test.tsx src/features/Admin/adminNavigation.test.ts src/business/client/BusinessDesktopRoutes.test.ts
bun run type-check
git diff --check
```

Expected: all targeted tests pass, type-check passes, and diff check has no output.

- [ ] **Step 4: Commit**

Run:

```bash
git add -f docs/superpowers/plans/2026-07-10-module-app-unification-p0-p1.md
git add docs/FEATURE_REGISTRY.md docs/CHANGELOG_INTERNAL.md packages/types/src/moduleApp.ts packages/types/src/moduleApp.test.ts packages/database/src/schemas/moduleApp.ts packages/database/src/schemas/moduleApp.schema.test.ts packages/database/src/models/moduleApp.ts packages/database/src/models/moduleApp.package.test.ts packages/database/migrations/0133_add_module_app_source.sql packages/database/migrations/meta/_journal.json src/features/Admin/moduleApps/types.ts src/features/Admin/moduleApps/index.tsx src/features/Admin/moduleApps/packageReview.test.tsx src/features/Admin/adminNavigation.ts
git commit -m "feat: unify module app source and review governance" -m "Constraint: Platform Plugin Marketplace remains compatibility-only until later removal slices." -m "Constraint: MCP and Skills unchanged." -m "Tested: targeted Module App type/database/admin UI/router tests, type-check, git diff --check."
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: P0 deprecation/freeze is covered by Task 1. P1 app source ownership is covered by Tasks 2 and 3. P1 admin package review console is covered by Task 4. Navigation copy is covered by Task 5. Platform Plugin route/code deletion and database table drops are intentionally excluded for later P3/P4/P5 slices.
- Placeholder scan: The plan contains no `TBD`, no `TODO`, no unspecified error handling, and no references to undefined functions.
- Type consistency: `ModuleAppSource`, `source`, `AdminModuleAppPackageRow`, and package review handler names are consistent across the planned type, database, model, and UI tasks.
