# User Default Settings Sync Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin-to-user default settings sync rules explicit, test-covered, auditable, and safe for user-customized default assistant name/avatar.

**Architecture:** Keep the existing `user.globalSettings.defaults` storage and tRPC mutation. Add a small sync options object so the current button can continue forcing values into user settings, while tests document the default merge behavior and the explicit force behavior.

**Tech Stack:** TypeScript, tRPC router in `packages/business-server`, Vitest, React/antd admin page.

## Global Constraints

- Do not rewrite the admin settings system in this slice.
- Do not change database schema.
- Preserve existing user defaults API shape where possible.
- Use TDD: write failing tests before production code.
- Keep changes scoped to admin user-default sync, docs, and client service wiring.
- Do not deploy or push in this slice.

---

### Task 1: Add priority matrix tests

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`

**Interfaces:**
- Consumes: `syncUserGlobalSettingsDefaultsToUserSettings(db, defaults, options?)`
- Produces: `UserSettingsSyncOptions` with `forceDefaultAgentMeta?: boolean`

- [ ] **Step 1: Write failing tests**

Add tests under the existing admin settings router suite:

```typescript
it('preserves user default assistant meta when default agent meta sync is not forced', async () => {
  const defaults = {
    defaultAgent: {
      config: { model: 'gpt-5.5', provider: 'newapi' },
      meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
    },
  };
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const selectUsersFrom = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
  const selectSettingsWhere = vi.fn().mockResolvedValue([
    {
      defaultAgent: {
        config: { model: 'old-model', provider: 'old-provider' },
        meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
      },
      id: 'user-1',
    },
  ]);
  const selectSettingsFrom = vi.fn(() => ({ where: selectSettingsWhere }));
  const select = vi.fn().mockReturnValueOnce({ from: selectUsersFrom }).mockReturnValueOnce({
    from: selectSettingsFrom,
  });
  const db = { insert, select } as any;

  await syncUserGlobalSettingsDefaultsToUserSettings(db, defaults);

  expect(values).toHaveBeenCalledWith([
    {
      defaultAgent: {
        config: { model: 'gpt-5.5', provider: 'newapi' },
        meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
      },
      id: 'user-1',
    },
  ]);
});

it('overwrites user default assistant meta when admin sync explicitly forces meta', async () => {
  const defaults = {
    defaultAgent: {
      config: { model: 'gpt-5.5', provider: 'newapi' },
      meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
    },
  };
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const selectUsersFrom = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
  const selectSettingsWhere = vi.fn().mockResolvedValue([
    {
      defaultAgent: {
        config: { model: 'old-model', provider: 'old-provider' },
        meta: { avatar: '/avatars/custom.png', title: 'Custom assistant' },
      },
      id: 'user-1',
    },
  ]);
  const selectSettingsFrom = vi.fn(() => ({ where: selectSettingsWhere }));
  const select = vi.fn().mockReturnValueOnce({ from: selectUsersFrom }).mockReturnValueOnce({
    from: selectSettingsFrom,
  });
  const db = { insert, select } as any;

  await syncUserGlobalSettingsDefaultsToUserSettings(db, defaults, {
    forceDefaultAgentMeta: true,
  });

  expect(values).toHaveBeenCalledWith([
    {
      defaultAgent: {
        config: { model: 'gpt-5.5', provider: 'newapi' },
        meta: { avatar: '/avatars/admin.png', title: 'Admin assistant' },
      },
      id: 'user-1',
    },
  ]);
});
```

- [ ] **Step 2: Run red test**

Run from `packages/business-server`:

```powershell
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/settings.test.ts"
```

Expected: the first new test fails because incoming `defaultAgent.meta` currently overwrites the user meta even without an explicit force option, and the third argument is not supported yet.

- [ ] **Step 3: Implement minimal sync options**

Add:

```typescript
type UserSettingsSyncOptions = {
  forceDefaultAgentMeta?: boolean;
};
```

Update `mergeDefaultAgentSyncValue`:

```typescript
const mergeDefaultAgentSyncValue = (
  existing: unknown,
  incoming: unknown,
  options: UserSettingsSyncOptions = {},
) => {
  const incomingDefaultAgent = getRecordValue(incoming);
  if (!incomingDefaultAgent) return incoming;

  const existingDefaultAgent = getRecordValue(existing) ?? {};
  const incomingConfig = getRecordValue(incomingDefaultAgent.config);
  const incomingMeta = getRecordValue(incomingDefaultAgent.meta);
  const existingMeta = getNestedRecordValue(existingDefaultAgent, 'meta');

  const merged = incomingConfig
    ? {
        ...existingDefaultAgent,
        ...incomingDefaultAgent,
        config: {
          ...(getNestedRecordValue(existingDefaultAgent, 'config') ?? {}),
          ...incomingConfig,
        },
      }
    : { ...existingDefaultAgent, ...incomingDefaultAgent };

  if (incomingMeta && existingMeta && !options.forceDefaultAgentMeta) {
    return {
      ...merged,
      meta: existingMeta,
    };
  }

  return merged;
};
```

Update `syncUserGlobalSettingsDefaultsToUserSettings(db, defaults, options = {})` and pass options into `mergeDefaultAgentSyncValue`.

- [ ] **Step 4: Run green test**

Run the same Vitest command. Expected: all tests in `settings.test.ts` pass.

### Task 2: Wire explicit force option into admin sync action

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/features/Admin/AdminSystemDefaultsPage.tsx`

**Interfaces:**
- Consumes: `syncUserGlobalSettingsDefaultsToUsers({ forceDefaultAgentMeta?: boolean })`
- Produces: audit payload with `forceDefaultAgentMeta`

- [ ] **Step 1: Write failing router test**

Extend the existing `syncs saved user global defaults into all user settings rows` test or add a new one that calls:

```typescript
await caller.syncUserGlobalSettingsDefaultsToUsers({ forceDefaultAgentMeta: true });
```

Expected assertions:

```typescript
expect(recordAdminAudit).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({
    action: 'settings.syncUserDefaults',
    payload: expect.objectContaining({
      forceDefaultAgentMeta: true,
    }),
  }),
);
```

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/settings.test.ts"
```

Expected: the mutation currently accepts no input and does not include the force flag in audit payload.

- [ ] **Step 3: Implement router input**

Add a small schema:

```typescript
const syncUserGlobalSettingsDefaultsInputSchema = z
  .object({
    forceDefaultAgentMeta: z.boolean().optional(),
  })
  .optional();
```

Update mutation:

```typescript
syncUserGlobalSettingsDefaultsToUsers: systemWriteProcedure
  .input(syncUserGlobalSettingsDefaultsInputSchema)
  .mutation(async ({ ctx, input }) => {
    const options = { forceDefaultAgentMeta: input?.forceDefaultAgentMeta === true };
    const defaults = await readSetting(ctx.serverDB, SETTING_KEYS.userGlobalSettingsDefaults);
    await validateUserGlobalSettingsDefaults(ctx.serverDB, defaults);
    const result = await syncUserGlobalSettingsDefaultsToUserSettings(
      ctx.serverDB,
      defaults,
      options,
    );

    await recordAdminAudit(ctx, {
      action: 'settings.syncUserDefaults',
      payload: { ...result, ...options },
      resourceId: SETTING_KEYS.userGlobalSettingsDefaults,
      resourceType: 'user_settings',
    });

    return { ok: true, ...result, ...options };
  }),
```

- [ ] **Step 4: Update client service and admin button**

Change client service:

```typescript
syncUserGlobalSettingsDefaultsToUsers = async (params?: { forceDefaultAgentMeta?: boolean }) => {
  return lambdaClient.admin.settings.syncUserGlobalSettingsDefaultsToUsers.mutate(params);
};
```

Change the existing danger sync button call:

```typescript
onOk: () => handleSave({ forceDefaultAgentMeta: true, syncToUsers: true }),
```

Change `handleSave` signature:

```typescript
const handleSave = async ({
  forceDefaultAgentMeta = false,
  syncToUsers = false,
}: {
  forceDefaultAgentMeta?: boolean;
  syncToUsers?: boolean;
} = {}) => {
```

Pass the flag:

```typescript
const result = await adminCommercialService.syncUserGlobalSettingsDefaultsToUsers({
  forceDefaultAgentMeta,
});
```

- [ ] **Step 5: Run green test**

Run the same Vitest command. Expected: all tests in `settings.test.ts` pass.

### Task 3: Update governance docs and verify

**Files:**
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Produces: GOV-028 entry and feature registry note.

- [ ] **Step 1: Add changelog entry**

Add a GOV-028 entry describing:

```markdown
- GOV-028: Added explicit user-default sync priority coverage. Default assistant meta is preserved by default during backend default sync, while admin "save and sync" can explicitly force default assistant meta into existing users and records the force flag in audit payload.
```

- [ ] **Step 2: Add registry note**

Append to Governance Execution Notes:

```markdown
| 2026-07-07 | User Default Settings Sync Priority | active | GOV-028 documents and tests the priority rule for backend defaults, user-customized default assistant meta, and explicit admin force-sync snapshots. |
```

- [ ] **Step 3: Verify**

Run:

```powershell
git diff --check
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/settings.test.ts"
```

Expected:
- `git diff --check` exits 0.
- Vitest exits 0 with all tests in the target file passing.

- [ ] **Step 4: Review and commit**

Review:

```powershell
git diff -- packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/services/adminCommercial.ts src/features/Admin/AdminSystemDefaultsPage.tsx docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git status --short
```

Commit:

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-user-default-sync-priority.md
git add packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/services/adminCommercial.ts src/features/Admin/AdminSystemDefaultsPage.tsx docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":shield: guard user default settings sync priority" -m "Constraint: preserve user-customized default assistant meta unless admin force-sync is explicit." -m "Tested: cd packages/business-server; bunx vitest run --silent='passed-only' \"src/lambda-routers/admin/settings.test.ts\"" -m "Scope-risk: admin default settings sync and audit payload only."
```

