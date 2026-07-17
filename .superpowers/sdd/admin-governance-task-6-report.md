# Admin Governance Task 6 Report

## Scope

- Required audit writes now fail closed and attach `correlationId` plus `started`, `succeeded`, or `failed` status.
- Audit payloads redact recursive secret-bearing fields before persistence and before best-effort failure logging.
- Rollbackable high/critical catalog commands use `runRequiredAdminAuditMutation`; the parity suite rejects a normal-DB mutation followed by a required audit outside that transaction.
- Maintenance writes a durable required `started` record before any effect, commits database maintenance work with its result audit in one transaction, and only then performs Module App upload cleanup with a correlated terminal result audit.
- Document deletion, S3 diagnostics, and Module App provider reconciliation/query/refund operations use the required external lifecycle because their service calls mix non-rollbackable effects with database work.
- External terminal audit writes retry three times and check the persisted `(correlationId, status, action)` tuple before each retry to avoid duplicate rows after an ambiguous acknowledgement. Exhaustion logs safe recovery metadata and raises a recovery-required error after an executed non-rollbackable effect; an effect failure retains its original error after recovery logging.
- Maintenance and batch reconciliation classify partial result failures as a `failed` terminal lifecycle without changing their existing response contracts.
- User, global audit-log, and credits exports produce distinct required audit events with filter metadata and counts only.
- Credits CSV data now comes from the dedicated audited backend `exportAccounts` procedure.
- `credits.listAccounts` is also required-audited with bounded cursor/filter/count metadata, closing the UI-compatible export bypass without logging returned rows.
- Module App audit adapters and the database model use the shared `audit` envelope, including correlation, status, action, resource, actor, target, and client-IP fields, while preserving legacy metadata columns/event types.
- Shared-envelope reads validate every field at runtime and return `undefined` for malformed or legacy payloads.
- Module App billing, entitlement, payment discrepancy, and payout mutations commit their database write and audit record together; entitlement delete/insert receives the outer transaction explicitly, and payment-reconciliation export emits a required count/filter-only audit event.

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
- Green: parity passed after transactional migrations for rollbackable content/topic, credits, provider, order, redemption, subscription, reset-all-users, and role mutations, while document/file deletion are explicitly classified as external effects.
- Red: review coverage exposed `settings.runMaintenance` as a high-severity parity exemption with database and storage work before its final audit.
- Green: maintenance now has a required lifecycle, a database transaction/result audit, post-commit upload cleanup, and correlated terminal retry/recovery behavior.
- Red: Module App finance state changes and reconciliation export wrote no transactional/export audit record.
- Green: Module App financial writes use the transaction helper and the export emits a required common-envelope audit.
- Red: independent review found that maintenance's inner database-phase success row could satisfy the outer terminal retry lookup, and that a throwing terminal classifier could leave an executed effect at `started`.
- Green: every terminal write now carries a unique `terminalAuditId` used by retry lookup, while classifier failures write a correlated `failed` terminal row and raise recovery-required.
- Second re-review regression tests were authored before their implementation. Per the explicit one-round instruction, this wave used one consolidated execution; only the two failed assertion-contract cases received a failure-only confirmation after correction.

## Rollback Evidence

- `audit.test.ts` and `adminAuditTransactions.test.ts` are fast simulations. They exercise helper and real router callbacks with mocked transaction executors, but they are not database rollback evidence.
- `adminAuditTransactions.integration.test.ts` uses the repository `getTestDB` PGlite/PostgreSQL helper and real Drizzle transactions. A real audit foreign-key failure rolls back an app-setting write, and a thrown business failure rolls back an already-inserted audit row.
- The external-effect tests prove a failed required `started` insert prevents the effect, terminal rows share the supplied correlation ID, ambiguous terminal acknowledgement does not duplicate the tuple, terminal writes retry, and terminal exhaustion is surfaced as recovery-required after an executed external effect.

## Verification

- Single consolidated business-server round: 24 of 26 files passed and 219 of 221 tests passed. The two failures were new started-audit gate tests that used object identity against a raw `Error`; tRPC correctly returned `TRPCError` with `INTERNAL_SERVER_ERROR` and the same message. Both assertions were corrected to the established router error contract, then the two failed cases alone passed in one failure-only confirmation (2 files, 2 tests); the 221-test suite was not rerun.
- Shared audit-envelope utility: 2 tests passed.
- Database Module App audit/marketplace regressions: 12 tests across 2 files passed.
- The real repository test-DB transaction integration file passed both rollback tests inside the business-server round.
- Review-fix round: `audit.test.ts` passed 17 of 17 tests; `bun run type-check`, targeted ESLint, and `git diff --check` passed after the terminal-idempotency and classifier-recovery fixes.

## Residual Limitation

- Document/object deletion, S3 diagnostics, and provider payment/refund calls are non-rollbackable. The required `started` record, correlated terminal audit, idempotent bounded retry, and recovery-required error provide traceability and operator recovery signals; they do not make an external effect atomic with service-side database changes.
