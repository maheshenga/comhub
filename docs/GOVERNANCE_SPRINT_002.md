# Governance Sprint 002

Date: 2026-07-07

Scope: execute the next small governance batch after GOV-001 to GOV-003. This sprint keeps changes reversible and avoids large transaction, routing, or deployment rewrites.

## Selected Tasks

### GOV-004: Sprint 002 execution register

- Problem: the next governance batch needs an auditable task list before code and docs drift again.
- Priority: P0/P1 governance continuity.
- Files: `docs/GOVERNANCE_SPRINT_002.md`.
- Test first: no, documentation task.
- Steps: create this file, list task boundaries, record verification commands.
- Rollback: delete this file.
- Acceptance: sprint file lists at least 10 independently reviewable tasks.

### GOV-005: Secret-like setting name guard

- Problem: app settings can accidentally become public runtime settings even when their names imply credentials.
- Priority: P0 security guardrail.
- Files: `src/const/appSettingsRegistry.ts`, `src/server/services/appSettings/governance.test.ts`.
- Test first: yes.
- Steps: add failing test for secret-like names, add `hasSecretLikeAppSettingKeyName`, verify public runtime settings do not match secret-like names.
- Rollback: remove helper and test.
- Acceptance: governance test passes and checks `apiKey`, `secret`, `token`, `accessKey`, and related names.

### GOV-006: Admin settings map

- Problem: 162 app setting keys are spread across pages, runtime caches, and public/private surfaces.
- Priority: P0 configuration drift reduction.
- Files: `docs/ADMIN_SETTINGS_MAP.md`.
- Test first: no, documentation task backed by registry script output.
- Steps: document domain counts, cache scopes, sensitive keys, public runtime rules, and ownership boundaries.
- Rollback: delete the document.
- Acceptance: document records registry count, domain groups, cache scopes, sensitive keys, and change checklist.

### GOV-007: Public desktop config allowlist guard

- Problem: desktop update config must not expose OSS credentials or accidental admin-only keys.
- Priority: P0 security and client release stability.
- Files: `packages/business-server/src/lambda-routers/admin/settings.test.ts`.
- Test first: no production code change; guard expands existing passing behavior.
- Steps: assert exact public keys and exact `loginConfig` keys returned by `getPublicDesktopUpdate`.
- Rollback: remove added assertions.
- Acceptance: business-server settings test passes.

### GOV-008: Ledger formatter edge coverage

- Problem: credit ledger descriptions can expose raw provider IDs or lose readable model/provider names.
- Priority: P1 AI provider and billing clarity.
- Files: `src/business/client/BusinessSettingPages/ledgerDisplay.test.ts`.
- Test first: no production code change; guard expands existing formatter coverage.
- Steps: add cases for slash-containing model IDs, provider display priority, and blank/non-string descriptions.
- Rollback: remove added tests.
- Acceptance: ledger display test passes.

### GOV-009: Plan discount guard coverage

- Problem: yearly discount labels and missing monthly prices are easy to display incorrectly while aligning upstream UI.
- Priority: P2 commercial display consistency.
- Files: `src/business/client/BusinessSettingPages/plansDisplay.test.ts`.
- Test first: no production code change; guard expands existing formatter coverage.
- Steps: test configured yearly label trim, computed discounts, no invented discounts, and monthly fallback.
- Rollback: remove added tests.
- Acceptance: plans display test passes.

### GOV-010: Top-up promotion serialization cleanup

- Problem: promotion metadata serialization carried `originalAmount: undefined`, which is noisy for settings payloads and diffs.
- Priority: P2 pricing presentation cleanup.
- Files: `src/const/billingPresentation.ts`, `src/const/billingPresentation.test.ts`.
- Test first: yes.
- Steps: write failing strict serialization test, omit `originalAmount` unless numeric, add invalid amount coverage.
- Rollback: restore serializer object shape and remove tests.
- Acceptance: billing presentation test passes.

### GOV-011: Referral input formatter extraction

- Problem: referral code parsing lived inside the React page, making it hard to test and easy to regress.
- Priority: P2 commercial page ViewModel boundary.
- Files: `src/business/client/BusinessSettingPages/referralDisplay.ts`, `src/business/client/BusinessSettingPages/referralDisplay.test.ts`, `src/business/client/BusinessSettingPages/Referral.tsx`.
- Test first: yes.
- Steps: add failing helper test, create `normalizeReferralCodeInput`, wire the page to it.
- Rollback: inline the function back into `Referral.tsx` and delete helper/test.
- Acceptance: referral display helper test passes.

### GOV-012: Commercial page boundary contract

- Problem: plans, credits, billing, usage, and referral pages have overlapping data responsibilities.
- Priority: P1/P2 commercial architecture clarity.
- Files: `docs/COMMERCIAL_PAGE_BOUNDARIES.md`.
- Test first: no, documentation task.
- Steps: define page ownership, data source boundaries, allowed formatter locations, and anti-patterns.
- Rollback: delete the document.
- Acceptance: document gives a clear rule for each commercial page.

### GOV-013: Deployment version probe checklist

- Problem: production has previously appeared to roll back or miss new features after deployment.
- Priority: P0 deployment observability.
- Files: `docs/DEPLOYMENT_VERSION_PROBE.md`.
- Test first: no, documentation task.
- Steps: document commit SHA, image digest, asset hash, smoke route, and rollback evidence checks.
- Rollback: delete the document.
- Acceptance: checklist can be used before and after deploy without changing runtime code.

### GOV-014: Governance document index

- Problem: audit, registry, refactor plan, sprint docs, and internal changelog are spread across `docs/`.
- Priority: P1 governance usability.
- Files: `docs/GOVERNANCE_INDEX.md`.
- Test first: no, documentation task.
- Steps: index every governance artifact and define when each must be updated.
- Rollback: delete the document.
- Acceptance: future agents can find the right governance document quickly.

### GOV-015: Long-term registry and changelog update

- Problem: governance tasks are easy to lose unless the long-term registry records them.
- Priority: P1 continuity.
- Files: `docs/FEATURE_REGISTRY.md`, `docs/CHANGELOG_INTERNAL.md`.
- Test first: no, documentation task.
- Steps: append Sprint 002 execution notes and verification list.
- Rollback: remove appended notes.
- Acceptance: registry and changelog mention GOV-004 to GOV-015.

## Verification

Commands to run for this sprint:

- `bunx vitest run --silent='passed-only' "src/server/services/appSettings/governance.test.ts"`
- `bunx vitest run --silent='passed-only' "src/const/billingPresentation.test.ts"`
- `bunx vitest run --silent='passed-only' "src/business/client/BusinessSettingPages/referralDisplay.test.ts"`
- `bunx vitest run --silent='passed-only' "src/business/client/BusinessSettingPages/ledgerDisplay.test.ts"`
- `bunx vitest run --silent='passed-only' "src/business/client/BusinessSettingPages/plansDisplay.test.ts"`
- from `packages/business-server`: `bunx vitest run --silent='passed-only' "src/lambda-routers/admin/settings.test.ts"`
- `git diff --check`

## Non-goals

- No deployment.
- No large commercial data model rewrite.
- No database migration.
- No route deprecation or deletion.
- No payment gateway changes.
