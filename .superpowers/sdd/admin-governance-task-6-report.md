# Admin Governance Task 6 Report

## Scope

- Required audit writes now fail closed and attach `correlationId` plus `started`, `succeeded`, or `failed` status.
- Audit payloads redact recursive secret-bearing fields before persistence and before best-effort failure logging.
- Rollbackable high/critical catalog commands use `runRequiredAdminAuditMutation`; the parity suite enforces this contract.
- External file deletion records a required `started` audit before the effect and a correlated terminal record after it. It is explicitly not described as atomic.
- User, global audit-log, and credits exports produce distinct required audit events with filter metadata and counts only.
- Credits CSV data now comes from the dedicated audited backend `exportAccounts` procedure.
- Module App audit adapters and the database model normalize metadata to the common action/resource/correlation/status envelope without changing payment, refund, payout, or Worker state transitions.

## Red-Green Evidence

- Red: `bunx vitest run --silent='passed-only' src/lambda-routers/admin/audit.test.ts src/lambda-routers/admin/credits.test.ts` initially exposed `credits.adjust` writing its audit outside the transaction.
- Green: the same focused suite passed after moving credits into `runRequiredAdminAuditMutation`.
- Red: the added external-effect cases failed with `runRequiredAdminAuditExternalEffect is not a function`.
- Green: `audit.test.ts` passed after the helper wrote required correlated lifecycle rows.
- Red: the Module App adapter and model tests showed missing envelope fields and raw nested token values.
- Green: both tests passed after envelope normalization and recursive redaction.
- Red: user, audit-log, and credits export tests found no distinct audit procedures/events.
- Green: each export test passed with sanitized filter/count metadata and no row values.
- Red: the Task 5 parity suite rejected each unmigrated high/critical rollbackable command in turn.
- Green: parity passed after transactional migrations for content document/topic, credits, provider deletion, order settlement, redemption batches, subscription bulk operations, reset-all-users, and role changes.

## Rollback Evidence

- `audit.test.ts` simulates a transactional working set: an audit insert failure leaves no business write, and a business failure leaves no audit row.
- `credits.test.ts` rejects a same-transaction audit insert failure after business statements; the enclosing transaction is the single commit boundary.
- The external-effect tests prove a failed required `started` insert prevents the effect from running and terminal records share the supplied correlation ID.

## Verification

- Focused admin suite: 59 tests across 11 files passed.
- Module App runtime/admin financial regressions: 47 tests passed.
- Database Module App audit/payment/payout suite: 7 tests passed.
- `bun run type-check` passed.
- Targeted ESLint passed for every edited TypeScript file.
