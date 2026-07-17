# Admin Governance Task 6 Report

## Scope

- Required audit writes now fail closed and attach `correlationId` plus `started`, `succeeded`, or `failed` status.
- Audit payloads redact recursive secret-bearing fields before persistence and before best-effort failure logging.
- Rollbackable high/critical catalog commands use `runRequiredAdminAuditMutation`; the parity suite rejects a normal-DB mutation followed by a required audit outside that transaction.
- Maintenance writes a durable required `started` record before any effect, commits database maintenance work with its result audit in one transaction, and only then performs Module App upload cleanup with a correlated terminal result audit.
- External terminal audit writes retry three times. Exhaustion logs safe recovery metadata and raises a recovery-required error after a successful non-rollbackable effect; an effect failure retains its original error after recovery logging.
- User, global audit-log, and credits exports produce distinct required audit events with filter metadata and counts only.
- Credits CSV data now comes from the dedicated audited backend `exportAccounts` procedure.
- Module App audit adapters and the database model use the shared `audit` envelope, including correlation, status, action, resource, actor, target, and client-IP fields, while preserving legacy metadata columns/event types.
- Module App payment discrepancy acknowledgement and payout creation/manual-payment/transition mutations now commit their financial write and audit record together; payment-reconciliation export emits a required count/filter-only audit event.

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
- Red: review coverage exposed `settings.runMaintenance` as a high-severity parity exemption with database and storage work before its final audit.
- Green: maintenance now has a required lifecycle, a database transaction/result audit, post-commit upload cleanup, and correlated terminal retry/recovery behavior.
- Red: Module App finance state changes and reconciliation export wrote no transactional/export audit record.
- Green: Module App financial writes use the transaction helper and the export emits a required common-envelope audit.

## Rollback Evidence

- `audit.test.ts` simulates a transactional working set: an audit insert failure leaves no business write, and a business failure leaves no audit row.
- `adminAuditTransactions.test.ts` drives the actual content archive, order cancellation, and credits adjustment router callbacks: an audit insert failure rolls each transaction back.
- The external-effect tests prove a failed required `started` insert prevents the effect, terminal rows share the supplied correlation ID, terminal writes retry, and terminal exhaustion is surfaced as recovery-required after a successful external effect.

## Verification

- Focused Admin router suite: 191 tests across 22 files passed.
- Module App audit adapter: 1 test passed.
- Shared audit-envelope utility: 1 test passed.
- Database Module App audit model: 1 test passed.
- `bun run type-check`, targeted ESLint, and `git diff --check` are run as final gates after this report update.

## Residual Limitation

- Module App upload storage cleanup and other external effects are non-rollbackable. The required `started` record, correlated database/terminal audits, bounded terminal retry, and recovery-required error provide traceability and operator recovery signals; they do not make the external effect atomic with the database transaction.
