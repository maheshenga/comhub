# P3 Admin Settings Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the P2 settings governance view into a safe operator workflow: show where settings belong, and allow audited cleanup of unknown legacy keys without risking registered settings.

**Architecture:** Extend the pure governance output with display-friendly domain/cache group metadata, add a guarded backend mutation that can delete only unknown `app_settings` keys after exact confirmation, and wire the admin card to refresh after cleanup. Registered settings remain protected and cannot be deleted through this cleanup path.

**Tech Stack:** Next.js 16, React 19, TypeScript, TRPC, Drizzle/PostgreSQL, SWR, antd, Vitest.

---

## File Structure

- `src/server/services/appSettings/governance.ts`
  - Add stable domain/cache labels and helper `isUnknownAppSettingKey`.
- `src/server/services/appSettings/governance.test.ts`
  - Cover unknown key predicate and group metadata.
- `packages/business-server/src/lambda-routers/admin/settings.ts`
  - Add `deleteUnknownSetting` system-write mutation. It must reject registered keys, require exact confirmation, delete by key, and write audit.
- `packages/business-server/src/lambda-routers/admin/settings.test.ts`
  - Cover deleting unknown settings, rejecting registered settings, rejecting confirmation mismatch, and audit logging.
- `src/services/adminCommercial.ts`
  - Add `deleteUnknownAppSetting`.
- `src/features/Admin/AdminSettingsGovernanceCard.tsx`
  - Render domain/cache group summaries and unknown-key cleanup buttons using typed confirmation.
- `src/features/Admin/adminCommercialFlow.test.ts`
  - Static integration coverage for cleanup wiring and registered-key protection.

---

### Task 1: Extend Governance Metadata

**Files:**
- Modify: `src/server/services/appSettings/governance.ts`
- Modify: `src/server/services/appSettings/governance.test.ts`

- [ ] **Step 1: Add failing tests**

Extend `governance.test.ts`:

```typescript
it('marks unknown keys and includes readable group labels', () => {
  const result = buildAppSettingsGovernance([
    { key: APP_SETTING_KEYS.brandName, value: 'ComHub' },
    { key: 'legacy.unknown.key', value: true },
  ]);

  expect(result.unknownKeys).toEqual([{ key: 'legacy.unknown.key' }]);
  expect(result.domainGroups[0]).toHaveProperty('label');
  expect(result.cacheScopeGroups[0]).toHaveProperty('label');
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts
```

Expected: fail because labels are missing.

- [ ] **Step 3: Implement labels and helper**

In `governance.ts`, add:

```typescript
const DOMAIN_LABELS: Record<AppSettingDomain, string> = {
  about: 'About',
  brand: 'Brand',
  client: 'Client',
  composio: 'Composio',
  content: 'Content',
  growth: 'Growth',
  model: 'Model',
  notification: 'Notification',
  operations: 'Operations',
  pricing: 'Pricing',
  storage: 'Storage',
  system: 'System',
  'user-defaults': 'User defaults',
};

const CACHE_SCOPE_LABELS: Record<string, string> = {
  'app-settings': 'App settings',
  brand: 'Brand runtime',
  runtime: 'Model/runtime',
  s3: 'S3 runtime',
  'user-state': 'User state',
};
```

Add `label` to domain/cache group result objects. Add:

```typescript
export const isUnknownAppSettingKey = (key: string) => !getAppSettingRegistryItem(key);
```

- [ ] **Step 4: Run green test**

Run the same Vitest command. Expected: pass.

---

### Task 2: Add Audited Unknown-Key Cleanup Mutation

**Files:**
- Modify: `packages/business-server/src/lambda-routers/admin/settings.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/settings.test.ts`

- [ ] **Step 1: Add failing backend tests**

In `settings.test.ts`, add tests:

```typescript
it('deletes unknown app setting keys with exact confirmation and audit log', async () => {
  const where = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ key: 'legacy.unknown.key' }]) }));
  const db = {
    delete: vi.fn(() => ({ where })),
    query: {
      users: { findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'system_admin' }) },
    },
  } as any;
  vi.mocked(getServerDB).mockResolvedValue(db);

  await expect(
    adminSettingsRouter.createCaller({ userId: 'system-admin-user' } as any).deleteUnknownSetting({
      confirmKey: 'legacy.unknown.key',
      key: 'legacy.unknown.key',
    }),
  ).resolves.toEqual({ deleted: true, key: 'legacy.unknown.key' });

  expect(db.delete).toHaveBeenCalled();
  expect(recordAdminAudit).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      action: 'settings.deleteUnknown',
      resourceId: 'legacy.unknown.key',
      resourceType: 'app_setting',
    }),
  );
});

it('rejects deleting registered app setting keys', async () => {
  const db = createDb({ role: 'system_admin' });
  vi.mocked(getServerDB).mockResolvedValue(db);

  await expect(
    adminSettingsRouter.createCaller({ userId: 'system-admin-user' } as any).deleteUnknownSetting({
      confirmKey: APP_SETTING_KEYS.brandName,
      key: APP_SETTING_KEYS.brandName,
    }),
  ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
});

it('rejects unknown setting cleanup when confirmation does not match', async () => {
  const db = createDb({ role: 'system_admin' });
  vi.mocked(getServerDB).mockResolvedValue(db);

  await expect(
    adminSettingsRouter.createCaller({ userId: 'system-admin-user' } as any).deleteUnknownSetting({
      confirmKey: 'wrong',
      key: 'legacy.unknown.key',
    }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
});
```

- [ ] **Step 2: Run red backend test**

Run:

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts -t "unknown app setting|unknown setting cleanup|registered app setting"
```

Expected: fail because mutation is missing.

- [ ] **Step 3: Implement mutation**

In `settings.ts`, import:

```typescript
import { isUnknownAppSettingKey } from '@/server/services/appSettings/governance';
```

Add router member near `getGovernance`:

```typescript
  deleteUnknownSetting: systemWriteProcedure
    .input(
      z.object({
        confirmKey: z.string().min(1),
        key: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmKey !== input.key) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'CONFIRMATION_KEY_MISMATCH',
        });
      }

      if (!isUnknownAppSettingKey(input.key)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'REGISTERED_SETTING_DELETE_BLOCKED',
        });
      }

      const deleted = await ctx.serverDB
        .delete(appSettings)
        .where(eq(appSettings.key, input.key))
        .returning({ key: appSettings.key });

      await recordAdminAudit(ctx, {
        action: 'settings.deleteUnknown',
        payload: { key: input.key },
        resourceId: input.key,
        resourceType: 'app_setting',
      });

      return { deleted: deleted.length > 0, key: input.key };
    }),
```

- [ ] **Step 4: Run green backend test**

Run the same command. Expected: pass.

---

### Task 3: Wire Cleanup Into Admin Governance Card

**Files:**
- Modify: `src/services/adminCommercial.ts`
- Modify: `src/features/Admin/AdminSettingsGovernanceCard.tsx`
- Modify: `src/features/Admin/adminCommercialFlow.test.ts`

- [ ] **Step 1: Add failing static test**

In `adminCommercialFlow.test.ts`, extend the governance test with:

```typescript
expect(settingsRouter).toContain('deleteUnknownSetting: systemWriteProcedure');
expect(service).toContain('deleteUnknownAppSetting');
expect(service).toContain('admin.settings.deleteUnknownSetting.mutate(params)');
expect(governanceCard).toContain('deleteUnknownAppSetting');
expect(governanceCard).toContain('confirmKey');
```

- [ ] **Step 2: Run red static test**

Run:

```powershell
bunx vitest run --silent='passed-only' src/features/Admin/adminCommercialFlow.test.ts -t governance
```

Expected: fail until service/card wiring exists.

- [ ] **Step 3: Add service helper**

In `adminCommercial.ts`:

```typescript
  deleteUnknownAppSetting = async (params: { confirmKey: string; key: string }) => {
    return lambdaClient.admin.settings.deleteUnknownSetting.mutate(params);
  };
```

- [ ] **Step 4: Add cleanup action to card**

In `AdminSettingsGovernanceCard.tsx`, add `message` and `Modal` imports from antd. Add a handler:

```tsx
const handleDeleteUnknownKey = (key: string) => {
  Modal.confirm({
    okButtonProps: { danger: true },
    okText: t('admin.settings.governance.deleteUnknownConfirm', '删除'),
    title: t('admin.settings.governance.deleteUnknownTitle', '删除未知设置项'),
    content: key,
    onOk: async () => {
      await adminCommercialService.deleteUnknownAppSetting({ confirmKey: key, key });
      message.success(t('admin.settings.governance.deleteUnknownSuccess', '未知设置项已删除'));
      await mutate();
    },
  });
};
```

Render a danger small button for each unknown key:

```tsx
<Button danger size="small" onClick={() => handleDeleteUnknownKey(item.key)}>
  {t('admin.settings.governance.deleteUnknown', '删除')}
</Button>
```

- [ ] **Step 5: Run green static test**

Run the same static test. Expected: pass.

---

### Task 4: Verification, Review, And Commit

**Files:**
- All files changed by Tasks 1-3.

- [ ] **Step 1: Run targeted verification**

Run:

```powershell
bunx vitest run --silent='passed-only' src/server/services/appSettings/governance.test.ts src/features/Admin/adminCommercialFlow.test.ts
```

Run:

```powershell
bunx vitest run --config packages/business-server/vitest.config.mts --silent='passed-only' packages/business-server/src/lambda-routers/admin/settings.test.ts
```

- [ ] **Step 2: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git diff
```

Confirm:
- Registered settings cannot be deleted by cleanup mutation.
- Confirmation key is required and exact.
- Cleanup writes audit log.
- Governance card does not display setting values.
- No broad admin navigation/UI restructure occurred.

- [ ] **Step 3: Commit P3**

Commit only P3 changes:

```powershell
git add -f docs/superpowers/plans/2026-07-06-p3-admin-settings-cleanup.md
git add src/server/services/appSettings/governance.ts src/server/services/appSettings/governance.test.ts packages/business-server/src/lambda-routers/admin/settings.ts packages/business-server/src/lambda-routers/admin/settings.test.ts src/services/adminCommercial.ts src/features/Admin/AdminSettingsGovernanceCard.tsx src/features/Admin/adminCommercialFlow.test.ts
git commit -m "add admin settings cleanup p3"
```

Commit body trailers:

```text
Constraint: cleanup path deletes only unknown app setting keys
Tested: <commands that passed>
Not-tested: <commands skipped with reason>
```
