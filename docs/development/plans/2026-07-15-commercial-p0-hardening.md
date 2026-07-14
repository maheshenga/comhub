# Commercial P0 Hardening Implementation Plan

**Goal:** Close the highest-risk authorization, subscription consistency, and credit-unit gaps without introducing a new payment or renewal engine.

**Architecture:** Keep the existing admin capability model and commercial tables, but make their boundaries enforceable at every layer. Shared admin-role definitions live in `@lobechat/types`, frontend routes filter by capability, backend routers request domain capabilities explicitly, and PostgreSQL partial unique indexes provide the final concurrency invariant. Credit APIs continue to use atomic credits while all admin inputs and displays use `M Credits` through one shared conversion helper.

**Tech stack:** TypeScript, React 19, tRPC, Drizzle ORM, PostgreSQL, Vitest.

## Global Constraints

- Preserve `admin` as the only full-access role.
- Scoped roles must never inherit unrestricted `adminProcedure` access.
- Keep Module App commerce and the general subscription domain separate.
- Database migrations must preserve historical financial amounts and auditability.
- Public and server APIs continue to exchange integer atomic credits.
- General-commercial admin forms display and accept `M Credits`, where `1 M = 1,000,000` atomic credits.
- Use focused Vitest runs; do not run the full test suite by default.

## Task 1: Close Admin RBAC

**Files:**

- Create `packages/types/src/admin.ts`
- Modify `packages/types/src/index.ts`
- Modify `packages/trpc/src/lambda/middleware/adminPermissions.ts`
- Modify relevant `packages/business-server/src/lambda-routers/admin/*.ts` routers
- Modify `src/features/Admin/adminNavigation.ts`
- Modify `src/features/Admin/AdminSidebar.tsx`
- Modify both admin route guards and the settings category hook
- Modify the admin user role editor

**Behavior:**

- Shared role definitions expose full and scoped roles without granting `admin.access` to scoped roles.
- Any recognized scoped role may enter the admin shell.
- Navigation and direct page access are filtered by the role's domain capabilities.
- Router reads use the corresponding domain capability instead of unrestricted `adminProcedure`.
- Only a full admin may assign roles, but all declared scoped roles can be assigned.

## Task 2: Enforce Commercial Database Invariants

**Files:**

- Modify `packages/database/src/schemas/commercial.ts`
- Create `packages/database/migrations/0146_harden_commercial_invariants.sql`
- Modify `packages/database/migrations/meta/_journal.json`
- Modify `packages/database/src/models/commercial.ts`
- Create focused schema and concurrency tests

**Behavior:**

- At most one active plan snapshot exists per user.
- At most one pending subscription change request exists per user.
- A subscription snapshot period can grant credits only once per user.
- Migration cleanup keeps the newest active/pending record and marks older records inactive.
- Historical duplicate grants remain financially unchanged but are explicitly marked as legacy duplicates before the unique index is added.
- Subscription grant synchronization locks the user's credit account before checking period references.

## Task 3: Normalize Admin Credit Units

**Files:**

- Modify `packages/const/src/currency.ts`
- Modify `src/business/client/BusinessSettingPages/shared.tsx`
- Modify plan, top-up package, adjustment, subscription, order, and user-detail admin views
- Add focused conversion and form-contract tests

**Behavior:**

- Shared helpers convert between atomic credits and `M Credits`.
- General-commercial admin forms submit atomic integer credits only after converting from `M Credits`.
- General-commercial admin tables and detail views consistently label displayed values as `M Credits`.
- CSV exports retain atomic-credit columns with explicit names to avoid silently changing machine-readable data.

Module App commerce and PPT-specific credit inputs remain outside this normalization batch.

## Verification And Review

- Run each new test before implementation and confirm the expected failure.
- Run focused RBAC, commercial schema/model, and admin UI tests after implementation.
- Run `bun run type-check` because shared TypeScript contracts change.
- Review the complete diff against this plan and the repository review checklist.
- Commit only after fresh verification succeeds; record any database-test environment blocker.

## Implementation Status

- Task 1 complete: shared scoped roles now protect navigation, direct routes, backend reads, and privileged user actions.
- Task 2 complete: partial unique indexes, cleanup migration, lock ordering, and conflict-tolerant fallbacks are implemented.
- Task 3 complete for the general-commercial admin surfaces defined above.
- PostgreSQL integration suites require `DATABASE_TEST_URL`; the local environment did not provide it during verification.
