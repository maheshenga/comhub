# Admin Governance Task 5 Report

## Result

- Added the shared 17-entry `AdminCommandDefinition` catalog in `@lobechat/types`.
- Enforced command envelopes for all 16 confirmation actions without renaming tRPC procedures.
- Kept `setting.setAppSetting` envelope-free and derived its audit action from the shared catalog.
- Routed every visible dangerous action through `AdminDangerousActionButton` or `AdminBulkActionFlow` and forwarded the resulting envelope through the service layer.
- Preserved middleware capabilities, business writes, transaction boundaries, outputs, and the reset-all preview.

## RED Evidence

1. `packages/types`: `src/adminCommand.test.ts` failed because `./adminCommand` did not exist.
2. `packages/business-server`: two `content.test.ts` bypass tests resolved instead of rejecting when the command envelope was missing or targeted another action.
3. `packages/business-server`: `adminCommand.test.ts` failed because the backend helper did not exist.
4. Root frontend: `adminDangerousActions.test.ts` failed because the frontend still owned a copied catalog and did not build shared envelopes.
5. Root frontend: `adminCommercial.test.ts` failed three envelope-forwarding assertions for impersonation and document deletion.
6. `packages/business-server`: the strengthened missing-envelope router assertion initially received a generic Zod error instead of `ADMIN_COMMAND_REQUIRED`.

## GREEN Evidence

### Shared types

```text
Command: cd packages/types && bunx vitest run --silent='passed-only'
Result: 12 test files passed, 54 tests passed
```

### Backend helper and changed routers

```text
Command: cd packages/business-server && bunx vitest run --silent='passed-only' src/lambda-routers/admin/adminCommand.test.ts src/lambda-routers/admin/adminCommandParity.test.ts src/lambda-routers/admin/content.test.ts src/lambda-routers/admin/credits.test.ts src/lambda-routers/admin/newapiProviders.test.ts src/lambda-routers/admin/orders.test.ts src/lambda-routers/admin/redemption.test.ts src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/subscriptions.test.ts src/lambda-routers/admin/users.test.ts
Result: 10 test files passed, 96 tests passed
```

### Frontend adapters, services, and focused pages

```text
Command: bunx vitest run --silent='passed-only' src/features/Admin/adminDangerousActions.test.ts src/features/Admin/adminCommercialFlow.test.ts src/features/Admin/AdminSystemMaintenancePage.test.tsx src/services/adminCommercial.test.ts
Result: 4 test files passed, 64 tests passed
```

### Static and type gates

```text
Command: bun run type-check
Result: exit 0 (`tsgo --noEmit`)

Command: node node_modules/eslint/bin/eslint.js <all changed TypeScript/TSX files>
Result: exit 0

Command: git diff --check
Result: exit 0
```

## Contract Checks

- Compatibility action IDs and procedure paths are unique.
- All capabilities are valid and match router middleware.
- Canonical audit mappings are asserted from `ADMIN_COMMANDS`.
- Missing, mismatched, unconfirmed, wrong typed text, and blank required reasons fail before business model calls.
- Every catalog procedure is statically checked for schema wiring, handler validation, middleware parity, and catalog-derived audit actions.
- Every confirmation-mode catalog action is present on a shared frontend dangerous-action component.

## Concerns

None.

## Review Fix Evidence

### Result

- Replaced the impersonation catalog's audit-only tRPC boundary with the actual `POST /api/auth/admin/impersonate-user` HTTP boundary.
- The auth catch-all now validates the shared command, authenticates and authorizes the actor, resolves the target, records the canonical attempt audit, strips the governance-only command, and then returns Better Auth's response and cookies unchanged.
- The frontend service sends the envelope directly to the effect boundary and no longer relies on a separate pre-audit tRPC call.
- Added one reason resolver for envelope and legacy fields. It trims both, accepts one/equal values, rejects conflicting non-empty values with `ADMIN_COMMAND_REASON_MISMATCH`, and supplies the single reason used by writes and audit.
- Made command schemas nullish at parsing boundaries so `null` reaches deterministic `ADMIN_COMMAND_REQUIRED` validation.

### RED

1. Shared catalog tests failed 2 assertions because definitions had no discriminated `serverBoundary` and impersonation still pointed to the audit-only tRPC procedure.
2. Backend review tests failed 11 assertions across helper/parity/router suites: `null` was rejected by generic Zod parsing, legacy-only reasons were rejected, and all six reason-bearing routers accepted conflicting values.
3. Auth route, service, and component forwarding tests failed 6 assertions because direct impersonation requests reached Better Auth without command/audit enforcement, the service dropped the envelope at the HTTP boundary, and the catalog exposed no HTTP boundary.
4. A self-review route test then failed because a trailing slash bypassed the exact-path guard; path normalization closed that alternate entry.

### GREEN

```text
Command: cd packages/types && bunx vitest run --silent='passed-only'
Result: 12 test files passed, 54 tests passed

Command: cd packages/business-server && bunx vitest run --silent='passed-only' src/lambda-routers/admin/adminCommand.test.ts src/lambda-routers/admin/adminCommandParity.test.ts src/lambda-routers/admin/content.test.ts src/lambda-routers/admin/credits.test.ts src/lambda-routers/admin/newapiProviders.test.ts src/lambda-routers/admin/orders.test.ts src/lambda-routers/admin/redemption.test.ts src/lambda-routers/admin/settings.test.ts src/lambda-routers/admin/subscriptions.test.ts src/lambda-routers/admin/users.test.ts
Result: 10 test files passed, 104 tests passed

Command: node node_modules/vitest/vitest.mjs run --silent='passed-only' src/features/Admin/adminDangerousActions.test.ts src/features/Admin/adminCommercialFlow.test.ts src/features/Admin/AdminSystemMaintenancePage.test.tsx src/features/Admin/AdminDangerousActionButton.test.tsx src/services/adminCommercial.test.ts "src/app/(backend)/api/auth/[...all]/route.test.ts"
Result: 6 test files passed, 73 tests passed

Command: bun run type-check
Result: exit 0 (`tsgo --noEmit`)

Command: node node_modules/eslint/bin/eslint.js <all changed TypeScript/TSX files>
Result: exit 0

Command: git diff --check
Result: exit 0
```
