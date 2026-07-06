# Governance Sprint 003

Date: 2026-07-07

Scope: continue small governance execution after Sprint 002. This sprint does not change database schema, payment behavior, routing, or deployment. It adds guardrails and pure display helpers for two unstable areas: AI model catalog display and commercial credit ledger presentation.

## Selected Tasks

### GOV-016: Sprint 003 execution register

- Problem: the next governance batch needs a concrete, auditable task list before implementation.
- Priority: P0/P1 governance continuity.
- Files: `docs/GOVERNANCE_SPRINT_003.md`.
- Test first: no, documentation task.
- Steps: create this file, define at least 10 scoped tasks, list verification commands.
- Rollback: delete this file.
- Acceptance: sprint file exists and each task is independently reviewable.

### GOV-017: Model catalog provider display resolver

- Problem: admin-created providers can expose UUID-like IDs when display names are missing or not normalized.
- Priority: P1 AI provider/model display consistency.
- Files: `src/server/services/modelCatalog/visibleModels.ts`, `src/server/services/modelCatalog/visibleModels.test.ts`.
- Test first: yes.
- Steps: add failing tests for provider display priority and UUID fallback, then add a pure resolver.
- Rollback: remove resolver and tests.
- Acceptance: tests prove UUID-like provider IDs are not used as display labels when no readable name exists.

### GOV-018: Model catalog model display resolver

- Problem: model selectors and diagnostics need one readable model label rule instead of page-local fallbacks.
- Priority: P1 AI provider/model display consistency.
- Files: `src/server/services/modelCatalog/visibleModels.ts`, `src/server/services/modelCatalog/visibleModels.test.ts`.
- Test first: yes.
- Steps: add tests for model display-name priority and model ID fallback.
- Rollback: remove resolver and tests.
- Acceptance: resolver prefers explicit display names and falls back to model ID.

### GOV-019: Duplicate model grouping across providers

- Problem: duplicate model IDs across different providers should be grouped by provider, not silently collapsed or diagnosed only within one provider.
- Priority: P1 duplicate model governance.
- Files: `src/server/services/modelCatalog/visibleModels.ts`, `src/server/services/modelCatalog/visibleModels.test.ts`.
- Test first: yes.
- Steps: add tests for duplicate model IDs across provider instances, then add grouping helper.
- Rollback: remove grouping helper and tests.
- Acceptance: duplicate groups are keyed by model type and model ID and contain readable provider labels.

### GOV-020: Model diagnostics duplicate warning update

- Problem: existing diagnostics only warn on duplicate `providerId:modelId:type`, which misses duplicate model IDs across provider groups.
- Priority: P1 AI model diagnostics.
- Files: `src/server/services/modelCatalog/diagnostics.ts`, `src/server/services/modelCatalog/diagnostics.test.ts`.
- Test first: yes.
- Steps: add failing diagnostics test for cross-provider duplicate IDs, then use duplicate grouping helper.
- Rollback: restore previous diagnostics logic and remove test.
- Acceptance: diagnostics report `duplicate:<type>:<modelId>` warnings with provider names.

### GOV-021: Credit ledger allocation formatter extraction

- Problem: credit ledger allocation formatting lives inside `Credits.tsx`, making billing text regressions hard to test.
- Priority: P2 commercial page ViewModel boundary.
- Files: `src/business/client/BusinessSettingPages/creditsDisplay.ts`, `src/business/client/BusinessSettingPages/creditsDisplay.test.ts`, `src/business/client/BusinessSettingPages/Credits.tsx`.
- Test first: yes.
- Steps: add failing tests for allocation parsing and formatting, then extract pure helper and wire the page to it.
- Rollback: inline the logic back into `Credits.tsx` and delete helper/test.
- Acceptance: helper test passes and `Credits.tsx` no longer owns allocation normalization.

### GOV-022: Credit ledger malformed allocation guard

- Problem: malformed ledger allocation metadata can produce noisy or misleading UI.
- Priority: P2 commercial ledger robustness.
- Files: `src/business/client/BusinessSettingPages/creditsDisplay.test.ts`, `src/business/client/BusinessSettingPages/creditsDisplay.ts`.
- Test first: yes.
- Steps: test non-consume entries, missing allocations, non-object rows, non-number amounts, and blank sources.
- Rollback: remove guard tests and helper.
- Acceptance: malformed allocations produce `null`, not partial or raw metadata strings.

### GOV-023: Model catalog display rules document

- Problem: provider/model display rules need to survive later upstream merges and admin UI changes.
- Priority: P1 governance documentation.
- Files: `docs/MODEL_CATALOG_DISPLAY_RULES.md`, `docs/GOVERNANCE_INDEX.md`.
- Test first: no, documentation task.
- Steps: document provider display priority, model display priority, duplicate grouping, and non-goals.
- Rollback: delete the document and index entry.
- Acceptance: future changes have a single rule reference.

### GOV-024: Feature registry update

- Problem: Sprint 003 changes affect AI provider/model catalog and credits/ledger modules.
- Priority: P1 governance continuity.
- Files: `docs/FEATURE_REGISTRY.md`.
- Test first: no, documentation task.
- Steps: append a governance execution note for GOV-016 to GOV-025.
- Rollback: remove appended note.
- Acceptance: registry records the Sprint 003 scope.

### GOV-025: Internal changelog update

- Problem: sprint execution details must be recoverable without reading git history.
- Priority: P1 governance continuity.
- Files: `docs/CHANGELOG_INTERNAL.md`.
- Test first: no, documentation task.
- Steps: append Sprint 003 summary and verification list.
- Rollback: remove appended changelog entry.
- Acceptance: changelog records code and docs changed in this sprint.

## Verification

Commands to run for this sprint:

- `bunx vitest run --silent='passed-only' "src/server/services/modelCatalog/visibleModels.test.ts"`
- `bunx vitest run --silent='passed-only' "src/server/services/modelCatalog/diagnostics.test.ts"`
- `bunx vitest run --silent='passed-only' "src/business/client/BusinessSettingPages/creditsDisplay.test.ts"`
- `bunx vitest run --silent='passed-only' "src/business/client/BusinessSettingPages/ledgerDisplay.test.ts"`
- `git diff --check`

## Non-goals

- No deployment.
- No database migration.
- No payment gateway changes.
- No ModelSwitchPanel data-source rewrite.
- No full commercial page UI rewrite.
- No broad encoding cleanup.
