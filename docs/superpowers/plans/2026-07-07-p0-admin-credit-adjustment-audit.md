# Admin Credit Adjustment Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add before/after credit-account snapshots to the audit log for admin credit adjustments.

**Architecture:** Keep this as a narrow P0-09 slice. The `adminCreditsRouter.adjust` mutation remains the public API and still writes the ledger inside one DB transaction; it additionally captures a normalized credit-account snapshot before and after the balance mutation, then passes those snapshots into `recordAdminAudit`.

**Tech Stack:** TypeScript, tRPC router, Drizzle query builder, Vitest.

## Global Constraints

- Do not change the external input/output contract of `adminCreditsRouter.adjust`.
- Do not migrate schemas or change credit ledger semantics in this slice.
- Follow TDD: write the failing audit-payload test before changing production code.
- Keep the change independently revertible.
- Do not use subagents for this execution because the user explicitly asked to execute directly.

---

## File Structure

- Modify: `packages/business-server/src/lambda-routers/admin/credits.ts`
  - Responsibility: perform the admin credit adjustment, ledger insert, and audit recording.
- Create: `packages/business-server/src/lambda-routers/admin/credits.test.ts`
  - Responsibility: verify `credits.adjust` records before/after snapshots in the admin audit payload.
- Modify: `docs/CHANGELOG_INTERNAL.md`
  - Responsibility: record the governance change as `GOV-029`.
- Modify: `docs/FEATURE_REGISTRY.md`
  - Responsibility: update governance execution notes for the credit adjustment audit slice.

## Task 1: Add credit adjustment audit snapshots

**Files:**
- Create: `packages/business-server/src/lambda-routers/admin/credits.test.ts`
- Modify: `packages/business-server/src/lambda-routers/admin/credits.ts`
- Modify: `docs/CHANGELOG_INTERNAL.md`
- Modify: `docs/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: existing `adminCreditsRouter.adjust` input `{ userId: string; amount: number; reason: string }`.
- Produces: unchanged mutation result `{ ok: true }`.
- Produces: audit payload `{ amount, reason, before, after }` where `before` and `after` include `balance`, `totalCredited`, and `totalDebited`.

- [ ] **Step 1: Write the failing test**

Create `packages/business-server/src/lambda-routers/admin/credits.test.ts` with a focused router test:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordAdminAudit } from './audit';
import { adminCreditsRouter } from './credits';

vi.mock('./audit', () => ({
  recordAdminAudit: vi.fn(),
}));

const createSelectChain = (rows: unknown[]) => ({
  from: vi.fn(() => ({
    where: vi.fn().mockResolvedValue(rows),
  })),
});

describe('adminCreditsRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('records before and after snapshots when admin adjusts credits', async () => {
    const before = { balance: 200, totalCredited: 500, totalDebited: 300 };
    const after = { balance: 300, totalCredited: 600, totalDebited: 300 };
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      select: vi
        .fn()
        .mockReturnValueOnce(createSelectChain([before]))
        .mockReturnValueOnce(createSelectChain([after])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: updateWhere })),
      })),
    } as any;
    tx.insert.mockReturnValueOnce({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    });
    tx.insert.mockReturnValueOnce({ values: insertValues });
    const db = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ banned: false, role: 'finance_admin' }),
        },
      },
      transaction: vi.fn(async (handler: (transaction: typeof tx) => Promise<void>) => handler(tx)),
    } as any;

    const caller = adminCreditsRouter.createCaller({
      serverDB: db,
      userId: 'admin-user',
    } as any);

    await expect(
      caller.adjust({ amount: 100, reason: 'manual correction', userId: 'target-user' }),
    ).resolves.toEqual({ ok: true });

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'credits.adjust',
        payload: {
          amount: 100,
          after,
          before,
          reason: 'manual correction',
        },
        resourceType: 'credit_account',
        targetUserId: 'target-user',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/credits.test.ts"
```

Expected: FAIL because the current audit payload is only `{ amount, reason }`.

- [ ] **Step 3: Implement the minimal production change**

In `packages/business-server/src/lambda-routers/admin/credits.ts`, inside `adjust`:

- after `insert(...).onConflictDoNothing(...)`, select `before` snapshot:
  - `balance`
  - `totalCredited`
  - `totalDebited`
- perform the existing positive/negative update logic.
- select `after` snapshot with the same fields.
- use `after.balance` as `balanceAfter` for the ledger insert.
- return `{ before, after }` from the transaction.
- pass `{ amount, reason, before, after }` to `recordAdminAudit`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
cd packages/business-server
bunx vitest run --silent='passed-only' "src/lambda-routers/admin/credits.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Update governance docs**

Add `GOV-029` to `docs/CHANGELOG_INTERNAL.md` and add a governance execution note to `docs/FEATURE_REGISTRY.md`:

- Scope: `Admin Credit Adjustment Audit`
- Status: `active`
- Note: `GOV-029 adds before/after credit account snapshots to the credits.adjust audit payload.`

- [ ] **Step 6: Verify and review**

Run:

```powershell
git diff --check
bunx eslint "packages/business-server/src/lambda-routers/admin/credits.ts" "packages/business-server/src/lambda-routers/admin/credits.test.ts"
```

Expected: `git diff --check` exits 0; scoped ESLint has no new errors.

- [ ] **Step 7: Commit**

```powershell
git add -f docs/superpowers/plans/2026-07-07-p0-admin-credit-adjustment-audit.md
git add packages/business-server/src/lambda-routers/admin/credits.ts packages/business-server/src/lambda-routers/admin/credits.test.ts docs/CHANGELOG_INTERNAL.md docs/FEATURE_REGISTRY.md
git commit -m ":memo: audit credit adjustments with snapshots" -m "Constraint: keep P0-09 slice scoped to admin credit adjustment audit payload." -m "Tested: cd packages/business-server; bunx vitest run --silent=passed-only src/lambda-routers/admin/credits.test.ts" -m "Tested: git diff --check"
```

## Self-Review

- Spec coverage: covers P0-09-2 for credit adjustment operations only; plan intentionally does not touch plan operations or cache sync operations.
- Placeholder scan: no placeholders.
- Type consistency: `before` and `after` field names match the intended audit payload and existing `creditAccounts` columns.
